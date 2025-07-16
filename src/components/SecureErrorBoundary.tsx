/**
 * 보안 에러 바운더리 컴포넌트
 * React 컴포넌트 트리에서 발생하는 에러를 안전하게 처리합니다.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { handleError, ErrorCategory, ErrorSeverity } from '../utils/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  category?: ErrorCategory;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  errorBoundaryId: string;
}

export class SecureErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      errorBoundaryId: `error-boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 에러 상태 업데이트
    return {
      hasError: true,
      error,
      errorId: `boundary-error-${Date.now()}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 보안 에러 핸들러를 통해 에러 처리
    const errorMessage = handleError(
      error,
      'React Error Boundary caught an error',
      {
        category: this.props.category || ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        context: {
          errorBoundaryId: this.state.errorBoundaryId,
          componentStack: errorInfo.componentStack,
          errorBoundary: this.constructor.name,
          retryCount: this.retryCount,
          resetKeys: this.props.resetKeys
        }
      }
    );

    // 사용자 정의 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 자동 복구 시도 (개발 환경에서만)
    if (!import.meta.env.PROD && this.retryCount < this.maxRetries) {
      this.scheduleReset();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // 에러 상태에서 복구 조건 확인
    if (hasError && !prevProps.hasError) {
      // resetKeys가 변경되었을 때 리셋
      if (resetKeys && prevProps.resetKeys) {
        const hasResetKeyChanged = resetKeys.some((key, index) => 
          key !== prevProps.resetKeys![index]
        );
        
        if (hasResetKeyChanged) {
          this.resetErrorBoundary();
        }
      }

      // props 변경 시 리셋 (resetOnPropsChange가 true일 때)
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private scheduleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    // 점진적 지연 (1초, 2초, 4초)
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 4000);
    
    this.resetTimeoutId = window.setTimeout(() => {
      this.retryCount++;
      this.resetErrorBoundary();
    }, delay);
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorId } = this.state;
    const { children, fallback, isolate } = this.props;

    if (hasError) {
      // 사용자 정의 fallback UI가 있으면 사용
      if (fallback) {
        return fallback;
      }

      // 기본 에러 UI 렌더링
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            
            <h2 className="error-boundary-title">
              문제가 발생했습니다
            </h2>
            
            <p className="error-boundary-message">
              페이지를 표시하는 중 오류가 발생했습니다. 
              잠시 후 다시 시도해주세요.
            </p>
            
            {!import.meta.env.PROD && error && (
              <details className="error-boundary-details">
                <summary>기술적 세부사항</summary>
                <div className="error-boundary-error-info">
                  <p><strong>에러 ID:</strong> {errorId}</p>
                  <p><strong>에러 메시지:</strong> {error.message}</p>
                  <p><strong>재시도 횟수:</strong> {this.retryCount}/{this.maxRetries}</p>
                  {error.stack && (
                    <pre className="error-boundary-stack">
                      {error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            
            <div className="error-boundary-actions">
              <button 
                onClick={this.handleRetry}
                className="error-boundary-retry-btn"
                disabled={this.retryCount >= this.maxRetries}
              >
                다시 시도
              </button>
              
              <button 
                onClick={this.handleReload}
                className="error-boundary-reload-btn"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
          
          <style jsx>{`
            .error-boundary-container {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: ${isolate ? '200px' : '100vh'};
              padding: 20px;
              background-color: #f8f9fa;
              border: ${isolate ? '1px solid #dee2e6' : 'none'};
              border-radius: ${isolate ? '8px' : '0'};
            }
            
            .error-boundary-content {
              max-width: 500px;
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .error-boundary-icon {
              color: #dc3545;
              margin-bottom: 20px;
            }
            
            .error-boundary-title {
              color: #212529;
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 12px;
            }
            
            .error-boundary-message {
              color: #6c757d;
              font-size: 16px;
              line-height: 1.5;
              margin-bottom: 30px;
            }
            
            .error-boundary-details {
              text-align: left;
              margin-bottom: 30px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            }
            
            .error-boundary-details summary {
              cursor: pointer;
              font-weight: 600;
              color: #495057;
              margin-bottom: 10px;
            }
            
            .error-boundary-error-info {
              font-size: 14px;
              color: #6c757d;
            }
            
            .error-boundary-stack {
              background: #f1f3f4;
              padding: 10px;
              border-radius: 4px;
              overflow-x: auto;
              font-size: 12px;
              margin-top: 10px;
            }
            
            .error-boundary-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
            }
            
            .error-boundary-retry-btn,
            .error-boundary-reload-btn {
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .error-boundary-retry-btn {
              background: #007bff;
              color: white;
            }
            
            .error-boundary-retry-btn:hover:not(:disabled) {
              background: #0056b3;
            }
            
            .error-boundary-retry-btn:disabled {
              background: #6c757d;
              cursor: not-allowed;
            }
            
            .error-boundary-reload-btn {
              background: #6c757d;
              color: white;
            }
            
            .error-boundary-reload-btn:hover {
              background: #545b62;
            }
          `}</style>
        </div>
      );
    }

    return children;
  }
}

// 특화된 에러 바운더리 컴포넌트들
export const DicomErrorBoundary: React.FC<Omit<Props, 'category'>> = (props) => (
  <SecureErrorBoundary {...props} category={ErrorCategory.DICOM} />
);

export const RenderingErrorBoundary: React.FC<Omit<Props, 'category'>> = (props) => (
  <SecureErrorBoundary {...props} category={ErrorCategory.RENDERING} />
);

export const AuthErrorBoundary: React.FC<Omit<Props, 'category'>> = (props) => (
  <SecureErrorBoundary {...props} category={ErrorCategory.AUTHENTICATION} />
);

export const NetworkErrorBoundary: React.FC<Omit<Props, 'category'>> = (props) => (
  <SecureErrorBoundary {...props} category={ErrorCategory.NETWORK} />
);

export const MeasurementErrorBoundary: React.FC<Omit<Props, 'category'>> = (props) => (
  <SecureErrorBoundary {...props} category={ErrorCategory.MEASUREMENT} />
);

// HOC (Higher-Order Component) 형태로 사용할 수 있는 래퍼
export function withErrorBoundary<T extends {}>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: T) => (
    <SecureErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SecureErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// 에러 바운더리 상태를 관리하는 훅
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

export default SecureErrorBoundary;