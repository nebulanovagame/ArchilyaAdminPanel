"use client";

import React, { type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Terminal } from "lucide-react";

export type RenderErrorBoundaryLabels = {
  title?: string;
  retry?: string;
  stackTrace?: string;
};

export type RenderErrorBoundaryProps = {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  labels?: RenderErrorBoundaryLabels;
};

export type RenderErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export class RenderErrorBoundary extends React.Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  constructor(props: RenderErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RenderErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallbackComponent, labels } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallbackComponent) {
      return fallbackComponent;
    }

    const title = labels?.title ?? "Bir hata oluştu";
    const retry = labels?.retry ?? "Tekrar Dene";
    const stackTrace = labels?.stackTrace ?? "Stack Trace";

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-sm border border-red-500/20 bg-[#0d0f13] p-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>

        <h3 className="mb-1 font-serif text-lg italic text-white">
          {title}
        </h3>

        {error?.message && (
          <p className="mb-5 max-w-sm text-xs text-red-300">
            {error.message}
          </p>
        )}

        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {retry}
        </button>

        {errorInfo?.componentStack && (
          <details className="mt-5 w-full max-w-lg text-left">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-300">
              <Terminal className="h-3.5 w-3.5" />
              {stackTrace}
            </summary>
            <pre className="mt-3 overflow-auto rounded-sm border border-red-500/15 bg-red-500/5 p-3 text-left text-[11px] leading-relaxed text-red-300">
              <code>{errorInfo.componentStack}</code>
            </pre>
          </details>
        )}
      </div>
    );
  }
}

export function withRenderErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  boundaryProps?: Omit<RenderErrorBoundaryProps, "children">
): ComponentType<P> {
  const WrappedComponent: ComponentType<P> = (props: P) => (
    <RenderErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </RenderErrorBoundary>
  );

  const displayName = Component.displayName || Component.name || "Component";
  WrappedComponent.displayName = `withRenderErrorBoundary(${displayName})`;

  return WrappedComponent;
}

export default RenderErrorBoundary;
