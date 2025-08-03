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
  type UserCredentials,
  type UserSession,
  type AuthenticationResult,
  type SessionValidationResult,
} from './authentication';

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

    log.info('Medical security subsystem initialized', {
      component: 'SecuritySubsystem',
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
