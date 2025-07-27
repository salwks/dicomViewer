/**
 * Secure storage implementation for medical data
 * Provides encrypted storage with automatic key management
 */

import { medicalEncryption, EncryptedData, EncryptionMetadata } from './encryption';
import { log } from '../utils/logger';

export interface SecureStorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  expireAfter?: number; // milliseconds
  keyId?: string;
}

export interface StoredData {
  encrypted?: EncryptedData;
  plain?: string;
  metadata: {
    purpose: string;
    timestamp: string;
    expiresAt?: string;
    compressed?: boolean;
    encrypted: boolean;
  };
}

class SecureStorage {
  private keyStore = new Map<string, string>();
  private readonly storagePrefix = 'cs3d-secure-';

  /**
   * Initialize secure storage with master key
   */
  initialize(masterKey: string): void {
    try {
      // Store master key securely (in production, use hardware security module)
      this.keyStore.set('master', masterKey);

      log.security('Secure storage initialized', {
        component: 'SecureStorage',
        metadata: { hasKey: !!masterKey },
      });
    } catch (error) {
      log.error('Failed to initialize secure storage', {
        component: 'SecureStorage',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Generate and store a new encryption key
   */
  generateKey(keyId: string): string {
    const key = medicalEncryption.generateKey();
    this.keyStore.set(keyId, key);

    log.security('Encryption key generated', {
      component: 'SecureStorage',
      metadata: { keyId },
    });

    return key;
  }

  /**
   * Store data securely
   */
  async store(
    key: string,
    data: string,
    purpose: string,
    options: SecureStorageOptions = {},
  ): Promise<void> {
    try {
      const {
        encrypt = true,
        compress = false,
        expireAfter,
        keyId = 'master',
      } = options;

      let processedData = data;

      // Compress if requested
      if (compress) {
        // Simple compression - in production use proper compression
        processedData = this.compressData(processedData);
      }

      const storedData: StoredData = {
        metadata: {
          purpose,
          timestamp: new Date().toISOString(),
          compressed: compress,
          encrypted: encrypt,
        },
      };

      if (expireAfter) {
        storedData.metadata.expiresAt = new Date(Date.now() + expireAfter).toISOString();
      }

      // Encrypt if requested
      if (encrypt) {
        const encryptionKey = this.keyStore.get(keyId);
        if (!encryptionKey) {
          throw new Error(`Encryption key not found: ${keyId}`);
        }

        const metadata: EncryptionMetadata = {
          purpose: purpose as any,
          keyId,
          expiresAt: storedData.metadata.expiresAt ? new Date(storedData.metadata.expiresAt) : undefined,
        };

        storedData.encrypted = medicalEncryption.encrypt(processedData, encryptionKey, metadata);
      } else {
        storedData.plain = processedData;
      }

      // Store in localStorage with prefix
      const storageKey = this.storagePrefix + key;
      localStorage.setItem(storageKey, JSON.stringify(storedData));

      log.medical('Data stored securely', {
        component: 'SecureStorage',
        operation: 'store',
        metadata: {
          key,
          purpose,
          encrypted: encrypt,
          compressed: compress,
          size: data.length,
        },
      });

    } catch (error) {
      log.error('Failed to store data securely', {
        component: 'SecureStorage',
        metadata: { key, purpose },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Retrieve data securely
   */
  async retrieve(key: string): Promise<string | null> {
    try {
      const storageKey = this.storagePrefix + key;
      const storedJson = localStorage.getItem(storageKey);

      if (!storedJson) {
        return null;
      }

      const storedData: StoredData = JSON.parse(storedJson);

      // Check expiration
      if (storedData.metadata.expiresAt) {
        const expiresAt = new Date(storedData.metadata.expiresAt);
        if (expiresAt < new Date()) {
          log.security('Stored data expired, removing', {
            component: 'SecureStorage',
            metadata: { key, expiresAt: storedData.metadata.expiresAt },
          });
          await this.remove(key);
          return null;
        }
      }

      let data: string;

      // Decrypt if encrypted
      if (storedData.metadata.encrypted && storedData.encrypted) {
        const keyId = 'master'; // In production, extract from metadata
        const encryptionKey = this.keyStore.get(keyId);

        if (!encryptionKey) {
          throw new Error(`Encryption key not found: ${keyId}`);
        }

        const metadata: EncryptionMetadata = {
          purpose: storedData.metadata.purpose as any,
        };

        data = medicalEncryption.decrypt(storedData.encrypted, encryptionKey, metadata);
      } else if (storedData.plain) {
        data = storedData.plain;
      } else {
        throw new Error('Invalid stored data format');
      }

      // Decompress if compressed
      if (storedData.metadata.compressed) {
        data = this.decompressData(data);
      }

      log.medical('Data retrieved securely', {
        component: 'SecureStorage',
        operation: 'retrieve',
        metadata: {
          key,
          purpose: storedData.metadata.purpose,
          encrypted: storedData.metadata.encrypted,
          compressed: storedData.metadata.compressed,
        },
      });

      return data;

    } catch (error) {
      log.error('Failed to retrieve data securely', {
        component: 'SecureStorage',
        metadata: { key },
      }, error as Error);
      throw error;
    }
  }

  /**
   * Remove stored data
   */
  async remove(key: string): Promise<void> {
    try {
      const storageKey = this.storagePrefix + key;
      localStorage.removeItem(storageKey);

      log.medical('Secure data removed', {
        component: 'SecureStorage',
        operation: 'remove',
        metadata: { key },
      });
    } catch (error) {
      log.error('Failed to remove secure data', {
        component: 'SecureStorage',
        metadata: { key },
      }, error as Error);
      throw error;
    }
  }

  /**
   * List all stored keys
   */
  async listKeys(): Promise<string[]> {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        keys.push(key.substring(this.storagePrefix.length));
      }
    }

    return keys;
  }

  /**
   * Clear all secure storage
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.listKeys();

      for (const key of keys) {
        await this.remove(key);
      }

      log.security('Secure storage cleared', {
        component: 'SecureStorage',
        metadata: { removedCount: keys.length },
      });
    } catch (error) {
      log.error('Failed to clear secure storage', {
        component: 'SecureStorage',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Store encrypted annotation data
   */
  async storeAnnotation(
    annotationId: string,
    annotation: Record<string, unknown>,
    options: SecureStorageOptions = {},
  ): Promise<void> {
    const serialized = JSON.stringify(annotation);
    await this.store(`annotation-${annotationId}`, serialized, 'annotation', {
      encrypt: true,
      ...options,
    });
  }

  /**
   * Retrieve encrypted annotation data
   */
  async retrieveAnnotation(annotationId: string): Promise<Record<string, unknown> | null> {
    const data = await this.retrieve(`annotation-${annotationId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Store user session data securely
   */
  async storeSession(
    sessionId: string,
    sessionData: Record<string, unknown>,
    expireAfter = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    const serialized = JSON.stringify(sessionData);
    await this.store(`session-${sessionId}`, serialized, 'session', {
      encrypt: true,
      expireAfter,
    });
  }

  /**
   * Retrieve user session data
   */
  async retrieveSession(sessionId: string): Promise<Record<string, unknown> | null> {
    const data = await this.retrieve(`session-${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Simple data compression (placeholder)
   */
  private compressData(data: string): string {
    // In production, use proper compression library like pako
    try {
      return btoa(data);
    } catch {
      return data;
    }
  }

  /**
   * Simple data decompression (placeholder)
   */
  private decompressData(data: string): string {
    // In production, use proper decompression
    try {
      return atob(data);
    } catch {
      return data;
    }
  }

  /**
   * Get storage statistics
   */
  getStatistics(): {
    totalKeys: number;
    encryptedKeys: number;
    totalSize: number;
    oldestEntry?: string;
    newestEntry?: string;
    } {
    let totalKeys = 0;
    let encryptedKeys = 0;
    let totalSize = 0;
    let oldestDate = new Date();
    let newestDate = new Date(0);
    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        totalKeys++;
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;

          try {
            const data: StoredData = JSON.parse(value);
            if (data.metadata.encrypted) {
              encryptedKeys++;
            }

            const timestamp = new Date(data.metadata.timestamp);
            if (timestamp < oldestDate) {
              oldestDate = timestamp;
              oldestEntry = key.substring(this.storagePrefix.length);
            }
            if (timestamp > newestDate) {
              newestDate = timestamp;
              newestEntry = key.substring(this.storagePrefix.length);
            }
          } catch {
            // Ignore invalid JSON
          }
        }
      }
    }

    return {
      totalKeys,
      encryptedKeys,
      totalSize,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const keys = await this.listKeys();
    let removedCount = 0;

    for (const key of keys) {
      try {
        const storageKey = this.storagePrefix + key;
        const storedJson = localStorage.getItem(storageKey);

        if (storedJson) {
          const storedData: StoredData = JSON.parse(storedJson);

          if (storedData.metadata.expiresAt) {
            const expiresAt = new Date(storedData.metadata.expiresAt);
            if (expiresAt < new Date()) {
              await this.remove(key);
              removedCount++;
            }
          }
        }
      } catch (error) {
        log.warn('Failed to check expiration for key', {
          component: 'SecureStorage',
          metadata: { key },
        }, error as Error);
      }
    }

    if (removedCount > 0) {
      log.info(`Cleaned up ${removedCount} expired entries`, {
        component: 'SecureStorage',
        metadata: { removedCount },
      });
    }

    return removedCount;
  }
}

// Export singleton instance
export const secureStorage = new SecureStorage();
export default secureStorage;
