/**
 * Viewport State Persistence Service
 * Advanced state saving and restoration with versioning, compression, and encryption
 * Supports session, local, and cloud-based persistence strategies
 */

import { EventEmitter } from 'events';
import { ViewportState } from '../types/viewportState';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';

export interface PersistenceStrategy {
  save(key: string, data: string, options?: PersistenceOptions): Promise<void>;
  load(key: string): Promise<string | null>;
  remove(key: string): Promise<boolean>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

export interface PersistenceOptions {
  encrypt?: boolean;
  compress?: boolean;
  ttl?: number; // Time to live in milliseconds
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ViewportSnapshot {
  id: string;
  name: string;
  description?: string;
  states: Record<string, ViewportState>;
  metadata: {
    createdAt: string;
    version: string;
    createdBy?: string;
    tags: string[];
    checksum: string;
  };
  settings: {
    includeTools: boolean;
    includeAnnotations: boolean;
    includeMeasurements: boolean;
    includeLayout: boolean;
  };
}

export interface ViewportSession {
  id: string;
  name: string;
  snapshots: ViewportSnapshot[];
  metadata: {
    createdAt: string;
    modifiedAt: string;
    version: string;
    isActive: boolean;
  };
}

export interface ViewportStatePersistenceConfig {
  strategies: {
    session: PersistenceStrategy;
    local: PersistenceStrategy;
    cloud?: PersistenceStrategy;
  };
  defaultStrategy: 'session' | 'local' | 'cloud';
  autoSave: {
    enabled: boolean;
    interval: number; // milliseconds
    maxAutoSaves: number;
  };
  compression: {
    enabled: boolean;
    threshold: number; // bytes
    algorithm: 'gzip' | 'deflate';
  };
  encryption: {
    enabled: boolean;
    key?: string;
  };
  versioning: {
    enabled: boolean;
    maxVersions: number;
    cleanupStrategy: 'fifo' | 'lru' | 'size';
  };
}

export const DEFAULT_PERSISTENCE_CONFIG: ViewportStatePersistenceConfig = {
  strategies: {
    session: {} as PersistenceStrategy,
    local: {} as PersistenceStrategy,
  },
  defaultStrategy: 'local',
  autoSave: {
    enabled: true,
    interval: 30000, // 30 seconds
    maxAutoSaves: 10,
  },
  compression: {
    enabled: true,
    threshold: 1024, // 1KB
    algorithm: 'gzip',
  },
  encryption: {
    enabled: true,
  },
  versioning: {
    enabled: true,
    maxVersions: 20,
    cleanupStrategy: 'fifo',
  },
};

export interface ViewportStatePersistenceEvents {
  'snapshot-saved': [ViewportSnapshot];
  'snapshot-loaded': [ViewportSnapshot];
  'snapshot-deleted': [string];
  'session-created': [ViewportSession];
  'session-activated': [ViewportSession];
  'auto-save-completed': [ViewportSnapshot];
  'persistence-error': [Error, string];
  'storage-quota-exceeded': [number, number]; // [current, limit]
}

export class ViewportStatePersistence extends EventEmitter {
  private config: ViewportStatePersistenceConfig;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private currentSession: ViewportSession | null = null;
  private autoSaveCounter = 0;

  constructor(config: Partial<ViewportStatePersistenceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };

    this.initialize();
  }

  private initialize(): void {
    log.info('ViewportStatePersistence initializing', {
      component: 'ViewportStatePersistence',
      metadata: {
        defaultStrategy: this.config.defaultStrategy,
        autoSaveEnabled: this.config.autoSave.enabled,
      },
    });

    // Setup auto-save if enabled
    if (this.config.autoSave.enabled) {
      this.setupAutoSave();
    }

    // Load active session if exists
    this.loadActiveSession().catch(error => {
      log.error(
        'Failed to load active session',
        {
          component: 'ViewportStatePersistence',
        },
        error as Error,
      );
    });
  }

  // ===== Snapshot Management =====

  public async saveSnapshot(
    name: string,
    states: Record<string, ViewportState>,
    options: {
      description?: string;
      strategy?: 'session' | 'local' | 'cloud';
      settings?: Partial<ViewportSnapshot['settings']>;
      tags?: string[];
    } = {},
  ): Promise<ViewportSnapshot> {
    const { description, strategy = this.config.defaultStrategy, settings = {}, tags = [] } = options;

    try {
      // Filter states based on settings
      const filteredStates = this.filterStatesForSnapshot(states, {
        includeTools: true,
        includeAnnotations: true,
        includeMeasurements: true,
        includeLayout: true,
        ...settings,
      });

      // Create snapshot
      const snapshot: ViewportSnapshot = {
        id: this.generateSnapshotId(),
        name,
        description,
        states: filteredStates,
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          tags,
          checksum: await this.calculateChecksum(filteredStates),
        },
        settings: {
          includeTools: true,
          includeAnnotations: true,
          includeMeasurements: true,
          includeLayout: true,
          ...settings,
        },
      };

      // Serialize and save
      const serializedData = await this.serializeSnapshot(snapshot);
      // eslint-disable-next-line security/detect-object-injection -- Safe: strategy is type-constrained to 'session' | 'local' | 'cloud'
      const storageStrategy = this.config.strategies[strategy];

      if (!storageStrategy) {
        throw new Error(`Storage strategy not available: ${strategy}`);
      }

      await storageStrategy.save(`snapshot-${snapshot.id}`, serializedData, {
        encrypt: this.config.encryption.enabled,
        compress: this.config.compression.enabled,
        tags,
        metadata: {
          snapshotName: name,
          createdAt: snapshot.metadata.createdAt,
        },
      });

      // Add to current session if exists
      if (this.currentSession) {
        this.currentSession.snapshots.push(snapshot);
        this.currentSession.metadata.modifiedAt = new Date().toISOString();
        await this.saveSession(this.currentSession);
      }

      this.emit('snapshot-saved', snapshot);

      log.info('Viewport snapshot saved', {
        component: 'ViewportStatePersistence',
        metadata: {
          snapshotId: snapshot.id,
          name,
          strategy,
          stateCount: Object.keys(filteredStates).length,
        },
      });

      return snapshot;
    } catch (error) {
      this.emit('persistence-error', error as Error, 'save-snapshot');
      throw error;
    }
  }

  public async loadSnapshot(snapshotId: string, strategy?: 'session' | 'local' | 'cloud'): Promise<ViewportSnapshot> {
    const useStrategy = strategy ?? this.config.defaultStrategy;

    try {
      // eslint-disable-next-line security/detect-object-injection -- Safe: useStrategy is type-constrained to 'session' | 'local' | 'cloud'
      const storageStrategy = this.config.strategies[useStrategy];
      if (!storageStrategy) {
        throw new Error(`Storage strategy not available: ${useStrategy}`);
      }

      const serializedData = await storageStrategy.load(`snapshot-${snapshotId}`);
      if (!serializedData) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }

      const snapshot = await this.deserializeSnapshot(serializedData);

      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(snapshot.states);
      if (calculatedChecksum !== snapshot.metadata.checksum) {
        log.warn('Snapshot checksum mismatch, data may be corrupted', {
          component: 'ViewportStatePersistence',
          metadata: { snapshotId, expected: snapshot.metadata.checksum, calculated: calculatedChecksum },
        });
      }

      this.emit('snapshot-loaded', snapshot);

      log.info('Viewport snapshot loaded', {
        component: 'ViewportStatePersistence',
        metadata: {
          snapshotId,
          name: snapshot.name,
          strategy: useStrategy,
          stateCount: Object.keys(snapshot.states).length,
        },
      });

      return snapshot;
    } catch (error) {
      this.emit('persistence-error', error as Error, 'load-snapshot');
      throw error;
    }
  }

  public async deleteSnapshot(snapshotId: string, strategy?: 'session' | 'local' | 'cloud'): Promise<boolean> {
    const useStrategy = strategy ?? this.config.defaultStrategy;

    try {
      // eslint-disable-next-line security/detect-object-injection -- Safe: useStrategy is type-constrained to 'session' | 'local' | 'cloud'
      const storageStrategy = this.config.strategies[useStrategy];
      if (!storageStrategy) {
        throw new Error(`Storage strategy not available: ${useStrategy}`);
      }

      const deleted = await storageStrategy.remove(`snapshot-${snapshotId}`);

      // Remove from current session if exists
      if (this.currentSession) {
        const index = this.currentSession.snapshots.findIndex(s => s.id === snapshotId);
        if (index !== -1) {
          this.currentSession.snapshots.splice(index, 1);
          this.currentSession.metadata.modifiedAt = new Date().toISOString();
          await this.saveSession(this.currentSession);
        }
      }

      if (deleted) {
        this.emit('snapshot-deleted', snapshotId);

        log.info('Viewport snapshot deleted', {
          component: 'ViewportStatePersistence',
          metadata: { snapshotId, strategy: useStrategy },
        });
      }

      return deleted;
    } catch (error) {
      this.emit('persistence-error', error as Error, 'delete-snapshot');
      throw error;
    }
  }

  public async listSnapshots(strategy?: 'session' | 'local' | 'cloud'): Promise<ViewportSnapshot[]> {
    const useStrategy = strategy ?? this.config.defaultStrategy;

    try {
      // eslint-disable-next-line security/detect-object-injection -- Safe: useStrategy is type-constrained to 'session' | 'local' | 'cloud'
      const storageStrategy = this.config.strategies[useStrategy];
      if (!storageStrategy) {
        throw new Error(`Storage strategy not available: ${useStrategy}`);
      }

      const keys = await storageStrategy.list();
      const snapshotKeys = keys.filter(key => key.startsWith('snapshot-'));

      const snapshots: ViewportSnapshot[] = [];

      for (const key of snapshotKeys) {
        try {
          const serializedData = await storageStrategy.load(key);
          if (serializedData) {
            const snapshot = await this.deserializeSnapshot(serializedData);
            snapshots.push(snapshot);
          }
        } catch (error) {
          log.warn(
            'Failed to load snapshot during listing',
            {
              component: 'ViewportStatePersistence',
              metadata: { key },
            },
            error as Error,
          );
        }
      }

      // Sort by creation date (newest first)
      snapshots.sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime());

      return snapshots;
    } catch (error) {
      this.emit('persistence-error', error as Error, 'list-snapshots');
      throw error;
    }
  }

  // ===== Session Management =====

  public async createSession(name: string): Promise<ViewportSession> {
    const session: ViewportSession = {
      id: this.generateSessionId(),
      name,
      snapshots: [],
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: '1.0.0',
        isActive: false,
      },
    };

    await this.saveSession(session);

    this.emit('session-created', session);

    log.info('Viewport session created', {
      component: 'ViewportStatePersistence',
      metadata: { sessionId: session.id, name },
    });

    return session;
  }

  public async activateSession(sessionId: string): Promise<ViewportSession> {
    // Deactivate current session
    if (this.currentSession) {
      this.currentSession.metadata.isActive = false;
      await this.saveSession(this.currentSession);
    }

    // Load and activate new session
    const session = await this.loadSession(sessionId);
    session.metadata.isActive = true;
    session.metadata.modifiedAt = new Date().toISOString();

    await this.saveSession(session);
    this.currentSession = session;

    this.emit('session-activated', session);

    log.info('Viewport session activated', {
      component: 'ViewportStatePersistence',
      metadata: { sessionId, name: session.name },
    });

    return session;
  }

  public getCurrentSession(): ViewportSession | null {
    return this.currentSession;
  }

  // ===== Auto-Save =====

  public async performAutoSave(states: Record<string, ViewportState>): Promise<ViewportSnapshot> {
    this.autoSaveCounter++;

    const snapshot = await this.saveSnapshot(`AutoSave-${this.autoSaveCounter}`, states, {
      description: `Automatic save at ${new Date().toLocaleString()}`,
      tags: ['auto-save'],
      settings: {
        includeTools: true,
        includeAnnotations: false, // Skip annotations for auto-save
        includeMeasurements: false, // Skip measurements for auto-save
        includeLayout: true,
      },
    });

    // Cleanup old auto-saves
    await this.cleanupAutoSaves();

    this.emit('auto-save-completed', snapshot);

    return snapshot;
  }

  private setupAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      // Auto-save will be triggered externally by providing states
      // This is just the interval setup
    }, this.config.autoSave.interval);
  }

  private async cleanupAutoSaves(): Promise<void> {
    try {
      const snapshots = await this.listSnapshots();
      const autoSaves = snapshots.filter(s => s.metadata.tags.includes('auto-save'));

      if (autoSaves.length > this.config.autoSave.maxAutoSaves) {
        const toDelete = autoSaves.slice(this.config.autoSave.maxAutoSaves);

        for (const snapshot of toDelete) {
          await this.deleteSnapshot(snapshot.id);
        }

        log.info('Auto-save cleanup completed', {
          component: 'ViewportStatePersistence',
          metadata: { deleted: toDelete.length, remaining: this.config.autoSave.maxAutoSaves },
        });
      }
    } catch (error) {
      log.error(
        'Auto-save cleanup failed',
        {
          component: 'ViewportStatePersistence',
        },
        error as Error,
      );
    }
  }

  // ===== Utility Methods =====

  private filterStatesForSnapshot(
    states: Record<string, ViewportState>,
    settings: ViewportSnapshot['settings'],
  ): Record<string, ViewportState> {
    const filtered: Record<string, ViewportState> = {};

    Object.entries(states).forEach(([id, state]) => {
      const filteredState = { ...state };

      if (!settings.includeTools) {
        filteredState.tools = {
          activeTool: 'WindowLevel',
          availableTools: [],
          toolConfiguration: {},
          annotations: [],
          measurements: [],
        };
      } else {
        if (!settings.includeAnnotations) {
          filteredState.tools.annotations = [];
        }
        if (!settings.includeMeasurements) {
          filteredState.tools.measurements = [];
        }
      }

      if (!settings.includeLayout) {
        filteredState.metadata.layout = {
          position: { row: 0, col: 0 },
          size: { width: 512, height: 512 },
        };
      }

      // eslint-disable-next-line security/detect-object-injection -- Safe: id is viewport identifier from Object.entries
      filtered[id] = filteredState;
    });

    return filtered;
  }

  private async serializeSnapshot(snapshot: ViewportSnapshot): Promise<string> {
    return JSON.stringify(snapshot);
  }

  private async deserializeSnapshot(data: string): Promise<ViewportSnapshot> {
    return JSON.parse(data);
  }

  private async calculateChecksum(states: Record<string, ViewportState>): Promise<string> {
    const data = JSON.stringify(states);
    // Simple checksum - in production, use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveSession(session: ViewportSession): Promise<void> {
    const strategy = this.config.strategies.local;
    const serializedSession = JSON.stringify(session);

    await strategy.save(`session-${session.id}`, serializedSession, {
      encrypt: this.config.encryption.enabled,
      metadata: { sessionName: session.name },
    });
  }

  private async loadSession(sessionId: string): Promise<ViewportSession> {
    const strategy = this.config.strategies.local;
    const serializedData = await strategy.load(`session-${sessionId}`);

    if (!serializedData) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return JSON.parse(serializedData);
  }

  private async loadActiveSession(): Promise<void> {
    try {
      const sessions = await this.listSessions();
      const activeSession = sessions.find(s => s.metadata.isActive);

      if (activeSession) {
        this.currentSession = activeSession;
        log.info('Active session loaded', {
          component: 'ViewportStatePersistence',
          metadata: { sessionId: activeSession.id, name: activeSession.name },
        });
      }
    } catch (error) {
      log.warn(
        'No active session found',
        {
          component: 'ViewportStatePersistence',
        },
        error as Error,
      );
    }
  }

  private async listSessions(): Promise<ViewportSession[]> {
    const strategy = this.config.strategies.local;
    const keys = await strategy.list();
    const sessionKeys = keys.filter(key => key.startsWith('session-'));

    const sessions: ViewportSession[] = [];

    for (const key of sessionKeys) {
      try {
        const serializedData = await strategy.load(key);
        if (serializedData) {
          const session = JSON.parse(serializedData);
          sessions.push(session);
        }
      } catch (error) {
        log.warn(
          'Failed to load session during listing',
          {
            component: 'ViewportStatePersistence',
            metadata: { key },
          },
          error as Error,
        );
      }
    }

    return sessions;
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    this.currentSession = null;
    this.removeAllListeners();

    log.info('ViewportStatePersistence disposed', {
      component: 'ViewportStatePersistence',
    });
  }
}

// ===== Storage Strategy Implementations =====

class SessionStorageStrategy implements PersistenceStrategy {
  async save(key: string, data: string, options?: PersistenceOptions): Promise<void> {
    try {
      const item = {
        data,
        metadata: options?.metadata || {},
        createdAt: Date.now(),
        ttl: options?.ttl,
      };

      sessionStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error('Session storage quota exceeded');
      }
      throw error;
    }
  }

  async load(key: string): Promise<string | null> {
    const item = sessionStorage.getItem(key);
    if (!item) return null;

    try {
      const parsed = JSON.parse(item);

      // Check TTL
      if (parsed.ttl && Date.now() > parsed.createdAt + parsed.ttl) {
        sessionStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      log.warn('Failed to parse session storage item', {
        component: 'ViewportStatePersistence.SessionStorage',
        metadata: { key, error: error instanceof Error ? error.message : 'Unknown error' },
      });
      // Remove corrupted item
      sessionStorage.removeItem(key);
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    const existed = sessionStorage.getItem(key) !== null;
    sessionStorage.removeItem(key);
    return existed;
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }

  async clear(): Promise<void> {
    sessionStorage.clear();
  }
}

class LocalStorageStrategy implements PersistenceStrategy {
  async save(key: string, data: string, options?: PersistenceOptions): Promise<void> {
    try {
      let processedData = data;

      // Apply compression if enabled and data exceeds threshold
      if (options?.compress && data.length > 1024) {
        // In a real implementation, you would use a compression library
        processedData = data; // Placeholder
      }

      // Apply encryption if enabled
      if (options?.encrypt) {
        await secureStorage.store(key, processedData, 'viewport-snapshot');
        return;
      }

      const item = {
        data: processedData,
        metadata: options?.metadata || {},
        tags: options?.tags || [],
        createdAt: Date.now(),
        ttl: options?.ttl,
      };

      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error('Local storage quota exceeded');
      }
      throw error;
    }
  }

  async load(key: string): Promise<string | null> {
    // Try encrypted storage first
    try {
      const encryptedData = await secureStorage.retrieve(key);
      if (encryptedData) return encryptedData;
    } catch (error) {
      // Continue to regular storage if secure storage fails
      log.warn('Failed to retrieve from secure storage, falling back to regular storage', {
        component: 'ViewportStatePersistence.SecureStorage',
        metadata: { key, error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    const item = localStorage.getItem(key);
    if (!item) return null;

    try {
      const parsed = JSON.parse(item);

      // Check TTL
      if (parsed.ttl && Date.now() > parsed.createdAt + parsed.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      log.warn('Failed to parse localStorage item', {
        component: 'ViewportStatePersistence.SecureStorage',
        metadata: { key, error: error instanceof Error ? error.message : 'Unknown error' },
      });
      // Remove corrupted item
      localStorage.removeItem(key);
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    // Try removing from encrypted storage
    try {
      await secureStorage.remove(key);
    } catch (error) {
      // Continue to regular storage if secure storage removal fails
      log.warn('Failed to remove from secure storage, continuing with regular storage', {
        component: 'ViewportStatePersistence.SecureStorage',
        metadata: { key, error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    const existed = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    return existed;
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}

// Initialize the default config with proper strategy instances
DEFAULT_PERSISTENCE_CONFIG.strategies.session = new SessionStorageStrategy();
DEFAULT_PERSISTENCE_CONFIG.strategies.local = new LocalStorageStrategy();

// Singleton instance
export const viewportStatePersistence = new ViewportStatePersistence();
