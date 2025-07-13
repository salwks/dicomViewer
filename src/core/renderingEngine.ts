import { 
    RenderingEngine, 
    getRenderingEngine,
    getRenderingEngines,
    Types
} from '@cornerstonejs/core';

export interface RenderingEngineOptions {
    useSharedArrayBuffer?: boolean;
    strictZSpacingForVolumeViewport?: boolean;
    preferSizeOverAccuracy?: boolean;
    suppressErrors?: boolean;
}

export function setupRenderingEngine(
    id: string = 'default-rendering-engine',
    options: RenderingEngineOptions = {}
): RenderingEngine {
    try {
        // Check if rendering engine with this ID already exists
        let renderingEngine = getRenderingEngine(id);
        
        if (renderingEngine) {
            console.log(`Rendering engine '${id}' already exists, returning existing instance`);
            return renderingEngine;
        }

        // Create new rendering engine
        renderingEngine = new RenderingEngine(id);
        
        console.log(`Rendering engine '${id}' created successfully`);
        return renderingEngine;

    } catch (error) {
        console.error('Error setting up rendering engine:', error);
        throw new Error(`Failed to setup rendering engine: ${error}`);
    }
}

export function destroyRenderingEngine(id: string): boolean {
    try {
        const renderingEngine = getRenderingEngine(id);
        
        if (!renderingEngine) {
            console.warn(`Rendering engine '${id}' not found`);
            return false;
        }

        renderingEngine.destroy();
        console.log(`Rendering engine '${id}' destroyed successfully`);
        return true;

    } catch (error) {
        console.error('Error destroying rendering engine:', error);
        return false;
    }
}

export function getRenderingEngineById(id: string): RenderingEngine | undefined {
    try {
        return getRenderingEngine(id);
    } catch (error) {
        console.error('Error getting rendering engine:', error);
        return undefined;
    }
}

export function getAllRenderingEngines(): RenderingEngine[] {
    try {
        return getRenderingEngines() || [];
    } catch (error) {
        console.error('Error getting all rendering engines:', error);
        return [];
    }
}

export function renderViewport(
    renderingEngine: RenderingEngine, 
    viewportId?: string
): void {
    try {
        if (viewportId) {
            // Render specific viewport
            renderingEngine.renderViewport(viewportId);
        } else {
            // Render all viewports
            renderingEngine.render();
        }
    } catch (error) {
        console.error('Error rendering viewport(s):', error);
    }
}

export function enableViewportElement(
    renderingEngine: RenderingEngine,
    viewportId: string,
    element: HTMLDivElement,
    type: any,
    options: any = {}
): Types.IViewport {
    try {
        const viewport = renderingEngine.enableElement({
            viewportId,
            element,
            type,
            defaultOptions: options
        });

        console.log(`Viewport '${viewportId}' enabled successfully`);
        return viewport as any;

    } catch (error) {
        console.error('Error enabling viewport element:', error);
        throw new Error(`Failed to enable viewport element: ${error}`);
    }
}

export function disableViewportElement(
    renderingEngine: RenderingEngine,
    viewportId: string
): boolean {
    try {
        renderingEngine.disableElement(viewportId);
        console.log(`Viewport '${viewportId}' disabled successfully`);
        return true;

    } catch (error) {
        console.error('Error disabling viewport element:', error);
        return false;
    }
}

export function getViewportFromEngine(
    renderingEngine: RenderingEngine,
    viewportId: string
): Types.IViewport | undefined {
    try {
        return renderingEngine.getViewport(viewportId);
    } catch (error) {
        console.error('Error getting viewport from engine:', error);
        return undefined;
    }
}

export function getViewportsFromEngine(
    renderingEngine: RenderingEngine
): Types.IViewport[] {
    try {
        return renderingEngine.getViewports();
    } catch (error) {
        console.error('Error getting viewports from engine:', error);
        return [];
    }
}

export function resizeRenderingEngine(renderingEngine: RenderingEngine): void {
    try {
        renderingEngine.resize();
        console.log('Rendering engine resized successfully');
    } catch (error) {
        console.error('Error resizing rendering engine:', error);
    }
}

export function setViewportsForRendering(
    renderingEngine: RenderingEngine,
    viewportInputs: Array<{
        viewportId: string;
        element: HTMLDivElement;
        type: any;
        defaultOptions?: any;
    }>
): Types.IViewport[] {
    try {
        const viewports: Types.IViewport[] = [];

        for (const input of viewportInputs) {
            const viewport = renderingEngine.enableElement({
                viewportId: input.viewportId,
                element: input.element,
                type: input.type,
                defaultOptions: input.defaultOptions || {}
            });
            viewports.push(viewport as any);
        }

        console.log(`${viewports.length} viewports configured for rendering`);
        return viewports;

    } catch (error) {
        console.error('Error setting viewports for rendering:', error);
        return [];
    }
}

export interface EngineStats {
    id: string;
    viewportCount: number;
    viewportIds: string[];
    isDestroyed: boolean;
}

export function getRenderingEngineStats(renderingEngine: RenderingEngine): EngineStats {
    try {
        const viewports = renderingEngine.getViewports();
        return {
            id: renderingEngine.id,
            viewportCount: viewports.length,
            viewportIds: viewports.map(vp => vp.id),
            isDestroyed: false // This would need to be tracked externally
        };
    } catch (error) {
        console.error('Error getting rendering engine stats:', error);
        return {
            id: renderingEngine.id,
            viewportCount: 0,
            viewportIds: [],
            isDestroyed: true
        };
    }
}