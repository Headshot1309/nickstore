import React from 'react';
import { Button } from '@/components/ui/button';

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('NickStore render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
          <div className="max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/30">
            <h1 className="text-2xl font-bold">NickStore needs a refresh</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              The app hit a browser display issue. Refreshing clears the cached screen and reloads the latest version.
            </p>
            <Button className="mt-6 bg-violet-500 text-white hover:bg-violet-400" onClick={() => window.location.reload()}>
              Refresh app
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
