/**
 * Error Boundary Component
 * Catches JavaScript errors in child components
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryButtonRef = React.createRef<HTMLButtonElement>();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Move keyboard focus into the default recovery surface after the failed
    // subtree is replaced. Custom fallbacks retain ownership of their focus policy.
    this.retryButtonRef.current?.focus();
    
    // Report to error tracking service
    this.props.onError?.(error, errorInfo);
    
    // In production, you'd send this to Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      // sendToErrorTracking(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset);
      }
      
      if (fallback) {
        return fallback;
      }

      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__content">
            <h2>{i18n.t('errors.genericError')}</h2>
            <p>{i18n.t('errors.unexpectedError')}</p>
            <button
              ref={this.retryButtonRef}
              type="button"
              className="error-boundary__button"
              onClick={this.handleReset}
            >
              {i18n.t('common.retry')}
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
