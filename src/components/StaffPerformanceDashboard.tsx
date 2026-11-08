import React, { useMemo } from 'react';
import { StaffApplication, UserReport, AuditLogEntry } from '../types';
import {
  Award,
  TrendingUp,
  CheckCircle2,
  Clock,
  Shield,
  Zap,
  BarChart2,
  Users,
  Flame,
  Activity,
  FileCheck
} from 'lucide-react';

interface StaffPerformanceDashboardProps {
  applications: StaffApplication[];
  reports: UserReport[];
  auditLogs: AuditLogEntry[];
  currentUserName: string;
  currentRole: string;
}

export const StaffPerformanceDashboard: React.FC<StaffPerformanceDashboardProps> = ({
  applications,
  reports,
  auditLogs,
  currentUserName,
  currentRole,
}) => {
  // Calculate performance metrics based on audit logs and applications/reports
  const metrics = useMemo(() => {
    let myActionsCount = 0;
    let resolvedReportsCount = 0;
    let reviewedAppsCount = 0;

    const staffActivityMap: Record<string, { name: string; role: string; count: number }> = {};

    auditLogs.forEach((log) => {
      const actor = log.actorName || 'Unknown Staff';
      if (!staffActivityMap[log.actorUid]) {
        staffActivityMap[log.actorUid] = {
          name: actor,
          role: log.actorRole || 'STAFF',
          count: 0,
        };
      }
      staffActivityMap[log.actorUid].count += 1;

      if (log.actorName?.toLowerCase() === currentUserName.toLowerCase()) {
        myActionsCount++;
      }
    });

    reports.forEach((r) => {
      if (r.status === 'Resolved') {
        resolvedReportsCount++;
      }
    });

    applications.forEach((a) => {
      if (a.status === 'Accepted' || a.status === 'Rejected' || a.status === 'Under Review') {
        reviewedAppsCount++;
      }
    });

    const leaderboard = Object.values(staffActivityMap).sort((a, b) => b.count - a.count);

    return {
      myActionsCount,
      resolvedReportsCount,
      reviewedAppsCount,
      leaderboard,
      totalTeamActions: auditLogs.length,
    };
  }, [applications, reports, auditLogs, currentUserName]);

  return (
    <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-8 font-sans text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase tracking-widest">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Moderator & Team Engagement Hub</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mt-1">Staff Performance & Participation</h2>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 bg-canvas/80 border border-secondary/30 rounded-2xl text-xs font-black text-slate-300">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Active Role: <span className="text-amber-400 uppercase">{currentRole}</span></span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg hover:border-amber-400/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> My Actions
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 uppercase">
              Logged
            </span>
          </div>
          <div className="text-3xl font-black text-white">{metrics.myActionsCount}</div>
          <div className="text-[10px] text-slate-500 font-mono">Total audit actions performed</div>
        </div>

        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg hover:border-cyan-400/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-cyan-400" /> Apps Reviewed
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 uppercase">
              Queue
            </span>
          </div>
          <div className="text-3xl font-black text-cyan-400">{metrics.reviewedAppsCount}</div>
          <div className="text-[10px] text-slate-500 font-mono">Applications processed</div>
        </div>

        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg hover:border-emerald-400/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Reports Resolved
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 uppercase">
              Closed
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400">{metrics.resolvedReportsCount}</div>
          <div className="text-[10px] text-slate-500 font-mono">Disciplinary tickets closed</div>
        </div>

        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg hover:border-purple-400/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> Team Velocity
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 uppercase">
              Total
            </span>
          </div>
          <div className="text-3xl font-black text-purple-400">{metrics.totalTeamActions}</div>
          <div className="text-[10px] text-slate-500 font-mono">Team-wide audit logs recorded</div>
        </div>
      </div>

      {/* Staff Participation Leaderboard */}
      <div className="bg-canvas/40 border border-secondary/20 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Staff Participation & Activity Leaderboard</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Real-time telemetry</span>
        </div>

        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {metrics.leaderboard.length === 0 ? (
            <div className="text-center py-8 text-xs font-bold text-slate-500 uppercase">No staff activity recorded yet</div>
          ) : (
            metrics.leaderboard.map((staff, idx) => (
              <div key={idx} className="p-4 bg-panel/80 rounded-2xl border border-secondary/15 flex items-center justify-between text-xs hover:border-amber-400/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl font-black flex items-center justify-center text-xs ${idx === 0 ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-canvas text-slate-400 border border-secondary/20'}`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <span className="font-extrabold text-white block">{staff.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{staff.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-xl">
                    {staff.count} actions
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
