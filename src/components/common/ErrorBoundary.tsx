import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh items-center justify-center bg-base">
          <EmptyState
            icon={TriangleAlert}
            title="Something went wrong"
            description={this.state.error.message}
          >
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="text-sm text-brand hover:underline cursor-pointer"
            >
              Reload page
            </button>
          </EmptyState>
        </div>
      );
    }
    return this.props.children;
  }
}
