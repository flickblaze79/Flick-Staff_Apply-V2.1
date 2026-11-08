import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { logAuditEvent } from '../lib/auditLogger';
import { addApplication, getApplications, getSystemSettings } from '../lib/storage';
import { StaffApplication, ApplicationCategory, QUESTIONS, SystemSettings, ApplicationCooldown } from '../types';
import { Send, AlertCircle, ShieldCheck, Clock, Loader2, Info } from 'lucide-react';
import { SubmissionSuccess } from '../components/SubmissionSuccess';

interface StaffApplyPageProps {
  onNavigate: (page: string) => void;
  onOpenAuth: () => void;
  defaultCategory?: ApplicationCategory;
}

export const StaffApplyPage: React.FC<StaffApplyPageProps> = ({ onNavigate, onOpenAuth, defaultCategory }) => {
  const { currentUser, userProfile } = useAuth();
  const [existingApp, setExistingApp] = useState<StaffApplication | null>(null);
  const [cooldown, setCooldown] = useState<ApplicationCooldown | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [category, setCategory] = useState<ApplicationCategory>(defaultCategory || 'Staff Apply');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [submissionDate, setSubmissionDate] = useState<string>('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const submittingRef = React.useRef(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { fetchSystemSettings } = await import('../lib/storage');
        const sysSettings = await fetchSystemSettings();
        setSettings(sysSettings);
        
        const toggles = sysSettings?.categoryToggles || {};
        
        if (defaultCategory) {
          setCategory(defaultCategory);
        } else {
          const availableCategories = Object.keys(toggles) as ApplicationCategory[];
          const firstAvailable = availableCategories.find(k => toggles[k] === true);
          if (firstAvailable) {
            setCategory(firstAvailable);
          }
        }
      } catch (err) {
        console.error('Error loading settings in StaffApplyPage:', err);
      }
    }
    loadSettings();
  }, [defaultCategory]);

  useEffect(() => {
    async function checkExisting() {
      if (!currentUser) {
        setCheckingExisting(false);
        return;
      }
      setCheckingExisting(true);
      try {
        const { fetchApplicationsFromFirestore, getApplicationCooldown } = await import('../lib/storage');
        const allApps = await fetchApplicationsFromFirestore();
        const cooldownData = await getApplicationCooldown(currentUser.uid);
        const activeApp = allApps.find(
          (app) => app.applicantUid === currentUser.uid && ['Pending', 'Under Review'].includes(app.status)
        );
        setExistingApp(activeApp || null);
        setCooldown(cooldownData);
      } catch (err) {
        console.warn('Error checking existing active application or cooldown:', err);
      } finally {
        setCheckingExisting(false);
      }
    }
    checkExisting();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submittingRef.current) return;
    setError(null);

    if (!currentUser) {
      onOpenAuth();
      return;
    }

    const currentQuestions = QUESTIONS[category] || QUESTIONS['Staff Apply'];
    const requiredCount = currentQuestions.length;

    // Validate that all questions have non-empty answers
    for (let i = 0; i < requiredCount; i++) {
      if (!answers[i.toString()] || !answers[i.toString()].trim()) {
        setError(`Please answer question #${i + 1}: "${currentQuestions[i]}"`);
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const newApp = await addApplication({
        applicantUid: currentUser.uid,
        applicantName: userProfile?.name || currentUser.displayName || 'Unknown Applicant',
        applicantEmail: currentUser.email || '',
        discordUsername: answers['0']?.trim() || 'N/A',
        age: answers['1']?.trim() || 'N/A',
        timezone: answers['2']?.trim() || 'N/A',
        category,
        position: category,
        answers,
        status: 'Pending',
        assignmentStatus: 'Unassigned',
        createdAt: now,
        updatedAt: now,
      });

      await logAuditEvent({
        action: 'APPLICATION_SUBMITTED',
        actorUid: currentUser.uid,
        actorName: userProfile?.name || 'Applicant',
        actorEmail: currentUser.email || '',
        actorRole: userProfile?.role || 'USER',
        targetResource: 'applications',
        targetUid: newApp.id,
        metadata: { category, position: category },
      });

      setShowSuccessOverlay(true);
      setSubmissionDate(now);
    } catch (err: any) {
      console.error('Application submission error:', err);
      setError(err?.message || 'Failed to submit application. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6 bg-panel border border-secondary/30 rounded-3xl p-8 mt-10 shadow-2xl text-white">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase">Authentication Required</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          Please sign in to submit an application for Flick Staff Apply V2.1.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-primary/30"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  if (checkingExisting) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center text-slate-300 font-bold text-sm">
        Checking application history...
      </div>
    );
  }

  const isCooldownActive = cooldown && new Date(cooldown.cooldownUntil) > new Date();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!isCooldownActive || !cooldown) return;
    const updateTime = () => {
      const now = new Date();
      const until = new Date(cooldown.cooldownUntil);
      const diff = until.getTime() - now.getTime();
      if (diff <= 0) {
        setCooldown(null);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hours}h ${minutes}m`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [isCooldownActive, cooldown]);

  if (isCooldownActive) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-white">
        <div className="bg-panel border border-secondary/40 rounded-3xl p-8 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-950 border border-amber-500/40 flex items-center justify-center text-amber-300">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase italic">Reapplication Cooldown</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Your previous application was finalized. You can apply again in <strong className="text-amber-400 font-black">{timeLeft}</strong>.
            </p>
            <p className="text-xs text-slate-500 font-bold uppercase mt-2">Available again on {new Date(cooldown!.cooldownUntil).toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  if (existingApp) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-white">
        <div className="bg-panel border border-secondary/40 rounded-3xl p-8 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase italic">Application Currently Active</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              You already have an active application ({existingApp.category}) with current status:{' '}
              <strong className="uppercase text-cyan-400 font-black">{existingApp.status}</strong>.
            </p>
          </div>
          <button
            onClick={() => onNavigate('status')}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
          >
            View Your Application Status
          </button>
        </div>
      </div>
    );
  }

  const isCategoryOpen = settings?.categoryToggles?.[category] !== false;
  const currentQuestions = QUESTIONS[category] || QUESTIONS['Staff Apply'];

  if (!isCategoryOpen && !checkingExisting) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6 bg-panel border border-secondary/30 rounded-3xl p-8 mt-10 shadow-2xl text-white">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic">Applications Currently Closed</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          Recruitment for the <strong className="text-amber-400 uppercase">{category}</strong> position is currently suspended. Please check back later or select another category.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-2.5 bg-panel border border-secondary/40 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            Back to Home
          </button>
          <button
             onClick={() => {
               const firstAvailable = (Object.keys(settings?.categoryToggles || {}) as ApplicationCategory[]).find(k => settings?.categoryToggles[k]);
               if (firstAvailable) setCategory(firstAvailable);
             }}
             className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
          >
            Check Other Categories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 text-white">
      {/* Header */}
      <div className="border-b border-secondary/20 pb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">
              Recruitment Gateway
            </span>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-1">
              Apply For Position
            </h1>
          </div>

          {/* Category Dropdown Selector */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
              Select Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ApplicationCategory);
                setAnswers({});
                setError(null);
              }}
              className="bg-panel border border-cyan-400/50 rounded-xl px-4 py-2.5 text-xs font-black text-white outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {Object.keys(QUESTIONS).map((cat) => (
                settings?.categoryToggles?.[cat as ApplicationCategory] !== false && (
                  <option key={cat} value={cat}>{cat}</option>
                )
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-300 font-medium leading-relaxed">
          Fill out all fields completely. Applications will be reviewed by authorized team members. Unreviewed submissions are automatically rejected after 48 hours.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-panel border border-secondary/30 p-6 sm:p-8 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between bg-canvas/80 p-4 rounded-2xl border border-secondary/30 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Applying as</span>
            <span className="text-white font-bold">{userProfile?.name || currentUser.email}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Target Category</span>
            <span className="text-cyan-300 font-black uppercase">{category}</span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-800 rounded-2xl text-red-200 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {currentQuestions.map((q, i) => (
            <div key={i} className="space-y-2">
              <label className="block text-xs font-black text-white uppercase tracking-wider leading-relaxed">
                Q{i + 1}. {q} <span className="text-cyan-400">*</span>
              </label>
              <textarea
                value={answers[i.toString()] || ''}
                onChange={(e) => setAnswers({ ...answers, [i.toString()]: e.target.value })}
                placeholder="Type your response here..."
                rows={3}
                className="w-full bg-canvas border border-secondary/30 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                required
              />
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[11px] text-slate-300 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Answers must be truthful and accurate.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-primary to-secondary hover:from-blue-600 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Application</span>
              </>
            )}
          </button>
        </div>
      </form>

      <SubmissionSuccess
        isOpen={showSuccessOverlay}
        onClose={() => onNavigate('status')}
        category={category}
        submissionDate={submissionDate}
      />
    </div>
  );
};
