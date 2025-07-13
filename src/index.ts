import { initializeCornerstone3D } from './core/simpleInit';
import { DicomViewer } from './components/DicomViewer';
import { WindowLevelPanel } from './components/WindowLevelPanel';
import { OrientationControls } from './components/OrientationControls';
import { LayoutManager } from './components/LayoutManager';
import { ViewportManager } from './core/viewportManager';
import { SynchronizationManager, SyncType } from './core/synchronizationManager';
import { ViewportCleanupManager } from './utils/viewportCleanup';
import { MultiViewportToolManager } from './utils/multiViewportTools';
import { ImageStateManager } from './utils/imageStateManager';
import { SeriesComparator } from './components/SeriesComparator';
import { registerMockImageLoader, createMockImageIds } from './utils/mockImageLoader';
import { runMultiViewportTests } from './tests/multiViewportTests';
import { runSeriesNavigationTests } from './tests/seriesNavigationTests';
import { SeriesManager, SeriesInfo } from './core/seriesManager';
import { SeriesBrowser } from './components/SeriesBrowser';
import { ThumbnailViewer } from './components/ThumbnailViewer';
import { StackNavigationTool } from './tools/stackNavigationTool';
import { CustomReferenceLines } from './tools/customReferenceLines';
import { Types, RenderingEngine } from '@cornerstonejs/core';
import { annotation } from '@cornerstonejs/tools';

// Initialize Cornerstone3D when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing Cornerstone3D...');
        
        // Initialize Cornerstone3D
        await initializeCornerstone3D();
        
        // Register mock image loader for series comparison
        try {
            registerMockImageLoader();
            console.log('Mock image loader registered for series comparison');
        } catch (error) {
            console.warn('Mock image loader registration failed:', error);
        }
        
        // Get the viewport element
        const viewportElement = document.getElementById('viewport');
        if (!viewportElement) {
            throw new Error('Viewport element not found');
        }
        
        // Create the DICOM viewer
        const viewer = new DicomViewer(viewportElement);
        
        // Initialize the viewer
        await viewer.init();
        
        // Initialize Series Navigation System
        const seriesManager = SeriesManager.getInstance();
        const stackNavigation = StackNavigationTool.getInstance();
        let seriesBrowser: SeriesBrowser | null = null;
        let thumbnailViewer: ThumbnailViewer | null = null;
        
        // Initialize stack navigation with configuration
        stackNavigation.initialize({
            loop: false,
            skipDistance: 1,
            mouseWheelEnabled: true,
            keyboardEnabled: true,
            touchEnabled: true
        });
        
        // Initialize Series Browser
        const seriesBrowserContainer = document.getElementById('seriesBrowserContainer');
        if (seriesBrowserContainer) {
            seriesBrowser = new SeriesBrowser(seriesBrowserContainer, seriesManager, {
                showThumbnails: true,
                showMetadata: true,
                allowSelection: true,
                allowDeletion: false,
                showStatistics: true,
                maxDisplayedSeries: 20
            });
        }
        
        // Initialize Thumbnail Viewer
        const thumbnailViewerContainer = document.getElementById('thumbnailViewerContainer');
        if (thumbnailViewerContainer) {
            thumbnailViewer = new ThumbnailViewer(thumbnailViewerContainer, {
                thumbnailSize: 64,
                showImageNumbers: true,
                showProgressBar: true,
                allowImageSelection: true,
                maxThumbnailsPerRow: 4,
                lazyLoading: true,
                generateThumbnails: false
            });
        }
        
        // Setup Series Navigation Event Handlers
        if (seriesBrowser) {
            // Handle series selection
            seriesBrowser.onSeriesSelected(async (selectedSeries: SeriesInfo, index: number) => {
                console.log(`Series selected: ${selectedSeries.description} (${selectedSeries.imageCount} images)`);
                
                try {
                    // Load the selected series into the main viewer
                    if (selectedSeries.imageIds && selectedSeries.imageIds.length > 0) {
                        // For now, create dummy DICOM files array for the viewer
                        // In a real implementation, you would load actual DICOM files
                        await loadSeriesToViewer(selectedSeries);
                        
                        // Update thumbnail viewer
                        if (thumbnailViewer) {
                            thumbnailViewer.loadSeries(selectedSeries, 0);
                        }
                        
                        // Update status
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = `Loaded series: ${selectedSeries.description} (${selectedSeries.imageCount} images)`;
                        }
                    }
                } catch (error) {
                    console.error('Error loading selected series:', error);
                }
            });
            
            // Handle series deletion
            seriesBrowser.onSeriesDeleted((seriesId: string) => {
                console.log(`Series deleted: ${seriesId}`);
                
                // Clear thumbnail viewer if the deleted series was being displayed
                if (thumbnailViewer) {
                    const currentSeries = thumbnailViewer.getCurrentSeries();
                    if (currentSeries && currentSeries.id === seriesId) {
                        thumbnailViewer.loadSeries({
                            id: 'empty',
                            description: 'No series selected',
                            imageIds: [],
                            imageCount: 0
                        }, 0);
                    }
                }
            });
        }
        
        if (thumbnailViewer) {
            // Handle image selection in thumbnail viewer
            thumbnailViewer.onImageSelected(async (imageId: string, imageIndex: number) => {
                console.log(`Image selected: ${imageId} (index: ${imageIndex})`);
                
                try {
                    // Navigate to the selected image in the main viewer
                    const currentLayout = layoutManager ? layoutManager.getCurrentLayout() : '1x1';
                    
                    if (currentLayout === '1x1') {
                        // Use main viewer navigation
                        if (viewer && viewer.getCurrentImageIds().includes(imageId)) {
                            const imageIds = viewer.getCurrentImageIds();
                            const targetIndex = imageIds.indexOf(imageId);
                            if (targetIndex >= 0) {
                                // Navigate to the image (this would need to be implemented in DicomViewer)
                                console.log(`Navigating to image index ${targetIndex} in main viewer`);
                            }
                        }
                    } else {
                        // Use stack navigation for multi-viewport
                        const activeViewportElement = document.querySelector('.viewport-container.active-viewport');
                        const viewportId = activeViewportElement?.getAttribute('data-viewport-id');
                        
                        if (viewportId) {
                            stackNavigation.jumpToImage(viewportId, imageIndex);
                        }
                    }
                } catch (error) {
                    console.error('Error navigating to selected image:', error);
                }
            });
            
            // Handle image change in thumbnail viewer (for synchronization)
            thumbnailViewer.onImageChanged((imageId: string, imageIndex: number) => {
                console.log(`Image changed: ${imageId} (index: ${imageIndex})`);
                
                // Update any synchronized viewports if needed
                // This could be used for cross-series synchronization
            });
        }
        
        // Add helper function to load series to viewer
        async function loadSeriesToViewer(series: SeriesInfo): Promise<void> {
            // For demonstration, we'll simulate loading the series
            // In a real implementation, you would load actual DICOM files
            
            console.log(`Loading series ${series.description} with ${series.imageCount} images`);
            
            // Update image state manager
            const imageStateManager = ImageStateManager.getInstance();
            imageStateManager.saveImageState(series.imageIds, 0);
            
            // Apply to multi-viewports if in multi-viewport mode
            const currentLayout = layoutManager ? layoutManager.getCurrentLayout() : '1x1';
            if (currentLayout !== '1x1') {
                await imageStateManager.applyImageStateToAllViewports();
            }
            
            // For now, just log the action
            // In a real implementation, you would call viewer.loadDicomFiles() with actual files
            console.log(`Series ${series.description} loaded successfully`);
        }
        
        // Initialize multi-viewport system after basic viewer is ready
        let renderingEngine: RenderingEngine;
        let viewportManager: ViewportManager;
        let syncManager: SynchronizationManager;
        let layoutManager: LayoutManager;
        let cleanupManager: ViewportCleanupManager;
        
        // Initialize multi-viewport system components
        const initMultiViewportSystem = () => {
            try {
                renderingEngine = new RenderingEngine('multi-viewport-engine');
                viewportManager = new ViewportManager(renderingEngine);
                syncManager = new SynchronizationManager(viewportManager);
                const viewportContainer = document.querySelector('.viewport-container') as HTMLElement;
                layoutManager = new LayoutManager(viewportContainer, viewportManager);
                cleanupManager = new ViewportCleanupManager(viewportManager, layoutManager, syncManager);
                
                // Set default layout without initialization (will be done later)
                layoutManager.setLayout('1x1', false);
                
                // Schedule automatic cleanup every 5 minutes
                cleanupManager.scheduleAutoCleanup(300000);
                
                console.log('Multi-viewport system initialized with cleanup manager');
                
                // Initialize Cornerstone3D viewports after a delay to ensure DOM is ready
                setTimeout(async () => {
                    layoutManager.initializeCornerstone3DViewports();
                    
                    // Setup multi-viewport tools after viewports are created - increased delay for proper initialization
                    setTimeout(async () => {
                        try {
                            const multiToolManager = MultiViewportToolManager.getInstance();
                            await multiToolManager.setupMultiViewportTools();
                            
                            // Wait a bit more before associating with viewports to ensure they're fully registered
                            setTimeout(async () => {
                                await multiToolManager.associateWithAllViewports();
                                
                                // Verify associations for debugging
                                setTimeout(() => {
                                    multiToolManager.verifyAssociations();
                                }, 100);
                                
                                console.log('Multi-viewport tools initialized and associated');
                            }, 200);
                        } catch (error) {
                            console.error('Error initializing multi-viewport tools:', error);
                        }
                    }, 500);
                }, 300);
                
            } catch (error) {
                console.error('Error initializing multi-viewport system:', error);
            }
        };
        
        // Initialize multi-viewport system
        initMultiViewportSystem();
        
        // Cornerstone3D annotation system is now integrated with the viewer
        console.log('🎯 Using Cornerstone3D built-in annotation system');
        
        // Set up file input handler
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.addEventListener('change', async (event) => {
                const target = event.target as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                    const files = Array.from(target.files);
                    console.log(`Loading ${files.length} DICOM files...`);
                    
                    // Update status
                    const statusText = document.getElementById('statusText');
                    if (statusText) {
                        statusText.textContent = `Loading ${files.length} DICOM files...`;
                    }
                    
                    try {
                        // Check if viewer is initialized before loading files
                        if (!viewer.getInitializationStatus()) {
                            throw new Error('Viewer is not properly initialized');
                        }
                        
                        // Create series from files and add to series manager
                        const createdSeries = await seriesManager.createSeriesFromFiles(files);
                        createdSeries.forEach(series => {
                            seriesManager.addSeries(series);
                        });
                        
                        // Load files to main viewer first
                        await viewer.loadDicomFiles(files);
                        
                        // Get the image IDs from the viewer and apply to multi-viewports
                        const imageIds = viewer.getCurrentImageIds();
                        if (imageIds && imageIds.length > 0) {
                            const imageStateManager = ImageStateManager.getInstance();
                            await imageStateManager.loadImagesToMultiViewports(imageIds, viewer.getCurrentImageIndex());
                            console.log(`Applied ${imageIds.length} images to all multi-viewports`);
                            
                            // Update current series with actual image IDs
                            const currentSeries = seriesManager.getCurrentSeries();
                            if (currentSeries) {
                                seriesManager.updateSeriesById(currentSeries.id, {
                                    imageIds: imageIds,
                                    imageCount: imageIds.length
                                });
                                
                                // Load series into thumbnail viewer
                                if (thumbnailViewer) {
                                    thumbnailViewer.loadSeries(currentSeries, viewer.getCurrentImageIndex());
                                }
                            }
                        }
                        
                        if (statusText) {
                            statusText.textContent = `Loaded ${files.length} DICOM files successfully`;
                        }
                    } catch (error) {
                        console.error('Error loading DICOM files:', error);
                        if (statusText) {
                            statusText.textContent = `Error loading DICOM files: ${error}`;
                        }
                    }
                }
            });
        }
        
        // Set up advanced window/level controls
        const windowLevelContainer = document.querySelector('.controls-panel h3')?.parentElement;
        let windowLevelPanel: WindowLevelPanel | null = null;
        
        if (windowLevelContainer) {
            windowLevelPanel = new WindowLevelPanel(windowLevelContainer, viewer);
            console.log('Advanced Window/Level panel initialized');
        }
        
        // Set up orientation controls
        let orientationControls: OrientationControls | null = null;
        
        // Wait for viewer initialization to complete
        setTimeout(() => {
            const orientationContainer = document.getElementById('orientationControlsContainer');
            if (orientationContainer && viewer.getRotationController() && viewer.getFlipController()) {
                orientationControls = new OrientationControls(
                    orientationContainer,
                    viewer.getRotationController()!,
                    viewer.getFlipController()!,
                    (rotation, flipState) => {
                        console.log(`Orientation changed - Rotation: ${rotation}°, Flip: H=${flipState.horizontal}, V=${flipState.vertical}`);
                    }
                );
                console.log('Orientation controls initialized');
            } else {
                console.warn('Could not initialize orientation controls - controllers not available');
            }
        }, 500); // Give time for viewer initialization
        
        // Set up global functions for backward compatibility
        (window as any).applyPreset = (presetName: string) => {
            viewer.applyWindowLevelPreset(presetName);
            
            // Update panel if available
            if (windowLevelPanel) {
                windowLevelPanel.updateCurrentValues();
            }
            
            // Fallback: Update basic slider values for existing HTML controls
            const windowWidthSlider = document.getElementById('windowWidth') as HTMLInputElement;
            const windowCenterSlider = document.getElementById('windowCenter') as HTMLInputElement;
            const windowWidthValue = document.getElementById('windowWidthValue');
            const windowCenterValue = document.getElementById('windowCenterValue');
            
            const currentWindowLevel = viewer.getCurrentWindowLevel();
            if (currentWindowLevel && windowWidthSlider && windowCenterSlider) {
                windowWidthSlider.value = currentWindowLevel.windowWidth.toString();
                windowCenterSlider.value = currentWindowLevel.windowCenter.toString();
                
                if (windowWidthValue) {
                    windowWidthValue.textContent = currentWindowLevel.windowWidth.toString();
                }
                if (windowCenterValue) {
                    windowCenterValue.textContent = currentWindowLevel.windowCenter.toString();
                }
            }
        };
        
        // Set up basic slider controls as fallback (if advanced panel initialization fails)
        const windowWidthSlider = document.getElementById('windowWidth') as HTMLInputElement;
        const windowCenterSlider = document.getElementById('windowCenter') as HTMLInputElement;
        const windowWidthValue = document.getElementById('windowWidthValue');
        const windowCenterValue = document.getElementById('windowCenterValue');
        
        if (windowWidthSlider && windowCenterSlider) {
            windowWidthSlider.addEventListener('input', () => {
                const windowWidth = parseInt(windowWidthSlider.value);
                const windowCenter = parseInt(windowCenterSlider.value);
                
                viewer.setWindowLevel(windowWidth, windowCenter);
                
                if (windowWidthValue) {
                    windowWidthValue.textContent = windowWidth.toString();
                }
            });
            
            windowCenterSlider.addEventListener('input', () => {
                const windowWidth = parseInt(windowWidthSlider.value);
                const windowCenter = parseInt(windowCenterSlider.value);
                
                viewer.setWindowLevel(windowWidth, windowCenter);
                
                if (windowCenterValue) {
                    windowCenterValue.textContent = windowCenter.toString();
                }
            });
        }
        
        (window as any).resetView = () => {
            viewer.resetView();
        };
        
        (window as any).flipHorizontal = () => {
            viewer.flipHorizontal();
        };
        
        (window as any).flipVertical = () => {
            viewer.flipVertical();
        };
        
        (window as any).rotateLeft = () => {
            viewer.rotate(-90);
        };
        
        (window as any).rotateRight = () => {
            viewer.rotate(90);
        };
        
        // Enhanced zoom control functions
        (window as any).zoomIn = () => {
            viewer.zoomIn();
        };
        
        (window as any).zoomOut = () => {
            viewer.zoomOut();
        };
        
        (window as any).zoomReset = () => {
            viewer.zoomReset();
        };
        
        (window as any).zoomFit = () => {
            viewer.zoomFit();
        };
        
        // Set up tool buttons - Basic Tools
        const panTool = document.getElementById('panTool');
        const zoomTool = document.getElementById('zoomTool');
        const windowLevelTool = document.getElementById('windowLevelTool');
        
        if (panTool) {
            panTool.addEventListener('click', () => {
                activateToolForCurrentMode('pan', 'panTool');
            });
        }
        if (zoomTool) {
            zoomTool.addEventListener('click', () => {
                activateToolForCurrentMode('zoom', 'zoomTool');
            });
        }
        if (windowLevelTool) {
            windowLevelTool.addEventListener('click', () => {
                activateToolForCurrentMode('windowLevel', 'windowLevelTool');
            });
        }
        
        // Set up measurement tools
        const measurementTools = [
            { id: 'lengthTool', name: 'length' },
            { id: 'angleTool', name: 'angle' },
            { id: 'heightTool', name: 'height' },
            { id: 'bidirectionalTool', name: 'bidirectional' },
            { id: 'cobbAngleTool', name: 'cobbAngle' },
            { id: 'probeTool', name: 'probe' },
            { id: 'referenceLinesTool', name: 'referenceLines' }
        ];
        
        measurementTools.forEach(tool => {
            const element = document.getElementById(tool.id);
            if (element) {
                element.addEventListener('click', () => {
                    activateToolForCurrentMode(tool.name, tool.id);
                });
            }
        });
        
        // Set up ROI tools
        const roiTools = [
            { id: 'rectangleROITool', name: 'rectangleROI' },
            { id: 'ellipticalROITool', name: 'ellipticalROI' },
            { id: 'circleROITool', name: 'circleROI' },
            { id: 'splineROITool', name: 'splineROI' }
        ];
        
        roiTools.forEach(tool => {
            const element = document.getElementById(tool.id);
            if (element) {
                element.addEventListener('click', () => {
                    activateToolForCurrentMode(tool.name, tool.id);
                });
            }
        });
        
        // Set up advanced tools (CrosshairsTool 제거됨 - 오류 발생 원인)
        const advancedTools = [
            // { id: 'crosshairsTool', name: 'crosshairs' },
            { id: 'magnifyTool', name: 'magnify' },
            { id: 'trackballRotateTool', name: 'trackballRotate' },
            { id: 'dragProbeTool', name: 'dragProbe' }
        ];
        
        advancedTools.forEach(tool => {
            const element = document.getElementById(tool.id);
            if (element) {
                element.addEventListener('click', () => {
                    viewer.activateTool(tool.name);
                    setActiveToolButton(tool.id);
                });
            }
        });
        
        // Set up segmentation tools (현재 비활성화 - 세그멘테이션 초기화 필요)
        // const segmentationTools = [
        //     { id: 'brushTool', name: 'brush' },
        //     { id: 'rectangleScissorsTool', name: 'rectangleScissors' },
        //     { id: 'circleScissorsTool', name: 'circleScissors' },
        //     { id: 'sphereScissorsTool', name: 'sphereScissors' }
        // ];
        
        // segmentationTools.forEach(tool => {
        //     const element = document.getElementById(tool.id);
        //     if (element) {
        //         element.addEventListener('click', () => {
        //             viewer.activateTool(tool.name);
        //             setActiveToolButton(tool.id);
        //         });
        //     }
        // });
        
        // Set up overlay tools (모두 비활성화 - 설정 필요)
        // const overlayTools = [
        //     // { id: 'overlayGridTool', name: 'overlayGrid' }, // sourceImageIds 설정 필요
        //     // { id: 'scaleOverlayTool', name: 'scaleOverlay' } // annotation.data 오류 발생
        // ];
        
        // overlayTools.forEach(tool => {
        //     const element = document.getElementById(tool.id);
        //     if (element) {
        //         element.addEventListener('click', () => {
        //             viewer.activateTool(tool.name);
        //             setActiveToolButton(tool.id);
        //         });
        //     }
        // });
        
        // Set up annotation tool buttons
        const textAnnotationTool = document.getElementById('textAnnotationTool');
        const arrowAnnotationTool = document.getElementById('arrowAnnotationTool');
        const clearAnnotations = document.getElementById('clearAnnotations');
        const annotationColor = document.getElementById('annotationColor') as HTMLInputElement;
        const annotationTheme = document.getElementById('annotationTheme') as HTMLSelectElement;
        
        if (textAnnotationTool) {
            textAnnotationTool.addEventListener('click', () => {
                activateToolForCurrentMode('label', 'textAnnotationTool');
                console.log('📝 Label tool ACTIVATED (for text annotations)');
            });
        }
        
        if (arrowAnnotationTool) {
            arrowAnnotationTool.addEventListener('click', () => {
                activateToolForCurrentMode('arrowAnnotate', 'arrowAnnotationTool');
                console.log('🏹 Arrow annotation tool ACTIVATED');
            });
        }
        
        if (clearAnnotations) {
            clearAnnotations.addEventListener('click', () => {
                // Use the new clearAllAnnotations method
                viewer.clearAllAnnotations();
            });
        }
        
        if (annotationColor) {
            annotationColor.addEventListener('change', (event) => {
                const target = event.target as HTMLInputElement;
                const color = target.value;
                
                // Update annotation styling using Cornerstone3D API
                // This will affect future annotations
                console.log('🎨 Annotation color changed to:', color);
                console.log('🎨 Note: Color changes will apply to new annotations');
            });
        }
        
        if (annotationTheme) {
            annotationTheme.addEventListener('change', (event) => {
                const target = event.target as HTMLSelectElement;
                const theme = target.value;
                
                // Apply theme using Cornerstone3D API
                console.log('🎨 Annotation theme changed to:', theme);
                console.log('🎨 Note: Theme changes will apply to new annotations');
            });
        }
        
        // Function to set active tool button
        function setActiveToolButton(toolId: string | null) {
            // Remove active class from all tool buttons
            const toolButtons = document.querySelectorAll('.control-group button');
            toolButtons.forEach(button => {
                button.classList.remove('active');
            });
            
            // Add active class to selected tool button
            if (toolId) {
                const activeButton = document.getElementById(toolId);
                if (activeButton) {
                    activeButton.classList.add('active');
                }
            }
        }
        
        // Enhanced tool activation that works with both single and multi-viewport modes
        function activateToolForCurrentMode(toolName: string, toolId: string) {
            try {
                const currentLayout = layoutManager ? layoutManager.getCurrentLayout() : '1x1';
                
                if (currentLayout === '1x1') {
                    // Use main viewer's tool activation
                    if (viewer && viewer.getInitializationStatus()) {
                        viewer.activateTool(toolName);
                        setActiveToolButton(toolId);
                        console.log(`Activated ${toolName} tool for main viewer`);
                    }
                } else {
                    // Use multi-viewport tool activation
                    const multiToolManager = MultiViewportToolManager.getInstance();
                    if (multiToolManager.activateTool(toolName)) {
                        setActiveToolButton(toolId);
                        console.log(`Activated ${toolName} tool for multi-viewport mode`);
                    }
                }
            } catch (error) {
                console.error(`Error activating ${toolName} tool:`, error);
            }
        }
        
        // Add annotation selection functionality with Shift+Click
        viewportElement.addEventListener('click', (event) => {
            viewer.selectAnnotation(event as MouseEvent);
        });
        
        // Keyboard shortcuts are handled in the comprehensive keyboard handler below
        
        // Set up annotation management buttons
        const enableMovementBtn = document.getElementById('enableMovement');
        const disableMovementBtn = document.getElementById('disableMovement');
        const clearSelectionBtn = document.getElementById('clearSelection');
        
        if (enableMovementBtn) {
            enableMovementBtn.addEventListener('click', () => {
                viewer.enableAnnotationMovement();
                enableMovementBtn.classList.add('active');
                disableMovementBtn?.classList.remove('active');
                console.log('🔄 Annotation movement enabled');
            });
        }
        
        if (disableMovementBtn) {
            disableMovementBtn.addEventListener('click', () => {
                viewer.disableAnnotationMovement();
                disableMovementBtn.classList.add('active');
                enableMovementBtn?.classList.remove('active');
                console.log('🔒 Annotation movement disabled');
            });
        }
        
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                viewer.clearAnnotationSelection();
                console.log('🔄 Annotation selection cleared');
            });
        }
        
        // Annotation tools are now handled by Cornerstone3D's built-in system
        // No need for custom click handlers
        
        // Annotations are now handled by Cornerstone3D's built-in rendering system
        
        // Set up layout button event handlers
        const layoutBtn1x1 = document.getElementById('layoutBtn1x1');
        const layoutBtn2x2 = document.getElementById('layoutBtn2x2');
        const layoutBtn1x3 = document.getElementById('layoutBtn1x3');
        
        let currentSyncGroupId: string | null = null;
        
        // Function to update sync group when viewports change
        function updateSyncGroup() {
            if (currentSyncGroupId && syncManager.getSyncGroup(currentSyncGroupId)) {
                const group = syncManager.getSyncGroup(currentSyncGroupId)!;
                const currentViewportIds = viewportManager.getViewportIds();
                
                // Remove viewports that no longer exist
                [...group.viewports].forEach(viewportId => {
                    if (!currentViewportIds.includes(viewportId)) {
                        syncManager.removeViewportFromSyncGroup(currentSyncGroupId!, viewportId);
                    }
                });
                
                // Add new viewports
                currentViewportIds.forEach(viewportId => {
                    if (!group.viewports.includes(viewportId)) {
                        syncManager.addViewportToSyncGroup(currentSyncGroupId!, viewportId);
                    }
                });
                
                console.log(`Updated sync group: ${group.viewports.length} viewports`);
            }
        }
        
        // Function to update the state of viewport control buttons
        function updateViewportControlsState() {
            if (!layoutManager) return;
            
            const canAdd = layoutManager.canAddMoreViewports();
            const viewportCount = layoutManager.getViewportCount();
            const canRemove = viewportCount > 1;
            
            const addViewportBtn = document.getElementById('addViewportBtn') as HTMLButtonElement;
            const removeViewportBtn = document.getElementById('removeViewportBtn') as HTMLButtonElement;
            const cloneViewportBtn = document.getElementById('cloneViewportBtn') as HTMLButtonElement;
            
            if (addViewportBtn) {
                addViewportBtn.disabled = !canAdd;
                addViewportBtn.style.opacity = canAdd ? '1' : '0.5';
            }
            
            if (removeViewportBtn) {
                removeViewportBtn.disabled = !canRemove;
                removeViewportBtn.style.opacity = canRemove ? '1' : '0.5';
            }
            
            if (cloneViewportBtn) {
                cloneViewportBtn.disabled = !canAdd;
                cloneViewportBtn.style.opacity = canAdd ? '1' : '0.5';
            }
            
            console.log(`Viewport controls updated - Can add: ${canAdd}, Can remove: ${canRemove}, Count: ${viewportCount}`);
            
            // Update sync group when viewport count changes
            updateSyncGroup();
        }

        function setActiveLayoutButton(activeButtonId: string) {
            // Remove active class from all layout buttons
            [layoutBtn1x1, layoutBtn2x2, layoutBtn1x3].forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            
            // Add active class to the selected button
            const activeButton = document.getElementById(activeButtonId);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        if (layoutBtn1x1) {
            layoutBtn1x1.addEventListener('click', async () => {
                if (layoutManager) {
                    // Destroy multi-viewport tool manager to avoid conflicts
                    const multiToolManager = MultiViewportToolManager.getInstance();
                    multiToolManager.destroy();
                    
                    layoutManager.setLayout('1x1', true);
                    layoutManager.initializeCornerstone3DViewports();
                    
                    // For 1x1 layout, use the main viewer's tool group instead
                    setTimeout(() => {
                        try {
                            // Reconnect tools to the main viewer
                            if (viewer && viewer.getInitializationStatus()) {
                                viewer.reconnectTools();
                                console.log('Reconnected main viewer tools for 1x1 layout');
                            }
                            
                            // Apply saved image state to new layout
                            const imageStateManager = ImageStateManager.getInstance();
                            if (imageStateManager.hasImageState()) {
                                imageStateManager.applyImageStateToAllViewports();
                                console.log('Applied saved image state to 1x1 layout');
                            }
                        } catch (error) {
                            console.error('Error reactivating main viewer tools:', error);
                        }
                    }, 300);
                    
                    setActiveLayoutButton('layoutBtn1x1');
                    updateViewportControlsState();
                    console.log('Switched to 1x1 layout with main viewer tools');
                }
            });
        }
        
        if (layoutBtn2x2) {
            layoutBtn2x2.addEventListener('click', async () => {
                if (layoutManager) {
                    layoutManager.setLayout('2x2', true);
                    layoutManager.initializeCornerstone3DViewports();
                    
                    // Re-initialize tools for new layout with improved timing
                    setTimeout(async () => {
                        try {
                            const multiToolManager = MultiViewportToolManager.getInstance();
                            await multiToolManager.setupMultiViewportTools();
                            
                            // Wait for viewports to be fully registered before association
                            setTimeout(async () => {
                                await multiToolManager.associateWithAllViewports();
                                
                                // Apply saved image state to new layout
                                const imageStateManager = ImageStateManager.getInstance();
                                if (imageStateManager.hasImageState()) {
                                    await imageStateManager.applyImageStateToAllViewports();
                                    console.log('Applied saved image state to 2x2 layout');
                                }
                                
                                // Refresh custom reference lines for new layout
                                const customRefLines = CustomReferenceLines.getInstance();
                                if (customRefLines.isActiveState()) {
                                    customRefLines.refresh();
                                    console.log('Refreshed reference lines for 2x2 layout');
                                }
                            }, 300);
                        } catch (error) {
                            console.error('Error reinitializing tools:', error);
                        }
                    }, 500);
                    
                    setActiveLayoutButton('layoutBtn2x2');
                    updateViewportControlsState();
                    console.log('Switched to 2x2 layout');
                }
            });
        }
        
        if (layoutBtn1x3) {
            layoutBtn1x3.addEventListener('click', async () => {
                if (layoutManager) {
                    layoutManager.setLayout('1x3', true);
                    layoutManager.initializeCornerstone3DViewports();
                    
                    // Re-initialize tools for new layout with improved timing
                    setTimeout(async () => {
                        try {
                            const multiToolManager = MultiViewportToolManager.getInstance();
                            await multiToolManager.setupMultiViewportTools();
                            
                            // Wait for viewports to be fully registered before association
                            setTimeout(async () => {
                                await multiToolManager.associateWithAllViewports();
                                
                                // Apply saved image state to new layout
                                const imageStateManager = ImageStateManager.getInstance();
                                if (imageStateManager.hasImageState()) {
                                    await imageStateManager.applyImageStateToAllViewports();
                                    console.log('Applied saved image state to 1x3 layout');
                                }
                                
                                // Refresh custom reference lines for new layout
                                const customRefLines = CustomReferenceLines.getInstance();
                                if (customRefLines.isActiveState()) {
                                    customRefLines.refresh();
                                    console.log('Refreshed reference lines for 1x3 layout');
                                }
                            }, 300);
                        } catch (error) {
                            console.error('Error reinitializing tools:', error);
                        }
                    }, 500);
                    
                    setActiveLayoutButton('layoutBtn1x3');
                    updateViewportControlsState();
                    console.log('Switched to 1x3 layout');
                }
            });
        }
        
        // Set up dynamic viewport controls
        const addViewportBtn = document.getElementById('addViewportBtn');
        const removeViewportBtn = document.getElementById('removeViewportBtn');
        const cloneViewportBtn = document.getElementById('cloneViewportBtn');
        
        if (addViewportBtn) {
            addViewportBtn.addEventListener('click', () => {
                if (layoutManager && layoutManager.canAddMoreViewports()) {
                    const newViewport = layoutManager.addViewport();
                    if (newViewport) {
                        console.log('Added new viewport successfully');
                        updateViewportControlsState();
                    }
                } else if (layoutManager) {
                    console.warn('Cannot add more viewports to current layout');
                    alert(`Current ${layoutManager.getCurrentLayout()} layout is at maximum capacity. Switch to a larger layout first.`);
                }
            });
        }
        
        if (removeViewportBtn) {
            removeViewportBtn.addEventListener('click', () => {
                const activeViewportId = viewportManager.getActiveViewportId();
                if (activeViewportId) {
                    const removed = layoutManager.removeViewportById(activeViewportId);
                    if (removed) {
                        console.log('Removed active viewport successfully');
                        updateViewportControlsState();
                    }
                } else {
                    // Remove the last viewport
                    const viewportCount = layoutManager.getViewportCount();
                    if (viewportCount > 1) {
                        const removed = layoutManager.removeViewport(viewportCount - 1);
                        if (removed) {
                            console.log('Removed last viewport successfully');
                            updateViewportControlsState();
                        }
                    } else {
                        console.warn('Cannot remove the last remaining viewport');
                        alert('At least one viewport must remain');
                    }
                }
            });
        }
        
        if (cloneViewportBtn) {
            cloneViewportBtn.addEventListener('click', () => {
                const activeViewportId = viewportManager.getActiveViewportId();
                if (activeViewportId) {
                    // Find the index of the active viewport
                    const viewportInfos = layoutManager.getViewportInfo();
                    const activeIndex = viewportInfos.findIndex(info => info.id === activeViewportId);
                    
                    if (activeIndex !== -1) {
                        if (layoutManager.canAddMoreViewports()) {
                            const clonedViewport = layoutManager.cloneViewport(activeIndex);
                            if (clonedViewport) {
                                console.log('Cloned active viewport successfully');
                                updateViewportControlsState();
                            }
                        } else {
                            console.warn('Cannot clone viewport: layout at maximum capacity');
                            alert(`Current ${layoutManager.getCurrentLayout()} layout is at maximum capacity. Switch to a larger layout first.`);
                        }
                    }
                } else {
                    console.warn('No active viewport to clone');
                    alert('Please select a viewport to clone first');
                }
            });
        }
        
        // Initial state update
        updateViewportControlsState();
        
        // Set up synchronization controls
        const syncPanBtn = document.getElementById('syncPanBtn');
        const syncZoomBtn = document.getElementById('syncZoomBtn');
        const syncWLBtn = document.getElementById('syncWLBtn');
        const syncAllBtn = document.getElementById('syncAllBtn');
        const syncOffBtn = document.getElementById('syncOffBtn');
        
        function setActiveSyncButton(activeButtonId: string | null) {
            const syncPanBtn = document.getElementById('syncPanBtn');
            const syncZoomBtn = document.getElementById('syncZoomBtn');
            const syncWLBtn = document.getElementById('syncWLBtn');
            const syncAllBtn = document.getElementById('syncAllBtn');
            const syncOffBtn = document.getElementById('syncOffBtn');
            
            [syncPanBtn, syncZoomBtn, syncWLBtn, syncAllBtn, syncOffBtn].forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            
            if (activeButtonId) {
                const activeButton = document.getElementById(activeButtonId);
                if (activeButton) {
                    activeButton.classList.add('active');
                }
            }
        }
        
        function createSyncGroup(syncTypes: SyncType[], buttonId: string) {
            // Remove existing sync group
            if (currentSyncGroupId) {
                syncManager.removeSyncGroup(currentSyncGroupId);
            }
            
            // Create new sync group
            currentSyncGroupId = `sync-group-${Date.now()}`;
            syncManager.createSyncGroup(currentSyncGroupId, syncTypes);
            
            // Add all current viewports to sync group
            const viewportIds = viewportManager.getViewportIds();
            viewportIds.forEach(viewportId => {
                syncManager.addViewportToSyncGroup(currentSyncGroupId!, viewportId);
            });
            
            setActiveSyncButton(buttonId);
            console.log(`Created sync group with types: [${syncTypes.join(', ')}], viewports: ${viewportIds.length}`);
        }
        
        if (syncPanBtn) {
            syncPanBtn.addEventListener('click', () => {
                createSyncGroup([SyncType.PAN], 'syncPanBtn');
            });
        }
        
        if (syncZoomBtn) {
            syncZoomBtn.addEventListener('click', () => {
                createSyncGroup([SyncType.ZOOM], 'syncZoomBtn');
            });
        }
        
        if (syncWLBtn) {
            syncWLBtn.addEventListener('click', () => {
                createSyncGroup([SyncType.WINDOW_LEVEL], 'syncWLBtn');
            });
        }
        
        if (syncAllBtn) {
            syncAllBtn.addEventListener('click', () => {
                createSyncGroup([SyncType.PAN, SyncType.ZOOM, SyncType.WINDOW_LEVEL, SyncType.CAMERA], 'syncAllBtn');
            });
        }
        
        if (syncOffBtn) {
            syncOffBtn.addEventListener('click', () => {
                if (currentSyncGroupId) {
                    syncManager.removeSyncGroup(currentSyncGroupId);
                    currentSyncGroupId = null;
                }
                setActiveSyncButton('syncOffBtn');
                console.log('Disabled viewport synchronization');
            });
        }
        
        // Set up test runner
        const runTestsBtn = document.getElementById('runTestsBtn') as HTMLButtonElement;
        if (runTestsBtn) {
            runTestsBtn.addEventListener('click', async () => {
                console.log('🧪 Starting comprehensive tests...');
                runTestsBtn.textContent = '🔄 Running Tests...';
                runTestsBtn.disabled = true;
                
                try {
                    // Run both multi-viewport and series navigation tests
                    console.log('📊 Running Multi-Viewport Tests...');
                    const multiViewportResults = await runMultiViewportTests();
                    
                    console.log('📑 Running Series Navigation Tests...');
                    const seriesNavigationResults = await runSeriesNavigationTests();
                    
                    // Combine results
                    const allResults = [...multiViewportResults, ...seriesNavigationResults];
                    
                    // Calculate overall results
                    const totalTests = allResults.reduce((sum, suite) => sum + suite.totalTests, 0);
                    const totalPassed = allResults.reduce((sum, suite) => sum + suite.passedTests, 0);
                    const passRate = ((totalPassed / totalTests) * 100).toFixed(1);
                    
                    runTestsBtn.textContent = `✅ Tests: ${totalPassed}/${totalTests} (${passRate}%)`;
                    
                    // Detailed summary
                    const multiViewportTotal = multiViewportResults.reduce((sum, suite) => sum + suite.totalTests, 0);
                    const multiViewportPassed = multiViewportResults.reduce((sum, suite) => sum + suite.passedTests, 0);
                    const seriesNavigationTotal = seriesNavigationResults.reduce((sum, suite) => sum + suite.totalTests, 0);
                    const seriesNavigationPassed = seriesNavigationResults.reduce((sum, suite) => sum + suite.passedTests, 0);
                    
                    // Alert with comprehensive summary
                    alert(`🧪 Comprehensive Tests Completed!\n\n` +
                          `📊 Multi-Viewport: ${multiViewportPassed}/${multiViewportTotal}\n` +
                          `📑 Series Navigation: ${seriesNavigationPassed}/${seriesNavigationTotal}\n\n` +
                          `🎯 Overall: ${totalPassed}/${totalTests} (${passRate}%)\n\n` +
                          `Check console for detailed results.`);
                    
                } catch (error) {
                    console.error('Error running tests:', error);
                    runTestsBtn.textContent = '❌ Test Error';
                    alert('Error running tests. Check console for details.');
                } finally {
                    runTestsBtn.disabled = false;
                    
                    // Reset button text after delay
                    setTimeout(() => {
                        runTestsBtn.textContent = '🧪 Run Tests';
                    }, 5000);
                }
            });
        }
        
        // Set up debug images button for troubleshooting multi-viewport image loading
        const debugImagesBtn = document.getElementById('debugImagesBtn') as HTMLButtonElement;
        if (debugImagesBtn) {
            debugImagesBtn.addEventListener('click', async () => {
                console.log('🔧 Debug Images: Checking multi-viewport image loading...');
                const imageStateManager = ImageStateManager.getInstance();
                
                // Show debug info
                const debugInfo = imageStateManager.getDebugInfo();
                console.log('📊 Image State Debug Info:', debugInfo);
                
                debugImagesBtn.textContent = '🔄 Debugging...';
                debugImagesBtn.disabled = true;
                
                try {
                    if (imageStateManager.hasImageState()) {
                        console.log('🔄 Force reloading images to all multi-viewports...');
                        await imageStateManager.forceReloadToMultiViewports();
                        
                        // Also verify tool associations
                        const multiToolManager = MultiViewportToolManager.getInstance();
                        multiToolManager.verifyAssociations();
                        
                        debugImagesBtn.textContent = '✅ Debug Complete';
                        alert(`Debug Complete!\n\nImages: ${debugInfo.imageCount} loaded\nCheck console for detailed results.`);
                    } else {
                        debugImagesBtn.textContent = '⚠️ No Images';
                        alert('No images loaded yet. Load DICOM files first, then try debugging.');
                    }
                } catch (error) {
                    console.error('❌ Debug error:', error);
                    debugImagesBtn.textContent = '❌ Debug Error';
                    alert('Debug error occurred. Check console for details.');
                } finally {
                    debugImagesBtn.disabled = false;
                    
                    // Reset button text after delay
                    setTimeout(() => {
                        debugImagesBtn.textContent = '🔧 Debug Images';
                    }, 3000);
                }
            });
        }
        
        // Set up window resize handler to maintain image aspect ratio
        let resizeTimeout: number;
        window.addEventListener('resize', () => {
            // Debounce resize events to prevent excessive calls
            clearTimeout(resizeTimeout);
            resizeTimeout = window.setTimeout(() => {
                console.log('Window resized, updating viewports...');
                viewer.resize();
                layoutManager.resize(); // Also resize layout manager viewports
            }, 150);
        });
        
        // Set up mouse wheel zoom functionality
        viewportElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            
            // Check if images are loaded before allowing wheel zoom
            if (!viewer.getInitializationStatus()) {
                return;
            }
            
            const delta = event.deltaY;
            if (delta < 0) {
                // Scroll up - zoom in
                viewer.zoomIn(1.1);
            } else {
                // Scroll down - zoom out
                viewer.zoomOut(1.1);
            }
        }, { passive: false });
        
        // Set up keyboard navigation
        document.addEventListener('keydown', (event) => {
            // Only handle keyboard shortcuts when no input field is focused
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            // Check if images are loaded before allowing keyboard navigation
            if (!viewer.getInitializationStatus()) {
                return;
            }
            
            switch (event.key) {
                case '+':
                case '=':
                    event.preventDefault();
                    viewer.zoomIn();
                    break;
                case '-':
                case '_':
                    event.preventDefault();
                    viewer.zoomOut();
                    break;
                case '0':
                    event.preventDefault();
                    viewer.zoomReset();
                    break;
                case 'r':
                case 'R':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        viewer.resetView();
                    }
                    break;
                case 'f':
                case 'F':
                    event.preventDefault();
                    viewer.zoomFit();
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    // Pan left
                    const leftViewport = viewer.getViewport();
                    if (leftViewport) {
                        const camera = leftViewport.getCamera();
                        if (camera && camera.position) {
                            const panStep = 10;
                            leftViewport.setCamera({
                                ...camera,
                                position: [camera.position[0] - panStep, camera.position[1], camera.position[2]]
                            });
                            leftViewport.render();
                        }
                    }
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    // Pan right
                    const rightViewport = viewer.getViewport();
                    if (rightViewport) {
                        const camera = rightViewport.getCamera();
                        if (camera && camera.position) {
                            const panStep = 10;
                            rightViewport.setCamera({
                                ...camera,
                                position: [camera.position[0] + panStep, camera.position[1], camera.position[2]]
                            });
                            rightViewport.render();
                        }
                    }
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    // Pan up
                    const upViewport = viewer.getViewport();
                    if (upViewport) {
                        const camera = upViewport.getCamera();
                        if (camera && camera.position) {
                            const panStep = 10;
                            upViewport.setCamera({
                                ...camera,
                                position: [camera.position[0], camera.position[1] + panStep, camera.position[2]]
                            });
                            upViewport.render();
                        }
                    }
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    // Pan down
                    const downViewport = viewer.getViewport();
                    if (downViewport) {
                        const camera = downViewport.getCamera();
                        if (camera && camera.position) {
                            const panStep = 10;
                            downViewport.setCamera({
                                ...camera,
                                position: [camera.position[0], camera.position[1] - panStep, camera.position[2]]
                            });
                            downViewport.render();
                        }
                    }
                    break;
                case 'Escape':
                    // Clear annotation selection on Escape key (already handled above)
                    viewer.clearAnnotationSelection();
                    break;
                    
                // Series Navigation Keys
                case 'PageUp':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        // Navigate to previous series
                        if (seriesManager.hasPreviousSeries()) {
                            seriesManager.previousSeries();
                            console.log('📑 Navigated to previous series');
                        }
                    }
                    break;
                    
                case 'PageDown':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        // Navigate to next series
                        if (seriesManager.hasNextSeries()) {
                            seriesManager.nextSeries();
                            console.log('📑 Navigated to next series');
                        }
                    }
                    break;
                    
                case 'Home':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        // Go to first series
                        if (seriesManager.getSeriesCount() > 0) {
                            seriesManager.setCurrentSeries(0);
                            console.log('📑 Navigated to first series');
                        }
                    }
                    break;
                    
                case 'End':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        // Go to last series
                        const seriesCount = seriesManager.getSeriesCount();
                        if (seriesCount > 0) {
                            seriesManager.setCurrentSeries(seriesCount - 1);
                            console.log('📑 Navigated to last series');
                        }
                    }
                    break;
                    
                // Image Navigation within Series (when thumbnail viewer is focused)
                case 'n':
                case 'N':
                    if (!event.ctrlKey && !event.altKey) {
                        event.preventDefault();
                        // Next image in current series
                        if (thumbnailViewer) {
                            const currentIndex = thumbnailViewer.getCurrentImageIndex();
                            const imageCount = thumbnailViewer.getImageCount();
                            if (currentIndex < imageCount - 1) {
                                thumbnailViewer.selectImage(currentIndex + 1);
                                console.log('🖼️ Navigated to next image');
                            }
                        }
                    }
                    break;
                    
                case 'p':
                case 'P':
                    if (!event.ctrlKey && !event.altKey) {
                        event.preventDefault();
                        // Previous image in current series
                        if (thumbnailViewer) {
                            const currentIndex = thumbnailViewer.getCurrentImageIndex();
                            if (currentIndex > 0) {
                                thumbnailViewer.selectImage(currentIndex - 1);
                                console.log('🖼️ Navigated to previous image');
                            }
                        }
                    }
                    break;
            }
        });
        
        // Set up touch gesture handlers for mobile devices
        let touchStartDistance = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let isTouchZooming = false;
        let isTouchPanning = false;
        
        // Touch start handler
        viewportElement.addEventListener('touchstart', (event) => {
            if (!viewer.getInitializationStatus()) {
                return;
            }
            
            event.preventDefault();
            
            if (event.touches.length === 2) {
                // Two finger touch - prepare for pinch zoom
                isTouchZooming = true;
                isTouchPanning = false;
                
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];
                
                touchStartDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
            } else if (event.touches.length === 1) {
                // Single finger touch - prepare for pan
                isTouchPanning = true;
                isTouchZooming = false;
                
                const touch = event.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
            }
        }, { passive: false });
        
        // Touch move handler
        viewportElement.addEventListener('touchmove', (event) => {
            if (!viewer.getInitializationStatus()) {
                return;
            }
            
            event.preventDefault();
            
            if (isTouchZooming && event.touches.length === 2) {
                // Handle pinch zoom
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];
                
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                
                const scaleFactor = currentDistance / touchStartDistance;
                
                if (scaleFactor > 1.05) {
                    // Pinch out - zoom in
                    viewer.zoomIn(1.1);
                    touchStartDistance = currentDistance;
                } else if (scaleFactor < 0.95) {
                    // Pinch in - zoom out
                    viewer.zoomOut(1.1);
                    touchStartDistance = currentDistance;
                }
            } else if (isTouchPanning && event.touches.length === 1) {
                // Handle single finger pan
                const touch = event.touches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;
                
                if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                    const viewport = viewer.getViewport();
                    if (viewport) {
                        const camera = viewport.getCamera();
                        if (camera && camera.position) {
                            const panSensitivity = 0.5;
                            
                            viewport.setCamera({
                                ...camera,
                                position: [
                                    camera.position[0] - deltaX * panSensitivity,
                                    camera.position[1] + deltaY * panSensitivity,
                                    camera.position[2]
                                ]
                            });
                            viewport.render();
                            
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                        }
                    }
                }
            }
        }, { passive: false });
        
        // Touch end handler
        viewportElement.addEventListener('touchend', (event) => {
            event.preventDefault();
            
            if (event.touches.length === 0) {
                // All fingers lifted
                isTouchZooming = false;
                isTouchPanning = false;
                touchStartDistance = 0;
                touchStartX = 0;
                touchStartY = 0;
            } else if (event.touches.length === 1 && isTouchZooming) {
                // Went from two fingers to one - switch to panning
                isTouchZooming = false;
                isTouchPanning = true;
                
                const touch = event.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
            }
        }, { passive: false });
        
        // Initialize Series Comparator
        let seriesComparator: SeriesComparator | null = null;
        const mainViewportContainer = document.getElementById('main-viewport-container') as HTMLElement;
        const comparisonViewportContainer = document.getElementById('comparison-viewport-container') as HTMLElement;
        
        // Series Comparison Controls
        const loadComparisonBtn = document.getElementById('loadComparisonBtn');
        const toggleCameraSyncBtn = document.getElementById('toggleCameraSyncBtn');
        const toggleVOISyncBtn = document.getElementById('toggleVOISyncBtn');
        const resetComparisonBtn = document.getElementById('resetComparisonBtn');
        const exitComparisonBtn = document.getElementById('exitComparisonBtn');
        
        if (loadComparisonBtn) {
            loadComparisonBtn.addEventListener('click', async () => {
                try {
                    // Destroy existing comparator if it exists
                    if (seriesComparator) {
                        seriesComparator.destroy();
                    }
                    
                    // Switch to comparison mode
                    mainViewportContainer.style.display = 'none';
                    comparisonViewportContainer.style.display = 'flex';
                    
                    // Create new series comparator
                    seriesComparator = new SeriesComparator(comparisonViewportContainer);
                    
                    // Generate mock image IDs for demonstration
                    const series1ImageIds = createMockImageIds('series1', 20);
                    const series2ImageIds = createMockImageIds('series2', 20);
                    
                    // Load and compare the series
                    await seriesComparator.loadAndCompareSeries({
                        series1ImageIds,
                        series2ImageIds,
                        containerElement: comparisonViewportContainer,
                        syncCamera: true,
                        syncVOI: true
                    });
                    
                    // Update button states
                    if (toggleCameraSyncBtn) toggleCameraSyncBtn.classList.add('active');
                    if (toggleVOISyncBtn) toggleVOISyncBtn.classList.add('active');
                    
                    // Update status
                    const statusText = document.getElementById('statusText');
                    if (statusText) {
                        statusText.textContent = 'Series comparison loaded successfully';
                    }
                    
                    console.log('Series comparison loaded successfully');
                    
                } catch (error) {
                    console.error('Error loading series comparison:', error);
                    
                    // Update status
                    const statusText = document.getElementById('statusText');
                    if (statusText) {
                        statusText.textContent = `Error loading comparison: ${error}`;
                    }
                }
            });
        }
        
        if (toggleCameraSyncBtn) {
            toggleCameraSyncBtn.addEventListener('click', () => {
                if (seriesComparator) {
                    const isActive = toggleCameraSyncBtn.classList.contains('active');
                    seriesComparator.toggleCameraSync(!isActive);
                    
                    if (isActive) {
                        toggleCameraSyncBtn.classList.remove('active');
                    } else {
                        toggleCameraSyncBtn.classList.add('active');
                    }
                    
                    console.log(`Camera sync ${!isActive ? 'enabled' : 'disabled'}`);
                }
            });
        }
        
        if (toggleVOISyncBtn) {
            toggleVOISyncBtn.addEventListener('click', () => {
                if (seriesComparator) {
                    const isActive = toggleVOISyncBtn.classList.contains('active');
                    seriesComparator.toggleVOISync(!isActive);
                    
                    if (isActive) {
                        toggleVOISyncBtn.classList.remove('active');
                    } else {
                        toggleVOISyncBtn.classList.add('active');
                    }
                    
                    console.log(`VOI sync ${!isActive ? 'enabled' : 'disabled'}`);
                }
            });
        }
        
        if (resetComparisonBtn) {
            resetComparisonBtn.addEventListener('click', () => {
                if (seriesComparator) {
                    seriesComparator.resetViewports();
                    console.log('Comparison viewports reset');
                }
            });
        }
        
        if (exitComparisonBtn) {
            exitComparisonBtn.addEventListener('click', () => {
                // Exit comparison mode and return to main viewer
                if (seriesComparator) {
                    seriesComparator.destroy();
                    seriesComparator = null;
                }
                
                // Switch back to main viewport
                comparisonViewportContainer.style.display = 'none';
                mainViewportContainer.style.display = 'flex';
                
                // Reset button states
                if (toggleCameraSyncBtn) toggleCameraSyncBtn.classList.remove('active');
                if (toggleVOISyncBtn) toggleVOISyncBtn.classList.remove('active');
                
                // Update status
                const statusText = document.getElementById('statusText');
                if (statusText) {
                    statusText.textContent = 'Returned to main DICOM viewer';
                }
                
                console.log('Exited comparison mode');
            });
        }
        
        console.log('Cornerstone3D initialized successfully with enhanced navigation!');
        
        // Update status
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = 'Ready - Load DICOM files to begin viewing';
        }
        
    } catch (error) {
        console.error('Error initializing Cornerstone3D:', error);
        
        // Update status
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = `Error: ${error}`;
        }
    }
});