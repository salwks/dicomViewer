/**
 * useAuditLogger Hook
 * React hook for easy access to audit logging functionality
 * Built for medical applications with HIPAA compliance
 */

import { useCallback, useEffect, useState } from 'react';
import { auditLogger, AuditEventType, AuditSeverity, type AuditEvent, type AuditLogFilter, type AuditLogStatistics } from '../security/AuditLogger';
import { log } from '../utils/logger';

interface UseAuditLoggerReturn {
  // Logging functions
  logEvent: (
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
  ) => Promise<void>;

  // Convenience logging functions
  logDicomAccess: (studyId: string, patientId?: string, outcome?: 'success' | 'failure') => Promise<void>;
  logAnnotationAction: (action: string, annotationId: string, outcome?: 'success' | 'failure') => Promise<void>;
  logSecurityEvent: (eventType: AuditEventType, details: string, severity?: AuditSeverity) => Promise<void>;
  logAuthEvent: (eventType: AuditEventType, username?: string, outcome?: 'success' | 'failure') => Promise<void>;

  // Data retrieval
  getLogs: (filter?: AuditLogFilter, limit?: number, offset?: number) => Promise<AuditEvent[]>;
  getStatistics: (filter?: AuditLogFilter) => Promise<AuditLogStatistics>;
  exportLogs: (format: 'json' | 'csv' | 'xml', filter?: AuditLogFilter) => Promise<string>;

  // Management functions
  verifyIntegrity: () => Promise<{
    isValid: boolean;
    corruptedEntries: number;
    missingEntries: number;
    details: string[];
  }>;

  // State
  isLoading: boolean;
  error: string | null;
}

export const useAuditLogger = (): UseAuditLoggerReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic log event function
  const logEvent = useCallback(async (
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
  ) => {
    try {
      setError(null);
      await auditLogger.logEvent(eventType, action, outcome, details);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log audit event';
      setError(errorMessage);
      log.error('Audit logging failed', {
        component: 'useAuditLogger',
        metadata: { eventType, action, outcome },
      }, err as Error);
    }
  }, []);

  // Convenience function for DICOM access logging
  const logDicomAccess = useCallback(async (
    studyId: string,
    patientId?: string,
    outcome: 'success' | 'failure' = 'success',
  ) => {
    await logEvent(
      AuditEventType.DICOM_VIEW,
      'view_dicom_study',
      outcome,
      {
        severity: AuditSeverity.MEDIUM,
        resource: `study/${studyId}`,
        studyId,
        patientId,
        customDetails: {
          accessTime: new Date().toISOString(),
          viewType: 'web_viewer',
        },
      },
    );
  }, [logEvent]);

  // Convenience function for annotation actions
  const logAnnotationAction = useCallback(async (
    action: string,
    annotationId: string,
    outcome: 'success' | 'failure' = 'success',
  ) => {
    const eventTypeMap = new Map<string, AuditEventType>([
      ['create', AuditEventType.ANNOTATION_CREATE],
      ['modify', AuditEventType.ANNOTATION_MODIFY],
      ['delete', AuditEventType.ANNOTATION_DELETE],
    ]);

    const eventType = eventTypeMap.get(action) || AuditEventType.ANNOTATION_MODIFY;

    await logEvent(
      eventType,
      action,
      outcome,
      {
        severity: AuditSeverity.LOW,
        resource: `annotation/${annotationId}`,
        customDetails: {
          annotationId,
          annotationType: 'medical_annotation',
        },
      },
    );
  }, [logEvent]);

  // Convenience function for security events
  const logSecurityEvent = useCallback(async (
    eventType: AuditEventType,
    details: string,
    severity: AuditSeverity = AuditSeverity.HIGH,
  ) => {
    await logEvent(
      eventType,
      'security_event',
      'unknown',
      {
        severity,
        customDetails: {
          securityDetails: details,
          timestamp: new Date().toISOString(),
        },
      },
    );
  }, [logEvent]);

  // Convenience function for authentication events
  const logAuthEvent = useCallback(async (
    eventType: AuditEventType,
    username?: string,
    outcome: 'success' | 'failure' = 'success',
  ) => {
    const severity = outcome === 'failure' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

    await logEvent(
      eventType,
      'authentication',
      outcome,
      {
        severity,
        username,
        resource: 'authentication_system',
        customDetails: {
          authMethod: 'password',
          timestamp: new Date().toISOString(),
        },
      },
    );
  }, [logEvent]);

  // Get audit logs with optional filtering
  const getLogs = useCallback(async (
    filter?: AuditLogFilter,
    limit?: number,
    offset?: number,
  ): Promise<AuditEvent[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const logs = await auditLogger.getAuditLogs(filter, limit, offset);
      return logs;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retrieve audit logs';
      setError(errorMessage);
      log.error('Failed to retrieve audit logs', {
        component: 'useAuditLogger',
      }, err as Error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get audit statistics
  const getStatistics = useCallback(async (filter?: AuditLogFilter): Promise<AuditLogStatistics> => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await auditLogger.getStatistics(filter);
      return stats;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get audit statistics';
      setError(errorMessage);
      log.error('Failed to get audit statistics', {
        component: 'useAuditLogger',
      }, err as Error);

      // Return empty statistics on error
      return {
        totalEvents: 0,
        eventsByType: Object.create(null) as Record<AuditEventType, number>,
        eventsBySeverity: {} as Record<AuditSeverity, number>,
        eventsByOutcome: { success: 0, failure: 0, unknown: 0 },
        uniqueUsers: 0,
        suspiciousActivities: 0,
        complianceViolations: 0,
        averageEventsPerDay: 0,
        peakActivityHours: [],
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export audit logs
  const exportLogs = useCallback(async (
    format: 'json' | 'csv' | 'xml',
    filter?: AuditLogFilter,
  ): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);
      const exportedData = await auditLogger.exportLogs(format, filter);

      // Log the export action
      await logEvent(
        AuditEventType.AUDIT_LOG_ACCESS,
        'export_logs',
        'success',
        {
          severity: AuditSeverity.MEDIUM,
          resource: 'audit_logs',
          customDetails: {
            exportFormat: format,
            filterApplied: !!filter,
          },
        },
      );

      return exportedData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export audit logs';
      setError(errorMessage);

      // Log the failed export
      await logEvent(
        AuditEventType.AUDIT_LOG_ACCESS,
        'export_logs',
        'failure',
        {
          severity: AuditSeverity.MEDIUM,
          resource: 'audit_logs',
          customDetails: {
            exportFormat: format,
            error: errorMessage,
          },
        },
      );

      log.error('Failed to export audit logs', {
        component: 'useAuditLogger',
        metadata: { format },
      }, err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [logEvent]);

  // Verify log integrity
  const verifyIntegrity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await auditLogger.verifyLogIntegrity();

      // Log the integrity check
      await logEvent(
        AuditEventType.AUDIT_LOG_ACCESS,
        'verify_integrity',
        result.isValid ? 'success' : 'failure',
        {
          severity: result.isValid ? AuditSeverity.LOW : AuditSeverity.HIGH,
          resource: 'audit_logs',
          customDetails: {
            corruptedEntries: result.corruptedEntries,
            missingEntries: result.missingEntries,
            integrityValid: result.isValid,
          },
        },
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify log integrity';
      setError(errorMessage);
      log.error('Failed to verify audit log integrity', {
        component: 'useAuditLogger',
      }, err as Error);

      return {
        isValid: false,
        corruptedEntries: 0,
        missingEntries: 0,
        details: ['Integrity check failed'],
      };
    } finally {
      setIsLoading(false);
    }
  }, [logEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup is handled by the audit logger itself
    };
  }, []);

  return {
    // Logging functions
    logEvent,
    logDicomAccess,
    logAnnotationAction,
    logSecurityEvent,
    logAuthEvent,

    // Data retrieval
    getLogs,
    getStatistics,
    exportLogs,

    // Management
    verifyIntegrity,

    // State
    isLoading,
    error,
  };
};

export default useAuditLogger;
