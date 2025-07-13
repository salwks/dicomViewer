import { ViewportManager } from '../core/viewportManager';
import { LayoutManager } from '../components/LayoutManager';
import { SynchronizationManager, SyncType } from '../core/synchronizationManager';
import { ViewportCleanupManager } from '../utils/viewportCleanup';
import { RenderingEngine, Enums } from '@cornerstonejs/core';

export interface TestResult {
    testName: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
}

export interface TestSuite {
    suiteName: string;
    results: TestResult[];
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
}

export class MultiViewportTestRunner {
    private renderingEngine: RenderingEngine;
    private viewportManager: ViewportManager;
    private syncManager: SynchronizationManager;
    private layoutManager: LayoutManager;
    private cleanupManager: ViewportCleanupManager;
    private testContainer: HTMLElement;
    
    constructor() {
        // Create test container
        this.testContainer = document.createElement('div');
        this.testContainer.id = 'test-viewport-container';
        this.testContainer.style.width = '800px';
        this.testContainer.style.height = '600px';
        this.testContainer.style.position = 'absolute';
        this.testContainer.style.top = '-9999px'; // Hide from view
        document.body.appendChild(this.testContainer);
        
        // Initialize components
        this.renderingEngine = new RenderingEngine('test-rendering-engine');
        this.viewportManager = new ViewportManager(this.renderingEngine);
        this.syncManager = new SynchronizationManager(this.viewportManager);
        this.layoutManager = new LayoutManager(this.testContainer, this.viewportManager);
        this.cleanupManager = new ViewportCleanupManager(
            this.viewportManager,
            this.layoutManager,
            this.syncManager
        );
    }
    
    /**
     * Run all test suites
     * @returns Array of test suite results
     */
    public async runAllTests(): Promise<TestSuite[]> {
        console.log('🧪 Starting Multi-Viewport Test Suite');
        
        const suites: TestSuite[] = [];
        
        try {
            // Test suites
            suites.push(await this.runViewportManagerTests());
            suites.push(await this.runLayoutManagerTests());
            suites.push(await this.runSynchronizationTests());
            suites.push(await this.runDynamicViewportTests());
            suites.push(await this.runLayoutSwitchingTests());
            suites.push(await this.runCleanupTests());
            suites.push(await this.runStressTests());
            
        } catch (error) {
            console.error('Error running test suites:', error);
        } finally {
            // Cleanup
            await this.cleanup();
        }
        
        // Print summary
        this.printTestSummary(suites);
        
        return suites;
    }
    
    /**
     * Test ViewportManager functionality
     */
    private async runViewportManagerTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'ViewportManager Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Test 1: Create viewport
        suite.results.push(await this.runTest('Create viewport', async () => {
            const element = document.createElement('div');
            this.testContainer.appendChild(element);
            
            const viewport = this.viewportManager.createViewport(
                'test-viewport-1',
                element,
                Enums.ViewportType.STACK
            );
            
            if (!viewport) throw new Error('Viewport creation failed');
            if (!this.viewportManager.hasViewport('test-viewport-1')) {
                throw new Error('Viewport not registered');
            }
            
            return { viewportId: 'test-viewport-1', created: true };
        }));
        
        // Test 2: Get viewport
        suite.results.push(await this.runTest('Get viewport', async () => {
            const viewport = this.viewportManager.getViewport('test-viewport-1');
            if (!viewport) throw new Error('Failed to retrieve viewport');
            
            const viewportInfo = this.viewportManager.getViewportInfo('test-viewport-1');
            if (!viewportInfo) throw new Error('Failed to retrieve viewport info');
            
            return { retrieved: true, hasInfo: true };
        }));
        
        // Test 3: Set active viewport
        suite.results.push(await this.runTest('Set active viewport', async () => {
            const success = this.viewportManager.setActiveViewport('test-viewport-1');
            if (!success) throw new Error('Failed to set active viewport');
            
            const activeId = this.viewportManager.getActiveViewportId();
            if (activeId !== 'test-viewport-1') {
                throw new Error('Active viewport ID mismatch');
            }
            
            return { activeId };
        }));
        
        // Test 4: Remove viewport
        suite.results.push(await this.runTest('Remove viewport', async () => {
            const success = this.viewportManager.removeViewport('test-viewport-1');
            if (!success) throw new Error('Failed to remove viewport');
            
            if (this.viewportManager.hasViewport('test-viewport-1')) {
                throw new Error('Viewport still exists after removal');
            }
            
            return { removed: true };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Test LayoutManager functionality
     */
    private async runLayoutManagerTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'LayoutManager Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Test 1: Set 1x1 layout
        suite.results.push(await this.runTest('Set 1x1 layout', async () => {
            const elements = this.layoutManager.setLayout('1x1');
            if (elements.length !== 1) {
                throw new Error(`Expected 1 viewport, got ${elements.length}`);
            }
            return { elements: elements.length, layout: '1x1' };
        }));
        
        // Test 2: Set 2x2 layout
        suite.results.push(await this.runTest('Set 2x2 layout', async () => {
            const elements = this.layoutManager.setLayout('2x2');
            if (elements.length !== 4) {
                throw new Error(`Expected 4 viewports, got ${elements.length}`);
            }
            return { elements: elements.length, layout: '2x2' };
        }));
        
        // Test 3: Set 1x3 layout
        suite.results.push(await this.runTest('Set 1x3 layout', async () => {
            const elements = this.layoutManager.setLayout('1x3');
            if (elements.length !== 3) {
                throw new Error(`Expected 3 viewports, got ${elements.length}`);
            }
            return { elements: elements.length, layout: '1x3' };
        }));
        
        // Test 4: Initialize Cornerstone3D viewports
        suite.results.push(await this.runTest('Initialize Cornerstone3D viewports', async () => {
            this.layoutManager.initializeCornerstone3DViewports();
            
            const viewportCount = this.viewportManager.getViewportCount();
            if (viewportCount !== 3) {
                throw new Error(`Expected 3 Cornerstone viewports, got ${viewportCount}`);
            }
            
            return { cornerstoneViewports: viewportCount };
        }));
        
        // Test 5: Activate viewport
        suite.results.push(await this.runTest('Activate viewport', async () => {
            const success = this.layoutManager.activateViewport(1);
            if (!success) throw new Error('Failed to activate viewport');
            
            const viewportInfos = this.layoutManager.getViewportInfo();
            const activeViewport = viewportInfos.find(info => info.active);
            if (!activeViewport || activeViewport.index !== 1) {
                throw new Error('Viewport activation failed');
            }
            
            return { activeIndex: activeViewport.index };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Test Synchronization functionality
     */
    private async runSynchronizationTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'Synchronization Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Test 1: Create sync group
        suite.results.push(await this.runTest('Create sync group', async () => {
            const group = this.syncManager.createSyncGroup('test-sync', [SyncType.PAN, SyncType.ZOOM]);
            if (!group) throw new Error('Failed to create sync group');
            
            return { groupId: group.id, syncTypes: group.syncTypes };
        }));
        
        // Test 2: Add viewports to sync group
        suite.results.push(await this.runTest('Add viewports to sync group', async () => {
            const viewportIds = this.viewportManager.getViewportIds();
            let addedCount = 0;
            
            for (const viewportId of viewportIds) {
                const success = this.syncManager.addViewportToSyncGroup('test-sync', viewportId);
                if (success) addedCount++;
            }
            
            if (addedCount === 0) throw new Error('No viewports added to sync group');
            
            return { addedViewports: addedCount, totalViewports: viewportIds.length };
        }));
        
        // Test 3: Enable/disable sync group
        suite.results.push(await this.runTest('Enable/disable sync group', async () => {
            let success = this.syncManager.disableSyncGroup('test-sync');
            if (!success) throw new Error('Failed to disable sync group');
            
            success = this.syncManager.enableSyncGroup('test-sync');
            if (!success) throw new Error('Failed to enable sync group');
            
            const group = this.syncManager.getSyncGroup('test-sync');
            if (!group || !group.active) throw new Error('Sync group not active after enable');
            
            return { enabled: group.active };
        }));
        
        // Test 4: Remove sync group
        suite.results.push(await this.runTest('Remove sync group', async () => {
            const success = this.syncManager.removeSyncGroup('test-sync');
            if (!success) throw new Error('Failed to remove sync group');
            
            const group = this.syncManager.getSyncGroup('test-sync');
            if (group) throw new Error('Sync group still exists after removal');
            
            return { removed: true };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Test dynamic viewport operations
     */
    private async runDynamicViewportTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'Dynamic Viewport Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Set up 2x2 layout for testing
        this.layoutManager.setLayout('2x2');
        this.layoutManager.initializeCornerstone3DViewports();
        
        // Test 1: Add viewport
        suite.results.push(await this.runTest('Add viewport dynamically', async () => {
            const initialCount = this.layoutManager.getViewportCount();
            const canAdd = this.layoutManager.canAddMoreViewports();
            
            if (!canAdd) throw new Error('Layout at capacity');
            
            const newElement = this.layoutManager.addViewport();
            if (!newElement) throw new Error('Failed to add viewport');
            
            const newCount = this.layoutManager.getViewportCount();
            if (newCount !== initialCount + 1) {
                throw new Error('Viewport count mismatch after addition');
            }
            
            return { initialCount, newCount, added: true };
        }));
        
        // Test 2: Remove viewport
        suite.results.push(await this.runTest('Remove viewport dynamically', async () => {
            const initialCount = this.layoutManager.getViewportCount();
            const success = this.layoutManager.removeViewport(0);
            
            if (!success) throw new Error('Failed to remove viewport');
            
            const newCount = this.layoutManager.getViewportCount();
            if (newCount !== initialCount - 1) {
                throw new Error('Viewport count mismatch after removal');
            }
            
            return { initialCount, newCount, removed: true };
        }));
        
        // Test 3: Clone viewport
        suite.results.push(await this.runTest('Clone viewport', async () => {
            const initialCount = this.layoutManager.getViewportCount();
            const canAdd = this.layoutManager.canAddMoreViewports();
            
            if (!canAdd) throw new Error('Layout at capacity for cloning');
            
            const clonedElement = this.layoutManager.cloneViewport(0);
            if (!clonedElement) throw new Error('Failed to clone viewport');
            
            const newCount = this.layoutManager.getViewportCount();
            if (newCount !== initialCount + 1) {
                throw new Error('Viewport count mismatch after cloning');
            }
            
            return { initialCount, newCount, cloned: true };
        }));
        
        // Test 4: Swap viewports
        suite.results.push(await this.runTest('Swap viewports', async () => {
            const viewportCount = this.layoutManager.getViewportCount();
            if (viewportCount < 2) throw new Error('Need at least 2 viewports to swap');
            
            const success = this.layoutManager.swapViewports(0, 1);
            if (!success) throw new Error('Failed to swap viewports');
            
            return { swapped: true, viewportCount };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Test layout switching with state preservation
     */
    private async runLayoutSwitchingTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'Layout Switching Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Test 1: Layout switching preserves state
        suite.results.push(await this.runTest('Layout switching with state preservation', async () => {
            // Start with 1x1
            this.layoutManager.setLayout('1x1', false);
            this.layoutManager.initializeCornerstone3DViewports();
            
            // Switch to 2x2 with state preservation
            const elements = this.layoutManager.setLayout('2x2', true);
            if (elements.length !== 4) {
                throw new Error('Layout switch failed');
            }
            
            // Switch back to 1x1 with state preservation
            const elements2 = this.layoutManager.setLayout('1x1', true);
            if (elements2.length !== 1) {
                throw new Error('Layout switch back failed');
            }
            
            return { preservedState: true, finalLayout: '1x1' };
        }));
        
        // Test 2: Animated layout switching
        suite.results.push(await this.runTest('Animated layout switching', async () => {
            const startTime = Date.now();
            await this.layoutManager.switchLayoutAnimated('2x2', true);
            const duration = Date.now() - startTime;
            
            if (duration < 100) {
                throw new Error('Animation too fast, may not have animated');
            }
            
            return { animated: true, duration };
        }));
        
        // Test 3: Layout history
        suite.results.push(await this.runTest('Layout history tracking', async () => {
            this.layoutManager.switchLayoutWithHistory('1x3');
            this.layoutManager.switchLayoutWithHistory('2x2');
            
            const history = this.layoutManager.getLayoutHistory();
            if (history.length === 0) {
                throw new Error('No layout history recorded');
            }
            
            const undoSuccess = this.layoutManager.undoLayoutChange();
            if (!undoSuccess) throw new Error('Undo failed');
            
            const redoSuccess = this.layoutManager.redoLayoutChange();
            if (!redoSuccess) throw new Error('Redo failed');
            
            return { historyLength: history.length, undoRedo: true };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Test cleanup functionality
     */
    private async runCleanupTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'Cleanup Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Set up test environment
        this.layoutManager.setLayout('2x2');
        this.layoutManager.initializeCornerstone3DViewports();
        this.syncManager.createDefaultSyncGroup([SyncType.PAN, SyncType.ZOOM]);
        
        // Test 1: Light cleanup
        suite.results.push(await this.runTest('Light cleanup', async () => {
            const stats = await this.cleanupManager.performLightCleanup();
            
            return { 
                syncGroupsRemoved: stats.syncGroupsRemoved,
                eventListenersRemoved: stats.eventListenersRemoved,
                errors: stats.errors.length
            };
        }));
        
        // Test 2: Specific viewport cleanup
        suite.results.push(await this.runTest('Specific viewport cleanup', async () => {
            const viewportIds = this.viewportManager.getViewportIds();
            if (viewportIds.length === 0) {
                throw new Error('No viewports to clean up');
            }
            
            const targetIds = viewportIds.slice(0, 2);
            const stats = await this.cleanupManager.cleanupSpecificViewports(targetIds);
            
            if (stats.viewportsRemoved === 0) {
                throw new Error('No viewports were cleaned up');
            }
            
            return {
                viewportsRemoved: stats.viewportsRemoved,
                targetCount: targetIds.length
            };
        }));
        
        // Test 3: Memory usage tracking
        suite.results.push(await this.runTest('Memory usage tracking', async () => {
            const usage = this.cleanupManager.getMemoryUsage();
            
            if (usage.estimatedMemoryMB < 0) {
                throw new Error('Invalid memory usage calculation');
            }
            
            return {
                viewportCount: usage.viewportCount,
                syncGroupCount: usage.syncGroupCount,
                memoryMB: usage.estimatedMemoryMB
            };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Run stress tests with rapid operations
     */
    private async runStressTests(): Promise<TestSuite> {
        const suite: TestSuite = {
            suiteName: 'Stress Tests',
            results: [],
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            totalDuration: 0
        };
        
        // Test 1: Rapid layout switching
        suite.results.push(await this.runTest('Rapid layout switching', async () => {
            const layouts = ['1x1', '2x2', '1x3', '2x2', '1x1'];
            const startTime = Date.now();
            
            for (const layout of layouts) {
                this.layoutManager.setLayout(layout);
                this.layoutManager.initializeCornerstone3DViewports();
                
                // Small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            const duration = Date.now() - startTime;
            return { layoutSwitches: layouts.length, duration };
        }));
        
        // Test 2: Rapid viewport creation/removal
        suite.results.push(await this.runTest('Rapid viewport operations', async () => {
            this.layoutManager.setLayout('2x2');
            this.layoutManager.initializeCornerstone3DViewports();
            
            let operationCount = 0;
            const startTime = Date.now();
            
            // Add and remove viewports rapidly
            for (let i = 0; i < 10; i++) {
                if (this.layoutManager.canAddMoreViewports()) {
                    this.layoutManager.addViewport();
                    operationCount++;
                }
                
                if (this.layoutManager.getViewportCount() > 1) {
                    this.layoutManager.removeViewport(0);
                    operationCount++;
                }
                
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            const duration = Date.now() - startTime;
            return { operations: operationCount, duration };
        }));
        
        // Test 3: Sync group stress test
        suite.results.push(await this.runTest('Sync group stress test', async () => {
            const groupCount = 5;
            const startTime = Date.now();
            
            // Create multiple sync groups
            for (let i = 0; i < groupCount; i++) {
                const groupId = `stress-test-${i}`;
                this.syncManager.createSyncGroup(groupId, [SyncType.PAN, SyncType.ZOOM]);
                
                // Add viewports to each group
                const viewportIds = this.viewportManager.getViewportIds();
                viewportIds.forEach(viewportId => {
                    this.syncManager.addViewportToSyncGroup(groupId, viewportId);
                });
            }
            
            // Remove all groups
            for (let i = 0; i < groupCount; i++) {
                this.syncManager.removeSyncGroup(`stress-test-${i}`);
            }
            
            const duration = Date.now() - startTime;
            return { syncGroups: groupCount, duration };
        }));
        
        this.calculateSuiteStats(suite);
        return suite;
    }
    
    /**
     * Run a single test with timing and error handling
     */
    private async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
        const startTime = Date.now();
        
        try {
            const details = await testFn();
            const duration = Date.now() - startTime;
            
            console.log(`✅ ${testName} - ${duration}ms`);
            
            return {
                testName,
                passed: true,
                duration,
                details
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ ${testName} - ${duration}ms - ${error}`);
            
            return {
                testName,
                passed: false,
                duration,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    /**
     * Calculate suite statistics
     */
    private calculateSuiteStats(suite: TestSuite): void {
        suite.totalTests = suite.results.length;
        suite.passedTests = suite.results.filter(r => r.passed).length;
        suite.failedTests = suite.totalTests - suite.passedTests;
        suite.totalDuration = suite.results.reduce((sum, r) => sum + r.duration, 0);
    }
    
    /**
     * Print test summary
     */
    private printTestSummary(suites: TestSuite[]): void {
        console.log('\n🧪 Multi-Viewport Test Summary');
        console.log('='.repeat(50));
        
        let totalTests = 0;
        let totalPassed = 0;
        let totalDuration = 0;
        
        suites.forEach(suite => {
            const passRate = ((suite.passedTests / suite.totalTests) * 100).toFixed(1);
            console.log(`${suite.suiteName}: ${suite.passedTests}/${suite.totalTests} (${passRate}%) - ${suite.totalDuration}ms`);
            
            totalTests += suite.totalTests;
            totalPassed += suite.passedTests;
            totalDuration += suite.totalDuration;
        });
        
        console.log('='.repeat(50));
        const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(1);
        console.log(`Overall: ${totalPassed}/${totalTests} (${overallPassRate}%) - ${totalDuration}ms`);
        
        if (totalPassed === totalTests) {
            console.log('🎉 All tests passed!');
        } else {
            console.log(`⚠️  ${totalTests - totalPassed} tests failed`);
        }
    }
    
    /**
     * Clean up test environment
     */
    private async cleanup(): Promise<void> {
        try {
            await this.cleanupManager.performFullCleanup();
            
            if (this.testContainer.parentNode) {
                this.testContainer.parentNode.removeChild(this.testContainer);
            }
            
            console.log('Test environment cleaned up');
            
        } catch (error) {
            console.error('Error cleaning up test environment:', error);
        }
    }
}

// Global function to run tests
export async function runMultiViewportTests(): Promise<TestSuite[]> {
    const testRunner = new MultiViewportTestRunner();
    return await testRunner.runAllTests();
}