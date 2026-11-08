import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { logAuditEvent } from '../../lib/auditLogger';
import { deduplicateApplications } from '../../lib/applicationUtils';
import {
  getApplications,
  getReports,
  fetchReports,
  fetchApplicationsFromFirestore,
  updateApplication,
  updateReport,
  toggleSaveReport,
  deleteReport,
  fetchGlobalStats,
  fetchAuditLogsFromFirestore,
  fetchUsersFromFirestore,
} from '../../lib/storage';
import { StaffApplication, UserReport, QUESTIONS, AuditLogEntry, UserProfile } from '../../types';
import { checkAndProcessAutoRejections } from '../../lib/autoReject';
import { ReportMediaPreview } from '../../components/ReportMediaPreview';
import { StaffTasksPanel } from '../../components/StaffTasksPanel';
import { ApplicationDetailModal } from '../../components/ApplicationDetailModal';
import { TopStaffResolutionChartWidget } from '../../components/TopStaffResolutionChartWidget';
import {
  Shield,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Megaphone,
  CheckSquare,
  Eye,
  BarChart3,
  ClipboardList,
  FileText,
  Activity,
  CheckCircle2,
  Bookmark,
  Trash2,
  Loader2,
  AlertTriangle,
  Edit3,
  XCircle,
} from 'lucide-react';
import { getSystemPanels, updateSystemPanel, resetSystemPanelToDefault } from '../../lib/panelService';
import { SystemPanelConfig, DEFAULT_SYSTEM_PANELS } from '../../lib/storage';
import { PanelFeature } from '../../types';

export const StaffPanel: React.FC = () => {
  const { currentUser, userProfile, isStaff } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'applications' | 'tasks'>('dashboard');
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    pendingApps: 0,
    openReports: 0,
  });

  // Selected Application state
  const [selectedApp, setSelectedApp] = useState<StaffApplication | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<UserReport | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);

  // Filters for Applications
  const [appSearch, setAppSearch] = useState('');
  const [appCategoryFilter, setAppCategoryFilter] = useState<string>('All');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('All');

  // Filters for Reports
  const [reportFilter, setReportFilter] = useState<string>('All');
  const [reportSearch, setReportSearch] = useState('');

  // System Panel Configuration State
  const [systemConfig, setSystemConfig] = useState<SystemPanelConfig>(DEFAULT_SYSTEM_PANELS.staff);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [cfgName, setCfgName] = useState('');
  const [cfgDesc, setCfgDesc] = useState('');
  const [cfgColor, setCfgColor] = useState('#06b6d4');
  const [cfgEmoji, setCfgEmoji] = useState('🛡️');
  const [cfgFeatures, setCfgFeatures] = useState<PanelFeature[]>([]);
  const [savingCfg, setSavingCfg] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      await checkAndProcessAutoRejections();

      const [aListRaw, rList, liveStats, sysPanels, logs, uList] = await Promise.all([
        fetchApplicationsFromFirestore(),
        fetchReports(),
        fetchGlobalStats(),
        getSystemPanels(),
        fetchAuditLogsFromFirestore(),
        fetchUsersFromFirestore(),
      ]);

      const uniqueApps = deduplicateApplications(aListRaw);
      setApplications(uniqueApps);

      rList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(rList);
      setAuditLogs(logs);
      setUsers(uList);

      setStats({
        pendingApps: liveStats.pendingApps,
        openReports: liveStats.openReports,
      });
      if (sysPanels.staff) setSystemConfig(sysPanels.staff);
    } catch (err) {
      console.error('Error loading data for Staff Panel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      await updateSystemPanel('staff', {
        name: cfgName.trim(),
        description: cfgDesc.trim(),
        color: cfgColor,
        emoji: cfgEmoji,
        features: cfgFeatures,
      });
      const updated = await getSystemPanels();
      if (updated.staff) setSystemConfig(updated.staff);
      setIsConfigModalOpen(false);
      alert('Staff Panel configuration updated successfully.');
    } catch (err: any) {
      alert(err?.message || 'Failed to update configuration.');
    } finally {
      setSavingCfg(false);
    }
  };

  const handleToggleSave = async (e: React.MouseEvent, report: UserReport) => {
    e.stopPropagation();
    if (!currentUser || !report.id || savingReportId === report.id) return;
    setSavingReportId(report.id);
    try {
      const res = await toggleSaveReport(report.id, currentUser.uid);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? (res.updatedReport || r) : r))
      );
      if (selectedReport?.id === report.id && res.updatedReport) {
        setSelectedReport(res.updatedReport);
      }
    } catch (err: any) {
      console.error('Failed to toggle save report:', err);
      alert('Could not update saved status: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingReportId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete || !reportToDelete.id || !currentUser || deletingReportId) return;
    const targetId = reportToDelete.id;
    setDeletingReportId(targetId);
    setDeleteError(null);
    try {
      await deleteReport(targetId, {
        uid: currentUser.uid,
        name: userProfile?.name || currentUser.displayName || 'Staff Member',
        email: currentUser.email || '',
        role: userProfile?.role || 'STAFF',
      });
      setReports((prev) => prev.filter((r) => r.id !== targetId));
      if (selectedReport?.id === targetId) {
        setSelectedReport(null);
      }
      setReportToDelete(null);
    } catch (err: any) {
      console.error('Delete report error:', err);
      setDeleteError(err?.message || 'Failed to delete report. Please try again.');
    } finally {
      setDeletingReportId(null);
    }
  };

  useEffect(() => {
    if (isStaff) {
      loadData();
    }
  }, [isStaff]);

  // Pagination State
  const [appPage, setAppPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Rule: Dynamic filtering based on search, category and status
  const activeApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.applicantName.toLowerCase().includes(appSearch.toLowerCase()) ||
        (app.discordUsername && app.discordUsername.toLowerCase().includes(appSearch.toLowerCase())) ||
        (app.id && app.id.toLowerCase().includes(appSearch.toLowerCase()));
      
      const matchesCategory = appCategoryFilter === 'All' || app.category === appCategoryFilter;
      
      let matchesStatus = true;
      if (appStatusFilter === 'All') {
        matchesStatus = app.status === 'Pending' || app.status === 'Under Review';
      } else if (appStatusFilter === 'New') {
        const isSeen = Array.isArray(app.seenBy)
          ? app.seenBy.includes(currentUser?.uid || '')
          : !!(app.seenBy && (app.seenBy as any)[currentUser?.uid || '']);
        matchesStatus = !isSeen && (app.status === 'Pending' || app.status === 'Under Review');
      } else if (appStatusFilter === 'Seen') {
        const isSeen = Array.isArray(app.seenBy)
          ? app.seenBy.includes(currentUser?.uid || '')
          : !!(app.seenBy && (app.seenBy as any)[currentUser?.uid || '']);
        matchesStatus = isSeen && (app.status === 'Pending' || app.status === 'Under Review');
      } else if (appStatusFilter === 'Archive') {
        matchesStatus = app.status === 'Accepted' || app.status === 'Rejected';
      } else {
        matchesStatus = app.status === appStatusFilter;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [applications, appSearch, appCategoryFilter, appStatusFilter, currentUser]);

  // Report Filters
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const matchesSearch =
        rep.subject.toLowerCase().includes(reportSearch.toLowerCase()) ||
        (rep.id && rep.id.toLowerCase().includes(reportSearch.toLowerCase()));

      if (reportFilter === 'Saved') return matchesSearch && !!currentUser && Array.isArray(rep.savedBy) && rep.savedBy.includes(currentUser.uid);
      if (reportFilter === 'Video') return matchesSearch && !!rep.videoLink;
      if (reportFilter === 'Photo') return matchesSearch && !!rep.evidenceUrl;
      if (reportFilter === 'Basic') return matchesSearch && !rep.videoLink && !rep.evidenceUrl;
      
      return matchesSearch;
    });
  }, [reports, reportSearch, reportFilter, currentUser]);

  const totalAppPages = Math.ceil(activeApplications.length / ITEMS_PER_PAGE) || 1;
  const totalReportPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1;

  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * ITEMS_PER_PAGE;
    return activeApplications.slice(start, start + ITEMS_PER_PAGE);
  }, [activeApplications, appPage]);

  const paginatedReports = useMemo(() => {
    const start = (reportPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, reportPage]);


  if (!isStaff) {
    return (
      <div className="max-w-md mx-auto py-20 text-center text-red-300 font-bold text-sm bg-panel border border-red-900/50 rounded-2xl p-8 mt-10 shadow-2xl">
        Access Denied: You do not have Staff permissions to view this panel.
      </div>
    );
  }

  const handleRecommendStatus = async (newStatus: 'Under Review') => {
    if (!selectedApp || !selectedApp.id || !currentUser || submittingNote) return;
    setSubmittingNote(true);
    try {
      const updates = {
        status: newStatus,
        reviewerUid: currentUser.uid,
        reviewerRole: userProfile?.role || 'STAFF',
        reviewNotes: reviewNote.trim() || selectedApp.reviewNotes || '',
        updatedAt: new Date().toISOString(),
      };

      await updateApplication(selectedApp.id, updates);

      await logAuditEvent({
        action: 'STAFF_RECOMMENDATION_ADDED',
        actorUid: currentUser.uid,
        actorName: userProfile?.name || 'Staff Member',
        actorEmail: currentUser.email || '',
        actorRole: userProfile?.role || 'STAFF',
        targetResource: 'applications',
        targetUid: selectedApp.id,
        metadata: { position: selectedApp.position, reviewNotes: reviewNote },
      });

      await loadData();
      alert(`Recommendation saved.`);
      setReviewNote('');
      setSelectedApp(null);
    } catch (err: any) {
      alert('Failed to update application.');
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-8 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-secondary/20 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest" style={{ color: systemConfig.color || '#06b6d4' }}>
            <span className="text-xl">{systemConfig.emoji || '🛡️'}</span>
            <span>{systemConfig.name} — Flick Staff Apply V2.1</span>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-2 flex items-center gap-3">
            <span>{systemConfig.name}</span>
            <button
              onClick={() => {
                setCfgName(systemConfig.name);
                setCfgDesc(systemConfig.description);
                setCfgColor(systemConfig.color);
                setCfgEmoji(systemConfig.emoji);
                setCfgFeatures(systemConfig.features);
                setIsConfigModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-canvas hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Configure Panel</span>
            </button>
          </h1>
          <p className="text-xs text-slate-300 font-medium">{systemConfig.description}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-2 bg-panel p-1.5 rounded-2xl border border-secondary/30">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'dashboard' ? 'bg-primary text-white shadow-lg' : 'text-slate-300 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'reports' ? 'bg-primary text-white shadow-lg' : 'text-slate-300 hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'applications' ? 'bg-primary text-white shadow-lg' : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Applications</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'tasks' ? 'bg-primary text-white shadow-lg' : 'text-slate-300 hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Tasks</span>
          </button>
        </nav>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2 shadow-xl">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Open Reports</span>
                   <div className="text-4xl font-black text-amber-300">{stats.openReports}</div>
                </div>
                <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2 shadow-xl">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Active Applications</span>
                   <div className="text-4xl font-black text-cyan-400">{stats.pendingApps}</div>
                </div>
             </div>

             <div className="bg-panel border border-secondary/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Shield className="w-32 h-32" /></div>
                <Megaphone className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Staff Noticeboard</h3>
                <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                   Welcome to the V2 Operations Hub. Please ensure all investigation notes are detailed and objective. Your primary duty is to filter applications for senior management review.
                </p>
             </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
           <motion.div key="reps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex items-center gap-4">
                  <select
                    value={reportFilter}
                    onChange={(e) => setReportFilter(e.target.value)}
                    className="bg-canvas border border-secondary/30 rounded-xl px-4 py-2 text-xs font-black text-white outline-none cursor-pointer appearance-none pr-10"
                  >
                    <option value="All">All Reports</option>
                    <option value="Saved">Saved Reports</option>
                    <option value="Basic">Basic Reports</option>
                    <option value="Video">Video Reports</option>
                    <option value="Photo">Photo Reports</option>
                  </select>
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      placeholder="Search reports..."
                      className="w-full bg-canvas border border-secondary/30 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-white outline-none focus:border-primary"
                    />
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 {filteredReports.length === 0 ? (
                    <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-500 font-bold uppercase text-xs">
                       {reportFilter === 'Saved' ? 'No saved reports for later.' : 'No reports match criteria.'}
                    </div>
                 ) : (
                    filteredReports.map(r => (
                       <div key={r.id} className="bg-panel border border-secondary/30 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg group hover:border-primary/30 transition-all">
                          <div className="flex-1 text-left space-y-2 w-full">
                             <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-canvas text-primary border border-primary/20 uppercase">{r.status}</span>
                                {currentUser && r.savedBy?.includes(currentUser.uid) && (
                                   <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30 uppercase flex items-center gap-1">
                                      <Bookmark className="w-3 h-3 fill-amber-300" /> Saved
                                   </span>
                                )}
                                <h4 className="text-sm font-black text-white uppercase">{r.subject}</h4>
                             </div>
                             <p className="text-xs text-slate-400 truncate max-w-md italic">"{r.description}"</p>
                             <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                                <span>REPORTER: <span className="text-white">{r.authorName}</span></span>
                                <span>DATE: <span className="text-white">{new Date(r.createdAt).toLocaleDateString()}</span></span>
                             </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                             <button
                                onClick={(e) => handleToggleSave(e, r)}
                                disabled={savingReportId === r.id}
                                title={currentUser && r.savedBy?.includes(currentUser.uid) ? 'Remove from Saved' : 'Save for Later'}
                                className={`p-2 rounded-xl border transition-all ${
                                   currentUser && r.savedBy?.includes(currentUser.uid)
                                      ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                                      : 'bg-canvas border-secondary/30 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
                                }`}
                             >
                                <Bookmark className={`w-4 h-4 ${currentUser && r.savedBy?.includes(currentUser.uid) ? 'fill-amber-300' : ''}`} />
                             </button>
                             <button
                                onClick={(e) => {
                                   e.stopPropagation();
                                   setReportToDelete(r);
                                   setDeleteError(null);
                                }}
                                title="Delete Report"
                                className="p-2 bg-canvas hover:bg-red-950/60 border border-secondary/30 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-xl transition-all"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                             <button onClick={() => setSelectedReport(r)} className="px-5 py-2 bg-canvas hover:bg-primary/20 text-[10px] font-black uppercase rounded-xl border border-secondary/30 transition-all">Inspect Report</button>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </motion.div>
        )}

        {activeTab === 'applications' && (
           <motion.div key="apps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex items-center gap-4">
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <select
                          value={appCategoryFilter}
                          onChange={(e) => setAppCategoryFilter(e.target.value)}
                          className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2 text-xs font-black text-white outline-none cursor-pointer appearance-none min-w-[180px] focus:border-primary/50"
                      >
                          <option value="All">All Categories</option>
                          <option value="Developer Apply">Developer Apply</option>
                          <option value="Staff Apply">Staff Apply</option>
                          <option value="Moderator Apply">Moderator Apply</option>
                          <option value="Helper Apply">Helper Apply</option>
                      </select>
                    </div>
                    
                    <div className="relative">
                      <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <select
                          value={appStatusFilter}
                          onChange={(e) => setAppStatusFilter(e.target.value)}
                          className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2 text-xs font-black text-white outline-none cursor-pointer appearance-none focus:border-primary/50"
                      >
                          <option value="All">All Active Applications</option>
                          <option value="New">New Applications</option>
                          <option value="Seen">Seen Applications</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Pending">Pending</option>
                          <option value="Accepted">Accepted (Archive)</option>
                          <option value="Rejected">Rejected (Archive)</option>
                          <option value="Archive">All Records (Archive)</option>
                      </select>
                    </div>
                  </div>
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={appSearch}
                      onChange={(e) => setAppSearch(e.target.value)}
                      placeholder="Search applicants by name, discord, or ID..."
                      className="w-full bg-canvas border border-secondary/30 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-white outline-none focus:border-primary"
                    />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {activeApplications.length === 0 ? (
                    <div className="col-span-full bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-500 font-bold uppercase text-xs">
                       No applications found for this filter.
                    </div>
                 ) : (
                  paginatedApps.map((app) => {
                    const isSeen = Array.isArray(app.seenBy)
                      ? app.seenBy.includes(currentUser?.uid || "")
                      : !!(app.seenBy && (app.seenBy as any)[currentUser?.uid || ""]);

                    return (
                      <div key={app.id} className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl group hover:border-cyan-400/30 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-4">
                           <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] font-mono font-bold text-slate-500">APP-ID: {app.id}</span>
                                {isSeen ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                    <Eye className="w-3 h-3 text-cyan-400" /> SEEN
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-400/40 animate-pulse flex items-center gap-1">
                                    ✨ NEW
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xl font-black text-white tracking-tight">{app.applicantName} <span className="text-slate-400 font-medium text-sm">({app.discordUsername})</span></h4>
                           </div>
                           <span className="px-3.5 py-1.5 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-cyan-400 uppercase">{app.category}</span>
                        </div>

                        <div className="space-y-4">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(QUESTIONS[app.category] || []).slice(0, 2).map((q, i) => (
                                 <div key={i} className="p-4 bg-canvas/40 rounded-2xl border border-secondary/10 space-y-1">
                                    <div className="text-[9px] font-black text-cyan-400 uppercase">Q: {q}</div>
                                    <div className="text-xs text-slate-300 font-medium italic truncate">"{app.answers[i.toString()] || app.answers[q] || "N/A"}"</div>
                                 </div>
                              ))}
                           </div>

                           <button
                              onClick={() => setSelectedApp(app)}
                              className="w-full py-3.5 bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-500 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-primary/20 cursor-pointer"
                           >
                              <Eye className="w-4 h-4" />
                              <span>View Complete Application</span>
                           </button>
                        </div>
                      </div>
                    );
                  })
                 )}
              </div>

              {totalAppPages > 1 && (
                <div className="flex items-center justify-between bg-panel border border-secondary/30 rounded-2xl p-4">
                  <button
                    onClick={() => setAppPage(p => Math.max(1, p - 1))}
                    disabled={appPage === 1}
                    className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-primary transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Page {appPage} of {totalAppPages}
                  </span>
                  <button
                    onClick={() => setAppPage(p => Math.min(totalAppPages, p + 1))}
                    disabled={appPage === totalAppPages}
                    className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-primary transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}

           </motion.div>
        )}

        {activeTab === 'tasks' && (
           <motion.div key="tasks-t" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-panel border border-secondary/30 rounded-[2rem] p-8 shadow-2xl">
              <StaffTasksPanel panelRole="STAFF" />
           </motion.div>
        )}
      </AnimatePresence>

      {/* Complete Application Inspection Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          isOpen={!!selectedApp}
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={loadData}
        />
      )}

      {selectedReport && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-secondary/40 rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative">
               <button onClick={() => setSelectedReport(null)} className="absolute top-6 right-6 p-2 hover:bg-canvas rounded-xl"><ChevronLeft className="w-6 h-6 rotate-180" /></button>
               <div className="space-y-6">
                  <div className="flex items-center gap-2 flex-wrap">
                     <span className="text-[10px] font-black px-2 py-0.5 rounded bg-canvas text-primary border border-primary/20 uppercase">{selectedReport.status}</span>
                     {currentUser && selectedReport.savedBy?.includes(currentUser.uid) && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30 uppercase flex items-center gap-1">
                           <Bookmark className="w-3 h-3 fill-amber-300" /> Saved for Later
                        </span>
                     )}
                     <h3 className="text-2xl font-black text-white uppercase">{selectedReport.subject}</h3>
                  </div>
                  <div className="p-5 bg-canvas/60 rounded-2xl border border-secondary/20 text-sm text-slate-200 italic">"{selectedReport.description}"</div>
                  
                  <ReportMediaPreview evidenceUrl={selectedReport.evidenceUrl} videoLink={selectedReport.videoLink} />

                  <div className="flex gap-4 text-[10px] font-bold text-slate-500 pt-2 border-t border-secondary/20">
                     <span>REPORTER: <span className="text-white">{selectedReport.authorName}</span></span>
                     <span>DATE: <span className="text-white">{new Date(selectedReport.createdAt).toLocaleDateString()}</span></span>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                     <button
                        onClick={(e) => handleToggleSave(e, selectedReport)}
                        disabled={savingReportId === selectedReport.id}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all border flex items-center justify-center gap-2 ${
                           currentUser && selectedReport.savedBy?.includes(currentUser.uid)
                              ? 'bg-amber-950/70 border-amber-500/60 text-amber-300'
                              : 'bg-canvas border-secondary/30 text-slate-300 hover:text-amber-300'
                        }`}
                     >
                        <Bookmark className={`w-4 h-4 ${currentUser && selectedReport.savedBy?.includes(currentUser.uid) ? 'fill-amber-300' : ''}`} />
                        <span>{currentUser && selectedReport.savedBy?.includes(currentUser.uid) ? 'Saved for Later' : 'Save for Later'}</span>
                     </button>
                     <button
                        onClick={() => {
                           setReportToDelete(selectedReport);
                           setDeleteError(null);
                        }}
                        className="px-4 py-3 bg-red-950/50 hover:bg-red-900 border border-red-500/40 text-red-300 hover:text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5"
                     >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                     </button>
                  </div>
               </div>
            </motion.div>
         </div>
      )}

      {/* Staff Report Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-red-500/40 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/80 rounded-2xl border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Delete Report</h3>
                <span className="text-[10px] text-red-400/90 font-bold uppercase tracking-wider">Permanent Action</span>
              </div>
            </div>

            <div className="space-y-3 bg-canvas/60 p-4 rounded-2xl border border-secondary/20">
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                Are you sure you want to delete this report? This will permanently remove it from the active report system and delete any uploaded evidence media from Firebase Storage.
              </p>
              <div className="text-[11px] font-mono text-slate-400 border-t border-secondary/20 pt-2 space-y-1">
                <div><span className="text-slate-500 uppercase">Subject:</span> <span className="text-white font-bold">{reportToDelete.subject}</span></div>
                <div><span className="text-slate-500 uppercase">Reporter:</span> <span className="text-slate-300">{reportToDelete.authorName}</span></div>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-950/90 border border-red-600 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReportToDelete(null);
                  setDeleteError(null);
                }}
                disabled={deletingReportId !== null}
                className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 rounded-xl text-xs font-black uppercase text-slate-300 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingReportId !== null}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deletingReportId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* System Panel Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-secondary/40 rounded-[2.5rem] max-w-xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6 text-white">
            <button onClick={() => setIsConfigModalOpen(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-canvas rounded-xl"><XCircle className="w-5 h-5" /></button>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">System Panel Settings</span>
              <h3 className="text-2xl font-black uppercase italic tracking-tight">Configure Moderator Panel</h3>
            </div>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Panel Name</label>
                <input type="text" value={cfgName} onChange={e => setCfgName(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-400 font-bold" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Description</label>
                <textarea value={cfgDesc} onChange={e => setCfgDesc(e.target.value)} rows={2} className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={cfgColor} onChange={e => setCfgColor(e.target.value)} className="w-10 h-10 rounded-xl bg-canvas border border-secondary/30 cursor-pointer p-1" />
                    <input type="text" value={cfgColor} onChange={e => setCfgColor(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Emoji</label>
                  <input type="text" value={cfgEmoji} onChange={e => setCfgEmoji(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white text-center text-lg outline-none focus:border-emerald-400" maxLength={4} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Enabled Feature Modules</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(['Dashboard', 'Reports', 'Applications', 'Task Management'] as PanelFeature[]).map(feat => {
                    const checked = cfgFeatures.includes(feat);
                    return (
                      <label key={feat} className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-all ${checked ? 'bg-emerald-500/10 border-emerald-400/40 text-white font-bold' : 'bg-canvas/60 border-secondary/20 text-slate-400'}`}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          if (checked) setCfgFeatures(prev => prev.filter(f => f !== feat));
                          else setCfgFeatures(prev => [...prev, feat]);
                        }} className="rounded border-secondary/40 text-emerald-400 focus:ring-0" />
                        <span className="text-[11px] truncate">{feat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4 border-t border-secondary/20 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to reset Staff Panel settings to default?')) {
                      try {
                        setSavingCfg(true);
                        const updated = await resetSystemPanelToDefault('staff');
                        if (updated.staff) {
                          setSystemConfig(updated.staff);
                          setCfgName(updated.staff.name);
                          setCfgDesc(updated.staff.description || '');
                          setCfgColor(updated.staff.color || '#06b6d4');
                          setCfgEmoji(updated.staff.emoji || '⚡');
                          setCfgFeatures(updated.staff.features || []);
                        }
                        alert('Staff Panel reset to default successfully.');
                      } catch (err: any) {
                        alert('Failed to reset: ' + (err?.message || 'Unknown error'));
                      } finally {
                        setSavingCfg(false);
                      }
                    }
                  }}
                  disabled={savingCfg}
                  className="py-3 px-4 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-50"
                >
                  Reset to Default
                </button>
                <button type="button" onClick={() => setIsConfigModalOpen(false)} className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 text-slate-300 rounded-xl text-xs font-black uppercase transition-all">Cancel</button>
                <button type="submit" disabled={savingCfg || !cfgName.trim()} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer">
                  {savingCfg ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
