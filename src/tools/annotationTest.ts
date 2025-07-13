import { AnnotationManager, AnnotationData, createAnnotationManager } from './annotationManager';
import { TextAnnotationTool, TextAnnotationData, createTextAnnotationTool } from './textAnnotation';
import { ArrowAnnotationTool, ArrowAnnotationData, createArrowAnnotationTool } from './arrowAnnotation';
import { AnnotationEventHandler, createAnnotationEventHandler } from './annotationEventHandler';
import { AnnotationStyling, createAnnotationStyling } from './annotationStyling';
import { AnnotationPersistence, createAnnotationPersistence } from './annotationPersistence';
import { Types } from '@cornerstonejs/core';

export interface TestResult {
    testName: string;
    passed: boolean;
    message: string;
    duration: number;
    error?: Error;
}

export interface TestSuite {
    suiteName: string;
    results: TestResult[];
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
}

export class AnnotationTestRunner {
    private annotationManager: AnnotationManager;
    private textAnnotationTool: TextAnnotationTool;
    private arrowAnnotationTool: ArrowAnnotationTool;
    private eventHandler: AnnotationEventHandler;
    private styling: AnnotationStyling;
    private persistence: AnnotationPersistence;
    private testResults: TestSuite[] = [];

    constructor() {
        this.annotationManager = createAnnotationManager();
        this.textAnnotationTool = createTextAnnotationTool('test-tool-group');
        this.arrowAnnotationTool = createArrowAnnotationTool('test-tool-group');
        this.eventHandler = createAnnotationEventHandler(
            this.annotationManager,
            this.textAnnotationTool,
            this.arrowAnnotationTool
        );
        this.styling = createAnnotationStyling();
        this.persistence = createAnnotationPersistence();
    }

    private async runTest(testName: string, testFunction: () => Promise<void>): Promise<TestResult> {
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            
            return {
                testName,
                passed: true,
                message: 'Test passed successfully',
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            return {
                testName,
                passed: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                duration,
                error: error instanceof Error ? error : new Error('Unknown error')
            };
        }
    }

    private async runTestSuite(suiteName: string, tests: Array<{ name: string; test: () => Promise<void> }>): Promise<TestSuite> {
        const suiteStartTime = Date.now();
        const results: TestResult[] = [];

        for (const { name, test } of tests) {
            const result = await this.runTest(name, test);
            results.push(result);
        }

        const totalDuration = Date.now() - suiteStartTime;
        const passedTests = results.filter(r => r.passed).length;
        const failedTests = results.filter(r => !r.passed).length;

        const suite: TestSuite = {
            suiteName,
            results,
            totalTests: results.length,
            passedTests,
            failedTests,
            totalDuration
        };

        this.testResults.push(suite);
        return suite;
    }

    // Annotation Manager Tests
    public async testAnnotationManager(): Promise<TestSuite> {
        return await this.runTestSuite('Annotation Manager', [
            {
                name: 'Should initialize annotation manager',
                test: async () => {
                    if (!this.annotationManager.getInitializationStatus()) {
                        throw new Error('Annotation manager not initialized');
                    }
                }
            },
            {
                name: 'Should add annotation',
                test: async () => {
                    const annotation: Partial<AnnotationData> = {
                        toolName: 'TestTool',
                        text: 'Test annotation',
                        position: [100, 100],
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    };

                    const annotationId = this.annotationManager.addAnnotation(annotation);
                    if (!annotationId) {
                        throw new Error('Failed to add annotation');
                    }

                    const retrieved = this.annotationManager.getAnnotation(annotationId);
                    if (!retrieved) {
                        throw new Error('Failed to retrieve added annotation');
                    }

                    if (retrieved.text !== 'Test annotation') {
                        throw new Error('Annotation text mismatch');
                    }
                }
            },
            {
                name: 'Should update annotation',
                test: async () => {
                    const annotation: Partial<AnnotationData> = {
                        toolName: 'TestTool',
                        text: 'Original text',
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    };

                    const annotationId = this.annotationManager.addAnnotation(annotation);
                    const updated = this.annotationManager.updateAnnotation(annotationId, {
                        text: 'Updated text'
                    });

                    if (!updated) {
                        throw new Error('Failed to update annotation');
                    }

                    const retrieved = this.annotationManager.getAnnotation(annotationId);
                    if (retrieved?.text !== 'Updated text') {
                        throw new Error('Annotation update failed');
                    }
                }
            },
            {
                name: 'Should remove annotation',
                test: async () => {
                    const annotation: Partial<AnnotationData> = {
                        toolName: 'TestTool',
                        text: 'To be removed',
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    };

                    const annotationId = this.annotationManager.addAnnotation(annotation);
                    const removed = this.annotationManager.removeAnnotation(annotationId);

                    if (!removed) {
                        throw new Error('Failed to remove annotation');
                    }

                    const retrieved = this.annotationManager.getAnnotation(annotationId);
                    if (retrieved) {
                        throw new Error('Annotation still exists after removal');
                    }
                }
            },
            {
                name: 'Should filter annotations by type',
                test: async () => {
                    // Add different types of annotations
                    this.annotationManager.addAnnotation({
                        toolName: 'TextTool',
                        text: 'Text annotation',
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    });

                    this.annotationManager.addAnnotation({
                        toolName: 'ArrowTool',
                        text: 'Arrow annotation',
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    });

                    const textAnnotations = this.annotationManager.getAnnotationsByType('TextTool');
                    const arrowAnnotations = this.annotationManager.getAnnotationsByType('ArrowTool');

                    if (textAnnotations.length !== 1 || arrowAnnotations.length !== 1) {
                        throw new Error('Filter by type failed');
                    }
                }
            },
            {
                name: 'Should clear all annotations',
                test: async () => {
                    // Add some annotations
                    this.annotationManager.addAnnotation({
                        toolName: 'TestTool',
                        text: 'Test 1',
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    });

                    this.annotationManager.addAnnotation({
                        toolName: 'TestTool',
                        text: 'Test 2',
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1'
                    });

                    this.annotationManager.clearAnnotations();

                    if (this.annotationManager.getAnnotationCount() !== 0) {
                        throw new Error('Clear annotations failed');
                    }
                }
            }
        ]);
    }

    // Text Annotation Tool Tests
    public async testTextAnnotationTool(): Promise<TestSuite> {
        return await this.runTestSuite('Text Annotation Tool', [
            {
                name: 'Should initialize text annotation tool',
                test: async () => {
                    if (!this.textAnnotationTool.getInitializationStatus()) {
                        throw new Error('Text annotation tool not initialized');
                    }
                }
            },
            {
                name: 'Should add text annotation',
                test: async () => {
                    const position: Types.Point2 = [200, 200];
                    const text = 'Test text annotation';
                    
                    const annotationId = this.textAnnotationTool.addTextAnnotation(position, text);
                    if (!annotationId) {
                        throw new Error('Failed to add text annotation');
                    }

                    const annotation = this.textAnnotationTool.getAnnotation(annotationId);
                    if (!annotation) {
                        throw new Error('Failed to retrieve text annotation');
                    }

                    if (annotation.text !== text) {
                        throw new Error('Text annotation text mismatch');
                    }

                    if (annotation.position[0] !== position[0] || annotation.position[1] !== position[1]) {
                        throw new Error('Text annotation position mismatch');
                    }
                }
            },
            {
                name: 'Should update text annotation style',
                test: async () => {
                    const position: Types.Point2 = [250, 250];
                    const annotationId = this.textAnnotationTool.addTextAnnotation(position, 'Style test');
                    
                    const updated = this.textAnnotationTool.updateAnnotationStyle(annotationId, {
                        textColor: '#FF0000',
                        fontSize: 18
                    });

                    if (!updated) {
                        throw new Error('Failed to update text annotation style');
                    }

                    const annotation = this.textAnnotationTool.getAnnotation(annotationId);
                    if (annotation?.style.textColor !== '#FF0000' || annotation?.style.fontSize !== 18) {
                        throw new Error('Text annotation style update failed');
                    }
                }
            },
            {
                name: 'Should move text annotation',
                test: async () => {
                    const initialPosition: Types.Point2 = [300, 300];
                    const newPosition: Types.Point2 = [350, 350];
                    
                    const annotationId = this.textAnnotationTool.addTextAnnotation(initialPosition, 'Move test');
                    const moved = this.textAnnotationTool.moveAnnotation(annotationId, newPosition);

                    if (!moved) {
                        throw new Error('Failed to move text annotation');
                    }

                    const annotation = this.textAnnotationTool.getAnnotation(annotationId);
                    if (annotation?.position[0] !== newPosition[0] || annotation?.position[1] !== newPosition[1]) {
                        throw new Error('Text annotation move failed');
                    }
                }
            },
            {
                name: 'Should remove text annotation',
                test: async () => {
                    const position: Types.Point2 = [400, 400];
                    const annotationId = this.textAnnotationTool.addTextAnnotation(position, 'Remove test');
                    
                    const removed = this.textAnnotationTool.removeAnnotation(annotationId);
                    if (!removed) {
                        throw new Error('Failed to remove text annotation');
                    }

                    const annotation = this.textAnnotationTool.getAnnotation(annotationId);
                    if (annotation) {
                        throw new Error('Text annotation still exists after removal');
                    }
                }
            },
            {
                name: 'Should enable/disable text tool',
                test: async () => {
                    const enabled = this.textAnnotationTool.enableTextTool();
                    if (!enabled) {
                        throw new Error('Failed to enable text tool');
                    }

                    const disabled = this.textAnnotationTool.disableTextTool();
                    if (!disabled) {
                        throw new Error('Failed to disable text tool');
                    }
                }
            }
        ]);
    }

    // Arrow Annotation Tool Tests
    public async testArrowAnnotationTool(): Promise<TestSuite> {
        return await this.runTestSuite('Arrow Annotation Tool', [
            {
                name: 'Should initialize arrow annotation tool',
                test: async () => {
                    if (!this.arrowAnnotationTool.getInitializationStatus()) {
                        throw new Error('Arrow annotation tool not initialized');
                    }
                }
            },
            {
                name: 'Should add arrow annotation',
                test: async () => {
                    const startPosition: Types.Point2 = [100, 100];
                    const endPosition: Types.Point2 = [200, 200];
                    const text = 'Test arrow annotation';
                    
                    const annotationId = this.arrowAnnotationTool.addArrowAnnotation(startPosition, endPosition, text);
                    if (!annotationId) {
                        throw new Error('Failed to add arrow annotation');
                    }

                    const annotation = this.arrowAnnotationTool.getAnnotation(annotationId);
                    if (!annotation) {
                        throw new Error('Failed to retrieve arrow annotation');
                    }

                    if (annotation.text !== text) {
                        throw new Error('Arrow annotation text mismatch');
                    }

                    if (!annotation.handles.start || !annotation.handles.end) {
                        throw new Error('Arrow annotation handles missing');
                    }
                }
            },
            {
                name: 'Should update arrow annotation',
                test: async () => {
                    const startPosition: Types.Point2 = [150, 150];
                    const endPosition: Types.Point2 = [250, 250];
                    
                    const annotationId = this.arrowAnnotationTool.addArrowAnnotation(startPosition, endPosition);
                    
                    const updated = this.arrowAnnotationTool.updateArrowAnnotation(annotationId, {
                        text: 'Updated arrow text'
                    });

                    if (!updated) {
                        throw new Error('Failed to update arrow annotation');
                    }

                    const annotation = this.arrowAnnotationTool.getAnnotation(annotationId);
                    if (annotation?.text !== 'Updated arrow text') {
                        throw new Error('Arrow annotation update failed');
                    }
                }
            },
            {
                name: 'Should remove arrow annotation',
                test: async () => {
                    const startPosition: Types.Point2 = [300, 300];
                    const endPosition: Types.Point2 = [400, 400];
                    
                    const annotationId = this.arrowAnnotationTool.addArrowAnnotation(startPosition, endPosition);
                    const removed = this.arrowAnnotationTool.removeAnnotation(annotationId);

                    if (!removed) {
                        throw new Error('Failed to remove arrow annotation');
                    }

                    const annotation = this.arrowAnnotationTool.getAnnotation(annotationId);
                    if (annotation) {
                        throw new Error('Arrow annotation still exists after removal');
                    }
                }
            },
            {
                name: 'Should enable/disable arrow tool',
                test: async () => {
                    const enabled = this.arrowAnnotationTool.enableArrowTool();
                    if (!enabled) {
                        throw new Error('Failed to enable arrow tool');
                    }

                    const disabled = this.arrowAnnotationTool.disableArrowTool();
                    if (!disabled) {
                        throw new Error('Failed to disable arrow tool');
                    }
                }
            },
            {
                name: 'Should export/import arrow annotations',
                test: async () => {
                    // Clear existing annotations
                    this.arrowAnnotationTool.clearAnnotations();

                    // Add test annotations
                    this.arrowAnnotationTool.addArrowAnnotation([100, 100], [200, 200], 'Arrow 1');
                    this.arrowAnnotationTool.addArrowAnnotation([150, 150], [250, 250], 'Arrow 2');

                    // Export annotations
                    const exportedData = this.arrowAnnotationTool.exportAnnotations();
                    if (!exportedData) {
                        throw new Error('Failed to export arrow annotations');
                    }

                    // Clear and import
                    this.arrowAnnotationTool.clearAnnotations();
                    const imported = this.arrowAnnotationTool.importAnnotations(exportedData);

                    if (!imported) {
                        throw new Error('Failed to import arrow annotations');
                    }

                    if (this.arrowAnnotationTool.getAnnotationCount() !== 2) {
                        throw new Error('Import/export count mismatch');
                    }
                }
            }
        ]);
    }

    // Annotation Styling Tests
    public async testAnnotationStyling(): Promise<TestSuite> {
        return await this.runTestSuite('Annotation Styling', [
            {
                name: 'Should initialize annotation styling',
                test: async () => {
                    if (!this.styling.getInitializationStatus()) {
                        throw new Error('Annotation styling not initialized');
                    }
                }
            },
            {
                name: 'Should apply style to annotation',
                test: async () => {
                    const annotation: AnnotationData = {
                        annotationUID: 'test-annotation-1',
                        toolName: 'TextAnnotation',
                        text: 'Test text',
                        position: [100, 100],
                        imageId: 'test-image-1',
                        viewportId: 'test-viewport-1',
                        timestamp: new Date().toISOString(),
                        style: {
                            color: '#FFFFFF',
                            lineWidth: 1
                        }
                    };

                    const styledAnnotation = this.styling.applyStyleToAnnotation(annotation);
                    if (!styledAnnotation.style) {
                        throw new Error('Style not applied to annotation');
                    }

                    if (styledAnnotation.style.color === '#FFFFFF') {
                        throw new Error('Default style not applied');
                    }
                }
            },
            {
                name: 'Should switch themes',
                test: async () => {
                    const themes = this.styling.getThemes();
                    if (themes.length === 0) {
                        throw new Error('No themes available');
                    }

                    const darkTheme = themes.find(theme => theme.name === 'Dark');
                    if (!darkTheme) {
                        throw new Error('Dark theme not found');
                    }

                    const switched = this.styling.setTheme('dark');
                    if (!switched) {
                        throw new Error('Failed to switch to dark theme');
                    }

                    const currentTheme = this.styling.getCurrentTheme();
                    if (currentTheme?.name !== 'Dark') {
                        throw new Error('Theme switch failed');
                    }
                }
            },
            {
                name: 'Should set custom style',
                test: async () => {
                    const annotationId = 'test-custom-style';
                    const customStyle = {
                        textAnnotation: {
                            color: '#FF0000',
                            fontSize: 20
                        }
                    };

                    this.styling.setCustomStyle(annotationId, customStyle);
                    const retrievedStyle = this.styling.getCustomStyle(annotationId);

                    if (!retrievedStyle || !retrievedStyle.textAnnotation) {
                        throw new Error('Custom style not set');
                    }

                    if (retrievedStyle.textAnnotation.color !== '#FF0000') {
                        throw new Error('Custom style color mismatch');
                    }
                }
            },
            {
                name: 'Should export/import theme',
                test: async () => {
                    const exportedTheme = this.styling.exportTheme();
                    if (!exportedTheme) {
                        throw new Error('Failed to export theme');
                    }

                    const imported = this.styling.importTheme(exportedTheme);
                    if (!imported) {
                        throw new Error('Failed to import theme');
                    }
                }
            }
        ]);
    }

    // Annotation Persistence Tests
    public async testAnnotationPersistence(): Promise<TestSuite> {
        return await this.runTestSuite('Annotation Persistence', [
            {
                name: 'Should initialize annotation persistence',
                test: async () => {
                    if (!this.persistence.getInitializationStatus()) {
                        throw new Error('Annotation persistence not initialized');
                    }
                }
            },
            {
                name: 'Should create session',
                test: async () => {
                    const sessionId = await this.persistence.createSession({
                        viewportId: 'test-viewport-1',
                        imageId: 'test-image-1'
                    });

                    if (!sessionId) {
                        throw new Error('Failed to create session');
                    }

                    const session = await this.persistence.loadSession(sessionId);
                    if (!session) {
                        throw new Error('Failed to load created session');
                    }
                }
            },
            {
                name: 'Should save and load annotations',
                test: async () => {
                    const sessionId = await this.persistence.createSession({
                        viewportId: 'test-viewport-2',
                        imageId: 'test-image-2'
                    });

                    const testAnnotation: AnnotationData = {
                        annotationUID: 'persist-test-1',
                        toolName: 'TextAnnotation',
                        text: 'Persistence test',
                        position: [100, 100],
                        imageId: 'test-image-2',
                        viewportId: 'test-viewport-2',
                        timestamp: new Date().toISOString()
                    };

                    const saved = await this.persistence.saveAnnotation(testAnnotation);
                    if (!saved) {
                        throw new Error('Failed to save annotation');
                    }

                    // Force save to ensure it's written
                    await this.persistence.forceSave();

                    const loadedAnnotations = await this.persistence.loadAnnotations(sessionId);
                    if (loadedAnnotations.length === 0) {
                        throw new Error('Failed to load annotations');
                    }

                    const foundAnnotation = loadedAnnotations.find(a => a.annotationUID === 'persist-test-1');
                    if (!foundAnnotation) {
                        throw new Error('Saved annotation not found in loaded annotations');
                    }
                }
            },
            {
                name: 'Should create and restore backup',
                test: async () => {
                    const sessionId = await this.persistence.createSession({
                        viewportId: 'test-viewport-3',
                        imageId: 'test-image-3'
                    });

                    const testAnnotation: AnnotationData = {
                        annotationUID: 'backup-test-1',
                        toolName: 'ArrowAnnotation',
                        text: 'Backup test',
                        handles: {
                            start: [100, 100],
                            end: [200, 200]
                        },
                        imageId: 'test-image-3',
                        viewportId: 'test-viewport-3',
                        timestamp: new Date().toISOString()
                    };

                    await this.persistence.saveAnnotation(testAnnotation);
                    await this.persistence.forceSave();

                    const backupId = await this.persistence.createBackup();
                    if (!backupId) {
                        throw new Error('Failed to create backup');
                    }

                    // Clear current session
                    await this.persistence.deleteSession(sessionId);

                    // Restore from backup
                    const restored = await this.persistence.restoreBackup(backupId);
                    if (!restored) {
                        throw new Error('Failed to restore backup');
                    }

                    const sessions = this.persistence.getSessions();
                    if (sessions.length === 0) {
                        throw new Error('No sessions restored from backup');
                    }
                }
            },
            {
                name: 'Should export/import session',
                test: async () => {
                    const sessionId = await this.persistence.createSession({
                        viewportId: 'test-viewport-4',
                        imageId: 'test-image-4'
                    });

                    const testAnnotation: AnnotationData = {
                        annotationUID: 'export-test-1',
                        toolName: 'TextAnnotation',
                        text: 'Export test',
                        position: [150, 150],
                        imageId: 'test-image-4',
                        viewportId: 'test-viewport-4',
                        timestamp: new Date().toISOString()
                    };

                    await this.persistence.saveAnnotation(testAnnotation);
                    await this.persistence.forceSave();

                    const exportedData = await this.persistence.exportSession(sessionId);
                    if (!exportedData) {
                        throw new Error('Failed to export session');
                    }

                    const importedSessionId = await this.persistence.importSession(exportedData);
                    if (!importedSessionId) {
                        throw new Error('Failed to import session');
                    }

                    const importedSession = await this.persistence.loadSession(importedSessionId);
                    if (!importedSession || importedSession.annotations.length === 0) {
                        throw new Error('Imported session has no annotations');
                    }
                }
            }
        ]);
    }

    // Integration Tests
    public async testIntegration(): Promise<TestSuite> {
        return await this.runTestSuite('Integration Tests', [
            {
                name: 'Should integrate all components',
                test: async () => {
                    // Create a session
                    const sessionId = await this.persistence.createSession({
                        viewportId: 'integration-test',
                        imageId: 'integration-image'
                    });

                    // Add text annotation
                    const textAnnotationId = this.textAnnotationTool.addTextAnnotation([100, 100], 'Integration test text');
                    const textAnnotation = this.textAnnotationTool.getAnnotation(textAnnotationId);
                    
                    if (!textAnnotation) {
                        throw new Error('Text annotation not created');
                    }

                    // Add arrow annotation
                    const arrowAnnotationId = this.arrowAnnotationTool.addArrowAnnotation([150, 150], [250, 250], 'Integration test arrow');
                    const arrowAnnotation = this.arrowAnnotationTool.getAnnotation(arrowAnnotationId);
                    
                    if (!arrowAnnotation) {
                        throw new Error('Arrow annotation not created');
                    }

                    // Style the annotations
                    const styledTextAnnotation = this.styling.applyStyleToAnnotation(textAnnotation);
                    const styledArrowAnnotation = this.styling.applyStyleToAnnotation(arrowAnnotation);

                    if (!styledTextAnnotation.style || !styledArrowAnnotation.style) {
                        throw new Error('Styling not applied');
                    }

                    // Persist the annotations
                    await this.persistence.saveAnnotations([styledTextAnnotation, styledArrowAnnotation]);
                    await this.persistence.forceSave();

                    // Verify persistence
                    const loadedAnnotations = await this.persistence.loadAnnotations(sessionId);
                    if (loadedAnnotations.length !== 2) {
                        throw new Error('Integration persistence failed');
                    }

                    // Add to annotation manager
                    this.annotationManager.addAnnotation(styledTextAnnotation);
                    this.annotationManager.addAnnotation(styledArrowAnnotation);

                    if (this.annotationManager.getAnnotationCount() < 2) {
                        throw new Error('Integration annotation manager failed');
                    }
                }
            },
            {
                name: 'Should handle complete workflow',
                test: async () => {
                    // Clear all existing data
                    this.annotationManager.clearAnnotations();
                    this.textAnnotationTool.clearAnnotations();
                    this.arrowAnnotationTool.clearAnnotations();

                    // Create new session
                    const sessionId = await this.persistence.createSession({
                        viewportId: 'workflow-test',
                        imageId: 'workflow-image',
                        studyId: 'workflow-study',
                        seriesId: 'workflow-series'
                    });

                    // Set medical theme
                    this.styling.setTheme('medical');

                    // Create multiple annotations
                    const annotations: AnnotationData[] = [];

                    // Text annotations
                    for (let i = 0; i < 3; i++) {
                        const textId = this.textAnnotationTool.addTextAnnotation([100 + i * 50, 100], `Text ${i + 1}`);
                        const textAnnotation = this.textAnnotationTool.getAnnotation(textId);
                        if (textAnnotation) {
                            const styled = this.styling.applyStyleToAnnotation(textAnnotation);
                            annotations.push(styled);
                        }
                    }

                    // Arrow annotations
                    for (let i = 0; i < 2; i++) {
                        const arrowId = this.arrowAnnotationTool.addArrowAnnotation(
                            [200 + i * 50, 200],
                            [300 + i * 50, 300],
                            `Arrow ${i + 1}`
                        );
                        const arrowAnnotation = this.arrowAnnotationTool.getAnnotation(arrowId);
                        if (arrowAnnotation) {
                            const styled = this.styling.applyStyleToAnnotation(arrowAnnotation);
                            annotations.push(styled);
                        }
                    }

                    // Save all annotations
                    await this.persistence.saveAnnotations(annotations);
                    await this.persistence.forceSave();

                    // Create backup
                    const backupId = await this.persistence.createBackup();
                    if (!backupId) {
                        throw new Error('Backup creation failed');
                    }

                    // Export session
                    const exportedData = await this.persistence.exportSession(sessionId);
                    if (!exportedData) {
                        throw new Error('Session export failed');
                    }

                    // Verify all annotations are present
                    const loadedAnnotations = await this.persistence.loadAnnotations(sessionId);
                    if (loadedAnnotations.length !== 5) {
                        throw new Error(`Expected 5 annotations, got ${loadedAnnotations.length}`);
                    }

                    // Verify annotation types
                    const textCount = loadedAnnotations.filter(a => a.toolName === 'TextAnnotation').length;
                    const arrowCount = loadedAnnotations.filter(a => a.toolName === 'ArrowAnnotation').length;

                    if (textCount !== 3 || arrowCount !== 2) {
                        throw new Error('Annotation type counts mismatch');
                    }

                    // Get stats
                    const stats = await this.persistence.getStats();
                    if (stats.totalAnnotations !== 5) {
                        throw new Error('Stats mismatch');
                    }
                }
            }
        ]);
    }

    // Run all tests
    public async runAllTests(): Promise<TestSuite[]> {
        console.log('🧪 Starting annotation system tests...');
        
        const suites = [
            await this.testAnnotationManager(),
            await this.testTextAnnotationTool(),
            await this.testArrowAnnotationTool(),
            await this.testAnnotationStyling(),
            await this.testAnnotationPersistence(),
            await this.testIntegration()
        ];

        this.printResults(suites);
        return suites;
    }

    private printResults(suites: TestSuite[]): void {
        console.log('\n📊 Test Results Summary:');
        console.log('=' .repeat(60));

        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;

        suites.forEach(suite => {
            totalTests += suite.totalTests;
            totalPassed += suite.passedTests;
            totalFailed += suite.failedTests;
            totalDuration += suite.totalDuration;

            const status = suite.failedTests === 0 ? '✅' : '❌';
            console.log(`${status} ${suite.suiteName}: ${suite.passedTests}/${suite.totalTests} passed (${suite.totalDuration}ms)`);

            if (suite.failedTests > 0) {
                suite.results.forEach(result => {
                    if (!result.passed) {
                        console.log(`  ❌ ${result.testName}: ${result.message}`);
                    }
                });
            }
        });

        console.log('=' .repeat(60));
        console.log(`📈 Overall: ${totalPassed}/${totalTests} tests passed (${totalDuration}ms)`);
        console.log(`✅ Passed: ${totalPassed}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`⏱️  Duration: ${totalDuration}ms`);

        if (totalFailed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log(`⚠️  ${totalFailed} tests failed`);
        }
    }

    public getTestResults(): TestSuite[] {
        return this.testResults;
    }

    public dispose(): void {
        this.annotationManager.dispose();
        this.textAnnotationTool.dispose();
        this.arrowAnnotationTool.dispose();
        this.eventHandler.dispose();
        this.styling.dispose();
        this.persistence.dispose();
    }
}

// Convenience function
export function createAnnotationTestRunner(): AnnotationTestRunner {
    return new AnnotationTestRunner();
}

// Export test runner for external use
export default AnnotationTestRunner;