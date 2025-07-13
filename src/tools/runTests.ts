import { createAnnotationTestRunner } from './annotationTest';

// Simple test runner for the annotation system
async function runAnnotationTests(): Promise<void> {
    console.log('🚀 Starting Cornerstone3D Annotation System Tests');
    console.log('=' .repeat(60));

    const testRunner = createAnnotationTestRunner();
    
    try {
        // Run all tests
        const results = await testRunner.runAllTests();
        
        // Calculate overall results
        const totalSuites = results.length;
        const passedSuites = results.filter(suite => suite.failedTests === 0).length;
        const failedSuites = results.filter(suite => suite.failedTests > 0).length;
        
        console.log('\n🏁 Test Execution Complete');
        console.log('=' .repeat(60));
        console.log(`📊 Test Suites: ${passedSuites}/${totalSuites} passed`);
        console.log(`✅ Passed Suites: ${passedSuites}`);
        console.log(`❌ Failed Suites: ${failedSuites}`);
        
        if (failedSuites === 0) {
            console.log('🎉 All annotation system tests passed successfully!');
            console.log('✅ The annotation system is ready for use.');
        } else {
            console.log(`⚠️  ${failedSuites} test suites failed. Please review the failures above.`);
        }
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
    } finally {
        // Clean up
        testRunner.dispose();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAnnotationTests().catch(console.error);
}

export { runAnnotationTests };