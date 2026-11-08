import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2, Trash2, X, ShieldAlert } from 'lucide-react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  isDeleting?: boolean; // Backwards compatibility alias
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title = 'Delete Confirmation',
  message = 'Are you sure you want to permanently delete this item? This action cannot be undone.',
  itemName,
  confirmLabel = 'Delete Permanently',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  isDeleting = false,
  error,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const activeLoading = isLoading || isDeleting;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          border: 'border-amber-500/40',
          iconBg: 'bg-amber-950/80 border-amber-500/30 text-amber-400',
          badgeText: 'text-amber-400',
          btnBg: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30',
        };
      case 'info':
        return {
          border: 'border-cyan-500/40',
          iconBg: 'bg-cyan-950/80 border-cyan-500/30 text-cyan-400',
          badgeText: 'text-cyan-400',
          btnBg: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30',
        };
      case 'danger':
      default:
        return {
          border: 'border-red-500/40',
          iconBg: 'bg-red-950/80 border-red-500/30 text-red-400',
          badgeText: 'text-red-400/90',
          btnBg: 'bg-red-600 hover:bg-red-500 shadow-red-600/30',
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`bg-panel border ${vStyles.border} rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden text-white`}
        >
          <button
            onClick={onCancel}
            disabled={activeLoading}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-canvas hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className={`p-3 rounded-2xl border shrink-0 ${vStyles.iconBg}`}>
              {variant === 'danger' ? (
                <AlertTriangle className="w-6 h-6 text-red-400" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">{title}</h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${vStyles.badgeText}`}>
                Requires Confirmation
              </span>
            </div>
          </div>

          <div className="space-y-3 bg-canvas/60 p-4 rounded-2xl border border-secondary/20">
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {message}
            </p>
            {itemName && (
              <div className="text-[11px] font-mono text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/20 truncate">
                <span className="text-slate-400 uppercase mr-1">Target Item:</span> {itemName}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 bg-red-950/90 border border-red-600 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-red-300">Operation Error</div>
                <div className="text-[11px] leading-snug break-words">{error}</div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={activeLoading}
              className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 rounded-xl text-xs font-black uppercase text-slate-300 transition-all disabled:opacity-50 cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={activeLoading}
              className={`flex-1 py-3 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${vStyles.btnBg}`}
            >
              {activeLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmLabel}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const DeleteConfirmationModal = ConfirmationDialog;
