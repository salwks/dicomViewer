// Cornerstone3D Annotation System
// Complete annotation system with text, arrow, styling, persistence, and event handling

// Re-export everything from individual modules
export * from './annotationManager';
export * from './textAnnotation';
export * from './arrowAnnotation';
export * from './annotationEventHandler';
export * from './annotationStyling';
export * from './annotationPersistence';
export * from './annotationTest';
export * from './runTests';

// Import types and classes for the main class
import { 
    AnnotationManager, 
    AnnotationManagerConfig, 
    createAnnotationManager 
} from './annotationManager';
import { 
    TextAnnotationTool, 
    TextAnnotationConfig, 
    createTextAnnotationTool 
} from './textAnnotation';
import { 
    ArrowAnnotationTool, 
    ArrowAnnotationConfig, 
    createArrowAnnotationTool 
} from './arrowAnnotation';
import { 
    AnnotationEventHandler, 
    AnnotationEventHandlerConfig, 
    createAnnotationEventHandler 
} from './annotationEventHandler';
import { 
    AnnotationStyling, 
    AnnotationStyleConfig, 
    createAnnotationStyling 
} from './annotationStyling';
import { 
    AnnotationPersistence, 
    PersistenceConfig, 
    createAnnotationPersistence 
} from './annotationPersistence';
import { 
    createAnnotationTestRunner 
} from './annotationTest';

// Complete Annotation System Class
export class CornerStone3DAnnotationSystem {
    private annotationManager: AnnotationManager;
    private textAnnotationTool: TextAnnotationTool;
    private arrowAnnotationTool: ArrowAnnotationTool;
    private eventHandler: AnnotationEventHandler;
    private styling: AnnotationStyling;
    private persistence: AnnotationPersistence;
    private isInitialized: boolean = false;

    constructor(
        toolGroupId: string = 'cornerstone3d-annotations',
        config: {
            manager?: AnnotationManagerConfig;
            textTool?: TextAnnotationConfig;
            arrowTool?: ArrowAnnotationConfig;
            eventHandler?: AnnotationEventHandlerConfig;
            styling?: AnnotationStyleConfig;
            persistence?: PersistenceConfig;
        } = {}
    ) {
        // Initialize core components
        this.annotationManager = createAnnotationManager(toolGroupId, config.manager);
        this.textAnnotationTool = createTextAnnotationTool(toolGroupId, config.textTool);
        this.arrowAnnotationTool = createArrowAnnotationTool(toolGroupId, config.arrowTool);
        this.eventHandler = createAnnotationEventHandler(
            this.annotationManager,
            this.textAnnotationTool,
            this.arrowAnnotationTool,
            config.eventHandler
        );
        this.styling = createAnnotationStyling(config.styling);
        this.persistence = createAnnotationPersistence(config.persistence);

        this.initialize();
    }

    private initialize(): void {
        try {
            // Verify all components are initialized
            if (!this.annotationManager.getInitializationStatus()) {
                throw new Error('Annotation Manager failed to initialize');
            }
            if (!this.textAnnotationTool.getInitializationStatus()) {
                throw new Error('Text Annotation Tool failed to initialize');
            }
            if (!this.arrowAnnotationTool.getInitializationStatus()) {
                throw new Error('Arrow Annotation Tool failed to initialize');
            }
            if (!this.eventHandler.getInitializationStatus()) {
                throw new Error('Event Handler failed to initialize');
            }
            if (!this.styling.getInitializationStatus()) {
                throw new Error('Styling failed to initialize');
            }
            if (!this.persistence.getInitializationStatus()) {
                throw new Error('Persistence failed to initialize');
            }

            this.isInitialized = true;
            console.log('✅ CornerStone3D Annotation System initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize CornerStone3D Annotation System:', error);
            throw error;
        }
    }

    // Public API methods
    public getAnnotationManager(): AnnotationManager {
        return this.annotationManager;
    }

    public getTextAnnotationTool(): TextAnnotationTool {
        return this.textAnnotationTool;
    }

    public getArrowAnnotationTool(): ArrowAnnotationTool {
        return this.arrowAnnotationTool;
    }

    public getEventHandler(): AnnotationEventHandler {
        return this.eventHandler;
    }

    public getStyling(): AnnotationStyling {
        return this.styling;
    }

    public getPersistence(): AnnotationPersistence {
        return this.persistence;
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public async runTests(): Promise<void> {
        const testRunner = createAnnotationTestRunner();
        try {
            await testRunner.runAllTests();
        } finally {
            testRunner.dispose();
        }
    }

    public dispose(): void {
        try {
            this.annotationManager.dispose();
            this.textAnnotationTool.dispose();
            this.arrowAnnotationTool.dispose();
            this.eventHandler.dispose();
            this.styling.dispose();
            this.persistence.dispose();
            this.isInitialized = false;

            console.log('✅ CornerStone3D Annotation System disposed');

        } catch (error) {
            console.error('❌ Error disposing CornerStone3D Annotation System:', error);
        }
    }
}

// Convenience function to create the complete annotation system
export function createCornerStone3DAnnotationSystem(
    toolGroupId?: string,
    config?: {
        manager?: AnnotationManagerConfig;
        textTool?: TextAnnotationConfig;
        arrowTool?: ArrowAnnotationConfig;
        eventHandler?: AnnotationEventHandlerConfig;
        styling?: AnnotationStyleConfig;
        persistence?: PersistenceConfig;
    }
): CornerStone3DAnnotationSystem {
    return new CornerStone3DAnnotationSystem(toolGroupId, config);
}

// Default export
export default CornerStone3DAnnotationSystem;