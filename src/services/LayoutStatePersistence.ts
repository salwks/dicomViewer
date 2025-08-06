/**
 * Layout State Persistence Service
 * Handles saving/loading layout configurations to/from local storage
 */

import { EventEmitter } from 'events';
import { ViewerState, ViewerLayout } from '../types';
import { secureStorage } from '../security/secureStorage';
import { log } from '../utils/logger';

export interface LayoutPersistenceConfig {
  storageKey: string;
  autoSave: boolean;
  maxStoredLayouts: number;
  encryptData: boolean;
}

export interface StoredLayoutState {
  id: string;
  name: string;
  layout: ViewerLayout;
  viewports: ViewerState['viewports'];
  synchronization: ViewerState['synchronization'];
  tools: ViewerState['tools'];
  createdAt: string;
  lastUsed: string;
}

export const DEFAULT_PERSISTENCE_CONFIG: LayoutPersistenceConfig = {
  storageKey: 'viewer-layout-state',
  autoSave: true,
  maxStoredLayouts: 10,
  encryptData: true,
};

export class LayoutStatePersistence extends EventEmitter {
  private config: LayoutPersistenceConfig;
  private autoSaveTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<LayoutPersistenceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
  }

  // Save current layout state
  public async saveLayoutState(
    name: string,
    state: Pick<ViewerState, 'layout' | 'viewports' | 'synchronization' | 'tools'>,
  ): Promise<string> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const storedState: StoredLayoutState = {
        id,
        name,
        layout: state.layout,
        viewports: state.viewports,
        synchronization: state.synchronization,
        tools: state.tools,
        createdAt: now,
        lastUsed: now,
      };

      const existingStates = await this.getAllStoredStates();
      const updatedStates = [storedState, ...existingStates.slice(0, this.config.maxStoredLayouts - 1)];

      await this.saveStates(updatedStates);
      this.emit('layoutSaved', storedState);

      log.info('Layout state saved', {
        component: 'LayoutStatePersistence',
        metadata: { name, id },
      });

      return id;
    } catch (err) {
      log.error('Failed to save layout state', {
        component: 'LayoutStatePersistence',
        metadata: { name },
      }, err as Error);
      throw err;
    }
  }

  // Load layout state by ID
  public async loadLayoutState(id: string): Promise<StoredLayoutState | null> {
    try {
      const states = await this.getAllStoredStates();
      const state = states.find(s => s.id === id);

      if (state) {
        // Update last used timestamp
        state.lastUsed = new Date().toISOString();
        await this.saveStates(states);
        this.emit('layoutLoaded', state);
      }

      return state || null;
    } catch (error) {
      log.error('Failed to load layout state', {
        component: 'LayoutStatePersistence',
        metadata: { id },
      }, error as Error);
      return null;
    }
  }

  // Get all stored layout states
  public async getAllStoredStates(): Promise<StoredLayoutState[]> {
    try {
      if (this.config.encryptData) {
        const encrypted = await secureStorage.retrieve(this.config.storageKey);
        return encrypted ? JSON.parse(encrypted) : [];
      } else {
        const data = localStorage.getItem(this.config.storageKey);
        return data ? JSON.parse(data) : [];
      }
    } catch {
      log.warn('Failed to load stored states, returning empty array', {
        component: 'LayoutStatePersistence',
      });
      return [];
    }
  }

  // Delete layout state
  public async deleteLayoutState(id: string): Promise<boolean> {
    try {
      const states = await this.getAllStoredStates();
      const filteredStates = states.filter(s => s.id !== id);

      if (filteredStates.length < states.length) {
        await this.saveStates(filteredStates);
        this.emit('layoutDeleted', id);
        return true;
      }
      return false;
    } catch (err) {
      log.error('Failed to delete layout state', {
        component: 'LayoutStatePersistence',
        metadata: { id },
      }, err as Error);
      return false;
    }
  }

  // Auto-save with debouncing
  public scheduleAutoSave(
    state: Pick<ViewerState, 'layout' | 'viewports' | 'synchronization' | 'tools'>,
  ): void {
    if (!this.config.autoSave) return;

    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(async () => {
      try {
        await this.saveLayoutState('Auto Save', state);
      } catch {
        log.warn('Auto-save failed', {
          component: 'LayoutStatePersistence',
        });
      }
    }, 2000); // 2 second debounce
  }

  // Export layout states
  public async exportLayoutStates(): Promise<string> {
    const states = await this.getAllStoredStates();
    return JSON.stringify(states, null, 2);
  }

  // Import layout states
  public async importLayoutStates(jsonData: string): Promise<number> {
    try {
      const importedStates = JSON.parse(jsonData) as StoredLayoutState[];

      // Validate imported data
      const validStates = importedStates.filter(this.validateStoredState);

      if (validStates.length === 0) {
        throw new Error('No valid layout states found in import data');
      }

      // Merge with existing states
      const existingStates = await this.getAllStoredStates();
      const mergedStates = [...validStates, ...existingStates]
        .slice(0, this.config.maxStoredLayouts);

      await this.saveStates(mergedStates);
      this.emit('layoutsImported', validStates.length);

      return validStates.length;
    } catch (err) {
      log.error('Failed to import layout states', {
        component: 'LayoutStatePersistence',
      }, err as Error);
      throw err;
    }
  }

  // Clear all stored states
  public async clearAllStates(): Promise<void> {
    try {
      if (this.config.encryptData) {
        await secureStorage.remove(this.config.storageKey);
      } else {
        localStorage.removeItem(this.config.storageKey);
      }
      this.emit('allLayoutsCleared');
    } catch (error) {
      log.error('Failed to clear layout states', {
        component: 'LayoutStatePersistence',
      }, error as Error);
      throw error;
    }
  }

  // Private methods
  private async saveStates(states: StoredLayoutState[]): Promise<void> {
    try {
      const data = JSON.stringify(states);

      if (this.config.encryptData) {
        await secureStorage.store(this.config.storageKey, data, 'layout-state');
      } else {
        localStorage.setItem(this.config.storageKey, data);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Handle storage quota exceeded
        await this.cleanupOldStates();
        // Retry with fewer states
        const reducedStates = states.slice(0, Math.floor(this.config.maxStoredLayouts / 2));
        await this.saveStates(reducedStates);
      } else {
        throw error;
      }
    }
  }

  private async cleanupOldStates(): Promise<void> {
    const states = await this.getAllStoredStates();
    const sortedStates = states
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, Math.floor(this.config.maxStoredLayouts / 2));

    await this.saveStates(sortedStates);
    this.emit('layoutsCleanedUp', states.length - sortedStates.length);
  }

  private validateStoredState(state: any): state is StoredLayoutState {
    return (
      typeof state === 'object' &&
      state !== null &&
      typeof state.id === 'string' &&
      typeof state.name === 'string' &&
      typeof state.layout === 'object' &&
      typeof state.layout.rows === 'number' &&
      typeof state.layout.cols === 'number' &&
      typeof state.viewports === 'object' &&
      typeof state.synchronization === 'object' &&
      typeof state.tools === 'object' &&
      typeof state.createdAt === 'string' &&
      typeof state.lastUsed === 'string'
    );
  }

  private generateId(): string {
    return `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  public dispose(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    this.removeAllListeners();
  }
}

// Singleton instance
export const layoutStatePersistence = new LayoutStatePersistence();
