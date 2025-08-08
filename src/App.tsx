/**
 * App Component
 * Main application entry point with React lifecycle-based Cornerstone initialization
 * Built with shadcn/ui components and ViewerContext
 */

import React, { useState } from 'react';
import { UnifiedViewer } from './components/UnifiedViewer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SimpleDicomTest } from './components/SimpleDicomTest';
import { useCornerstone } from './hooks/useCornerstone';
import { log } from './utils/logger';

// Loading component
const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Initializing DICOM Viewer</h2>
        <p className="text-sm text-muted-foreground">Setting up Cornerstone3D engine...</p>
      </div>
    </div>
  </div>
);

// Error component
const ErrorScreen: React.FC<{ error: Error; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-center space-y-4 max-w-md p-6">
      <div className="w-12 h-12 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Initialization Failed</h2>
        <p className="text-sm text-muted-foreground mb-4">Failed to initialize DICOM viewer</p>
        <details className="text-left bg-muted p-3 rounded-md text-xs">
          <summary className="cursor-pointer mb-2 font-medium">Error Details</summary>
          <pre className="whitespace-pre-wrap">{error.message}</pre>
        </details>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);

// UnifiedViewer를 래핑해서 테스트 버튼을 HeaderNavigation에 전달
const UnifiedViewerWithTestButton: React.FC<{ onTestModeToggle: () => void }> = ({ onTestModeToggle }) => {
  return (
    <UnifiedViewer onTestModeToggle={onTestModeToggle} />
  );
};

const App: React.FC = () => {
  const [testMode, setTestMode] = useState(false);
  const { isLoading, isInitialized, error } = useCornerstone();

  React.useEffect(() => {
    log.info('App mounted', {
      component: 'App',
      metadata: {
        version: '2.0.0',
        architecture: 'unified-viewer',
        cornerstoneState: { isLoading, isInitialized, hasError: !!error },
      },
    });

    return () => {
      log.info('App unmounted', {
        component: 'App',
      });
    };
  }, [isLoading, isInitialized, error]);

  // Handle retry
  const handleRetry = () => {
    window.location.reload();
  };

  // 테스트 모드일 때는 초기화 없이 바로 테스트 컴포넌트 표시
  if (testMode) {
    return (
      <ErrorBoundary>
        <SimpleDicomTest onBackToMain={() => setTestMode(false)} />
      </ErrorBoundary>
    );
  }

  // Show loading screen while initializing
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show error screen if initialization failed
  if (error) {
    return <ErrorScreen error={error} onRetry={handleRetry} />;
  }

  // Show main app only when Cornerstone is fully initialized
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <UnifiedViewerWithTestButton
        onTestModeToggle={() => setTestMode(true)}
      />
    </ErrorBoundary>
  );
};

export default App;
