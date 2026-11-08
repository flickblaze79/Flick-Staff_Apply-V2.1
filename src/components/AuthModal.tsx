import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { X, ShieldCheck, Mail, Lock, User as UserIcon, LogIn, UserPlus } from 'lucide-react';
import { FlickLogo } from './FlickLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, signUpWithEmail, loginWithEmailPassword, sendPasswordResetLink, authError } = useAuth();
  const [activeTab, setActiveTab] = useState<'google' | 'email-signup' | 'email-login' | 'reset-password'>('google');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address to reset password.');
      return;
    }
    setLoading(true);
    setError(null);
    setResetSent(false);
    try {
      await sendPasswordResetLink(email.trim());
      setResetSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, name);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginWithEmailPassword(email, password);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-panel border border-secondary/30 rounded-[32px] shadow-2xl p-6 sm:p-8 overflow-hidden space-y-5"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-canvas transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3">
          <FlickLogo size="lg" showText={false} className="mb-1" />

          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black tracking-tighter uppercase italic leading-none flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-white">FLICK</span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">STAFF APPLY</span>
              <span className="text-secondary opacity-90">V2.1</span>
            </h2>
            <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
              Authentication Portal
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-canvas/80 p-1 border border-secondary/30 text-[11px] font-bold">
          <button
            onClick={() => { setActiveTab('google'); setError(null); }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'google' ? 'bg-cyan-500 text-black font-extrabold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Google
          </button>
          <button
            onClick={() => { setActiveTab('email-signup'); setError(null); }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'email-signup' ? 'bg-cyan-500 text-black font-extrabold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Email Sign Up
          </button>
          <button
            onClick={() => { setActiveTab('email-login'); setError(null); }}
            className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'email-login' ? 'bg-cyan-500 text-black font-extrabold shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Email Login
          </button>
        </div>

        {(error || authError) && (
          <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-red-200 text-xs font-bold text-center leading-relaxed">
            {error || authError}
          </div>
        )}

        {/* TAB 1: GOOGLE */}
        {activeTab === 'google' && (
          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-extrabold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Connecting...' : 'Sign In with Google'}</span>
            </button>
          </div>
        )}

        {/* TAB 2: EMAIL SIGN UP */}
        {activeTab === 'email-signup' && (
          <form onSubmit={handleEmailSignUp} className="space-y-3">
            <div className="space-y-2.5">
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Full Name / Display Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-canvas/90 border border-secondary/30 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="Your Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-canvas/90 border border-secondary/30 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Password (Min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-canvas/90 border border-secondary/30 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black py-2.5 px-4 rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'Creating Account...' : 'Register Applicant Account'}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center uppercase tracking-wider font-bold">
              New accounts register as Community Applicant by default
            </p>
          </form>
        )}

        {/* TAB 3: EMAIL LOGIN */}
        {activeTab === 'email-login' && (
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-2.5">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="Your Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-canvas/90 border border-secondary/30 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-canvas/90 border border-secondary/30 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black py-2.5 px-4 rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('reset-password');
                  setError(null);
                  setResetSent(false);
                }}
                className="text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
              >
                Forgot your password?
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: RESET PASSWORD */}
        {activeTab === 'reset-password' && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="p-3 bg-canvas/80 border border-secondary/20 rounded-xl space-y-1">
              <p className="text-xs font-bold text-white">Reset Account Password</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter your registered email address and we'll dispatch an official Firebase password reset link directly to your inbox.
              </p>
            </div>

            {resetSent && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold text-center leading-relaxed">
                Password reset link dispatched to <span className="text-white underline">{email}</span>. Check your inbox or spam folder!
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="Enter Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-canvas/90 border border-secondary/30 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-2.5 px-4 rounded-xl transition-all text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Sending Reset Link...' : 'Send Password Reset Link'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('email-login');
                  setError(null);
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        <div className="text-center border-t border-secondary/20 pt-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-extrabold flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Flick Staff Apply V2.1 Firebase Security Active</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

