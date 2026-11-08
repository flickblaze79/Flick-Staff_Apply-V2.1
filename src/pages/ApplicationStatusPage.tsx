import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApplications } from '../lib/storage';
import { StaffApplication, QUESTIONS } from '../types';
import { checkAndProcessAutoRejections } from '../lib/autoReject';
import { ClipboardList, Clock, CheckCircle2, XCircle, Search, ShieldCheck, FileText } from 'lucide-react';

interface ApplicationStatusPageProps {
  onNavigate: (page: string) => void;
  onOpenAuth: () => void;
}

export const ApplicationStatusPage: React.FC<ApplicationStatusPageProps> = ({ onNavigate, onOpenAuth }) => {
  const { currentUser } = useAuth();
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserApplications() {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      try {
        // Run auto-rejection check for any expired applications
        await checkAndProcessAutoRejections();

        const { fetchApplicationsFromFirestore } = await import('../lib/storage');
        const allApps = await fetchApplicationsFromFirestore();
        const userApps = allApps.filter((a) => a.applicantUid === currentUser.uid);
        // Sort by newest first
        userApps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setApplications(userApps);
      } catch (err) {
        console.error('Error fetching application status:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUserApplications();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6 bg-panel border border-secondary/30 rounded-3xl p-8 mt-10 shadow-2xl text-white">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase">Sign In Required</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          Please sign in to view your application tracking dashboard and review decision notes.
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center text-slate-300 font-bold text-sm">
        Loading your application history...
      </div>
    );
  }

  const getStatusBadge = (app: StaffApplication) => {
    switch (app.status) {
      case 'Accepted':
        return (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 text-xs font-black uppercase tracking-wider shadow-md">
            <CheckCircle2 className="w-4 h-4" />
            <span>Accepted</span>
          </div>
        );
      case 'Rejected':
        return (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-950/80 border border-red-600/80 text-red-300 text-xs font-black uppercase tracking-wider shadow-md">
            <XCircle className="w-4 h-4" />
            <span>Rejected {app.autoRejected ? '(48h Auto)' : ''}</span>
          </div>
        );
      case 'Under Review':
        return (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/80 text-indigo-300 text-xs font-black uppercase tracking-wider shadow-md">
            <Search className="w-4 h-4" />
            <span>Under Review</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-950/80 border border-amber-600/80 text-amber-300 text-xs font-black uppercase tracking-wider shadow-md">
            <Clock className="w-4 h-4" />
            <span>Pending</span>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 text-white">
      <div className="space-y-2 border-b border-secondary/20 pb-6">
        <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">
          Your Application Status
        </span>
        <h1 className="text-3xl font-black text-white uppercase tracking-tight">
          Application Tracking Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 font-medium">
          View real-time evaluation status, decision notes, and submission details for your staff applications.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-canvas border border-secondary/30 flex items-center justify-center text-cyan-400">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white uppercase">No Applications Found</h3>
          <p className="text-xs text-slate-300 max-w-sm mx-auto">
            You have not submitted any staff applications yet. Click below to start your application today.
          </p>
          <button
            onClick={() => onNavigate('apply')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/30 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Apply Now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-4">
                <div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Application ID: <span className="text-cyan-300 font-bold">{app.id}</span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-1 uppercase">
                    Category: <span className="text-cyan-400">{app.category}</span>
                  </h3>
                </div>
                <div>{getStatusBadge(app)}</div>
              </div>

              {/* Decision / Review Notes Banner */}
              {app.reviewNotes && (
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1 ${
                  app.status === 'Accepted'
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                    : app.status === 'Rejected'
                    ? 'bg-red-950/60 border-red-700/60 text-red-200'
                    : 'bg-indigo-950/60 border-indigo-700/60 text-indigo-200'
                }`}>
                  <div className="font-black uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Reviewer Feedback ({app.reviewerRole || 'Staff'})</span>
                  </div>
                  <p className="font-medium">{app.reviewNotes}</p>
                  {app.decisionAt && (
                    <span className="text-[10px] text-slate-400 block pt-1 font-mono">
                      Decision Timestamp: {new Date(app.decisionAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Answers Inspection */}
              <div className="space-y-3 text-xs">
                <div className="font-black text-cyan-300 uppercase tracking-wider text-[11px]">
                  Submitted Answers ({new Date(app.createdAt).toLocaleDateString()})
                </div>
                {(QUESTIONS[app.category] || []).map((q, i) => (
                  <div key={i} className="bg-canvas/80 p-4 rounded-2xl border border-secondary/20 space-y-1">
                    <span className="font-bold text-cyan-400 block uppercase text-[10px]">
                      Q{i + 1}. {q}
                    </span>
                    <p className="text-slate-200 leading-relaxed font-medium">
                      {app.answers[i.toString()] || 'No answer provided.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
