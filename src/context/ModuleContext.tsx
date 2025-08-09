/**
 * ModuleContext - React context for module management
 * Provides access to modular functionality throughout the app
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ModuleManager, type ModuleManagerConfig } from '../modules/ModuleManager';
import { log } from '../utils/logger';

interface ModuleContextValue {
  moduleManager: ModuleManager | null;
  isInitialized: boolean;
  error: Error | null;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

export interface ModuleProviderProps {
  children: React.ReactNode;
  config: ModuleManagerConfig;
}

export const ModuleProvider: React.FC<ModuleProviderProps> = ({ children, config }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const moduleManagerRef = useRef<ModuleManager | null>(null);

  useEffect(() => {
    const initializeModules = async () => {
      try {
        log.info('Initializing ModuleManager', { component: 'ModuleProvider' });

        const manager = new ModuleManager(config);
        moduleManagerRef.current = manager;

        // Setup event listeners
        manager.on('modules:initialized', () => {
          setIsInitialized(true);
        });

        manager.on('modules:error', ({ error }) => {
          setError(error);
        });

        // Initialize
        await manager.initialize();
      } catch (err) {
        log.error(
          'Failed to initialize ModuleManager',
          { component: 'ModuleProvider' },
          err as Error,
        );
        setError(err as Error);
      }
    };

    initializeModules();

    return () => {
      if (moduleManagerRef.current) {
        moduleManagerRef.current.destroy();
      }
    };
  }, [config]);

  const value: ModuleContextValue = {
    moduleManager: moduleManagerRef.current,
    isInitialized,
    error,
  };

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
};

/**
 * Hook to access module manager
 */
export const useModuleManager = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModuleManager must be used within ModuleProvider');
  }
  return context;
};

/**
 * Hook to access viewer engine
 */
export const useViewerEngine = () => {
  const { moduleManager } = useModuleManager();
  if (!moduleManager) {
    throw new Error('ModuleManager not initialized');
  }
  return moduleManager.getViewerEngine();
};

/**
 * Hook to access DICOM loader
 */
export const useDicomLoader = () => {
  const { moduleManager } = useModuleManager();
  if (!moduleManager) {
    throw new Error('ModuleManager not initialized');
  }
  return moduleManager.getDicomLoader();
};