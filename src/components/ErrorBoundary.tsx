import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Terjadi kesalahan pada aplikasi.' };
  }

  componentDidCatch(error: Error) {
    console.error('ChromaStudio ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#121215] text-zinc-100 p-6">
          <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-[#1a1a1f] p-6">
            <h2 className="text-lg font-semibold text-white">Studio Mengalami Kendala</h2>
            <p className="mt-2 text-sm text-zinc-400 break-words">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
            >
              Muat Ulang Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
