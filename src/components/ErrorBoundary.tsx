import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let parsedMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; path?: string };
        if (parsed.error) {
          parsedMsg = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
        }
      } catch {
        // Keep raw message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <p className="text-xs font-semibold text-[#B8921F] tracking-wide mb-2">
              DR BOLDIN DATA SUB
            </p>
            <h2 className="text-2xl font-bold text-[#0A192F] mb-3">
              Unable to complete request
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed break-words">
              {parsedMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#112240] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
