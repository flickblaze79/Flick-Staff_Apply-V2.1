import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { StaffApplication, UserReport, UserProfile, CustomPanel, PanelFeature, QUESTIONS } from '../../types';
import {
  fetchApplicationsFromFirestore,
  fetchReports,
  fetchUsersFromFirestore,
  fetchGlobalStats,
  subscribeToApplications,
  toggleSaveReport,
  deleteReport,
} from '../../lib/storage';
import { deduplicateApplications } from '../../lib/applicationUtils';
import { ApplicationDetailModal } from '../../components/ApplicationDetailModal';
import { StaffTasksPanel } from '../../components/StaffTasksPanel';
import { ReportMediaPreview } from '../../components/ReportMediaPreview';
import {
  Crown,
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter,
  BarChart3,
  Bell,
  Settings as SettingsIcon,
  Sparkles,
  Activity,
  Bookmark,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface CustomPanelPageProps {
  panel: CustomPanel;
  onNavigate?: (page: string) => void;
}

export const CustomPanelPage: React.FC<CustomPanelPageProps> = ({ panel }) => {
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<PanelFeature>(
    panel.features.length > 0 ? panel.features[0] : 'Dashboard'
  );

  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // App Filter States
  const [appSearch, setAppSearch] = useState('');
  const [appCategoryFilter, setAppCategoryFilter] = useState('All');
  const [appStatusFilter, setAppStatusFilter] = useState('All');

  // Selected App for Modal
  const [selectedApp, setSelectedApp] = useState<StaffApplication | null>(null);

  // Report Filter States
  const [reportSearch, setReportSearch] = useState('');

  // Pagination for Applications
  const [appPage, setAppPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    let unsubApps: (() => void) | null = null;

    const loadData = async () => {
      setLoading(true);
      try {
        const [aList, rList, uList] = await Promise.all([
          fetchApplicationsFromFirestore(),
          fetchReports(),
          fetchUsersFromFirestore(),
        ]);

        setApplications(deduplicateApplications(aList));
        setReports(rList);
        setUsers(uList);

        unsubApps = subscribeToApplications((updated) => {
          setApplications(deduplicateApplications(updated));
        });
      } catch (err) {
        console.error('Error loading custom panel data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubApps) unsubApps();
    };
  }, [panel.id]);

  // Helper to test if current reviewer has seen application
  const isSeenByCurrentUser = (app: StaffApplication) => {
    if (!currentUser?.uid) return false;
    if (Array.isArray(app.seenBy)) {
      return app.seenBy.includes(currentUser.uid);
    }
    if (app.seenBy && typeof app.seenBy === 'object') {
      return Boolean(app.seenBy[currentUser.uid]);
    }
    return false;
  };

  // Filter applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchSearch =
        app.applicantName.toLowerCase().includes(appSearch.toLowerCase()) ||
        (app.discordUsername && app.discordUsername.toLowerCase().includes(appSearch.toLowerCase())) ||
        (app.id && app.id.toLowerCase().includes(appSearch.toLowerCase()));

      const matchCategory = appCategoryFilter === 'All' || app.category === appCategoryFilter;

      const isSeen = isSeenByCurrentUser(app);
      let matchStatus = true;
      if (appStatusFilter === 'All') {
        matchStatus = app.status === 'Pending' || app.status === 'Under Review';
      } else if (appStatusFilter === 'New') {
        matchStatus = !isSeen && (app.status === 'Pending' || app.status === 'Under Review');
      } else if (appStatusFilter === 'Seen') {
        matchStatus = isSeen && (app.status === 'Pending' || app.status === 'Under Review');
      } else if (appStatusFilter === 'Archive') {
        matchStatus = app.status === 'Accepted' || app.status === 'Rejected';
      } else {
        matchStatus = app.status === appStatusFilter;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [applications, appSearch, appCategoryFilter, appStatusFilter, currentUser?.uid]);

  const totalAppPages = Math.ceil(filteredApps.length / ITEMS_PER_PAGE) || 1;
  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * ITEMS_PER_PAGE;
    return filteredApps.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredApps, appPage]);

  // Icon getter for tabs
  const getTabIcon = (feature: PanelFeature) => {
    switch (feature) {
      case 'Dashboard':
      case 'Analytics':
      case 'Performance':
        return LayoutDashboard;
      case 'Applications':
      case 'Application Management':
        return FileText;
      case 'Reports':
        return MessageSquare;
      case 'Users':
      case 'Staff Management':
        return Users;
      case 'Task Management':
        return Shield;
      case 'Notifications':
        return Bell;
      case 'Settings':
        return SettingsIcon;
      default:
        return Sparkles;
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-white p-4 sm:p-8 space-y-8 pb-24">
      {/* Dynamic Panel Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-panel border border-secondary/30 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden space-y-6"
      >
        {/* Color Glow Backdrop */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-[100px] opacity-20 pointer-events-none"
          style={{ backgroundColor: panel.color || '#06b6d4' }}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center text-3xl sm:text-4xl shadow-2xl border border-white/20 shrink-0"
              style={{ backgroundColor: `${panel.color}25` }}
            >
              {panel.emoji || '⚡'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-canvas/80 text-cyan-300 border border-cyan-500/30">
                  Assigned Role: {panel.assignedRole}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-panel text-slate-400 border border-secondary/30">
                  {panel.features.length} Active Module{panel.features.length === 1 ? '' : 's'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
                {panel.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium max-w-2xl">
                {panel.description || 'Custom role workspace configured by Owner.'}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Module Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-t border-secondary/20 pt-6 scrollbar-none">
          {panel.features.map((feat) => {
            const Icon = getTabIcon(feat);
            const isActive = activeTab === feat;
            return (
              <button
                key={feat}
                onClick={() => {
                  setActiveTab(feat);
                  setAppPage(1);
                }}
                className={`px-5 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-cyan-600 text-white shadow-lg shadow-primary/20 border border-cyan-300/50'
                    : 'bg-canvas/70 hover:bg-slate-800 text-slate-300 border border-secondary/30'
                }`}
              >
                <Icon className="w-4 h-4 text-cyan-400" />
                <span>{feat}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Feature Content Switcher */}
      <AnimatePresence mode="wait">
        {(activeTab === 'Applications' || activeTab === 'Application Management') && (
          <motion.div
            key="applications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Filter Bar */}
            <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative">
                  <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={appCategoryFilter}
                    onChange={(e) => {
                      setAppCategoryFilter(e.target.value);
                      setAppPage(1);
                    }}
                    className="bg-canvas border border-secondary/30 rounded-2xl pl-10 pr-8 py-3 text-xs font-black text-white outline-none cursor-pointer appearance-none min-w-[180px] focus:border-cyan-400"
                  >
                    <option value="All">All Categories</option>
                    <option value="Developer Apply">Developer Apply</option>
                    <option value="Staff Apply">Staff Apply</option>
                    <option value="Moderator Apply">Moderator Apply</option>
                    <option value="Helper Apply">Helper Apply</option>
                  </select>
                </div>

                <div className="relative">
                  <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={appStatusFilter}
                    onChange={(e) => {
                      setAppStatusFilter(e.target.value);
                      setAppPage(1);
                    }}
                    className="bg-canvas border border-secondary/30 rounded-2xl pl-10 pr-8 py-3 text-xs font-black text-white outline-none cursor-pointer appearance-none min-w-[180px] focus:border-cyan-400"
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
                  onChange={(e) => {
                    setAppSearch(e.target.value);
                    setAppPage(1);
                  }}
                  placeholder="Search applicants by name, discord, or ID..."
                  className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Application Cards Grid */}
            <div className="space-y-4">
              {filteredApps.length === 0 ? (
                <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-400 font-bold uppercase text-xs">
                  No applications found matching the selected filters.
                </div>
              ) : (
                paginatedApps.map((app) => {
                  const seen = isSeenByCurrentUser(app);
                  return (
                    <div
                      key={app.id}
                      className="bg-panel border border-secondary/30 rounded-[2rem] p-6 sm:p-8 shadow-2xl hover:border-cyan-400/30 transition-all space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-5">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-slate-500">ID: {app.id}</span>
                            {seen ? (
                              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-slate-800/80 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider flex items-center gap-1">
                                <Eye className="w-3 h-3 text-cyan-400" /> SEEN
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-400/40 uppercase tracking-wider animate-pulse flex items-center gap-1">
                                ✨ NEW
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                            {app.applicantName}{' '}
                            <span className="text-slate-400 font-medium text-sm">
                              ({app.discordUsername || 'Discord N/A'})
                            </span>
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3.5 py-1.5 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-cyan-400 uppercase">
                            {app.category}
                          </span>
                        </div>
                      </div>

                      {/* Top Questions Preview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(QUESTIONS[app.category] || []).slice(0, 2).map((q, i) => (
                          <div key={i} className="p-4 bg-canvas/60 rounded-2xl border border-secondary/15 space-y-1">
                            <div className="text-[10px] font-black text-cyan-400 uppercase">Q: {q}</div>
                            <div className="text-xs text-slate-300 font-medium italic truncate">
                              "{app.answers[i.toString()] || app.answers[q] || 'N/A'}"
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Primary Cinematic View Button */}
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="w-full py-4 bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-500 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-primary/20 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Complete Application</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalAppPages > 1 && (
              <div className="flex items-center justify-between bg-panel border border-secondary/30 rounded-2xl p-4">
                <button
                  onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                  disabled={appPage === 1}
                  className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-cyan-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Page {appPage} of {totalAppPages}
                </span>
                <button
                  onClick={() => setAppPage((p) => Math.min(totalAppPages, p + 1))}
                  disabled={appPage === totalAppPages}
                  className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-cyan-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        )}

        {(activeTab === 'Dashboard' || activeTab === 'Analytics' || activeTab === 'Performance') && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Applications</span>
              <div className="text-3xl font-black text-white">{applications.length}</div>
            </div>
            <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Under Review</span>
              <div className="text-3xl font-black text-indigo-300">
                {applications.filter((a) => a.status === 'Under Review').length}
              </div>
            </div>
            <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Accepted</span>
              <div className="text-3xl font-black text-emerald-400">
                {applications.filter((a) => a.status === 'Accepted').length}
              </div>
            </div>
            <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Rejected</span>
              <div className="text-3xl font-black text-red-400">
                {applications.filter((a) => a.status === 'Rejected').length}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'Task Management' && (
          <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StaffTasksPanel key={panel.id} />
          </motion.div>
        )}

        {(activeTab === 'Reports' || activeTab === 'Users' || activeTab === 'Staff Management' || activeTab === 'Settings' || activeTab === 'Notifications' || activeTab === 'Custom features') && (
          <motion.div
            key="default-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-panel border border-secondary/30 rounded-3xl p-8 space-y-4 text-center"
          >
            <Sparkles className="w-10 h-10 text-cyan-400 mx-auto" />
            <h3 className="text-lg font-black uppercase text-white">{activeTab} Module Active</h3>
            <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
              This module is active and synced with real-time Firebase backend for role {panel.assignedRole}.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Detail Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          isOpen={Boolean(selectedApp)}
          onClose={() => setSelectedApp(null)}
          application={selectedApp}
          onUpdate={async () => {
            const updated = await fetchApplicationsFromFirestore();
            setApplications(deduplicateApplications(updated));
          }}
          currentUserRole={userProfile?.role || 'USER'}
        />
      )}
    </div>
  );
};
