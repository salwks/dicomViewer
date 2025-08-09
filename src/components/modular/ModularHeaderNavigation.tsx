/**
 * ModularHeaderNavigation - Modular header navigation component
 * Uses the module system for better separation of concerns
 */

import React, { useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Settings } from 'lucide-react';
import { useModuleManager } from '../../context/ModuleContext';
import { log } from '../../utils/logger';

interface ModularHeaderNavigationProps {
  className?: string;
  onTestModeToggle?: () => void;
  showTestButton?: boolean;
}

export const ModularHeaderNavigation: React.FC<ModularHeaderNavigationProps> = ({
  className,
  onTestModeToggle,
  showTestButton = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { moduleManager, isInitialized } = useModuleManager();

  const handleDicomUpload = useCallback(async () => {
    log.info('DICOM Upload initiated', { component: 'ModularHeaderNavigation' });
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !moduleManager || !isInitialized) {
      return;
    }

    try {
      const fileArray = Array.from(files);
      
      // Use module manager to load and display DICOM
      // For now, we'll use a hardcoded viewport ID
      // In a real implementation, this would be dynamic
      await moduleManager.loadAndDisplayDicom(fileArray, 'viewport-1');

      log.info('DICOM files loaded via ModuleManager', {
        component: 'ModularHeaderNavigation',
        metadata: { fileCount: fileArray.length },
      });

      // Emit event for other components
      window.dispatchEvent(new CustomEvent('dicom-files-loaded', {
        detail: { fileCount: fileArray.length },
      }));
    } catch (error) {
      log.error(
        'Failed to load DICOM files',
        { component: 'ModularHeaderNavigation' },
        error as Error,
      );
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [moduleManager, isInitialized]);

  return (
    <Card
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <div className='flex h-16 items-center justify-between px-6'>
        {/* Logo and branding */}
        <div className='flex items-center space-x-4'>
          <div className='flex items-center space-x-3'>
            <div className='h-8 w-8 rounded-md bg-primary flex items-center justify-center'>
              <span className='text-primary-foreground font-bold text-sm'>C3D</span>
            </div>
            <div>
              <h1 className='font-semibold text-lg'>Modular Viewer</h1>
              <p className='text-xs text-muted-foreground'>Module-based Architecture</p>
            </div>
          </div>
        </div>

        {/* Right action buttons */}
        <div className='flex items-center space-x-2'>
          {showTestButton && onTestModeToggle && (
            <Button variant='secondary' size='sm' onClick={onTestModeToggle}>
              DICOM Test
            </Button>
          )}
          <Button variant='outline' size='sm' className='gap-2'>
            <Settings className='h-4 w-4' />
            <span className='hidden sm:inline'>Settings</span>
          </Button>
          <Button 
            size='sm' 
            onClick={handleDicomUpload}
            disabled={!isInitialized}
          >
            {isInitialized ? 'Open DICOM' : 'Initializing...'}
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept='.dcm,.dicom,application/dicom'
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </Card>
  );
};