/**
 * 스토리지 마이그레이션 유틸리티
 * 기존 평문 데이터를 보안 스토리지로 안전하게 마이그레이션합니다.
 */

import { debugLogger } from './debug-logger';
import { SecureStorage } from './secure-storage';

export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  failedKeys: string[];
  errors: string[];
}

export interface MigrationConfig {
  keyPrefix: string;
  targetPrefix: string;
  batchSize: number;
  validateData?: (data: any) => boolean;
  transformData?: (data: any) => any;
}

export class StorageMigrator {
  private static readonly DEFAULT_BATCH_SIZE = 10;
  private static readonly MIGRATION_STATUS_KEY = 'clarity_migration_status';

  /**
   * 특정 키 패턴에 대한 데이터 마이그레이션을 수행합니다
   */
  static async migrateByPattern(config: MigrationConfig): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedKeys: [],
      failedKeys: [],
      errors: []
    };

    try {
      debugLogger.log(`Starting migration for pattern: ${config.keyPrefix}`);

      // 마이그레이션 대상 키 찾기
      const targetKeys = this.findKeysToMigrate(config.keyPrefix);
      
      if (targetKeys.length === 0) {
        debugLogger.log('No keys found for migration');
        return result;
      }

      debugLogger.log(`Found ${targetKeys.length} keys for migration`);

      // 배치 단위로 마이그레이션
      const batchSize = config.batchSize || this.DEFAULT_BATCH_SIZE;
      for (let i = 0; i < targetKeys.length; i += batchSize) {
        const batch = targetKeys.slice(i, i + batchSize);
        const batchResult = await this.migrateBatch(batch, config);
        
        result.migratedKeys.push(...batchResult.migratedKeys);
        result.failedKeys.push(...batchResult.failedKeys);
        result.errors.push(...batchResult.errors);
      }

      // 마이그레이션 상태 업데이트
      await this.updateMigrationStatus(config.keyPrefix, result);

      result.success = result.failedKeys.length === 0;
      debugLogger.log(`Migration completed. Success: ${result.success}, Migrated: ${result.migratedKeys.length}, Failed: ${result.failedKeys.length}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error}`);
      debugLogger.error('Migration failed', error);
    }

    return result;
  }

  /**
   * 특정 키를 개별적으로 마이그레이션합니다
   */
  static async migrateKey(oldKey: string, newKey: string): Promise<boolean> {
    try {
      const data = localStorage.getItem(oldKey);
      if (!data) {
        debugLogger.log(`No data found for key: ${oldKey}`);
        return false;
      }

      const parsedData = JSON.parse(data);
      SecureStorage.secureStore(parsedData, newKey);
      
      // 원본 데이터 제거
      localStorage.removeItem(oldKey);
      
      debugLogger.success(`Migrated key: ${oldKey} -> ${newKey}`);
      return true;
    } catch (error) {
      debugLogger.error(`Failed to migrate key: ${oldKey}`, error);
      return false;
    }
  }

  /**
   * 마이그레이션 상태를 확인합니다
   */
  static getMigrationStatus(keyPrefix: string): any {
    try {
      const status = SecureStorage.secureRetrieve(this.MIGRATION_STATUS_KEY);
      return status ? status[keyPrefix] : null;
    } catch (error) {
      debugLogger.error('Failed to get migration status', error);
      return null;
    }
  }

  /**
   * 전체 마이그레이션 상태를 반환합니다
   */
  static getAllMigrationStatus(): any {
    try {
      return SecureStorage.secureRetrieve(this.MIGRATION_STATUS_KEY) || {};
    } catch (error) {
      debugLogger.error('Failed to get all migration status', error);
      return {};
    }
  }

  /**
   * 마이그레이션 복원 (롤백)
   */
  static async rollbackMigration(keyPrefix: string): Promise<boolean> {
    try {
      const status = this.getMigrationStatus(keyPrefix);
      if (!status || !status.migratedKeys) {
        debugLogger.warn('No migration status found for rollback');
        return false;
      }

      let rolledBack = 0;
      for (const key of status.migratedKeys) {
        try {
          const data = SecureStorage.secureRetrieve(key);
          if (data) {
            const originalKey = key.replace(status.targetPrefix, keyPrefix);
            localStorage.setItem(originalKey, JSON.stringify(data));
            SecureStorage.secureRemove(key);
            rolledBack++;
          }
        } catch (error) {
          debugLogger.error(`Failed to rollback key: ${key}`, error);
        }
      }

      debugLogger.log(`Rolled back ${rolledBack} keys for prefix: ${keyPrefix}`);
      return rolledBack > 0;
    } catch (error) {
      debugLogger.error('Rollback failed', error);
      return false;
    }
  }

  /**
   * 손상된 데이터 복구
   */
  static async repairCorruptedData(keyPrefix: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedKeys: [],
      failedKeys: [],
      errors: []
    };

    try {
      const targetKeys = this.findKeysToMigrate(keyPrefix);
      
      for (const key of targetKeys) {
        try {
          const data = SecureStorage.secureRetrieve(key);
          if (data === null) {
            // 복호화 실패 시 원본 데이터 확인
            const originalData = localStorage.getItem(key);
            if (originalData) {
              const parsedData = JSON.parse(originalData);
              SecureStorage.secureStore(parsedData, key);
              result.migratedKeys.push(key);
            }
          }
        } catch (error) {
          result.failedKeys.push(key);
          result.errors.push(`Failed to repair ${key}: ${error}`);
        }
      }

      result.success = result.failedKeys.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Repair failed: ${error}`);
    }

    return result;
  }

  /**
   * 배치 단위 마이그레이션
   */
  private static async migrateBatch(keys: string[], config: MigrationConfig): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedKeys: [],
      failedKeys: [],
      errors: []
    };

    for (const key of keys) {
      try {
        const data = localStorage.getItem(key);
        if (!data) {
          continue;
        }

        let parsedData = JSON.parse(data);
        
        // 데이터 검증
        if (config.validateData && !config.validateData(parsedData)) {
          result.failedKeys.push(key);
          result.errors.push(`Data validation failed for key: ${key}`);
          continue;
        }

        // 데이터 변환
        if (config.transformData) {
          parsedData = config.transformData(parsedData);
        }

        // 새로운 키 생성
        const newKey = key.replace(config.keyPrefix, config.targetPrefix);
        
        // 보안 스토리지에 저장
        SecureStorage.secureStore(parsedData, newKey);
        
        // 원본 데이터 제거
        localStorage.removeItem(key);
        
        result.migratedKeys.push(key);
      } catch (error) {
        result.failedKeys.push(key);
        result.errors.push(`Failed to migrate ${key}: ${error}`);
      }
    }

    return result;
  }

  /**
   * 마이그레이션 대상 키 찾기
   */
  private static findKeysToMigrate(keyPrefix: string): string[] {
    const keys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(keyPrefix)) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * 마이그레이션 상태 업데이트
   */
  private static async updateMigrationStatus(keyPrefix: string, result: MigrationResult): Promise<void> {
    try {
      const allStatus = this.getAllMigrationStatus();
      allStatus[keyPrefix] = {
        timestamp: Date.now(),
        success: result.success,
        migratedCount: result.migratedKeys.length,
        failedCount: result.failedKeys.length,
        migratedKeys: result.migratedKeys,
        failedKeys: result.failedKeys,
        errors: result.errors
      };

      SecureStorage.secureStore(allStatus, this.MIGRATION_STATUS_KEY);
    } catch (error) {
      debugLogger.error('Failed to update migration status', error);
    }
  }
}

// 일반적인 마이그레이션 설정들
export const MIGRATION_CONFIGS = {
  windowLevelPresets: {
    keyPrefix: 'cornerstone3d-windowlevel-presets',
    targetPrefix: 'clarity_window_level_presets',
    batchSize: 1,
    validateData: (data: any) => {
      return data && typeof data === 'object' && !Array.isArray(data);
    }
  },
  
  measurementSessions: {
    keyPrefix: 'measurement_session_',
    targetPrefix: 'clarity_measurement_session_',
    batchSize: 5,
    validateData: (data: any) => {
      return data && data.id && data.measurements && Array.isArray(data.measurements);
    }
  },

  measurementBackups: {
    keyPrefix: 'measurement_backup_',
    targetPrefix: 'clarity_measurement_backup_',
    batchSize: 10,
    validateData: (data: any) => {
      return data && data.id && data.sessionId && data.measurements;
    }
  }
};

// 자동 마이그레이션 실행
export async function runAutoMigration(): Promise<void> {
  try {
    debugLogger.log('Starting automatic storage migration...');
    
    for (const [name, config] of Object.entries(MIGRATION_CONFIGS)) {
      const status = StorageMigrator.getMigrationStatus(config.keyPrefix);
      
      if (!status || !status.success) {
        debugLogger.log(`Running migration for: ${name}`);
        await StorageMigrator.migrateByPattern(config);
      } else {
        debugLogger.log(`Migration already completed for: ${name}`);
      }
    }
    
    debugLogger.success('Automatic migration completed');
  } catch (error) {
    debugLogger.error('Auto migration failed', error);
  }
}

// 브라우저 환경에서 자동 마이그레이션
if (typeof window !== 'undefined') {
  // 페이지 로드 후 자동 마이그레이션 실행
  window.addEventListener('load', () => {
    setTimeout(runAutoMigration, 1000); // 1초 후 실행
  });
}

export default StorageMigrator;