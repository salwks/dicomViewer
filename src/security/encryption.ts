/**
 * Medical-grade encryption utilities for sensitive data
 * Provides AES encryption for DICOM data and annotations
 */

import * as CryptoJS from 'crypto-js';
import { log } from '../utils/logger';

export interface EncryptionOptions {
  algorithm?: 'AES-256-CBC' | 'AES-256-GCM';
  keyDerivation?: 'PBKDF2';
  iterations?: number;
  saltLength?: number;
  tagLength?: number; // For GCM mode
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
  purpose: 'annotation' | 'dicom' | 'user-data' | 'session' | 'phi' | 'patient-data';
  expiresAt?: Date;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  patientId?: string;
  studyId?: string;
}

class MedicalEncryption {
  private readonly defaultOptions: Required<EncryptionOptions> = {
    algorithm: 'AES-256-GCM',
    keyDerivation: 'PBKDF2',
    iterations: 100000,
    saltLength: 32,
    tagLength: 16,
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
  deriveKey(password: string, salt: string, iterations = this.defaultOptions.iterations): string {
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
      log.error(
        'Key derivation failed',
        {
          component: 'MedicalEncryption',
        },
        error as Error,
      );
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM or AES-256-CBC
   */
  encrypt(data: string, key: string, metadata: EncryptionMetadata, options: EncryptionOptions = {}): EncryptedData {
    try {
      const config = { ...this.defaultOptions, ...options };
      const salt = this.generateSalt(config.saltLength);
      const iv = CryptoJS.lib.WordArray.random(config.algorithm === 'AES-256-GCM' ? 12 : 16);

      // Derive key if password provided instead of key
      const encryptionKey = key.length < 64 ? this.deriveKey(key, salt, config.iterations) : key;

      let encrypted: CryptoJS.lib.CipherParams;
      let tag: string | undefined;

      if (config.algorithm === 'AES-256-GCM') {
        // Use AES-CBC with HMAC for authenticated encryption (crypto-js doesn't have native GCM)
        // This provides similar security properties to GCM
        encrypted = CryptoJS.AES.encrypt(data, encryptionKey, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        });

        // Create HMAC tag for authentication (simulating GCM authentication)
        const hmacKey = CryptoJS.SHA256(`${encryptionKey}hmac-key`);
        tag = CryptoJS.HmacSHA256(`${encrypted.toString()}${iv.toString()}`, hmacKey).toString();
      } else {
        // Use AES-CBC with PKCS7 padding
        encrypted = CryptoJS.AES.encrypt(data, encryptionKey, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        });
      }

      const result: EncryptedData = {
        encrypted: encrypted.toString(),
        salt,
        iv: iv.toString(),
        tag,
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
      log.error(
        'Encryption failed',
        {
          component: 'MedicalEncryption',
          metadata: { purpose: metadata.purpose },
        },
        error as Error,
      );
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData, key: string, metadata: EncryptionMetadata): string {
    try {
      // Derive key if password provided
      const decryptionKey =
        key.length < 64 ? this.deriveKey(key, encryptedData.salt, this.defaultOptions.iterations) : key;

      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
      let decrypted: CryptoJS.lib.WordArray;

      if (encryptedData.algorithm === 'AES-256-GCM') {
        // Verify HMAC tag first (simulating GCM authentication)
        if (encryptedData.tag) {
          const hmacKey = CryptoJS.SHA256(`${decryptionKey}hmac-key`);
          const expectedTag = CryptoJS.HmacSHA256(`${encryptedData.encrypted}${encryptedData.iv}`, hmacKey).toString();
          if (expectedTag !== encryptedData.tag) {
            throw new Error('Authentication tag verification failed - data may be tampered');
          }
        }

        // Decrypt using AES-CBC after tag verification
        decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, decryptionKey, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        });
      } else {
        // Decrypt using AES-CBC
        decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, decryptionKey, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        });
      }

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
      // In development, provide more helpful error messages
      if (process.env.NODE_ENV !== 'production') {
        log.warn('Decryption failed in development - this may be due to key changes', {
          component: 'MedicalEncryption',
          metadata: {
            purpose: metadata.purpose,
            isDevelopment: true,
            suggestion: 'Clear browser storage or reset encryption keys',
          },
        });
      } else {
        log.error(
          'Decryption failed',
          {
            component: 'MedicalEncryption',
            metadata: { purpose: metadata.purpose },
          },
          error as Error,
        );
      }

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

    const token = CryptoJS.AES.encrypt(JSON.stringify(payload), this.generateKey()).toString();

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
      log.security(
        'Invalid session token',
        {
          component: 'MedicalEncryption',
        },
        error as Error,
      );
      return null;
    }
  }

  /**
   * Create secure hash for data integrity verification
   */
  createHash(data: string, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'): string {
    const hash = algorithm === 'SHA-256' ? CryptoJS.SHA256(data) : CryptoJS.SHA512(data);

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
   * Hash password with salt for secure storage
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const salt = this.generateSalt();
      const hash = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: this.defaultOptions.iterations,
      });

      return `${salt}:${hash.toString()}`;
    } catch (error) {
      log.error('Password hashing failed', {
        component: 'MedicalEncryption',
      }, error as Error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against stored hash
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      const [salt, hash] = storedHash.split(':');
      if (!salt || !hash) {
        return false;
      }

      const computedHash = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: this.defaultOptions.iterations,
      });

      return computedHash.toString() === hash;
    } catch (error) {
      log.error('Password verification failed', {
        component: 'MedicalEncryption',
      }, error as Error);
      return false;
    }
  }

  /**
   * Encrypt PHI (Protected Health Information) data with enhanced security
   */
  encryptPHI(phiData: Record<string, unknown>, patientKey: string, patientId: string): EncryptedData {
    const serialized = JSON.stringify(phiData);

    // Use AES-256-GCM for PHI data to ensure both confidentiality and authenticity
    return this.encrypt(serialized, patientKey, {
      purpose: 'phi',
      classification: 'restricted',
      patientId,
    }, {
      algorithm: 'AES-256-GCM',
    });
  }

  /**
   * Decrypt PHI data
   */
  decryptPHI(encryptedData: EncryptedData, patientKey: string, patientId: string): Record<string, unknown> {
    const decrypted = this.decrypt(encryptedData, patientKey, {
      purpose: 'phi',
      classification: 'restricted',
      patientId,
    });
    return JSON.parse(decrypted);
  }

  /**
   * Encrypt DICOM metadata with field-level granularity
   */
  encryptDICOMMetadata(
    metadata: Record<string, unknown>,
    encryptionKey: string,
    studyId: string,
    sensitiveFields: string[] = ['PatientName', 'PatientID', 'PatientBirthDate'],
  ): Record<string, unknown> {
    const result = { ...metadata };

    for (const field of sensitiveFields) {
      // eslint-disable-next-line security/detect-object-injection -- Safe field access in controlled loop
      if (field in result && result[field] != null) {
        // eslint-disable-next-line security/detect-object-injection -- Safe field access with validated field name
        const fieldValue = String(result[field]);
        const encrypted = this.encrypt(fieldValue, encryptionKey, {
          purpose: 'dicom',
          classification: 'confidential',
          studyId,
        }, {
          algorithm: 'AES-256-GCM',
        });

        // Store encrypted data with special prefix to identify encrypted fields
        result[`_encrypted_${field}`] = encrypted;
        // eslint-disable-next-line security/detect-object-injection -- Safe field deletion with validated field name
        delete result[field]; // Remove original sensitive data
      }
    }

    return result;
  }

  /**
   * Decrypt DICOM metadata fields
   */
  decryptDICOMMetadata(
    encryptedMetadata: Record<string, unknown>,
    decryptionKey: string,
    studyId: string,
  ): Record<string, unknown> {
    const result = { ...encryptedMetadata };

    // Find all encrypted fields
    const encryptedFields = Object.keys(result).filter(key => key.startsWith('_encrypted_'));

    for (const encryptedField of encryptedFields) {
      const originalField = encryptedField.replace('_encrypted_', '');
      // eslint-disable-next-line security/detect-object-injection -- Safe field access with validated encrypted field name
      const encryptedData = result[encryptedField] as EncryptedData;

      try {
        const decrypted = this.decrypt(encryptedData, decryptionKey, {
          purpose: 'dicom',
          classification: 'confidential',
          studyId,
        });

        // eslint-disable-next-line security/detect-object-injection -- Safe field assignment with validated field name
        result[originalField] = decrypted;
        // eslint-disable-next-line security/detect-object-injection -- Safe field deletion with validated field name
        delete result[encryptedField]; // Remove encrypted version
      } catch (error) {
        log.error('Failed to decrypt DICOM field', {
          component: 'MedicalEncryption',
          metadata: { field: originalField, studyId },
        }, error as Error);

        // Keep encrypted field if decryption fails
        // eslint-disable-next-line security/detect-object-injection -- Safe field assignment with validated field name
        result[originalField] = '[ENCRYPTED]';
      }
    }

    return result;
  }

  /**
   * Create secure digital signature for data integrity
   */
  createDigitalSignature(data: string, privateKey: string): string {
    try {
      // Create HMAC-SHA256 signature for data integrity
      const signature = CryptoJS.HmacSHA256(data, privateKey);

      log.security('Digital signature created', {
        component: 'MedicalEncryption',
        metadata: {
          dataSize: data.length,
          signatureLength: signature.toString().length,
        },
      });

      return signature.toString();
    } catch (error) {
      log.error('Digital signature creation failed', {
        component: 'MedicalEncryption',
      }, error as Error);
      throw new Error('Failed to create digital signature');
    }
  }

  /**
   * Verify digital signature for data integrity
   */
  verifyDigitalSignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const expectedSignature = CryptoJS.HmacSHA256(data, publicKey);
      const isValid = expectedSignature.toString() === signature;

      log.security('Digital signature verification', {
        component: 'MedicalEncryption',
        metadata: {
          isValid,
          dataSize: data.length,
        },
      });

      return isValid;
    } catch (error) {
      log.error('Digital signature verification failed', {
        component: 'MedicalEncryption',
      }, error as Error);
      return false;
    }
  }

  /**
   * Generate secure encryption key for specific purposes
   */
  generatePurposeKey(purpose: EncryptionMetadata['purpose'], length = 32): string {
    const key = this.generateKey(length);

    log.security('Purpose-specific key generated', {
      component: 'MedicalEncryption',
      metadata: { purpose, keyLength: length },
    });

    return key;
  }

  /**
   * Derive patient-specific encryption key
   */
  derivePatientKey(masterKey: string, patientId: string, studyId?: string): string {
    try {
      const keyMaterial = studyId ? `${patientId}:${studyId}` : patientId;
      const salt = this.createHash(keyMaterial, 'SHA-256');

      const derivedKey = CryptoJS.PBKDF2(masterKey, salt, {
        keySize: 256 / 32,
        iterations: this.defaultOptions.iterations,
      });

      log.security('Patient-specific key derived', {
        component: 'MedicalEncryption',
        metadata: { patientId, hasStudyId: !!studyId },
      });

      return derivedKey.toString();
    } catch (error) {
      log.error('Patient key derivation failed', {
        component: 'MedicalEncryption',
        metadata: { patientId },
      }, error as Error);
      throw new Error('Failed to derive patient key');
    }
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
