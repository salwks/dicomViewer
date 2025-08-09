/**
 * ModularViewport - Modular viewport component
 * Uses the viewer engine module for rendering
 */

import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useViewerEngine } from '../../context/ModuleContext';
import { ViewportType } from '@cornerstonejs/core/dist/types/enums';
import { log } from '../../utils/logger';

interface ModularViewportProps {
  viewportId: string;
  className?: string;
  onViewportReady?: (viewportId: string) => void;
}

export const ModularViewport: React.FC<ModularViewportProps> = ({
  viewportId,
  className,
  onViewportReady,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const viewerEngine = useViewerEngine();

  useEffect(() => {
    if (!elementRef.current || !viewerEngine) {
      return;
    }

    const element = elementRef.current;
    let isViewportCreated = false;

    const createViewport = async () => {
      try {
        await viewerEngine.createViewport({
          viewportId,
          element,
          viewportType: ViewportType.STACK,
        });

        isViewportCreated = true;
        onViewportReady?.(viewportId);

        log.info('Modular viewport created', {
          component: 'ModularViewport',
          metadata: { viewportId },
        });
      } catch (error) {
        log.error(
          'Failed to create modular viewport',
          { component: 'ModularViewport', metadata: { viewportId } },
          error as Error,
        );
      }
    };

    createViewport();

    return () => {
      if (isViewportCreated) {
        viewerEngine.removeViewport(viewportId);
      }
    };
  }, [viewportId, viewerEngine, onViewportReady]);

  return (
    <div
      ref={elementRef}
      className={cn(
        'relative w-full h-full bg-black',
        'overflow-hidden',
        className,
      )}
      data-viewport-id={viewportId}
    >
      {/* Viewport content will be rendered by Cornerstone */}
    </div>
  );
};