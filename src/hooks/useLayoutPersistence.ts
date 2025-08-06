/**
 * Layout Persistence Hook
 * React hook for managing layout state persistence
 */

import { useCallback, useEffect, useState } from 'react';
import { layoutStatePersistence, type StoredLayoutState } from '../services/LayoutStatePersistence';
import { type ViewerState } from '../types';
import { log } from '../utils/logger';

export interface UseLayoutPersistenceReturn {
  // State
  storedLayouts: StoredLayoutState[];
  isLoading: boolean;
  error: string | null;

  // Actions
  saveLayout: (name: string, state: Pick<ViewerState, 'layout' | 'viewports' | 'synchronization' | 'tools'>) => Promise<string | null>;
  loadLayout: (id: string) => Promise<StoredLayoutState | null>;
  deleteLayout: (id: string) => Promise<boolean>;
  refreshStoredLayouts: () => Promise<void>;
  clearAllLayouts: () => Promise<void>;
  exportLayouts: () => Promise<string | null>;
  importLayouts: (jsonData: string) => Promise<number>;
}

export function useLayoutPersistence(): UseLayoutPersistenceReturn {
  const [storedLayouts, setStoredLayouts] = useState<StoredLayoutState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load stored layouts on mount
  const refreshStoredLayouts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const layouts = await layoutStatePersistence.getAllStoredStates();
      setStoredLayouts(layouts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load stored layouts';
      setError(errorMessage);
      log.error('Failed to refresh stored layouts', {
        component: 'useLayoutPersistence',
      }, err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save layout
  const saveLayout = useCallback(async (
    name: string,
    state: Pick<ViewerState, 'layout' | 'viewports' | 'synchronization' | 'tools'>,
  ): Promise<string | null> => {
    try {
      setError(null);
      const id = await layoutStatePersistence.saveLayoutState(name, state);
      await refreshStoredLayouts(); // Refresh list
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save layout';
      setError(errorMessage);
      log.error('Failed to save layout', {
        component: 'useLayoutPersistence',
        metadata: { name },
      }, err as Error);
      return null;
    }
  }, [refreshStoredLayouts]);

  // Load layout
  const loadLayout = useCallback(async (id: string): Promise<StoredLayoutState | null> => {
    try {
      setError(null);
      const layout = await layoutStatePersistence.loadLayoutState(id);
      if (layout) {
        await refreshStoredLayouts(); // Refresh to update lastUsed timestamp
      }
      return layout;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load layout';
      setError(errorMessage);
      log.error('Failed to load layout', {
        component: 'useLayoutPersistence',
        metadata: { id },
      }, err as Error);
      return null;
    }
  }, [refreshStoredLayouts]);

  // Delete layout
  const deleteLayout = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await layoutStatePersistence.deleteLayoutState(id);
      if (success) {
        await refreshStoredLayouts(); // Refresh list
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete layout';
      setError(errorMessage);
      log.error('Failed to delete layout', {
        component: 'useLayoutPersistence',
        metadata: { id },
      }, err as Error);
      return false;
    }
  }, [refreshStoredLayouts]);

  // Clear all layouts
  const clearAllLayouts = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await layoutStatePersistence.clearAllStates();
      setStoredLayouts([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear layouts';
      setError(errorMessage);
      log.error('Failed to clear all layouts', {
        component: 'useLayoutPersistence',
      }, err as Error);
    }
  }, []);

  // Export layouts
  const exportLayouts = useCallback(async (): Promise<string | null> => {
    try {
      setError(null);
      return await layoutStatePersistence.exportLayoutStates();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export layouts';
      setError(errorMessage);
      log.error('Failed to export layouts', {
        component: 'useLayoutPersistence',
      }, err as Error);
      return null;
    }
  }, []);

  // Import layouts
  const importLayouts = useCallback(async (jsonData: string): Promise<number> => {
    try {
      setError(null);
      const count = await layoutStatePersistence.importLayoutStates(jsonData);
      await refreshStoredLayouts(); // Refresh list
      return count;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import layouts';
      setError(errorMessage);
      log.error('Failed to import layouts', {
        component: 'useLayoutPersistence',
      }, err as Error);
      return 0;
    }
  }, [refreshStoredLayouts]);

  // Load stored layouts on mount
  useEffect(() => {
    refreshStoredLayouts();
  }, [refreshStoredLayouts]);

  // Listen to persistence events
  useEffect(() => {
    const onLayoutSaved = () => refreshStoredLayouts();
    const onLayoutDeleted = () => refreshStoredLayouts();
    const onLayoutsCleared = () => setStoredLayouts([]);
    const onLayoutsImported = () => refreshStoredLayouts();

    layoutStatePersistence.on('layoutSaved', onLayoutSaved);
    layoutStatePersistence.on('layoutDeleted', onLayoutDeleted);
    layoutStatePersistence.on('allLayoutsCleared', onLayoutsCleared);
    layoutStatePersistence.on('layoutsImported', onLayoutsImported);

    return () => {
      layoutStatePersistence.off('layoutSaved', onLayoutSaved);
      layoutStatePersistence.off('layoutDeleted', onLayoutDeleted);
      layoutStatePersistence.off('allLayoutsCleared', onLayoutsCleared);
      layoutStatePersistence.off('layoutsImported', onLayoutsImported);
    };
  }, [refreshStoredLayouts]);

  return {
    storedLayouts,
    isLoading,
    error,
    saveLayout,
    loadLayout,
    deleteLayout,
    refreshStoredLayouts,
    clearAllLayouts,
    exportLayouts,
    importLayouts,
  };
}
