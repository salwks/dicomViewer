/**
 * DICOM Viewer Component (Simplified)
 * Displays DICOM images using Cornerstone3D with separated concerns
 */

import React, { useEffect, useRef, useState } from 'react';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { simpleDicomLoader } from '../../services/simpleDicomLoader';
// Removed ToolType import as it's not needed with the new interface
import { log } from '../../utils/logger';
import { AnnotationCompatLayer } from '../../types/annotation-compat';
import { useToolSetup } from './hooks/useToolSetup';
import { useViewportSetup } from './hooks/useViewportSetup';
import { useImageNavigation } from './hooks/useImageNavigation';
import { StackScrollIndicator } from '../StackScrollIndicator';
import { viewportOptimizer, RenderPriority } from '../../services/viewportOptimizer';
import { memoryManager } from '../../services/memoryManager';
import { Button } from '../ui/button';
// Priority manager is integrated via ViewportOptimizer
// Removed CSS imports as we're using Tailwind CSS instead

const { annotation } = cornerstoneTools;

const { ToolGroupManager } = cornerstoneTools;

interface DicomViewerProps {
  seriesInstanceUID?: string;
  imageIds?: string[];
  renderingEngineId?: string;
  viewportId?: string;
}

export interface DicomViewerRef {
  setActiveTool: (tool: string) => void;
  getActiveTool: () => string;
}

const DicomViewerComponent = React.forwardRef<DicomViewerRef, DicomViewerProps>(
  ({ seriesInstanceUID, imageIds: propImageIds, renderingEngineId: customRenderingEngineId, viewportId: customViewportId }, ref) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageIds, setImageIds] = useState<string[]>([]);
    const [currentActiveTool, setCurrentActiveTool] = useState<string>('windowLevel');
    const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

    // Track component mount/unmount
    React.useEffect(() => {
      console.info('🚀 DicomViewer MOUNTED', { seriesInstanceUID });
      return () => {
        console.info('💀 DicomViewer UNMOUNTED', { seriesInstanceUID });
      };
    }, [seriesInstanceUID]);

    // Track all prop changes
    React.useEffect(() => {
      console.info('🔄 DicomViewer props changed', { seriesInstanceUID, propImageIds });
    }, [seriesInstanceUID, propImageIds]);

    // Viewport and tool IDs
    const renderingEngineId = customRenderingEngineId || 'mainRenderingEngine';
    const viewportId = customViewportId || 'CT_VIEWPORT';
    const toolGroupId = `TOOL_GROUP_${viewportId}`;

    // Custom hooks
    const { setupTools, setActiveTool: setActiveToolHook } = useToolSetup(toolGroupId);
    const { setupViewport, destroyViewport, getRenderingEngine } = useViewportSetup(renderingEngineId, viewportId);
    const { currentImageIndex, navigateToNext, navigateToPrevious, canNavigateNext, canNavigatePrevious, navigateToIndex } =
      useImageNavigation(imageIds);

    // Load image IDs for the series
    useEffect(() => {
      if (seriesInstanceUID) {
        const seriesImageIds = simpleDicomLoader.getImageIdsForSeries(seriesInstanceUID);
        setImageIds(seriesImageIds);

        log.info('Loading images for series', {
          component: 'DicomViewer',
          metadata: {
            seriesInstanceUID,
            imageCount: seriesImageIds.length,
            imageIds: seriesImageIds,
          },
        });
      } else if (propImageIds) {
        setImageIds(propImageIds);
      } else {
        setImageIds([]);
      }
    }, [seriesInstanceUID, propImageIds]);

    // Mouse click handler for annotation selection
    useEffect(() => {
      const handleMouseClick = async (event: MouseEvent) => {
        const element = viewportRef.current;
        if (!element || !element.contains(event.target as Node)) return;

        try {
          const renderingEngine = getRenderingEngine();
          if (!renderingEngine) return;

          const viewport = renderingEngine.getViewport(viewportId);
          if (!viewport) return;

          // Get click coordinates relative to the canvas
          const rect = element.getBoundingClientRect();
          const canvasPos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };

          // Convert canvas coordinates to world coordinates
          const worldPos = viewport.canvasToWorld([canvasPos.x, canvasPos.y]);

          console.info('🖱️ Mouse click at canvas:', canvasPos, 'world:', worldPos);

          // Check if we clicked on an annotation by testing proximity to all annotations
          let clickedAnnotation = null;
          let minDistance = Infinity;

          // Get all annotations from all tools - using v3 compatible API
          const toolNames = ['LengthTool', 'BidirectionalTool', 'RectangleROITool', 'EllipticalROITool', 'AngleTool', 'ArrowAnnotateTool', 'ProbeTool', 'PlanarFreehandROITool', 'HeightTool', 'CobbAngleTool', 'DragProbeTool'];

          for (const toolName of toolNames) {
            try {
              // v3 API: getAnnotations(toolName, element) where element should be the viewport element
              const annotations = annotation.state.getAnnotations(toolName, element);
              if (annotations && annotations.length > 0) {
                annotations.forEach((ann: any) => {
                  if (ann.data && ann.data.handles && ann.data.handles.points) {
                    // Check distance to annotation handles
                    ann.data.handles.points.forEach((point: number[]) => {
                      const canvasPoint = viewport.worldToCanvas(point);
                      const distance = Math.sqrt(
                        Math.pow(canvasPoint[0] - canvasPos.x, 2) +
                        Math.pow(canvasPoint[1] - canvasPos.y, 2),
                      );

                      // If click is within 20 pixels of a handle, consider it clicked
                      if (distance < 20 && distance < minDistance) {
                        minDistance = distance;
                        clickedAnnotation = ann;
                      }
                    });
                  }
                });
              }
            } catch (error) {
              // Ignore errors for tools that might not exist
            }
          }

          if (clickedAnnotation) {
            AnnotationCompatLayer.analyzeAnnotationStructure(clickedAnnotation);

            console.info('🎯 Attempting to select clicked annotation...');
            AnnotationCompatLayer.analyzeAnnotationStructure(clickedAnnotation);
            
            // Use compatibility layer for selection with async/await
            try {
              const selectionResult = await AnnotationCompatLayer.selectAnnotation(clickedAnnotation, true, false);
              console.info('🎯 Selection attempt result:', {
                success: selectionResult,
                annotationUID: AnnotationCompatLayer.getAnnotationId(clickedAnnotation),
                toolName: (clickedAnnotation as any).metadata?.toolName || 'unknown',
                distance: minDistance,
              });

              if (selectionResult) {
                console.info('✅ Annotation successfully selected! Re-rendering viewport...');
                
                // Re-render to show selection
                renderingEngine.renderViewports([viewportId]);
                
                // Verify selection worked by checking selected annotations
                setTimeout(async () => {
                  const verifySelected = await AnnotationCompatLayer.getSelectedAnnotations();
                  console.info('🔍 Verification - Currently selected annotations after selection:', {
                    count: verifySelected.length,
                    annotations: verifySelected
                  });
                }, 100);
              } else {
                console.warn('❌ Failed to select annotation');
              }
            } catch (selectionError) {
              console.error('❌ Error during annotation selection:', selectionError);
            }
          } else {
            // Clear selection if clicked on empty space
            try {
              const selectedAnnotations = await AnnotationCompatLayer.getSelectedAnnotations();
              if (selectedAnnotations.length > 0) {
                for (const ann of selectedAnnotations) {
                  await AnnotationCompatLayer.selectAnnotation(ann, false);
                }
                console.info('🔄 Selection cleared via compat layer');
                renderingEngine.renderViewports([viewportId]);
              }
            } catch (clearError) {
              console.error('❌ Error clearing selection:', clearError);
            }
          }

        } catch (error) {
          console.warn('Error handling mouse click for annotation selection:', error);
        }
      };

      document.addEventListener('click', handleMouseClick);
      return () => document.removeEventListener('click', handleMouseClick);
    }, [getRenderingEngine, viewportId]);

    // Enhanced keyboard navigation for frame switching and annotation management
    useEffect(() => {
      const handleKeyPress = async (event: KeyboardEvent) => {
        // Ignore if typing in inputs
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

        // Only handle keydown events to prevent double execution
        if (event.type !== 'keydown') return;

        // Debug key press for troubleshooting
        console.info('🔑 Document Key pressed:', { 
          key: event.key, 
          code: event.code, 
          keyCode: event.keyCode,
          target: event.target,
          activeElement: document.activeElement
        });

        // Handle Delete key for annotation deletion (Mac uses 'Backspace', Windows uses 'Delete')
        if (event.key === 'Delete' || event.key === 'Backspace' || event.code === 'Backspace' || event.keyCode === 8) {
          event.preventDefault();
          console.info('🔑 DELETE/BACKSPACE detected on DOCUMENT level!');

          try {
            const renderingEngine = getRenderingEngine();
            if (!renderingEngine) {
              console.warn('❌ No rendering engine available for annotation deletion');
              return;
            }

            // Try more direct approach - get annotations directly from Cornerstone3D
            console.info('🔍 Trying DIRECT Cornerstone3D approach...');
            
            // Import cornerstoneTools dynamically for v3.32.5
            const cornerstoneTools = await import('@cornerstonejs/tools');
            const element = viewportRef.current;
            
            if (!element) {
              console.warn('❌ No viewport element available');
              return;
            }

            let deletedCount = 0;
            let totalFound = 0;

            // Try to get selected annotations using direct Cornerstone API
            try {
              const selectedUids = cornerstoneTools.annotation.selection.getAnnotationsSelected();
              console.info('🔍 Direct API - Selected annotation UIDs:', selectedUids);
              
              if (selectedUids && selectedUids.length > 0) {
                selectedUids.forEach((uid: string) => {
                  try {
                    console.info(`🗑️ Attempting to delete annotation with UID: ${uid}`);
                    cornerstoneTools.annotation.state.removeAnnotation(uid);
                    deletedCount++;
                    console.info(`✅ Successfully deleted annotation: ${uid}`);
                  } catch (deleteError) {
                    console.error(`❌ Failed to delete annotation ${uid}:`, deleteError);
                  }
                });
              }
            } catch (selectionError) {
              console.warn('❌ Direct selection API failed:', selectionError);
            }

            // Fallback: try to find and delete the first annotation of any type
            if (deletedCount === 0) {
              console.info('🔍 Fallback: Searching for any annotations to delete...');
              
              const toolNames = ['LengthTool', 'BidirectionalTool', 'RectangleROITool', 'EllipticalROITool', 'AngleTool', 'ArrowAnnotateTool', 'ProbeTool'];
              
              for (const toolName of toolNames) {
                try {
                  const annotations = cornerstoneTools.annotation.state.getAnnotations(toolName, element);
                  if (annotations && annotations.length > 0) {
                    totalFound += annotations.length;
                    console.info(`📊 Found ${annotations.length} annotations of type ${toolName}`);
                    
                    // Delete the first annotation as a test
                    const firstAnnotation = annotations[0];
                    const uid = firstAnnotation.annotationUID || firstAnnotation.uid || firstAnnotation.id;
                    
                    if (uid) {
                      console.info(`🗑️ Test deletion of first ${toolName} annotation:`, uid);
                      cornerstoneTools.annotation.state.removeAnnotation(uid);
                      deletedCount++;
                      console.info(`✅ Test deletion successful for: ${uid}`);
                      break; // Only delete one for testing
                    }
                  }
                } catch (toolError) {
                  // Ignore errors for tools that might not exist
                }
              }
            }

            // Force viewport re-render to update display
            if (deletedCount > 0) {
              console.info(`🔄 Re-rendering viewport after ${deletedCount} deletions...`);
              renderingEngine.renderViewports([viewportId]);
              console.info(`✅ Successfully deleted ${deletedCount} annotation(s) via document handler`);
            } else {
              console.warn(`⚠️ No annotations deleted. Found ${totalFound} total annotations.`);
              if (totalFound > 0) {
                console.info('💡 Try clicking on an annotation first to select it, then press Delete/Backspace');
              } else {
                console.info('💡 No annotations found. Create some annotations first using the tools.');
              }
            }

          } catch (error) {
            console.error('❌ Error during document-level annotation deletion:', error);
          }
          return;
        }

        // Handle arrow keys for frame navigation
        if (imageIds.length <= 1) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            navigateToPrevious();
            console.info('🎯 Keyboard navigation: Previous frame', {
              currentIndex: currentImageIndex,
              totalImages: imageIds.length,
            });
            break;
          case 'ArrowRight':
            event.preventDefault();
            navigateToNext();
            console.info('🎯 Keyboard navigation: Next frame', {
              currentIndex: currentImageIndex,
              totalImages: imageIds.length,
            });
            break;
        }
      };

      // Listen to both keydown and keyup for better Mac compatibility
      document.addEventListener('keydown', handleKeyPress);
      document.addEventListener('keyup', handleKeyPress);
      return () => {
        document.removeEventListener('keydown', handleKeyPress);
        document.removeEventListener('keyup', handleKeyPress);
      };
    }, [imageIds.length, navigateToNext, navigateToPrevious, currentImageIndex, getRenderingEngine, viewportId]);

    // Setup viewport and tools when images are available
    useEffect(() => {
      console.info('🏗️ Main setup useEffect triggered', { imageIds: imageIds.length, seriesInstanceUID });

      if (imageIds.length === 0) {
        console.info('❌ No images, setting up tools only');
        setIsLoading(false);
        setError('No DICOM images available for this series. Please upload DICOM files first.');
        setupTools(); // Still set up tools for UI interaction
        return;
      }

      const setupAndRender = async () => {
        try {
          setIsLoading(true);
          setError(null);

          const element = viewportRef.current;
          if (!element) return;

          // Setup viewport
          await setupViewport(element, imageIds, currentImageIndex);

          // Setup tools
          setupTools();

          // Configure annotation styles - set selected annotation color to sky blue
          try {
            const darkSkyBlue = 'rgb(70, 130, 180)'; // Sky blue for better visibility

            // Get current default styles
            const currentStyles = annotation.config.style.getDefaultToolStyles();

            // Merge with sky blue selection colors
            const updatedStyles = {
              ...currentStyles,
              colorSelected: darkSkyBlue,
              textBoxColorSelected: darkSkyBlue,
              global: {
                ...currentStyles.global,
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              // Set colors for specific tools
              LengthTool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              BidirectionalTool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              RectangleROITool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              EllipticalROITool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              AngleTool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              ArrowAnnotateTool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              ProbeTool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
              PlanarFreehandROITool: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
            };

            // Set the updated styles
            annotation.config.style.setDefaultToolStyles(updatedStyles);

            console.info('✨ Annotation selection color set to sky blue:', darkSkyBlue);

            // Also set viewport-specific styles for this viewport to ensure the color applies
            annotation.config.style.setViewportToolStyles(viewportId, {
              global: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
            });

            console.info('✨ Viewport-specific annotation selection color also set');
          } catch (styleError) {
            console.warn('Failed to set annotation selection color:', styleError);
          }

          // Add viewport to tool group
          const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          console.info('🔗🔗🔗 VIEWPORT-TOOLGROUP: Adding viewport to tool group', {
            toolGroupId,
            viewportId,
            renderingEngineId,
            toolGroupExists: !!toolGroup,
            timestamp: new Date().toISOString(),
            allToolGroups: ToolGroupManager.getAllToolGroups().map(g => ({ id: g.id, viewports: g.getViewportIds() })),
          });
          if (toolGroup) {
            // Remove viewport from any other tool groups first
            ToolGroupManager.getAllToolGroups().forEach(group => {
              if (group.id !== toolGroupId && group.getViewportIds().includes(viewportId)) {
                console.info('🔄 Removing viewport from other tool group:', group.id);
                group.removeViewports(renderingEngineId, viewportId);
              }
            });

            toolGroup.addViewport(viewportId, renderingEngineId);
            console.info('✅✅✅ VIEWPORT-TOOLGROUP: Viewport added to tool group successfully');
          } else {
            console.error('⚠️⚠️⚠️ ERROR: Tool group not found when adding viewport');
          }

          // Set initial tool to WindowLevel
          setActiveToolHook('windowLevel');
          setCurrentActiveTool('windowLevel');

          // Optimize rendering for this viewport (set as critical priority since it's the active one)
          try {
            viewportOptimizer.optimizeRendering(viewportId);
            viewportOptimizer.setPriority(viewportId, RenderPriority.CRITICAL);

            // Queue initial rendering task
            const taskQueued = viewportOptimizer.queueRenderingTask(
              viewportId,
              {
                type: 'initial',
                imageIds,
                currentImageIndex,
                seriesInstanceUID,
              },
            );

            // Track viewport resources in memory manager
            const estimatedImageMemory = imageIds.length * 1024 * 1024; // Estimate 1MB per image
            memoryManager.trackResource(
              `viewport-${viewportId}`,
              'imageData',
              estimatedImageMemory,
              viewportId,
            );

            // Mark viewport as active in memory manager
            memoryManager.markViewportActive(viewportId);

            log.info('Viewport rendering optimized, priority set, and memory tracked', {
              component: 'DicomViewer',
              metadata: {
                viewportId,
                priority: 'CRITICAL',
                estimatedMemory: estimatedImageMemory,
                imageCount: imageIds.length,
                taskQueued,
              },
            });
          } catch (optimizationError) {
            log.warn('Failed to optimize viewport rendering or track memory', {
              component: 'DicomViewer',
              metadata: { viewportId },
            });
          }

          log.info('DICOM viewer initialized successfully', {
            component: 'DicomViewer',
            metadata: {
              seriesInstanceUID: seriesInstanceUID || 'none',
              imageCount: imageIds.length,
              currentIndex: currentImageIndex,
            },
          });

          setIsLoading(false);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load image';
          setError(errorMessage);
          setIsLoading(false);

          log.error(
            'Failed to initialize DICOM viewer',
            {
              component: 'DicomViewer',
              metadata: {
                seriesInstanceUID: seriesInstanceUID || 'none',
                imageCount: imageIds.length,
              },
            },
            err as Error,
          );
        }
      };

      setupAndRender();

      // Cleanup
      return () => {
        console.info('🧹 Cleaning up DicomViewer', { toolGroupId, viewportId });

        // Clean up memory tracking
        try {
          memoryManager.untrackResource(`viewport-${viewportId}`);
          memoryManager.cleanupViewport(viewportId);

          log.info('Viewport memory cleaned up', {
            component: 'DicomViewer',
            metadata: { viewportId },
          });
        } catch (memoryError) {
          log.warn('Failed to clean up viewport memory', {
            component: 'DicomViewer',
            metadata: { viewportId },
          });
        }

        // Remove viewport from tool group before destroying
        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          try {
            toolGroup.removeViewports(renderingEngineId, viewportId);
            console.info('✅ Viewport removed from tool group');
          } catch (error) {
            console.warn('⚠️ Error removing viewport from tool group:', error);
          }

          // Only destroy tool group if no viewports left
          if (toolGroup.getViewportIds().length === 0) {
            ToolGroupManager.destroyToolGroup(toolGroupId);
            console.info('✅ Tool group destroyed');
          }
        }

        destroyViewport();
      };
    }, [
      imageIds,
      seriesInstanceUID,
      currentImageIndex,
      destroyViewport,
      setActiveToolHook,
      setupTools,
      setupViewport,
      renderingEngineId,
      toolGroupId,
      viewportId,
    ]); // Dependencies

    // Expose setActiveTool and getActiveTool through ref
    React.useImperativeHandle(
      ref,
      () => ({
        setActiveTool: (tool: string) => {
          console.info('🔥🔥🔥 DICOM VIEWER REF: setActiveTool called via ref', {
            timestamp: new Date().toISOString(),
            tool,
            currentActiveTool,
            viewportId,
            renderingEngineId,
            toolGroupId,
          });
          setActiveToolHook(tool);
          setCurrentActiveTool(tool);
          setIsSelectionMode(tool === 'selection');
          console.info('🔥🔥🔥 DICOM VIEWER REF: setActiveTool completed', { newTool: tool, selectionMode: tool === 'selection' });
        },
        getActiveTool: () => currentActiveTool,
      }),
      [setActiveToolHook, currentActiveTool, renderingEngineId, toolGroupId, viewportId],
    ); // Include dependencies

    return (
      <div className='h-full flex flex-col'>
        {/* Viewer Controls */}
        <div className='bg-card border-b border-border p-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <Button
                onClick={() => {
                  console.info('🎯🎯🎯 UI CLICK: Previous button clicked', {
                    timestamp: new Date().toISOString(),
                    currentImageIndex,
                    canNavigatePrevious,
                    totalImages: imageIds.length,
                  });
                  navigateToPrevious();
                }}
                disabled={!canNavigatePrevious}
                variant="secondary"
                size="sm"
                className="flex items-center gap-1"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
                Previous
              </Button>
              <span className='text-sm text-muted-foreground px-2'>
                Image {currentImageIndex + 1} of {imageIds.length}
              </span>
              <Button
                onClick={() => {
                  console.info('🎯🎯🎯 UI CLICK: Next button clicked', {
                    timestamp: new Date().toISOString(),
                    currentImageIndex,
                    canNavigateNext,
                    totalImages: imageIds.length,
                  });
                  navigateToNext();
                }}
                disabled={!canNavigateNext}
                variant="secondary"
                size="sm"
                className="flex items-center gap-1"
              >
                Next
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </Button>
            </div>
            <div className='text-sm text-muted-foreground'>
              {seriesInstanceUID && <span>Series: {seriesInstanceUID.slice(-8)}</span>}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className='flex-1 relative bg-muted/10'>
          {isLoading && (
            <div className='absolute inset-0 bg-background/80 flex items-center justify-center z-10'>
              <div className='text-center'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
                <p className='text-muted-foreground'>Loading DICOM image...</p>
              </div>
            </div>
          )}

          {error && (
            <div className='absolute inset-0 bg-background flex items-center justify-center z-10'>
              <div className='text-center max-w-md p-6'>
                <h3 className='text-xl font-semibold mb-2'>📁 No DICOM Images</h3>
                <p className='text-muted-foreground mb-4'>{error}</p>
                <p className='text-sm text-muted-foreground'>
                  Use the "Load Files" button above to upload DICOM files, then select a series from the sidebar.
                </p>
              </div>
            </div>
          )}

          <div
            ref={viewportRef}
            className='w-full h-full min-h-[400px]'
            tabIndex={0}
            onKeyDown={async (e) => {
              console.info('🔑 Viewport ANY keydown:', { 
                key: e.key, 
                code: e.code, 
                keyCode: e.keyCode,
                target: e.target,
                focused: document.activeElement === e.target 
              });
              
              // Handle Delete/Backspace keys directly on viewport
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                console.info('🔑 DELETE/BACKSPACE detected on viewport!');
                
                try {
                  const renderingEngine = getRenderingEngine();
                  if (!renderingEngine) {
                    console.warn('❌ No rendering engine available for annotation deletion');
                    return;
                  }

                  // First check current selection state with detailed debugging
                  console.info('🔍 Checking current selection state...');
                  const selectedAnnotations = await AnnotationCompatLayer.getSelectedAnnotations();
                  console.info('📊 Selected annotations found:', {
                    count: selectedAnnotations.length,
                    annotations: selectedAnnotations
                  });

                  if (selectedAnnotations.length > 0) {
                    console.info('🎯 Processing selected annotations for deletion...');
                    let deletedCount = 0;
                    
                    // Get Cornerstone tools directly for immediate deletion
                    const cornerstoneTools = await import('@cornerstonejs/tools');
                    
                    for (let index = 0; index < selectedAnnotations.length; index++) {
                      const selectedAnnotation = selectedAnnotations[index];
                      console.info(`🔍 Processing annotation ${index + 1}/${selectedAnnotations.length}:`);
                      
                      const uid = AnnotationCompatLayer.getAnnotationId(selectedAnnotation);
                      console.info('🔍 Extracted UID for deletion:', uid);

                      if (uid) {
                        try {
                          // Direct deletion using Cornerstone3D API
                          cornerstoneTools.annotation.state.removeAnnotation(uid);
                          deletedCount++;
                          console.info('✅ Annotation deleted successfully via direct API:', {
                            annotationUID: uid,
                          });
                        } catch (deleteError) {
                          console.error('❌ Failed to delete annotation via direct API:', {
                            uid,
                            error: deleteError
                          });
                        }
                      } else {
                        console.warn('❌ No valid UID found for annotation:', selectedAnnotation);
                      }
                    }

                    console.info(`🔄 Triggering viewport re-render after deletion attempts...`);
                    renderingEngine.renderViewports([viewportId]);
                    
                    if (deletedCount > 0) {
                      console.info(`✅ Successfully deleted ${deletedCount}/${selectedAnnotations.length} selected annotation(s)`);
                    } else {
                      console.warn(`❌ Failed to delete any of the ${selectedAnnotations.length} selected annotations`);
                    }
                  } else {
                    console.warn('⚠️ No annotations currently selected for deletion. Please click an annotation first to select it.');
                    
                    // Debug: Check if there are any annotations at all using async import
                    try {
                      const cornerstoneTools = await import('@cornerstonejs/tools');
                      const element = viewportRef.current;
                      if (element) {
                        const toolNames = ['LengthTool', 'BidirectionalTool', 'RectangleROITool', 'EllipticalROITool', 'AngleTool'];
                        let totalAnnotations = 0;
                        
                        for (const toolName of toolNames) {
                          try {
                            const annotations = cornerstoneTools.annotation.state.getAnnotations(toolName, element);
                            if (annotations && annotations.length > 0) {
                              totalAnnotations += annotations.length;
                            }
                          } catch (err) {
                            // Ignore errors for tools that might not exist
                          }
                        }
                        
                        console.info(`📊 Total annotations available in viewport: ${totalAnnotations}`);
                      }
                    } catch (debugError) {
                      console.warn('Failed to debug annotation count:', debugError);
                    }
                  }
                } catch (error) {
                  console.error('❌ Error during viewport annotation deletion:', error);
                }
              }
            }}
            onClick={(e) => {
              // Focus the viewport to receive keyboard events
              if (viewportRef.current) {
                viewportRef.current.focus();
                console.info('🎯 Viewport focused after click');
              }
              
              if (isSelectionMode) {
                // Handle annotation selection when in selection mode
                const rect = viewportRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  console.info('🔍 Selection mode click:', { x, y, tool: currentActiveTool });
                }
              }
            }}
          />

          {/* Stack Scroll Indicator - Full version */}
          {!isLoading && imageIds.length > 1 && (
            <StackScrollIndicator
              renderingEngineId={renderingEngineId}
              viewportId={viewportId}
              imageCount={imageIds.length}
              currentIndex={currentImageIndex}
              getRenderingEngine={getRenderingEngine}
              onIndexChange={index => {
                // Update navigation hook state
                navigateToIndex(index);
                log.info('Stack index changed via indicator', {
                  component: 'DicomViewer',
                  metadata: { newIndex: index, totalImages: imageIds.length },
                });
              }}
            />
          )}

        </div>

        {/* Tool Instructions */}
        <div className='bg-card border-t border-border p-2'>
          <div className='flex flex-wrap gap-4 text-xs text-muted-foreground'>
            <span>🖱️ Left Click: {isSelectionMode ? 'Select Annotation' : 'Active Tool'}</span>
            <span>🖱️ Right Click: Pan</span>
            <span>🖱️ Middle Click: Zoom</span>
            <span>⚙️ Scroll: Navigate Images</span>
            {imageIds.length > 1 && <span>⌨️ ←→ Keys: Frame Navigation</span>}
            <span>🔧 S Key: Select Tool</span>
            <span>🎯 Click Annotation: Select for Deletion</span>
            <span>⌨️ Delete/Backspace: Remove Selected Annotation (Focus viewport first)</span>
          </div>
        </div>
      </div>
    );
  },
);

// Memoize the component to prevent unnecessary re-renders
export const DicomViewer = React.memo(DicomViewerComponent, (prevProps, nextProps) => {
  // Only re-render if key props change
  return (
    prevProps.seriesInstanceUID === nextProps.seriesInstanceUID &&
    JSON.stringify(prevProps.imageIds) === JSON.stringify(nextProps.imageIds) &&
    prevProps.renderingEngineId === nextProps.renderingEngineId &&
    prevProps.viewportId === nextProps.viewportId
  );
});
