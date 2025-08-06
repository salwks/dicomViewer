/**
 * DICOM Viewer Component (Simplified)
 * Displays DICOM images using Cornerstone3D with separated concerns
 */

import React, { useEffect, useRef, useState } from 'react';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { simpleDicomLoader, selectionAPI } from '../../services';
// Removed ToolType import as it's not needed with the new interface
import { log } from '../../utils/logger';
import { AnnotationCompat, AnnotationCompatLayer } from '../../types/annotation-compat';
import { useToolSetup } from './hooks/useToolSetup';
import { useViewportSetup } from './hooks/useViewportSetup';
import { useImageNavigation } from './hooks/useImageNavigation';
import { StackScrollIndicator } from '../StackScrollIndicator';
import { viewportOptimizer, RenderPriority } from '../../services/viewport-optimizer';
import { memoryManager } from '../../services/memoryManager';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Canvas2DViewport } from '../Canvas2DViewport';
// Priority manager is integrated via ViewportOptimizer
// Removed CSS imports as we're using Tailwind CSS instead

const { annotation } = cornerstoneTools;

const { ToolGroupManager } = cornerstoneTools;

interface DicomViewerProps {
  seriesInstanceUID?: string;
  studyInstanceUID?: string;
  imageIds?: string[];
  renderingEngineId?: string;
  viewportId?: string;
}

export interface DicomViewerRef {
  setActiveTool: (tool: string) => void;
  getActiveTool: () => string;
}

const DicomViewerComponent = React.forwardRef<DicomViewerRef, DicomViewerProps>(
  ({ seriesInstanceUID, studyInstanceUID, imageIds: propImageIds, renderingEngineId: customRenderingEngineId, viewportId: customViewportId }, ref) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageIds, setImageIds] = useState<string[]>([]);
    const [currentActiveTool, setCurrentActiveTool] = useState<string>('windowLevel');
    const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
    const [selectedAnnotationCount, setSelectedAnnotationCount] = useState<number>(0);
    const [useCanvas2DFallback, setUseCanvas2DFallback] = useState<boolean>(false);
    const [fallbackReason, setFallbackReason] = useState<string | null>(null);

    // Track component mount/unmount
    React.useEffect(() => {
      log.info('DicomViewer mounted', {
        component: 'DicomViewer',
        metadata: { seriesInstanceUID },
      });
      return () => {
        log.info('DicomViewer unmounted', {
          component: 'DicomViewer',
          metadata: { seriesInstanceUID },
        });
      };
    }, [seriesInstanceUID]);

    // Track all prop changes
    React.useEffect(() => {
      log.info('DicomViewer props changed', {
        component: 'DicomViewer',
        metadata: {
          seriesInstanceUID,
          studyInstanceUID,
          propImageIds: propImageIds?.length,
          viewportId: customViewportId,
          hasSeriesUID: !!seriesInstanceUID,
          hasStudyUID: !!studyInstanceUID,
        },
      });
    }, [seriesInstanceUID, studyInstanceUID, propImageIds, customViewportId]);

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
      log.info('DicomViewer imageIds loading useEffect triggered', {
        component: 'DicomViewer',
        metadata: {
          seriesInstanceUID,
          studyInstanceUID,
          propImageIds: propImageIds?.length,
          currentImageIds: imageIds.length,
        },
      });

      const loadImageIds = async () => {
        if (seriesInstanceUID) {
          // Check if simpleDicomLoader has any loaded files first
          const allLoadedFiles = simpleDicomLoader.getLoadedFiles();
          const allSeriesUIDs = allLoadedFiles.map(f => f.metadata.seriesInstanceUID);

          log.info('SimpleDicomLoader state check', {
            component: 'DicomViewer',
            metadata: {
              totalLoadedFiles: allLoadedFiles.length,
              seriesInstanceUID,
              availableSeriesUIDs: allSeriesUIDs,
              seriesMatch: allSeriesUIDs.includes(seriesInstanceUID),
            },
          });

          const seriesImageIds = simpleDicomLoader.getImageIdsForSeries(seriesInstanceUID);
          setImageIds(seriesImageIds);

          log.info('Loading images for series', {
            component: 'DicomViewer',
            metadata: {
              seriesInstanceUID,
              imageCount: seriesImageIds.length,
              imageIds: seriesImageIds,
              foundImageIds: seriesImageIds.length > 0,
            },
          });
        } else if (studyInstanceUID) {
          // If no series specified but study is provided, try to get first series
          const seriesData = await simpleDicomLoader.getSeriesData();
          const studySeries = seriesData.filter(s => s.studyInstanceUID === studyInstanceUID);

          if (studySeries.length > 0) {
            const firstSeries = studySeries[0];
            const seriesImageIds = simpleDicomLoader.getImageIdsForSeries(firstSeries.seriesInstanceUID);
            setImageIds(seriesImageIds);

            log.info('Loading first series from study', {
              component: 'DicomViewer',
              metadata: {
                studyInstanceUID,
                selectedSeriesInstanceUID: firstSeries.seriesInstanceUID,
                imageCount: seriesImageIds.length,
                totalSeriesInStudy: studySeries.length,
              },
            });
          } else {
            setImageIds([]);
            log.warn('No series found for study', {
              component: 'DicomViewer',
              metadata: { studyInstanceUID },
            });
          }
        } else if (propImageIds) {
          setImageIds(propImageIds);
          log.info('Using prop imageIds', {
            component: 'DicomViewer',
            metadata: {
              propImageIdsCount: propImageIds.length,
            },
          });
        } else {
          setImageIds([]);
          log.info('No series, study, or prop imageIds, clearing imageIds', {
            component: 'DicomViewer',
          });
        }
      };

      loadImageIds().catch(error => {
        log.error('Failed to load imageIds', {
          component: 'DicomViewer',
          metadata: { seriesInstanceUID, studyInstanceUID },
        }, error as Error);
        setImageIds([]);
      });
    }, [seriesInstanceUID, studyInstanceUID, propImageIds, imageIds.length]);

    // Setup Selection API event listeners
    useEffect(() => {
      const handleSelectionChanged = (selectedIds: string[], eventViewportId: string) => {
        if (eventViewportId === viewportId) {
          setSelectedAnnotationCount(selectedIds.length);
          log.info('Selection changed in DicomViewer', {
            component: 'DicomViewer',
            metadata: {
              viewportId: eventViewportId,
              selectedCount: selectedIds.length,
              selectedIds,
            },
          });
        }
      };

      const handleAnnotationSelected = (annotation: any, eventViewportId: string) => {
        if (eventViewportId === viewportId) {
          const annotationId = AnnotationCompatLayer.getAnnotationId(annotation);
          log.info('Annotation selected in DicomViewer', {
            component: 'DicomViewer',
            metadata: {
              viewportId: eventViewportId,
              annotationId,
              toolName: annotation.metadata?.toolName || 'unknown',
            },
          });
        }
      };

      const handleSelectionCleared = (eventViewportId: string) => {
        if (eventViewportId === viewportId) {
          setSelectedAnnotationCount(0);
          log.info('Selection cleared in DicomViewer', {
            component: 'DicomViewer',
            metadata: { viewportId: eventViewportId },
          });
        }
      };

      const handleSelectionError = (error: Error) => {
        log.error('Selection API error in DicomViewer', {
          component: 'DicomViewer',
          metadata: { viewportId },
        }, error);
      };

      // Register event listeners
      selectionAPI.on('selection-changed', handleSelectionChanged);
      selectionAPI.on('annotation-selected', handleAnnotationSelected);
      selectionAPI.on('selection-cleared', handleSelectionCleared);
      selectionAPI.on('error', handleSelectionError);

      // Initial selection count
      setSelectedAnnotationCount(selectionAPI.getSelectionCount(viewportId));

      return () => {
        // Cleanup event listeners
        selectionAPI.off('selection-changed', handleSelectionChanged);
        selectionAPI.off('annotation-selected', handleAnnotationSelected);
        selectionAPI.off('selection-cleared', handleSelectionCleared);
        selectionAPI.off('error', handleSelectionError);
      };
    }, [viewportId]);

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

          log.info('Mouse click detected', {
            component: 'DicomViewer',
            metadata: { canvasPos, worldPos },
          });

          // Check if we clicked on an annotation by testing proximity to all annotations
          let clickedAnnotation = null;
          let minDistance = Infinity;

          // Get all annotations from all tools - using v3 compatible API
          const toolNames = [
            'LengthTool', 'BidirectionalTool', 'RectangleROITool', 'EllipticalROITool',
            'AngleTool', 'ArrowAnnotateTool', 'ProbeTool', 'PlanarFreehandROITool',
            'HeightTool', 'CobbAngleTool', 'DragProbeTool',
          ];

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
            } catch {
              // Ignore errors for tools that might not exist
            }
          }

          if (clickedAnnotation) {
            AnnotationCompatLayer.analyzeAnnotationStructure(clickedAnnotation);

            log.info('🎯 Attempting to select clicked annotation via Selection API...');

            // Use Selection API for annotation selection
            try {
              const annotationId = AnnotationCompatLayer.getAnnotationId(clickedAnnotation);
              if (!annotationId) {
                log.warn('❌ No valid annotation ID found');
                return;
              }

              const selectionResult = await selectionAPI.selectAnnotation(
                clickedAnnotation,
                viewportId,
                {
                  preserveExisting: false, // Clear other selections when clicking
                  validateAnnotation: true,
                  emitEvents: true,
                },
              );

              log.info('🎯 Selection API result:', {
                success: selectionResult,
                annotationUID: annotationId,
                toolName: (clickedAnnotation as any).metadata?.toolName || 'unknown',
                distance: minDistance,
              });

              if (selectionResult) {
                log.info('✅ Annotation successfully selected via Selection API! Re-rendering viewport...');

                // Re-render to show selection
                renderingEngine.renderViewports([viewportId]);

                // Verify selection worked by checking selected annotations via API
                setTimeout(() => {
                  const selectedIds = selectionAPI.getSelectedAnnotationIds(viewportId);
                  const selectedAnnotations = selectionAPI.getSelectedAnnotations(viewportId);
                  log.info('🔍 Verification - Currently selected via Selection API:', {
                    selectedIds,
                    count: selectedAnnotations.length,
                    annotations: selectedAnnotations,
                  });
                }, 100);
              } else {
                log.warn('❌ Failed to select annotation via Selection API');
              }
            } catch (selectionError) {
              log.error('❌ Error during Selection API annotation selection:', selectionError);
            }
          } else {
            // Clear selection if clicked on empty space using Selection API
            try {
              const selectionCount = selectionAPI.getSelectionCount(viewportId);
              if (selectionCount > 0) {
                const clearResult = selectionAPI.clearSelection(viewportId);
                if (clearResult) {
                  log.info('🔄 Selection cleared via Selection API');
                  renderingEngine.renderViewports([viewportId]);
                } else {
                  log.warn('❌ Failed to clear selection via Selection API');
                }
              }
            } catch (clearError) {
              log.error('❌ Error clearing selection:', clearError);
            }
          }

        } catch (error) {
          log.warn('Error handling mouse click for annotation selection:', error);
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
        log.info('🔑 Document Key pressed:', {
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
          target: event.target,
          activeElement: document.activeElement,
        });

        // Handle Delete key for annotation deletion (Mac uses 'Backspace', Windows uses 'Delete')
        if (event.key === 'Delete' || event.key === 'Backspace' || event.code === 'Backspace' || event.keyCode === 8) {
          event.preventDefault();
          log.info('🔑 DELETE/BACKSPACE detected on DOCUMENT level!');

          try {
            const renderingEngine = getRenderingEngine();
            if (!renderingEngine) {
              log.warn('❌ No rendering engine available for annotation deletion');
              return;
            }

            // Try more direct approach - get annotations directly from Cornerstone3D
            log.info('🔍 Trying DIRECT Cornerstone3D approach...');

            // Import cornerstoneTools dynamically for v3.32.5
            const cornerstoneTools = await import('@cornerstonejs/tools');
            const element = viewportRef.current;

            if (!element) {
              log.warn('❌ No viewport element available');
              return;
            }

            let deletedCount = 0;
            let totalFound = 0;

            // Try to get selected annotations using direct Cornerstone API
            try {
              const selectedUids = cornerstoneTools.annotation.selection.getAnnotationsSelected();
              log.info('🔍 Direct API - Selected annotation UIDs:', selectedUids);

              if (selectedUids && selectedUids.length > 0) {
                selectedUids.forEach((uid: string) => {
                  try {
                    log.info(`🗑️ Attempting to delete annotation with UID: ${uid}`);
                    cornerstoneTools.annotation.state.removeAnnotation(uid);
                    deletedCount++;
                    log.info(`✅ Successfully deleted annotation: ${uid}`);
                  } catch (deleteError) {
                    log.error(`❌ Failed to delete annotation ${uid}:`, deleteError);
                  }
                });
              }
            } catch (selectionError) {
              log.warn('❌ Direct selection API failed:', selectionError);
            }

            // Fallback: try to find and delete the first annotation
            // of any type
            if (deletedCount === 0) {
              log.info('🔍 Fallback: Searching for any annotations to delete...');

              const toolNames = [
                'LengthTool',
                'BidirectionalTool',
                'RectangleROITool',
                'EllipticalROITool',
                'AngleTool',
                'ArrowAnnotateTool',
                'ProbeTool',
              ];

              for (const toolName of toolNames) {
                try {
                  const annotations = cornerstoneTools.annotation.state.getAnnotations(toolName, element);
                  if (annotations && annotations.length > 0) {
                    totalFound += annotations.length;
                    log.info(`📊 Found ${annotations.length} annotations of type ${toolName}`);

                    // Delete the first annotation as a test
                    const firstAnnotation = annotations[0];
                    const uid = AnnotationCompatLayer.getAnnotationId(firstAnnotation as AnnotationCompat);

                    if (uid) {
                      log.info(`🗑️ Test deletion of first ${toolName} annotation:`, uid);
                      cornerstoneTools.annotation.state.removeAnnotation(uid);
                      deletedCount++;
                      log.info(`✅ Test deletion successful for: ${uid}`);
                      break; // Only delete one for testing
                    }
                  }
                } catch {
                  // Ignore errors for tools that might not exist
                }
              }
            }

            // Force viewport re-render to update display
            if (deletedCount > 0) {
              log.info(`🔄 Re-rendering viewport after ${deletedCount} deletions...`);
              renderingEngine.renderViewports([viewportId]);
              log.info(`✅ Successfully deleted ${deletedCount} annotation(s) via document handler`);
            } else {
              log.warn(`⚠️ No annotations deleted. Found ${totalFound} total annotations.`);
              if (totalFound > 0) {
                log.info('💡 Try clicking on an annotation first to select it, then press Delete/Backspace');
              } else {
                log.info('💡 No annotations found. Create some annotations first using the tools.');
              }
            }

          } catch (error) {
            log.error('❌ Error during document-level annotation deletion:', error);
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
            log.info('🎯 Keyboard navigation: Previous frame', {
              currentIndex: currentImageIndex,
              totalImages: imageIds.length,
            });
            break;
          case 'ArrowRight':
            event.preventDefault();
            navigateToNext();
            log.info('🎯 Keyboard navigation: Next frame', {
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
      log.info('🏗️ Main setup useEffect triggered', { imageIds: imageIds.length, seriesInstanceUID });

      if (imageIds.length === 0) {
        log.info('❌ No images, setting up tools only');
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

          // Try to setup viewport with WebGL, fallback to Canvas 2D if needed
          try {
            await setupViewport(element, imageIds, 0); // Always start with first image
            setUseCanvas2DFallback(false);
            setFallbackReason(null);
          } catch (viewportError) {
            log.error('WebGL viewport setup failed, attempting Canvas 2D fallback', {
              component: 'DicomViewer',
              metadata: { viewportId, renderingEngineId },
            }, viewportError as Error);

            // Check if this is a Canvas 2D fallback error
            const errorMessage = (viewportError as Error).message;
            if (errorMessage.includes('Canvas 2D fallback required')) {
              log.info('Switching to Canvas 2D fallback mode', {
                component: 'DicomViewer',
                metadata: { viewportId, reason: 'WebGL not available' },
              });

              setUseCanvas2DFallback(true);
              setFallbackReason('WebGL 컨텍스트를 생성할 수 없습니다. Canvas 2D 렌더링을 사용합니다.');
            } else {
              // Other errors should still be thrown
              throw viewportError;
            }
          }

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

            log.info('✨ Annotation selection color set to sky blue:', darkSkyBlue);

            // Also set viewport-specific styles for this viewport to ensure the color applies
            annotation.config.style.setViewportToolStyles(viewportId, {
              global: {
                colorSelected: darkSkyBlue,
                textBoxColorSelected: darkSkyBlue,
              },
            });

            log.info('✨ Viewport-specific annotation selection color also set');
          } catch (styleError) {
            log.warn('Failed to set annotation selection color:', styleError);
          }

          // Add viewport to tool group
          const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          log.info('🔗🔗🔗 VIEWPORT-TOOLGROUP: Adding viewport to tool group', {
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
                log.info('🔄 Removing viewport from other tool group:', group.id);
                group.removeViewports(renderingEngineId, viewportId);
              }
            });

            toolGroup.addViewport(viewportId, renderingEngineId);
            log.info('✅✅✅ VIEWPORT-TOOLGROUP: Viewport added to tool group successfully');
          } else {
            log.error('⚠️⚠️⚠️ ERROR: Tool group not found when adding viewport');
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
          } catch {
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
        log.info('🧹 Cleaning up DicomViewer', { toolGroupId, viewportId });

        // Clean up memory tracking
        try {
          memoryManager.untrackResource(`viewport-${viewportId}`);
          memoryManager.cleanupViewport(viewportId);

          log.info('Viewport memory cleaned up', {
            component: 'DicomViewer',
            metadata: { viewportId },
          });
        } catch {
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
            log.info('✅ Viewport removed from tool group');
          } catch (error) {
            log.warn('⚠️ Error removing viewport from tool group:', error);
          }

          // Only destroy tool group if no viewports left
          if (toolGroup.getViewportIds().length === 0) {
            ToolGroupManager.destroyToolGroup(toolGroupId);
            log.info('✅ Tool group destroyed');
          }
        }

        destroyViewport();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      // CRITICAL: Only include stable values that should trigger re-setup
      imageIds.length, // Use length instead of array reference to avoid unnecessary re-runs
      seriesInstanceUID,
      // CRITICAL: Remove currentImageIndex to prevent viewport recreation on slider changes
      // Remove function dependencies that cause infinite loops:
      // destroyViewport, setActiveToolHook, setupTools, setupViewport, currentImageIndex
      renderingEngineId,
      toolGroupId,
      viewportId,
    ]); // Dependencies

    // Separate effect for handling currentImageIndex changes without viewport recreation
    React.useEffect(() => {
      if (useCanvas2DFallback || isLoading || imageIds.length === 0) {
        return;
      }

      // Navigate to the current image index without recreating the viewport
      try {
        const renderingEngine = getRenderingEngine();
        if (!renderingEngine) {
          log.warn('Cannot navigate to image index - rendering engine not available');
          return;
        }

        const viewport = renderingEngine.getViewport(viewportId) as any;
        if (!viewport || !viewport.setImageIdIndex) {
          log.warn('Cannot navigate to image index - viewport not ready');
          return;
        }

        // Only update if the index is different from current viewport index
        const currentViewportIndex = viewport.getCurrentImageIdIndex();
        if (currentViewportIndex !== currentImageIndex) {
          log.info('Navigating viewport to image index', {
            component: 'DicomViewer',
            metadata: {
              viewportId,
              fromIndex: currentViewportIndex,
              toIndex: currentImageIndex,
              totalImages: imageIds.length,
            },
          });

          viewport.setImageIdIndex(currentImageIndex);
          renderingEngine.render();
        }
      } catch (error) {
        log.warn('Failed to navigate to image index', {
          component: 'DicomViewer',
          metadata: { viewportId, targetIndex: currentImageIndex },
        }, error as Error);
      }
    }, [currentImageIndex, viewportId, useCanvas2DFallback, isLoading, imageIds.length, getRenderingEngine]);

    // Expose setActiveTool and getActiveTool through ref
    React.useImperativeHandle(
      ref,
      () => ({
        setActiveTool: (tool: string) => {
          log.info('🔥🔥🔥 DICOM VIEWER REF: setActiveTool called via ref', {
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
          log.info('🔥🔥🔥 DICOM VIEWER REF: setActiveTool completed', { newTool: tool, selectionMode: tool === 'selection' });
        },
        getActiveTool: () => currentActiveTool,
      }),
      [setActiveToolHook, currentActiveTool, renderingEngineId, toolGroupId, viewportId],
    ); // Include dependencies

    return (
      <div className='h-full flex flex-col'>
        {/* Viewer Controls */}
        <div className='bg-card p-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <Button
                onClick={() => {
                  log.info('🎯🎯🎯 UI CLICK: Previous button clicked', {
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
                  log.info('🎯🎯🎯 UI CLICK: Next button clicked', {
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
            <div className='flex items-center space-x-4 text-sm text-muted-foreground'>
              {selectedAnnotationCount > 0 && (
                <div className='flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary rounded-md'>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 12 2 2 4-4"/>
                    <path d="M21 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1"/>
                    <path d="M3 12c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1"/>
                  </svg>
                  <span>{selectedAnnotationCount} selected</span>
                </div>
              )}
              {seriesInstanceUID && <span>Series: {seriesInstanceUID.slice(-8)}</span>}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className='flex-1 relative'>
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

          {/* Conditional rendering: Canvas 2D fallback or WebGL viewport */}
          {useCanvas2DFallback ? (
            <div className="relative w-full h-full min-h-[400px]">
              {/* Fallback reason display */}
              {fallbackReason && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                    {fallbackReason}
                  </Badge>
                </div>
              )}

              {/* Canvas 2D Viewport */}
              <Canvas2DViewport
                imageId={imageIds.at(currentImageIndex) || ''}
                className="w-full h-full"
                width={512}
                height={512}
                onImageLoad={(imageId) => {
                  log.info('Canvas 2D image loaded', {
                    component: 'DicomViewer',
                    metadata: { imageId: `${imageId.substring(0, 50)}...` },
                  });
                }}
                onImageError={(error) => {
                  log.error('Canvas 2D image load error', {
                    component: 'DicomViewer',
                  }, error);
                  setError(`Canvas 2D 렌더링 오류: ${error.message}`);
                }}
              />
            </div>
          ) : (
            <div
              ref={viewportRef}
              className='w-full h-full min-h-[400px]'
              tabIndex={0}
              onKeyDown={async (e) => {
                log.info('🔑 Viewport ANY keydown:', {
                  key: e.key,
                  code: e.code,
                  keyCode: e.keyCode,
                  target: e.target,
                  focused: document.activeElement === e.target,
                });

                // Handle Delete/Backspace keys directly on viewport
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  e.stopPropagation();
                  log.info('🔑 DELETE/BACKSPACE detected on viewport!');

                  try {
                    const renderingEngine = getRenderingEngine();
                    if (!renderingEngine) {
                      log.warn('❌ No rendering engine available for annotation deletion');
                      return;
                    }

                    // First check current selection state with detailed debugging
                    log.info('🔍 Checking current selection state...');
                    const selectedAnnotations = await AnnotationCompatLayer.getSelectedAnnotations();
                    log.info('📊 Selected annotations found:', {
                      count: selectedAnnotations.length,
                      annotations: selectedAnnotations,
                    });

                    if (selectedAnnotations.length > 0) {
                      log.info('🎯 Processing selected annotations for deletion...');
                      let deletedCount = 0;

                      // Get Cornerstone tools directly for immediate deletion
                      const cornerstoneTools = await import('@cornerstonejs/tools');

                      for (let index = 0; index < selectedAnnotations.length; index++) {
                      // eslint-disable-next-line security/detect-object-injection -- Safe: index is loop counter
                        const selectedAnnotation = selectedAnnotations[index];
                        log.info(`🔍 Processing annotation ${index + 1}/${selectedAnnotations.length}:`);

                        const uid = AnnotationCompatLayer.getAnnotationId(selectedAnnotation);
                        log.info('🔍 Extracted UID for deletion:', uid);

                        if (uid) {
                          try {
                          // Direct deletion using Cornerstone3D API
                            cornerstoneTools.annotation.state.removeAnnotation(uid);
                            deletedCount++;
                            log.info('✅ Annotation deleted successfully via direct API:', {
                              annotationUID: uid,
                            });
                          } catch (deleteError) {
                            log.error('❌ Failed to delete annotation via direct API:', {
                              uid,
                              error: deleteError,
                            });
                          }
                        } else {
                          log.warn('❌ No valid UID found for annotation:', selectedAnnotation);
                        }
                      }

                      log.info('🔄 Triggering viewport re-render after deletion attempts...');
                      renderingEngine.renderViewports([viewportId]);

                      if (deletedCount > 0) {
                        log.info(`✅ Successfully deleted ${deletedCount}/${selectedAnnotations.length} selected annotation(s)`);
                      } else {
                        log.warn(`❌ Failed to delete any of the ${selectedAnnotations.length} selected annotations`);
                      }
                    } else {
                      log.warn('⚠️ No annotations currently selected for deletion. Please click an annotation first to select it.');

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
                            } catch {
                            // Ignore errors for tools that might not exist
                            }
                          }

                          log.info(`📊 Total annotations available in viewport: ${totalAnnotations}`);
                        }
                      } catch (debugError) {
                        log.warn('Failed to debug annotation count:', debugError);
                      }
                    }
                  } catch {
                    log.error('❌ Error during viewport annotation deletion:', error);
                  }
                }
              }}
              onClick={(e) => {
              // Focus the viewport to receive keyboard events
                if (viewportRef.current) {
                  viewportRef.current.focus();
                  log.info('🎯 Viewport focused after click');
                }

                if (isSelectionMode) {
                // Handle annotation selection when in selection mode
                  const rect = viewportRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    log.info('🔍 Selection mode click:', { x, y, tool: currentActiveTool });
                  }
                }
              }}
            />
          )}

          {/* Stack Scroll Indicator - Full version (only for WebGL viewport) */}
          {!useCanvas2DFallback && !isLoading && imageIds.length > 1 && (
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
        <div className='bg-card p-2'>
          <div className='flex flex-wrap gap-4 text-xs text-muted-foreground'>
            {useCanvas2DFallback ? (
              <>
                <span>🖱️마우스 휠: 확대/축소</span>
                <span>🖱️ 더블클릭: 원본 크기로 복원</span>
                <span>⚠️ Canvas 2D 모드: 주석 도구 사용 불가</span>
              </>
            ) : (
              <>
                <span>🖱️ Left Click: {isSelectionMode ? 'Select Annotation' : 'Active Tool'}</span>
                <span>🖱️ Right Click: Pan</span>
                <span>🖱️ Middle Click: Zoom</span>
                <span>⚙️ Scroll: Navigate Images</span>
                {imageIds.length > 1 && <span>⌨️ ←→ Keys: Frame Navigation</span>}
                <span>🔧 S Key: Select Tool</span>
                <span>🎯 Click Annotation: Select for Deletion</span>
                <span>⌨️ Delete/Backspace: Remove Selected Annotation (Focus viewport first)</span>
              </>
            )}
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
