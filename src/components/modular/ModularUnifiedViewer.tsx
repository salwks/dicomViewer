/**
 * ModularUnifiedViewer - Modular unified viewer
 * Demonstrates module-based architecture with loose coupling
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { ModuleProvider } from '../../context/ModuleContext';
import { ModularHeaderNavigation } from './ModularHeaderNavigation';
import { ModularViewport } from './ModularViewport';
import { ErrorBoundary } from '../ErrorBoundary';
import type { ModuleManagerConfig } from '../../modules/ModuleManager';

interface ModularUnifiedViewerProps {
  className?: string;
  onTestModeToggle?: () => void;
}

// Module configuration
const moduleConfig: ModuleManagerConfig = {
  viewer: {
    renderingEngineId: 'modular-rendering-engine',
    viewportIdPrefix: 'viewport',
    maxViewports: 4,
  },
  dicomLoader: {
    maxConcurrentLoads: 4,
    enableCaching: true,
  },
};

const ModularViewerContent: React.FC<ModularUnifiedViewerProps> = ({
  className,
  onTestModeToggle,
}) => {
  const [activeViewports] = useState(['viewport-1']); // For now, just one viewport

  return (
    <div className={cn('h-screen w-full flex flex-col bg-background', className)}>
      {/* Header */}
      <ModularHeaderNavigation onTestModeToggle={onTestModeToggle} />

      {/* Main content area */}
      <div className='flex-1 flex min-h-0'>
        {/* Viewport area */}
        <div className='flex-1 p-4'>
          <div className='h-full grid grid-cols-1 gap-4'>
            {activeViewports.map(viewportId => (
              <ModularViewport
                key={viewportId}
                viewportId={viewportId}
                className='rounded-lg border border-border'
              />
            ))}
          </div>
        </div>

        {/* Side panel placeholder */}
        <div className='w-80 bg-background border-l border-border p-4'>
          <h3 className='font-semibold mb-4'>Module Information</h3>
          <div className='space-y-2 text-sm text-muted-foreground'>
            <p>✓ Viewer Core Module</p>
            <p>✓ DICOM Loader Module</p>
            <p>◯ Tools Module (Coming soon)</p>
            <p>◯ Annotations Module (Coming soon)</p>
            <p>◯ Synchronization Module (Coming soon)</p>
          </div>
        </div>
      </div>

      {/* Status bar placeholder */}
      <div className='h-8 border-t border-border px-4 flex items-center text-xs text-muted-foreground'>
        <span>Modular Architecture Demo</span>
      </div>
    </div>
  );
};

export const ModularUnifiedViewer: React.FC<ModularUnifiedViewerProps> = (props) => {
  return (
    <ErrorBoundary>
      <ModuleProvider config={moduleConfig}>
        <ModularViewerContent {...props} />
      </ModuleProvider>
    </ErrorBoundary>
  );
};