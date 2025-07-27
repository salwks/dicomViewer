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
      log.error('Failed to initialize authentication', {
        component: 'MedicalAuthentication',
      }, error as Error);
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
      log.error('Authentication process failed', {
        component: 'MedicalAuthentication',
        metadata: { username: credentials.username },
      }, error as Error);

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
      if ((now - session.lastActivity) > this.maxInactivity) {
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
      log.error('Session validation failed', {
        component: 'MedicalAuthentication',
        metadata: { sessionId },
      }, error as Error);

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
      log.error('Session refresh failed', {
        component: 'MedicalAuthentication',
        metadata: { sessionId },
      }, error as Error);

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
      log.error('Session revocation failed', {
        component: 'MedicalAuthentication',
        metadata: { sessionId },
      }, error as Error);
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
   * Validate user credentials (placeholder implementation)
   */
  private async validateCredentials(credentials: UserCredentials): Promise<boolean> {
    // In production, validate against secure backend/LDAP/Active Directory
    // This is a placeholder implementation

    // Basic validation rules for demo
    if (!credentials.username || !credentials.password) {
      return false;
    }

    // Simulate async validation
    return new Promise((resolve) => {
      setTimeout(() => {
        // Demo: accept any non-empty credentials
        resolve(credentials.username.length > 0 && credentials.password.length >= 6);
      }, 100);
    });
  }

  /**
   * Load user permissions (placeholder)
   */
  private async loadUserPermissions(_userId: string): Promise<string[]> {
    // In production, load from backend based on user role
    return [
      'view_images',
      'create_annotations',
      'edit_annotations',
      'export_data',
      'view_measurements',
    ];
  }

  /**
   * Load user roles (placeholder)
   */
  private async loadUserRoles(_userId: string): Promise<string[]> {
    // In production, load from backend
    return ['radiologist', 'user'];
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
      log.warn('Failed to restore session', {
        component: 'MedicalAuthentication',
      }, error as Error);
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startSessionCleanup(): void {
    // Cleanup expired sessions every 5 minutes
    this.sessionCleanupInterval = window.setInterval(async () => {
      try {
        await secureStorage.cleanup();
      } catch (error) {
        log.warn('Session cleanup failed', {
          component: 'MedicalAuthentication',
        }, error as Error);
      }
    }, 5 * 60 * 1000);
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
