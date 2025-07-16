/**
 * 보안 스토리지 유틸리티
 * 사용자 설정 및 민감한 데이터를 암호화하여 안전하게 저장합니다.
 */

import CryptoJS from 'crypto-js';
import { debugLogger } from './debug-logger';

// 스토리지 키 및 설정
const STORAGE_KEY = 'clarity_settings';
const LEGACY_STORAGE_KEY = 'cornerstone3d-windowlevel-presets';
const SECRET_KEY = import.meta.env.VITE_STORAGE_SECRET || 'default-dev-key-2023';

// 암호화된 데이터 구조
interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  timestamp: number;
  version: string;
}

// 스토리지 에러 타입
export class SecureStorageError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'SecureStorageError';
  }
}

// 데이터 유효성 검증
interface DataValidation {
  isValid: boolean;
  reason?: string;
}

/**
 * 보안 스토리지 클래스
 */
export class SecureStorage {
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ENCRYPTION_ALGORITHM = 'AES';
  
  /**
   * 데이터를 암호화하여 안전하게 저장합니다
   */
  static secureStore(data: any, key: string = STORAGE_KEY): void {
    try {
      if (!data) {
        throw new SecureStorageError('Data is required for storage');
      }

      // 데이터 검증
      const validation = this.validateData(data);
      if (!validation.isValid) {
        throw new SecureStorageError(`Invalid data: ${validation.reason}`);
      }

      // 데이터 직렬화
      const serializedData = JSON.stringify(data);
      
      // 크기 제한 확인
      if (serializedData.length > this.MAX_STORAGE_SIZE) {
        throw new SecureStorageError(`Data exceeds maximum size limit of ${this.MAX_STORAGE_SIZE} bytes`);
      }

      // 암호화 키 생성
      const salt = CryptoJS.lib.WordArray.random(16);
      const iv = CryptoJS.lib.WordArray.random(16);
      const derivedKey = CryptoJS.PBKDF2(SECRET_KEY, salt, {
        keySize: 256 / 32,
        iterations: 10000
      });

      // 데이터 암호화
      const encrypted = CryptoJS.AES.encrypt(serializedData, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      // 암호화된 데이터 패키지 생성
      const encryptedPackage: EncryptedData = {
        encrypted: encrypted.toString(),
        salt: salt.toString(),
        iv: iv.toString(),
        timestamp: Date.now(),
        version: this.CURRENT_VERSION
      };

      // localStorage에 저장
      localStorage.setItem(key, JSON.stringify(encryptedPackage));
      
      debugLogger.success(`Secure storage: Data encrypted and stored successfully`);
    } catch (error) {
      debugLogger.error('Secure storage: Failed to store data', error);
      throw new SecureStorageError(
        `Failed to store data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 암호화된 데이터를 복호화하여 반환합니다
   */
  static secureRetrieve(key: string = STORAGE_KEY): any {
    try {
      const storedData = localStorage.getItem(key);
      if (!storedData) {
        debugLogger.log('Secure storage: No data found for key', key);
        return null;
      }

      // 암호화된 패키지 파싱
      const encryptedPackage: EncryptedData = JSON.parse(storedData);
      
      // 버전 호환성 확인
      if (!this.isCompatibleVersion(encryptedPackage.version)) {
        debugLogger.warn(`Secure storage: Incompatible version ${encryptedPackage.version}, clearing data`);
        localStorage.removeItem(key);
        return null;
      }

      // 키 재생성
      const salt = CryptoJS.enc.Hex.parse(encryptedPackage.salt);
      const iv = CryptoJS.enc.Hex.parse(encryptedPackage.iv);
      const derivedKey = CryptoJS.PBKDF2(SECRET_KEY, salt, {
        keySize: 256 / 32,
        iterations: 10000
      });

      // 데이터 복호화
      const decrypted = CryptoJS.AES.decrypt(encryptedPackage.encrypted, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      if (!decryptedText) {
        throw new SecureStorageError('Failed to decrypt data - invalid key or corrupted data');
      }

      // JSON 파싱
      const result = JSON.parse(decryptedText);
      
      debugLogger.success('Secure storage: Data decrypted successfully');
      return result;
    } catch (error) {
      debugLogger.error('Secure storage: Failed to retrieve data', error);
      
      // 복호화 실패 시 데이터 제거
      if (error instanceof SecureStorageError) {
        localStorage.removeItem(key);
      }
      
      // 조용히 실패하고 null 반환 (기본값으로 fallback)
      return null;
    }
  }

  /**
   * 기존 평문 데이터를 암호화된 형태로 마이그레이션합니다
   */
  static migrateFromLegacyStorage(legacyKey: string, newKey: string = STORAGE_KEY): boolean {
    try {
      const legacyData = localStorage.getItem(legacyKey);
      if (!legacyData) {
        debugLogger.log('Secure storage: No legacy data to migrate');
        return false;
      }

      // 기존 데이터 파싱
      const parsedData = JSON.parse(legacyData);
      
      // 새로운 형태로 저장
      this.secureStore(parsedData, newKey);
      
      // 기존 데이터 제거
      localStorage.removeItem(legacyKey);
      
      debugLogger.success(`Secure storage: Migrated legacy data from ${legacyKey} to ${newKey}`);
      return true;
    } catch (error) {
      debugLogger.error('Secure storage: Failed to migrate legacy data', error);
      return false;
    }
  }

  /**
   * 특정 키의 데이터를 안전하게 삭제합니다
   */
  static secureRemove(key: string = STORAGE_KEY): boolean {
    try {
      localStorage.removeItem(key);
      debugLogger.log(`Secure storage: Removed data for key ${key}`);
      return true;
    } catch (error) {
      debugLogger.error('Secure storage: Failed to remove data', error);
      return false;
    }
  }

  /**
   * 모든 보안 저장된 데이터를 제거합니다
   */
  static clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      
      // 모든 storage 키 검사
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('clarity_') || key.startsWith('cornerstone3d-'))) {
          keysToRemove.push(key);
        }
      }

      // 데이터 제거
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      debugLogger.log(`Secure storage: Cleared ${keysToRemove.length} items`);
    } catch (error) {
      debugLogger.error('Secure storage: Failed to clear all data', error);
    }
  }

  /**
   * 저장된 데이터 크기를 확인합니다
   */
  static getStorageSize(key: string = STORAGE_KEY): number {
    try {
      const data = localStorage.getItem(key);
      return data ? data.length : 0;
    } catch (error) {
      debugLogger.error('Secure storage: Failed to get storage size', error);
      return 0;
    }
  }

  /**
   * 저장된 데이터가 존재하는지 확인합니다
   */
  static hasData(key: string = STORAGE_KEY): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      debugLogger.error('Secure storage: Failed to check data existence', error);
      return false;
    }
  }

  /**
   * 저장된 데이터의 메타데이터를 반환합니다
   */
  static getMetadata(key: string = STORAGE_KEY): { timestamp: number; version: string; size: number } | null {
    try {
      const storedData = localStorage.getItem(key);
      if (!storedData) return null;

      const encryptedPackage: EncryptedData = JSON.parse(storedData);
      
      return {
        timestamp: encryptedPackage.timestamp,
        version: encryptedPackage.version,
        size: storedData.length
      };
    } catch (error) {
      debugLogger.error('Secure storage: Failed to get metadata', error);
      return null;
    }
  }

  /**
   * 데이터 유효성 검증
   */
  private static validateData(data: any): DataValidation {
    if (data === null || data === undefined) {
      return { isValid: false, reason: 'Data is null or undefined' };
    }

    // 순환 참조 확인
    try {
      JSON.stringify(data);
    } catch (error) {
      return { isValid: false, reason: 'Data contains circular references' };
    }

    // 기본 타입 검증
    if (typeof data === 'function') {
      return { isValid: false, reason: 'Functions cannot be stored' };
    }

    // 민감한 속성 검증
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential'];
    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          debugLogger.warn(`Secure storage: Storing potentially sensitive data with key: ${key}`);
        }
      }
    }

    return { isValid: true };
  }

  /**
   * 버전 호환성 확인
   */
  private static isCompatibleVersion(version: string): boolean {
    if (!version) return false;
    
    const currentMajor = parseInt(this.CURRENT_VERSION.split('.')[0]);
    const dataMajor = parseInt(version.split('.')[0]);
    
    return dataMajor <= currentMajor;
  }

  /**
   * 저장소 정리 (오래된 데이터 제거)
   */
  static cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('clarity_')) {
          const metadata = this.getMetadata(key);
          if (metadata && (now - metadata.timestamp) > maxAge) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (keysToRemove.length > 0) {
        debugLogger.log(`Secure storage: Cleaned up ${keysToRemove.length} expired items`);
      }
    } catch (error) {
      debugLogger.error('Secure storage: Failed to cleanup old data', error);
    }
  }
}

// 편의 함수들
export function secureStore(data: any, key?: string): void {
  return SecureStorage.secureStore(data, key);
}

export function secureRetrieve(key?: string): any {
  return SecureStorage.secureRetrieve(key);
}

export function secureRemove(key?: string): boolean {
  return SecureStorage.secureRemove(key);
}

// 초기화 및 자동 마이그레이션
export function initializeSecureStorage(): void {
  try {
    // 기존 Window/Level 프리셋 마이그레이션
    SecureStorage.migrateFromLegacyStorage(LEGACY_STORAGE_KEY, 'clarity_window_level_presets');
    
    // 오래된 데이터 정리
    SecureStorage.cleanup();
    
    debugLogger.success('Secure storage: Initialized successfully');
  } catch (error) {
    debugLogger.error('Secure storage: Failed to initialize', error);
  }
}

// 자동 초기화 (브라우저 환경에서)
if (typeof window !== 'undefined') {
  // DOM 로드 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSecureStorage);
  } else {
    initializeSecureStorage();
  }
}

export default SecureStorage;