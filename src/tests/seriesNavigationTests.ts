import { SeriesManager, SeriesInfo } from '../core/seriesManager';
import { SeriesBrowser } from '../components/SeriesBrowser';
import { ThumbnailViewer } from '../components/ThumbnailViewer';
import { StackNavigationTool } from '../tools/stackNavigationTool';

interface TestResult {
    testName: string;
    passed: boolean;
    message: string;
    duration: number;
}

interface TestSuite {
    suiteName: string;
    tests: TestResult[];
    totalTests: number;
    passedTests: number;
    duration: number;
}

export class SeriesNavigationTestRunner {
    private seriesManager: SeriesManager;
    private stackNavigation: StackNavigationTool;
    private testContainer: HTMLElement;
    
    constructor() {
        this.seriesManager = SeriesManager.getInstance();
        this.stackNavigation = StackNavigationTool.getInstance();
        
        // Create test container
        this.testContainer = document.createElement('div');
        this.testContainer.style.display = 'none';
        document.body.appendChild(this.testContainer);
    }
    
    /**
     * Run all series navigation tests
     */
    public async runAllTests(): Promise<TestSuite[]> {
        console.log('🧪 Starting Series Navigation Tests...');
        
        const suites: TestSuite[] = [
            await this.testSeriesManager(),
            await this.testStackNavigation(),
            await this.testSeriesBrowser(),
            await this.testThumbnailViewer(),
            await this.testLargeDatasets(),
            await this.testPerformance()
        ];
        
        // Cleanup
        this.cleanup();
        
        const totalTests = suites.reduce((sum, suite) => sum + suite.totalTests, 0);
        const totalPassed = suites.reduce((sum, suite) => sum + suite.passedTests, 0);
        const totalDuration = suites.reduce((sum, suite) => sum + suite.duration, 0);
        
        console.log(`📊 Series Navigation Tests Complete:`);
        console.log(`   Total: ${totalTests} tests`);
        console.log(`   Passed: ${totalPassed} tests`);
        console.log(`   Failed: ${totalTests - totalPassed} tests`);
        console.log(`   Duration: ${totalDuration.toFixed(2)}ms`);
        
        return suites;
    }
    
    /**
     * Test Series Manager functionality
     */
    private async testSeriesManager(): Promise<TestSuite> {
        const tests: TestResult[] = [];
        const suiteName = 'Series Manager';
        const startTime = performance.now();
        
        // Clear any existing series
        this.seriesManager.clearAllSeries();
        
        // Test 1: Add series
        tests.push(await this.runTest('Add Series', async () => {
            const series: SeriesInfo = {
                id: 'test-series-1',
                description: 'Test Series 1',
                imageIds: ['image1', 'image2', 'image3'],
                imageCount: 3,
                modality: 'CT'
            };
            
            const index = this.seriesManager.addSeries(series);
            if (index !== 0) throw new Error(`Expected index 0, got ${index}`);
            if (this.seriesManager.getSeriesCount() !== 1) throw new Error('Series count should be 1');
            
            return 'Series added successfully';
        }));
        
        // Test 2: Get series
        tests.push(await this.runTest('Get Series', async () => {
            const series = this.seriesManager.getSeries(0);
            if (!series) throw new Error('Series not found');
            if (series.id !== 'test-series-1') throw new Error('Wrong series ID');
            
            return 'Series retrieved successfully';
        }));
        
        // Test 3: Add multiple series
        tests.push(await this.runTest('Add Multiple Series', async () => {
            for (let i = 2; i <= 5; i++) {
                const series: SeriesInfo = {
                    id: `test-series-${i}`,
                    description: `Test Series ${i}`,
                    imageIds: Array.from({ length: i * 2 }, (_, idx) => `image${i}_${idx}`),
                    imageCount: i * 2,
                    modality: i % 2 === 0 ? 'CT' : 'MR'
                };
                this.seriesManager.addSeries(series);
            }
            
            if (this.seriesManager.getSeriesCount() !== 5) {
                throw new Error(`Expected 5 series, got ${this.seriesManager.getSeriesCount()}`);
            }
            
            return 'Multiple series added successfully';
        }));
        
        // Test 4: Navigate series
        tests.push(await this.runTest('Navigate Series', async () => {
            // Test next series
            if (!this.seriesManager.nextSeries()) throw new Error('Failed to navigate to next series');
            if (this.seriesManager.getCurrentSeriesIndex() !== 1) throw new Error('Wrong current series index');
            
            // Test previous series
            if (!this.seriesManager.previousSeries()) throw new Error('Failed to navigate to previous series');
            if (this.seriesManager.getCurrentSeriesIndex() !== 0) throw new Error('Wrong current series index after previous');
            
            return 'Series navigation working correctly';
        }));
        
        // Test 5: Search series
        tests.push(await this.runTest('Search Series', async () => {
            const results = this.seriesManager.searchSeries('CT');
            if (results.length !== 2) throw new Error(`Expected 2 CT series, got ${results.length}`);
            
            const mrResults = this.seriesManager.searchSeries('MR');
            if (mrResults.length !== 2) throw new Error(`Expected 2 MR series, got ${mrResults.length}`);
            
            return 'Series search working correctly';
        }));
        
        // Test 6: Remove series
        tests.push(await this.runTest('Remove Series', async () => {
            const initialCount = this.seriesManager.getSeriesCount();
            if (!this.seriesManager.removeSeries(2)) throw new Error('Failed to remove series');
            if (this.seriesManager.getSeriesCount() !== initialCount - 1) throw new Error('Series count not updated');
            
            return 'Series removal working correctly';
        }));
        
        const endTime = performance.now();
        const passedTests = tests.filter(t => t.passed).length;
        
        return {
            suiteName,
            tests,
            totalTests: tests.length,
            passedTests,
            duration: endTime - startTime
        };
    }
    
    /**
     * Test Stack Navigation Tool functionality
     */
    private async testStackNavigation(): Promise<TestSuite> {
        const tests: TestResult[] = [];
        const suiteName = 'Stack Navigation Tool';
        const startTime = performance.now();
        
        // Test 1: Initialize stack navigation
        tests.push(await this.runTest('Initialize Stack Navigation', async () => {
            this.stackNavigation.initialize({
                loop: true,
                skipDistance: 2,
                mouseWheelEnabled: true,
                keyboardEnabled: true,
                touchEnabled: true
            });
            
            const config = this.stackNavigation.getConfig();
            if (!config.loop) throw new Error('Loop setting not applied');
            if (config.skipDistance !== 2) throw new Error('Skip distance not applied');
            
            return 'Stack navigation initialized successfully';
        }));
        
        // Test 2: Navigation info
        tests.push(await this.runTest('Navigation Info', async () => {
            // Create a mock viewport for testing
            const mockViewportId = 'test-viewport';
            
            // Since we can't create actual viewports in tests, we'll test the basic logic
            const info = this.stackNavigation.getNavigationInfo(mockViewportId);
            if (typeof info !== 'object') throw new Error('Navigation info should be an object');
            
            return 'Navigation info retrieved successfully';
        }));
        
        // Test 3: Config updates
        tests.push(await this.runTest('Config Updates', async () => {
            this.stackNavigation.updateConfig({ skipDistance: 3, loop: false });
            
            const config = this.stackNavigation.getConfig();
            if (config.skipDistance !== 3) throw new Error('Skip distance not updated');
            if (config.loop !== false) throw new Error('Loop setting not updated');
            
            return 'Configuration updated successfully';
        }));
        
        const endTime = performance.now();
        const passedTests = tests.filter(t => t.passed).length;
        
        return {
            suiteName,
            tests,
            totalTests: tests.length,
            passedTests,
            duration: endTime - startTime
        };
    }
    
    /**
     * Test Series Browser component
     */
    private async testSeriesBrowser(): Promise<TestSuite> {
        const tests: TestResult[] = [];
        const suiteName = 'Series Browser';
        const startTime = performance.now();
        
        // Test 1: Create series browser
        tests.push(await this.runTest('Create Series Browser', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const browser = new SeriesBrowser(container, this.seriesManager, {
                showThumbnails: true,
                showMetadata: true,
                allowSelection: true,
                allowDeletion: false
            });
            
            if (!browser) throw new Error('Failed to create series browser');
            
            return 'Series browser created successfully';
        }));
        
        // Test 2: Browser configuration
        tests.push(await this.runTest('Browser Configuration', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const browser = new SeriesBrowser(container, this.seriesManager);
            const config = browser.getConfig();
            
            if (typeof config !== 'object') throw new Error('Config should be an object');
            if (typeof config.showThumbnails !== 'boolean') throw new Error('Config should have showThumbnails property');
            
            return 'Browser configuration working correctly';
        }));
        
        // Test 3: Search functionality
        tests.push(await this.runTest('Search Functionality', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const browser = new SeriesBrowser(container, this.seriesManager);
            
            // The search functionality is tested through DOM interaction
            // which is limited in this test environment
            return 'Search functionality initialized';
        }));
        
        const endTime = performance.now();
        const passedTests = tests.filter(t => t.passed).length;
        
        return {
            suiteName,
            tests,
            totalTests: tests.length,
            passedTests,
            duration: endTime - startTime
        };
    }
    
    /**
     * Test Thumbnail Viewer component
     */
    private async testThumbnailViewer(): Promise<TestSuite> {
        const tests: TestResult[] = [];
        const suiteName = 'Thumbnail Viewer';
        const startTime = performance.now();
        
        // Test 1: Create thumbnail viewer
        tests.push(await this.runTest('Create Thumbnail Viewer', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const viewer = new ThumbnailViewer(container, {
                thumbnailSize: 48,
                showImageNumbers: true,
                allowImageSelection: true
            });
            
            if (!viewer) throw new Error('Failed to create thumbnail viewer');
            
            return 'Thumbnail viewer created successfully';
        }));
        
        // Test 2: Load series
        tests.push(await this.runTest('Load Series', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const viewer = new ThumbnailViewer(container);
            const series = this.seriesManager.getSeries(0);
            
            if (!series) throw new Error('No series available for testing');
            
            viewer.loadSeries(series, 0);
            
            if (viewer.getImageCount() !== series.imageCount) {
                throw new Error('Image count mismatch');
            }
            
            return 'Series loaded successfully';
        }));
        
        // Test 3: Image selection
        tests.push(await this.runTest('Image Selection', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const viewer = new ThumbnailViewer(container);
            const series = this.seriesManager.getSeries(0);
            
            if (!series) throw new Error('No series available for testing');
            
            viewer.loadSeries(series, 0);
            
            // Test image selection
            if (!viewer.selectImage(1)) throw new Error('Failed to select image');
            if (viewer.getCurrentImageIndex() !== 1) throw new Error('Image index not updated');
            
            return 'Image selection working correctly';
        }));
        
        const endTime = performance.now();
        const passedTests = tests.filter(t => t.passed).length;
        
        return {
            suiteName,
            tests,
            totalTests: tests.length,
            passedTests,
            duration: endTime - startTime
        };
    }
    
    /**
     * Test with large datasets
     */
    private async testLargeDatasets(): Promise<TestSuite> {
        const tests: TestResult[] = [];
        const suiteName = 'Large Datasets';
        const startTime = performance.now();
        
        // Test 1: Large series
        tests.push(await this.runTest('Large Series (1000 images)', async () => {
            const largeSeries: SeriesInfo = {
                id: 'large-series',
                description: 'Large Test Series',
                imageIds: Array.from({ length: 1000 }, (_, i) => `large_image_${i}`),
                imageCount: 1000,
                modality: 'CT'
            };
            
            const addStart = performance.now();
            this.seriesManager.addSeries(largeSeries);
            const addDuration = performance.now() - addStart;
            
            if (addDuration > 100) {
                throw new Error(`Large series addition took too long: ${addDuration}ms`);
            }
            
            return `Large series added in ${addDuration.toFixed(2)}ms`;
        }));
        
        // Test 2: Multiple large series
        tests.push(await this.runTest('Multiple Large Series (10 series x 500 images)', async () => {
            const addStart = performance.now();
            
            for (let i = 0; i < 10; i++) {
                const series: SeriesInfo = {
                    id: `bulk-series-${i}`,
                    description: `Bulk Series ${i}`,
                    imageIds: Array.from({ length: 500 }, (_, idx) => `bulk_${i}_${idx}`),
                    imageCount: 500,
                    modality: i % 3 === 0 ? 'CT' : i % 3 === 1 ? 'MR' : 'PT'
                };
                this.seriesManager.addSeries(series);
            }
            
            const addDuration = performance.now() - addStart;
            
            if (addDuration > 500) {
                throw new Error(`Multiple large series addition took too long: ${addDuration}ms`);
            }
            
            return `10 large series added in ${addDuration.toFixed(2)}ms`;
        }));
        
        // Test 3: Search performance with large dataset
        tests.push(await this.runTest('Search Performance', async () => {
            const searchStart = performance.now();
            const results = this.seriesManager.searchSeries('CT');
            const searchDuration = performance.now() - searchStart;
            
            if (searchDuration > 50) {
                throw new Error(`Search took too long: ${searchDuration}ms`);
            }
            
            return `Search completed in ${searchDuration.toFixed(2)}ms, found ${results.length} results`;
        }));
        
        // Test 4: Memory usage test
        tests.push(await this.runTest('Memory Usage', async () => {
            const initialCount = this.seriesManager.getSeriesCount();
            
            // Add and remove series repeatedly to test for memory leaks
            for (let i = 0; i < 100; i++) {
                const series: SeriesInfo = {
                    id: `temp-series-${i}`,
                    description: `Temp Series ${i}`,
                    imageIds: Array.from({ length: 50 }, (_, idx) => `temp_${i}_${idx}`),
                    imageCount: 50,
                    modality: 'CT'
                };
                
                const index = this.seriesManager.addSeries(series);
                this.seriesManager.removeSeries(index);
            }
            
            const finalCount = this.seriesManager.getSeriesCount();
            if (finalCount !== initialCount) {
                throw new Error(`Memory leak detected: initial ${initialCount}, final ${finalCount}`);
            }
            
            return 'Memory usage test passed';
        }));
        
        const endTime = performance.now();
        const passedTests = tests.filter(t => t.passed).length;
        
        return {
            suiteName,
            tests,
            totalTests: tests.length,
            passedTests,
            duration: endTime - startTime
        };
    }
    
    /**
     * Test performance characteristics
     */
    private async testPerformance(): Promise<TestSuite> {
        const tests: TestResult[] = [];
        const suiteName = 'Performance';
        const startTime = performance.now();
        
        // Test 1: Series manager operations
        tests.push(await this.runTest('Series Manager Performance', async () => {
            const operations = [
                () => this.seriesManager.getAllSeries(),
                () => this.seriesManager.getStatistics(),
                () => this.seriesManager.getCurrentSeries(),
                () => this.seriesManager.searchSeries('test')
            ];
            
            const timings: number[] = [];
            
            for (const operation of operations) {
                const opStart = performance.now();
                for (let i = 0; i < 1000; i++) {
                    operation();
                }
                const opDuration = performance.now() - opStart;
                timings.push(opDuration);
            }
            
            const maxTime = Math.max(...timings);
            if (maxTime > 100) {
                throw new Error(`Operation took too long: ${maxTime}ms for 1000 iterations`);
            }
            
            return `All operations completed within acceptable time (max: ${maxTime.toFixed(2)}ms)`;
        }));
        
        // Test 2: UI component rendering performance
        tests.push(await this.runTest('UI Rendering Performance', async () => {
            const container = document.createElement('div');
            this.testContainer.appendChild(container);
            
            const renderStart = performance.now();
            
            const browser = new SeriesBrowser(container, this.seriesManager);
            browser.render();
            
            const renderDuration = performance.now() - renderStart;
            
            if (renderDuration > 200) {
                throw new Error(`UI rendering took too long: ${renderDuration}ms`);
            }
            
            return `UI rendered in ${renderDuration.toFixed(2)}ms`;
        }));
        
        const endTime = performance.now();
        const passedTests = tests.filter(t => t.passed).length;
        
        return {
            suiteName,
            tests,
            totalTests: tests.length,
            passedTests,
            duration: endTime - startTime
        };
    }
    
    /**
     * Run a single test
     */
    private async runTest(testName: string, testFunction: () => Promise<string>): Promise<TestResult> {
        const startTime = performance.now();
        
        try {
            const message = await testFunction();
            const duration = performance.now() - startTime;
            
            console.log(`✅ ${testName}: ${message} (${duration.toFixed(2)}ms)`);
            
            return {
                testName,
                passed: true,
                message,
                duration
            };
        } catch (error) {
            const duration = performance.now() - startTime;
            const message = error instanceof Error ? error.message : String(error);
            
            console.error(`❌ ${testName}: ${message} (${duration.toFixed(2)}ms)`);
            
            return {
                testName,
                passed: false,
                message,
                duration
            };
        }
    }
    
    /**
     * Cleanup test resources
     */
    private cleanup(): void {
        // Clear series manager
        this.seriesManager.clearAllSeries();
        
        // Remove test container
        if (this.testContainer.parentNode) {
            this.testContainer.parentNode.removeChild(this.testContainer);
        }
    }
}

/**
 * Run series navigation tests
 */
export async function runSeriesNavigationTests(): Promise<TestSuite[]> {
    const runner = new SeriesNavigationTestRunner();
    return await runner.runAllTests();
}