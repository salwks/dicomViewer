/**
 * Error Boundary Component for Medical Imaging Applications
 *
 * Handles errors gracefully in medical imaging context
 * Based on React best practices for error boundaries
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only log detailed errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Medical Imaging Error Boundary caught an error:', error, errorInfo);
    } else {
      // In production, log only sanitized error information
      console.error('Medical Imaging Error Boundary: An error occurred in the application');
    }

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send sanitized error reports to a service
    if (process.env.NODE_ENV === 'production') {
      // Send only non-sensitive error information to error reporting service
      // const sanitizedError = {
      //   message: 'Medical imaging application error',
      //   timestamp: new Date().toISOString(),
      //   userAgent: navigator.userAgent,
      //   // Do not include stack traces or component stacks in production
      // };
      // errorReportingService.report(sanitizedError);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI for medical applications
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <h2>🚨 Medical Imaging Error</h2>
            <p>
              An error occurred while processing medical imaging data.
              Please refresh the page or contact technical support.
            </p>
            {/* Only show technical details in development mode to prevent information leakage */}
            {process.env.NODE_ENV === 'development' && (
              <details className="error-boundary__details">
                <summary>Technical Details (Development Only)</summary>
                <div className="error-boundary__error-info">
                  <h3>Error:</h3>
                  <pre>{this.state.error && this.state.error.toString()}</pre>
                  <h3>Component Stack:</h3>
                  <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                </div>
              </details>
            )}
            {/* In production, provide only safe error reporting information */}
            {process.env.NODE_ENV === 'production' && (
              <div className="error-boundary__production-info">
                <p>
                  <strong>Error ID:</strong> {Date.now().toString(36).toUpperCase()}
                </p>
                <p>
                  <strong>Time:</strong> {new Date().toLocaleString()}
                </p>
                <p>
                  Please provide this Error ID when contacting technical support.
                </p>
              </div>
            )}
            <div className="error-boundary__actions">
              <button
                onClick={() => {
                  // eslint-disable-next-line no-alert -- Alert is appropriate for critical error recovery
                  if (confirm('This will reload the page and you may lose unsaved work. Continue?')) {
                    window.location.reload();
                  }
                }}
                className="error-boundary__retry-button"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
