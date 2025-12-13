/**
 * Reusable Error Boundary Component
 * 재사용 가능한 에러 바운더리 컴포넌트
 * 
 * React의 Error Boundary는 클래스 컴포넌트만 지원하므로,
 * 이 컴포넌트는 클라이언트 컴포넌트에서 사용할 수 있는 래퍼입니다.
 * 
 * Next.js App Router에서는 error.tsx를 사용하는 것이 권장되지만,
 * 특정 컴포넌트 트리 내에서만 에러를 처리하고 싶을 때 사용할 수 있습니다.
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { ErrorMessage } from './error-message';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 커스텀 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8">
          <ErrorMessage
            error={this.state.error}
            onRetry={this.handleReset}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-style Error Boundary Wrapper
 * 함수 컴포넌트에서 사용하기 편한 래퍼
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

