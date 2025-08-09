/**
 * ModularApp - Example app using the modular architecture
 * Demonstrates how to use the module system
 */

import React, { useState } from 'react';
import { ModularUnifiedViewer } from '../components/modular';
import { SimpleDicomTest } from '../components/SimpleDicomTest';
import { useCornerstone } from '../hooks/useCornerstone';
import { ErrorBoundary } from '../components/ErrorBoundary';

const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Initializing Modular Viewer</h2>
        <p className="text-sm text-muted-foreground">Setting up module system...</p>
      </div>
    </div>
  </div>
);

export const ModularApp: React.FC = () => {
  const [testMode, setTestMode] = useState(false);
  const { isLoading, isInitialized, error } = useCornerstone();

  // Test mode - bypass module system
  if (testMode) {
    return (
      <ErrorBoundary>
        <SimpleDicomTest onBackToMain={() => setTestMode(false)} />
      </ErrorBoundary>
    );
  }

  // Loading state
  if (isLoading || !isInitialized) {
    return <LoadingScreen />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="w-12 h-12 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Initialization Failed</h2>
            <p className="text-sm text-muted-foreground">Failed to initialize viewer modules</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main app with modular viewer
  return (
    <ErrorBoundary>
      <ModularUnifiedViewer onTestModeToggle={() => setTestMode(true)} />
    </ErrorBoundary>
  );
};