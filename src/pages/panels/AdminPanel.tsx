import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { logAuditEvent } from '../../lib/auditLogger';
import { deduplicateApplications } from '../../lib/applicationUtils';
import {
  getApplications,
  getReports,
  fetchReports,
  fetchUsersFromFirestore,
  fetchApplicationsFromFirestore,
  fetchAuditLogsFromFirestore,
  updateApplication,
  updateReport,
  toggleSaveReport,
  deleteReport,
  addNotification,
  fetchGlobalStats,
  updateApplicationStatus,
  updateUserRole,
} from '../../lib/storage';
import { StaffApplication, UserProfile, UserRole, UserReport, AuditLogEntry, QUESTIONS } from '../../types';
import { checkAndProcessAutoRejections } from '../../lib/autoReject';
import { downloadReportsCSV, openReportsPDFPrintWindow } from '../../lib/exportUtils';
import { ReportMediaPreview } from '../../components/ReportMediaPreview';
import { StaffTasksPanel } from '../../components/StaffTasksPanel';
import { TaskDelegationForm } from '../../components/TaskDelegationForm';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { ApplicationDetailModal } from '../../components/ApplicationDetailModal';
import {
  Settings,
  Search,
  Download,
  Printer,
  BarChart3,
  FileText,
  ClipboardList,
  Users,
  Shield,
  Hammer,
  Activity,
  Eye,
  Video,
  Image as ImageIcon,
  ChevronRight,
  Filter,
  Bookmark,
  Trash2,
  Loader2,
  AlertTriangle,
  UserCheck,
  XCircle,
  Edit3,
} from 'lucide-react';
import { getSystemPanels, updateSystemPanel, resetSystemPanelToDefault } from '../../lib/panelService';
import { SystemPanelConfig, DEFAULT_SYSTEM_PANELS } from '../../lib/storage';
import { PanelFeature } from '../../types';

export const AdminPanel: React.FC = () => {
  const { currentUser, userProfile, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'reports' | 'users' | 'moderators' | 'staff' | 'tasks'>('dashboard');
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApps: 0,
    underReviewApps: 0,
    acceptedApps: 0,
    rejectedApps: 0,
    openReports: 0,
    resolvedReports: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  // Selected App State
  const [selectedApp, setSelectedApp] = useState<StaffApplication | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Admin Role Assignment State
  const [assigningUser, setAssigningUser] = useState<UserProfile | null>(null);
  const [targetRole, setTargetRole] = useState<'MOD' | 'STAFF' | 'USER'>('STAFF');
  const [updatingUserRole, setUpdatingUserRole] = useState(false);

  // Selected Report State
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [assigneeUid, setAssigneeUid] = useState('');
  const [reportToDelete, setReportToDelete] = useState<UserReport | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);

  // Filters
  const [appSearch, setAppSearch] = useState('');
  const [appCategoryFilter, setAppCategoryFilter] = useState<string>('All');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('All');

  const [reportSearch, setReportSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<string>('All');

  const [userSearch, setUserSearch] = useState('');

  // System Panel Configuration State
  const [systemConfig, setSystemConfig] = useState<SystemPanelConfig>(DEFAULT_SYSTEM_PANELS.admin);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [cfgName, setCfgName] = useState('');
  const [cfgDesc, setCfgDesc] = useState('');
  const [cfgColor, setCfgColor] = useState('#a855f7');
  const [cfgEmoji, setCfgEmoji] = useState('🛡️');
  const [cfgFeatures, setCfgFeatures] = useState<PanelFeature[]>([]);
  const [savingCfg, setSavingCfg] = useState(false);

  const loadData = async () => {
    setLoadingInitial(true);
    try {
      await checkAndProcessAutoRejections();

      const [aList, rList, uList, lList, liveStats, sysPanels] = await Promise.all([
        fetchApplicationsFromFirestore(),
        fetchReports(),
        fetchUsersFromFirestore(),
        fetchAuditLogsFromFirestore(),
        fetchGlobalStats(),
        getSystemPanels(),
      ]);

      const uniqueApps = deduplicateApplications(aList);
      setApplications(uniqueApps);

      rList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(rList);

      setUsers(uList);

      lList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(lList.slice(0, 50));

      setStats(liveStats);
      if (sysPanels.admin) setSystemConfig(sysPanels.admin);
    } catch (err) {
      console.error('Error loading admin panel data:', err);
    } finally {
      setLoadingInitial(false);
      setLoadingStats(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      await updateSystemPanel('admin', {
        name: cfgName.trim(),
        description: cfgDesc.trim(),
        color: cfgColor,
        emoji: cfgEmoji,
        features: cfgFeatures,
      });
      const updated = await getSystemPanels();
      if (updated.admin) setSystemConfig(updated.admin);
      setIsConfigModalOpen(false);
      alert('Admin Panel configuration updated successfully.');
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
      console.error('Failed to toggle saved report status:', err);
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
        name: userProfile?.name || currentUser.displayName || 'Admin',
        email: currentUser.email || '',
        role: userProfile?.role || 'ADMIN',
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
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Handle Application Decision
  const handleDecision = async (appId: string, status: 'Accepted' | 'Rejected' | 'Under Review') => {
    if (!currentUser || processingId === appId) return;
    const targetApp = applications.find((a) => a.id === appId);
    if (!targetApp) return;

    setProcessingId(appId);
    try {
      await updateApplicationStatus(appId, status, {
        uid: currentUser.uid,
        name: userProfile?.name || currentUser.displayName || 'Admin',
        role: userProfile?.role || 'ADMIN',
      });

      if (status === 'Accepted' || status === 'Rejected') {
        await addNotification({
          recipientUid: targetApp.applicantUid,
          title: `Application Decision: ${status}`,
          message: `Your application for ${targetApp.position} status was marked as ${status} by Admin.`,
          type: 'application',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      await logAuditEvent({
        action: `ADMIN_DECISION_${status.toUpperCase()}`,
        actorUid: currentUser.uid,
        actorName: userProfile?.name || 'Admin',
        actorEmail: currentUser.email || '',
        actorRole: userProfile?.role || 'ADMIN',
        targetResource: 'applications',
        targetUid: appId,
        metadata: { position: targetApp.position, status },
      });

      await loadData();
      alert(`Application marked as ${status}.`);
      setAdminNote('');
    } catch (err: any) {
      alert(err?.message || 'Failed to update application.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAdminAssignRole = async () => {
    if (!assigningUser || !currentUser) return;
    if (assigningUser.role === 'OWNER' || assigningUser.role === 'ADMIN') {
      alert('Admins cannot modify OWNER or ADMIN users.');
      return;
    }
    if (targetRole !== 'MOD' && targetRole !== 'STAFF' && targetRole !== 'USER') {
      alert('Admins can only assign MOD, STAFF, or USER roles.');
      return;
    }
    setUpdatingUserRole(true);
    try {
      await updateUserRole(assigningUser.uid, targetRole as any, currentUser.uid);
      await logAuditEvent({
        action: `ADMIN_ASSIGNED_ROLE_${targetRole}`,
        actorUid: currentUser.uid,
        actorName: userProfile?.name || 'Admin',
        actorEmail: currentUser.email || '',
        actorRole: userProfile?.role || 'ADMIN',
        targetResource: 'users',
        targetUid: assigningUser.uid,
        metadata: { targetName: assigningUser.name, targetRole },
      });
      await loadData();
      setAssigningUser(null);
      alert(`Successfully updated ${assigningUser.name}'s role to ${targetRole}.`);
    } catch (err: any) {
      alert(err?.message || 'Failed to update user role');
    } finally {
      setUpdatingUserRole(false);
    }
  };

  // Pagination State
  const [appPage, setAppPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const USERS_PER_PAGE = 9;

  // Application Filtering
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

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const matchSearch =
        rep.subject.toLowerCase().includes(reportSearch.toLowerCase()) ||
        (rep.id && rep.id.toLowerCase().includes(reportSearch.toLowerCase()));

      if (reportFilter === 'Saved') return matchSearch && !!currentUser && Array.isArray(rep.savedBy) && rep.savedBy.includes(currentUser.uid);
      if (reportFilter === 'Video') return matchSearch && !!rep.videoLink;
      if (reportFilter === 'Photo') return matchSearch && !!rep.evidenceUrl;
      if (reportFilter === 'Basic') return matchSearch && !rep.videoLink && !rep.evidenceUrl;
      
      return matchSearch;
    });
  }, [reports, reportSearch, reportFilter, currentUser]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());
      return matchSearch;
    });
  }, [users, userSearch]);

  const totalAppPages = Math.ceil(activeApplications.length / ITEMS_PER_PAGE) || 1;
  const totalReportPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1;
  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;

  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * ITEMS_PER_PAGE;
    return activeApplications.slice(start, start + ITEMS_PER_PAGE);
  }, [activeApplications, appPage]);

  const paginatedReports = useMemo(() => {
    const start = (reportPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, reportPage]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, userPage]);


  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center text-red-300 font-bold text-sm bg-panel border border-red-900/50 rounded-2xl p-8 mt-10 shadow-2xl">
        Access Denied: You do not have Admin permissions.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-8 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-secondary/20 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest" style={{ color: systemConfig.color || '#a855f7' }}>
            <span className="text-xl">{systemConfig.emoji || '🛡️'}</span>
            <span>{systemConfig.name} — Flick Staff Apply V2.1</span>
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tight mt-2 flex items-center gap-3">
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
               className="px-3.5 py-1.5 bg-canvas hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
             >
               <Edit3 className="w-3.5 h-3.5" />
               <span>Configure Panel</span>
             </button>
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            {systemConfig.description}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-2 bg-panel p-1.5 rounded-2xl border border-secondary/30">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'applications' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Applications</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'reports' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Reports</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'users' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab('moderators')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'moderators' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Hammer className="w-4 h-4" />
            <span>Moderators</span>
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'staff' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Staff</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'tasks' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Tasks</span>
          </button>
        </nav>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div key="dash" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-xl">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Registered Users</span>
                 <div className="text-4xl font-black text-white">{loadingStats ? '...' : stats.totalUsers}</div>
              </div>
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-xl">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Active Queue</span>
                 <div className="text-4xl font-black text-cyan-400">{loadingStats ? '...' : stats.pendingApps + stats.underReviewApps}</div>
              </div>
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-xl">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Open Reports</span>
                 <div className="text-4xl font-black text-amber-300">{loadingStats ? '...' : stats.openReports}</div>
              </div>
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-3 shadow-xl">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Resolved</span>
                 <div className="text-4xl font-black text-emerald-400">{loadingStats ? '...' : stats.resolvedReports}</div>
              </div>
            </div>

            <div className="bg-panel border border-secondary/30 rounded-3xl p-6 space-y-6 shadow-2xl">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Recent Moderation Activity
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {auditLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-4 bg-canvas/60 rounded-2xl border border-secondary/20 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-white">{log.actorName}:</span>{' '}
                        <span className="text-primary font-bold">{log.action}</span>
                      </div>
                      <span className="text-slate-500 font-mono">{new Date(log.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'applications' && (
          <motion.div key="apps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
            <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={appCategoryFilter}
                      onChange={(e) => setAppCategoryFilter(e.target.value)}
                      className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2 text-[11px] font-black text-white outline-none cursor-pointer appearance-none min-w-[180px] focus:border-primary/50"
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
                      className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2 text-[11px] font-black text-white outline-none cursor-pointer appearance-none focus:border-primary/50"
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
              </div>
              <div className="relative flex-1 w-full">
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

            <div className="space-y-4">
               {activeApplications.length === 0 ? (
                  <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-500 font-bold uppercase text-xs">
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

        {activeTab === 'reports' && (
           <motion.div key="reps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
             <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                   <select
                    value={reportFilter}
                    onChange={(e) => setReportFilter(e.target.value)}
                    className="bg-canvas border border-secondary/30 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none cursor-pointer appearance-none pr-10"
                  >
                    <option value="All">All</option>
                    <option value="Saved">Saved</option>
                    <option value="Basic">Basic</option>
                    <option value="Video">Video</option>
                    <option value="Photo">Photo</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => {
                      const actor = userProfile?.name || 'Admin';
                      downloadReportsCSV(filteredReports, actor);
                   }} className="p-2 bg-panel border border-secondary/30 rounded-xl text-cyan-400 hover:bg-canvas transition-colors"><Download className="w-4 h-4" /></button>
                   <button onClick={() => {
                      const actor = userProfile?.name || 'Admin';
                      openReportsPDFPrintWindow(filteredReports, actor);
                   }} className="p-2 bg-panel border border-secondary/30 rounded-xl text-primary hover:bg-canvas transition-colors"><Printer className="w-4 h-4" /></button>
                </div>
             </div>

             <div className="grid grid-cols-1 gap-4">
                {filteredReports.length === 0 ? (
                   <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-500 font-bold uppercase text-xs">
                      {reportFilter === 'Saved' ? 'No saved reports for later.' : 'No reports match criteria.'}
                   </div>
                ) : (
                   filteredReports.map(r => (
                      <div key={r.id} className="bg-panel border border-secondary/30 rounded-3xl p-6 flex flex-col md:flex-row justify-between gap-6 hover:border-primary/30 transition-all">
                         <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                               <span className="text-[10px] font-black px-2 py-0.5 rounded bg-canvas text-primary border border-primary/20 uppercase">{r.status}</span>
                               {currentUser && r.savedBy?.includes(currentUser.uid) && (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30 uppercase flex items-center gap-1">
                                     <Bookmark className="w-3 h-3 fill-amber-300" /> Saved
                                  </span>
                               )}
                               <h4 className="text-base font-black text-white uppercase">{r.subject}</h4>
                            </div>
                            <p className="text-xs text-slate-300 italic">"{r.description}"</p>
                            <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                               <span>REPORTER: <span className="text-white">{r.authorName}</span></span>
                               <span>DATE: <span className="text-white">{new Date(r.createdAt).toLocaleDateString()}</span></span>
                            </div>
                         </div>
                         <div className="flex flex-col gap-3 shrink-0 min-w-[200px]">
                            <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2">
                                  {r.videoLink && <div className="p-2 bg-indigo-950 text-indigo-400 rounded-lg"><Video className="w-4 h-4" /></div>}
                                  {r.evidenceUrl && <div className="p-2 bg-cyan-950 text-cyan-400 rounded-lg"><ImageIcon className="w-4 h-4" /></div>}
                               </div>
                               <div className="flex items-center gap-1">
                                  <button
                                     onClick={(e) => handleToggleSave(e, r)}
                                     disabled={savingReportId === r.id}
                                     title={currentUser && r.savedBy?.includes(currentUser.uid) ? 'Remove from Saved' : 'Save for Later'}
                                     className={`p-2 rounded-xl border transition-all ${
                                        currentUser && r.savedBy?.includes(currentUser.uid)
                                           ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 shadow-sm'
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
                               </div>
                            </div>
                            <button onClick={() => {
                               setSelectedReport(r);
                               setActiveTab('reports');
                            }} className="w-full py-2 bg-canvas hover:bg-primary/20 text-xs font-black uppercase rounded-xl border border-secondary/30 transition-all">Details</button>
                         </div>
                      </div>
                   ))
                )}
             </div>
           </motion.div>
        )}

        {activeTab === 'users' && (
           <motion.div key="users-t" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-5">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users by name or email..."
                      className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-primary"
                    />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {filteredUsers.map(u => {
                    const isProtected = u.role === 'OWNER' || u.role === 'ADMIN';

                    return (
                      <div key={u.uid} className="bg-panel border border-secondary/30 rounded-2xl p-5 flex flex-col justify-between gap-4">
                         <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary border border-primary/30 shrink-0">
                                  {u.name.charAt(0).toUpperCase()}
                               </div>
                               <div>
                                  <div className="text-sm font-black text-white">{u.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">{u.email}</div>
                               </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                              u.role === 'OWNER'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                : u.role === 'ADMIN'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                : u.role === 'MOD'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : u.role === 'STAFF'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {u.role}
                            </span>
                         </div>

                         <div className="pt-2 border-t border-secondary/20 flex items-center justify-between gap-2">
                            {isProtected ? (
                               <div className="text-[10px] text-slate-500 italic flex items-center gap-1 font-semibold">
                                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Protected Role</span>
                               </div>
                            ) : (
                               <button
                                  onClick={() => {
                                     setAssigningUser(u);
                                     setTargetRole(u.role === 'MOD' ? 'MOD' : u.role === 'STAFF' ? 'STAFF' : 'STAFF');
                                  }}
                                  className="w-full py-2 bg-canvas hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                               >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Manage Role</span>
                               </button>
                            )}
                         </div>
                      </div>
                    );
                 })}
              </div>
           </motion.div>
        )}

        {activeTab === 'moderators' && (
           <motion.div key="mods" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-8 text-center space-y-4">
                 <Hammer className="w-12 h-12 mx-auto text-primary" />
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Moderator Management</h3>
                 <p className="text-sm text-slate-400 max-w-md mx-auto">Oversee moderator performance, assigned reports, and incident resolution tracking.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {users.filter(u => u.role === 'MOD').map(m => (
                       <div key={m.uid} className="p-4 bg-canvas/40 rounded-2xl border border-secondary/20 flex justify-between items-center">
                          <div>
                             <div className="text-sm font-black text-white">{m.name}</div>
                             <div className="text-[10px] text-slate-500">Active Moderator</div>
                          </div>
                          <button className="text-[10px] font-black text-primary uppercase">View Reports</button>
                       </div>
                    ))}
                 </div>
              </div>
           </motion.div>
        )}

        {activeTab === 'staff' && (
           <motion.div key="staff-t" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-8 text-center space-y-4">
                 <Shield className="w-12 h-12 mx-auto text-cyan-400" />
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Staff Team Portal</h3>
                 <p className="text-sm text-slate-400 max-w-md mx-auto">Coordinate staff assignments, review helper applications, and manage general operations.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {users.filter(u => u.role === 'STAFF').map(s => (
                       <div key={s.uid} className="p-4 bg-canvas/40 rounded-2xl border border-secondary/20 flex justify-between items-center">
                          <div>
                             <div className="text-sm font-black text-white">{s.name}</div>
                             <div className="text-[10px] text-slate-500">Authorized Staff</div>
                          </div>
                          <button className="text-[10px] font-black text-cyan-400 uppercase">View Tasks</button>
                       </div>
                    ))}
                 </div>
              </div>
           </motion.div>
        )}
         {activeTab === 'tasks' && (
            <motion.div key="tasks-t" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-8">
               <TaskDelegationForm onTaskAdded={() => setTaskRefreshKey(prev => prev + 1)} />
               <div className="bg-panel border border-secondary/30 rounded-[2rem] p-8 shadow-2xl">
                  <StaffTasksPanel panelRole="ADMIN" refreshKey={taskRefreshKey} />
               </div>
            </motion.div>
         )}
       </AnimatePresence>

      {selectedReport && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-secondary/40 rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative">
               <button onClick={() => setSelectedReport(null)} className="absolute top-6 right-6 p-2 hover:bg-canvas rounded-xl"><ChevronRight className="w-6 h-6 rotate-180" /></button>
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

                  <div className="flex flex-wrap gap-3 pt-4">
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
                     <button onClick={async () => {
                        await updateReport(selectedReport.id!, { status: selectedReport.status === 'Resolved' ? 'Open' : 'Resolved' });
                        setSelectedReport(null);
                        loadData();
                     }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all shadow-lg ${selectedReport.status === 'Resolved' ? 'bg-canvas text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
                        {selectedReport.status === 'Resolved' ? 'Mark Open' : 'Mark Resolved'}
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

      {/* Report Delete Confirmation Modal */}
      <ConfirmationDialog
        isOpen={!!reportToDelete}
        title="Delete Community Report"
        message="Are you sure you want to delete this report? This will permanently remove it from the active report system and delete any uploaded evidence media from Firebase Storage."
        itemName={reportToDelete?.subject}
        isLoading={deletingReportId !== null}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setReportToDelete(null);
          setDeleteError(null);
        }}
      />

      {/* Application Detail Inspection Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          isOpen={!!selectedApp}
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={loadData}
        />
      )}

      {/* Admin Role Assignment Modal */}
      {assigningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-secondary/40 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="p-3 bg-purple-950/80 rounded-2xl border border-purple-500/30">
                <UserCheck className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Assign Staff Role</h3>
                <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Admin Role Delegation</span>
              </div>
            </div>

            <div className="p-4 bg-canvas/60 rounded-2xl border border-secondary/20 space-y-2">
              <div className="text-xs text-slate-400">Target Member:</div>
              <div className="text-sm font-black text-white">{assigningUser.name}</div>
              <div className="text-[11px] font-mono text-slate-500">{assigningUser.email}</div>
              <div className="text-[10px] text-slate-400 pt-2 border-t border-secondary/20">
                Current Role: <span className="font-bold text-white uppercase">{assigningUser.role}</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-300 uppercase tracking-widest block">
                Select Allowed Role:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['MOD', 'STAFF', 'USER'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTargetRole(r)}
                    className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                      targetRole === r
                        ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-canvas border-secondary/30 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r === 'USER' ? 'REVOKE' : r}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 italic">
                * Admins can only assign MODERATOR and STAFF roles, or revoke to USER. Admins cannot create or assign OWNER or ADMIN roles.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssigningUser(null)}
                disabled={updatingUserRole}
                className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 rounded-xl text-xs font-black uppercase text-slate-300 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdminAssignRole}
                disabled={updatingUserRole}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updatingUserRole ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Confirm Role</span>
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
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">System Panel Settings</span>
              <h3 className="text-2xl font-black uppercase italic tracking-tight">Configure Admin Panel</h3>
            </div>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Panel Name</label>
                <input type="text" value={cfgName} onChange={e => setCfgName(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 font-bold" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Description</label>
                <textarea value={cfgDesc} onChange={e => setCfgDesc(e.target.value)} rows={2} className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 resize-none" />
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
                  <input type="text" value={cfgEmoji} onChange={e => setCfgEmoji(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white text-center text-lg outline-none focus:border-amber-400" maxLength={4} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Enabled Feature Modules</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(['Dashboard', 'Applications', 'Reports', 'Users', 'Moderators', 'Staff', 'Task Management', 'Settings'] as PanelFeature[]).map(feat => {
                    const checked = cfgFeatures.includes(feat);
                    return (
                      <label key={feat} className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-all ${checked ? 'bg-amber-400/10 border-amber-400/40 text-white font-bold' : 'bg-canvas/60 border-secondary/20 text-slate-400'}`}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          if (checked) setCfgFeatures(prev => prev.filter(f => f !== feat));
                          else setCfgFeatures(prev => [...prev, feat]);
                        }} className="rounded border-secondary/40 text-amber-400 focus:ring-0" />
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
                    if (window.confirm('Are you sure you want to reset Admin Panel settings to default?')) {
                      try {
                        setSavingCfg(true);
                        const updated = await resetSystemPanelToDefault('admin');
                        if (updated.admin) {
                          setSystemConfig(updated.admin);
                          setCfgName(updated.admin.name);
                          setCfgDesc(updated.admin.description || '');
                          setCfgColor(updated.admin.color || '#a855f7');
                          setCfgEmoji(updated.admin.emoji || '🛡️');
                          setCfgFeatures(updated.admin.features || []);
                        }
                        alert('Admin Panel reset to default successfully.');
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
                <button type="submit" disabled={savingCfg || !cfgName.trim()} className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-amber-400/20 disabled:opacity-50 cursor-pointer">
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

