import { 
    RenderingEngine, 
    Enums,
    Types
} from '@cornerstonejs/core';

export interface ViewportOptions {
    viewportId?: string;
    type?: Enums.ViewportType;
    orientation?: Enums.OrientationAxis;
    background?: Types.Point3;
    displayArea?: {
        imageArea?: [number, number];
        imageCanvasPoint?: {
            imagePoint?: [number, number];
            canvasPoint?: [number, number];
        };
    };
}

export function initializeViewport(
    renderingEngine: RenderingEngine,
    element: HTMLElement, 
    options: ViewportOptions = {}
): Types.IViewport {
    const defaultOptions: ViewportOptions = {
        viewportId: options.viewportId || `viewport-${Date.now()}`,
        type: options.type || Enums.ViewportType.STACK,
        orientation: options.orientation || Enums.OrientationAxis.AXIAL,
        background: options.background || [0, 0, 0],
        ...options
    };

    try {
        // Ensure the element has proper dimensions
        if (!element.style.width || element.style.width === '0px') {
            element.style.width = '100%';
        }
        if (!element.style.height || element.style.height === '0px') {
            element.style.height = '100%';
        }

        // Ensure the element is positioned properly
        if (!element.style.position || element.style.position === 'static') {
            element.style.position = 'relative';
        }

        // Enable the element as a viewport
        const viewport = renderingEngine.enableElement({
            viewportId: defaultOptions.viewportId!,
            element: element as HTMLDivElement,
            type: defaultOptions.type!,
            defaultOptions: {
                background: defaultOptions.background,
                orientation: defaultOptions.orientation,
                displayArea: defaultOptions.displayArea as any
            }
        });

        console.log(`Viewport initialized: ${defaultOptions.viewportId}`);
        return viewport as any;

    } catch (error) {
        console.error('Error initializing viewport:', error);
        throw new Error(`Failed to initialize viewport: ${error}`);
    }
}

export function createStackViewport(
    renderingEngine: RenderingEngine,
    element: HTMLElement,
    viewportId: string = `stack-viewport-${Date.now()}`
): Types.IStackViewport {
    const viewport = initializeViewport(renderingEngine, element, {
        viewportId,
        type: Enums.ViewportType.STACK
    }) as Types.IStackViewport;

    return viewport;
}

export function createOrthographicViewport(
    renderingEngine: RenderingEngine,
    element: HTMLElement,
    viewportId: string = `ortho-viewport-${Date.now()}`,
    orientation: Enums.OrientationAxis = Enums.OrientationAxis.AXIAL
): Types.IVolumeViewport {
    const viewport = initializeViewport(renderingEngine, element, {
        viewportId,
        type: Enums.ViewportType.ORTHOGRAPHIC,
        orientation
    }) as Types.IVolumeViewport;

    return viewport;
}

export function create3DViewport(
    renderingEngine: RenderingEngine,
    element: HTMLElement,
    viewportId: string = `volume-3d-viewport-${Date.now()}`
): Types.IVolumeViewport {
    const viewport = initializeViewport(renderingEngine, element, {
        viewportId,
        type: Enums.ViewportType.VOLUME_3D
    }) as Types.IVolumeViewport;

    return viewport;
}

export function resizeViewport(viewport: Types.IViewport): void {
    try {
        // Trigger a resize to ensure the viewport adapts to container changes
        viewport.element.dispatchEvent(new Event('resize'));
        viewport.render();
    } catch (error) {
        console.error('Error resizing viewport:', error);
    }
}

export function resetViewport(viewport: Types.IViewport): void {
    try {
        // Reset the camera to default position
        viewport.resetCamera();
        viewport.render();
        console.log('Viewport reset successfully');
    } catch (error) {
        console.error('Error resetting viewport:', error);
    }
}

export function setViewportBackground(
    viewport: Types.IViewport, 
    color: Types.Point3
): void {
    try {
        (viewport as any).setProperties({ background: color });
        viewport.render();
    } catch (error) {
        console.error('Error setting viewport background:', error);
    }
}