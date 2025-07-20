import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import { debugLogger } from "../utils/debug-logger";
import { CryptoUtils, SecureStorage } from "../utils/crypto";
import { XSSProtection, sanitizeUserComment } from "../utils/xss-protection";

// Security event types
export interface SecurityEvent {
  id: string;
  type: 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED' | 'FILE_ACCESS' | 'TOOL_USAGE' | 'EXPORT' | 'ERROR';
  timestamp: number;
  userId?: string;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
}

// User session information
export interface UserSession {
  id: string;
  userId: string;
  username: string;
  role: 'ADMIN' | 'RADIOLOGIST' | 'TECHNICIAN' | 'VIEWER';
  permissions: string[];
  loginTime: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

// Security settings
export interface SecuritySettings {
  sessionTimeout: number; // in minutes
  maxFailedAttempts: number;
  requireStrongPassword: boolean;
  enableAuditLogging: boolean;
  enableEncryption: boolean;
  allowedFileTypes: string[];
  maxFileSize: number; // in MB
  enableExportLogging: boolean;
}

// Security store state interface
export interface SecurityStoreState {
  // Authentication state
  isAuthenticated: boolean;
  currentUser: UserSession | null;
  loginAttempts: number;
  isLocked: boolean;
  lockoutTime: number | null;

  // Security events and logging
  securityEvents: SecurityEvent[];
  maxEventHistory: number;

  // Security settings
  settings: SecuritySettings;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuthentication: () => boolean;
  updateLastActivity: () => void;
  checkSessionTimeout: () => void;
  
  // Permission management
  hasPermission: (permission: string) => boolean;
  checkFileAccess: (fileName: string) => boolean;
  checkToolAccess: (toolName: string) => boolean;
  
  // Security logging
  logSecurityEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => void;
  getSecurityEvents: (type?: SecurityEvent['type']) => SecurityEvent[];
  clearSecurityEvents: () => void;
  
  // Security settings
  updateSettings: (settings: Partial<SecuritySettings>) => void;
  resetSettings: () => void;
  
  // Utility functions
  encryptData: (data: string) => Promise<string>;
  decryptData: (encryptedData: string) => Promise<string>;
  generateSecurityReport: () => string;
  initializeEncryption: () => Promise<void>;
}

// Default security settings
const defaultSettings: SecuritySettings = {
  sessionTimeout: 30, // 30 minutes
  maxFailedAttempts: 3,
  requireStrongPassword: true,
  enableAuditLogging: true,
  enableEncryption: true,
  allowedFileTypes: ['.dcm', '.dicom', '.nii', '.nii.gz', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif'],
  maxFileSize: 500, // 500MB
  enableExportLogging: true,
};

// Mock user database (in real app, this would be server-side)
const mockUsers = {
  'admin': { password: 'admin123', role: 'ADMIN' as const, permissions: ['*'] },
  'radiologist': { password: 'radio123', role: 'RADIOLOGIST' as const, permissions: ['view', 'measure', 'export'] },
  'technician': { password: 'tech123', role: 'TECHNICIAN' as const, permissions: ['view', 'measure'] },
  'viewer': { password: 'view123', role: 'VIEWER' as const, permissions: ['view'] },
};

export const useSecurityStore = create<SecurityStoreState>()(
  persist(
    subscribeWithSelector((set, get) => ({
    // Initial state
    isAuthenticated: false,
    currentUser: null,
    loginAttempts: 0,
    isLocked: false,
    lockoutTime: null,
    securityEvents: [],
    maxEventHistory: 1000,
    settings: defaultSettings,

    // Authentication actions
    login: async (username: string, password: string) => {
      const state = get();
      
      // Basic input validation (less strict for login)
      if (!username || !password) {
        console.log('🔐 Login failed: empty credentials');
        return false;
      }
      
      // XSS Protection: Light sanitization for login (preserve original values)
      const sanitizedUsername = username.trim();
      const sanitizedPassword = password; // Don't sanitize password to avoid breaking it
      
      // Validate inputs for suspicious patterns (but allow login to proceed)
      const usernameValidation = XSSProtection.validateInput(username);
      const passwordValidation = XSSProtection.validateInput(password);
      
      if (!usernameValidation.isValid || !passwordValidation.isValid) {
        console.warn('🔐 XSS validation warning:', {
          usernameValid: usernameValidation.isValid,
          passwordValid: passwordValidation.isValid,
          usernameReason: usernameValidation.reason,
          passwordReason: passwordValidation.reason
        });
        
        get().logSecurityEvent({
          type: 'ACCESS_DENIED',
          details: `XSS attempt detected in login credentials`,
          severity: 'HIGH',
          metadata: { 
            usernameInvalid: !usernameValidation.isValid,
            passwordInvalid: !passwordValidation.isValid,
            usernameReason: usernameValidation.reason,
            passwordReason: passwordValidation.reason
          }
        });
        
        // For demo purposes, allow login to proceed with warning
        console.warn('🔐 Proceeding with login despite XSS warning (demo mode)');
      }
      
      // Use lightly sanitized values for further processing
      const cleanUsername = sanitizedUsername;
      const cleanPassword = sanitizedPassword;
      
      console.log('🔐 Login attempt:', {
        originalUsername: username,
        sanitizedUsername: cleanUsername,
        lookupKey: cleanUsername.toLowerCase(),
        availableUsers: Object.keys(mockUsers),
        passwordLength: cleanPassword.length
      });
      
      // Check if account is locked
      if (state.isLocked && state.lockoutTime) {
        const now = Date.now();
        if (now < state.lockoutTime) {
          const remainingTime = Math.ceil((state.lockoutTime - now) / 60000);
          get().logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `Login attempt blocked - account locked for ${remainingTime} minutes`,
            severity: 'HIGH',
            metadata: { username: cleanUsername, reason: 'account_locked' }
          });
          return false;
        } else {
          // Unlock account
          set({ isLocked: false, lockoutTime: null, loginAttempts: 0 });
        }
      }

      // Validate credentials (case-insensitive username lookup)
      const lookupKey = cleanUsername.toLowerCase();
      const user = mockUsers[lookupKey as keyof typeof mockUsers];
      
      console.log('🔐 User lookup:', {
        lookupKey,
        userFound: !!user,
        passwordMatch: user ? user.password === cleanPassword : false,
        expectedPassword: user?.password,
        actualPassword: cleanPassword
      });
      
      if (!user || user.password !== cleanPassword) {
        const newAttempts = state.loginAttempts + 1;
        
        console.log('🔐 Login failed:', {
          reason: !user ? 'User not found' : 'Password mismatch',
          attempts: newAttempts,
          maxAttempts: state.settings.maxFailedAttempts
        });
        
        get().logSecurityEvent({
          type: 'ACCESS_DENIED',
          details: `Failed login attempt for user: ${cleanUsername}`,
          severity: 'MEDIUM',
          metadata: { username: cleanUsername, attempts: newAttempts }
        });

        if (newAttempts >= state.settings.maxFailedAttempts) {
          const lockoutTime = Date.now() + (15 * 60 * 1000); // 15 minutes
          set({ 
            isLocked: true, 
            lockoutTime, 
            loginAttempts: newAttempts 
          });
          
          console.log('🔐 Account locked due to excessive failed attempts');
          
          get().logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: `Account locked due to excessive failed attempts`,
            severity: 'HIGH',
            metadata: { username: cleanUsername, lockoutTime }
          });
        } else {
          set({ loginAttempts: newAttempts });
        }
        
        return false;
      }

      // Create user session
      const userSession: UserSession = {
        id: `session_${Date.now()}`,
        userId: cleanUsername,
        username: cleanUsername,
        role: user.role,
        permissions: user.permissions,
        loginTime: Date.now(),
        lastActivity: Date.now(),
        ipAddress: 'localhost', // Would be real IP in production
        userAgent: navigator.userAgent,
      };

      console.log('🔐 Creating user session:', {
        userId: userSession.userId,
        role: userSession.role,
        permissions: userSession.permissions
      });

      set({
        isAuthenticated: true,
        currentUser: userSession,
        loginAttempts: 0,
        isLocked: false,
        lockoutTime: null,
      });
      
      console.log('🔐 User session created successfully');

      get().logSecurityEvent({
        type: 'LOGIN',
        userId: cleanUsername,
        details: `User logged in successfully`,
        severity: 'LOW',
        metadata: { role: user.role, loginTime: userSession.loginTime }
      });

      // Initialize encryption system after successful login
      await get().initializeEncryption();

      debugLogger.success(`User ${cleanUsername} logged in successfully`);
      return true;
    },

    logout: () => {
      const state = get();
      if (state.currentUser) {
        get().logSecurityEvent({
          type: 'LOGOUT',
          userId: state.currentUser.userId,
          details: `User logged out`,
          severity: 'LOW',
          metadata: { 
            sessionDuration: Date.now() - state.currentUser.loginTime,
            logoutTime: Date.now()
          }
        });
      }

      set({
        isAuthenticated: false,
        currentUser: null,
      });

      debugLogger.log('User logged out');
    },

    checkAuthentication: () => {
      const state = get();
      if (!state.isAuthenticated || !state.currentUser) {
        console.log('🔐 checkAuthentication: Not authenticated or no user');
        return false;
      }

      // Check session timeout
      get().checkSessionTimeout();
      const newState = get();
      console.log('🔐 checkAuthentication: After timeout check, isAuthenticated =', newState.isAuthenticated);
      return newState.isAuthenticated;
    },

    updateLastActivity: () => {
      const state = get();
      if (state.currentUser) {
        set({
          currentUser: {
            ...state.currentUser,
            lastActivity: Date.now(),
          }
        });
      }
    },

    checkSessionTimeout: () => {
      const state = get();
      if (!state.currentUser) return;

      const now = Date.now();
      const sessionAge = now - state.currentUser.lastActivity;
      const timeoutMs = state.settings.sessionTimeout * 60 * 1000;

      console.log('🔐 Session timeout check:', {
        sessionAge: sessionAge,
        timeoutMs: timeoutMs,
        lastActivity: new Date(state.currentUser.lastActivity).toISOString(),
        now: new Date(now).toISOString()
      });

      if (sessionAge > timeoutMs) {
        console.log('🔐 Session expired, logging out user');
        get().logSecurityEvent({
          type: 'LOGOUT',
          userId: state.currentUser.userId,
          details: `Session expired due to inactivity`,
          severity: 'LOW',
          metadata: { 
            sessionAge: sessionAge,
            timeoutMs: timeoutMs
          }
        });

        set({
          isAuthenticated: false,
          currentUser: null,
        });

        debugLogger.warn('Session expired due to inactivity');
      } else {
        console.log('🔐 Session still valid');
        // Update last activity to current time on successful check
        get().updateLastActivity();
      }
    },

    // Permission management
    hasPermission: (permission: string) => {
      const state = get();
      if (!state.currentUser) return false;
      
      return state.currentUser.permissions.includes('*') || 
             state.currentUser.permissions.includes(permission);
    },

    checkFileAccess: (fileName: string) => {
      const state = get();
      if (!get().checkAuthentication()) return false;

      // XSS Protection: Sanitize and validate file name
      const sanitizedFileName = XSSProtection.sanitizeFileName(fileName);
      const validation = XSSProtection.validateInput(fileName);
      
      if (!validation.isValid) {
        get().logSecurityEvent({
          type: 'ACCESS_DENIED',
          userId: state.currentUser?.userId,
          details: `Malicious file name detected: ${validation.reason}`,
          severity: 'HIGH',
          metadata: { 
            originalFileName: fileName.substring(0, 100),
            reason: validation.reason
          }
        });
        return false;
      }

      const fileExt = sanitizedFileName.toLowerCase().substring(sanitizedFileName.lastIndexOf('.'));
      const isAllowed = state.settings.allowedFileTypes.includes(fileExt);

      if (!isAllowed) {
        get().logSecurityEvent({
          type: 'ACCESS_DENIED',
          userId: state.currentUser?.userId,
          details: `Blocked file access: ${sanitizedFileName} (unauthorized file type)`,
          severity: 'MEDIUM',
          metadata: { 
            originalFileName: fileName,
            sanitizedFileName,
            fileType: fileExt 
          }
        });
      } else {
        get().logSecurityEvent({
          type: 'FILE_ACCESS',
          userId: state.currentUser?.userId,
          details: `File accessed: ${sanitizedFileName}`,
          severity: 'LOW',
          metadata: { 
            originalFileName: fileName,
            sanitizedFileName,
            fileType: fileExt 
          }
        });
      }

      return isAllowed;
    },

    checkToolAccess: (toolName: string) => {
      const state = get();
      
      // First check authentication
      if (!get().checkAuthentication()) {
        console.warn(`[Security] Tool access denied: not authenticated`);
        return false;
      }

      // Check if we have a current user
      if (!state.currentUser) {
        console.warn(`[Security] Tool access denied: no current user`);
        return false;
      }

      // XSS Protection: Sanitize and validate tool name
      const sanitizedToolName = XSSProtection.sanitizeStrict(toolName);
      const validation = XSSProtection.validateInput(toolName);
      
      if (!validation.isValid) {
        console.warn(`[Security] Tool name validation failed: ${validation.reason}`);
        get().logSecurityEvent({
          type: 'ACCESS_DENIED',
          userId: state.currentUser?.userId,
          details: `Malicious tool name detected: ${validation.reason}`,
          severity: 'HIGH',
          metadata: { 
            originalToolName: toolName.substring(0, 100),
            reason: validation.reason
          }
        });
        return false;
      }

      // Define tool categories and required permissions
      const basicTools = ['Pan', 'Zoom', 'WindowLevel', 'StackScroll', 'Magnify'];
      const measurementTools = ['Length', 'Angle', 'CobbAngle', 'Bidirectional', 'RectangleROI', 'EllipticalROI', 'CircleROI', 'PlanarFreehandROI', 'SplineROI', 'ArrowAnnotate', 'Probe'];
      
      let hasAccess = false;
      let requiredPermission = '';
      
      if (basicTools.includes(sanitizedToolName)) {
        // Basic tools require 'view' permission
        requiredPermission = 'view';
        hasAccess = get().hasPermission('view') || get().hasPermission('*');
      } else if (measurementTools.includes(sanitizedToolName)) {
        // Measurement tools require 'measure' permission
        requiredPermission = 'measure';
        hasAccess = get().hasPermission('measure') || get().hasPermission('*');
      } else {
        // Unknown tools require admin permission
        requiredPermission = '*';
        hasAccess = get().hasPermission('*');
      }
      
      // Debug logging
      console.log(`[Security] Tool access check:`, {
        toolName: sanitizedToolName,
        userRole: state.currentUser?.role,
        userPermissions: state.currentUser?.permissions,
        requiredPermission,
        hasAccess
      });
      
      if (!hasAccess) {
        console.warn(`[Security] Tool access denied: insufficient permissions`);
        get().logSecurityEvent({
          type: 'ACCESS_DENIED',
          userId: state.currentUser?.userId,
          details: `Blocked tool access: ${sanitizedToolName} (insufficient permissions)`,
          severity: 'MEDIUM',
          metadata: { 
            originalToolName: toolName,
            sanitizedToolName, 
            userRole: state.currentUser?.role,
            userPermissions: state.currentUser?.permissions,
            requiredPermission
          }
        });
      } else {
        console.log(`[Security] Tool access granted: ${sanitizedToolName}`);
        get().logSecurityEvent({
          type: 'TOOL_USAGE',
          userId: state.currentUser?.userId,
          details: `Tool accessed: ${sanitizedToolName}`,
          severity: 'LOW',
          metadata: { 
            originalToolName: toolName,
            sanitizedToolName
          }
        });
      }

      return hasAccess;
    },

    // Security logging
    logSecurityEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
      const state = get();
      const securityEvent: SecurityEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...event,
      };

      let newEvents = [...state.securityEvents, securityEvent];
      
      // Keep only the latest events within the limit
      if (newEvents.length > state.maxEventHistory) {
        newEvents = newEvents.slice(-state.maxEventHistory);
      }

      set({ securityEvents: newEvents });

      // Log to console if audit logging is enabled
      if (state.settings.enableAuditLogging) {
        console.log(`[SECURITY] ${event.type}: ${event.details}`, event.metadata);
      }
    },

    getSecurityEvents: (type?: SecurityEvent['type']) => {
      const state = get();
      if (!type) return state.securityEvents;
      return state.securityEvents.filter(event => event.type === type);
    },

    clearSecurityEvents: () => {
      get().logSecurityEvent({
        type: 'ACCESS_DENIED',
        details: 'Security events cleared',
        severity: 'LOW',
        metadata: { action: 'clear_events' }
      });
      
      set({ securityEvents: [] });
    },

    // Security settings
    updateSettings: (newSettings: Partial<SecuritySettings>) => {
      const state = get();
      const updatedSettings = { ...state.settings, ...newSettings };
      
      set({ settings: updatedSettings });
      
      get().logSecurityEvent({
        type: 'ACCESS_DENIED',
        userId: state.currentUser?.userId,
        details: 'Security settings updated',
        severity: 'LOW',
        metadata: { changes: Object.keys(newSettings) }
      });
    },

    resetSettings: () => {
      set({ settings: defaultSettings });
      
      get().logSecurityEvent({
        type: 'ACCESS_DENIED',
        details: 'Security settings reset to defaults',
        severity: 'LOW',
        metadata: { action: 'reset_settings' }
      });
    },

    // Encryption initialization
    initializeEncryption: async () => {
      const state = get();
      if (state.settings.enableEncryption) {
        try {
          await SecureStorage.initialize();
          get().logSecurityEvent({
            type: 'ACCESS_DENIED',
            details: 'Encryption system initialized',
            severity: 'LOW',
            metadata: { action: 'encryption_init' }
          });
        } catch (error) {
          get().logSecurityEvent({
            type: 'ERROR',
            details: `Encryption initialization failed: ${error}`,
            severity: 'HIGH',
            metadata: { error: error?.toString() }
          });
          console.error('Failed to initialize encryption:', error);
        }
      }
    },

    // Utility functions
    encryptData: async (data: string) => {
      const state = get();
      if (!state.settings.enableEncryption) return data;
      
      try {
        const password = 'security_key_' + (state.currentUser?.id || 'default');
        const result = await CryptoUtils.encryptForStorage(data, password);
        return JSON.stringify(result);
      } catch (error) {
        get().logSecurityEvent({
          type: 'ERROR',
          details: `Data encryption failed: ${error}`,
          severity: 'HIGH',
          metadata: { error: error?.toString() }
        });
        console.error('Encryption failed:', error);
        return data;
      }
    },

    decryptData: async (encryptedData: string) => {
      const state = get();
      if (!state.settings.enableEncryption) return encryptedData;
      
      try {
        const password = 'security_key_' + (state.currentUser?.id || 'default');
        const encryptedObj = JSON.parse(encryptedData);
        return await CryptoUtils.decryptFromStorage(
          encryptedObj.encrypted,
          encryptedObj.salt,
          encryptedObj.iv,
          password
        );
      } catch (error) {
        get().logSecurityEvent({
          type: 'ERROR',
          details: `Data decryption failed: ${error}`,
          severity: 'HIGH',
          metadata: { error: error?.toString() }
        });
        console.error('Decryption failed:', error);
        return encryptedData;
      }
    },

    generateSecurityReport: () => {
      const state = get();
      const now = new Date();
      const events = state.securityEvents;
      
      const report = {
        reportDate: now.toISOString(),
        totalEvents: events.length,
        eventsByType: events.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        eventsBySeverity: events.reduce((acc, event) => {
          acc[event.severity] = (acc[event.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentEvents: events.slice(-10),
        currentUser: state.currentUser,
        settings: state.settings,
      };

      return JSON.stringify(report, null, 2);
    },
  })),
  {
    name: 'security-store',
    partialize: (state) => ({
      isAuthenticated: state.isAuthenticated,
      currentUser: state.currentUser,
      loginAttempts: state.loginAttempts,
      isLocked: state.isLocked,
      lockoutTime: state.lockoutTime,
      settings: state.settings,
    }),
  }
));

// Selectors for better performance
export const selectIsAuthenticated = (state: SecurityStoreState) => state.isAuthenticated;
export const selectCurrentUser = (state: SecurityStoreState) => state.currentUser;
export const selectSecurityEvents = (state: SecurityStoreState) => state.securityEvents;
export const selectSecuritySettings = (state: SecurityStoreState) => state.settings;