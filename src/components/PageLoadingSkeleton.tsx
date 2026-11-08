import React from 'react';
import { Loader2 } from 'lucide-react';

export const PageLoadingSkeleton: React.FC<{ message?: string }> = ({ message = 'Loading section...' }) => {
  return (
    <div className="w-full py-16 px-4 flex flex-col items-center justify-center space-y-4 text-slate-400 animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-panel border border-secondary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
      <div className="text-xs font-black uppercase tracking-widest text-slate-300">
        {message}
      </div>
      <div className="flex gap-1.5 pt-1">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};
