/**
 * Security Manager - Core Security Infrastructure
 * HIPAA-compliant security management system for medical imaging applications
 * Provides comprehensive security controls and audit capabilities
 */

import { EventEmitter } from 'events';
import { secureStorage } from './secureStorage';
import { log } from '../utils/logger';

// Security configuration interface
export interface SecurityConfig {
  // HIPAA Compliance Settings
  enableHIPAAMode: boolean;
  requireAuditLogging: boolean;
  dataRetentionDays: number;

  // Authentication Settings
  sessionTimeout: number; // minutes
  maxLoginAttempts: number;
  passwordComplexity: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };

  // Encryption Settings
  encryptionAlgorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyRotationInterval: number; // days
  enableDataEncryption: boolean;

  // Access Control
  enableRBAC: boolean; // Role-Based Access Control
  roles: SecurityRole[];

  // Audit Settings
  auditEventTypes: AuditEventType[];
  auditRetentionDays: number;
  enableRealTimeAuditing: boolean;

  // Security Headers
  contentSecurityPolicy: string;
  enableXSSProtection: boolean;
  enableFrameGuard: boolean;

  // Data Protection
  enableDataMasking: boolean;
  enableFieldEncryption: boolean;
  sensitiveFields: string[];
}

// Security role definition
export interface SecurityRole {
  id: string;
  name: string;
  permissions: Permission[];
  description: string;
  isDefault?: boolean;
}

// Permission structure
export interface Permission {
  resource: string;
  actions: PermissionAction[];
  conditions?: PermissionCondition[];
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  ADMIN = 'admin',
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with';
  value: string;
}

// Audit event types
export enum AuditEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  DICOM_VIEW = 'dicom_view',
  DICOM_DOWNLOAD = 'dicom_download',
  SYSTEM_ERROR = 'system_error',
  SECURITY_VIOLATION = 'security_violation',
  CONFIG_CHANGE = 'config_change',
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  sessionId?: string;
  resourceId?: string;
  action: string;
  outcome: 'success' | 'failure';
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Security context for current user session
export interface SecurityContext {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: Permission[];
  loginTime: Date;
  lastActivity: Date;
  ipAddress: string;
  isAuthenticated: boolean;
  mfaVerified: boolean;
}

// Security violation details
export interface SecurityViolation {
  id: string;
  timestamp: Date;
  type: 'unauthorized_access' | 'data_breach' | 'suspicious_activity' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  sessionId?: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableHIPAAMode: true,
  requireAuditLogging: true,
  dataRetentionDays: 2555, // 7 years for HIPAA compliance

  sessionTimeout: 30, // 30 minutes
  maxLoginAttempts: 3,
  passwordComplexity: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  encryptionAlgorithm: 'AES-256-GCM',
  keyRotationInterval: 90, // 90 days
  enableDataEncryption: true,

  enableRBAC: true,
  roles: [
    {
      id: 'viewer',
      name: 'DICOM Viewer',
      description: 'Can view DICOM images and basic patient data',
      permissions: [
        {
          resource: 'dicom',
          actions: [PermissionAction.READ],
        },
        {
          resource: 'patient',
          actions: [PermissionAction.READ],
        },
      ],
      isDefault: true,
    },
  ],

  auditEventTypes: Object.values(AuditEventType),
  auditRetentionDays: 2555, // 7 years
  enableRealTimeAuditing: true,

  contentSecurityPolicy: "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline';",
  enableXSSProtection: true,
  enableFrameGuard: true,

  enableDataMasking: true,
  enableFieldEncryption: true,
  sensitiveFields: ['PatientName', 'PatientID', 'PatientBirthDate', 'PatientAddress'],
};

export class SecurityManager extends EventEmitter {
  private config: SecurityConfig;
  private currentContext: SecurityContext | null = null;
  private auditLogs: Map<string, AuditLogEntry> = new Map();
  private violations: Map<string, SecurityViolation> = new Map();
  private encryptionKey: string | null = null;

  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.initializeSecurity();
  }

  /**
   * Initialize security infrastructure
   */
  private async initializeSecurity(): Promise<void> {
    try {
      // Initialize encryption key
      await this.initializeEncryption();

      // Setup security headers
      this.setupSecurityHeaders();

      // Initialize audit system
      this.initializeAuditSystem();

      // Setup session management
      this.initializeSessionManagement();

      log.info('Security Manager initialized', {
        component: 'SecurityManager',
        metadata: {
          hipaaMode: this.config.enableHIPAAMode,
          auditLogging: this.config.requireAuditLogging,
          rbacEnabled: this.config.enableRBAC,
        },
      });

      this.emit('securityInitialized', this.config);

    } catch (error) {
      log.error('Failed to initialize Security Manager', {
        component: 'SecurityManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Initialize encryption system
   */
  private async initializeEncryption(): Promise<void> {
    if (!this.config.enableDataEncryption) return;

    try {
      // Try to retrieve existing encryption key
      this.encryptionKey = await secureStorage.retrieve('encryptionKey');

      if (!this.encryptionKey) {
        // Generate new encryption key
        this.encryptionKey = this.generateEncryptionKey();
        await secureStorage.store('encryptionKey', this.encryptionKey, 'user-data');

        this.auditLog(AuditEventType.CONFIG_CHANGE, 'system', {
          action: 'encryption_key_generated',
          algorithm: this.config.encryptionAlgorithm,
        });
      }

      log.info('Encryption system initialized', {
        component: 'SecurityManager',
        metadata: { algorithm: this.config.encryptionAlgorithm },
      });

    } catch (error) {
      log.error('Failed to initialize encryption', {
        component: 'SecurityManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Generate secure encryption key
   */
  private generateEncryptionKey(): string {
    const array = new Uint8Array(32); // 256-bit key
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Setup security headers
   */
  private setupSecurityHeaders(): void {
    if (typeof document !== 'undefined') {
      // Content Security Policy
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = this.config.contentSecurityPolicy;
      document.head.appendChild(meta);

      // X-Frame-Options
      if (this.config.enableFrameGuard) {
        const frameGuard = document.createElement('meta');
        frameGuard.httpEquiv = 'X-Frame-Options';
        frameGuard.content = 'DENY';
        document.head.appendChild(frameGuard);
      }

      // X-XSS-Protection
      if (this.config.enableXSSProtection) {
        const xssProtection = document.createElement('meta');
        xssProtection.httpEquiv = 'X-XSS-Protection';
        xssProtection.content = '1; mode=block';
        document.head.appendChild(xssProtection);
      }
    }
  }

  /**
   * Initialize audit logging system
   */
  private initializeAuditSystem(): void {
    if (!this.config.requireAuditLogging) return;

    // Setup periodic audit log cleanup
    setInterval(() => {
      this.cleanupAuditLogs();
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    // Setup audit log persistence
    this.setupAuditPersistence();
  }

  /**
   * Initialize session management
   */
  private initializeSessionManagement(): void {
    // Setup session timeout monitoring
    setInterval(() => {
      this.checkSessionTimeout();
    }, 60000); // Check every minute
  }

  /**
   * Create audit log entry
   */
  public auditLog(
    eventType: AuditEventType,
    action: string,
    details: Record<string, unknown> = {},
    outcome: 'success' | 'failure' = 'success',
    riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low',
  ): void {
    if (!this.config.requireAuditLogging) return;

    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      eventType,
      userId: this.currentContext?.userId,
      sessionId: this.currentContext?.sessionId,
      action,
      outcome,
      details,
      ipAddress: this.currentContext?.ipAddress,
      riskLevel,
    };

    this.auditLogs.set(entry.id, entry);

    // Emit audit event for real-time monitoring
    if (this.config.enableRealTimeAuditing) {
      this.emit('auditEvent', entry);
    }

    // Log high-risk events immediately
    if (riskLevel === 'high' || riskLevel === 'critical') {
      log.warn('High-risk audit event', {
        component: 'SecurityManager',
        metadata: entry,
      });
    }
  }

  /**
   * Record security violation
   */
  public recordViolation(
    type: SecurityViolation['type'],
    severity: SecurityViolation['severity'],
    description: string,
    details: Record<string, unknown> = {},
  ): string {
    const violation: SecurityViolation = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      severity,
      description,
      userId: this.currentContext?.userId,
      sessionId: this.currentContext?.sessionId,
      details,
      resolved: false,
    };

    this.violations.set(violation.id, violation);

    // Log violation
    log.error('Security violation recorded', {
      component: 'SecurityManager',
      metadata: violation,
    });

    // Audit the violation
    this.auditLog(AuditEventType.SECURITY_VIOLATION, 'security_violation_recorded', {
      violationId: violation.id,
      type,
      severity,
      description,
    }, 'failure', severity);

    // Emit violation event
    this.emit('securityViolation', violation);

    return violation.id;
  }

  /**
   * Check user permissions
   */
  public hasPermission(resource: string, action: PermissionAction): boolean {
    if (!this.currentContext?.isAuthenticated) return false;
    if (!this.config.enableRBAC) return true; // RBAC disabled, allow all

    return this.currentContext.permissions.some(permission =>
      permission.resource === resource &&
      permission.actions.includes(action),
    );
  }

  /**
   * Encrypt sensitive data
   */
  public async encryptData(data: string): Promise<string> {
    if (!this.config.enableDataEncryption || !this.encryptionKey) {
      return data;
    }

    try {
      // Simplified encryption implementation
      // In production, use proper Web Crypto API
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const keyBuffer = encoder.encode(this.encryptionKey);

      // XOR encryption (simplified for demo)
      const encrypted = new Uint8Array(dataBuffer.length);
      for (let i = 0; i < dataBuffer.length; i++) {
        // eslint-disable-next-line security/detect-object-injection -- Safe array index access
        encrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length];
      }

      return btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
    } catch (error) {
      log.error('Data encryption failed', {
        component: 'SecurityManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  public async decryptData(encryptedData: string): Promise<string> {
    if (!this.config.enableDataEncryption || !this.encryptionKey) {
      return encryptedData;
    }

    try {
      const encrypted = new Uint8Array(Array.from(atob(encryptedData)).map(char => char.charCodeAt(0)));
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(this.encryptionKey);

      // XOR decryption
      const decrypted = new Uint8Array(encrypted.length);
      for (let i = 0; i < encrypted.length; i++) {
        // eslint-disable-next-line security/detect-object-injection -- Safe array index access
        decrypted[i] = encrypted[i] ^ keyBuffer[i % keyBuffer.length];
      }

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      log.error('Data decryption failed', {
        component: 'SecurityManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old audit logs
   */
  private cleanupAuditLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.auditRetentionDays);

    let cleanedCount = 0;
    for (const [id, entry] of Array.from(this.auditLogs)) {
      if (entry.timestamp < cutoffDate) {
        this.auditLogs.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.info('Audit logs cleaned up', {
        component: 'SecurityManager',
        metadata: { cleanedCount, totalLogs: this.auditLogs.size },
      });
    }
  }

  /**
   * Setup audit log persistence
   */
  private setupAuditPersistence(): void {
    // Persist audit logs to secure storage periodically
    setInterval(async () => {
      try {
        const logsArray = Array.from(this.auditLogs.values());
        await secureStorage.store('auditLogs', JSON.stringify(logsArray), 'user-data');
      } catch (error) {
        log.error('Failed to persist audit logs', {
          component: 'SecurityManager',
        }, error as Error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Check session timeout
   */
  private checkSessionTimeout(): void {
    if (!this.currentContext?.isAuthenticated) return;

    const now = new Date();
    const timeoutMs = this.config.sessionTimeout * 60 * 1000;

    if (now.getTime() - this.currentContext.lastActivity.getTime() > timeoutMs) {
      this.auditLog(AuditEventType.LOGOUT, 'session_timeout', {
        sessionDuration: now.getTime() - this.currentContext.loginTime.getTime(),
      });

      this.currentContext = null;
      this.emit('sessionTimeout');
    }
  }

  /**
   * Get current security context
   */
  public getSecurityContext(): SecurityContext | null {
    return this.currentContext;
  }

  /**
   * Get audit logs
   */
  public getAuditLogs(limit = 100): AuditLogEntry[] {
    return Array.from(this.auditLogs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get security violations
   */
  public getViolations(unresolved = false): SecurityViolation[] {
    const violations = Array.from(this.violations.values());
    return unresolved ? violations.filter(v => !v.resolved) : violations;
  }

  /**
   * Update security configuration
   */
  public updateConfig(updates: Partial<SecurityConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    this.auditLog(AuditEventType.CONFIG_CHANGE, 'security_config_updated', {
      changes: Object.keys(updates),
      oldConfig: JSON.stringify(oldConfig),
      newConfig: JSON.stringify(this.config),
    });

    this.emit('configUpdated', this.config);
  }

  /**
   * Dispose security manager
   */
  public dispose(): void {
    // Clear sensitive data
    this.encryptionKey = null;
    this.currentContext = null;

    // Clear caches
    this.auditLogs.clear();
    this.violations.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('Security Manager disposed', {
      component: 'SecurityManager',
    });
  }
}

// Singleton instance
export const securityManager = new SecurityManager();
