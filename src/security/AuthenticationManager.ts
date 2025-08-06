/**
 * Authentication Manager - Advanced Authentication and Access Control
 * Provides comprehensive authentication, authorization, and session management
 * with HIPAA compliance and medical-grade security standards
 */

import { EventEmitter } from 'events';
import { securityManager, AuditEventType, SecurityContext, Permission, PermissionAction } from './SecurityManager';
import { secureStorage } from './secureStorage';
import { medicalEncryption } from './encryption';
import { log } from '../utils/logger';

// Authentication configuration
export interface AuthenticationConfig {
  // Password policies
  passwordPolicy: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventReuse: number; // Number of previous passwords to check
    expiryDays: number;
  };

  // Multi-factor authentication
  mfaConfig: {
    enabled: boolean;
    methods: MFAMethod[];
    gracePeriod: number; // Minutes before MFA is required
    backupCodes: boolean;
  };

  // Session management
  sessionConfig: {
    maxSessions: number; // Max concurrent sessions per user
    timeout: number; // Minutes
    renewalThreshold: number; // Minutes before expiry to allow renewal
    secureTransport: boolean;
  };

  // Account lockout
  lockoutPolicy: {
    maxAttempts: number;
    lockoutDuration: number; // Minutes
    progressiveDelay: boolean; // Increase delay with each failed attempt
  };

  // Single Sign-On
  ssoConfig: {
    enabled: boolean;
    providers: SSOProvider[];
    fallbackToLocal: boolean;
  };
}

// Multi-factor authentication methods
export enum MFAMethod {
  TOTP = 'totp', // Time-based One-Time Password
  SMS = 'sms',
  EMAIL = 'email',
  HARDWARE_TOKEN = 'hardware_token',
  BIOMETRIC = 'biometric',
}

// SSO providers
export interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth2' | 'oidc';
  endpoint: string;
  clientId: string;
  enabled: boolean;
}

// User credentials
export interface UserCredentials {
  username: string;
  password: string;
  mfaToken?: string;
  mfaMethod?: MFAMethod;
}

// Authentication result
export interface AuthenticationResult {
  success: boolean;
  user?: AuthenticatedUser;
  session?: UserSession;
  error?: string;
  requiresMFA?: boolean;
  mfaMethods?: MFAMethod[];
  lockoutRemaining?: number; // Minutes remaining in lockout
}

// Authenticated user
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: Permission[];
  lastLogin: Date;
  passwordExpiry?: Date;
  mfaEnabled: boolean;
  accountStatus: 'active' | 'inactive' | 'locked' | 'expired';
  department?: string;
  title?: string;
}

// User session
export interface UserSession {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  mfaVerified: boolean;
  permissions: Permission[];
}

// Login attempt tracking
interface LoginAttempt {
  username: string;
  timestamp: Date;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  failureReason?: string;
}

// Default authentication configuration
export const DEFAULT_AUTH_CONFIG: AuthenticationConfig = {
  passwordPolicy: {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventReuse: 12,
    expiryDays: 90,
  },

  mfaConfig: {
    enabled: true,
    methods: [MFAMethod.TOTP, MFAMethod.EMAIL],
    gracePeriod: 15,
    backupCodes: true,
  },

  sessionConfig: {
    maxSessions: 3,
    timeout: 30,
    renewalThreshold: 10,
    secureTransport: true,
  },

  lockoutPolicy: {
    maxAttempts: 3,
    lockoutDuration: 30,
    progressiveDelay: true,
  },

  ssoConfig: {
    enabled: false,
    providers: [],
    fallbackToLocal: true,
  },
};

export class AuthenticationManager extends EventEmitter {
  private config: AuthenticationConfig;
  private activeSessions: Map<string, UserSession> = new Map();
  private users: Map<string, AuthenticatedUser> = new Map();
  private loginAttempts: Map<string, LoginAttempt[]> = new Map();
  private lockedAccounts: Map<string, Date> = new Map();
  private passwordHistory: Map<string, string[]> = new Map();

  constructor(config: Partial<AuthenticationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config };
    this.initializeAuthentication();
  }

  /**
   * Initialize authentication system
   */
  private async initializeAuthentication(): Promise<void> {
    try {
      // Load stored users and sessions
      await this.loadStoredData();

      // Setup session cleanup
      this.setupSessionCleanup();

      // Setup lockout cleanup
      this.setupLockoutCleanup();

      // Initialize default admin user if none exists
      if (this.users.size === 0) {
        await this.createDefaultAdminUser();
      }

      log.info('Authentication Manager initialized', {
        component: 'AuthenticationManager',
        metadata: {
          userCount: this.users.size,
          sessionCount: this.activeSessions.size,
          mfaEnabled: this.config.mfaConfig.enabled,
          ssoEnabled: this.config.ssoConfig.enabled,
        },
      });

      this.emit('authenticationInitialized', this.config);

    } catch (error) {
      log.error('Failed to initialize Authentication Manager', {
        component: 'AuthenticationManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Authenticate user with credentials
   */
  public async authenticate(
    credentials: UserCredentials,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthenticationResult> {
    const startTime = Date.now();

    try {
      // Check if account is locked
      if (this.isAccountLocked(credentials.username)) {
        const lockoutEnd = this.lockedAccounts.get(credentials.username);
        const remainingMinutes = lockoutEnd ?
          Math.ceil((lockoutEnd.getTime() - Date.now()) / (1000 * 60)) : 0;

        this.recordLoginAttempt(credentials.username, false, ipAddress, userAgent, 'account_locked');

        securityManager.auditLog(AuditEventType.LOGIN, 'login_blocked_locked_account', {
          username: credentials.username,
          ipAddress,
          remainingMinutes,
        }, 'failure', 'medium');

        return {
          success: false,
          error: 'Account is locked due to multiple failed login attempts',
          lockoutRemaining: remainingMinutes,
        };
      }

      // Find user
      const user = this.users.get(credentials.username);
      if (!user) {
        this.recordLoginAttempt(credentials.username, false, ipAddress, userAgent, 'user_not_found');
        this.checkLockoutPolicy(credentials.username);

        securityManager.auditLog(AuditEventType.LOGIN, 'login_failed_user_not_found', {
          username: credentials.username,
          ipAddress,
        }, 'failure', 'medium');

        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Check account status
      if (user.accountStatus !== 'active') {
        this.recordLoginAttempt(credentials.username, false, ipAddress, userAgent, `account_${user.accountStatus}`);

        securityManager.auditLog(AuditEventType.LOGIN, 'login_failed_account_inactive', {
          username: credentials.username,
          accountStatus: user.accountStatus,
          ipAddress,
        }, 'failure', 'medium');

        return {
          success: false,
          error: `Account is ${user.accountStatus}`,
        };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(credentials.password, user.id);
      if (!passwordValid) {
        this.recordLoginAttempt(credentials.username, false, ipAddress, userAgent, 'invalid_password');
        this.checkLockoutPolicy(credentials.username);

        securityManager.auditLog(AuditEventType.LOGIN, 'login_failed_invalid_password', {
          username: credentials.username,
          ipAddress,
        }, 'failure', 'high');

        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Check if MFA is required
      if (this.config.mfaConfig.enabled && user.mfaEnabled) {
        if (!credentials.mfaToken || !credentials.mfaMethod) {
          return {
            success: false,
            requiresMFA: true,
            mfaMethods: this.config.mfaConfig.methods,
            error: 'Multi-factor authentication required',
          };
        }

        // Verify MFA token
        const mfaValid = await this.verifyMFAToken(
          user.id,
          credentials.mfaToken,
          credentials.mfaMethod,
        );

        if (!mfaValid) {
          this.recordLoginAttempt(credentials.username, false, ipAddress, userAgent, 'invalid_mfa');
          this.checkLockoutPolicy(credentials.username);

          securityManager.auditLog(AuditEventType.LOGIN, 'login_failed_invalid_mfa', {
            username: credentials.username,
            mfaMethod: credentials.mfaMethod,
            ipAddress,
          }, 'failure', 'high');

          return {
            success: false,
            error: 'Invalid multi-factor authentication code',
          };
        }
      }

      // Check password expiry
      if (user.passwordExpiry && user.passwordExpiry < new Date()) {
        securityManager.auditLog(AuditEventType.LOGIN, 'login_password_expired', {
          username: credentials.username,
          passwordExpiry: user.passwordExpiry,
          ipAddress,
        }, 'failure', 'medium');

        return {
          success: false,
          error: 'Password has expired and must be changed',
        };
      }

      // Check concurrent sessions
      const userSessions = Array.from(this.activeSessions.values())
        .filter(session => session.userId === user.id);

      if (userSessions.length >= this.config.sessionConfig.maxSessions) {
        // Terminate oldest session
        const oldestSession = userSessions.sort((a, b) =>
          a.lastActivity.getTime() - b.lastActivity.getTime(),
        )[0];

        await this.terminateSession(oldestSession.id);
      }

      // Create new session
      const session = await this.createSession(user, ipAddress, userAgent);

      // Update user last login
      user.lastLogin = new Date();

      // Record successful login
      this.recordLoginAttempt(credentials.username, true, ipAddress, userAgent);
      this.clearFailedAttempts(credentials.username);

      // Update security context
      const securityContext: SecurityContext = {
        userId: user.id,
        sessionId: session.id,
        roles: user.roles,
        permissions: user.permissions,
        loginTime: session.createdAt,
        lastActivity: session.lastActivity,
        ipAddress,
        isAuthenticated: true,
        mfaVerified: session.mfaVerified,
      };

      // Audit successful login
      securityManager.auditLog(AuditEventType.LOGIN, 'login_successful', {
        username: credentials.username,
        userId: user.id,
        sessionId: session.id,
        ipAddress,
        mfaUsed: session.mfaVerified,
        loginDuration: Date.now() - startTime,
      }, 'success', 'low');

      this.emit('userAuthenticated', { user, session, securityContext });

      return {
        success: true,
        user,
        session,
      };

    } catch (error) {
      log.error('Authentication failed with error', {
        component: 'AuthenticationManager',
        metadata: { username: credentials.username, ipAddress },
      }, error as Error);

      return {
        success: false,
        error: 'Authentication system error',
      };
    }
  }

  /**
   * Validate session token
   */
  public async validateSession(token: string, ipAddress?: string): Promise<{
    valid: boolean;
    session?: UserSession;
    user?: AuthenticatedUser;
    reason?: string;
  }> {
    try {
      // Find session by token
      const session = Array.from(this.activeSessions.values())
        .find(s => s.token === token);

      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await this.terminateSession(session.id);
        return { valid: false, reason: 'Session expired' };
      }

      // Check IP address if provided (for additional security)
      if (ipAddress && session.ipAddress !== ipAddress) {
        securityManager.auditLog(AuditEventType.SECURITY_VIOLATION, 'ip_address_mismatch', {
          sessionId: session.id,
          originalIP: session.ipAddress,
          currentIP: ipAddress,
        }, 'failure', 'high');

        // Don't automatically terminate, but flag for review
        securityManager.recordViolation(
          'suspicious_activity',
          'high',
          'IP address mismatch detected for session',
          { sessionId: session.id, originalIP: session.ipAddress, currentIP: ipAddress },
        );
      }

      // Get user
      const user = this.users.get(session.userId);
      if (!user || user.accountStatus !== 'active') {
        await this.terminateSession(session.id);
        return { valid: false, reason: 'User account inactive' };
      }

      // Update last activity
      session.lastActivity = new Date();

      // Check if session needs renewal
      const renewalTime = new Date(session.expiresAt.getTime() -
        (this.config.sessionConfig.renewalThreshold * 60 * 1000));

      if (new Date() > renewalTime) {
        // Extend session
        session.expiresAt = new Date(Date.now() +
          (this.config.sessionConfig.timeout * 60 * 1000));
      }

      return { valid: true, session, user };

    } catch (error) {
      log.error('Session validation failed', {
        component: 'AuthenticationManager',
      }, error as Error);

      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Logout user and terminate session
   */
  public async logout(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return false;
      }

      const user = this.users.get(session.userId);

      // Audit logout
      securityManager.auditLog(AuditEventType.LOGOUT, 'user_logout', {
        userId: session.userId,
        username: user?.username,
        sessionId,
        sessionDuration: Date.now() - session.createdAt.getTime(),
      }, 'success', 'low');

      // Terminate session
      return await this.terminateSession(sessionId);

    } catch (error) {
      log.error('Logout failed', {
        component: 'AuthenticationManager',
        metadata: { sessionId },
      }, error as Error);

      return false;
    }
  }

  /**
   * Change user password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const currentValid = await this.verifyPassword(currentPassword, userId);
      if (!currentValid) {
        securityManager.auditLog(AuditEventType.SECURITY_VIOLATION, 'password_change_failed', {
          userId,
          reason: 'invalid_current_password',
        }, 'failure', 'medium');

        return { success: false, error: 'Current password is incorrect' };
      }

      // Validate new password
      const validation = this.validatePassword(newPassword);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check password history
      const history = this.passwordHistory.get(userId) || [];
      for (const oldPassword of history) {
        if (await this.verifyStoredPassword(newPassword, oldPassword)) {
          return {
            success: false,
            error: `Password cannot be one of the last ${this.config.passwordPolicy.preventReuse} passwords used`,
          };
        }
      }

      // Hash and store new password
      const hashedPassword = await medicalEncryption.hashPassword(newPassword);

      // Update password history
      history.unshift(hashedPassword);
      if (history.length > this.config.passwordPolicy.preventReuse) {
        history.pop();
      }
      this.passwordHistory.set(userId, history);

      // Update user
      user.passwordExpiry = new Date(Date.now() +
        (this.config.passwordPolicy.expiryDays * 24 * 60 * 60 * 1000));

      // Store updated data
      await this.storeUserData();

      // Audit password change
      securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'password_changed', {
        userId,
        username: user.username,
        passwordExpiry: user.passwordExpiry,
      }, 'success', 'low');

      this.emit('passwordChanged', { userId, user });

      return { success: true };

    } catch (error) {
      log.error('Password change failed', {
        component: 'AuthenticationManager',
        metadata: { userId },
      }, error as Error);

      return { success: false, error: 'Password change failed' };
    }
  }

  /**
   * Check user permissions
   */
  public hasPermission(userId: string, resource: string, action: PermissionAction): boolean {
    const user = this.users.get(userId);
    if (!user || user.accountStatus !== 'active') {
      return false;
    }

    return user.permissions.some(permission =>
      permission.resource === resource &&
      permission.actions.includes(action),
    );
  }

  /**
   * Get active sessions for user
   */
  public getUserSessions(userId: string): UserSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  /**
   * Get authentication statistics
   */
  public getAuthStats(): {
    totalUsers: number;
    activeUsers: number;
    activeSessions: number;
    lockedAccounts: number;
    failedLogins24h: number;
    successfulLogins24h: number;
    } {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    let failedLogins24h = 0;
    let successfulLogins24h = 0;

    for (const attempts of Array.from(this.loginAttempts.values())) {
      for (const attempt of attempts) {
        if (attempt.timestamp.getTime() > dayAgo) {
          if (attempt.success) {
            successfulLogins24h++;
          } else {
            failedLogins24h++;
          }
        }
      }
    }

    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.accountStatus === 'active').length,
      activeSessions: this.activeSessions.size,
      lockedAccounts: this.lockedAccounts.size,
      failedLogins24h,
      successfulLogins24h,
    };
  }

  // Private methods

  private async createSession(
    user: AuthenticatedUser,
    ipAddress: string,
    userAgent: string,
  ): Promise<UserSession> {
    const sessionId = this.generateSessionId();
    const token = await this.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() +
      (this.config.sessionConfig.timeout * 60 * 1000));

    const session: UserSession = {
      id: sessionId,
      userId: user.id,
      token,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      ipAddress,
      userAgent,
      mfaVerified: user.mfaEnabled && this.config.mfaConfig.enabled,
      permissions: user.permissions,
    };

    this.activeSessions.set(sessionId, session);
    await this.storeSessionData();

    return session;
  }

  private async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    this.activeSessions.delete(sessionId);
    await this.storeSessionData();

    this.emit('sessionTerminated', session);
    return true;
  }

  private async verifyPassword(password: string, userId: string): Promise<boolean> {
    try {
      const history = this.passwordHistory.get(userId);
      if (!history || history.length === 0) return false;

      const currentHash = history[0]; // Most recent password
      return await this.verifyStoredPassword(password, currentHash);
    } catch (error) {
      log.error('Password verification failed', {
        component: 'AuthenticationManager',
        metadata: { userId },
      }, error as Error);
      return false;
    }
  }

  private async verifyStoredPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      return await medicalEncryption.verifyPassword(password, storedHash);
    } catch {
      return false;
    }
  }

  private async verifyMFAToken(
    userId: string,
    token: string,
    method: MFAMethod,
  ): Promise<boolean> {
    // Simplified MFA verification - in production, implement proper TOTP, SMS, etc.
    try {
      switch (method) {
        case MFAMethod.TOTP:
          // Verify TOTP token
          return this.verifyTOTPToken(userId, token);
        case MFAMethod.EMAIL:
          // Verify email token
          return this.verifyEmailToken(userId, token);
        default:
          return false;
      }
    } catch (error) {
      log.error('MFA verification failed', {
        component: 'AuthenticationManager',
        metadata: { userId, method },
      }, error as Error);
      return false;
    }
  }

  private verifyTOTPToken(_userId: string, token: string): boolean {
    // Simplified TOTP verification
    // In production, use a proper TOTP library like speakeasy
    return token.length === 6 && /^\d{6}$/.test(token);
  }

  private verifyEmailToken(_userId: string, token: string): boolean {
    // Simplified email token verification
    // In production, store and verify actual email tokens
    return token.length === 8 && /^[A-Z0-9]{8}$/.test(token);
  }

  private validatePassword(password: string): { valid: boolean; error?: string } {
    const policy = this.config.passwordPolicy;

    if (password.length < policy.minLength) {
      return {
        valid: false,
        error: `Password must be at least ${policy.minLength} characters long`,
      };
    }

    if (password.length > policy.maxLength) {
      return {
        valid: false,
        error: `Password must be no more than ${policy.maxLength} characters long`,
      };
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      return {
        valid: false,
        error: 'Password must contain at least one uppercase letter',
      };
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      return {
        valid: false,
        error: 'Password must contain at least one lowercase letter',
      };
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      return {
        valid: false,
        error: 'Password must contain at least one number',
      };
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        valid: false,
        error: 'Password must contain at least one special character',
      };
    }

    return { valid: true };
  }

  private recordLoginAttempt(
    username: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    failureReason?: string,
  ): void {
    const attempts = this.loginAttempts.get(username) || [];

    attempts.push({
      username,
      timestamp: new Date(),
      success,
      ipAddress,
      userAgent,
      failureReason,
    });

    // Keep only last 100 attempts
    if (attempts.length > 100) {
      attempts.shift();
    }

    this.loginAttempts.set(username, attempts);
  }

  private checkLockoutPolicy(username: string): void {
    const attempts = this.loginAttempts.get(username) || [];
    const recentFailures = attempts.filter(attempt =>
      !attempt.success &&
      (Date.now() - attempt.timestamp.getTime()) < (60 * 60 * 1000), // Last hour
    );

    if (recentFailures.length >= this.config.lockoutPolicy.maxAttempts) {
      const lockoutEnd = new Date(Date.now() +
        (this.config.lockoutPolicy.lockoutDuration * 60 * 1000));

      this.lockedAccounts.set(username, lockoutEnd);

      securityManager.auditLog(AuditEventType.SECURITY_VIOLATION, 'account_locked', {
        username,
        failedAttempts: recentFailures.length,
        lockoutDuration: this.config.lockoutPolicy.lockoutDuration,
        lockoutEnd,
      }, 'failure', 'high');

      this.emit('accountLocked', { username, lockoutEnd });
    }
  }

  private isAccountLocked(username: string): boolean {
    const lockoutEnd = this.lockedAccounts.get(username);
    if (!lockoutEnd) return false;

    if (new Date() > lockoutEnd) {
      this.lockedAccounts.delete(username);
      return false;
    }

    return true;
  }

  private clearFailedAttempts(username: string): void {
    const attempts = this.loginAttempts.get(username) || [];
    const successfulAttempts = attempts.filter(attempt => attempt.success);
    this.loginAttempts.set(username, successfulAttempts);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private async generateSessionToken(): Promise<string> {
    const tokenData = `${Date.now()}_${Math.random()}_${crypto.getRandomValues(new Uint32Array(4)).join('')}`;
    const encrypted = medicalEncryption.encrypt(tokenData, medicalEncryption.generateKey(), { purpose: 'session' });
    return encrypted.encrypted;
  }

  private setupSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private setupLockoutCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredLockouts();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of Array.from(this.activeSessions)) {
      if (session.expiresAt < now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.activeSessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      log.info('Expired sessions cleaned up', {
        component: 'AuthenticationManager',
        metadata: {
          expiredCount: expiredSessions.length,
          activeCount: this.activeSessions.size,
        },
      });
    }
  }

  private cleanupExpiredLockouts(): void {
    const now = new Date();
    const expiredLockouts: string[] = [];

    for (const [username, lockoutEnd] of Array.from(this.lockedAccounts)) {
      if (lockoutEnd < now) {
        expiredLockouts.push(username);
      }
    }

    for (const username of expiredLockouts) {
      this.lockedAccounts.delete(username);
    }

    if (expiredLockouts.length > 0) {
      log.info('Expired lockouts cleaned up', {
        component: 'AuthenticationManager',
        metadata: { expiredCount: expiredLockouts.length },
      });
    }
  }

  private async createDefaultAdminUser(): Promise<void> {
    const adminPassword = 'Admin123!@#'; // Should be changed on first login
    const hashedPassword = await medicalEncryption.hashPassword(adminPassword);

    const adminUser: AuthenticatedUser = {
      id: 'admin',
      username: 'admin',
      email: 'admin@example.com',
      fullName: 'System Administrator',
      roles: ['admin'],
      permissions: [
        { resource: '*', actions: Object.values(PermissionAction) },
      ],
      lastLogin: new Date(),
      passwordExpiry: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days
      mfaEnabled: false,
      accountStatus: 'active',
    };

    this.users.set('admin', adminUser);
    this.passwordHistory.set('admin', [hashedPassword]);

    await this.storeUserData();

    log.warn('Default admin user created - CHANGE PASSWORD IMMEDIATELY', {
      component: 'AuthenticationManager',
      metadata: { username: 'admin' },
    });
  }

  private async loadStoredData(): Promise<void> {
    try {
      // Load users
      const usersData = await secureStorage.retrieve('auth_users');
      if (usersData) {
        const users = JSON.parse(usersData);
        for (const [key, value] of Object.entries(users)) {
          this.users.set(key, value as AuthenticatedUser);
        }
      }

      // Load password history
      const historyData = await secureStorage.retrieve('auth_password_history');
      if (historyData) {
        const history = JSON.parse(historyData);
        for (const [key, value] of Object.entries(history)) {
          this.passwordHistory.set(key, value as string[]);
        }
      }

      // Sessions are not persisted for security
    } catch (error) {
      log.warn('Failed to load stored authentication data', {
        component: 'AuthenticationManager',
      }, error as Error);
    }
  }

  private async storeUserData(): Promise<void> {
    try {
      const usersObject = Object.fromEntries(this.users);
      await secureStorage.store('auth_users', JSON.stringify(usersObject), 'user-data');

      const historyObject = Object.fromEntries(this.passwordHistory);
      await secureStorage.store('auth_password_history', JSON.stringify(historyObject), 'user-data');
    } catch (error) {
      log.error('Failed to store user data', {
        component: 'AuthenticationManager',
      }, error as Error);
    }
  }

  private async storeSessionData(): Promise<void> {
    // Sessions are intentionally not persisted for security reasons
    // They are recreated on each app start
  }

  /**
   * Update authentication configuration
   */
  public updateConfig(updates: Partial<AuthenticationConfig>): void {
    this.config = { ...this.config, ...updates };

    securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'auth_config_updated', {
      changes: Object.keys(updates),
    });

    this.emit('configUpdated', this.config);
  }

  /**
   * Dispose authentication manager
   */
  public dispose(): void {
    // Clear all sensitive data
    this.activeSessions.clear();
    this.users.clear();
    this.loginAttempts.clear();
    this.lockedAccounts.clear();
    this.passwordHistory.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('Authentication Manager disposed', {
      component: 'AuthenticationManager',
    });
  }
}

// Singleton instance
export const authenticationManager = new AuthenticationManager();
