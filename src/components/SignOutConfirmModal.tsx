import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, AlertTriangle, X, ShieldAlert, Loader2 } from 'lucide-react';
import { UserProfile } from '../types';

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  userProfile: UserProfile | null;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userProfile,
}) => {
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsSigningOut(true);
      await onConfirm();
    } catch (err) {
      console.warn('Sign out warning notice:', err);
    } finally {
      setIsSigningOut(false);
      onClose();
    }
  };

  const roleColors: Record<string, string> = {
    USER: 'bg-slate-800 text-slate-300 border-slate-700',
    STAFF: 'bg-cyan-950 text-cyan-300 border-cyan-800',
    MOD: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    ADMIN: 'bg-purple-950 text-purple-300 border-purple-800',
    OWNER: 'bg-amber-950 text-amber-300 border-amber-800',
  };

  const userRole = userProfile?.role || 'USER';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isSigningOut ? undefined : onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-slate-950 border border-amber-500/50 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl shadow-amber-950/40 z-10 space-y-6 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-out-modal-title"
        >
          {/* Ambient Cyber Accent */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between gap-4 relative z-10 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-400 shadow-md shadow-amber-950/50">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                  Security Warning
                </span>
                <h3
                  id="sign-out-modal-title"
                  className="text-lg font-black text-white uppercase tracking-tight"
                >
                  Confirm Sign Out
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSigningOut}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warning Banner */}
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Sign Out Warning</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Are you sure you want to sign out? Your active session will end, and any unsaved changes may be lost.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Are you sure you want to sign out? You will need to log back in to review applications, submit staff reports, or edit your profile.
            </p>
          </div>

          {/* User Account Info Card */}
          {userProfile && (
            <div className="bg-slate-900/90 border border-secondary/30 rounded-2xl p-3.5 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center font-black text-sm text-white shrink-0 border border-cyan-400/30">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userProfile.name.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white truncate">
                    {userProfile.name}
                  </span>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                      roleColors[userRole] || roleColors.USER
                    }`}
                  >
                    {userRole}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 truncate block font-mono">
                  {userProfile.email}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10 relative z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSigningOut}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-secondary/40 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              Cancel / Stay Signed In
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSigningOut}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/60 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing Out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 text-white" />
                  <span>Yes, Sign Out</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
