import { Component, type ErrorInfo, type ReactNode } from "react";

import { APP_NAME } from "../config";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${APP_NAME} render error`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-primary text-lg font-semibold">
            Something went wrong
          </p>
          <p className="text-muted max-w-sm text-sm leading-relaxed">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary rounded-xl px-6 py-3"
          >
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
