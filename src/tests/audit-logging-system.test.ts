/**
 * Comprehensive Audit Logging System Tests
 * Tests all aspects of the medical-grade audit logging system
 * including rotation, monitoring, and integrity validation
 */

import {
  auditLogger,
  auditLogRotation,
  auditLogMonitoring,
  AuditEventType,
  AuditSeverity,
  type AuditEvent,
  type LogRotationConfig,
  type MonitoringConfig,
} from '../security';

// Mock dependencies
jest.mock('../security/secureStorage');
jest.mock('../security/encryption');
jest.mock('../utils/logger');

describe('Audit Logging System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any cached data
    (auditLogger as any).logBuffer = [];
    (auditLogMonitoring as any).metricsCache = new Map();
    (auditLogMonitoring as any).alertHistory = [];
  });

  afterEach(() => {
    // Cleanup
    auditLogger.dispose();
    auditLogMonitoring.dispose();
  });

  describe('AuditLogger Core Functionality', () => {
    test('should log basic audit events', async () => {
      const eventType = AuditEventType.DICOM_VIEW;
      const action = 'view_study';
      const outcome = 'success';

      await auditLogger.logEvent(eventType, action, outcome, {
        severity: AuditSeverity.MEDIUM,
        userId: 'test-user-123',
        studyId: 'study-456',
      });

      // Verify event was buffered
      expect((auditLogger as any).logBuffer).toHaveLength(1);
      const bufferedEvent = (auditLogger as any).logBuffer[0];
      expect(bufferedEvent.eventType).toBe(eventType);
      expect(bufferedEvent.action).toBe(action);
      expect(bufferedEvent.outcome).toBe(outcome);
      expect(bufferedEvent.userId).toBe('test-user-123');
      expect(bufferedEvent.studyId).toBe('study-456');
    });

    test('should handle critical events immediately', async () => {
      const flushSpy = jest.spyOn(auditLogger as any, 'flushBuffer');

      await auditLogger.logEvent(
        AuditEventType.SECURITY_SCAN,
        'security_breach_detected',
        'failure',
        { severity: AuditSeverity.CRITICAL }
      );

      expect(flushSpy).toHaveBeenCalled();
    });

    test('should generate unique event IDs', async () => {
      await auditLogger.logEvent(AuditEventType.LOGIN_SUCCESS, 'login', 'success');
      await auditLogger.logEvent(AuditEventType.LOGIN_SUCCESS, 'login', 'success');

      const buffer = (auditLogger as any).logBuffer;
      expect(buffer).toHaveLength(2);
      expect(buffer[0].eventId).not.toBe(buffer[1].eventId);
      expect(buffer[0].eventId).toMatch(/^audit-\d+-[a-z0-9]+$/);
    });

    test('should validate event severity determination', () => {
      const determineSeverity = (auditLogger as any).determineSeverity.bind(auditLogger);

      expect(determineSeverity(AuditEventType.SECURITY_SCAN, 'failure')).toBe(AuditSeverity.CRITICAL);
      expect(determineSeverity(AuditEventType.LOGIN_FAILURE, 'failure')).toBe(AuditSeverity.HIGH);
      expect(determineSeverity(AuditEventType.PHI_ACCESS, 'success')).toBe(AuditSeverity.MEDIUM);
      expect(determineSeverity(AuditEventType.DICOM_VIEW, 'success')).toBe(AuditSeverity.LOW);
    });

    test('should handle buffer flush correctly', async () => {
      // Add multiple events to buffer
      await auditLogger.logEvent(AuditEventType.DICOM_VIEW, 'view', 'success');
      await auditLogger.logEvent(AuditEventType.ANNOTATION_CREATE, 'create', 'success');
      await auditLogger.logEvent(AuditEventType.MEASUREMENT_EXPORT, 'export', 'success');

      expect((auditLogger as any).logBuffer).toHaveLength(3);

      // Trigger flush
      await (auditLogger as any).flushBuffer();

      // Buffer should be empty after flush
      expect((auditLogger as any).logBuffer).toHaveLength(0);
    });
  });

  describe('Log Filtering and Retrieval', () => {
    test('should filter logs by event type', async () => {
      // Mock stored logs
      const mockLogs: AuditEvent[] = [
        {
          eventId: '1',
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
        },
        {
          eventId: '2',
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.LOGIN_SUCCESS,
          severity: AuditSeverity.MEDIUM,
          action: 'login',
          outcome: 'success',
        },
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);

      const filteredLogs = await auditLogger.getAuditLogs({
        eventTypes: [AuditEventType.DICOM_VIEW],
      });

      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].eventType).toBe(AuditEventType.DICOM_VIEW);
    });

    test('should filter logs by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockLogs: AuditEvent[] = [
        {
          eventId: '1',
          timestamp: yesterday.toISOString(),
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
        },
        {
          eventId: '2',
          timestamp: now.toISOString(),
          eventType: AuditEventType.LOGIN_SUCCESS,
          severity: AuditSeverity.MEDIUM,
          action: 'login',
          outcome: 'success',
        },
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);

      const filteredLogs = await auditLogger.getAuditLogs({
        dateRange: {
          startDate: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
          endDate: tomorrow,
        },
      });

      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].eventId).toBe('2');
    });
  });

  describe('Log Statistics', () => {
    test('should calculate statistics correctly', async () => {
      const mockLogs: AuditEvent[] = [
        {
          eventId: '1',
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
          userId: 'user1',
        },
        {
          eventId: '2',
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.LOGIN_FAILURE,
          severity: AuditSeverity.HIGH,
          action: 'login',
          outcome: 'failure',
          userId: 'user2',
        },
        {
          eventId: '3',
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.SECURITY_SCAN,
          severity: AuditSeverity.CRITICAL,
          action: 'scan',
          outcome: 'unknown',
          userId: 'user1',
        },
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);

      const stats = await auditLogger.getStatistics();

      expect(stats.totalEvents).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
      expect(stats.eventsByOutcome.success).toBe(1);
      expect(stats.eventsByOutcome.failure).toBe(1);
      expect(stats.eventsByOutcome.unknown).toBe(1);
      expect(stats.suspiciousActivities).toBe(1); // security.* events
    });
  });

  describe('Log Export Functionality', () => {
    test('should export logs as JSON', async () => {
      const mockLogs: AuditEvent[] = [
        {
          eventId: '1',
          timestamp: '2024-01-01T00:00:00.000Z',
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
        },
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);

      const exportedData = await auditLogger.exportLogs('json');
      const parsedData = JSON.parse(exportedData);

      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData).toHaveLength(1);
      expect(parsedData[0].eventId).toBe('1');
    });

    test('should export logs as CSV', async () => {
      const mockLogs: AuditEvent[] = [
        {
          eventId: '1',
          timestamp: '2024-01-01T00:00:00.000Z',
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
          userId: 'test-user',
          username: 'testuser',
          sessionId: 'session-123',
          resource: 'study/123',
          patientId: 'patient-456',
          studyId: 'study-789',
        },
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);

      const csvData = await auditLogger.exportLogs('csv');
      const lines = csvData.split('\n');

      expect(lines[0]).toContain('eventId,timestamp,eventType'); // Header
      expect(lines[1]).toContain('1,2024-01-01T00:00:00.000Z'); // Data
    });
  });

  describe('Log Integrity Verification', () => {
    test('should verify log integrity successfully', async () => {
      const mockLogs: AuditEvent[] = [
        {
          eventId: 'audit-1000-abc',
          timestamp: '2024-01-01T00:00:00.000Z',
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
        },
        {
          eventId: 'audit-1001-def',
          timestamp: '2024-01-01T00:01:00.000Z',
          eventType: AuditEventType.LOGIN_SUCCESS,
          severity: AuditSeverity.MEDIUM,
          action: 'login',
          outcome: 'success',
        },
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);
      jest.spyOn(auditLogger as any, 'validateLogEntry').mockReturnValue(true);

      const result = await auditLogger.verifyLogIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.corruptedEntries).toBe(0);
      expect(result.missingEntries).toBe(0);
    });

    test('should detect corrupted log entries', async () => {
      const mockLogs: AuditEvent[] = [
        {
          eventId: 'audit-1000-abc',
          timestamp: '2024-01-01T00:00:00.000Z',
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
        },
        {
          eventId: '', // Invalid entry
          timestamp: '',
          eventType: AuditEventType.LOGIN_SUCCESS,
          severity: AuditSeverity.MEDIUM,
          action: '',
          outcome: 'success',
        } as AuditEvent,
      ];

      jest.spyOn(auditLogger as any, 'getStoredLogs').mockResolvedValue(mockLogs);

      const result = await auditLogger.verifyLogIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.corruptedEntries).toBe(1);
      expect(result.details).toContain('Corrupted entry: ');
    });
  });

  describe('Log Rotation System', () => {
    test('should determine rotation based on size threshold', async () => {
      const config: Partial<LogRotationConfig> = {
        enabled: true,
        sizeThreshold: 1, // 1MB
        timeThreshold: 24,
      };

      const rotationManager = new (auditLogRotation.constructor as any)(config);
      
      const shouldRotate = await rotationManager.shouldRotate(2 * 1024 * 1024); // 2MB
      expect(shouldRotate).toBe(true);

      const shouldNotRotate = await rotationManager.shouldRotate(0.5 * 1024 * 1024); // 0.5MB
      expect(shouldNotRotate).toBe(false);
    });

    test('should create archive metadata correctly', async () => {
      const mockLogs: AuditEvent[] = [
        {
          eventId: '1',
          timestamp: '2024-01-01T00:00:00.000Z',
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
        },
      ];

      // Mock the necessary methods
      jest.spyOn(auditLogRotation as any, 'compressData').mockResolvedValue('compressed-data');
      jest.spyOn(auditLogRotation as any, 'calculateChecksum').mockResolvedValue('test-checksum');

      const result = await auditLogRotation.rotateLogs(mockLogs);

      expect(result.success).toBe(true);
      expect(result.archiveId).toBeDefined();
      expect(result.archiveId).toMatch(/^archive-\d+-[a-z0-9]+$/);
    });

    test('should retrieve archived logs correctly', async () => {
      const mockArchiveData = {
        logs: [
          {
            eventId: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            eventType: AuditEventType.DICOM_VIEW,
            severity: AuditSeverity.LOW,
            action: 'view',
            outcome: 'success',
          },
        ],
        metadata: {
          version: '1.0',
          createdAt: '2024-01-01T00:00:00.000Z',
          eventCount: 1,
        },
      };

      // Mock decryption and decompression
      jest.spyOn(auditLogRotation as any, 'decompressData').mockResolvedValue(JSON.stringify(mockArchiveData));

      const result = await auditLogRotation.retrieveArchive('test-archive-id');

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(1);
      expect(result.logs?.[0].eventId).toBe('1');
    });
  });

  describe('Real-time Monitoring System', () => {
    test('should process new events and update metrics', () => {
      const mockEvent: AuditEvent = {
        eventId: '1',
        timestamp: new Date().toISOString(),
        eventType: AuditEventType.LOGIN_FAILURE,
        severity: AuditSeverity.HIGH,
        action: 'login',
        outcome: 'failure',
        userId: 'test-user',
      };

      auditLogMonitoring.processNewEvent(mockEvent);

      const metrics = auditLogMonitoring.getCurrentMetrics();
      expect(metrics.failedLoginAttempts).toBe(1);
      expect(metrics.suspiciousActivities).toBe(1);
    });

    test('should create alerts for threshold violations', () => {
      const alertSpy = jest.spyOn(auditLogMonitoring as any, 'createAlert');

      // Configure low threshold for testing
      (auditLogMonitoring as any).config.alertThresholds.failedLoginAttempts = 2;

      // Process events to exceed threshold
      for (let i = 0; i < 3; i++) {
        auditLogMonitoring.processNewEvent({
          eventId: `${i}`,
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.LOGIN_FAILURE,
          severity: AuditSeverity.HIGH,
          action: 'login',
          outcome: 'failure',
        });
      }

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'threshold_exceeded',
          title: 'Failed Login Threshold Exceeded',
        })
      );
    });

    test('should detect anomalies in access patterns', () => {
      const alertSpy = jest.spyOn(auditLogMonitoring as any, 'createAlert');

      const lateNightEvent: AuditEvent = {
        eventId: '1',
        timestamp: new Date('2024-01-01T02:00:00.000Z').toISOString(), // 2 AM
        eventType: AuditEventType.PHI_EXPORT,
        severity: AuditSeverity.MEDIUM,
        action: 'export',
        outcome: 'success',
        resource: 'patient-data',
      };

      auditLogMonitoring.processNewEvent(lateNightEvent);

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: 'anomaly_detected',
          title: 'Unusual Access Pattern Detected',
        })
      );
    });

    test('should acknowledge alerts correctly', () => {
      // Create a mock alert
      const alert = {
        id: 'test-alert-id',
        timestamp: new Date().toISOString(),
        alertType: 'threshold_exceeded' as const,
        severity: AuditSeverity.HIGH,
        title: 'Test Alert',
        description: 'Test alert description',
        affectedResources: ['test'],
        metrics: {},
        recommendations: [],
        acknowledged: false,
      };

      (auditLogMonitoring as any).alertHistory = [alert];

      const result = auditLogMonitoring.acknowledgeAlert('test-alert-id', 'admin-user');

      expect(result).toBe(true);
      expect(alert.acknowledged).toBe(true);
      expect(alert.acknowledgedBy).toBe('admin-user');
      expect(alert.acknowledgedAt).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should integrate audit logger with monitoring and rotation', async () => {
      // Enable monitoring
      auditLogMonitoring.start();

      // Mock rotation configuration
      const mockRotationConfig = {
        enabled: true,
        sizeThreshold: 0.001, // Very small threshold for testing
        timeThreshold: 24,
      };

      // Log an event
      await auditLogger.logEvent(
        AuditEventType.DICOM_VIEW,
        'view_study',
        'success',
        {
          severity: AuditSeverity.MEDIUM,
          userId: 'test-user',
          studyId: 'study-123',
        }
      );

      // Force flush to trigger integration
      await (auditLogger as any).flushBuffer();

      // Verify monitoring received the event
      const metrics = auditLogMonitoring.getCurrentMetrics();
      expect(metrics.eventsPerHour).toBeGreaterThan(0);

      // Cleanup
      auditLogMonitoring.stop();
    });

    test('should handle errors gracefully across all components', async () => {
      // Mock error conditions
      jest.spyOn(auditLogger as any, 'storeLogsSecurely').mockRejectedValue(new Error('Storage error'));

      await auditLogger.logEvent(AuditEventType.DICOM_VIEW, 'view', 'success');

      // Should not throw, should handle error gracefully
      await expect((auditLogger as any).flushBuffer()).resolves.not.toThrow();

      // Buffer should retain events on failure
      expect((auditLogger as any).logBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-volume logging efficiently', async () => {
      const startTime = Date.now();
      const eventCount = 1000;

      // Log many events
      const promises = Array.from({ length: eventCount }, (_, i) =>
        auditLogger.logEvent(
          AuditEventType.DICOM_VIEW,
          `view_${i}`,
          'success',
          { userId: `user_${i % 10}` }
        )
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds for 1000 events)
      expect(duration).toBeLessThan(5000);
      expect((auditLogger as any).logBuffer).toHaveLength(eventCount);
    });

    test('should efficiently process monitoring metrics', () => {
      const startTime = Date.now();
      const eventCount = 1000;

      // Process many events through monitoring
      for (let i = 0; i < eventCount; i++) {
        auditLogMonitoring.processNewEvent({
          eventId: `${i}`,
          timestamp: new Date().toISOString(),
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success',
          userId: `user_${i % 10}`,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 1 second for 1000 events)
      expect(duration).toBeLessThan(1000);

      const metrics = auditLogMonitoring.getCurrentMetrics();
      expect(metrics.eventsPerHour).toBeGreaterThan(0);
    });
  });
});