import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserReport, AuditLogEntry, UserProfile } from '../types';
import {
  BarChart3,
  Award,
  TrendingUp,
  CheckCircle2,
  Shield,
  Users,
  Calendar,
  Sparkles,
  Search,
  ChevronRight,
  Flame,
  LayoutGrid,
  AlignLeft,
  Info,
  Clock,
  Filter,
} from 'lucide-react';

interface StaffResolutionStats {
  uid: string;
  name: string;
  role: string;
  photoURL?: string;
  resolvedCount: number;
  percentage: number;
  recentReportSubjects: string[];
  lastResolvedAt?: string;
}

interface TopStaffResolutionChartWidgetProps {
  reports: UserReport[];
  auditLogs?: AuditLogEntry[];
  users?: UserProfile[];
  currentUserId?: string;
}

export const TopStaffResolutionChartWidget: React.FC<TopStaffResolutionChartWidgetProps> = ({
  reports,
  auditLogs = [],
  users = [],
  currentUserId,
}) => {
  const [viewMode, setViewMode] = useState<'columns' | 'bars'>('columns');
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffResolutionStats | null>(null);

  // Filter reports by selected timeframe
  const filteredReports = useMemo(() => {
    const now = new Date().getTime();
    return reports.filter((r) => {
      if (timeRange === 'all') return true;
      const reportTime = new Date(r.updatedAt || r.createdAt).getTime();
      const diffDays = (now - reportTime) / (1000 * 3600 * 24);
      if (timeRange === 'week') return diffDays <= 7;
      if (timeRange === 'month') return diffDays <= 30;
      return true;
    });
  }, [reports, timeRange]);

  // Compile resolution statistics by staff member
  const { staffStats, totalResolved, totalReportsCount, resolutionRate } = useMemo(() => {
    const resolvedReports = filteredReports.filter((r) => r.status === 'Resolved');
    const totalResolved = resolvedReports.length;
    const totalReportsCount = filteredReports.length;
    const resolutionRate = totalReportsCount > 0 ? Math.round((totalResolved / totalReportsCount) * 100) : 0;

    // Map: staff key -> stats
    const statsMap: Record<string, StaffResolutionStats> = {};

    // Helper to find profile info
    const findUserProfile = (identifier: string) => {
      return users.find(
        (u) =>
          u.uid === identifier ||
          u.name.toLowerCase() === identifier.toLowerCase() ||
          u.email.toLowerCase() === identifier.toLowerCase()
      );
    };

    // 1. Process directly resolved reports
    resolvedReports.forEach((r) => {
      // Find resolver from report properties
      const resolverUid = r.resolvedByUid || r.assignedToUid || '';
      let resolverName = r.resolvedByName || r.assignedToName || '';
      let resolverRole = r.resolvedByRole || '';

      // If missing name/uid, cross-reference audit logs for this report
      if (!resolverName && r.id) {
        const matchingLog = auditLogs.find(
          (log) =>
            log.targetUid === r.id &&
            (log.action.includes('RESOLVED') || log.action.includes('RESOLVE') || log.action.includes('REPORT_UPDATED'))
        );
        if (matchingLog) {
          resolverName = matchingLog.actorName || 'Staff Member';
          resolverRole = matchingLog.actorRole || 'STAFF';
        }
      }

      // Fallback if still unassigned
      if (!resolverName && !resolverUid) {
        resolverName = 'Staff Operations Team';
        resolverRole = 'STAFF';
      }

      const key = resolverUid || resolverName.toLowerCase();
      const profile = findUserProfile(resolverUid || resolverName);

      if (!statsMap[key]) {
        statsMap[key] = {
          uid: resolverUid || key,
          name: profile?.name || resolverName || 'Staff Resolver',
          role: profile?.role || resolverRole || 'STAFF',
          photoURL: profile?.photoURL,
          resolvedCount: 0,
          percentage: 0,
          recentReportSubjects: [],
          lastResolvedAt: r.updatedAt || r.createdAt,
        };
      }

      statsMap[key].resolvedCount += 1;
      if (r.subject && statsMap[key].recentReportSubjects.length < 3) {
        statsMap[key].recentReportSubjects.push(r.subject);
      }
      if (r.updatedAt && (!statsMap[key].lastResolvedAt || new Date(r.updatedAt) > new Date(statsMap[key].lastResolvedAt!))) {
        statsMap[key].lastResolvedAt = r.updatedAt;
      }
    });

    // 2. Also check audit logs for any resolution logs that might not have updated report fields
    auditLogs.forEach((log) => {
      if (log.action.includes('REPORT_UPDATED_RESOLVED') || log.action === 'REPORT_RESOLVED') {
        const actorUid = log.actorUid || '';
        const actorName = log.actorName || 'Staff Member';
        const key = actorUid || actorName.toLowerCase();

        // If not already counted via reports, or ensure actor profile is registered
        if (!statsMap[key]) {
          const profile = findUserProfile(actorUid || actorName);
          statsMap[key] = {
            uid: actorUid || key,
            name: profile?.name || actorName,
            role: profile?.role || log.actorRole || 'STAFF',
            photoURL: profile?.photoURL,
            resolvedCount: 1,
            percentage: 0,
            recentReportSubjects: [],
            lastResolvedAt: log.timestamp,
          };
        }
      }
    });

    // Calculate percentages and sort descending
    const list = Object.values(statsMap).map((item) => ({
      ...item,
      percentage: totalResolved > 0 ? Math.round((item.resolvedCount / totalResolved) * 100) : 0,
    }));

    list.sort((a, b) => b.resolvedCount - a.resolvedCount);

    return {
      staffStats: list,
      totalResolved,
      totalReportsCount,
      resolutionRate,
    };
  }, [filteredReports, auditLogs, users]);

  // Filtered by search query
  const displayedStaff = useMemo(() => {
    return staffStats.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staffStats, searchQuery]);

  // Max resolution count for scaling chart bars
  const maxResolutions = useMemo(() => {
    const max = Math.max(...displayedStaff.map((s) => s.resolvedCount), 1);
    return Math.max(max, 5); // Minimum scale ceiling of 5
  }, [displayedStaff]);

  // Top Resolver (MVP)
  const topResolver = staffStats.length > 0 ? staffStats[0] : null;

  // Color gradient palette for bars based on ranking
  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return {
          from: 'from-amber-400',
          to: 'to-amber-500',
          bg: 'bg-amber-400',
          border: 'border-amber-400/50',
          text: 'text-amber-300',
          badge: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
        };
      case 1:
        return {
          from: 'from-cyan-400',
          to: 'to-blue-500',
          bg: 'bg-cyan-400',
          border: 'border-cyan-400/50',
          text: 'text-cyan-300',
          badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
        };
      case 2:
        return {
          from: 'from-emerald-400',
          to: 'to-teal-500',
          bg: 'bg-emerald-400',
          border: 'border-emerald-400/50',
          text: 'text-emerald-300',
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
        };
      default:
        return {
          from: 'from-purple-500',
          to: 'to-indigo-600',
          bg: 'bg-purple-500',
          border: 'border-purple-500/40',
          text: 'text-purple-300',
          badge: 'bg-purple-950/80 text-purple-300 border-purple-500/30',
        };
    }
  };

  return (
    <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6 text-white font-sans relative overflow-hidden">
      {/* Background Decorative Accent */}
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <BarChart3 className="w-64 h-64 text-cyan-400" />
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-secondary/20 pb-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400">
              <Award className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
              Resolution Analytics & Staff Leaderboard
            </span>
          </div>
          <h3 className="text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2.5">
            <span>Top Active Staff</span>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-canvas text-slate-300 border border-secondary/30 lowercase not-italic">
              by report resolutions
            </span>
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Comparative data chart tracking dispute closures and report resolution volume across the staff team.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Selector */}
          <div className="flex items-center bg-canvas/80 p-1 rounded-xl border border-secondary/30">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'month', label: '30 Days' },
                { id: 'week', label: '7 Days' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  timeRange === t.id
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Chart Display Mode Toggle */}
          <div className="flex items-center bg-canvas/80 p-1 rounded-xl border border-secondary/30">
            <button
              onClick={() => setViewMode('columns')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'columns'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Column Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('bars')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'bars'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Horizontal Leaderboard"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
        <div className="bg-canvas/50 border border-secondary/20 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Total Resolved
          </div>
          <div className="text-2xl font-black text-emerald-400">{totalResolved}</div>
          <div className="text-[10px] text-slate-500 font-mono">Closed disciplinary tickets</div>
        </div>

        <div className="bg-canvas/50 border border-secondary/20 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-cyan-400" /> Resolution Rate
          </div>
          <div className="text-2xl font-black text-cyan-400">{resolutionRate}%</div>
          <div className="text-[10px] text-slate-500 font-mono">Of all submitted reports</div>
        </div>

        <div className="bg-canvas/50 border border-secondary/20 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Users className="w-3 h-3 text-purple-400" /> Active Staff
          </div>
          <div className="text-2xl font-black text-purple-400">{staffStats.length}</div>
          <div className="text-[10px] text-slate-500 font-mono">Resolving members</div>
        </div>

        <div className="bg-canvas/50 border border-secondary/20 p-4 rounded-2xl space-y-1 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-amber-400" /> Top Performer
          </div>
          <div className="text-base font-black text-amber-300 truncate">
            {topResolver ? topResolver.name : 'None yet'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {topResolver ? `${topResolver.resolvedCount} resolutions` : 'No tickets closed'}
          </div>
        </div>
      </div>

      {/* Search Input Filter */}
      {staffStats.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff resolver by name or role..."
            className="w-full bg-canvas/70 border border-secondary/30 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400/60"
          />
        </div>
      )}

      {/* Main Chart Presentation Area */}
      {displayedStaff.length === 0 ? (
        <div className="bg-canvas/40 border border-secondary/20 rounded-3xl p-12 text-center space-y-3">
          <Shield className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="text-sm font-black text-white uppercase tracking-wider">No Report Resolutions Found</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No staff member matching "${searchQuery}".`
              : 'When staff or moderators resolve user reports from the Reports tab, their resolution throughput and comparative data chart will appear here in real time.'}
          </p>
        </div>
      ) : viewMode === 'columns' ? (
        /* View 1: Vertical Column Bar Chart */
        <div className="space-y-4">
          <div className="bg-canvas/40 border border-secondary/20 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-secondary/15 pb-3">
              <span>Resolutions (Closed Reports)</span>
              <span>Ceiling: {maxResolutions} tickets</span>
            </div>

            {/* Visual Column Grid */}
            <div className="pt-8 pb-4 flex items-end justify-around gap-2 sm:gap-6 min-h-[260px] overflow-x-auto pr-2">
              {displayedStaff.slice(0, 8).map((staff, idx) => {
                const colors = getRankColor(idx);
                const heightPercent = Math.max(Math.round((staff.resolvedCount / maxResolutions) * 100), 12);
                const isSelected = selectedStaff?.uid === staff.uid;

                return (
                  <div
                    key={staff.uid}
                    onClick={() => setSelectedStaff(isSelected ? null : staff)}
                    className="flex-1 flex flex-col items-center gap-3 cursor-pointer group min-w-[65px] sm:min-w-[80px]"
                  >
                    {/* Top Data Pill (Hover or Selected) */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-center px-2 py-1 rounded-lg text-[10px] font-mono font-black border transition-all ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-lg'
                          : `${colors.badge}`
                      }`}
                    >
                      {staff.resolvedCount} <span className="opacity-70 text-[8px]">({staff.percentage}%)</span>
                    </motion.div>

                    {/* Animated Bar Column */}
                    <div className="w-full max-w-[48px] h-44 flex items-end justify-center rounded-2xl p-1 bg-panel/60 border border-secondary/10 group-hover:border-cyan-400/40 transition-all">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent}%` }}
                        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: idx * 0.05 }}
                        className={`w-full rounded-xl bg-gradient-to-t ${colors.from} ${colors.to} shadow-lg relative overflow-hidden group-hover:brightness-110 transition-all`}
                      >
                        {/* Shimmer light effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    </div>

                    {/* Staff Badge & Label */}
                    <div className="text-center space-y-1 w-full">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                            idx === 0
                              ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-cyan-400 text-black'
                              : idx === 2
                              ? 'bg-emerald-400 text-black'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="text-xs font-black text-white truncate max-w-[85px] group-hover:text-cyan-300 transition-colors">
                        {staff.name}
                      </div>

                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-panel text-slate-400 uppercase tracking-widest border border-secondary/20 block truncate">
                        {staff.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* View 2: Horizontal Leaderboard Breakdown */
        <div className="space-y-3">
          {displayedStaff.map((staff, idx) => {
            const colors = getRankColor(idx);
            const isSelected = selectedStaff?.uid === staff.uid;

            return (
              <div
                key={staff.uid}
                onClick={() => setSelectedStaff(isSelected ? null : staff)}
                className={`p-4 bg-canvas/40 hover:bg-canvas/70 border rounded-2xl transition-all cursor-pointer space-y-2.5 ${
                  isSelected ? 'border-cyan-400 bg-canvas/90 shadow-xl' : 'border-secondary/20 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                          : idx === 1
                          ? 'bg-cyan-400 text-black'
                          : idx === 2
                          ? 'bg-emerald-400 text-black'
                          : 'bg-panel text-slate-400 border border-secondary/30'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white truncate">{staff.name}</span>
                        {staff.uid === currentUserId && (
                          <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-400/30 uppercase">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">{staff.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-black text-white">{staff.resolvedCount}</span>
                      <span className="text-[10px] text-slate-400 ml-1 font-mono">resolved</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${colors.badge}`}>
                      {staff.percentage}%
                    </span>
                  </div>
                </div>

                {/* Horizontal Progress Fill */}
                <div className="w-full h-2 rounded-full bg-panel overflow-hidden border border-secondary/15">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(staff.resolvedCount / maxResolutions) * 100}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100, delay: idx * 0.04 }}
                    className={`h-full rounded-full bg-gradient-to-r ${colors.from} ${colors.to}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Inspection Drawer / Selection Panel */}
      <AnimatePresence>
        {selectedStaff && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-5 bg-panel border border-cyan-500/40 rounded-2xl space-y-3 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-secondary/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-sm text-white">
                  {selectedStaff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase">{selectedStaff.name}</h4>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">{selectedStaff.role}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-canvas rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-canvas/60 rounded-xl border border-secondary/20 space-y-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Resolved Tickets</span>
                <span className="text-lg font-black text-emerald-400">{selectedStaff.resolvedCount}</span>
              </div>
              <div className="p-3 bg-canvas/60 rounded-xl border border-secondary/20 space-y-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Team Share</span>
                <span className="text-lg font-black text-cyan-400">{selectedStaff.percentage}%</span>
              </div>
              <div className="p-3 bg-canvas/60 rounded-xl border border-secondary/20 space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Last Resolution</span>
                <span className="text-xs font-mono font-bold text-white">
                  {selectedStaff.lastResolvedAt
                    ? new Date(selectedStaff.lastResolvedAt).toLocaleDateString()
                    : 'Recorded in log'}
                </span>
              </div>
            </div>

            {selectedStaff.recentReportSubjects.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Recent Closed Incident Subjects:
                </span>
                <div className="space-y-1">
                  {selectedStaff.recentReportSubjects.map((sub, i) => (
                    <div key={i} className="text-xs text-slate-300 italic flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span className="truncate">"{sub}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
