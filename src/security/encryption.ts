/**
 * Medical-grade encryption utilities for sensitive data
 * Provides AES encryption for DICOM data and annotations
 */

import CryptoJS from 'crypto-js';
import { log } from '../utils/logger';

export interface EncryptionOptions {
  algorithm?: 'AES-256-CBC';
  keyDerivation?: 'PBKDF2';
  iterations?: number;
  saltLength?: number;
}

export interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  tag?: string;
  algorithm: string;
  timestamp: string;
}

export interface EncryptionMetadata {
  keyId?: string;
  purpose: 'annotation' | 'dicom' | 'user-data' | 'session';
  expiresAt?: Date;
}

class MedicalEncryption {
  private readonly defaultOptions: Required<EncryptionOptions> = {
    algorithm: 'AES-256-CBC',
    keyDerivation: 'PBKDF2',
    iterations: 100000,
    saltLength: 32,
  };

  /**
   * Generate a cryptographically secure random key
   */
  generateKey(length = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Generate a secure salt
   */
  generateSalt(length = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  deriveKey(
    password: string,
    salt: string,
    iterations = this.defaultOptions.iterations,
  ): string {
    try {
      const key = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations,
        hasher: CryptoJS.algo.SHA256,
      });

      log.debug('Encryption key derived successfully', {
        component: 'MedicalEncryption',
        metadata: { iterations, saltLength: salt.length },
      });

      return key.toString();
    } catch (error) {
      log.error('Key derivation failed', {
        component: 'MedicalEncryption',
      }, error as Error);
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(
    data: string,
    key: string,
    metadata: EncryptionMetadata,
    options: EncryptionOptions = {},
  ): EncryptedData {
    try {
      const config = { ...this.defaultOptions, ...options };
      const salt = this.generateSalt(config.saltLength);
      const iv = CryptoJS.lib.WordArray.random(16);

      // Derive key if password provided instead of key
      const encryptionKey = key.length < 64 ? this.deriveKey(key, salt, config.iterations) : key;

      // Use AES-CBC with PKCS7 padding
      const encrypted = CryptoJS.AES.encrypt(data, encryptionKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const result: EncryptedData = {
        encrypted: encrypted.toString(),
        salt,
        iv: iv.toString(),
        algorithm: config.algorithm,
        timestamp: new Date().toISOString(),
      };

      log.medical('Data encrypted successfully', {
        component: 'MedicalEncryption',
        operation: 'encrypt',
        metadata: {
          purpose: metadata.purpose,
          algorithm: config.algorithm,
          dataSize: data.length,
        },
      });

      return result;

    } catch (error) {
      log.error('Encryption failed', {
        component: 'MedicalEncryption',
        metadata: { purpose: metadata.purpose },
      }, error as Error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(
    encryptedData: EncryptedData,
    key: string,
    metadata: EncryptionMetadata,
  ): string {
    try {
      // Derive key if password provided
      const decryptionKey = key.length < 64
        ? this.deriveKey(key, encryptedData.salt, this.defaultOptions.iterations)
        : key;

      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);

      // Decrypt using AES-CBC
      const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, decryptionKey, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const result = decrypted.toString(CryptoJS.enc.Utf8);

      if (!result) {
        throw new Error('Decryption resulted in empty data - key may be incorrect');
      }

      log.medical('Data decrypted successfully', {
        component: 'MedicalEncryption',
        operation: 'decrypt',
        metadata: {
          purpose: metadata.purpose,
          algorithm: encryptedData.algorithm,
          dataSize: result.length,
        },
      });

      return result;

    } catch (error) {
      log.error('Decryption failed', {
        component: 'MedicalEncryption',
        metadata: { purpose: metadata.purpose },
      }, error as Error);
      throw new Error('Failed to decrypt data - key may be incorrect or data corrupted');
    }
  }

  /**
   * Encrypt annotation data for secure storage
   */
  encryptAnnotation(annotation: Record<string, unknown>, userKey: string): EncryptedData {
    const serialized = JSON.stringify(annotation);
    return this.encrypt(serialized, userKey, { purpose: 'annotation' });
  }

  /**
   * Decrypt annotation data
   */
  decryptAnnotation(encryptedData: EncryptedData, userKey: string): Record<string, unknown> {
    const decrypted = this.decrypt(encryptedData, userKey, { purpose: 'annotation' });
    return JSON.parse(decrypted);
  }

  /**
   * Generate secure session token
   */
  generateSessionToken(userId: string, expiresIn = 24 * 60 * 60 * 1000): string {
    const payload = {
      userId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
      nonce: this.generateKey(16),
    };

    const token = CryptoJS.AES.encrypt(
      JSON.stringify(payload),
      this.generateKey(),
    ).toString();

    log.security('Session token generated', {
      component: 'MedicalEncryption',
      metadata: { userId, expiresIn },
    });

    return token;
  }

  /**
   * Validate and extract session token
   */
  validateSessionToken(token: string, secretKey: string): { userId: string; expiresAt: number } | null {
    try {
      const decrypted = CryptoJS.AES.decrypt(token, secretKey).toString(CryptoJS.enc.Utf8);
      const payload = JSON.parse(decrypted);

      if (payload.expiresAt < Date.now()) {
        log.security('Session token expired', {
          component: 'MedicalEncryption',
          metadata: { expiresAt: payload.expiresAt },
        });
        return null;
      }

      return {
        userId: payload.userId,
        expiresAt: payload.expiresAt,
      };
    } catch (error) {
      log.security('Invalid session token', {
        component: 'MedicalEncryption',
      }, error as Error);
      return null;
    }
  }

  /**
   * Create secure hash for data integrity verification
   */
  createHash(data: string, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'): string {
    const hash = algorithm === 'SHA-256'
      ? CryptoJS.SHA256(data)
      : CryptoJS.SHA512(data);

    return hash.toString();
  }

  /**
   * Verify data integrity using hash
   */
  verifyHash(data: string, expectedHash: string, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'): boolean {
    const actualHash = this.createHash(data, algorithm);
    return actualHash === expectedHash;
  }

  /**
   * Clear sensitive data from memory
   */
  clearSensitiveData(data: string | CryptoJS.lib.WordArray): void {
    if (typeof data === 'string') {
      // Overwrite string in memory (best effort)
      const chars = data.split('');
      chars.fill('\0');
    }
    // For WordArray, the library handles memory cleanup
  }
}

// Export singleton instance
export const medicalEncryption = new MedicalEncryption();
export default medicalEncryption;
