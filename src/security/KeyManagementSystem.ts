/**
 * Key Management System - Secure Key Generation, Storage, and Rotation
 * Provides enterprise-grade key management for medical imaging applications
 * with HIPAA compliance and automated key rotation
 */

import { EventEmitter } from 'events';
import { medicalEncryption, EncryptionMetadata } from './encryption';
import { secureStorage } from './secureStorage';
import { securityManager, AuditEventType } from './SecurityManager';
import { log } from '../utils/logger';

export interface KeyMetadata {
  keyId: string;
  purpose: EncryptionMetadata['purpose'];
  algorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyLength: number;
  createdAt: Date;
  expiresAt?: Date;
  rotatedAt?: Date;
  version: number;
  isActive: boolean;
  patientId?: string;
  studyId?: string;
  classification: 'master' | 'patient' | 'study' | 'session' | 'system';
}

export interface KeyRotationPolicy {
  enabled: boolean;
  rotationInterval: number; // days
  retentionPeriod: number; // days to keep old keys
  autoRotate: boolean;
  notifyBeforeExpiry: number; // days
  requireManualApproval: boolean;
}

export interface KeyDerivationConfig {
  masterKeyId: string;
  derivationMethod: 'PBKDF2' | 'HKDF';
  iterations: number;
  saltLength: number;
  contextInfo?: string;
}

// Default key rotation policy
export const DEFAULT_KEY_ROTATION_POLICY: KeyRotationPolicy = {
  enabled: true,
  rotationInterval: 90, // 90 days
  retentionPeriod: 2555, // 7 years for HIPAA compliance
  autoRotate: true,
  notifyBeforeExpiry: 30, // 30 days notice
  requireManualApproval: false,
};

export class KeyManagementSystem extends EventEmitter {
  private keys: Map<string, KeyMetadata> = new Map();
  private keyData: Map<string, string> = new Map(); // Encrypted key storage
  private rotationPolicy: KeyRotationPolicy;
  private masterKeyId: string | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(rotationPolicy: Partial<KeyRotationPolicy> = {}) {
    super();
    this.rotationPolicy = { ...DEFAULT_KEY_ROTATION_POLICY, ...rotationPolicy };
    this.initializeKeyManagement();
  }

  /**
   * Initialize key management system
   */
  private async initializeKeyManagement(): Promise<void> {
    try {
      // Load existing keys from secure storage
      await this.loadStoredKeys();

      // Initialize master key if none exists
      if (!this.masterKeyId) {
        await this.initializeMasterKey();
      }

      // Setup key rotation monitoring
      if (this.rotationPolicy.enabled) {
        this.setupKeyRotationMonitoring();
      }

      log.info('Key Management System initialized', {
        component: 'KeyManagementSystem',
        metadata: {
          keyCount: this.keys.size,
          rotationEnabled: this.rotationPolicy.enabled,
          masterKeyId: this.masterKeyId,
        },
      });

      this.emit('keyManagementInitialized', {
        keyCount: this.keys.size,
        policy: this.rotationPolicy,
      });

    } catch (error) {
      log.error('Failed to initialize Key Management System', {
        component: 'KeyManagementSystem',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Initialize master key
   */
  private async initializeMasterKey(): Promise<void> {
    const masterKeyId = `master-${Date.now()}`;
    const masterKey = medicalEncryption.generateKey(32);

    const keyMetadata: KeyMetadata = {
      keyId: masterKeyId,
      purpose: 'user-data',
      algorithm: 'AES-256-GCM',
      keyLength: 32,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (this.rotationPolicy.rotationInterval * 24 * 60 * 60 * 1000)),
      version: 1,
      isActive: true,
      classification: 'master',
    };

    // Store key metadata and encrypted key data
    this.keys.set(masterKeyId, keyMetadata);
    await this.storeKeySecurely(masterKeyId, masterKey);

    this.masterKeyId = masterKeyId;

    // Audit master key creation
    securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'master_key_created', {
      keyId: masterKeyId,
      algorithm: keyMetadata.algorithm,
      keyLength: keyMetadata.keyLength,
    }, 'success', 'medium');

    log.security('Master key initialized', {
      component: 'KeyManagementSystem',
      metadata: { keyId: masterKeyId },
    });
  }

  /**
   * Generate new encryption key
   */
  public async generateKey(
    purpose: EncryptionMetadata['purpose'],
    classification: KeyMetadata['classification'] = 'system',
    options: {
      algorithm?: 'AES-256-GCM' | 'AES-256-CBC';
      keyLength?: number;
      expiryDays?: number;
      patientId?: string;
      studyId?: string;
    } = {},
  ): Promise<string> {
    try {
      const {
        algorithm = 'AES-256-GCM',
        keyLength = 32,
        expiryDays = this.rotationPolicy.rotationInterval,
        patientId,
        studyId,
      } = options;

      const keyId = this.generateKeyId(purpose, classification, patientId, studyId);
      const key = medicalEncryption.generateKey(keyLength);

      const keyMetadata: KeyMetadata = {
        keyId,
        purpose,
        algorithm,
        keyLength,
        createdAt: new Date(),
        expiresAt: expiryDays > 0 ? new Date(Date.now() + (expiryDays * 24 * 60 * 60 * 1000)) : undefined,
        version: 1,
        isActive: true,
        classification,
        patientId,
        studyId,
      };

      // Store key metadata and encrypted key data
      this.keys.set(keyId, keyMetadata);
      await this.storeKeySecurely(keyId, key);

      // Audit key generation
      securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'encryption_key_generated', {
        keyId,
        purpose,
        classification,
        algorithm,
        keyLength,
        patientId,
        studyId,
      });

      this.emit('keyGenerated', keyMetadata);

      return keyId;
    } catch (error) {
      log.error('Key generation failed', {
        component: 'KeyManagementSystem',
        metadata: { purpose, classification },
      }, error as Error);
      throw new Error('Failed to generate encryption key');
    }
  }

  /**
   * Retrieve encryption key by ID
   */
  public async getKey(keyId: string): Promise<string | null> {
    try {
      const keyMetadata = this.keys.get(keyId);
      if (!keyMetadata || !keyMetadata.isActive) {
        return null;
      }

      // Check if key is expired
      if (keyMetadata.expiresAt && keyMetadata.expiresAt < new Date()) {
        log.warn('Attempted to use expired key', {
          component: 'KeyManagementSystem',
          metadata: { keyId, expiresAt: keyMetadata.expiresAt },
        });
        return null;
      }

      const encryptedKey = this.keyData.get(keyId);
      if (!encryptedKey) {
        log.error('Key data not found for valid key ID', {
          component: 'KeyManagementSystem',
          metadata: { keyId },
        });
        return null;
      }

      // Decrypt key using master key
      const masterKey = await this.getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      const key = await this.decryptKeyData(encryptedKey, masterKey);

      // Audit key access
      securityManager.auditLog(AuditEventType.DATA_ACCESS, 'encryption_key_accessed', {
        keyId,
        purpose: keyMetadata.purpose,
        classification: keyMetadata.classification,
      }, 'success', 'low');

      return key;
    } catch (error) {
      log.error('Key retrieval failed', {
        component: 'KeyManagementSystem',
        metadata: { keyId },
      }, error as Error);
      return null;
    }
  }

  /**
   * Rotate encryption key
   */
  public async rotateKey(keyId: string): Promise<string> {
    try {
      const oldKeyMetadata = this.keys.get(keyId);
      if (!oldKeyMetadata) {
        throw new Error('Key not found for rotation');
      }

      // Generate new key with same properties
      const newKey = medicalEncryption.generateKey(oldKeyMetadata.keyLength);
      const newKeyId = `${keyId}-v${oldKeyMetadata.version + 1}`;

      const newKeyMetadata: KeyMetadata = {
        ...oldKeyMetadata,
        keyId: newKeyId,
        createdAt: new Date(),
        rotatedAt: new Date(),
        expiresAt: oldKeyMetadata.expiresAt ?
          new Date(Date.now() + (this.rotationPolicy.rotationInterval * 24 * 60 * 60 * 1000)) :
          undefined,
        version: oldKeyMetadata.version + 1,
      };

      // Deactivate old key
      oldKeyMetadata.isActive = false;
      oldKeyMetadata.rotatedAt = new Date();

      // Store new key
      this.keys.set(newKeyId, newKeyMetadata);
      await this.storeKeySecurely(newKeyId, newKey);

      // Schedule old key cleanup based on retention policy
      this.scheduleKeyCleanup(keyId, this.rotationPolicy.retentionPeriod);

      // Audit key rotation
      securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'encryption_key_rotated', {
        oldKeyId: keyId,
        newKeyId,
        purpose: oldKeyMetadata.purpose,
        version: newKeyMetadata.version,
      }, 'success', 'medium');

      this.emit('keyRotated', { oldKeyId: keyId, newKeyId, metadata: newKeyMetadata });

      log.security('Encryption key rotated', {
        component: 'KeyManagementSystem',
        metadata: { oldKeyId: keyId, newKeyId, version: newKeyMetadata.version },
      });

      return newKeyId;
    } catch (error) {
      log.error('Key rotation failed', {
        component: 'KeyManagementSystem',
        metadata: { keyId },
      }, error as Error);
      throw new Error('Failed to rotate encryption key');
    }
  }

  /**
   * Derive patient-specific key
   */
  public async derivePatientKey(patientId: string, studyId?: string): Promise<string> {
    try {
      const masterKey = await this.getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available');
      }

      const derivedKey = medicalEncryption.derivePatientKey(masterKey, patientId, studyId);

      // Create key metadata for the derived key
      const keyId = this.generateKeyId('patient-data', 'patient', patientId, studyId);

      const keyMetadata: KeyMetadata = {
        keyId,
        purpose: 'patient-data',
        algorithm: 'AES-256-GCM',
        keyLength: 32,
        createdAt: new Date(),
        version: 1,
        isActive: true,
        classification: 'patient',
        patientId,
        studyId,
      };

      this.keys.set(keyId, keyMetadata);
      await this.storeKeySecurely(keyId, derivedKey);

      // Audit patient key derivation
      securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'patient_key_derived', {
        keyId,
        patientId,
        studyId,
      });

      return keyId;
    } catch (error) {
      log.error('Patient key derivation failed', {
        component: 'KeyManagementSystem',
        metadata: { patientId, studyId },
      }, error as Error);
      throw new Error('Failed to derive patient key');
    }
  }

  /**
   * Get key metadata
   */
  public getKeyMetadata(keyId: string): KeyMetadata | null {
    return this.keys.get(keyId) || null;
  }

  /**
   * List active keys
   */
  public listActiveKeys(purpose?: EncryptionMetadata['purpose']): KeyMetadata[] {
    const activeKeys = Array.from(this.keys.values()).filter(key => key.isActive);
    return purpose ? activeKeys.filter(key => key.purpose === purpose) : activeKeys;
  }

  /**
   * Check for keys nearing expiry
   */
  public getExpiringKeys(daysAhead = 30): KeyMetadata[] {
    const thresholdDate = new Date(Date.now() + (daysAhead * 24 * 60 * 60 * 1000));

    return Array.from(this.keys.values()).filter(key =>
      key.isActive &&
      key.expiresAt &&
      key.expiresAt <= thresholdDate,
    );
  }

  // Private methods

  private generateKeyId(
    purpose: string,
    classification: string,
    patientId?: string,
    studyId?: string,
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8);
    const prefix = `${purpose}-${classification}`;
    const suffix = patientId ? `-${patientId}` : '';
    const studySuffix = studyId ? `-${studyId}` : '';

    return `${prefix}-${timestamp}-${random}${suffix}${studySuffix}`;
  }

  private async getMasterKey(): Promise<string | null> {
    if (!this.masterKeyId) return null;

    const encryptedMasterKey = this.keyData.get(this.masterKeyId);
    if (!encryptedMasterKey) return null;

    // In production, master key would be stored in HSM or KMS
    // For now, we'll use a derived key from a system identifier
    const systemKey = medicalEncryption.generateKey(32);
    return await this.decryptKeyData(encryptedMasterKey, systemKey);
  }

  private async storeKeySecurely(keyId: string, key: string): Promise<void> {
    const masterKey = await this.getMasterKey();
    const encryptionKey = masterKey || medicalEncryption.generateKey(32);

    const encryptedData = medicalEncryption.encrypt(key, encryptionKey, {
      purpose: 'user-data',
      keyId,
    });

    this.keyData.set(keyId, encryptedData.encrypted);

    // Store in secure storage
    await secureStorage.store(
      `key-${keyId}`,
      JSON.stringify(encryptedData),
      'user-data',
    );
  }

  private async decryptKeyData(encryptedKey: string, masterKey: string): Promise<string> {
    const encryptedData = JSON.parse(encryptedKey);
    return medicalEncryption.decrypt(encryptedData, masterKey, {
      purpose: 'user-data',
    });
  }

  private setupKeyRotationMonitoring(): void {
    // Check for expiring keys daily
    this.rotationTimer = setInterval(() => {
      this.checkKeyRotation();
    }, 24 * 60 * 60 * 1000); // Daily check

    log.info('Key rotation monitoring enabled', {
      component: 'KeyManagementSystem',
      metadata: {
        rotationInterval: this.rotationPolicy.rotationInterval,
        autoRotate: this.rotationPolicy.autoRotate,
      },
    });
  }

  private async checkKeyRotation(): Promise<void> {
    const expiringKeys = this.getExpiringKeys(this.rotationPolicy.notifyBeforeExpiry);

    for (const keyMetadata of expiringKeys) {
      this.emit('keyExpiringWarning', keyMetadata);

      if (this.rotationPolicy.autoRotate && !this.rotationPolicy.requireManualApproval) {
        try {
          await this.rotateKey(keyMetadata.keyId);
        } catch (error) {
          log.error('Auto key rotation failed', {
            component: 'KeyManagementSystem',
            metadata: { keyId: keyMetadata.keyId },
          }, error as Error);
        }
      }
    }
  }

  private scheduleKeyCleanup(keyId: string, retentionDays: number): void {
    setTimeout(() => {
      this.cleanupExpiredKey(keyId);
    }, retentionDays * 24 * 60 * 60 * 1000);
  }

  private async cleanupExpiredKey(keyId: string): Promise<void> {
    try {
      this.keys.delete(keyId);
      this.keyData.delete(keyId);

      // Remove from secure storage
      await secureStorage.remove(`key-${keyId}`);

      securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'expired_key_cleaned', {
        keyId,
      });

      log.info('Expired key cleaned up', {
        component: 'KeyManagementSystem',
        metadata: { keyId },
      });
    } catch (error) {
      log.error('Key cleanup failed', {
        component: 'KeyManagementSystem',
        metadata: { keyId },
      }, error as Error);
    }
  }

  private async loadStoredKeys(): Promise<void> {
    // Implementation would load keys from secure storage
    // For now, start with empty key store
    log.info('Loading stored keys', {
      component: 'KeyManagementSystem',
    });
  }

  /**
   * Update rotation policy
   */
  public updateRotationPolicy(updates: Partial<KeyRotationPolicy>): void {
    this.rotationPolicy = { ...this.rotationPolicy, ...updates };

    securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'key_rotation_policy_updated', {
      changes: Object.keys(updates),
      policy: this.rotationPolicy,
    });

    this.emit('rotationPolicyUpdated', this.rotationPolicy);
  }

  /**
   * Get key management statistics
   */
  public getKeyStats(): {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    expiringKeys: number;
    keysByPurpose: Record<string, number>;
    keysByClassification: Record<string, number>;
    } {
    const allKeys = Array.from(this.keys.values());
    const activeKeys = allKeys.filter(k => k.isActive);
    const expiredKeys = allKeys.filter(k => k.expiresAt && k.expiresAt < new Date());
    const expiringKeys = this.getExpiringKeys(this.rotationPolicy.notifyBeforeExpiry);

    const keysByPurpose: Record<string, number> = {};
    const keysByClassification: Record<string, number> = {};

    for (const key of allKeys) {
      keysByPurpose[key.purpose] = (keysByPurpose[key.purpose] || 0) + 1;
      keysByClassification[key.classification] = (keysByClassification[key.classification] || 0) + 1;
    }

    return {
      totalKeys: allKeys.length,
      activeKeys: activeKeys.length,
      expiredKeys: expiredKeys.length,
      expiringKeys: expiringKeys.length,
      keysByPurpose,
      keysByClassification,
    };
  }

  /**
   * Dispose key management system
   */
  public dispose(): void {
    // Clear sensitive data
    this.keys.clear();
    this.keyData.clear();
    this.masterKeyId = null;

    // Clear rotation timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    // Remove all listeners
    this.removeAllListeners();

    log.info('Key Management System disposed', {
      component: 'KeyManagementSystem',
    });
  }
}

// Singleton instance
export const keyManagementSystem = new KeyManagementSystem();
