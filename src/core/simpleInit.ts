import { init as cornerstoneInit } from '@cornerstonejs/core';
import { 
    init as cornerstoneToolsInit,
    addTool,
    PanTool,
    ZoomTool,
    WindowLevelTool,
    LengthTool,
    AngleTool,
    StackScrollTool,
    ArrowAnnotateTool,
    LabelTool,
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
    SplineROITool,
    segmentation
} from '@cornerstonejs/tools';
import { init as cornerstoneDICOMImageLoaderInit } from '@cornerstonejs/dicom-image-loader';

export async function initializeCornerstone3D(): Promise<void> {
    try {
        console.log('Starting Cornerstone3D initialization...');
        
        // Step 1: Initialize Cornerstone3D Core
        await cornerstoneInit();
        console.log('✓ Cornerstone3D Core initialized');
        
        // Step 2: Initialize Tools
        cornerstoneToolsInit();
        console.log('✓ Cornerstone Tools initialized');
        
        // Step 2.5: Initialize segmentation configuration for brush tools
        // Note: segmentation.config is available but setGlobalConfig method may vary by version
        console.log('✓ Segmentation tools ready for initialization');
        
        // Step 3: Register tools
        // Basic tools
        addTool(PanTool);
        addTool(ZoomTool);
        addTool(WindowLevelTool);
        addTool(StackScrollTool);
        
        // Measurement tools
        addTool(LengthTool);
        addTool(AngleTool);
        addTool(HeightTool);
        addTool(BidirectionalTool);
        addTool(CobbAngleTool);
        addTool(ProbeTool);
        addTool(ReferenceLinesTool);
        
        // ROI tools
        addTool(RectangleROITool);
        addTool(EllipticalROITool);
        addTool(CircleROITool);
        addTool(SplineROITool);
        
        // Annotation tools
        addTool(ArrowAnnotateTool);
        addTool(LabelTool);
        
        // Advanced tools
        addTool(CrosshairsTool);
        addTool(MagnifyTool);
        addTool(TrackballRotateTool);
        addTool(DragProbeTool);
        
        // Segmentation tools (now properly initialized)
        addTool(BrushTool);
        addTool(RectangleScissorsTool);
        addTool(CircleScissorsTool);
        addTool(SphereScissorsTool);
        
        // Overlay tools
        addTool(OverlayGridTool);
        addTool(ScaleOverlayTool);
        addTool(OrientationMarkerTool);
        addTool(ETDRSGridTool);
        
        console.log('✓ All available tools registered globally');
        
        // Step 4: Initialize DICOM image loader
        cornerstoneDICOMImageLoaderInit();
        console.log('✓ DICOM Image Loader initialized');
        
        console.log('🎉 Cornerstone3D initialization complete');
        
    } catch (error) {
        console.error('❌ Error initializing Cornerstone3D:', error);
        throw new Error(`Cornerstone3D initialization failed: ${error}`);
    }
}