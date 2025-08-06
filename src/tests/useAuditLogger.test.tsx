/**
 * useAuditLogger Hook Tests
 * Tests the React hook integration for audit logging
 */

import { renderHook, act } from '@testing-library/react';
import { useAuditLogger } from '../hooks/useAuditLogger';
import { AuditEventType, AuditSeverity } from '../security/AuditLogger';

// Mock dependencies
jest.mock('../security/AuditLogger');
jest.mock('../utils/logger');

describe('useAuditLogger Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Hook Functionality', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useAuditLogger());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.logEvent).toBe('function');
      expect(typeof result.current.logDicomAccess).toBe('function');
      expect(typeof result.current.logAnnotationAction).toBe('function');
      expect(typeof result.current.logSecurityEvent).toBe('function');
      expect(typeof result.current.logAuthEvent).toBe('function');
    });

    test('should provide all expected functions', () => {
      const { result } = renderHook(() => useAuditLogger());

      const expectedFunctions = [
        'logEvent',
        'logDicomAccess',
        'logAnnotationAction',
        'logSecurityEvent',
        'logAuthEvent',
        'getLogs',
        'getStatistics',
        'exportLogs',
        'verifyIntegrity',
      ];

      expectedFunctions.forEach(funcName => {
        expect(typeof result.current[funcName as keyof typeof result.current]).toBe('function');
      });
    });
  });

  describe('Logging Functions', () => {
    test('should call logEvent with correct parameters', async () => {
      const { result } = renderHook(() => useAuditLogger());

      await act(async () => {
        await result.current.logEvent(
          AuditEventType.DICOM_VIEW,
          'view_study',
          'success',
          {
            severity: AuditSeverity.MEDIUM,
            userId: 'test-user',
            studyId: 'study-123',
          }
        );
      });

      // Mock should have been called
      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.DICOM_VIEW,
        'view_study',
        'success',
        {
          severity: AuditSeverity.MEDIUM,
          userId: 'test-user',
          studyId: 'study-123',
        }
      );
    });

    test('should handle logEvent errors gracefully', async () => {
      const mockError = new Error('Logging failed');
      require('../security/AuditLogger').auditLogger.logEvent.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuditLogger());

      await act(async () => {
        await result.current.logEvent(AuditEventType.DICOM_VIEW, 'view', 'success');
      });

      expect(result.current.error).toBe('Logging failed');
    });
  });

  describe('Convenience Logging Functions', () => {
    test('should log DICOM access correctly', async () => {
      const { result } = renderHook(() => useAuditLogger());

      await act(async () => {
        await result.current.logDicomAccess('study-123', 'patient-456');
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.DICOM_VIEW,
        'view_dicom_study',
        'success',
        expect.objectContaining({
          severity: AuditSeverity.MEDIUM,
          resource: 'study/study-123',
          studyId: 'study-123',
          patientId: 'patient-456',
          customDetails: expect.objectContaining({
            viewType: 'web_viewer',
          }),
        })
      );
    });

    test('should log annotation actions with correct event types', async () => {
      const { result } = renderHook(() => useAuditLogger());

      // Test create action
      await act(async () => {
        await result.current.logAnnotationAction('create', 'annotation-123');
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.ANNOTATION_CREATE,
        'create',
        'success',
        expect.objectContaining({
          severity: AuditSeverity.LOW,
          resource: 'annotation/annotation-123',
          customDetails: expect.objectContaining({
            annotationId: 'annotation-123',
            annotationType: 'medical_annotation',
          }),
        })
      );

      // Test modify action
      await act(async () => {
        await result.current.logAnnotationAction('modify', 'annotation-456');
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.ANNOTATION_MODIFY,
        'modify',
        'success',
        expect.objectContaining({
          resource: 'annotation/annotation-456',
        })
      );

      // Test delete action
      await act(async () => {
        await result.current.logAnnotationAction('delete', 'annotation-789');
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.ANNOTATION_DELETE,
        'delete',
        'success',
        expect.objectContaining({
          resource: 'annotation/annotation-789',
        })
      );
    });

    test('should log security events with appropriate severity', async () => {
      const { result } = renderHook(() => useAuditLogger());

      await act(async () => {
        await result.current.logSecurityEvent(
          AuditEventType.UNAUTHORIZED_ACCESS,
          'Attempted access to restricted resource',
          AuditSeverity.CRITICAL
        );
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.UNAUTHORIZED_ACCESS,
        'security_event',
        'unknown',
        expect.objectContaining({
          severity: AuditSeverity.CRITICAL,
          customDetails: expect.objectContaining({
            securityDetails: 'Attempted access to restricted resource',
          }),
        })
      );
    });

    test('should log authentication events with outcome-based severity', async () => {
      const { result } = renderHook(() => useAuditLogger());

      // Test successful login
      await act(async () => {
        await result.current.logAuthEvent(
          AuditEventType.LOGIN_SUCCESS,
          'testuser',
          'success'
        );
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.LOGIN_SUCCESS,
        'authentication',
        'success',
        expect.objectContaining({
          severity: AuditSeverity.MEDIUM,
          username: 'testuser',
          resource: 'authentication_system',
        })
      );

      // Test failed login (should have higher severity)
      await act(async () => {
        await result.current.logAuthEvent(
          AuditEventType.LOGIN_FAILURE,
          'testuser',
          'failure'
        );
      });

      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.LOGIN_FAILURE,
        'authentication',
        'failure',
        expect.objectContaining({
          severity: AuditSeverity.HIGH,
          username: 'testuser',
        })
      );
    });
  });

  describe('Data Retrieval Functions', () => {
    test('should get logs with loading state management', async () => {
      const mockLogs = [
        {
          eventId: '1',
          timestamp: '2024-01-01T00:00:00.000Z',
          eventType: AuditEventType.DICOM_VIEW,
          severity: AuditSeverity.LOW,
          action: 'view',
          outcome: 'success' as const,
        },
      ];

      require('../security/AuditLogger').auditLogger.getAuditLogs.mockResolvedValue(mockLogs);

      const { result } = renderHook(() => useAuditLogger());

      let logs: any[] = [];
      await act(async () => {
        logs = await result.current.getLogs();
      });

      expect(logs).toEqual(mockLogs);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    test('should handle getLogs errors', async () => {
      const mockError = new Error('Failed to retrieve logs');
      require('../security/AuditLogger').auditLogger.getAuditLogs.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuditLogger());

      let logs: any[] = [];
      await act(async () => {
        logs = await result.current.getLogs();
      });

      expect(logs).toEqual([]);
      expect(result.current.error).toBe('Failed to retrieve logs');
      expect(result.current.isLoading).toBe(false);
    });

    test('should get statistics with error handling', async () => {
      const mockStats = {
        totalEvents: 100,
        eventsByType: {},
        eventsBySeverity: {},
        eventsByOutcome: { success: 80, failure: 15, unknown: 5 },
        uniqueUsers: 25,
        suspiciousActivities: 3,
        complianceViolations: 1,
        averageEventsPerDay: 10,
        peakActivityHours: [9, 14, 16],
      };

      require('../security/AuditLogger').auditLogger.getStatistics.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useAuditLogger());

      let stats: any;
      await act(async () => {
        stats = await result.current.getStatistics();
      });

      expect(stats).toEqual(mockStats);
      expect(result.current.error).toBe(null);
    });

    test('should export logs and log the export action', async () => {
      const mockExportData = JSON.stringify([{ eventId: '1', action: 'test' }]);
      require('../security/AuditLogger').auditLogger.exportLogs.mockResolvedValue(mockExportData);

      const { result } = renderHook(() => useAuditLogger());

      let exportedData: string = '';
      await act(async () => {
        exportedData = await result.current.exportLogs('json', {
          eventTypes: [AuditEventType.DICOM_VIEW],
        });
      });

      expect(exportedData).toBe(mockExportData);

      // Should also log the export action
      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.AUDIT_LOG_ACCESS,
        'export_logs',
        'success',
        expect.objectContaining({
          severity: AuditSeverity.MEDIUM,
          resource: 'audit_logs',
          customDetails: expect.objectContaining({
            exportFormat: 'json',
            filterApplied: true,
          }),
        })
      );
    });

    test('should handle export errors and log failed attempts', async () => {
      const mockError = new Error('Export failed');
      require('../security/AuditLogger').auditLogger.exportLogs.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuditLogger());

      await act(async () => {
        await expect(result.current.exportLogs('csv')).rejects.toThrow('Export failed');
      });

      expect(result.current.error).toBe('Export failed');

      // Should log the failed export
      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.AUDIT_LOG_ACCESS,
        'export_logs',
        'failure',
        expect.objectContaining({
          customDetails: expect.objectContaining({
            exportFormat: 'csv',
            error: 'Export failed',
          }),
        })
      );
    });
  });

  describe('Integrity Verification', () => {
    test('should verify integrity and log the check', async () => {
      const mockResult = {
        isValid: true,
        corruptedEntries: 0,
        missingEntries: 0,
        details: [],
      };

      require('../security/AuditLogger').auditLogger.verifyLogIntegrity.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAuditLogger());

      let integrityResult: any;
      await act(async () => {
        integrityResult = await result.current.verifyIntegrity();
      });

      expect(integrityResult).toEqual(mockResult);

      // Should log the integrity check
      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.AUDIT_LOG_ACCESS,
        'verify_integrity',
        'success',
        expect.objectContaining({
          severity: AuditSeverity.LOW,
          resource: 'audit_logs',
          customDetails: expect.objectContaining({
            corruptedEntries: 0,
            missingEntries: 0,
            integrityValid: true,
          }),
        })
      );
    });

    test('should handle integrity check failures', async () => {
      const mockResult = {
        isValid: false,
        corruptedEntries: 2,
        missingEntries: 1,
        details: ['Corrupted entry: audit-123', 'Missing entry: audit-124'],
      };

      require('../security/AuditLogger').auditLogger.verifyLogIntegrity.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAuditLogger());

      let integrityResult: any;
      await act(async () => {
        integrityResult = await result.current.verifyIntegrity();
      });

      expect(integrityResult).toEqual(mockResult);

      // Should log as failure with high severity
      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledWith(
        AuditEventType.AUDIT_LOG_ACCESS,
        'verify_integrity',
        'failure',
        expect.objectContaining({
          severity: AuditSeverity.HIGH,
          customDetails: expect.objectContaining({
            corruptedEntries: 2,
            missingEntries: 1,
            integrityValid: false,
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle various error types correctly', async () => {
      const { result } = renderHook(() => useAuditLogger());

      // Test string error
      require('../security/AuditLogger').auditLogger.logEvent.mockRejectedValue('String error');

      await act(async () => {
        await result.current.logEvent(AuditEventType.DICOM_VIEW, 'view', 'success');
      });

      expect(result.current.error).toBe('Failed to log audit event');

      // Reset and test Error object
      require('../security/AuditLogger').auditLogger.logEvent.mockRejectedValue(new Error('Real error'));

      await act(async () => {
        await result.current.logEvent(AuditEventType.LOGIN_SUCCESS, 'login', 'success');
      });

      expect(result.current.error).toBe('Real error');
    });

    test('should clear errors on successful operations', async () => {
      const { result } = renderHook(() => useAuditLogger());

      // First, cause an error
      require('../security/AuditLogger').auditLogger.logEvent.mockRejectedValueOnce(new Error('Test error'));

      await act(async () => {
        await result.current.logEvent(AuditEventType.DICOM_VIEW, 'view', 'success');
      });

      expect(result.current.error).toBe('Test error');

      // Then, succeed
      require('../security/AuditLogger').auditLogger.logEvent.mockResolvedValueOnce(undefined);

      await act(async () => {
        await result.current.logEvent(AuditEventType.DICOM_VIEW, 'view', 'success');
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Performance and Memory', () => {
    test('should maintain stable references for functions', () => {
      const { result, rerender } = renderHook(() => useAuditLogger());

      const initialFunctions = {
        logEvent: result.current.logEvent,
        logDicomAccess: result.current.logDicomAccess,
        logAnnotationAction: result.current.logAnnotationAction,
        getLogs: result.current.getLogs,
      };

      // Rerender the hook
      rerender();

      // Functions should maintain the same references (useCallback working)
      expect(result.current.logEvent).toBe(initialFunctions.logEvent);
      expect(result.current.logDicomAccess).toBe(initialFunctions.logDicomAccess);
      expect(result.current.logAnnotationAction).toBe(initialFunctions.logAnnotationAction);
      expect(result.current.getLogs).toBe(initialFunctions.getLogs);
    });

    test('should handle rapid successive calls', async () => {
      const { result } = renderHook(() => useAuditLogger());

      const promises = Array.from({ length: 10 }, (_, i) =>
        result.current.logEvent(
          AuditEventType.DICOM_VIEW,
          `view_${i}`,
          'success'
        )
      );

      await act(async () => {
        await Promise.all(promises);
      });

      // All calls should have been made
      expect(require('../security/AuditLogger').auditLogger.logEvent).toHaveBeenCalledTimes(10);
      expect(result.current.error).toBe(null);
    });
  });
});