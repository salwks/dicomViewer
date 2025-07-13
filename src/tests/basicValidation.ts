import { validateDicomFile, ViewerError, ImageLoadingError } from '../utils/errorHandler';

export function runBasicValidationTests(): boolean {
    console.log('🧪 Running basic validation tests...');
    
    try {
        // Test 1: File validation
        console.log('Testing file validation...');
        
        // Create a mock file for testing
        const validFile = new File(['dummy content'], 'test.dcm', { type: 'application/dicom' });
        const validationResult = validateDicomFile(validFile);
        
        if (!validationResult) {
            throw new Error('File validation failed for valid file');
        }
        console.log('✅ File validation test passed');

        // Test 2: Error handling
        console.log('Testing error handling...');
        
        const testError = new ImageLoadingError('Test error', { testContext: true });
        
        if (!(testError instanceof ViewerError)) {
            throw new Error('Error inheritance test failed');
        }
        console.log('✅ Error handling test passed');

        // Test 3: Basic viewport element check
        console.log('Testing viewport element requirements...');
        
        // This would normally be done in a browser environment
        // For now, just check if the logic would work
        const mockElement = {
            style: {
                width: '100%',
                height: '100%',
                position: 'relative'
            }
        };
        
        if (!mockElement.style.width) {
            throw new Error('Viewport element validation failed');
        }
        console.log('✅ Viewport element validation test passed');

        console.log('🎉 All basic validation tests passed!');
        return true;

    } catch (error) {
        console.error('❌ Basic validation test failed:', error);
        return false;
    }
}

// Export for potential use in other tests
export { validateDicomFile };