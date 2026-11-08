import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Eye,
  Calendar,
  Shield,
  MessageSquare,
  Copy,
  Check,
  Tag,
  Mail,
  Compass,
  CheckCircle2,
  XCircle,
  Loader2,
  BookmarkCheck,
} from 'lucide-react';
import { StaffApplication, QUESTIONS, UserRole, ApplicationStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  markApplicationSeen,
  acceptApplication,
  rejectApplication,
  moveApplicationToReview,
} from '../lib/applicationService';

interface ApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: StaffApplication | null;
  onUpdate: () => void;
  currentUserRole?: UserRole;
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  isOpen,
  onClose,
  application,
  onUpdate,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const autoSeenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredSeenRef = useRef(false);

  const reviewerUid = currentUser?.uid || '';
  const reviewerRole = userProfile?.role || 'USER';

  // Helper to test if current reviewer is recorded in seenBy array/record
  const isSeenByCurrentReviewer = (app: StaffApplication | null): boolean => {
    if (!app || !reviewerUid) return false;
    if (Array.isArray(app.seenBy)) {
      return app.seenBy.includes(reviewerUid);
    }
    if (app.seenBy && typeof app.seenBy === 'object') {
      return Boolean(app.seenBy[reviewerUid]);
    }
    return false;
  };

  const isSeen = isSeenByCurrentReviewer(application);

  // Sync / mark application as seen
  const markAsSeenInternal = async (targetApp: StaffApplication) => {
    if (!targetApp.id || !reviewerUid || updating) return;

    try {
      setUpdating(true);
      await markApplicationSeen(targetApp.id, reviewerUid);
      onUpdate();
    } catch (err: any) {
      console.warn('Auto/manual mark seen notice:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Auto-mark seen after viewing delay (1.5s) or on second view
  useEffect(() => {
    if (!isOpen || !application?.id || !reviewerUid) {
      hasTriggeredSeenRef.current = false;
      if (autoSeenTimerRef.current) {
        clearTimeout(autoSeenTimerRef.current);
      }
      return;
    }

    // Initialize notes from existing
    setDecisionNotes(application.reviewNotes || '');
    setActionError(null);

    // Track session view count in memory/sessionStorage
    const sessionKey = `app_view_${application.id}_${reviewerUid}`;
    const prevViews = parseInt(sessionStorage.getItem(sessionKey) || '0', 10);
    const newViews = prevViews + 1;
    sessionStorage.setItem(sessionKey, newViews.toString());

    const alreadyMarked = isSeenByCurrentReviewer(application);

    // If second view or more, mark immediately
    if (!alreadyMarked && newViews >= 2 && !hasTriggeredSeenRef.current) {
      hasTriggeredSeenRef.current = true;
      markAsSeenInternal(application);
      return;
    }

    // Otherwise trigger after 1.5 seconds viewing delay
    if (!alreadyMarked && !hasTriggeredSeenRef.current) {
      autoSeenTimerRef.current = setTimeout(() => {
        hasTriggeredSeenRef.current = true;
        markAsSeenInternal(application);
      }, 1500);
    }

    return () => {
      if (autoSeenTimerRef.current) {
        clearTimeout(autoSeenTimerRef.current);
      }
    };
  }, [isOpen, application?.id, reviewerUid]);

  if (!isOpen || !application) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDecision = async (newStatus: ApplicationStatus) => {
    if (!application.id || !currentUser || updating) return;
    setUpdating(true);
    setActionError(null);

    try {
      const reviewerObj = {
        uid: currentUser.uid,
        name: userProfile?.name || currentUser.displayName || 'Staff Reviewer',
        role: reviewerRole,
      };

      if (newStatus === 'Accepted') {
        await acceptApplication(application.id, reviewerObj, decisionNotes.trim());
      } else if (newStatus === 'Rejected') {
        await rejectApplication(application.id, reviewerObj, decisionNotes.trim());
      } else if (newStatus === 'Under Review') {
        await moveApplicationToReview(application.id, reviewerObj, decisionNotes.trim());
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Failed to update application status:', err);
      setActionError(err?.message || 'Could not update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const questionsList = QUESTIONS[application.category] || [];
  const canDecide = ['OWNER', 'ADMIN', 'MOD', 'STAFF'].includes(reviewerRole);

  const totalSeenCount = Array.isArray(application.seenBy)
    ? application.seenBy.length
    : application.seenBy && typeof application.seenBy === 'object'
    ? Object.keys(application.seenBy).length
    : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          className="bg-panel border border-secondary/40 rounded-[2.5rem] max-w-4xl w-full p-6 sm:p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto text-white space-y-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2.5 text-slate-400 hover:text-white bg-canvas hover:bg-slate-800 rounded-2xl border border-secondary/20 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-secondary/20 pb-6 pr-12">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-amber-500/10 border border-primary/30 flex items-center justify-center text-primary font-black text-2xl uppercase shadow-lg shadow-primary/10">
                {application.applicantName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                    ID: {application.id || 'N/A'}
                  </span>
                  <span
                    className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      application.status === 'Accepted'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : application.status === 'Rejected'
                        ? 'bg-red-950 text-red-400 border border-red-500/30'
                        : application.status === 'Under Review'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30'
                        : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {application.status}
                  </span>
                  {isSeen ? (
                    <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 uppercase">
                      <BookmarkCheck className="w-3 h-3" /> Seen by You
                    </span>
                  ) : (
                    <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 uppercase animate-pulse">
                      <Eye className="w-3 h-3" /> New Unseen
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                  {application.applicantName}
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {application.category} — {application.position || 'Staff Candidate'}
                </p>
              </div>
            </div>

            {/* Quick stats / metadata */}
            <div className="flex flex-wrap sm:flex-col gap-2 items-start sm:items-end">
              <span className="px-3.5 py-1.5 bg-canvas/80 border border-secondary/30 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {new Date(application.createdAt).toLocaleDateString()}
              </span>
              <span className="px-3.5 py-1 bg-canvas/60 border border-secondary/20 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {totalSeenCount} Reviewer{totalSeenCount === 1 ? '' : 's'} Viewed
              </span>
            </div>
          </div>

          {/* Prominent Application Status Messages */}
          {application.status === 'Rejected' && (
            <div className="p-4 bg-red-950/80 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-300 text-sm font-extrabold shadow-lg">
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>This application is rejected</span>
            </div>
          )}

          {application.status === 'Accepted' && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center gap-3 text-emerald-300 text-sm font-extrabold shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>This application was accepted</span>
            </div>
          )}

          {application.status === 'Under Review' && (
            <div className="p-4 bg-indigo-950/80 border border-indigo-500/50 rounded-2xl flex items-center gap-3 text-indigo-300 text-sm font-extrabold shadow-lg">
              <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>
                This application is under review by{' '}
                <strong className="text-white font-black">
                  {application.reviewedBy || application.reviewerRole || application.reviewerUid || 'Staff Reviewer'}
                </strong>
              </span>
            </div>
          )}

          {/* Error notification if action fails */}
          {actionError && (
            <div className="p-4 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-300 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Applicant Credentials Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-canvas/70 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Discord Handle</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{application.discordUsername || 'N/A'}</span>
                <button
                  onClick={() => handleCopy(application.discordUsername, 'discord')}
                  className="p-1 hover:text-primary transition-colors text-slate-500"
                  title="Copy Discord"
                >
                  {copiedField === 'discord' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-canvas/70 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Email Address</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 truncate max-w-[140px]">{application.applicantEmail || 'N/A'}</span>
                <button
                  onClick={() => handleCopy(application.applicantEmail, 'email')}
                  className="p-1 hover:text-primary transition-colors text-slate-500"
                  title="Copy Email"
                >
                  {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-canvas/70 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Timezone & Age</span>
              <p className="text-xs font-black text-white">
                {application.timezone || 'UTC'} • {application.age || 'N/A'} yrs
              </p>
            </div>

            <div className="bg-canvas/70 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Applicant UID</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400 truncate max-w-[120px]">{application.applicantUid}</span>
                <button
                  onClick={() => handleCopy(application.applicantUid, 'uid')}
                  className="p-1 hover:text-primary transition-colors text-slate-500"
                  title="Copy UID"
                >
                  {copiedField === 'uid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Full Application Questionnaire Responses */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Submitted Questionnaire Responses
              </h4>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {Object.keys(application.answers || {}).length} Total Answered
              </span>
            </div>

            <div className="space-y-3">
              {questionsList.length > 0 ? (
                questionsList.map((questionText, index) => {
                  const answer =
                    application.answers[index.toString()] ||
                    application.answers[questionText] ||
                    'No answer provided.';
                  return (
                    <div
                      key={index}
                      className="bg-canvas/50 p-5 rounded-2xl border border-secondary/15 hover:border-primary/20 transition-all space-y-2"
                    >
                      <div className="text-[10px] font-black text-primary uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center text-[10px] text-primary">
                          {index + 1}
                        </span>
                        <span>{questionText}</span>
                      </div>
                      <div className="text-xs text-slate-200 leading-relaxed font-medium pl-7 italic whitespace-pre-wrap">
                        "{answer}"
                      </div>
                    </div>
                  );
                })
              ) : (
                Object.entries(application.answers || {}).map(([key, val], idx) => (
                  <div key={key} className="bg-canvas/50 p-5 rounded-2xl border border-secondary/15 space-y-2">
                    <div className="text-[10px] font-black text-primary uppercase tracking-wider">
                      Question #{idx + 1} ({key})
                    </div>
                    <div className="text-xs text-slate-200 leading-relaxed font-medium italic whitespace-pre-wrap">
                      "{val}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Review History Section */}
          {(application.reviewerUid || application.reviewNotes || application.decisionAt) && (
            <div className="p-5 bg-indigo-950/20 border border-indigo-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Review History
                </h5>
                {application.decisionAt && (
                  <span className="text-[10px] text-slate-400 font-bold">
                    {new Date(application.decisionAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Reviewed By: </span>
                <span className="font-bold text-white">
                  {application.reviewerRole || 'Reviewer'} ({application.reviewerUid || 'System'})
                </span>
              </div>
              {application.reviewNotes && (
                <div className="p-3 bg-canvas/60 rounded-xl border border-secondary/20 text-xs text-slate-300 italic">
                  "{application.reviewNotes}"
                </div>
              )}
            </div>
          )}

          {/* Action Decision Panel - Strictly hidden for Rejected and Accepted applications */}
          {canDecide && (
            <div className="pt-6 border-t border-secondary/20 space-y-4">
              {application.status === 'Rejected' || application.status === 'Accepted' ? (
                <div className="p-4 bg-canvas/60 border border-secondary/20 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span>
                      This application has been finalized as{' '}
                      <strong className={application.status === 'Accepted' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {application.status}
                      </strong>
                      . Decision actions are locked for audit integrity.
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-panel text-slate-400 border border-secondary/30">
                    Read-Only
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Reviewer Decision Notes (Saved with Status)
                    </label>
                    <textarea
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Enter decision rationale or internal reviewer feedback..."
                      rows={2}
                      className="w-full bg-canvas border border-secondary/30 rounded-2xl p-4 text-xs text-white outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!isSeen && (
                      <button
                        onClick={() => markAsSeenInternal(application)}
                        disabled={updating}
                        className="py-3 px-5 bg-canvas hover:bg-slate-800 border border-secondary/30 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Eye className="w-4 h-4 text-cyan-400" />
                        <span>{updating ? 'Updating...' : 'Mark as Seen'}</span>
                      </button>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDecision('Under Review')}
                      disabled={updating}
                      className="flex-1 py-3 px-4 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Set Under Review</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDecision('Accepted')}
                      disabled={updating}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Accept Application</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDecision('Rejected')}
                      disabled={updating}
                      className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Application</span>
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
