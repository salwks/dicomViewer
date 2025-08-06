/**
 * Medical-grade security module exports
 * Provides comprehensive security functionality for medical applications
 */

import { log } from '../utils/logger';

// Encryption utilities
export { medicalEncryption, type EncryptionOptions, type EncryptedData, type EncryptionMetadata } from './encryption';

// Secure storage
export { secureStorage, type SecureStorageOptions, type StoredData } from './secureStorage';

// Authentication and session management
export {
  medicalAuth,
  type UserCredentials as MedicalUserCredentials,
  type UserSession as MedicalUserSession,
  type AuthenticationResult as MedicalAuthenticationResult,
  type SessionValidationResult,
} from './authentication';

// Security Manager
export {
  SecurityManager,
  securityManager,
  type SecurityConfig,
  type SecurityRole,
  type Permission,
  type PermissionCondition,
  type AuditLogEntry,
  type SecurityContext,
  type SecurityViolation,
  PermissionAction,
  DEFAULT_SECURITY_CONFIG,
} from './SecurityManager';

// HIPAA Compliance
export {
  HIPAAComplianceManager,
  hipaaComplianceManager,
  type HIPAAConfig,
  type PHIDetectionResult,
  type HIPAABreachIncident,
  type DataMaskingConfig,
  type MaskingRule,
  PHIType,
  DEFAULT_HIPAA_CONFIG,
} from './HIPAACompliance';

// Authentication Manager
export {
  AuthenticationManager,
  authenticationManager,
  type AuthenticationConfig,
  type UserCredentials,
  type AuthenticationResult,
  type AuthenticatedUser,
  type UserSession,
  type SSOProvider,
  MFAMethod,
  DEFAULT_AUTH_CONFIG,
} from './AuthenticationManager';

// Key Management System
export {
  KeyManagementSystem,
  keyManagementSystem,
  type KeyMetadata,
  type KeyRotationPolicy,
  type KeyDerivationConfig,
  DEFAULT_KEY_ROTATION_POLICY,
} from './KeyManagementSystem';

// Audit Logging
export {
  auditLogger,
  AuditEventType,
  AuditSeverity,
  type AuditEvent,
  type AuditLogFilter,
  type AuditLogStatistics,
} from './AuditLogger';

// Audit Log Rotation
export {
  auditLogRotation,
  AuditLogRotationManager,
  type LogRotationConfig,
  type LogArchive,
  type ArchivalStatistics,
} from './AuditLogRotation';

// Audit Log Monitoring
export {
  auditLogMonitoring,
  AuditLogMonitoringService,
  type MonitoringConfig,
  type MonitoringAlert,
  type RealtimeMetrics,
  type MonitoringDashboardData,
} from './AuditLogMonitoring';

// Security Validation
export {
  securityValidator,
  type ValidationResult,
  type SecurityValidationConfig,
  type MedicalDataValidation,
} from './SecurityValidator';

// Security Headers
export {
  securityHeaders,
  type SecurityHeadersConfig,
  type CSPDirectives,
} from './SecurityHeaders';

// Initialize security subsystem
export async function initializeSecurity(masterKey?: string): Promise<void> {
  try {
    // Import modules dynamically to avoid circular dependencies
    const { secureStorage } = await import('./secureStorage');
    const { medicalEncryption } = await import('./encryption');
    const { medicalAuth } = await import('./authentication');

    // Initialize secure storage with master key
    if (masterKey) {
      secureStorage.initialize(masterKey);
    } else {
      // Generate a session-specific key if none provided
      const sessionKey = medicalEncryption.generateKey();
      secureStorage.initialize(sessionKey);
    }

    // Initialize authentication system
    medicalAuth.initialize();

    // Initialize Security Manager
    const { securityManager } = await import('./SecurityManager');
    await securityManager;

    // Initialize HIPAA Compliance
    const { hipaaComplianceManager } = await import('./HIPAACompliance');
    await hipaaComplianceManager;

    // Initialize Authentication Manager
    const { authenticationManager } = await import('./AuthenticationManager');
    await authenticationManager;

    // Initialize Key Management System
    const { keyManagementSystem } = await import('./KeyManagementSystem');
    await keyManagementSystem;

    log.info('Medical security subsystem initialized', {
      component: 'SecuritySubsystem',
      metadata: {
        securityManager: true,
        hipaaCompliance: true,
        authenticationManager: true,
        keyManagement: true,
      },
    });
  } catch (error) {
    log.error(
      'Failed to initialize security subsystem',
      {
        component: 'SecuritySubsystem',
      },
      error as Error,
    );
    throw error;
  }
}

// Cleanup security subsystem
export async function cleanupSecurity(): Promise<void> {
  try {
    const { medicalAuth } = await import('./authentication');
    const { securityManager } = await import('./SecurityManager');
    const { hipaaComplianceManager } = await import('./HIPAACompliance');
    const { authenticationManager } = await import('./AuthenticationManager');
    const { keyManagementSystem } = await import('./KeyManagementSystem');

    // Cleanup in reverse order
    keyManagementSystem.dispose();
    authenticationManager.dispose();
    hipaaComplianceManager.dispose();
    securityManager.dispose();
    medicalAuth.destroy();

    log.info('Security subsystem cleaned up', {
      component: 'SecuritySubsystem',
    });
  } catch (error) {
    log.error(
      'Failed to cleanup security subsystem',
      {
        component: 'SecuritySubsystem',
      },
      error as Error,
    );
  }
}
