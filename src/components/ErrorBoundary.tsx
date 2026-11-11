import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    console.error("[ErrorBoundary] Uncaught application error:", error, errorInfo);
    const msg = String(error?.message || '');
    const isChunkErr =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Loading chunk');
    if (isChunkErr && typeof window !== 'undefined') {
      try {
        const last = parseInt(sessionStorage.getItem('prescripto_eb_chunk_reload') || '0', 10);
        if (!last || Date.now() - last > 15000) {
          sessionStorage.setItem('prescripto_eb_chunk_reload', String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {}
    }
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndRestart = () => {
    try {
      sessionStorage.clear();
      localStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch (e) {
      console.warn("Storage clear error:", e);
    }
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-jakarta-sans">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Prescripto encountered an unexpected issue while loading this view.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-left overflow-x-auto max-h-32">
                <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={this.handleReload}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg shadow-blue-500/20"
              >
                <RefreshCw className="w-4 h-4" /> Reload Page
              </Button>

              <Button
                variant="outline"
                onClick={this.handleClearAndRestart}
                className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 font-bold gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <LogOut className="w-4 h-4" /> Clear Cache & Restart
              </Button>
            </div>

            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
              Prescripto Auto-Recovery Sentinel
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
