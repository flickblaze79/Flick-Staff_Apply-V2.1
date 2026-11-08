import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogIn, Trash2 } from 'lucide-react';
import { FlickLogo } from './FlickLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FlickErrorBoundary] Caught uncaught application error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearSession = () => {
    try {
      localStorage.removeItem('flick_current_session');
      localStorage.removeItem('flick-theme');
    } catch (e) {
      console.warn('Storage clear notice:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0e17] text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
          <div className="max-w-md w-full bg-[#111726] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="flex justify-center">
              <FlickLogo size="xl" showText={false} />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Portal Recovery</span>
              </div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">
                Something went wrong
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                The portal encountered a temporary rendering issue. Your data and submissions in Firebase are safe.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/50 border border-white/10 rounded-xl text-left overflow-auto max-h-32 text-[11px] font-mono text-red-300">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Portal</span>
              </button>

              <button
                onClick={this.handleClearSession}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Cache & Restart</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold pt-2 border-t border-white/5">
              Flick Staff Apply V2.1 • Safe Mode Active
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
