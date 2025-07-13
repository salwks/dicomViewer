import { 
    Types,
    Enums,
    eventTarget,
    getRenderingEngine
} from '@cornerstonejs/core';
import { 
    ToolGroupManager,
    PanTool,
    ZoomTool,
    WindowLevelTool,
    LengthTool,
    AngleTool,
    StackScrollTool,
    Enums as ToolEnums
} from '@cornerstonejs/tools';

import { setupRenderingEngine, renderViewport } from '../core/renderingEngine';
import { initializeViewport, createStackViewport, resetViewport } from '../core/viewport';
import { ImageLoadingManager, SeriesInfo, StudyInfo } from '../core/imageLoadingManager';
import { windowLevelPresets } from '../config/windowLevelPresets';

export interface ViewerOptions {
    viewportId?: string;
    renderingEngineId?: string;
    toolGroupId?: string;
    enableTools?: boolean;
    background?: Types.Point3;
}

export interface ViewerState {
    isInitialized: boolean;
    currentSeriesInfo: SeriesInfo | null;
    currentImageIndex: number;
    isLoading: boolean;
    error: string | null;
}

export class BasicDicomViewer extends EventTarget {
    private element: HTMLElement;
    private renderingEngine: Types.IRenderingEngine;
    private viewport: Types.IStackViewport | null = null;
    private toolGroup: any = null;
    private imageLoadingManager: ImageLoadingManager;
    
    private options: Required<ViewerOptions>;
    private state: ViewerState = {
        isInitialized: false,
        currentSeriesInfo: null,
        currentImageIndex: 0,
        isLoading: false,
        error: null
    };

    constructor(element: HTMLElement, options: ViewerOptions = {}) {
        super();
        
        this.element = element;
        this.options = {
            viewportId: options.viewportId || `viewport-${Date.now()}`,
            renderingEngineId: options.renderingEngineId || `rendering-engine-${Date.now()}`,
            toolGroupId: options.toolGroupId || `tool-group-${Date.now()}`,
            enableTools: options.enableTools !== false,
            background: options.background || [0, 0, 0]
        };

        this.renderingEngine = setupRenderingEngine(this.options.renderingEngineId);
        this.imageLoadingManager = new ImageLoadingManager();
        
        this.setupEventListeners();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            console.log('Initializing BasicDicomViewer...');

            // Create the viewport
            this.viewport = createStackViewport(
                this.renderingEngine,
                this.element,
                this.options.viewportId
            ) as Types.IStackViewport;

            // Setup tools if enabled
            if (this.options.enableTools) {
                this.setupTools();
            }

            this.setState({
                isInitialized: true,
                error: null
            });

            this.dispatchEvent(new CustomEvent('viewerInitialized', {
                detail: { viewerId: this.options.viewportId }
            }));

            console.log('BasicDicomViewer initialized successfully');

        } catch (error) {
            console.error('Error initializing BasicDicomViewer:', error);
            this.setState({
                isInitialized: false,
                error: `Initialization failed: ${error}`
            });
            
            this.dispatchEvent(new CustomEvent('viewerError', {
                detail: { error }
            }));
        }
    }

    private setupTools(): void {
        try {
            // Create tool group
            this.toolGroup = ToolGroupManager.createToolGroup(this.options.toolGroupId);

            if (this.toolGroup) {
                // Add tools to tool group
                this.toolGroup.addTool(PanTool.toolName);
                this.toolGroup.addTool(ZoomTool.toolName);
                this.toolGroup.addTool(WindowLevelTool.toolName);
                this.toolGroup.addTool(LengthTool.toolName);
                this.toolGroup.addTool(AngleTool.toolName);
                this.toolGroup.addTool(StackScrollTool.toolName);

                // Set default active tools
                this.toolGroup.setToolActive(WindowLevelTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Primary,
                        },
                    ],
                });

                this.toolGroup.setToolActive(PanTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Auxiliary,
                        },
                    ],
                });

                this.toolGroup.setToolActive(ZoomTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Secondary,
                        },
                    ],
                });

                // Associate tool group with viewport
                this.toolGroup.addViewport(this.options.viewportId, this.options.renderingEngineId);

                console.log('Tools setup completed');
            }

        } catch (error) {
            console.error('Error setting up tools:', error);
        }
    }

    private setupEventListeners(): void {
        // Listen to image loading manager events
        this.imageLoadingManager.addEventListener('loadingStarted', (event) => {
            this.setState({ isLoading: true });
            this.dispatchEvent(new CustomEvent('loadingStarted', {
                detail: (event as CustomEvent).detail
            }));
        });

        this.imageLoadingManager.addEventListener('loadingProgress', (event) => {
            this.dispatchEvent(new CustomEvent('loadingProgress', {
                detail: (event as CustomEvent).detail
            }));
        });

        this.imageLoadingManager.addEventListener('studyLoaded', (event) => {
            this.setState({ isLoading: false });
            this.dispatchEvent(new CustomEvent('studyLoaded', {
                detail: (event as CustomEvent).detail
            }));
        });

        this.imageLoadingManager.addEventListener('loadingError', (event) => {
            this.setState({ 
                isLoading: false,
                error: `Loading failed: ${(event as CustomEvent).detail.error}`
            });
            this.dispatchEvent(new CustomEvent('loadingError', {
                detail: (event as CustomEvent).detail
            }));
        });

        this.imageLoadingManager.addEventListener('currentSeriesChanged', (event) => {
            this.setState({
                currentSeriesInfo: (event as CustomEvent).detail.seriesInfo,
                currentImageIndex: 0
            });
        });
    }

    public async loadFiles(files: File[]): Promise<StudyInfo> {
        try {
            console.log(`Loading ${files.length} files...`);
            
            const studyInfo = await this.imageLoadingManager.loadFilesAsStudy(files);
            
            // Load the first series automatically
            if (studyInfo.series.length > 0) {
                await this.loadSeries(studyInfo.series[0]);
            }

            return studyInfo;

        } catch (error) {
            console.error('Error loading files:', error);
            throw error;
        }
    }

    public async loadSeries(seriesInfo: SeriesInfo): Promise<void> {
        try {
            if (!this.viewport) {
                throw new Error('Viewport not initialized');
            }

            console.log(`Loading series: ${seriesInfo.seriesDescription}`);

            this.setState({ 
                isLoading: true,
                currentSeriesInfo: seriesInfo,
                currentImageIndex: 0
            });

            // Set the stack of images
            await this.viewport.setStack(seriesInfo.imageIds, 0);

            // Render the viewport
            this.renderingEngine.render();

            this.setState({ isLoading: false });

            this.dispatchEvent(new CustomEvent('seriesLoaded', {
                detail: { seriesInfo }
            }));

            console.log(`Series loaded: ${seriesInfo.seriesDescription}`);

        } catch (error) {
            console.error('Error loading series:', error);
            this.setState({ 
                isLoading: false,
                error: `Failed to load series: ${error}`
            });
            throw error;
        }
    }

    public setWindowLevel(windowWidth: number, windowCenter: number): void {
        if (!this.viewport) return;

        try {
            this.viewport.setProperties({
                voiRange: {
                    upper: windowCenter + windowWidth / 2,
                    lower: windowCenter - windowWidth / 2,
                },
            });

            this.renderingEngine.render();

        } catch (error) {
            console.error('Error setting window/level:', error);
        }
    }

    public applyWindowLevelPreset(presetName: string): void {
        const preset = windowLevelPresets[presetName];
        if (preset) {
            this.setWindowLevel(preset.windowWidth, preset.windowCenter);
        }
    }

    public getCurrentWindowLevel(): { windowWidth: number; windowCenter: number } | null {
        if (!this.viewport) return null;

        try {
            const properties = this.viewport.getProperties();
            if (properties.voiRange) {
                const windowWidth = properties.voiRange.upper - properties.voiRange.lower;
                const windowCenter = (properties.voiRange.upper + properties.voiRange.lower) / 2;
                return { windowWidth, windowCenter };
            }
        } catch (error) {
            console.error('Error getting window/level:', error);
        }

        return null;
    }

    public resetView(): void {
        if (!this.viewport) return;

        try {
            resetViewport(this.viewport);
            console.log('View reset successfully');
        } catch (error) {
            console.error('Error resetting view:', error);
        }
    }

    public flipHorizontal(): void {
        if (!this.viewport) return;

        try {
            // Get current camera and flip horizontally by modifying the view up vector
            const camera = this.viewport.getCamera();
            if (camera.viewUp) {
                camera.viewUp = [camera.viewUp[0] * -1, camera.viewUp[1], camera.viewUp[2]];
                this.viewport.setCamera(camera);
            }
            this.renderingEngine.render();
        } catch (error) {
            console.error('Error flipping horizontal:', error);
        }
    }

    public flipVertical(): void {
        if (!this.viewport) return;

        try {
            // Get current camera and flip vertically by modifying the view up vector
            const camera = this.viewport.getCamera();
            if (camera.viewUp) {
                camera.viewUp = [camera.viewUp[0], camera.viewUp[1] * -1, camera.viewUp[2]];
                this.viewport.setCamera(camera);
            }
            this.renderingEngine.render();
        } catch (error) {
            console.error('Error flipping vertical:', error);
        }
    }

    public rotate(degrees: number): void {
        if (!this.viewport) return;

        try {
            // Use camera rotation for viewport rotation
            const camera = this.viewport.getCamera();
            if (!camera.viewUp) return;
            
            const radians = (degrees * Math.PI) / 180;
            
            // Rotate the view up vector
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            const [ux, uy, uz] = camera.viewUp;
            
            camera.viewUp = [
                ux * cos - uy * sin,
                ux * sin + uy * cos,
                uz
            ];
            
            this.viewport.setCamera(camera);
            this.renderingEngine.render();
        } catch (error) {
            console.error('Error rotating:', error);
        }
    }

    public activateTool(toolName: string): void {
        if (!this.toolGroup) return;

        try {
            // Deactivate all tools first
            this.toolGroup.setToolPassive(PanTool.toolName);
            this.toolGroup.setToolPassive(ZoomTool.toolName);
            this.toolGroup.setToolPassive(WindowLevelTool.toolName);
            this.toolGroup.setToolPassive(LengthTool.toolName);
            this.toolGroup.setToolPassive(AngleTool.toolName);

            // Activate the selected tool
            switch (toolName) {
                case 'pan':
                    this.toolGroup.setToolActive(PanTool.toolName, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
                    });
                    break;
                case 'zoom':
                    this.toolGroup.setToolActive(ZoomTool.toolName, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
                    });
                    break;
                case 'windowLevel':
                    this.toolGroup.setToolActive(WindowLevelTool.toolName, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
                    });
                    break;
                case 'length':
                    this.toolGroup.setToolActive(LengthTool.toolName, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
                    });
                    break;
                case 'angle':
                    this.toolGroup.setToolActive(AngleTool.toolName, {
                        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
                    });
                    break;
            }

            this.dispatchEvent(new CustomEvent('toolActivated', {
                detail: { toolName }
            }));

        } catch (error) {
            console.error('Error activating tool:', error);
        }
    }

    public nextImage(): boolean {
        if (!this.viewport || !this.state.currentSeriesInfo) return false;

        try {
            const maxIndex = this.state.currentSeriesInfo.imageIds.length - 1;
            const nextIndex = Math.min(this.state.currentImageIndex + 1, maxIndex);
            
            if (nextIndex !== this.state.currentImageIndex) {
                this.viewport.setImageIdIndex(nextIndex);
                this.renderingEngine.render();
                
                this.setState({ currentImageIndex: nextIndex });
                
                this.dispatchEvent(new CustomEvent('imageIndexChanged', {
                    detail: { imageIndex: nextIndex }
                }));
                
                return true;
            }
            
            return false;

        } catch (error) {
            console.error('Error going to next image:', error);
            return false;
        }
    }

    public previousImage(): boolean {
        if (!this.viewport || !this.state.currentSeriesInfo) return false;

        try {
            const prevIndex = Math.max(this.state.currentImageIndex - 1, 0);
            
            if (prevIndex !== this.state.currentImageIndex) {
                this.viewport.setImageIdIndex(prevIndex);
                this.renderingEngine.render();
                
                this.setState({ currentImageIndex: prevIndex });
                
                this.dispatchEvent(new CustomEvent('imageIndexChanged', {
                    detail: { imageIndex: prevIndex }
                }));
                
                return true;
            }
            
            return false;

        } catch (error) {
            console.error('Error going to previous image:', error);
            return false;
        }
    }

    public goToImage(index: number): boolean {
        if (!this.viewport || !this.state.currentSeriesInfo) return false;

        try {
            const maxIndex = this.state.currentSeriesInfo.imageIds.length - 1;
            const validIndex = Math.max(0, Math.min(index, maxIndex));
            
            this.viewport.setImageIdIndex(validIndex);
            this.renderingEngine.render();
            
            this.setState({ currentImageIndex: validIndex });
            
            this.dispatchEvent(new CustomEvent('imageIndexChanged', {
                detail: { imageIndex: validIndex }
            }));
            
            return true;

        } catch (error) {
            console.error('Error going to image:', error);
            return false;
        }
    }

    public getState(): ViewerState {
        return { ...this.state };
    }

    public getStudies(): StudyInfo[] {
        return this.imageLoadingManager.getStudies();
    }

    public getCurrentSeries(): SeriesInfo | null {
        return this.imageLoadingManager.getCurrentSeries();
    }

    public getImageLoadingManager(): ImageLoadingManager {
        return this.imageLoadingManager;
    }

    public getViewport(): Types.IStackViewport | null {
        return this.viewport;
    }

    public getRenderingEngine(): Types.IRenderingEngine {
        return this.renderingEngine;
    }

    private setState(newState: Partial<ViewerState>): void {
        this.state = { ...this.state, ...newState };
        
        this.dispatchEvent(new CustomEvent('stateChanged', {
            detail: { state: this.state }
        }));
    }

    public dispose(): void {
        try {
            // Clean up tool group
            if (this.toolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroup.id);
            }

            // Clean up viewport
            if (this.viewport) {
                this.renderingEngine.disableElement(this.viewport.id);
            }

            // Clean up image loading manager
            this.imageLoadingManager.dispose();

            // Clean up event listeners
            // Note: BasicDicomViewer extends EventTarget which doesn't have removeAllEventListeners
            // In a real implementation, you would track and remove specific listeners

            console.log('BasicDicomViewer disposed successfully');

        } catch (error) {
            console.error('Error disposing BasicDicomViewer:', error);
        }
    }
}