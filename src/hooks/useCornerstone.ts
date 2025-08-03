/**
 * Cornerstone3D Status Hook
 * Checks if Cornerstone3D is already initialized (no longer performs initialization)
 * Initialization is handled centrally by cornerstoneInit.ts
 */

import { useEffect, useState } from 'react';
import { isCornerstoneInitialized } from '../services/cornerstoneInit';
import { log } from '../utils/logger';

export const useCornerstone = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if Cornerstone is already initialized
    const checkInitialization = () => {
      const initialized = isCornerstoneInitialized();
      setIsInitialized(initialized);
      
      if (initialized) {
        log.info('Cornerstone3D initialization confirmed', {
          component: 'useCornerstone',
        });
      } else {
        log.warn('Cornerstone3D not yet initialized', {
          component: 'useCornerstone',
        });
      }
    };

    checkInitialization();

    // Check periodically until initialized
    const interval = setInterval(() => {
      if (!isInitialized && isCornerstoneInitialized()) {
        setIsInitialized(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isInitialized]);

  return { isInitialized };
};
