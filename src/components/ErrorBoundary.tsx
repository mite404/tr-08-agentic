import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component (PR #5)
 *
 * Catches React errors in child components and displays a fallback UI.
 * Prevents the entire app from crashing when an error occurs.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="rounded-xl bg-gray-600 p-8">
            <div className="rounded-md border-l-4 border-red-500 bg-red-950 p-4">
              <h2 className="mb-2 text-lg font-bold text-red-100">
                Something went wrong
              </h2>
              <p className="mb-4 text-sm text-red-200">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              <button
                onClick={this.handleReload}
                className="rounded bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
