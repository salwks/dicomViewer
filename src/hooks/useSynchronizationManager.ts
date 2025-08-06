/**
 * Synchronization Manager Hook
 * Layout-based synchronization management for medical imaging viewers
 * Automatically enables/disables based on viewport count
 */

import { useCallback, useMemo } from 'react';
import { useViewer, useViewerLayout, useSynchronization } from '../context/ViewerContext';
import { isMultiViewport } from '../utils/layoutUtils';
import { log } from '../utils/logger';
import { safePropertyAccess } from '../lib/utils';

/**
 * Synchronization type definition
 */
export type SynchronizationType = 'camera' | 'slice' | 'windowLevel';

/**
 * Synchronization manager hook return type
 */
export interface SynchronizationManagerReturn {
  // Current state
  isEnabled: boolean;
  isAvailable: boolean;
  synchronization: {
    camera: boolean;
    slice: boolean;
    windowLevel: boolean;
  };

  // Actions
  toggleSynchronization: (type?: SynchronizationType) => void;
  enableSynchronization: () => void;
  disableSynchronization: () => void;
  setSynchronizationType: (type: SynchronizationType, enabled: boolean) => void;

  // Utilities
  isSynchronizationSupported: () => boolean;
  getSynchronizationStatus: () => SynchronizationStatus;
  getAvailableTypes: () => SynchronizationType[];
}

/**
 * Synchronization status interface
 */
export interface SynchronizationStatus {
  available: boolean;
  enabled: boolean;
  activeTypes: SynchronizationType[];
  reason?: string;
}

/**
 * Synchronization configuration
 */
const SYNCHRONIZATION_CONFIG = {
  minViewportsRequired: 2,
  defaultTypes: {
    camera: true,
    slice: true,
    windowLevel: false,
  },
  availableTypes: ['camera', 'slice', 'windowLevel'] as SynchronizationType[],
} as const;

/**
 * Synchronization manager hook
 */
export const useSynchronizationManager = (): SynchronizationManagerReturn => {
  const { toggleSynchronization: toggle } = useViewer();
  const layout = useViewerLayout();
  const { synchronization, isEnabled } = useSynchronization();

  // Memoized availability check based on layout
  const isAvailable = useMemo(() => {
    return isMultiViewport(layout);
  }, [layout]);

  // Check if synchronization is supported
  const isSynchronizationSupported = useCallback((): boolean => {
    return isAvailable;
  }, [isAvailable]);

  // Toggle synchronization with automatic availability check
  const toggleSynchronization = useCallback(
    (type?: SynchronizationType) => {
      if (!isAvailable) {
        log.warn('Synchronization not available with current layout', {
          component: 'useSynchronizationManager',
          layout,
        });
        return;
      }

      toggle(type);

      log.info('Synchronization toggled', {
        component: 'useSynchronizationManager',
        metadata: { type, layout },
      });
    },
    [isAvailable, toggle, layout],
  );

  // Enable all synchronization
  const enableSynchronization = useCallback(() => {
    if (!isAvailable) {
      log.warn('Cannot enable synchronization: not available', {
        component: 'useSynchronizationManager',
        layout,
      });
      return;
    }

    // Enable synchronization if not already enabled
    if (!isEnabled) {
      toggle();
    }
  }, [isAvailable, isEnabled, toggle, layout]);

  // Disable all synchronization
  const disableSynchronization = useCallback(() => {
    if (isEnabled) {
      toggle();
    }
  }, [isEnabled, toggle]);

  // Set specific synchronization type
  const setSynchronizationType = useCallback(
    (type: SynchronizationType, enabled: boolean) => {
      if (!isAvailable) {
        log.warn('Cannot set synchronization type: not available', {
          component: 'useSynchronizationManager',
          type,
          enabled,
          layout,
        });
        return;
      }

      const currentlyEnabled = safePropertyAccess(synchronization.types, type);
      if (currentlyEnabled !== enabled) {
        toggle(type);
      }
    },
    [isAvailable, synchronization.types, toggle, layout],
  );

  // Get synchronization status
  const getSynchronizationStatus = useCallback((): SynchronizationStatus => {
    if (!isAvailable) {
      return {
        available: false,
        enabled: false,
        activeTypes: [],
        reason: 'Multiple viewports required for synchronization',
      };
    }

    const activeTypes = SYNCHRONIZATION_CONFIG.availableTypes.filter(type =>
      // eslint-disable-next-line security/detect-object-injection -- Safe: type is from SYNCHRONIZATION_CONFIG.availableTypes array
      synchronization.types[type],
    );

    return {
      available: true,
      enabled: isEnabled,
      activeTypes,
    };
  }, [isAvailable, isEnabled, synchronization.types]);

  // Get available synchronization types
  const getAvailableTypes = useCallback((): SynchronizationType[] => {
    return isAvailable ? [...SYNCHRONIZATION_CONFIG.availableTypes] : [];
  }, [isAvailable]);

  return {
    // Current state
    isEnabled,
    isAvailable,
    synchronization: synchronization.types,

    // Actions
    toggleSynchronization,
    enableSynchronization,
    disableSynchronization,
    setSynchronizationType,

    // Utilities
    isSynchronizationSupported,
    getSynchronizationStatus,
    getAvailableTypes,
  };
};

/**
 * Hook for managing synchronization UI components
 */
export const useSynchronizationUI = () => {
  const {
    isEnabled,
    isAvailable,
    synchronization,
    toggleSynchronization,
    setSynchronizationType,
    getSynchronizationStatus,
  } = useSynchronizationManager();

  // Get button variant for shadcn/ui Button component
  const getButtonVariant = useCallback(
    (type?: SynchronizationType) => {
      if (!isAvailable) return 'ghost';

      if (type) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: type is validated SynchronizationType parameter
        return synchronization[type] ? 'default' : 'outline';
      }

      return isEnabled ? 'default' : 'outline';
    },
    [isAvailable, isEnabled, synchronization],
  );

  // Get button disabled state
  const getButtonDisabled = useCallback(() => {
    return !isAvailable;
  }, [isAvailable]);

  // Get tooltip text for disabled state
  const getTooltipText = useCallback(
    (type?: SynchronizationType) => {
      if (!isAvailable) {
        return '다중 뷰포트 레이아웃에서 사용 가능합니다';
      }

      if (type) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: type is validated SynchronizationType parameter
        return synchronization[type]
          ? `${getSyncTypeDisplayName(type)} 동기화 비활성화`
          : `${getSyncTypeDisplayName(type)} 동기화 활성화`;
      }

      return isEnabled ? '동기화 비활성화' : '동기화 활성화';
    },
    [isAvailable, isEnabled, synchronization],
  );

  // Get badge variant for status display
  const getBadgeVariant = useCallback(() => {
    if (!isAvailable) return 'outline';
    return isEnabled ? 'default' : 'secondary';
  }, [isAvailable, isEnabled]);

  return {
    isEnabled,
    isAvailable,
    synchronization,
    toggleSynchronization,
    setSynchronizationType,
    getSynchronizationStatus,

    // UI utilities
    getButtonVariant,
    getButtonDisabled,
    getTooltipText,
    getBadgeVariant,
  };
};

/**
 * Get display name for synchronization type
 */
const getSyncTypeDisplayName = (type: SynchronizationType): string => {
  switch (type) {
    case 'camera':
      return '카메라';
    case 'slice':
      return '슬라이스';
    case 'windowLevel':
      return '윈도우/레벨';
    default:
      return type;
  }
};
