export interface ErrorInfo {
    code: string;
    message: string;
    timestamp: Date;
    context?: any;
}

export class ViewerError extends Error {
    public code: string;
    public timestamp: Date;
    public context?: any;

    constructor(code: string, message: string, context?: any) {
        super(message);
        this.name = 'ViewerError';
        this.code = code;
        this.timestamp = new Date();
        this.context = context;
    }
}

export class ImageLoadingError extends ViewerError {
    constructor(message: string, context?: any) {
        super('IMAGE_LOADING_ERROR', message, context);
        this.name = 'ImageLoadingError';
    }
}

export class ViewportError extends ViewerError {
    constructor(message: string, context?: any) {
        super('VIEWPORT_ERROR', message, context);
        this.name = 'ViewportError';
    }
}

export class FileFormatError extends ViewerError {
    constructor(message: string, context?: any) {
        super('FILE_FORMAT_ERROR', message, context);
        this.name = 'FileFormatError';
    }
}

export function handleViewerError(error: Error, context?: any): ErrorInfo {
    const errorInfo: ErrorInfo = {
        code: error instanceof ViewerError ? error.code : 'UNKNOWN_ERROR',
        message: error.message,
        timestamp: new Date(),
        context: error instanceof ViewerError ? error.context : context
    };

    console.error('Viewer Error:', errorInfo);
    
    // Dispatch custom error event for UI handling
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('viewerError', {
            detail: errorInfo
        }));
    }

    return errorInfo;
}

export function validateDicomFile(file: File): boolean {
    // Basic file validation
    if (!file) {
        throw new FileFormatError('No file provided');
    }

    // Check file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
        throw new FileFormatError('File too large (max 500MB)', { size: file.size });
    }

    // Check file extension (allow common DICOM extensions)
    const validExtensions = ['.dcm', '.dicom', '.dic', ''];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => 
        ext === '' || fileName.endsWith(ext)
    );

    if (!hasValidExtension && !fileName.includes('dicom')) {
        console.warn('File may not be a DICOM file:', fileName);
    }

    return true;
}

export function createUserFriendlyMessage(error: Error): string {
    if (error instanceof FileFormatError) {
        return `File format error: ${error.message}. Please ensure you're loading valid DICOM files.`;
    }
    
    if (error instanceof ImageLoadingError) {
        return `Failed to load image: ${error.message}. The file may be corrupted or unsupported.`;
    }
    
    if (error instanceof ViewportError) {
        return `Display error: ${error.message}. Please try refreshing the page.`;
    }
    
    return `An unexpected error occurred: ${error.message}. Please try again or contact support.`;
}

// Global error handler setup
export function setupGlobalErrorHandling(): void {
    if (typeof window !== 'undefined') {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            handleViewerError(new Error(event.message), {
                filename: event.filename,
                line: event.lineno,
                column: event.colno
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            handleViewerError(new Error(event.reason), {
                type: 'unhandled_rejection'
            });
        });
    }
}