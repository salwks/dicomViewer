/**
 * Medical-grade authentication and session management
 * Provides secure user session handling for medical applications
 */

import { medicalEncryption } from './encryption';
import { secureStorage } from './secureStorage';
import { log } from '../utils/logger';

export interface UserCredentials {
  username: string;
  password: string;
  organizationId?: string;
  licenseKey?: string;
}

export interface UserSession {
  userId: string;
  username: string;
  organizationId?: string;
  permissions: string[];
  roles: string[];
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  lastActivity: number;
  deviceInfo?: {
    userAgent: string;
    ipAddress?: string;
    deviceType: 'desktop' | 'tablet' | 'mobile';
  };
}

export interface AuthenticationResult {
  success: boolean;
  session?: UserSession;
  error?: string;
  requiresTwoFactor?: boolean;
  temporaryToken?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: UserSession;
  reason?: 'expired' | 'invalid' | 'inactive' | 'revoked';
}

class MedicalAuthentication {
  private currentSession: UserSession | null = null;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private maxInactivity = 15 * 60 * 1000; // 15 minutes
  private sessionCleanupInterval: number | null = null;

  /**
   * Initialize authentication system
   */
  initialize(): void {
    try {
      // Start session cleanup
      this.startSessionCleanup();

      // Try to restore existing session
      this.restoreSession();

      log.security('Authentication system initialized', {
        component: 'MedicalAuthentication',
      });
    } catch (error) {
      log.error(
        'Failed to initialize authentication',
        {
          component: 'MedicalAuthentication',
        },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Authenticate user with credentials
   */
  async authenticate(credentials: UserCredentials): Promise<AuthenticationResult> {
    try {
      log.security('Authentication attempt', {
        component: 'MedicalAuthentication',
        metadata: {
          username: credentials.username,
          hasOrgId: !!credentials.organizationId,
        },
      });

      // In production, validate against secure backend
      const isValid = await this.validateCredentials(credentials);

      if (!isValid) {
        log.security('Authentication failed - invalid credentials', {
          component: 'MedicalAuthentication',
          metadata: { username: credentials.username },
        });

        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Create user session
      const session = await this.createSession(credentials.username, credentials.organizationId);

      // Store session securely
      await this.storeSession(session);

      this.currentSession = session;

      log.security('Authentication successful', {
        component: 'MedicalAuthentication',
        metadata: {
          userId: session.userId,
          sessionId: session.sessionId,
        },
      });

      return {
        success: true,
        session,
      };
    } catch (error) {
      log.error(
        'Authentication process failed',
        {
          component: 'MedicalAuthentication',
          metadata: { username: credentials.username },
        },
        error as Error,
      );

      return {
        success: false,
        error: 'Authentication process failed',
      };
    }
  }

  /**
   * Validate existing session
   */
  async validateSession(sessionId?: string): Promise<SessionValidationResult> {
    try {
      const targetSessionId = sessionId || this.currentSession?.sessionId;

      if (!targetSessionId) {
        return {
          isValid: false,
          reason: 'invalid',
        };
      }

      // Retrieve session from secure storage
      const sessionData = await secureStorage.retrieveSession(targetSessionId);

      if (!sessionData) {
        return {
          isValid: false,
          reason: 'invalid',
        };
      }

      const session = sessionData as unknown as UserSession;
      const now = Date.now();

      // Check expiration
      if (session.expiresAt < now) {
        await this.revokeSession(sessionId);
        return {
          isValid: false,
          reason: 'expired',
        };
      }

      // Check inactivity
      if (now - session.lastActivity > this.maxInactivity) {
        await this.revokeSession(sessionId);
        return {
          isValid: false,
          reason: 'inactive',
        };
      }

      // Update last activity
      session.lastActivity = now;
      await this.updateSession(session);

      return {
        isValid: true,
        session,
      };
    } catch (error) {
      log.error(
        'Session validation failed',
        {
          component: 'MedicalAuthentication',
          metadata: { sessionId },
        },
        error as Error,
      );

      return {
        isValid: false,
        reason: 'invalid',
      };
    }
  }

  /**
   * Refresh user session
   */
  async refreshSession(sessionId?: string): Promise<UserSession | null> {
    try {
      const validation = await this.validateSession(sessionId);

      if (!validation.isValid || !validation.session) {
        return null;
      }

      // Extend session expiration
      const extendedSession = {
        ...validation.session,
        expiresAt: Date.now() + this.sessionTimeout,
        lastActivity: Date.now(),
      };

      await this.updateSession(extendedSession);

      if (this.currentSession?.sessionId === extendedSession.sessionId) {
        this.currentSession = extendedSession;
      }

      log.security('Session refreshed', {
        component: 'MedicalAuthentication',
        metadata: {
          sessionId: extendedSession.sessionId,
          newExpiresAt: extendedSession.expiresAt,
        },
      });

      return extendedSession;
    } catch (error) {
      log.error(
        'Session refresh failed',
        {
          component: 'MedicalAuthentication',
          metadata: { sessionId },
        },
        error as Error,
      );

      return null;
    }
  }

  /**
   * Revoke user session (logout)
   */
  async revokeSession(sessionId?: string): Promise<void> {
    try {
      const targetSessionId = sessionId || this.currentSession?.sessionId;

      if (targetSessionId) {
        await secureStorage.remove(`session-${targetSessionId}`);

        log.security('Session revoked', {
          component: 'MedicalAuthentication',
          metadata: { sessionId: targetSessionId },
        });
      }

      if (!sessionId || this.currentSession?.sessionId === sessionId) {
        this.currentSession = null;
      }
    } catch (error) {
      log.error(
        'Session revocation failed',
        {
          component: 'MedicalAuthentication',
          metadata: { sessionId },
        },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get current user session
   */
  getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission: string, sessionId?: string): boolean {
    const session = sessionId ? null : this.currentSession; // Simplified for demo
    return session?.permissions.includes(permission) || false;
  }

  /**
   * Check if user has role
   */
  hasRole(role: string, sessionId?: string): boolean {
    const session = sessionId ? null : this.currentSession; // Simplified for demo
    return session?.roles.includes(role) || false;
  }

  /**
   * Create new user session
   */
  private async createSession(username: string, organizationId?: string): Promise<UserSession> {
    const sessionId = medicalEncryption.generateKey(32);
    const userId = medicalEncryption.createHash(`${username}:${organizationId || 'default'}`);
    const now = Date.now();

    // Get device info
    const deviceInfo = {
      userAgent: navigator.userAgent,
      deviceType: this.detectDeviceType() as 'desktop' | 'tablet' | 'mobile',
    };

    // In production, load permissions from backend
    const permissions = await this.loadUserPermissions(userId);
    const roles = await this.loadUserRoles(userId);

    return {
      userId,
      username,
      organizationId,
      permissions,
      roles,
      sessionId,
      issuedAt: now,
      expiresAt: now + this.sessionTimeout,
      lastActivity: now,
      deviceInfo,
    };
  }

  /**
   * Store session securely
   */
  private async storeSession(session: UserSession): Promise<void> {
    await secureStorage.storeSession(
      session.sessionId,
      session as unknown as Record<string, unknown>,
      this.sessionTimeout,
    );
  }

  /**
   * Update existing session
   */
  private async updateSession(session: UserSession): Promise<void> {
    await secureStorage.storeSession(
      session.sessionId,
      session as unknown as Record<string, unknown>,
      session.expiresAt - Date.now(),
    );
  }

  /**
   * Validate user credentials with enhanced security checks
   */
  private async validateCredentials(credentials: UserCredentials): Promise<boolean> {
    // Basic validation
    if (!credentials.username || !credentials.password) {
      return false;
    }

    // Username format validation (medical professional standards)
    const usernamePattern = /^[a-zA-Z0-9._-]{3,50}$/;
    if (!usernamePattern.test(credentials.username)) {
      return false;
    }

    // Password strength validation
    const passwordChecks = [
      credentials.password.length >= 8,
      /[A-Z]/.test(credentials.password), // uppercase
      /[a-z]/.test(credentials.password), // lowercase
      /[0-9]/.test(credentials.password), // numbers
      /[!@#$%^&*(),.?":{}|<>]/.test(credentials.password), // special chars
    ];

    if (passwordChecks.filter(Boolean).length < 4) {
      return false;
    }

    // Organization validation if provided
    if (credentials.organizationId && !/^[A-Z]{2,10}$/.test(credentials.organizationId)) {
      return false;
    }

    // License key validation if provided (format: XXXX-XXXX-XXXX-XXXX)
    if (credentials.licenseKey && !/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(credentials.licenseKey)) {
      return false;
    }

    // Simulate realistic authentication delay
    return new Promise(resolve => {
      setTimeout(() => {
        // Enhanced demo validation with realistic rules
        const validUsers = [
          { username: 'admin', password: 'Admin123!', org: 'MED01' },
          { username: 'radiologist', password: 'Radio123!', org: 'MED01' },
          { username: 'technician', password: 'Tech123!', org: 'MED01' },
          { username: 'viewer', password: 'View123!', org: 'MED01' },
        ];

        const user = validUsers.find(u =>
          u.username === credentials.username &&
          u.password === credentials.password &&
          (!credentials.organizationId || u.org === credentials.organizationId),
        );

        resolve(!!user);
      }, 200 + Math.random() * 300); // 200-500ms realistic delay
    });
  }

  /**
   * Load user permissions based on role and organization
   */
  private async loadUserPermissions(userId: string): Promise<string[]> {
    // Role-based permission mapping
    const rolePermissions = {
      admin: [
        'view_images', 'create_annotations', 'edit_annotations', 'delete_annotations',
        'export_data', 'view_measurements', 'create_measurements', 'edit_measurements',
        'manage_users', 'manage_studies', 'system_settings', 'audit_logs',
        'backup_restore', 'quality_control',
      ],
      radiologist: [
        'view_images', 'create_annotations', 'edit_annotations', 'delete_annotations',
        'export_data', 'view_measurements', 'create_measurements', 'edit_measurements',
        'create_reports', 'edit_reports', 'approve_reports', 'view_patient_data',
      ],
      technician: [
        'view_images', 'create_annotations', 'edit_annotations',
        'view_measurements', 'create_measurements', 'export_data',
        'quality_control', 'basic_settings',
      ],
      viewer: [
        'view_images', 'view_measurements', 'view_annotations',
        'export_data',
      ],
    };

    // Extract username from userId for demo
    const username = userId.toLowerCase();

    if (username.includes('admin')) {
      return rolePermissions.admin;
    } else if (username.includes('radiologist')) {
      return rolePermissions.radiologist;
    } else if (username.includes('technician')) {
      return rolePermissions.technician;
    } else {
      return rolePermissions.viewer;
    }
  }

  /**
   * Load user roles based on user type and organization
   */
  private async loadUserRoles(userId: string): Promise<string[]> {
    // Extract username from userId for demo
    const username = userId.toLowerCase();

    const roleMapping = {
      admin: ['administrator', 'power_user', 'user'],
      radiologist: ['radiologist', 'medical_professional', 'user'],
      technician: ['technician', 'operator', 'user'],
      viewer: ['viewer', 'user'],
    };

    if (username.includes('admin')) {
      return roleMapping.admin;
    } else if (username.includes('radiologist')) {
      return roleMapping.radiologist;
    } else if (username.includes('technician')) {
      return roleMapping.technician;
    } else {
      return roleMapping.viewer;
    }
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();

    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }

    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }

    return 'desktop';
  }

  /**
   * Restore session from storage
   */
  private async restoreSession(): Promise<void> {
    try {
      // In production, check for session cookie or local storage
      const sessionIds = await secureStorage.listKeys();
      const sessionKey = sessionIds.find(key => key.startsWith('session-'));

      if (sessionKey) {
        const sessionId = sessionKey.replace('session-', '');
        const validation = await this.validateSession(sessionId);

        if (validation.isValid && validation.session) {
          this.currentSession = validation.session;

          log.security('Session restored', {
            component: 'MedicalAuthentication',
            metadata: { sessionId },
          });
        }
      }
    } catch (error) {
      log.warn(
        'Failed to restore session',
        {
          component: 'MedicalAuthentication',
        },
        error as Error,
      );
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startSessionCleanup(): void {
    // Cleanup expired sessions every 5 minutes
    this.sessionCleanupInterval = window.setInterval(
      async () => {
        try {
          await secureStorage.cleanup();
        } catch (error) {
          log.warn(
            'Session cleanup failed',
            {
              component: 'MedicalAuthentication',
            },
            error as Error,
          );
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Stop session cleanup
   */
  private stopSessionCleanup(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stopSessionCleanup();
    this.currentSession = null;
  }
}

// Export singleton instance
export const medicalAuth = new MedicalAuthentication();
export default medicalAuth;
