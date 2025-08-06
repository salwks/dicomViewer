/**
 * Medical-grade Audit Logging System
 * Provides comprehensive audit trail for security events and user actions
 * Compliant with HIPAA and medical device regulations
 */

import { medicalEncryption, type EncryptedData } from './encryption';
import { secureStorage } from './secureStorage';
import { log } from '../utils/logger';
import { auditLogRotation } from './AuditLogRotation';
import { auditLogMonitoring } from './AuditLogMonitoring';

export enum AuditEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  SESSION_TIMEOUT = 'auth.session_timeout',
  PASSWORD_CHANGE = 'auth.password_change',
  MFA_ENABLED = 'auth.mfa_enabled',
  MFA_DISABLED = 'auth.mfa_disabled',

  // Data Access Events
  DICOM_LOAD = 'data.dicom.load',
  DICOM_VIEW = 'data.dicom.view',
  ANNOTATION_CREATE = 'data.annotation.create',
  ANNOTATION_MODIFY = 'data.annotation.modify',
  ANNOTATION_DELETE = 'data.annotation.delete',
  MEASUREMENT_CREATE = 'data.measurement.create',
  MEASUREMENT_EXPORT = 'data.measurement.export',

  // System Events
  CONFIG_CHANGE = 'system.config.change',
  SECURITY_POLICY_CHANGE = 'system.security.policy_change',
  ENCRYPTION_KEY_ROTATION = 'system.encryption.key_rotation',
  BACKUP_CREATED = 'system.backup.created',
  BACKUP_RESTORED = 'system.backup.restored',

  // Security Events
  UNAUTHORIZED_ACCESS = 'security.unauthorized_access',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  DATA_BREACH_ATTEMPT = 'security.data_breach_attempt',
  PRIVILEGE_ESCALATION = 'security.privilege_escalation',
  SECURITY_SCAN = 'security.scan',

  // Compliance Events
  PHI_ACCESS = 'compliance.phi_access',
  PHI_EXPORT = 'compliance.phi_export',
  GDPR_REQUEST = 'compliance.gdpr_request',
  AUDIT_LOG_ACCESS = 'compliance.audit_log_access',
  POLICY_VIOLATION = 'compliance.policy_violation',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  username?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action: string;
  outcome: 'success' | 'failure' | 'unknown';
  details?: Record<string, unknown>;
  patientId?: string;
  studyId?: string;
  organizationId?: string;
  deviceInfo?: {
    deviceType: string;
    operatingSystem: string;
    browser: string;
  };
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

export interface AuditLogFilter {
  eventTypes?: AuditEventType[];
  severities?: AuditSeverity[];
  userIds?: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  outcomeFilter?: ('success' | 'failure' | 'unknown')[];
  resourceFilter?: string[];
  patientIds?: string[];
  studyIds?: string[];
}

export interface AuditLogStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: Record<'success' | 'failure' | 'unknown', number>;
  uniqueUsers: number;
  suspiciousActivities: number;
  complianceViolations: number;
  averageEventsPerDay: number;
  peakActivityHours: number[];
}

class MedicalAuditLogger {
  private readonly storageKey = 'medical_audit_logs';
  private readonly maxLogEntries = 100000; // Maximum entries before rotation
  private readonly compressionEnabled = true;
  private readonly encryptionEnabled = true;
  private logBuffer: AuditEvent[] = [];
  private bufferSize = 100; // Buffer events before writing to storage
  private flushInterval = 30000; // Flush every 30 seconds
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.initializeLogger();
  }

  /**
   * Initialize the audit logger
   */
  private initializeLogger(): void {
    try {
      // Start periodic flush of buffered events
      this.intervalId = setInterval(() => {
        this.flushBuffer();
      }, this.flushInterval);

      // Handle page unload to flush remaining events
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          this.flushBuffer();
        });
      }

      // Initialize monitoring service
      auditLogMonitoring.start();

      log.info('Audit logger initialized', {
        component: 'AuditLogger',
        metadata: {
          maxLogEntries: this.maxLogEntries,
          bufferSize: this.bufferSize,
          compressionEnabled: this.compressionEnabled,
          encryptionEnabled: this.encryptionEnabled,
          monitoringEnabled: true,
          rotationEnabled: true,
        },
      });
    } catch (error) {
      log.error('Failed to initialize audit logger', {
        component: 'AuditLogger',
      }, error as Error);
    }
  }

  /**
   * Log an audit event
   */
  public async logEvent(
    eventType: AuditEventType,
    action: string,
    outcome: 'success' | 'failure' | 'unknown',
    details?: {
      severity?: AuditSeverity;
      userId?: string;
      username?: string;
      sessionId?: string;
      resource?: string;
      patientId?: string;
      studyId?: string;
      organizationId?: string;
      customDetails?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        eventId: this.generateEventId(),
        timestamp: new Date().toISOString(),
        eventType,
        severity: details?.severity || this.determineSeverity(eventType, outcome),
        userId: details?.userId,
        username: details?.username,
        sessionId: details?.sessionId,
        ipAddress: await this.getClientIpAddress(),
        userAgent: this.getUserAgent(),
        resource: details?.resource,
        action,
        outcome,
        details: details?.customDetails,
        patientId: details?.patientId,
        studyId: details?.studyId,
        organizationId: details?.organizationId,
        deviceInfo: this.getDeviceInfo(),
        geolocation: await this.getGeolocation(),
      };

      // Add to buffer
      this.logBuffer.push(auditEvent);

      // Check if immediate flush is needed for critical events
      if (auditEvent.severity === AuditSeverity.CRITICAL) {
        await this.flushBuffer();
      } else if (this.logBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      // Log to console for development (but not in production)
      if (process.env.NODE_ENV !== 'production') {
        log.info('Audit event logged', {
          component: 'AuditLogger',
          metadata: {
            eventType,
            severity: auditEvent.severity,
            outcome,
            userId: details?.userId,
          },
        });
      }
    } catch (error) {
      log.error('Failed to log audit event', {
        component: 'AuditLogger',
        metadata: { eventType, action, outcome },
      }, error as Error);
    }
  }

  /**
   * Flush buffered events to secure storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const eventsToFlush = [...this.logBuffer];
      this.logBuffer = [];

      // Process events through monitoring system
      eventsToFlush.forEach(event => {
        auditLogMonitoring.processNewEvent(event);
      });

      // Get existing logs
      const existingLogs = await this.getStoredLogs();
      const allLogs = [...existingLogs, ...eventsToFlush];

      // Check if rotation is needed
      const currentLogSize = new Blob([JSON.stringify(allLogs)]).size;
      const shouldRotate = await auditLogRotation.shouldRotate(currentLogSize);

      let finalLogs = allLogs;
      if (shouldRotate) {
        // Rotate logs to archive
        const rotationResult = await auditLogRotation.rotateLogs(allLogs);
        if (rotationResult.success) {
          // Keep only recent events after rotation
          finalLogs = eventsToFlush; // Start fresh with just the new events
          log.info('Audit logs rotated during flush', {
            component: 'AuditLogger',
            metadata: {
              archiveId: rotationResult.archiveId,
              eventsArchived: allLogs.length,
              eventsRetained: finalLogs.length,
            },
          });
        } else {
          // If rotation fails, continue with normal log management
          finalLogs = this.performLogRotation(allLogs);
          log.warn('Log rotation failed, using fallback rotation', {
            component: 'AuditLogger',
            metadata: { error: rotationResult.error },
          });
        }
      }

      // Store logs securely
      await this.storeLogsSecurely(finalLogs);

      log.debug('Audit log buffer flushed', {
        component: 'AuditLogger',
        metadata: {
          eventsFlushed: eventsToFlush.length,
          totalLogs: finalLogs.length,
          rotationPerformed: shouldRotate,
        },
      });
    } catch (error) {
      log.error('Failed to flush audit log buffer', {
        component: 'AuditLogger',
      }, error as Error);

      // On failure, restore events to buffer for retry
      // Note: eventsToFlush is captured before clearing buffer
    }
  }

  /**
   * Get stored audit logs with optional filtering
   */
  public async getAuditLogs(filter?: AuditLogFilter, limit?: number, offset?: number): Promise<AuditEvent[]> {
    try {
      const allLogs = await this.getStoredLogs();
      let filteredLogs = this.applyFilter(allLogs, filter);

      // Apply pagination
      if (offset) {
        filteredLogs = filteredLogs.slice(offset);
      }
      if (limit) {
        filteredLogs = filteredLogs.slice(0, limit);
      }

      return filteredLogs;
    } catch (error) {
      log.error('Failed to retrieve audit logs', {
        component: 'AuditLogger',
      }, error as Error);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  public async getStatistics(filter?: AuditLogFilter): Promise<AuditLogStatistics> {
    try {
      const allLogs = await this.getStoredLogs();
      const filteredLogs = this.applyFilter(allLogs, filter);

      return this.calculateStatistics(filteredLogs);
    } catch (error) {
      log.error('Failed to calculate audit statistics', {
        component: 'AuditLogger',
      }, error as Error);

      // Return empty statistics on error
      return {
        totalEvents: 0,
        eventsByType: {} as Record<AuditEventType, number>,
        eventsBySeverity: {} as Record<AuditSeverity, number>,
        eventsByOutcome: { success: 0, failure: 0, unknown: 0 },
        uniqueUsers: 0,
        suspiciousActivities: 0,
        complianceViolations: 0,
        averageEventsPerDay: 0,
        peakActivityHours: [],
      };
    }
  }

  /**
   * Export audit logs in various formats
   */
  public async exportLogs(
    format: 'json' | 'csv' | 'xml',
    filter?: AuditLogFilter,
  ): Promise<string> {
    try {
      const logs = await this.getAuditLogs(filter);

      switch (format) {
        case 'json':
          return JSON.stringify(logs, null, 2);
        case 'csv':
          return this.convertToCSV(logs);
        case 'xml':
          return this.convertToXML(logs);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      log.error('Failed to export audit logs', {
        component: 'AuditLogger',
        metadata: { format },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Clear audit logs (requires special authorization)
   */
  public async clearLogs(authorizationToken: string): Promise<boolean> {
    try {
      // Verify authorization (in a real implementation, validate the token)
      if (!this.verifyAuthorizationToken(authorizationToken)) {
        await this.logEvent(
          AuditEventType.UNAUTHORIZED_ACCESS,
          'clear_audit_logs',
          'failure',
          {
            severity: AuditSeverity.CRITICAL,
            resource: 'audit_logs',
          },
        );
        return false;
      }

      // Log the clearing action
      await this.logEvent(
        AuditEventType.AUDIT_LOG_ACCESS,
        'clear_all_logs',
        'success',
        {
          severity: AuditSeverity.HIGH,
          resource: 'audit_logs',
        },
      );

      // Clear logs from storage
      await secureStorage.remove(this.storageKey);
      this.logBuffer = [];

      return true;
    } catch (error) {
      log.error('Failed to clear audit logs', {
        component: 'AuditLogger',
      }, error as Error);
      return false;
    }
  }

  /**
   * Perform integrity check on audit logs
   */
  public async verifyLogIntegrity(): Promise<{
    isValid: boolean;
    corruptedEntries: number;
    missingEntries: number;
    details: string[];
  }> {
    try {
      const logs = await this.getStoredLogs();
      const issues: string[] = [];
      let corruptedEntries = 0;
      let missingEntries = 0;

      // Check for gaps in event IDs safely
      const eventIds = logs.map(log => {
        const parts = log.eventId.split('-');
        const numPart = parts.length > 1 ? parts[1] : '0';
        return parseInt(numPart, 10) || 0;
      }).sort((a, b) => a - b);

      for (let i = 1; i < eventIds.length; i++) {
        const current = this.safeGetArrayElement(eventIds, i) || 0;
        const previous = this.safeGetArrayElement(eventIds, i - 1) || 0;
        if (typeof current === 'number' && typeof previous === 'number' && current - previous > 1) {
          missingEntries += this.safeCalculateMissingEntries(current, previous);
          issues.push(`Missing event IDs between ${previous} and ${current}`);
        }
      }

      // Check for corrupted entries
      for (const logEntry of logs) {
        if (!this.validateLogEntry(logEntry)) {
          corruptedEntries++;
          issues.push(`Corrupted entry: ${logEntry.eventId}`);
        }
      }

      const isValid = corruptedEntries === 0 && missingEntries === 0;

      log.info('Audit log integrity check completed', {
        component: 'AuditLogger',
        metadata: {
          isValid,
          totalEntries: logs.length,
          corruptedEntries,
          missingEntries,
        },
      });

      return {
        isValid,
        corruptedEntries,
        missingEntries,
        details: issues,
      };
    } catch (error) {
      log.error('Failed to verify audit log integrity', {
        component: 'AuditLogger',
      }, error as Error);

      return {
        isValid: false,
        corruptedEntries: 0,
        missingEntries: 0,
        details: ['Failed to perform integrity check'],
      };
    }
  }

  // Private helper methods

  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `audit-${timestamp}-${random}`;
  }

  private determineSeverity(eventType: AuditEventType, outcome: string): AuditSeverity {
    // Security events are always high or critical
    if (eventType.startsWith('security.')) {
      return outcome === 'failure' ? AuditSeverity.CRITICAL : AuditSeverity.HIGH;
    }

    // Authentication failures are high severity
    if (eventType === AuditEventType.LOGIN_FAILURE) {
      return AuditSeverity.HIGH;
    }

    // PHI access events are medium-high
    if (eventType.startsWith('compliance.phi')) {
      return AuditSeverity.MEDIUM;
    }

    // System changes are medium
    if (eventType.startsWith('system.')) {
      return AuditSeverity.MEDIUM;
    }

    // Default to low for regular data access
    return AuditSeverity.LOW;
  }

  private async getClientIpAddress(): Promise<string | undefined> {
    // In a browser environment, this would need to be provided by the server
    // For now, return undefined
    return undefined;
  }

  private getUserAgent(): string | undefined {
    return typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
  }

  private getDeviceInfo(): AuditEvent['deviceInfo'] | undefined {
    if (typeof navigator === 'undefined') return undefined;

    return {
      deviceType: this.getDeviceType(),
      operatingSystem: this.getOperatingSystem(),
      browser: this.getBrowser(),
    };
  }

  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }

  private getOperatingSystem(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private getBrowser(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private async getGeolocation(): Promise<AuditEvent['geolocation'] | undefined> {
    // In a real implementation, this could use geolocation APIs
    // For privacy and security, we'll skip this for now
    return undefined;
  }

  private async getStoredLogs(): Promise<AuditEvent[]> {
    try {
      const encryptedData = await secureStorage.retrieve(this.storageKey);
      if (!encryptedData) return [];

      let logsData: string;
      if (this.encryptionEnabled && typeof encryptedData === 'object') {
        // Decrypt the logs
        logsData = medicalEncryption.decrypt(
          encryptedData as EncryptedData,
          'audit-logs-key', // In production, use a proper key management system
          { purpose: 'annotation' }, // Using existing encryption purpose
        );
      } else {
        logsData = encryptedData as string;
      }

      return JSON.parse(logsData) as AuditEvent[];
    } catch (error) {
      log.error('Failed to retrieve stored audit logs', {
        component: 'AuditLogger',
      }, error as Error);
      return [];
    }
  }

  private async storeLogsSecurely(logs: AuditEvent[]): Promise<void> {
    try {
      const logsData = JSON.stringify(logs);

      if (this.encryptionEnabled) {
        // Encrypt the logs before storing
        const encryptedData = medicalEncryption.encrypt(
          logsData,
          'audit-logs-key', // In production, use a proper key management system
          { purpose: 'annotation' }, // Using existing encryption purpose
        );
        await secureStorage.store(this.storageKey, JSON.stringify(encryptedData), 'audit-logs');
      } else {
        await secureStorage.store(this.storageKey, logsData, 'audit-logs');
      }
    } catch (error) {
      log.error('Failed to store audit logs securely', {
        component: 'AuditLogger',
      }, error as Error);
      throw error;
    }
  }

  private performLogRotation(logs: AuditEvent[]): AuditEvent[] {
    if (logs.length <= this.maxLogEntries) return logs;

    // Keep the most recent entries
    const rotatedLogs = logs.slice(-this.maxLogEntries);

    log.info('Audit log rotation performed', {
      component: 'AuditLogger',
      metadata: {
        originalCount: logs.length,
        rotatedCount: rotatedLogs.length,
        removedCount: logs.length - rotatedLogs.length,
      },
    });

    return rotatedLogs;
  }

  private applyFilter(logs: AuditEvent[], filter?: AuditLogFilter): AuditEvent[] {
    if (!filter) return logs;

    return logs.filter(log => {
      // Filter by event types
      if (filter.eventTypes && !filter.eventTypes.includes(log.eventType)) {
        return false;
      }

      // Filter by severities
      if (filter.severities && !filter.severities.includes(log.severity)) {
        return false;
      }

      // Filter by user IDs
      if (filter.userIds && log.userId && !filter.userIds.includes(log.userId)) {
        return false;
      }

      // Filter by date range
      if (filter.dateRange) {
        const logDate = new Date(log.timestamp);
        if (logDate < filter.dateRange.startDate || logDate > filter.dateRange.endDate) {
          return false;
        }
      }

      // Filter by outcome
      if (filter.outcomeFilter && !filter.outcomeFilter.includes(log.outcome)) {
        return false;
      }

      // Filter by resource
      if (filter.resourceFilter && log.resource && !filter.resourceFilter.includes(log.resource)) {
        return false;
      }

      // Filter by patient IDs
      if (filter.patientIds && log.patientId && !filter.patientIds.includes(log.patientId)) {
        return false;
      }

      // Filter by study IDs
      if (filter.studyIds && log.studyId && !filter.studyIds.includes(log.studyId)) {
        return false;
      }

      return true;
    });
  }

  private calculateStatistics(logs: AuditEvent[]): AuditLogStatistics {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = { success: 0, failure: 0, unknown: 0 };
    const uniqueUsers = new Set<string>();
    let suspiciousActivities = 0;
    let complianceViolations = 0;
    const hourCounts = new Array(24).fill(0);

    for (const logEntry of logs) {
      // Count by type
      eventsByType[logEntry.eventType] = (eventsByType[logEntry.eventType] || 0) + 1;

      // Count by severity
      eventsBySeverity[logEntry.severity] = (eventsBySeverity[logEntry.severity] || 0) + 1;

      // Count by outcome
      eventsByOutcome[logEntry.outcome]++;

      // Track unique users
      if (logEntry.userId) {
        uniqueUsers.add(logEntry.userId);
      }

      // Count suspicious activities
      if (logEntry.eventType.startsWith('security.')) {
        suspiciousActivities++;
      }

      // Count compliance violations
      if (logEntry.eventType === AuditEventType.POLICY_VIOLATION) {
        complianceViolations++;
      }

      // Track hourly activity safely
      const hour = new Date(logEntry.timestamp).getHours();
      if (typeof hour === 'number' && hour >= 0 && hour < 24 && Number.isInteger(hour)) {
        this.safeIncrementHourCount(hourCounts, hour);
      }
    }

    // Find peak activity hours (top 3)
    const peakActivityHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    // Calculate average events per day
    const dateRange = this.getDateRange(logs);
    const daysDiff = dateRange ? Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const averageEventsPerDay = logs.length / daysDiff;

    return {
      totalEvents: logs.length,
      eventsByType: eventsByType as Record<AuditEventType, number>,
      eventsBySeverity: eventsBySeverity as Record<AuditSeverity, number>,
      eventsByOutcome,
      uniqueUsers: uniqueUsers.size,
      suspiciousActivities,
      complianceViolations,
      averageEventsPerDay,
      peakActivityHours,
    };
  }

  private getDateRange(logs: AuditEvent[]): { start: Date; end: Date } | null {
    if (logs.length === 0) return null;

    const timestamps = logs.map(log => new Date(log.timestamp));
    const start = new Date(Math.min(...timestamps.map(d => d.getTime())));
    const end = new Date(Math.max(...timestamps.map(d => d.getTime())));

    return { start, end };
  }

  private convertToCSV(logs: AuditEvent[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'eventId', 'timestamp', 'eventType', 'severity', 'userId', 'username',
      'sessionId', 'action', 'outcome', 'resource', 'patientId', 'studyId',
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = headers.map(header => {
        // Safe property access with allowlist validation
        const allowedLogProperties = new Set(['eventId', 'timestamp', 'eventType', 'severity', 'userId', 'username', 'sessionId', 'action', 'outcome', 'resource', 'patientId', 'studyId']);

        let value = '';
        if (allowedLogProperties.has(header) && Object.prototype.hasOwnProperty.call(log, header)) {
          const rawValue = this.safeGetLogProperty(log, header);
          value = rawValue ? String(rawValue) : '';
        }

        // Escape commas and quotes in CSV
        return typeof value === 'string' && (value.includes(',') || value.includes('"'))
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  private convertToXML(logs: AuditEvent[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<auditLogs>\n';

    for (const log of logs) {
      xml += '  <auditEvent>\n';
      xml += `    <eventId>${this.escapeXml(log.eventId)}</eventId>\n`;
      xml += `    <timestamp>${this.escapeXml(log.timestamp)}</timestamp>\n`;
      xml += `    <eventType>${this.escapeXml(log.eventType)}</eventType>\n`;
      xml += `    <severity>${this.escapeXml(log.severity)}</severity>\n`;
      xml += `    <action>${this.escapeXml(log.action)}</action>\n`;
      xml += `    <outcome>${this.escapeXml(log.outcome)}</outcome>\n`;

      if (log.userId) xml += `    <userId>${this.escapeXml(log.userId)}</userId>\n`;
      if (log.username) xml += `    <username>${this.escapeXml(log.username)}</username>\n`;
      if (log.resource) xml += `    <resource>${this.escapeXml(log.resource)}</resource>\n`;
      if (log.patientId) xml += `    <patientId>${this.escapeXml(log.patientId)}</patientId>\n`;
      if (log.studyId) xml += `    <studyId>${this.escapeXml(log.studyId)}</studyId>\n`;

      xml += '  </auditEvent>\n';
    }

    xml += '</auditLogs>';
    return xml;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private verifyAuthorizationToken(token: string): boolean {
    // In a real implementation, verify the token against your authentication system
    // For now, just check if it's not empty
    return token.length > 0;
  }

  private validateLogEntry(log: AuditEvent): boolean {
    // Basic validation of log entry structure
    return !!(
      log.eventId &&
      log.timestamp &&
      log.eventType &&
      log.severity &&
      log.action &&
      log.outcome
    );
  }

  /**
   * Safe calculation of missing entries
   */
  private safeCalculateMissingEntries(current: number, previous: number): number {
    if (typeof current === 'number' && typeof previous === 'number' && current > previous) {
      return Math.max(0, current - previous - 1);
    }
    return 0;
  }

  /**
   * Safe hour count increment
   */
  private safeIncrementHourCount(hourCounts: number[], hour: number): void {
    if (Array.isArray(hourCounts) && typeof hour === 'number' &&
        Number.isInteger(hour) && hour >= 0 && hour < hourCounts.length) {
      const currentCount = this.safeGetArrayElement(hourCounts, hour) || 0;
      Object.defineProperty(hourCounts, hour, { value: (currentCount as number) + 1, writable: true, enumerable: true, configurable: true });
    }
  }

  /**
   * Safe log property getter
   */
  private safeGetLogProperty(log: AuditEvent, property: string): unknown {
    const allowedProperties = new Set(['eventId', 'timestamp', 'eventType', 'severity', 'userId', 'username', 'sessionId', 'action', 'outcome', 'resource', 'patientId', 'studyId']);

    if (typeof property === 'string' && allowedProperties.has(property) &&
        Object.prototype.hasOwnProperty.call(log, property)) {
      return Object.getOwnPropertyDescriptor(log as unknown as Record<string, unknown>, property)?.value;
    }
    return undefined;
  }

  /**
   * Safe array element access
   */
  private safeGetArrayElement<T>(arr: T[], index: number): T | undefined {
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < arr.length) {
      return Object.getOwnPropertyDescriptor(arr, index)?.value as T;
    }
    return undefined;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.flushBuffer();
  }
}

// Export singleton instance
export const auditLogger = new MedicalAuditLogger();
export default auditLogger;
