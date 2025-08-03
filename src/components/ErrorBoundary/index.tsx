/**
 * Error Boundary Component for Medical Imaging Applications
 *
 * Handles errors gracefully in medical imaging context
 * Based on React best practices for error boundaries
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';

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
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="text-2xl">🚨</div>
                <CardTitle className="text-xl text-destructive">Medical Imaging Error</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  An error occurred while processing medical imaging data. Please refresh the page or contact technical support.
                </AlertDescription>
              </Alert>

              {/* Only show technical details in development mode to prevent information leakage */}
              {process.env.NODE_ENV === 'development' && (
                <Card className="border-accent bg-accent/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-accent-foreground">
                      Technical Details (Development Only)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <h4 className="font-medium text-accent-foreground mb-1">Error:</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto text-muted-foreground">
                        {this.state.error && this.state.error.toString()}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-medium text-accent-foreground mb-1">Component Stack:</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto text-muted-foreground">
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* In production, provide only safe error reporting information */}
              {process.env.NODE_ENV === 'production' && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">Error ID:</span>
                      <Badge variant="outline" className="text-primary border-primary/20">
                        {Date.now().toString(36).toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">Time:</span>
                      <span className="text-primary/80">{new Date().toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-primary/70">
                      Please provide this Error ID when contacting technical support.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => {
                    // eslint-disable-next-line no-alert -- Alert is appropriate for critical error recovery
                    if (confirm('This will reload the page and you may lose unsaved work. Continue?')) {
                      window.location.reload();
                    }
                  }}
                  variant="destructive"
                  size="lg"
                >
                  Reload Application
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
