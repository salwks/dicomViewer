/**
 * Viewport Synchronization Hook
 * React hook for managing viewport synchronization with Cornerstone3D integration
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { viewportSynchronizer } from '../services/ViewportSynchronizer';
import {
  SynchronizationSettings,
  ViewportSyncState,
  SyncType,
  SynchronizationEvent,
} from '../types/dicom';
import { log } from '../utils/logger';

export interface ViewportSynchronizationHookProps {
  viewportId: string;
  enabledSyncTypes?: SyncType[];
  autoRegister?: boolean;
  initialState?: Partial<ViewportSyncState>;
}

export interface ViewportSynchronizationHookReturn {
  // State
  isRegistered: boolean;
  syncSettings: SynchronizationSettings;
  viewportState: ViewportSyncState | null;

  // Window/Level controls
  windowCenter: number;
  windowWidth: number;
  setWindowLevel: (center: number, width: number, triggerSync?: boolean) => void;

  // Zoom controls
  zoom: number;
  setZoom: (zoom: number, triggerSync?: boolean) => void;

  // Pan controls
  pan: [number, number];
  setPan: (pan: [number, number], triggerSync?: boolean) => void;

  // Scroll controls
  scrollIndex: number;
  setScrollIndex: (index: number, triggerSync?: boolean) => void;

  // Orientation controls
  orientation?: 'AXIAL' | 'SAGITTAL' | 'CORONAL';
  setOrientation: (orientation: 'AXIAL' | 'SAGITTAL' | 'CORONAL', triggerSync?: boolean) => void;

  // Registration controls
  register: () => void;
  unregister: () => void;

  // Sync group management
  joinSyncGroup: (groupId: string) => void;
  leaveSyncGroup: (groupId: string) => void;

  // Manual sync triggers
  triggerSync: (syncType: SyncType, data?: Record<string, unknown>) => void;

  // State queries
  isInSyncGroup: (groupId: string) => boolean;
  getSyncGroups: () => string[];
}

export const useViewportSynchronization = ({
  viewportId,
  enabledSyncTypes = ['windowLevel', 'zoom', 'pan', 'scroll'],
  autoRegister = true,
  initialState = {},
}: ViewportSynchronizationHookProps): ViewportSynchronizationHookReturn => {

  const [isRegistered, setIsRegistered] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SynchronizationSettings>(
    viewportSynchronizer.getSyncSettings(),
  );
  const [viewportState, setViewportState] = useState<ViewportSyncState | null>(null);

  // Track if we're currently updating to prevent sync loops
  const isUpdatingRef = useRef(false);

  // Initialize viewport state
  const defaultState = useMemo<ViewportSyncState>(() => ({
    viewportId,
    isSource: false,
    windowCenter: 128,
    windowWidth: 256,
    zoom: 1.0,
    pan: [0, 0],
    scrollIndex: 0,
    lastSyncTime: Date.now(),
    ...initialState,
  }), [viewportId, initialState]);

  // Register viewport with synchronizer
  const register = useCallback(() => {
    if (!isRegistered) {
      viewportSynchronizer.addViewport(viewportId, defaultState);
      setIsRegistered(true);

      log.info('Viewport registered for synchronization', {
        component: 'useViewportSynchronization',
        metadata: { viewportId, enabledSyncTypes },
      });
    }
  }, [viewportId, isRegistered, defaultState, enabledSyncTypes]);

  // Unregister viewport from synchronizer
  const unregister = useCallback(() => {
    if (isRegistered) {
      viewportSynchronizer.removeViewport(viewportId);
      setIsRegistered(false);
      setViewportState(null);

      log.info('Viewport unregistered from synchronization', {
        component: 'useViewportSynchronization',
        metadata: { viewportId },
      });
    }
  }, [viewportId, isRegistered]);

  // Auto-register on mount if enabled
  useEffect(() => {
    if (autoRegister) {
      register();
    }

    return () => {
      if (autoRegister) {
        unregister();
      }
    };
  }, [autoRegister, register, unregister]);

  // Listen for synchronizer events
  useEffect(() => {
    const handleSyncSettingsUpdate = ({ current }: { current: SynchronizationSettings }) => {
      setSyncSettings(current);
    };

    const handleViewportStateUpdate = ({ viewportId: updatedViewportId, state }: {
      viewportId: string;
      state: ViewportSyncState;
    }) => {
      if (updatedViewportId === viewportId && !isUpdatingRef.current) {
        setViewportState(state);
      }
    };

    const handleSynchronizationApplied = (event: SynchronizationEvent) => {
      // Only update if this viewport is a target and sync type is enabled
      if (event.targetViewportIds.includes(viewportId) &&
          enabledSyncTypes.includes(event.type) &&
          !isUpdatingRef.current) {

        const updatedState = viewportSynchronizer.getViewportState(viewportId);
        if (updatedState) {
          setViewportState(updatedState);
        }
      }
    };

    // Subscribe to events
    viewportSynchronizer.on('syncSettingsUpdated', handleSyncSettingsUpdate);
    viewportSynchronizer.on('viewportStateUpdated', handleViewportStateUpdate);
    viewportSynchronizer.on('synchronizationApplied', handleSynchronizationApplied);

    // Initial state sync
    const currentState = viewportSynchronizer.getViewportState(viewportId);
    if (currentState) {
      setViewportState(currentState);
    }

    return () => {
      viewportSynchronizer.off('syncSettingsUpdated', handleSyncSettingsUpdate);
      viewportSynchronizer.off('viewportStateUpdated', handleViewportStateUpdate);
      viewportSynchronizer.off('synchronizationApplied', handleSynchronizationApplied);
    };
  }, [viewportId, enabledSyncTypes]);

  // Window/Level controls
  const setWindowLevel = useCallback((center: number, width: number, triggerSync: boolean = true) => {
    if (!isRegistered) return;

    isUpdatingRef.current = true;

    viewportSynchronizer.updateViewportState(viewportId, {
      windowCenter: center,
      windowWidth: width,
    }, triggerSync && enabledSyncTypes.includes('windowLevel'));

    // Update local state immediately for responsive UI
    setViewportState(prev => prev ? { ...prev, windowCenter: center, windowWidth: width } : null);

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);

    log.info('Window/Level updated', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, center, width, triggerSync },
    });
  }, [viewportId, isRegistered, enabledSyncTypes]);

  // Zoom controls
  const setZoom = useCallback((zoomLevel: number, triggerSync: boolean = true) => {
    if (!isRegistered) return;

    isUpdatingRef.current = true;

    viewportSynchronizer.updateViewportState(viewportId, {
      zoom: zoomLevel,
    }, triggerSync && enabledSyncTypes.includes('zoom'));

    setViewportState(prev => prev ? { ...prev, zoom: zoomLevel } : null);

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);

    log.info('Zoom updated', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, zoom: zoomLevel, triggerSync },
    });
  }, [viewportId, isRegistered, enabledSyncTypes]);

  // Pan controls
  const setPan = useCallback((panValue: [number, number], triggerSync: boolean = true) => {
    if (!isRegistered) return;

    isUpdatingRef.current = true;

    viewportSynchronizer.updateViewportState(viewportId, {
      pan: panValue,
    }, triggerSync && enabledSyncTypes.includes('pan'));

    setViewportState(prev => prev ? { ...prev, pan: panValue } : null);

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);

    log.info('Pan updated', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, pan: panValue, triggerSync },
    });
  }, [viewportId, isRegistered, enabledSyncTypes]);

  // Scroll controls
  const setScrollIndex = useCallback((index: number, triggerSync: boolean = true) => {
    if (!isRegistered) return;

    isUpdatingRef.current = true;

    viewportSynchronizer.updateViewportState(viewportId, {
      scrollIndex: index,
    }, triggerSync && enabledSyncTypes.includes('scroll'));

    setViewportState(prev => prev ? { ...prev, scrollIndex: index } : null);

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);

    log.info('Scroll index updated', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, scrollIndex: index, triggerSync },
    });
  }, [viewportId, isRegistered, enabledSyncTypes]);

  // Orientation controls
  const setOrientation = useCallback((orientationValue: 'AXIAL' | 'SAGITTAL' | 'CORONAL', triggerSync: boolean = true) => {
    if (!isRegistered) return;

    isUpdatingRef.current = true;

    viewportSynchronizer.updateViewportState(viewportId, {
      orientation: orientationValue,
    }, triggerSync && enabledSyncTypes.includes('orientation'));

    setViewportState(prev => prev ? { ...prev, orientation: orientationValue } : null);

    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);

    log.info('Orientation updated', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, orientation: orientationValue, triggerSync },
    });
  }, [viewportId, isRegistered, enabledSyncTypes]);

  // Sync group management
  const joinSyncGroup = useCallback((groupId: string) => {
    if (!isRegistered) {
      log.warn('Cannot join sync group - viewport not registered', {
        component: 'useViewportSynchronization',
        metadata: { viewportId, groupId },
      });
      return;
    }

    viewportSynchronizer.addViewportToGroup(viewportId, groupId);

    log.info('Joined sync group', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, groupId },
    });
  }, [viewportId, isRegistered]);

  const leaveSyncGroup = useCallback((groupId: string) => {
    if (!isRegistered) return;

    viewportSynchronizer.removeViewportFromGroup(viewportId, groupId);

    log.info('Left sync group', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, groupId },
    });
  }, [viewportId, isRegistered]);

  // Manual sync trigger
  const triggerSync = useCallback((syncType: SyncType, data?: Record<string, unknown>) => {
    if (!isRegistered || !enabledSyncTypes.includes(syncType)) return;

    const syncData = data || {};

    // Add current state values if not provided
    if (viewportState) {
      if (syncType === 'windowLevel' && !syncData.windowCenter && !syncData.windowWidth) {
        syncData.windowCenter = viewportState.windowCenter;
        syncData.windowWidth = viewportState.windowWidth;
      } else if (syncType === 'zoom' && !syncData.zoom) {
        syncData.zoom = viewportState.zoom;
      } else if (syncType === 'pan' && !syncData.pan) {
        syncData.pan = viewportState.pan;
      } else if (syncType === 'scroll' && !syncData.scrollIndex) {
        syncData.scrollIndex = viewportState.scrollIndex;
      } else if (syncType === 'orientation' && !syncData.orientation) {
        syncData.orientation = viewportState.orientation;
      }
    }

    viewportSynchronizer.synchronize(syncType, viewportId, syncData);

    log.info('Manual sync triggered', {
      component: 'useViewportSynchronization',
      metadata: { viewportId, syncType, data: syncData },
    });
  }, [viewportId, isRegistered, enabledSyncTypes, viewportState]);

  // State queries
  const isInSyncGroup = useCallback((groupId: string) => {
    return viewportSynchronizer.isViewportInGroup(viewportId, groupId);
  }, [viewportId]);

  const getSyncGroups = useCallback(() => {
    return viewportSynchronizer.getViewportGroups(viewportId);
  }, [viewportId]);

  return {
    // State
    isRegistered,
    syncSettings,
    viewportState,

    // Window/Level controls
    windowCenter: viewportState?.windowCenter || defaultState.windowCenter,
    windowWidth: viewportState?.windowWidth || defaultState.windowWidth,
    setWindowLevel,

    // Zoom controls
    zoom: viewportState?.zoom || defaultState.zoom,
    setZoom,

    // Pan controls
    pan: viewportState?.pan || defaultState.pan,
    setPan,

    // Scroll controls
    scrollIndex: viewportState?.scrollIndex || defaultState.scrollIndex,
    setScrollIndex,

    // Orientation controls
    orientation: viewportState?.orientation,
    setOrientation,

    // Registration controls
    register,
    unregister,

    // Sync group management
    joinSyncGroup,
    leaveSyncGroup,

    // Manual sync triggers
    triggerSync,

    // State queries
    isInSyncGroup,
    getSyncGroups,
  };
};
