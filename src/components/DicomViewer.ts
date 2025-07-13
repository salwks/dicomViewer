import { 
    RenderingEngine, 
    Enums,
    Types,
    getRenderingEngine,
    setVolumesForViewports,
    imageLoader
} from '@cornerstonejs/core';
import { 
    ToolGroupManager,
    PanTool,
    ZoomTool,
    WindowLevelTool,
    LengthTool,
    AngleTool,
    StackScrollTool,
    ArrowAnnotateTool,
    LabelTool,
    Enums as ToolEnums,
    annotation,
    // Additional tools that exist in simpleInit
    HeightTool,
    BidirectionalTool,
    CobbAngleTool,
    ProbeTool,
    RectangleROITool,
    EllipticalROITool,
    CircleROITool,
    CrosshairsTool,
    MagnifyTool,
    BrushTool,
    RectangleScissorsTool,
    CircleScissorsTool,
    SphereScissorsTool,
    OverlayGridTool,
    ScaleOverlayTool,
    OrientationMarkerTool,
    ETDRSGridTool,
    ReferenceLinesTool,
    TrackballRotateTool,
    DragProbeTool,
    SplineROITool
} from '@cornerstonejs/tools';
import { windowLevelPresets, getPresetByName } from '../config/windowLevelPresets';
import { WindowLevelController } from '../core/windowLevelController';
import { RotationController } from '../core/rotationController';
import { FlipController } from '../core/flipController';
import { CustomReferenceLines } from '../tools/customReferenceLines';

export class DicomViewer {
    private element: HTMLElement;
    private renderingEngine: RenderingEngine | null = null;
    private viewport: Types.IStackViewport | null = null;
    private currentImageIds: string[] = [];
    private currentImageIndex: number = 0;
    private toolGroup: any | null = null;
    private renderingEngineId: string = 'dicom-viewer';
    private viewportId: string = 'viewport-1';
    private toolGroupId: string = 'dicom-viewer-tools';
    private isInitialized: boolean = false;
    private successfullyAddedTools: string[] = [];
    private flipState = {
        horizontal: false,
        vertical: false
    };
    private baseCamera: any = null; // Store original camera state for flips
    private windowLevelController: WindowLevelController | null = null;
    private rotationController: RotationController | null = null;
    private flipController: FlipController | null = null;
    
    constructor(element: HTMLElement) {
        this.element = element;
    }
    
    public async init(): Promise<void> {
        if (this.isInitialized) {
            console.log('DicomViewer already initialized');
            return;
        }
        
        try {
            await this.initialize();
            this.isInitialized = true;
            console.log('DicomViewer initialized successfully');
        } catch (error) {
            console.error('Error initializing DicomViewer:', error);
            throw error;
        }
    }
    
    public getInitializationStatus(): boolean {
        return this.isInitialized && this.viewport !== null && this.toolGroup !== null;
    }
    
    private async initialize(): Promise<void> {
        // Step 1: Prepare the element
        this.prepareElement();
        
        // Step 2: Create or get rendering engine
        this.setupRenderingEngine();
        
        // Step 3: Create viewport
        await this.createViewport();
        
        // Step 4: Create and configure tool group
        await this.setupToolGroup();
        
        // Step 5: Associate tool group with viewport
        await this.associateToolGroupWithViewport();
        
        // Step 6: Initialize window/level controller
        this.initializeWindowLevelController();
        
        // Step 7: Setup annotation debugging
        this.setupAnnotationDebugging();
        
        // Step 8: Setup annotation event listeners for this specific viewport
        this.setupViewportAnnotationListeners();
    }
    
    private prepareElement(): void {
        // Ensure element has proper dimensions
        const computedStyle = getComputedStyle(this.element);
        
        if (!this.element.style.width || this.element.style.width === '0px') {
            this.element.style.width = '100%'; // Fill container width
        }
        if (!this.element.style.height || this.element.style.height === '0px') {
            this.element.style.height = '100%'; // Fill container height
        }
        
        // Ensure element is positioned
        if (computedStyle.position === 'static') {
            this.element.style.position = 'relative';
        }
        
        // Ensure element has a background
        if (!this.element.style.backgroundColor) {
            this.element.style.backgroundColor = '#000000';
        }
        
        console.log('Element prepared with dimensions:', {
            width: this.element.style.width,
            height: this.element.style.height
        });
    }
    
    private setupRenderingEngine(): void {
        // Try to get existing rendering engine first
        this.renderingEngine = getRenderingEngine(this.renderingEngineId) || null;
        
        if (!this.renderingEngine) {
            // Create new rendering engine
            this.renderingEngine = new RenderingEngine(this.renderingEngineId);
            console.log('Created new rendering engine:', this.renderingEngineId);
        } else {
            console.log('Using existing rendering engine:', this.renderingEngineId);
        }
    }
    
    private async createViewport(): Promise<void> {
        if (!this.renderingEngine) {
            throw new Error('Rendering engine not initialized');
        }
        
        try {
            // Enable element as a viewport
            const viewportInput = {
                viewportId: this.viewportId,
                element: this.element as HTMLDivElement,
                type: Enums.ViewportType.STACK,
                defaultOptions: {
                    background: [0, 0, 0] as Types.Point3,
                    displayArea: {
                        storeAsInitialCamera: true,
                        imageArea: [1, 1] as [number, number], // Full image area
                        displayArea: [0, 0, 1, 1] as [number, number, number, number], // Full display area (normalized coordinates)
                        type: 'FIT' as const // Maintains aspect ratio on resize
                    }
                }
            };
            
            console.log('Creating viewport with input:', viewportInput);
            
            this.renderingEngine.enableElement(viewportInput);
            
            // Wait for the viewport to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the viewport
            this.viewport = this.renderingEngine.getViewport(this.viewportId) as Types.IStackViewport;
            
            if (!this.viewport) {
                throw new Error('Failed to create viewport');
            }
            
            // Validate viewport type
            if (this.viewport.type !== Enums.ViewportType.STACK) {
                throw new Error('Viewport type mismatch');
            }
            
            // Initialize annotation state for this viewport
            this.initializeAnnotationState();
            
            // Initialize orientation controllers
            this.initializeOrientationControllers();
            
            console.log('Viewport created successfully:', {
                id: this.viewportId,
                type: this.viewport.type,
                element: this.viewport.element
            });
            
        } catch (error) {
            console.error('Error creating viewport:', error);
            throw new Error(`Failed to create viewport: ${error}`);
        }
    }
    
    private async setupToolGroup(): Promise<void> {
        try {
            // Destroy existing tool group if it exists
            const existingToolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
            if (existingToolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroupId);
            }
            
            // Wait a moment to ensure cleanup is complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Create new tool group
            this.toolGroup = ToolGroupManager.createToolGroup(this.toolGroupId);
            
            if (!this.toolGroup) {
                throw new Error('Failed to create tool group');
            }
            
            // Set up error handling for tool group operations
            this.toolGroup.on?.('error', (error: any) => {
                console.warn('Tool group error:', error);
            });
            
            // Add tools with error handling
            const toolsToAdd = [
                // Basic manipulation tools
                { tool: PanTool.toolName, name: 'Pan' },
                { tool: ZoomTool.toolName, name: 'Zoom' },
                { tool: WindowLevelTool.toolName, name: 'WindowLevel' },
                { tool: StackScrollTool.toolName, name: 'StackScroll' },
                
                // Measurement tools
                { tool: LengthTool.toolName, name: 'Length' },
                { tool: AngleTool.toolName, name: 'Angle' },
                { tool: HeightTool.toolName, name: 'Height' },
                { tool: BidirectionalTool.toolName, name: 'Bidirectional' },
                { tool: CobbAngleTool.toolName, name: 'CobbAngle' },
                { tool: ProbeTool.toolName, name: 'Probe' },
                { tool: ReferenceLinesTool.toolName, name: 'ReferenceLines' },
                
                // ROI tools
                { tool: RectangleROITool.toolName, name: 'RectangleROI' },
                { tool: EllipticalROITool.toolName, name: 'EllipticalROI' },
                { tool: CircleROITool.toolName, name: 'CircleROI' },
                { tool: SplineROITool.toolName, name: 'SplineROI' },
                
                // Annotation tools
                { tool: ArrowAnnotateTool.toolName, name: 'ArrowAnnotate' },
                { tool: LabelTool.toolName, name: 'Label' },
                
                // Advanced tools (CrosshairsTool 제외 - 오류 발생 원인)
                // { tool: CrosshairsTool.toolName, name: 'Crosshairs' },
                { tool: MagnifyTool.toolName, name: 'Magnify' },
                { tool: TrackballRotateTool.toolName, name: 'TrackballRotate' },
                { tool: DragProbeTool.toolName, name: 'DragProbe' },
                
                // Segmentation tools (세그멘테이션 초기화 필요 - 현재 비활성화)
                // { tool: BrushTool.toolName, name: 'Brush' },
                // { tool: RectangleScissorsTool.toolName, name: 'RectangleScissors' },
                // { tool: CircleScissorsTool.toolName, name: 'CircleScissors' },
                // { tool: SphereScissorsTool.toolName, name: 'SphereScissors' },
                
                // Overlay tools (설정 필요 - 모두 비활성화)
                // { tool: OverlayGridTool.toolName, name: 'OverlayGrid' }, // sourceImageIds 설정 필요
                // { tool: ScaleOverlayTool.toolName, name: 'ScaleOverlay' }, // annotation.data 오류 발생
                { tool: OrientationMarkerTool.toolName, name: 'OrientationMarker' },
                // { tool: ETDRSGridTool.toolName, name: 'ETDRSGrid' } // 설정 필요
            ];
            
            const successfulTools: string[] = [];
            const failedTools: string[] = [];
            
            const addedToolNames: string[] = [];
            
            for (const { tool, name } of toolsToAdd) {
                try {
                    this.toolGroup.addTool(tool);
                    successfulTools.push(name);
                    addedToolNames.push(tool); // Store actual tool name
                    console.log(`🔍 [TOOL_DEBUG] ✅ Added tool: ${name} (${tool})`);
                } catch (error) {
                    console.warn(`Failed to add tool ${name} (${tool}):`, error);
                    failedTools.push(name);
                }
            }
            
            console.log(`✅ Successfully added ${successfulTools.length} tools:`, successfulTools);
            console.log(`🔍 [TOOL_DEBUG] Actual tool names added:`, addedToolNames);
            if (failedTools.length > 0) {
                console.warn(`❌ Failed to add ${failedTools.length} tools:`, failedTools);
            }
            
            console.log('✓ All working tools added to toolGroup:', Object.keys(this.toolGroup._toolInstances || {}));
            
            // Set all successfully added tools to passive initially (will be activated after image loading)
            addedToolNames.forEach(toolName => {
                try {
                    this.toolGroup.setToolPassive(toolName);
                    console.log(`🔍 [TOOL_DEBUG] Set ${toolName} to passive`);
                } catch (error) {
                    console.warn(`Failed to set tool ${toolName} to passive:`, error);
                }
            });
            
            // Store successfully added tools for later use (use actual tool names)
            this.successfullyAddedTools = [...addedToolNames];
            
            // Add event listeners to handle tool group errors
            this.setupToolGroupEventListeners();
            
            console.log('Tool group configured successfully');
            
        } catch (error) {
            console.error('Error setting up tool group:', error);
            throw new Error(`Failed to setup tool group: ${error}`);
        }
    }
    
    private async associateToolGroupWithViewport(): Promise<void> {
        console.log('🔍 [TOOL_DEBUG] Starting viewport-toolgroup association...');
        console.log('🔍 [TOOL_DEBUG] Tool group available:', !!this.toolGroup);
        console.log('🔍 [TOOL_DEBUG] Viewport available:', !!this.viewport);
        console.log('🔍 [TOOL_DEBUG] Viewport ID:', this.viewportId);
        console.log('🔍 [TOOL_DEBUG] Rendering Engine ID:', this.renderingEngineId);
        
        if (!this.toolGroup) {
            throw new Error('Tool group not initialized');
        }
        
        if (!this.viewport) {
            throw new Error('Viewport not initialized');
        }
        
        try {
            // Verify viewport is properly initialized
            if (!this.viewport.element) {
                throw new Error('Viewport element not set');
            }
            
            console.log('🔍 [TOOL_DEBUG] Viewport element available:', !!this.viewport.element);
            console.log('🔍 [TOOL_DEBUG] Viewport element ID:', this.viewport.element.id);
            
            // Wait for viewport to be fully ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check current toolgroup viewports before adding
            const currentViewports = this.toolGroup.getViewportIds();
            console.log('🔍 [TOOL_DEBUG] Current toolgroup viewports before adding:', currentViewports);
            
            // Associate tool group with viewport using viewport ID and rendering engine ID
            // This is the correct way according to Cornerstone3D documentation
            this.toolGroup.addViewport(this.viewportId, this.renderingEngineId);
            console.log('🔍 [TOOL_DEBUG] ✅ Called toolGroup.addViewport');
            
            // Wait for association to complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Verify association
            const newViewports = this.toolGroup.getViewportIds();
            console.log('🔍 [TOOL_DEBUG] Toolgroup viewports after adding:', newViewports);
            
            console.log('Tool group associated with viewport successfully:', {
                viewportId: this.viewportId,
                renderingEngineId: this.renderingEngineId
            });
            
        } catch (error) {
            console.error('Error associating tool group with viewport:', error);
            console.error('Viewport state:', {
                viewport: !!this.viewport,
                viewportId: this.viewportId,
                renderingEngineId: this.renderingEngineId,
                element: !!this.viewport?.element
            });
            throw new Error(`Failed to associate tool group with viewport: ${error}`);
        }
    }
    
    public async loadDicomFiles(files: File[]): Promise<void> {
        if (!this.getInitializationStatus()) {
            throw new Error('DicomViewer not properly initialized');
        }
        
        if (!this.viewport) {
            throw new Error('Viewport not available');
        }
        
        try {
            console.log(`Loading ${files.length} DICOM files...`);
            
            // Ensure tool group is ready before loading images
            if (!this.toolGroup) {
                console.warn('Tool group not available, reinitializing...');
                await this.setupToolGroup();
                await this.associateToolGroupWithViewport();
            }
            
            // Clear previous images
            this.currentImageIds = [];
            this.currentImageIndex = 0;
            
            // Convert files to image IDs
            const imageIds: string[] = [];
            
            for (const file of files) {
                // Create a blob URL for the file
                const blob = new Blob([file], { type: 'application/dicom' });
                const blobUrl = URL.createObjectURL(blob);
                
                // Create wadouri image ID
                const imageId = `wadouri:${blobUrl}`;
                imageIds.push(imageId);
            }
            
            this.currentImageIds = imageIds;
            
            if (imageIds.length > 0) {
                // Set the stack of images
                await this.viewport.setStack(imageIds, this.currentImageIndex);
                
                // Render the viewport
                if (this.renderingEngine) {
                    this.renderingEngine.render();
                }
                
                console.log(`Successfully loaded ${imageIds.length} DICOM images`);
                
                // Load images to all viewports in multi-viewport layouts
                await this.loadImagesToAllViewports(imageIds);
                
                // Activate default tools after successful image loading
                await this.activateDefaultTools();
            }
            
        } catch (error) {
            console.error('Error loading DICOM files:', error);
            throw new Error(`Failed to load DICOM files: ${error}`);
        }
    }
    
    /**
     * Load images to all available viewports in multi-viewport layouts
     * @param imageIds - Array of image IDs to load
     */
    private async loadImagesToAllViewports(imageIds: string[]): Promise<void> {
        try {
            // Get all viewport elements from the multi-viewport system
            const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
            
            if (viewportElements.length <= 1) {
                // Single viewport, already handled
                return;
            }
            
            console.log(`Loading images to ${viewportElements.length} multi-viewports`);
            
            // Get the multi-viewport rendering engine
            const multiViewportEngine = getRenderingEngine('multi-viewport-engine');
            if (!multiViewportEngine) {
                console.warn('Multi-viewport rendering engine not found');
                return;
            }
            
            for (let i = 0; i < viewportElements.length; i++) {
                const element = viewportElements[i] as HTMLElement;
                const viewportId = element.dataset.viewportId;
                
                if (!viewportId) continue;
                
                try {
                    // Get the viewport from multi-viewport rendering engine
                    const viewport = multiViewportEngine.getViewport(viewportId);
                    
                    if (viewport && 'setStack' in viewport) {
                        // Load the same image stack to each viewport
                        await (viewport as Types.IStackViewport).setStack(imageIds, 0);
                        
                        // Hide loading indicator
                        const loadingIndicator = element.querySelector('.viewport-loading');
                        if (loadingIndicator) {
                            (loadingIndicator as HTMLElement).style.display = 'none';
                        }
                        
                        console.log(`Loaded images to multi-viewport: ${viewportId}`);
                    }
                } catch (viewportError) {
                    console.warn(`Error loading images to viewport ${viewportId}:`, viewportError);
                }
            }
            
            // Render all multi-viewports
            multiViewportEngine.render();
            console.log('Rendered all multi-viewports with images');
            
        } catch (error) {
            console.error('Error loading images to multiple viewports:', error);
        }
    }
    
    private async activateDefaultTools(): Promise<void> {
        if (!this.toolGroup) {
            console.warn('Tool group not available for tool activation');
            return;
        }
        
        try {
            // Wait for tools to be fully initialized
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Activate default tools after image loading with safe checking
            if (this.successfullyAddedTools.includes(WindowLevelTool.toolName)) {
                this.toolGroup.setToolActive(WindowLevelTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Primary,
                        },
                    ],
                });
            }
            
            if (this.successfullyAddedTools.includes(PanTool.toolName)) {
                this.toolGroup.setToolActive(PanTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Auxiliary,
                        },
                    ],
                });
            }
            
            if (this.successfullyAddedTools.includes(ZoomTool.toolName)) {
                this.toolGroup.setToolActive(ZoomTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Secondary,
                        },
                    ],
                });
            }
            
            // Wait for tools to be activated
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Enable annotation movement by default (passive mode)
            this.enableAnnotationMovement();
            
            console.log('Default tools activated after image loading');
            
        } catch (error) {
            console.error('Error activating default tools:', error);
        }
    }
    
    
    public resetView(): void {
        if (!this.viewport) return;
        
        try {
            // Reset camera
            this.viewport.resetCamera();
            
            // Reset flip state
            this.flipState.horizontal = false;
            this.flipState.vertical = false;
            
            // Reset base camera
            this.baseCamera = null;
            
            console.log('View and flip state reset');
            
            if (this.renderingEngine) {
                this.renderingEngine.render();
            }
        } catch (error) {
            console.error('Error resetting view:', error);
        }
    }
    
    public flipHorizontal(): void {
        // Use the new flip controller
        this.toggleHorizontalFlip();
    }
    
    public flipVertical(): void {
        // Use the new flip controller
        this.toggleVerticalFlip();
    }
    
    private applyFlipTransformations(): void {
        if (!this.viewport || !this.baseCamera) return;
        
        try {
            // Start with base camera state
            const camera = JSON.parse(JSON.stringify(this.baseCamera));
            
            // Calculate transform matrix for flips
            let transformMatrix = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];
            
            // Apply horizontal flip (invert X axis)
            if (this.flipState.horizontal) {
                transformMatrix[0] = -1; // Scale X by -1
            }
            
            // Apply vertical flip (invert Y axis)  
            if (this.flipState.vertical) {
                transformMatrix[5] = -1; // Scale Y by -1
            }
            
            // Apply transformations to camera vectors
            if (camera.viewUp && camera.viewUp.length >= 3) {
                // Apply horizontal flip
                if (this.flipState.horizontal) {
                    camera.viewUp[0] = -this.baseCamera.viewUp[0];
                } else {
                    camera.viewUp[0] = this.baseCamera.viewUp[0];
                }
                
                // Apply vertical flip
                if (this.flipState.vertical) {
                    camera.viewUp[1] = -this.baseCamera.viewUp[1];
                } else {
                    camera.viewUp[1] = this.baseCamera.viewUp[1];
                }
                
                // Keep Z unchanged
                camera.viewUp[2] = this.baseCamera.viewUp[2];
            }
            
            // Also transform viewPlaneNormal for horizontal flip
            if (camera.viewPlaneNormal && camera.viewPlaneNormal.length >= 3) {
                if (this.flipState.horizontal) {
                    camera.viewPlaneNormal[0] = -this.baseCamera.viewPlaneNormal[0];
                } else {
                    camera.viewPlaneNormal[0] = this.baseCamera.viewPlaneNormal[0];
                }
                
                camera.viewPlaneNormal[1] = this.baseCamera.viewPlaneNormal[1];
                camera.viewPlaneNormal[2] = this.baseCamera.viewPlaneNormal[2];
            }
            
            // Apply the transformed camera
            this.viewport.setCamera(camera);
            
            if (this.renderingEngine) {
                this.renderingEngine.render();
            }
            
            console.log(`Applied transformations - H: ${this.flipState.horizontal}, V: ${this.flipState.vertical}`);
            
        } catch (error) {
            console.error('Error applying flip transformations:', error);
        }
    }
    
    private applyHorizontalFlipFallback(): void {
        if (!this.viewport) return;
        
        try {
            // Alternative approach using viewport scaling/transform properties
            const camera = this.viewport.getCamera();
            
            if (camera && camera.viewUp && camera.viewUp.length >= 3) {
                // Try a different approach: modify the focal point position
                if (camera.focalPoint && camera.position) {
                    const direction = [
                        camera.focalPoint[0] - camera.position[0],
                        camera.focalPoint[1] - camera.position[1], 
                        camera.focalPoint[2] - camera.position[2]
                    ];
                    
                    // Invert X direction for horizontal flip
                    direction[0] = -direction[0];
                    
                    camera.focalPoint = [
                        camera.position[0] + direction[0],
                        camera.position[1] + direction[1],
                        camera.position[2] + direction[2]
                    ];
                    
                    this.viewport.setCamera(camera);
                    this.renderingEngine?.render();
                    
                    console.log('Applied horizontal flip using focal point manipulation');
                }
            }
        } catch (error) {
            console.error('Horizontal flip fallback also failed:', error);
        }
    }
    
    public rotate(degrees: number): void {
        // Use the new rotation controller
        this.rotateImageByDegrees(degrees);
    }
    
    private safeActivateTool(toolDisplayName: string, actualToolName: string, bindings: any): boolean {
        console.log(`🔍 [TOOL_DEBUG] Attempting to activate tool: ${toolDisplayName} (${actualToolName})`);
        console.log(`🔍 [TOOL_DEBUG] Tool available in successfully added tools:`, this.successfullyAddedTools.includes(actualToolName));
        console.log(`🔍 [TOOL_DEBUG] All successfully added tools:`, this.successfullyAddedTools);
        console.log(`🔍 [TOOL_DEBUG] Tool bindings:`, bindings);
        
        if (!this.successfullyAddedTools.includes(actualToolName)) {
            console.warn(`🔍 [TOOL_DEBUG] ${toolDisplayName} tool not available (not successfully added)`);
            return false;
        }
        
        try {
            this.toolGroup.setToolActive(actualToolName, { bindings });
            console.log(`🔍 [TOOL_DEBUG] ✅ Successfully activated ${toolDisplayName} tool`);
            
            // Check if this is an annotation tool and log additional info
            const annotationTools = ['ArrowAnnotateTool', 'LabelTool', 'LengthTool', 'AngleTool', 'HeightTool', 'BidirectionalTool', 'CobbAngleTool', 'ProbeTool', 'RectangleROITool', 'EllipticalROITool', 'CircleROITool', 'SplineROITool'];
            if (annotationTools.some(tool => actualToolName.includes(tool))) {
                console.log(`🔍 [TOOL_DEBUG] 📝 Annotation tool activated - ready for annotation creation!`);
            }
            
            return true;
        } catch (error) {
            console.warn(`🔍 [TOOL_DEBUG] ❌ Failed to activate ${toolDisplayName} tool:`, error);
            return false;
        }
    }
    
    private safeGetAllAnnotations(): any[] {
        try {
            const annotations = annotation.state.getAllAnnotations();
            
            // Check if annotations exist and is array
            if (!annotations || !Array.isArray(annotations)) {
                console.warn('getAllAnnotations returned invalid data:', annotations);
                return [];
            }
            
            return annotations;
        } catch (error) {
            console.error('Error getting all annotations:', error);
            return [];
        }
    }
    
    private safeGetAnnotationsForViewport(viewportId?: string): any[] {
        try {
            const targetViewportId = viewportId || this.viewportId;
            
            // Get all annotations first
            const allAnnotations = this.safeGetAllAnnotations();
            
            // Filter annotations for this viewport
            const viewportAnnotations = allAnnotations.filter(ann => {
                // Check if annotation is valid and has required properties
                if (!ann || !ann.metadata) {
                    return false;
                }
                
                // Check if annotation belongs to this viewport
                return ann.metadata.viewportId === targetViewportId;
            });
            
            return viewportAnnotations;
        } catch (error) {
            console.error('Error getting annotations for viewport:', error);
            return [];
        }
    }
    
    private initializeAnnotationState(): void {
        try {
            // Initialize annotation state for this viewport
            console.log('Initializing annotation state for viewport:', this.viewportId);
            
            // Check if annotation state is properly initialized
            if (!annotation || !annotation.state) {
                console.warn('Annotation state not available');
                return;
            }
            
            // Ensure annotation state is properly initialized for this viewport
            // This helps prevent the undefined filteredToolAnnotations error
            console.log('Annotation state initialized successfully');
            
        } catch (error) {
            console.error('Error initializing annotation state:', error);
        }
    }
    
    private setupToolGroupEventListeners(): void {
        if (!this.toolGroup) {
            return;
        }
        
        try {
            // Add custom mouse move handler to prevent undefined errors
            const element = this.element;
            if (!element) return;
            
            // Override the default mouse move handler to add safety checks
            const originalMouseMoveHandler = element.onmousemove;
            
            element.addEventListener('mousemove', (evt) => {
                try {
                    // Only process mouse move if we have a valid viewport and images loaded
                    if (!this.viewport || !this.currentImageIds.length) {
                        return;
                    }
                    
                    // Check if annotation state is valid
                    const annotations = this.safeGetAllAnnotations();
                    if (!annotations) {
                        return;
                    }
                    
                    // Continue with original handling if everything is safe
                    if (originalMouseMoveHandler) {
                        originalMouseMoveHandler.call(element, evt);
                    }
                    
                } catch (error) {
                    console.warn('Error in mouse move handler:', error);
                    // Prevent the error from bubbling up
                    evt.stopPropagation();
                }
            }, { capture: true, passive: true });
            
            console.log('Tool group event listeners configured');
            
        } catch (error) {
            console.error('Error setting up tool group event listeners:', error);
        }
    }
    
    public activateTool(toolName: string): void {
        console.log('🔍 [TOOL_DEBUG] activateTool called with:', toolName);
        console.log('🔍 [TOOL_DEBUG] Tool group available:', !!this.toolGroup);
        console.log('🔍 [TOOL_DEBUG] Current images loaded:', this.currentImageIds.length);
        console.log('🔍 [TOOL_DEBUG] Viewport available:', !!this.viewport);
        console.log('🔍 [TOOL_DEBUG] Element ID:', this.element?.id);
        
        if (!this.toolGroup) {
            console.warn('🔍 [TOOL_DEBUG] Tool group not available');
            return;
        }
        
        // Check if images are loaded before activating tools
        if (this.currentImageIds.length === 0) {
            console.warn('🔍 [TOOL_DEBUG] Cannot activate tools without loaded images');
            return;
        }
        
        try {
            // Deactivate all successfully added tools first
            this.successfullyAddedTools.forEach(toolName => {
                try {
                    this.toolGroup.setToolPassive(toolName);
                } catch (error) {
                    console.warn(`Failed to set tool ${toolName} to passive:`, error);
                }
            });
            
            // Activate the selected tool
            switch (toolName) {
                case 'pan':
                    this.safeActivateTool('Pan', PanTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'zoom':
                    this.safeActivateTool('Zoom', ZoomTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'windowLevel':
                    this.safeActivateTool('WindowLevel', WindowLevelTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'length':
                    this.safeActivateTool('Length', LengthTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'angle':
                    this.safeActivateTool('Angle', AngleTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'arrowAnnotate':
                    console.log('🎯 Activating ArrowAnnotateTool:', ArrowAnnotateTool.toolName);
                    this.safeActivateTool('ArrowAnnotate', ArrowAnnotateTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'label':
                    console.log('🎯 Activating LabelTool:', LabelTool.toolName);
                    this.safeActivateTool('Label', LabelTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                    
                // Additional tool cases for tools that are registered in simpleInit
                case 'height':
                    this.safeActivateTool('Height', HeightTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'bidirectional':
                    this.safeActivateTool('Bidirectional', BidirectionalTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'cobbAngle':
                    this.safeActivateTool('CobbAngle', CobbAngleTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'probe':
                    this.safeActivateTool('Probe', ProbeTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'referenceLines':
                    this.activateCustomReferenceLines();
                    break;
                case 'rectangleROI':
                    this.safeActivateTool('RectangleROI', RectangleROITool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'ellipticalROI':
                    this.safeActivateTool('EllipticalROI', EllipticalROITool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'circleROI':
                    this.safeActivateTool('CircleROI', CircleROITool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'splineROI':
                    this.safeActivateTool('SplineROI', SplineROITool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                // CrosshairsTool 제거됨 - 오류 발생 원인
                // case 'crosshairs':
                //     this.safeActivateTool('Crosshairs', CrosshairsTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
                case 'magnify':
                    this.safeActivateTool('Magnify', MagnifyTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'trackballRotate':
                    this.safeActivateTool('TrackballRotate', TrackballRotateTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                case 'dragProbe':
                    this.safeActivateTool('DragProbe', DragProbeTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                    break;
                // Segmentation tools 비활성화됨
                // case 'brush':
                //     this.safeActivateTool('Brush', BrushTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
                // case 'rectangleScissors':
                //     this.safeActivateTool('RectangleScissors', RectangleScissorsTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
                // case 'circleScissors':
                //     this.safeActivateTool('CircleScissors', CircleScissorsTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
                // case 'sphereScissors':
                //     this.safeActivateTool('SphereScissors', SphereScissorsTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
                // case 'overlayGrid': // OverlayGridTool 비활성화됨
                //     this.safeActivateTool('OverlayGrid', OverlayGridTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
                // case 'scaleOverlay': // ScaleOverlayTool 비활성화됨 - annotation.data 오류
                //     this.safeActivateTool('ScaleOverlay', ScaleOverlayTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                //     break;
            }
            
            // Update tool button states
            this.updateToolButtonStates(toolName);
            
        } catch (error) {
            console.error('Error activating tool:', error);
        }
    }
    
    private updateToolButtonStates(activeToolName: string): void {
        // Remove active class from all tool buttons
        const toolButtons = document.querySelectorAll('.toolbar button, .control-group button');
        toolButtons.forEach(button => button.classList.remove('active'));
        
        // Add active class to the current tool button
        const activeButton = document.getElementById(`${activeToolName}Tool`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    public getRenderingEngine(): RenderingEngine | null {
        return this.renderingEngine;
    }
    
    public getViewport(): Types.IStackViewport | null {
        return this.viewport;
    }
    
    public getCurrentImageId(): string | null {
        if (this.currentImageIds.length > 0 && this.currentImageIndex >= 0) {
            return this.currentImageIds[this.currentImageIndex];
        }
        return null;
    }
    
    public getCurrentImageIds(): string[] {
        return [...this.currentImageIds];
    }
    
    public getCurrentImageIndex(): number {
        return this.currentImageIndex;
    }
    
    /**
     * Reconnect tools to the main viewport (for use after multi-viewport mode)
     */
    public reconnectTools(): void {
        if (!this.toolGroup || !this.renderingEngine || !this.viewport) {
            console.warn('Cannot reconnect tools: missing components');
            return;
        }
        
        try {
            // Remove any existing viewport associations
            this.toolGroup.removeViewports(this.renderingEngine.id);
            
            // Re-add the main viewport
            this.toolGroup.addViewport(this.viewportId, this.renderingEngine.id);
            
            // Reactivate default tools
            this.activateDefaultTools();
            
            console.log('Successfully reconnected tools to main viewport');
            
        } catch (error) {
            console.error('Error reconnecting tools:', error);
        }
    }
    
    // Annotation Selection and Movement Features
    public selectAnnotation(event: MouseEvent): void {
        if (!this.viewport) {
            console.warn('Viewport not available for annotation selection');
            return;
        }
        
        try {
            // Check if Shift key is held (default selection modifier)
            if (event.shiftKey) {
                // Get all annotations for this viewport with safe checking
                const annotations = this.safeGetAllAnnotations();
                console.log('Attempting to select annotation with Shift+Click');
                console.log('Available annotations:', annotations.length);
                
                // The selection functionality is handled by Cornerstone3D automatically
                // when annotation tools are in passive mode and shift is held
                
                // Render to update selection visual
                if (this.renderingEngine) {
                    this.renderingEngine.render();
                }
            }
            
        } catch (error) {
            console.error('Error selecting annotation:', error);
        }
    }
    
    public clearAnnotationSelection(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for clearing annotation selection');
            return;
        }
        
        try {
            // Get all annotations with safe checking
            const annotations = this.safeGetAllAnnotations();
            
            // Check if annotations exist
            if (annotations.length === 0) {
                console.warn('No annotations found to clear selection');
                return;
            }
            
            // Deselect each annotation with safe checking
            annotations.forEach(ann => {
                if (ann && ann.annotationUID) {
                    try {
                        if (annotation.selection.isAnnotationSelected(ann.annotationUID)) {
                            annotation.selection.deselectAnnotation(ann.annotationUID);
                        }
                    } catch (error) {
                        console.warn('Error deselecting annotation:', ann.annotationUID, error);
                    }
                }
            });
            
            // Render to update display
            if (this.renderingEngine) {
                this.renderingEngine.render();
            }
            
            console.log('All annotations deselected');
            
        } catch (error) {
            console.error('Error clearing annotation selection:', error);
        }
    }
    
    public getSelectedAnnotations(): any[] {
        if (!this.viewport) {
            return [];
        }
        
        try {
            // Get all annotations with proper error checking
            const allAnnotations = this.safeGetAllAnnotations();
            
            // Check if annotations exist
            if (allAnnotations.length === 0) {
                console.warn('No annotations found');
                return [];
            }
            
            // Filter for selected ones with safe checking
            const selectedAnnotations = allAnnotations.filter(ann => {
                // Check if annotation is valid and has required properties
                if (!ann || !ann.annotationUID) {
                    return false;
                }
                
                try {
                    return annotation.selection.isAnnotationSelected(ann.annotationUID);
                } catch (error) {
                    console.warn('Error checking annotation selection:', error);
                    return false;
                }
            });
            
            return selectedAnnotations || [];
            
        } catch (error) {
            console.error('Error getting selected annotations:', error);
            return [];
        }
    }
    
    public enableAnnotationMovement(): void {
        if (!this.toolGroup) {
            console.warn('Tool group not available for annotation movement');
            return;
        }
        
        try {
            // Set annotation tools to passive mode to enable movement
            // In passive mode, existing annotations can be moved by their handles
            const annotationTools = [
                LengthTool.toolName, AngleTool.toolName, HeightTool.toolName, BidirectionalTool.toolName,
                CobbAngleTool.toolName, ProbeTool.toolName, ReferenceLinesTool.toolName,
                RectangleROITool.toolName, EllipticalROITool.toolName, CircleROITool.toolName, SplineROITool.toolName,
                ArrowAnnotateTool.toolName, LabelTool.toolName
            ];
            
            annotationTools.forEach(toolName => {
                if (this.successfullyAddedTools.includes(toolName)) {
                    try {
                        this.toolGroup.setToolPassive(toolName);
                    } catch (error) {
                        console.warn(`Failed to set ${toolName} to passive for annotation movement:`, error);
                    }
                }
            });
            
            console.log('Annotation movement enabled - tools set to passive mode');
            
        } catch (error) {
            console.error('Error enabling annotation movement:', error);
        }
    }
    
    public disableAnnotationMovement(): void {
        if (!this.toolGroup) {
            console.warn('Tool group not available for disabling annotation movement');
            return;
        }
        
        try {
            // Set annotation tools to enabled mode (render but no interaction)
            const annotationTools = [
                LengthTool.toolName, AngleTool.toolName, HeightTool.toolName, BidirectionalTool.toolName,
                CobbAngleTool.toolName, ProbeTool.toolName, ReferenceLinesTool.toolName,
                RectangleROITool.toolName, EllipticalROITool.toolName, CircleROITool.toolName, SplineROITool.toolName,
                ArrowAnnotateTool.toolName, LabelTool.toolName
            ];
            
            annotationTools.forEach(toolName => {
                if (this.successfullyAddedTools.includes(toolName)) {
                    try {
                        this.toolGroup.setToolEnabled(toolName);
                    } catch (error) {
                        console.warn(`Failed to set ${toolName} to enabled:`, error);
                    }
                }
            });
            
            console.log('Annotation movement disabled - tools set to enabled mode');
            
        } catch (error) {
            console.error('Error disabling annotation movement:', error);
        }
    }
    
    public clearAllAnnotations(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for clearing annotations');
            return;
        }
        
        try {
            // Check if annotations exist before clearing
            const annotations = this.safeGetAllAnnotations();
            
            if (annotations.length === 0) {
                console.log('No annotations to clear');
                return;
            }
            
            console.log(`Clearing ${annotations.length} annotations`);
            
            // Clear annotations individually to prevent data corruption
            annotations.forEach(ann => {
                if (ann && ann.annotationUID) {
                    try {
                        annotation.state.removeAnnotation(ann.annotationUID);
                    } catch (error) {
                        console.warn('Error removing individual annotation:', ann.annotationUID, error);
                    }
                }
            });
            
            // Alternative: Clear all annotations at once
            try {
                annotation.state.removeAllAnnotations();
            } catch (error) {
                console.warn('Error with removeAllAnnotations:', error);
            }
            
            // Wait before rendering to ensure all annotations are cleared
            setTimeout(() => {
                if (this.renderingEngine) {
                    try {
                        this.renderingEngine.render();
                    } catch (error) {
                        console.warn('Error rendering after clearing annotations:', error);
                    }
                }
            }, 100);
            
            console.log('All annotations cleared');
            
        } catch (error) {
            console.error('Error clearing all annotations:', error);
        }
    }
    
    public dispose(): void {
        try {
            // Clean up annotations first
            this.safeCleanupAnnotations();
            
            if (this.toolGroup) {
                ToolGroupManager.destroyToolGroup(this.toolGroupId);
                this.toolGroup = null;
            }
            
            if (this.renderingEngine && this.viewport) {
                this.renderingEngine.disableElement(this.viewportId);
                this.viewport = null;
            }
            
            // Clean up blob URLs
            this.currentImageIds.forEach(imageId => {
                if (imageId.startsWith('wadouri:blob:')) {
                    const blobUrl = imageId.replace('wadouri:', '');
                    URL.revokeObjectURL(blobUrl);
                }
            });
            
            this.currentImageIds = [];
            this.successfullyAddedTools = [];
            this.isInitialized = false;
            
            console.log('DicomViewer disposed successfully');
            
        } catch (error) {
            console.error('Error disposing DicomViewer:', error);
        }
    }
    
    private safeCleanupAnnotations(): void {
        try {
            // Get annotations for this viewport
            const viewportAnnotations = this.safeGetAnnotationsForViewport();
            
            if (viewportAnnotations.length > 0) {
                console.log(`Cleaning up ${viewportAnnotations.length} annotations for viewport`);
                
                // Remove annotations for this viewport
                viewportAnnotations.forEach(ann => {
                    if (ann && ann.annotationUID) {
                        try {
                            annotation.state.removeAnnotation(ann.annotationUID);
                        } catch (error) {
                            console.warn('Error removing annotation:', ann.annotationUID, error);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error cleaning up annotations:', error);
        }
    }
    
    public resize(): void {
        if (!this.viewport || !this.renderingEngine) {
            console.warn('Viewport or rendering engine not available for resize');
            return;
        }
        
        try {
            // Store current viewport state to preserve zoom/pan
            const currentCamera = this.viewport.getCamera();
            const currentProperties = this.viewport.getProperties();
            
            // Resize the rendering engine
            this.renderingEngine.resize(true);
            
            // For Cornerstone3D, also call the viewport's resize method if available
            if (typeof (this.viewport as any).resize === 'function') {
                (this.viewport as any).resize();
            }
            
            // Restore camera state to maintain zoom/pan/flip states
            if (currentCamera) {
                this.viewport.setCamera(currentCamera);
            }
            
            // Re-apply flip states if they were active
            if (this.flipState.horizontal || this.flipState.vertical) {
                this.applyFlipTransformations();
            }
            
            // Ensure annotations are properly scaled after resize
            this.updateAnnotationsForZoom();
            
            // Re-render to update the display
            this.renderingEngine.render();
            
            console.log('Viewport resized successfully with state preservation');
            
        } catch (error) {
            console.error('Error during viewport resize:', error);
        }
    }
    
    private initializeWindowLevelController(): void {
        if (this.viewport) {
            this.windowLevelController = new WindowLevelController(this.viewport);
            console.log('Window/Level controller initialized');
        } else {
            console.warn('Cannot initialize window/level controller: viewport not available');
        }
    }
    
    public setWindowLevel(windowWidth: number, windowCenter: number): void {
        if (this.windowLevelController) {
            this.windowLevelController.setWindowLevel(windowWidth, windowCenter);
        } else {
            console.warn('Window/Level controller not available');
        }
    }
    
    public getCurrentWindowLevel(): { windowWidth: number; windowCenter: number } | null {
        if (this.windowLevelController) {
            return this.windowLevelController.getWindowLevel();
        }
        return null;
    }
    
    public applyWindowLevelPreset(presetName: string): void {
        const preset = getPresetByName(presetName);
        if (preset && this.windowLevelController) {
            this.windowLevelController.setWindowLevel(preset.windowWidth, preset.windowCenter);
            console.log(`Applied preset '${presetName}': W=${preset.windowWidth}, L=${preset.windowCenter}`);
        } else if (!preset) {
            console.warn(`Window/Level preset '${presetName}' not found`);
        } else {
            console.warn('Window/Level controller not available');
        }
    }
    
    public resetWindowLevel(): void {
        if (this.windowLevelController) {
            this.windowLevelController.resetWindowLevel();
        } else {
            console.warn('Window/Level controller not available');
        }
    }
    
    public adjustWindowWidth(delta: number): void {
        if (this.windowLevelController) {
            this.windowLevelController.adjustWindowWidth(delta);
        } else {
            console.warn('Window/Level controller not available');
        }
    }
    
    public adjustWindowCenter(delta: number): void {
        if (this.windowLevelController) {
            this.windowLevelController.adjustWindowCenter(delta);
        } else {
            console.warn('Window/Level controller not available');
        }
    }
    
    private activateReferenceLinesToolWithConfig(): void {
        if (!this.successfullyAddedTools.includes(ReferenceLinesTool.toolName)) {
            console.warn('Reference Lines tool not available (not successfully added)');
            console.warn('⚠️ Reference Lines tool requires multiple viewports to function properly.');
            console.log('💡 To see reference lines:');
            console.log('   1. Switch to 2x2 or 1x3 layout');
            console.log('   2. Load images to all viewports');
            console.log('   3. Then activate Reference Lines tool');
            return;
        }
        
        // Check if we're in multi-viewport mode
        const isMultiViewport = this.checkIfMultiViewportMode();
        
        if (!isMultiViewport) {
            console.warn('⚠️ Reference Lines tool is designed for multi-viewport layouts (2x2, 1x3)');
            console.log('💡 Current single viewport mode - Reference Lines may not be visible');
            console.log('   Switch to multi-viewport layout to see reference lines between viewports');
        }
        
        try {
            // Configure Reference Lines tool with corrected settings
            const referenceLineConfig = {
                // Configuration for reference lines between viewports
                sourceViewportId: this.viewportId, // Current viewport as source
                targetViewportIds: [], // Will be populated in multi-viewport mode
                // Line appearance
                color: [1, 1, 0], // RGB values 0-1 (yellow)
                lineWidth: 2,
                lineDash: [4, 4], // Dashed line pattern
                // Interaction settings
                handles: {
                    display: true,
                    activeHandleRadius: 6,
                    inactiveHandleRadius: 4
                }
            };
            
            // Apply configuration
            if (this.toolGroup) {
                // For single viewport, we can try to activate but warn user
                if (isMultiViewport) {
                    // In multi-viewport mode, configure properly
                    this.configureForMultiViewport(referenceLineConfig);
                } else {
                    // In single viewport mode, set basic configuration
                    this.toolGroup.setToolConfiguration(ReferenceLinesTool.toolName, referenceLineConfig);
                }
                
                // Activate the tool
                this.toolGroup.setToolActive(ReferenceLinesTool.toolName, {
                    bindings: [
                        {
                            mouseButton: ToolEnums.MouseBindings.Primary,
                        },
                    ],
                });
                
                if (isMultiViewport) {
                    console.log('✅ Reference Lines tool activated for multi-viewport mode');
                } else {
                    console.log('⚠️ Reference Lines tool activated in single viewport mode (limited functionality)');
                    this.showReferenceLineInstructions();
                }
            }
        } catch (error) {
            console.error('❌ Error activating Reference Lines tool:', error);
            console.log('🔄 Attempting fallback activation...');
            
            // Enhanced fallback with better error handling
            try {
                this.safeActivateTool('ReferenceLines', ReferenceLinesTool.toolName, [{ mouseButton: ToolEnums.MouseBindings.Primary }]);
                console.log('✅ Reference Lines tool activated with basic configuration');
                this.showReferenceLineInstructions();
            } catch (fallbackError) {
                console.error('❌ Fallback activation also failed:', fallbackError);
                console.log('💡 Try switching to multi-viewport layout and reactivating the tool');
            }
        }
    }
    
    /**
     * Check if currently in multi-viewport mode
     */
    private checkIfMultiViewportMode(): boolean {
        // Check if there are multiple viewport elements
        const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
        return viewportElements.length > 1;
    }
    
    /**
     * Configure reference lines for multi-viewport mode
     */
    private configureForMultiViewport(config: any): void {
        try {
            // Get all available viewport IDs
            const viewportElements = document.querySelectorAll('.viewport-container[data-viewport-id]');
            const viewportIds: string[] = [];
            
            viewportElements.forEach(element => {
                const viewportId = (element as HTMLElement).dataset.viewportId;
                if (viewportId && viewportId !== this.viewportId) {
                    viewportIds.push(viewportId);
                }
            });
            
            if (viewportIds.length > 0) {
                config.targetViewportIds = viewportIds;
                console.log(`🔗 Reference lines configured for viewports: ${[this.viewportId, ...viewportIds].join(', ')}`);
            }
            
            if (this.toolGroup) {
                this.toolGroup.setToolConfiguration(ReferenceLinesTool.toolName, config);
            }
        } catch (error) {
            console.error('Error configuring multi-viewport reference lines:', error);
        }
    }
    
    /**
     * Show instructions for using reference lines
     */
    private showReferenceLineInstructions(): void {
        console.log('📋 Reference Lines Tool Instructions:');
        console.log('   • Reference lines show intersections between different image planes');
        console.log('   • Works best with multiple viewports (2x2 or 1x3 layout)');
        console.log('   • Click and drag to move reference lines');
        console.log('   • Yellow lines indicate plane intersections');
        console.log('   • Switch to multi-viewport layout for full functionality');
    }
    
    /**
     * Activate custom reference lines (crosshairs overlay)
     */
    private activateCustomReferenceLines(): void {
        try {
            const customRefLines = CustomReferenceLines.getInstance();
            
            if (customRefLines.isActiveState()) {
                // If already active, deactivate
                customRefLines.deactivate();
                console.log('✅ Custom Reference Lines deactivated');
            } else {
                // Activate with custom options
                customRefLines.activate({
                    color: '#ffff00', // Yellow color
                    lineWidth: 2,
                    dashPattern: [4, 4],
                    showCrosshairs: true,
                    showCoordinates: true
                });
                
                console.log('✅ Custom Reference Lines activated');
                console.log('📋 Instructions:');
                console.log('   • Yellow crosshairs will appear on the viewport');
                console.log('   • Move mouse to see crosshairs follow cursor');
                console.log('   • Click to set a reference point');
                console.log('   • In multi-viewport mode, reference points sync across viewports');
                console.log('   • Click Reference Lines button again to deactivate');
            }
            
        } catch (error) {
            console.error('❌ Error with Custom Reference Lines:', error);
        }
    }
    
    // Enhanced Zoom Control Methods
    public zoomIn(factor: number = 1.2): void {
        if (!this.viewport) {
            console.warn('Viewport not available for zoom in');
            return;
        }
        
        try {
            const camera = this.viewport.getCamera();
            if (!camera || !camera.parallelScale) {
                console.warn('Invalid camera state for zoom in');
                return;
            }
            
            const newParallelScale = camera.parallelScale / factor;
            
            this.viewport.setCamera({
                ...camera,
                parallelScale: newParallelScale
            });
            
            // Ensure annotations are updated with zoom
            this.updateAnnotationsForZoom();
            
            this.viewport.render();
            console.log(`Zoomed in to scale: ${newParallelScale}`);
        } catch (error) {
            console.error('Error zooming in:', error);
        }
    }
    
    public zoomOut(factor: number = 1.2): void {
        if (!this.viewport) {
            console.warn('Viewport not available for zoom out');
            return;
        }
        
        try {
            const camera = this.viewport.getCamera();
            if (!camera || !camera.parallelScale) {
                console.warn('Invalid camera state for zoom out');
                return;
            }
            
            const newParallelScale = camera.parallelScale * factor;
            
            this.viewport.setCamera({
                ...camera,
                parallelScale: newParallelScale
            });
            
            // Ensure annotations are updated with zoom
            this.updateAnnotationsForZoom();
            
            this.viewport.render();
            console.log(`Zoomed out to scale: ${newParallelScale}`);
        } catch (error) {
            console.error('Error zooming out:', error);
        }
    }
    
    public zoomReset(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for zoom reset');
            return;
        }
        
        try {
            this.viewport.resetCamera();
            
            // Ensure annotations are updated with zoom reset
            this.updateAnnotationsForZoom();
            
            this.viewport.render();
            console.log('Zoom reset to default');
        } catch (error) {
            console.error('Error resetting zoom:', error);
        }
    }
    
    public zoomFit(): void {
        if (!this.viewport) {
            console.warn('Viewport not available for zoom fit');
            return;
        }
        
        try {
            // Reset camera to fit image to viewport
            this.viewport.resetCamera();
            
            // Ensure annotations are updated with zoom fit
            this.updateAnnotationsForZoom();
            
            this.viewport.render();
            console.log('Zoom fit applied');
        } catch (error) {
            console.error('Error applying zoom fit:', error);
        }
    }
    
    public setZoomLevel(zoomLevel: number): void {
        if (!this.viewport) {
            console.warn('Viewport not available for setting zoom level');
            return;
        }
        
        if (zoomLevel <= 0) {
            console.warn('Invalid zoom level, must be greater than 0');
            return;
        }
        
        try {
            const camera = this.viewport.getCamera();
            if (!camera || !camera.parallelScale) {
                console.warn('Invalid camera state for setting zoom level');
                return;
            }
            
            // parallelScale is inversely proportional to zoom level
            const newParallelScale = camera.parallelScale / zoomLevel;
            
            this.viewport.setCamera({
                ...camera,
                parallelScale: newParallelScale
            });
            
            // Ensure annotations are updated with new zoom level
            this.updateAnnotationsForZoom();
            
            this.viewport.render();
            console.log(`Set zoom level to: ${zoomLevel}`);
        } catch (error) {
            console.error('Error setting zoom level:', error);
        }
    }
    
    public getCurrentZoomLevel(): number {
        if (!this.viewport) {
            console.warn('Viewport not available for getting zoom level');
            return 1;
        }
        
        try {
            const camera = this.viewport.getCamera();
            if (!camera || !camera.parallelScale) {
                console.warn('Invalid camera state for getting zoom level');
                return 1;
            }
            
            // Calculate zoom level based on parallelScale
            // This is a simplified calculation - you may need to adjust based on your specific requirements
            return 1 / camera.parallelScale * 100; // Normalize to a reasonable scale
        } catch (error) {
            console.error('Error getting zoom level:', error);
            return 1;
        }
    }
    
    // Orientation Controllers Initialization
    private initializeOrientationControllers(): void {
        if (!this.viewport) {
            console.warn('Cannot initialize orientation controllers without viewport');
            return;
        }
        
        try {
            // Initialize rotation controller
            this.rotationController = new RotationController(this.viewport);
            
            // Initialize flip controller
            this.flipController = new FlipController(this.viewport);
            
            console.log('Orientation controllers initialized successfully');
        } catch (error) {
            console.error('Error initializing orientation controllers:', error);
        }
    }
    
    // Enhanced Orientation Methods using new controllers
    public rotateImageByDegrees(degrees: number): number {
        if (!this.rotationController) {
            console.warn('Rotation controller not available');
            return 0;
        }
        return this.rotationController.rotateImage(degrees);
    }
    
    public setImageRotation(degrees: number): number {
        if (!this.rotationController) {
            console.warn('Rotation controller not available');
            return 0;
        }
        return this.rotationController.setRotation(degrees);
    }
    
    public getImageRotation(): number {
        if (!this.rotationController) {
            console.warn('Rotation controller not available');
            return 0;
        }
        return this.rotationController.getRotation();
    }
    
    public resetImageRotation(): void {
        if (!this.rotationController) {
            console.warn('Rotation controller not available');
            return;
        }
        this.rotationController.resetRotation();
    }
    
    public toggleHorizontalFlip(): boolean {
        if (!this.flipController) {
            console.warn('Flip controller not available');
            return false;
        }
        return this.flipController.flipImageHorizontal();
    }
    
    public toggleVerticalFlip(): boolean {
        if (!this.flipController) {
            console.warn('Flip controller not available');
            return false;
        }
        return this.flipController.flipImageVertical();
    }
    
    public setHorizontalFlipState(flipped: boolean): boolean {
        if (!this.flipController) {
            console.warn('Flip controller not available');
            return false;
        }
        return this.flipController.setHorizontalFlip(flipped);
    }
    
    public setVerticalFlipState(flipped: boolean): boolean {
        if (!this.flipController) {
            console.warn('Flip controller not available');
            return false;
        }
        return this.flipController.setVerticalFlip(flipped);
    }
    
    public getOrientationState(): { rotation: number, flipState: any } {
        const rotation = this.rotationController ? this.rotationController.getRotation() : 0;
        const flipState = this.flipController ? this.flipController.getFlipState() : { horizontal: false, vertical: false };
        return { rotation, flipState };
    }
    
    public resetImageOrientation(): void {
        if (this.rotationController) {
            this.rotationController.resetRotation();
        }
        if (this.flipController) {
            this.flipController.resetOrientation();
        }
        console.log('Image orientation reset to default');
    }
    
    // Get controller instances for external use (e.g., OrientationControls component)
    public getRotationController(): RotationController | null {
        return this.rotationController;
    }
    
    public getFlipController(): FlipController | null {
        return this.flipController;
    }

    /**
     * Update annotations to properly scale with zoom changes
     * This method ensures annotations maintain proper visual scaling when viewport is zoomed
     */
    private updateAnnotationsForZoom(): void {
        try {
            console.log('🔍 [DICOM_DEBUG] updateAnnotationsForZoom called');
            console.log('🔍 [DICOM_DEBUG] Viewport available:', !!this.viewport);
            console.log('🔍 [DICOM_DEBUG] Viewport ID:', this.viewportId);
            
            if (!this.viewport) {
                console.log('🔍 [DICOM_DEBUG] No viewport available, returning');
                return;
            }

            // Get all annotations using Cornerstone3D's annotation state
            const allAnnotations = annotation.state.getAllAnnotations();
            console.log('🔍 [DICOM_DEBUG] All annotations from state:', JSON.stringify(allAnnotations, null, 2));
            
            if (!allAnnotations || Object.keys(allAnnotations).length === 0) {
                console.log('🔍 [DICOM_DEBUG] No annotations found, returning');
                return;
            }

            // Force re-render of annotations by triggering a camera modified event
            // This ensures annotations are properly scaled with the new zoom level
            const camera = this.viewport.getCamera();
            console.log('🔍 [DICOM_DEBUG] Current camera state:', camera);
            
            if (camera) {
                // Create a camera modified event to trigger annotation scaling
                const cameraModifiedEvent = new CustomEvent('CAMERA_MODIFIED', {
                    detail: {
                        camera: camera,
                        viewport: this.viewport,
                        viewportId: this.viewportId,
                        renderingEngineId: this.renderingEngineId
                    }
                });

                console.log('🔍 [DICOM_DEBUG] Dispatching CAMERA_MODIFIED event');
                console.log('🔍 [DICOM_DEBUG] Event detail:', cameraModifiedEvent.detail);

                // Dispatch the event to ensure all annotation tools receive the update
                if (this.element) {
                    this.element.dispatchEvent(cameraModifiedEvent);
                    console.log('🔍 [DICOM_DEBUG] Event dispatched on element:', this.element.id);
                } else {
                    console.log('🔍 [DICOM_DEBUG] No element available for event dispatch');
                }
            } else {
                console.log('🔍 [DICOM_DEBUG] No camera available');
            }

            console.log('✓ Annotations updated for zoom scaling');

        } catch (error) {
            console.error('❌ Error updating annotations for zoom:', error);
            if (error instanceof Error) {
                console.error('❌ Error stack:', error.stack);
            }
        }
    }

    /**
     * Force refresh of all annotations in the current viewport
     * Useful when annotations appear to be stuck or not scaling properly
     */
    public refreshAnnotations(): void {
        try {
            if (!this.viewport) {
                console.warn('Viewport not available for annotation refresh');
                return;
            }

            // Update annotations for current zoom level
            this.updateAnnotationsForZoom();
            
            // Force a complete re-render
            if (this.renderingEngine) {
                this.renderingEngine.render();
            }

            console.log('✓ Annotations refreshed');

        } catch (error) {
            console.error('❌ Error refreshing annotations:', error);
        }
    }

    /**
     * Ensure annotations maintain proper scaling during viewport operations
     * This should be called after any operation that changes the viewport camera
     */
    public ensureAnnotationScaling(): void {
        try {
            // Small delay to ensure camera changes are applied
            setTimeout(() => {
                this.updateAnnotationsForZoom();
            }, 50);
            
        } catch (error) {
            console.error('❌ Error ensuring annotation scaling:', error);
        }
    }

    /**
     * Setup comprehensive annotation debugging to track all annotation events
     */
    private setupAnnotationDebugging(): void {
        try {
            console.log('🔍 [ANNOTATION_DEBUG] Setting up annotation debugging...');
            
            // Listen for all annotation-related events
            const annotationEvents = [
                'ANNOTATION_ADDED',
                'ANNOTATION_COMPLETED', 
                'ANNOTATION_MODIFIED',
                'ANNOTATION_REMOVED',
                'ANNOTATION_SELECTED',
                'ANNOTATION_DESELECTED',
                'ANNOTATION_RENDERED',
                'TOOL_ACTIVATED',
                'TOOL_DEACTIVATED'
            ];

            annotationEvents.forEach(eventType => {
                // Add global event listeners
                if (this.element) {
                    this.element.addEventListener(eventType, (event: any) => {
                        console.log(`🔍 [ANNOTATION_DEBUG] ${eventType} event fired:`, event.detail);
                    });
                }

                // Also listen on document for events that might bubble
                document.addEventListener(eventType, (event: any) => {
                    console.log(`🔍 [ANNOTATION_DEBUG] Global ${eventType} event:`, event.detail);
                });
            });

            // Listen for generic cornerstone events
            if (this.element) {
                this.element.addEventListener('cornerstoneToolStateChanged', (event: any) => {
                    console.log('🔍 [ANNOTATION_DEBUG] Tool state changed:', event.detail);
                });

                this.element.addEventListener('cornerstoneAnnotationAdded', (event: any) => {
                    console.log('🔍 [ANNOTATION_DEBUG] Cornerstone annotation added:', event.detail);
                });

                this.element.addEventListener('cornerstoneAnnotationModified', (event: any) => {
                    console.log('🔍 [ANNOTATION_DEBUG] Cornerstone annotation modified:', event.detail);
                });
            }

            // Check annotation state periodically
            setInterval(() => {
                try {
                    const allAnnotations = annotation.state.getAllAnnotations();
                    const annotationCount = this.countAnnotations(allAnnotations);
                    if (annotationCount > 0) {
                        console.log(`🔍 [ANNOTATION_DEBUG] Periodic check - Found ${annotationCount} annotations:`, allAnnotations);
                    }
                } catch (error) {
                    console.log('🔍 [ANNOTATION_DEBUG] Periodic check failed:', error);
                }
            }, 5000); // Check every 5 seconds

            console.log('🔍 [ANNOTATION_DEBUG] Annotation debugging setup complete');

        } catch (error) {
            console.error('❌ Error setting up annotation debugging:', error);
        }
    }

    /**
     * Helper method to count annotations in the annotation state
     */
    private countAnnotations(annotationState: any): number {
        try {
            if (!annotationState) return 0;
            
            if (Array.isArray(annotationState)) {
                return annotationState.length;
            }
            
            let count = 0;
            Object.values(annotationState).forEach((frameData: any) => {
                if (frameData && typeof frameData === 'object') {
                    Object.values(frameData).forEach((toolData: any) => {
                        if (Array.isArray(toolData)) {
                            count += toolData.length;
                        }
                    });
                }
            });
            
            return count;
        } catch (error) {
            console.error('Error counting annotations:', error);
            return 0;
        }
    }

    /**
     * Setup viewport-specific annotation event listeners
     */
    private setupViewportAnnotationListeners(): void {
        try {
            console.log('🔍 [ANNOTATION_DEBUG] Setting up viewport-specific annotation listeners...');
            
            if (!this.element) {
                console.warn('🔍 [ANNOTATION_DEBUG] No element available for event listeners');
                return;
            }

            // Clear any existing listeners first
            const existingListener = (this.element as any)._annotationListener;
            if (existingListener) {
                this.element.removeEventListener('cornerstoneToolsAnnotationAdded', existingListener);
                this.element.removeEventListener('cornerstoneToolsAnnotationModified', existingListener);
                this.element.removeEventListener('cornerstoneToolsAnnotationCompleted', existingListener);
            }

            // Create new annotation event listener
            const annotationListener = (event: any) => {
                console.log('🔍 [ANNOTATION_DEBUG] ===== VIEWPORT ANNOTATION EVENT =====');
                console.log('🔍 [ANNOTATION_DEBUG] Event type:', event.type);
                console.log('🔍 [ANNOTATION_DEBUG] Event detail:', event.detail);
                console.log('🔍 [ANNOTATION_DEBUG] Target element:', event.target?.id);
                console.log('🔍 [ANNOTATION_DEBUG] Viewport ID:', this.viewportId);
                
                // Try to get current annotation state
                try {
                    const allAnnotations = annotation.state.getAllAnnotations();
                    console.log('🔍 [ANNOTATION_DEBUG] Current annotation state after event:', allAnnotations);
                } catch (error) {
                    console.log('🔍 [ANNOTATION_DEBUG] Could not get annotation state:', error);
                }
            };

            // Store listener reference for cleanup
            (this.element as any)._annotationListener = annotationListener;

            // Add comprehensive event listeners
            const eventTypes = [
                'cornerstoneToolsAnnotationAdded',
                'cornerstoneToolsAnnotationModified', 
                'cornerstoneToolsAnnotationCompleted',
                'cornerstoneToolsAnnotationSelected',
                'cornerstoneToolsAnnotationDeselected',
                'annotationAdded',
                'annotationModified',
                'annotationCompleted',
                'annotationSelected'
            ];

            eventTypes.forEach(eventType => {
                this.element!.addEventListener(eventType, annotationListener);
                console.log(`🔍 [ANNOTATION_DEBUG] Added listener for: ${eventType}`);
            });

            console.log('🔍 [ANNOTATION_DEBUG] Viewport annotation listeners setup complete');

        } catch (error) {
            console.error('❌ Error setting up viewport annotation listeners:', error);
        }
    }
}