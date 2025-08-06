/**
 * Audit Log Rotation and Archival System
 * Provides automatic log rotation, compression, and archival capabilities
 * for medical-grade audit logging compliance
 */

import { AuditEvent } from './AuditLogger';
import { medicalEncryption } from './encryption';
import { secureStorage } from './secureStorage';
import { log } from '../utils/logger';

export interface LogRotationConfig {
  enabled: boolean;
  sizeThreshold: number; // MB
  timeThreshold: number; // hours
  maxArchives: number;
  compressionEnabled: boolean;
  archiveNamePattern: string; // e.g., 'audit-log-{timestamp}.archive'
}

export interface LogArchive {
  id: string;
  filename: string;
  createdAt: string;
  size: number; // bytes
  eventCount: number;
  startDate: string;
  endDate: string;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
}

export interface ArchivalStatistics {
  totalArchives: number;
  totalArchivedEvents: number;
  totalArchivedSize: number; // bytes
  oldestArchive: string | null;
  newestArchive: string | null;
  compressionRatio: number;
}

/**
 * Audit Log Rotation Manager
 * Handles automatic rotation, compression, and archival of audit logs
 */
export class AuditLogRotationManager {
  private readonly archiveStorageKey = 'medical_audit_archives';
  private readonly archiveMetadataKey = 'medical_audit_archive_metadata';
  private config: LogRotationConfig;
  private rotationInProgress = false;
  private lastRotationCheck: Date;

  constructor(config: Partial<LogRotationConfig> = {}) {
    this.config = {
      enabled: true,
      sizeThreshold: 50, // 50MB
      timeThreshold: 24, // 24 hours
      maxArchives: 10,
      compressionEnabled: true,
      archiveNamePattern: 'audit-log-{timestamp}.archive',
      ...config,
    };
    this.lastRotationCheck = new Date();
  }

  /**
   * Check if log rotation is needed based on size and time thresholds
   */
  public async shouldRotate(currentLogSize: number): Promise<boolean> {
    if (!this.config.enabled || this.rotationInProgress) {
      return false;
    }

    // Check size threshold (convert MB to bytes)
    if (currentLogSize >= this.config.sizeThreshold * 1024 * 1024) {
      log.info('Log rotation triggered by size threshold', {
        component: 'AuditLogRotation',
        metadata: {
          currentSize: currentLogSize,
          threshold: this.config.sizeThreshold * 1024 * 1024,
        },
      });
      return true;
    }

    // Check time threshold
    const hoursSinceLastRotation =
      (new Date().getTime() - this.lastRotationCheck.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastRotation >= this.config.timeThreshold) {
      log.info('Log rotation triggered by time threshold', {
        component: 'AuditLogRotation',
        metadata: {
          hoursSinceLastRotation,
          threshold: this.config.timeThreshold,
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Rotate current logs to archive
   */
  public async rotateLogs(currentLogs: AuditEvent[]): Promise<{
    success: boolean;
    archiveId?: string;
    error?: string;
  }> {
    if (this.rotationInProgress) {
      return { success: false, error: 'Rotation already in progress' };
    }

    this.rotationInProgress = true;

    try {
      // Generate archive metadata
      const archiveId = this.generateArchiveId();
      const timestamp = new Date().toISOString();
      const filename = this.config.archiveNamePattern.replace('{timestamp}', timestamp);

      // Prepare archive data
      const archiveData = {
        logs: currentLogs,
        metadata: {
          version: '1.0',
          createdAt: timestamp,
          eventCount: currentLogs.length,
          startDate: currentLogs[0]?.timestamp || timestamp,
          endDate: currentLogs[currentLogs.length - 1]?.timestamp || timestamp,
        },
      };

      // Compress if enabled
      let processedData: string;
      let compressed = false;

      if (this.config.compressionEnabled) {
        processedData = await this.compressData(JSON.stringify(archiveData));
        compressed = true;
      } else {
        processedData = JSON.stringify(archiveData);
      }

      // Encrypt the archive
      const encryptedArchive = medicalEncryption.encrypt(
        processedData,
        'audit-archive-key',
        { purpose: 'audit-logs' as any },
      );

      // Calculate checksum for integrity
      const checksum = await this.calculateChecksum(processedData);

      // Store the archive
      const archivePath = `${this.archiveStorageKey}_${archiveId}`;
      await secureStorage.store(archivePath, JSON.stringify(encryptedArchive), 'audit-archive');

      // Create archive metadata
      const archiveMetadata: LogArchive = {
        id: archiveId,
        filename,
        createdAt: timestamp,
        size: new Blob([processedData]).size,
        eventCount: currentLogs.length,
        startDate: archiveData.metadata.startDate,
        endDate: archiveData.metadata.endDate,
        compressed,
        encrypted: true,
        checksum,
      };

      // Update archive metadata index
      await this.updateArchiveMetadata(archiveMetadata);

      // Clean up old archives if needed
      await this.cleanupOldArchives();

      // Update last rotation time
      this.lastRotationCheck = new Date();

      log.info('Audit logs rotated successfully', {
        component: 'AuditLogRotation',
        metadata: {
          archiveId,
          eventCount: currentLogs.length,
          size: archiveMetadata.size,
          compressed,
        },
      });

      return { success: true, archiveId };

    } catch (error) {
      log.error('Failed to rotate audit logs', {
        component: 'AuditLogRotation',
      }, error as Error);
      return { success: false, error: (error as Error).message };
    } finally {
      this.rotationInProgress = false;
    }
  }

  /**
   * Compress data using modern compression API
   */
  private async compressData(data: string): Promise<string> {
    if (typeof CompressionStream !== 'undefined') {
      // Use native compression if available
      const blob = new Blob([data]);
      const stream = blob.stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      const compressedBlob = await new Response(compressedStream).blob();
      const buffer = await compressedBlob.arrayBuffer();
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    } else {
      // Fallback to simple base64 encoding
      return btoa(data);
    }
  }

  /**
   * Decompress archived data
   */
  private async decompressData(compressedData: string): Promise<string> {
    if (typeof DecompressionStream !== 'undefined') {
      // Use native decompression if available
      const binaryString = atob(compressedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      const stream = blob.stream();
      // Safe usage of DecompressionStream with literal string
      const compressionFormat = 'gzip' as const;
      const decompressedStream = stream.pipeThrough(new DecompressionStream(compressionFormat));
      const decompressedBlob = await new Response(decompressedStream).blob();
      return await decompressedBlob.text();
    } else {
      // Fallback from base64
      return atob(compressedData);
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate unique archive ID
   */
  private generateArchiveId(): string {
    const timestamp = new Date().toISOString().replace(/[:\-T.]/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `archive-${timestamp}-${random}`;
  }

  /**
   * Update archive metadata index
   */
  private async updateArchiveMetadata(newArchive: LogArchive): Promise<void> {
    const existingMetadata = await this.getArchiveMetadata();
    existingMetadata.push(newArchive);

    // Sort by creation date (newest first)
    existingMetadata.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    await secureStorage.store(this.archiveMetadataKey, JSON.stringify(existingMetadata), 'audit-metadata');
  }

  /**
   * Get all archive metadata
   */
  private async getArchiveMetadata(): Promise<LogArchive[]> {
    try {
      const metadataJson = await secureStorage.retrieve(this.archiveMetadataKey);
      return metadataJson ? JSON.parse(metadataJson) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clean up old archives based on maxArchives setting
   */
  private async cleanupOldArchives(): Promise<void> {
    const metadata = await this.getArchiveMetadata();

    if (metadata.length <= this.config.maxArchives) {
      return;
    }

    // Remove oldest archives
    const archivesToRemove = metadata.slice(this.config.maxArchives);

    for (const archive of archivesToRemove) {
      try {
        const archivePath = `${this.archiveStorageKey}_${archive.id}`;
        await secureStorage.remove(archivePath);

        log.info('Removed old archive', {
          component: 'AuditLogRotation',
          metadata: {
            archiveId: archive.id,
            createdAt: archive.createdAt,
            eventCount: archive.eventCount,
          },
        });
      } catch (error) {
        log.error('Failed to remove old archive', {
          component: 'AuditLogRotation',
          metadata: { archiveId: archive.id },
        }, error as Error);
      }
    }

    // Update metadata
    const updatedMetadata = metadata.slice(0, this.config.maxArchives);
    await secureStorage.store(this.archiveMetadataKey, JSON.stringify(updatedMetadata), 'audit-metadata');
  }

  /**
   * Retrieve archived logs
   */
  public async retrieveArchive(archiveId: string): Promise<{
    success: boolean;
    logs?: AuditEvent[];
    metadata?: any;
    error?: string;
  }> {
    try {
      const archivePath = `${this.archiveStorageKey}_${archiveId}`;
      const encryptedDataJson = await secureStorage.retrieve(archivePath);

      if (!encryptedDataJson) {
        return { success: false, error: 'Archive not found' };
      }

      const encryptedData = JSON.parse(encryptedDataJson);

      // Decrypt the archive
      const decryptedData = medicalEncryption.decrypt(
        encryptedData,
        'audit-archive-key',
        { purpose: 'audit-logs' as any },
      );

      // Find archive metadata
      const metadata = await this.getArchiveMetadata();
      const archiveMetadata = metadata.find(m => m.id === archiveId);

      // Decompress if needed
      let archiveData: string;
      if (archiveMetadata?.compressed) {
        archiveData = await this.decompressData(decryptedData);
      } else {
        archiveData = decryptedData;
      }

      // Parse and return
      const parsed = JSON.parse(archiveData);

      return {
        success: true,
        logs: parsed.logs,
        metadata: parsed.metadata,
      };

    } catch (error) {
      log.error('Failed to retrieve archive', {
        component: 'AuditLogRotation',
        metadata: { archiveId },
      }, error as Error);

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get archival statistics
   */
  public async getArchivalStatistics(): Promise<ArchivalStatistics> {
    const metadata = await this.getArchiveMetadata();

    const totalArchivedEvents = metadata.reduce((sum, archive) => sum + archive.eventCount, 0);
    const totalArchivedSize = metadata.reduce((sum, archive) => sum + archive.size, 0);

    // Calculate compression ratio
    const compressedArchives = metadata.filter(m => m.compressed);
    const compressionRatio = compressedArchives.length > 0
      ? compressedArchives.reduce((sum, archive) => {
        // Estimate original size (compressed is typically 20-30% of original for JSON)
        const estimatedOriginalSize = archive.size * 3.5;
        return sum + (archive.size / estimatedOriginalSize);
      }, 0) / compressedArchives.length
      : 1;

    return {
      totalArchives: metadata.length,
      totalArchivedEvents,
      totalArchivedSize,
      oldestArchive: metadata[metadata.length - 1]?.createdAt || null,
      newestArchive: metadata[0]?.createdAt || null,
      compressionRatio,
    };
  }

  /**
   * Export all archives for backup
   */
  public async exportAllArchives(): Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }> {
    try {
      const metadata = await this.getArchiveMetadata();
      const archives: any[] = [];

      for (const archiveMeta of metadata) {
        const archive = await this.retrieveArchive(archiveMeta.id);
        if (archive.success) {
          archives.push({
            metadata: archiveMeta,
            logs: archive.logs,
          });
        }
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        archiveCount: archives.length,
        archives,
      };

      return {
        success: true,
        data: JSON.stringify(exportData, null, 2),
      };

    } catch (error) {
      log.error('Failed to export archives', {
        component: 'AuditLogRotation',
      }, error as Error);

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Validate archive integrity
   */
  public async validateArchiveIntegrity(archiveId: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const metadata = await this.getArchiveMetadata();
      const archiveMeta = metadata.find(m => m.id === archiveId);

      if (!archiveMeta) {
        return { valid: false, error: 'Archive metadata not found' };
      }

      // Retrieve and decrypt archive
      const archive = await this.retrieveArchive(archiveId);
      if (!archive.success) {
        return { valid: false, error: archive.error };
      }

      // Recalculate checksum
      const archiveData = JSON.stringify({
        logs: archive.logs,
        metadata: archive.metadata,
      });

      const calculatedChecksum = await this.calculateChecksum(archiveData);

      // Compare checksums
      if (calculatedChecksum !== archiveMeta.checksum) {
        return { valid: false, error: 'Checksum mismatch - archive may be corrupted' };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }
}

// Export singleton instance
export const auditLogRotation = new AuditLogRotationManager();
