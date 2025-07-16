/**
 * Crypto utilities for data encryption and decryption
 * Uses Web Crypto API for secure cryptographic operations
 */

export class CryptoUtils {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM

  /**
   * Generate a new cryptographic key
   */
  static async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export a key to raw format
   */
  static async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await window.crypto.subtle.exportKey('raw', key);
  }

  /**
   * Import a key from raw format
   */
  static async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using AES-GCM
   */
  static async encrypt(data: string, key: CryptoKey): Promise<{
    encryptedData: ArrayBuffer;
    iv: Uint8Array;
  }> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate a random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      dataBuffer
    );

    return { encryptedData, iv };
  }

  /**
   * Decrypt data using AES-GCM
   */
  static async decrypt(
    encryptedData: ArrayBuffer,
    iv: Uint8Array,
    key: CryptoKey
  ): Promise<string> {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Hash data using SHA-256
   */
  static async hash(data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    return await window.crypto.subtle.digest('SHA-256', dataBuffer);
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Generate a secure random string
   */
  static generateRandomString(length: number = 32): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derive key from password using PBKDF2
   */
  static async deriveKeyFromPassword(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive the actual key
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data for storage
   */
  static async encryptForStorage(data: any, password: string): Promise<{
    encrypted: string;
    salt: string;
    iv: string;
  }> {
    // Generate salt and derive key from password
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKeyFromPassword(password, salt);

    // Encrypt the data
    const dataString = JSON.stringify(data);
    const { encryptedData, iv } = await this.encrypt(dataString, key);

    return {
      encrypted: this.arrayBufferToBase64(encryptedData),
      salt: this.arrayBufferToBase64(salt.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
    };
  }

  /**
   * Decrypt data from storage
   */
  static async decryptFromStorage(
    encrypted: string,
    salt: string,
    iv: string,
    password: string
  ): Promise<any> {
    // Reconstruct salt and IV
    const saltBuffer = new Uint8Array(this.base64ToArrayBuffer(salt));
    const ivBuffer = new Uint8Array(this.base64ToArrayBuffer(iv));

    // Derive key from password
    const key = await this.deriveKeyFromPassword(password, saltBuffer);

    // Decrypt the data
    const encryptedBuffer = this.base64ToArrayBuffer(encrypted);
    const decryptedString = await this.decrypt(encryptedBuffer, ivBuffer, key);

    return JSON.parse(decryptedString);
  }
}

/**
 * Secure session storage wrapper with encryption
 */
export class SecureStorage {
  private static readonly STORAGE_KEY_PREFIX = 'secure_';
  private static masterKey: CryptoKey | null = null;

  /**
   * Initialize secure storage with a master key
   */
  static async initialize(password?: string): Promise<void> {
    if (password) {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      this.masterKey = await CryptoUtils.deriveKeyFromPassword(password, salt);
    } else {
      this.masterKey = await CryptoUtils.generateKey();
    }
  }

  /**
   * Store encrypted data
   */
  static async setItem(key: string, value: any): Promise<void> {
    if (!this.masterKey) {
      await this.initialize();
    }

    const dataString = JSON.stringify(value);
    const { encryptedData, iv } = await CryptoUtils.encrypt(dataString, this.masterKey!);

    const storageData = {
      data: CryptoUtils.arrayBufferToBase64(encryptedData),
      iv: CryptoUtils.arrayBufferToBase64(iv.buffer),
      timestamp: Date.now(),
    };

    sessionStorage.setItem(
      this.STORAGE_KEY_PREFIX + key,
      JSON.stringify(storageData)
    );
  }

  /**
   * Retrieve and decrypt data
   */
  static async getItem(key: string): Promise<any> {
    if (!this.masterKey) {
      return null;
    }

    const storedData = sessionStorage.getItem(this.STORAGE_KEY_PREFIX + key);
    if (!storedData) {
      return null;
    }

    try {
      const { data, iv } = JSON.parse(storedData);
      const encryptedBuffer = CryptoUtils.base64ToArrayBuffer(data);
      const ivBuffer = new Uint8Array(CryptoUtils.base64ToArrayBuffer(iv));

      const decryptedString = await CryptoUtils.decrypt(
        encryptedBuffer,
        ivBuffer,
        this.masterKey
      );

      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Failed to decrypt stored data:', error);
      return null;
    }
  }

  /**
   * Remove encrypted data
   */
  static removeItem(key: string): void {
    sessionStorage.removeItem(this.STORAGE_KEY_PREFIX + key);
  }

  /**
   * Clear all encrypted data
   */
  static clear(): void {
    const keys = Object.keys(sessionStorage).filter(key =>
      key.startsWith(this.STORAGE_KEY_PREFIX)
    );
    keys.forEach(key => sessionStorage.removeItem(key));
  }
}