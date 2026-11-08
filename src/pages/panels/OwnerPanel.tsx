import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
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
  saveSystemSettings,
  fetchSystemSettings,
  fetchGlobalStats,
  updateUserRole,
  deleteAllApplications,
  auditAndFixOwnerRoles,
  updateApplicationStatus,
  fetchRolesFromFirestore,
  addCustomRole,
  updateCustomRole,
  deleteCustomRole,
  fetchCustomPanelsFromFirestore,
  subscribeToCustomPanels,
  addCustomPanel,
  updateCustomPanel,
  deleteCustomPanel,
  fetchSystemPanelsConfig,
  saveSystemPanelsConfig,
  SystemPanelConfig,
  DEFAULT_SYSTEM_PANELS,
} from '../../lib/storage';
import { resetSystemPanelToDefault } from '../../lib/panelService';
import { db, isFirebaseEnabled, setFirebaseEnabled } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  StaffApplication,
  UserProfile,
  UserRole,
  UserReport,
  AuditLogEntry,
  QUESTIONS,
  ApplicationCategory,
  SystemSettings,
  Task,
  RoleDefinition,
  Permission,
  CustomPanel,
  PanelFeature,
  DEFAULT_AI_MODELS,
  PanelAIConfig,
  PanelPermissionSettings,
  AIModelConfig,
} from '../../types';
import { UserProfileDetailModal } from './UserProfileDetailModal';
import { ApplicationDetailModal } from '../../components/ApplicationDetailModal';
import { ReportMediaPreview } from '../../components/ReportMediaPreview';
import { SystemHealthPanel } from '../../components/SystemHealthPanel';
import { DeploymentHealthChecker } from '../../components/DeploymentHealthChecker';
import { StaffPerformanceDashboard } from '../../components/StaffPerformanceDashboard';
import { GitHubSyncCard } from '../../components/GitHubSyncCard';
import { TaskDelegationForm } from '../../components/TaskDelegationForm';
import { StaffTasksPanel } from '../../components/StaffTasksPanel';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { OwnerDiagnosticPanel } from '../../components/OwnerDiagnosticPanel';
import { checkAndProcessAutoRejectionsLocal, addTask, getTasks, updateTask, fetchTasksFromFirestore, deleteTask } from '../../lib/storage';
import {
  Crown,
  Users,
  FileText,
  Search,
  Activity,
  Award,
  Eye,
  AlertCircle,
  Clock,
  RefreshCw,
  BarChart3,
  ClipboardList,
  Settings,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Filter,
  Video,
  Image as ImageIcon,
  FileQuestion,
  Hammer,
  Shield,
  HelpCircle,
  Bookmark,
  Trash2,
  Loader2,
  AlertTriangle,
  Moon,
  Sun,
  Cpu,
  Send,
  Megaphone,
  Bell,
  Plus,
  Key,
  Edit3,
  ShieldCheck,
  Check,
  UserCheck,
  Sparkles,
  ArrowUp,
  ArrowDown,
  GripVertical,
  EyeOff,
  Globe,
  Lock,
  Bot,
  Layers,
} from 'lucide-react';
const ALL_PERMISSIONS: { id: Permission; label: string; desc: string }[] = [
  { id: 'applications.view', label: 'View Applications', desc: 'Inspect candidate application forms and questionnaires' },
  { id: 'applications.review', label: 'Review Applications', desc: 'Add reviewer observations and set Under Review status' },
  { id: 'applications.accept', label: 'Accept Applications', desc: 'Grant formal acceptance decisions' },
  { id: 'applications.reject', label: 'Reject Applications', desc: 'Formally reject applications' },
  { id: 'applications.delete', label: 'Delete Applications', desc: 'Purge applications from the portal' },
  { id: 'reports.view', label: 'View Reports', desc: 'Access community safety and player incident reports' },
  { id: 'reports.manage', label: 'Manage Reports', desc: 'Resolve, investigate, and delete user incident reports' },
  { id: 'tasks.create', label: 'Create Tasks', desc: 'Delegate operational duties to staff and moderators' },
  { id: 'tasks.manage', label: 'Manage Tasks', desc: 'Update progress status and mark tasks completed' },
  { id: 'members.view', label: 'View Members', desc: 'Browse registered member directory' },
  { id: 'members.manage', label: 'Manage Members', desc: 'Change member roles and manage status' },
  { id: 'roles.view', label: 'View Roles', desc: 'Inspect existing system and custom role definitions' },
  { id: 'roles.manage', label: 'Manage Roles', desc: 'Create, modify permissions, or remove custom roles' },
  { id: 'settings.manage', label: 'Manage Settings', desc: 'Adjust global recruitment toggles and portal controls' },
  { id: 'audit.view', label: 'View Audit Logs', desc: 'Inspect operational security logs and audit trails' },
];

export const OwnerPanel: React.FC = () => {
  const { currentUser, userProfile: currentUserProfile, isOwner } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'reports' | 'applications' | 'settings' | 'health' | 'tasks' | 'roles' | 'panel-builder'>('dashboard');

  // Custom Panel Builder State
  const [customPanels, setCustomPanels] = useState<CustomPanel[]>([]);
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<CustomPanel | null>(null);
  const [panelFormName, setPanelFormName] = useState('');
  const [panelFormDesc, setPanelFormDesc] = useState('');
  const [panelFormColor, setPanelFormColor] = useState('#06b6d4');
  const [panelFormRole, setPanelFormRole] = useState('STAFF');
  const [panelFormFeatures, setPanelFormFeatures] = useState<PanelFeature[]>(['Dashboard', 'Applications']);
  const [panelFormEmoji, setPanelFormEmoji] = useState('⚡');
  const [panelFormVisibility, setPanelFormVisibility] = useState<'role_only' | 'public' | 'hidden'>('role_only');
  const [panelFormSidebarOrder, setPanelFormSidebarOrder] = useState<number>(10);
  const [panelFormFeaturePermissions, setPanelFormFeaturePermissions] = useState<Record<string, PanelPermissionSettings>>({});
  const [panelFormAIConfig, setPanelFormAIConfig] = useState<PanelAIConfig>({
    enabled: true,
    defaultModelId: 'gemini-3.8-flash',
    systemInstruction: 'Analyze applicant responses and evaluate rule compliance impartially.',
    models: DEFAULT_AI_MODELS,
  });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [panelToDelete, setPanelToDelete] = useState<CustomPanel | null>(null);
  const [panelSearch, setPanelSearch] = useState('');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [savingPanel, setSavingPanel] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  // System Panels Configuration State
  const [systemPanelsConfig, setSystemPanelsConfig] = useState<Record<string, SystemPanelConfig>>(DEFAULT_SYSTEM_PANELS);
  const [editingSystemPanel, setEditingSystemPanel] = useState<SystemPanelConfig | null>(null);
  const [sysFormName, setSysFormName] = useState('');
  const [sysFormDesc, setSysFormDesc] = useState('');
  const [sysFormColor, setSysFormColor] = useState('#06b6d4');
  const [sysFormEmoji, setSysFormEmoji] = useState('🛡️');
  const [sysFormFeatures, setSysFormFeatures] = useState<PanelFeature[]>([]);
  const [savingSystemPanel, setSavingSystemPanel] = useState(false);


  const [users, setUsers] = useState<UserProfile[]>([]);
  const [applications, setApplications] = useState<StaffApplication[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [systemSettings, setSystemSettingsState] = useState<SystemSettings | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [updatingCategories, setUpdatingCategories] = useState<Record<string, boolean>>({});
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  
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
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [inspectUser, setSelectedInspectUser] = useState<UserProfile | null>(null);
  const [selectedApp, setSelectedApp] = useState<StaffApplication | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [appCategoryFilter, setAppCategoryFilter] = useState<string>('All');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('All');
  const [reportFilter, setReportFilter] = useState<string>('All');
  const [reportSearch, setReportSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [reviewNote, setReviewNote] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [reportToDelete, setReportToDelete] = useState<UserReport | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  
  // Role Management State
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [roleNameToCreate, setRoleNameToCreate] = useState('');
  const [rolePermissionsToCreate, setRolePermissionsToCreate] = useState<Permission[]>([]);
  const [roleMemberAssignUser, setRoleMemberAssignUser] = useState<UserProfile | null>(null);
  const [selectedAssignRole, setSelectedAssignRole] = useState<string>('USER');
  const [roleMemberSearch, setRoleMemberSearch] = useState('');
  const [roleToDelete, setRoleToDelete] = useState<RoleDefinition | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  // Browser Notifications State
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  
  const [taskSearch, setTaskSearch] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [firestoreRole, setFirestoreRole] = useState<string>('Loading...');
  const [verifyingOwner, setVerifyingOwner] = useState<boolean>(false);

  const checkFirestoreRole = async () => {
    if (!currentUser?.uid) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setFirestoreRole(data.role || 'UNKNOWN');
      } else {
        setFirestoreRole('Document Not Found');
      }
    } catch (err) {
      setFirestoreRole('Error Fetching');
    }
  };

  const handleVerifyOwner = async () => {
    if (!currentUser) return;
    setVerifyingOwner(true);
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      let role = snap.exists() ? snap.data().role : null;

      if (currentUser.email?.toLowerCase() === 'flickblaze7@gmail.com' || currentUser.uid === 'NtQwPhiWQpRRnq2klOAKnSWoQKi1') {
        if (role !== 'OWNER') {
          console.log('[Diagnostic] Forcing OWNER role assignment for authorized owner UID/email');
          await updateUserRole(currentUser.uid, 'OWNER', 'DIAGNOSTIC_PANEL_VERIFY');
          role = 'OWNER';
        }
      }
      setFirestoreRole(role || 'UNKNOWN');
      alert(`Diagnostic Verification Successful!\nAuth UID: ${currentUser.uid}\nFirestore Role: ${role}\nEmail: ${currentUser.email}`);
      window.location.reload();
    } catch (err: any) {
      alert('Verification error: ' + (err?.message || 'Unknown error'));
    } finally {
      setVerifyingOwner(false);
    }
  };

  useEffect(() => {
    let unsubPanels: (() => void) | null = null;
    if (currentUser) {
      checkFirestoreRole();
      unsubPanels = subscribeToCustomPanels((panels) => {
        setCustomPanels(panels);
      });
    }
    return () => {
      if (unsubPanels) unsubPanels();
    };
  }, [currentUser]);

  const loadOwnerData = async () => {
    setLoadingInitial(true);
    try {
      await checkAndProcessAutoRejectionsLocal();
      
      const [uList, aListRaw, rList, lList, settings, liveStats, tList, rRoles, sysCfg] = await Promise.all([
        fetchUsersFromFirestore(),
        fetchApplicationsFromFirestore(),
        fetchReports(),
        fetchAuditLogsFromFirestore(),
        fetchSystemSettings(),
        fetchGlobalStats(),
        fetchTasksFromFirestore(),
        fetchRolesFromFirestore(),
        fetchSystemPanelsConfig(),
      ]);

      setUsers(uList);
      setRoles(rRoles);
      const uniqueApps = deduplicateApplications(aListRaw);
      setApplications(uniqueApps);
      rList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(rList);
      lList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(lList);
      setSystemSettingsState(settings);
      setStats(liveStats);
      setTasks(tList);
      if (sysCfg) setSystemPanelsConfig(sysCfg);
    } catch (err) {
      console.error('Error loading Owner Panel data:', err);
    } finally {
      setLoadingInitial(false);
      setLoadingStats(false);
    }
  };

  const handleSaveCustomPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelFormName.trim()) {
      setPanelError('Panel name is required.');
      return;
    }
    setSavingPanel(true);
    setPanelError(null);
    try {
      const panelPayload = {
        name: panelFormName.trim(),
        description: panelFormDesc.trim(),
        color: panelFormColor,
        assignedRole: panelFormRole,
        features: panelFormFeatures,
        emoji: panelFormEmoji,
        visibility: panelFormVisibility,
        sidebarOrder: Number(panelFormSidebarOrder) || 10,
        featurePermissions: panelFormFeaturePermissions,
        aiConfig: panelFormAIConfig,
      };

      if (editingPanel) {
        await updateCustomPanel(editingPanel.id, panelPayload);
        alert(`Custom panel "${panelFormName}" updated successfully.`);
      } else {
        await addCustomPanel({
          ...panelPayload,
          createdBy: currentUser?.uid || 'OWNER',
        });
        alert(`Custom panel "${panelFormName}" created and saved to Firestore.`);
      }
      setIsFormDirty(false);
      setIsPanelModalOpen(false);
      setEditingPanel(null);
      await loadOwnerData();
    } catch (err: any) {
      setPanelError(err?.message || 'Failed to save panel.');
    } finally {
      setSavingPanel(false);
    }
  };

  const handleSaveSystemPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSystemPanel || !sysFormName.trim()) return;
    setSavingSystemPanel(true);
    try {
      const updatedConfig = {
        ...systemPanelsConfig,
        [editingSystemPanel.id]: {
          ...editingSystemPanel,
          name: sysFormName.trim(),
          description: sysFormDesc.trim(),
          color: sysFormColor,
          emoji: sysFormEmoji,
          features: sysFormFeatures,
        },
      };
      await saveSystemPanelsConfig(updatedConfig);
      setSystemPanelsConfig(updatedConfig);
      alert(`System panel "${sysFormName}" updated successfully.`);
      setEditingSystemPanel(null);
      await loadOwnerData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update system panel.');
    } finally {
      setSavingSystemPanel(false);
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
        name: currentUserProfile?.name || currentUser.displayName || 'Owner',
        email: currentUser.email || '',
        role: 'OWNER',
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
    if (isOwner) loadOwnerData();
  }, [isOwner]);

  const handleDecision = async (appId: string, status: 'Accepted' | 'Rejected' | 'Under Review') => {
    if (!currentUser || processingId === appId || !appId) return;
    const targetApp = applications.find((a) => a.id === appId);
    setProcessingId(appId);
    try {
      await updateApplicationStatus(
        appId,
        status,
        {
          uid: currentUser.uid,
          name: currentUserProfile?.name || currentUser.displayName || 'Owner',
          role: 'OWNER',
        },
        reviewNote.trim()
      );

      if (targetApp && (status === 'Accepted' || status === 'Rejected')) {
        await addNotification({
          recipientUid: targetApp.applicantUid,
          title: `Application Decision: ${status}`,
          message: `Your application for ${targetApp.position || targetApp.category} status was marked as ${status} by Owner.`,
          type: 'application',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      await logAuditEvent({
        action: `OWNER_DECISION_${status.toUpperCase().replace(/\s+/g, '_')}`,
        actorUid: currentUser.uid,
        actorName: currentUserProfile?.name || 'Owner',
        actorEmail: currentUser.email || '',
        actorRole: 'OWNER',
        targetResource: 'applications',
        targetUid: appId,
        metadata: { position: targetApp?.position || 'Candidate', status },
      });

      await loadOwnerData();
      setReviewNote('');
    } catch (err: any) {
      console.error('Owner decision error:', err);
      alert('Failed to update application: ' + (err?.message || 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleCategory = async (cat: ApplicationCategory) => {
    if (!systemSettings || updatingCategories[cat]) return;
    const currentValue = systemSettings.categoryToggles[cat];
    const newValue = !currentValue;
    
    // Update local state immediately for snappy UI
    const previousToggles = { ...systemSettings.categoryToggles };
    const updatedToggles = { ...previousToggles, [cat]: newValue };
    
    setSystemSettingsState(prev => prev ? {
      ...prev,
      categoryToggles: updatedToggles
    } : null);
    
    setUpdatingCategories(prev => ({ ...prev, [cat]: true }));
    try {
      await saveSystemSettings({ categoryToggles: updatedToggles });
      
      await logAuditEvent({
        action: `CATEGORY_TOGGLE_${cat.toUpperCase().replace(' ', '_')}`,
        actorUid: currentUser?.uid || '',
        actorName: currentUserProfile?.name || 'Owner',
        actorEmail: currentUser?.email || '',
        actorRole: 'OWNER',
        targetResource: 'system_settings',
        metadata: { category: cat, enabled: newValue },
      });
      
      // Success - no alert needed as UI reflects state
    } catch (err) {
      console.error('Toggle error:', err);
      // Revert local state on failure
      setSystemSettingsState(prev => prev ? {
        ...prev,
        categoryToggles: previousToggles
      } : null);
      alert('Failed to update category setting. Reverting to previous state.');
    } finally {
      setUpdatingCategories(prev => ({ ...prev, [cat]: false }));
    }
  };

  // Pagination State
  const [userPage, setUserPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [appPage, setAppPage] = useState(1);
  const USERS_PER_PAGE = 9;
  const ITEMS_PER_PAGE = 6;

  const activeApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchSearch =
        app.applicantName.toLowerCase().includes(appSearch.toLowerCase()) ||
        app.applicantEmail.toLowerCase().includes(appSearch.toLowerCase()) ||
        (app.discordUsername && app.discordUsername.toLowerCase().includes(appSearch.toLowerCase())) ||
        (app.id && app.id.toLowerCase().includes(appSearch.toLowerCase()));

      const matchCategory = appCategoryFilter === 'All' || app.category === appCategoryFilter;

      let matchStatus = true;
      if (appStatusFilter === 'All') {
        matchStatus = app.status === 'Pending' || app.status === 'Under Review';
      } else if (appStatusFilter === 'New') {
        const isSeen = Array.isArray(app.seenBy)
          ? app.seenBy.includes(currentUser?.uid || '')
          : app.seenBy && typeof app.seenBy === 'object'
          ? Boolean(app.seenBy[currentUser?.uid || ''])
          : false;
        matchStatus = !isSeen && (app.status === 'Pending' || app.status === 'Under Review');
      } else if (appStatusFilter === 'Seen') {
        const isSeen = Array.isArray(app.seenBy)
          ? app.seenBy.includes(currentUser?.uid || '')
          : app.seenBy && typeof app.seenBy === 'object'
          ? Boolean(app.seenBy[currentUser?.uid || ''])
          : false;
        matchStatus = isSeen && (app.status === 'Pending' || app.status === 'Under Review');
      } else if (appStatusFilter === 'Archive') {
        matchStatus = app.status === 'Accepted' || app.status === 'Rejected';
      } else {
        matchStatus = app.status === appStatusFilter;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [applications, appSearch, appCategoryFilter, appStatusFilter, currentUser?.uid]);

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const matchSearch = rep.subject.toLowerCase().includes(reportSearch.toLowerCase());
      if (reportFilter === 'Saved') return matchSearch && !!currentUser && Array.isArray(rep.savedBy) && rep.savedBy.includes(currentUser.uid);
      if (reportFilter === 'Video') return matchSearch && !!rep.videoLink;
      if (reportFilter === 'Photo') return matchSearch && !!rep.evidenceUrl;
      if (reportFilter === 'Basic') return matchSearch && !rep.videoLink && !rep.evidenceUrl;
      return matchSearch;
    });
  }, [reports, reportSearch, reportFilter, currentUser]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole = roleFilter === 'All' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, userSearch, roleFilter]);

  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
  const totalReportPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1;
  const totalAppPages = Math.ceil(activeApplications.length / ITEMS_PER_PAGE) || 1;

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, userPage]);

  const paginatedReports = useMemo(() => {
    const start = (reportPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, reportPage]);

  const paginatedApps = useMemo(() => {
    const start = (appPage - 1) * ITEMS_PER_PAGE;
    return activeApplications.slice(start, start + ITEMS_PER_PAGE);
  }, [activeApplications, appPage]);


  if (!isOwner) return <div className="max-w-md mx-auto py-20 text-center text-red-300 bg-panel border border-red-900/50 rounded-2xl p-8 mt-10 shadow-2xl">Access Denied</div>;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-8 text-white font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-secondary/20 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase tracking-widest">
            <Crown className="w-5 h-5" />
            <span>Supreme Ownership — Flick Staff Apply V2.1</span>
          </div>
          <h1 className="text-4xl font-black text-white uppercase mt-2 italic tracking-tight">Owner Command</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2 bg-panel p-1.5 rounded-2xl border border-secondary/30">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'dashboard' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'users' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <Users className="w-4 h-4" />
            <span>Users</span>
          </button>
          <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'reports' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <AlertTriangle className="w-4 h-4" />
            <span>Reports</span>
          </button>
          <button onClick={() => setActiveTab('applications')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'applications' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <FileText className="w-4 h-4" />
            <span>Applications</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button onClick={() => setActiveTab('tasks')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'tasks' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <ClipboardList className="w-4 h-4" />
            <span>Tasks</span>
          </button>
          <button onClick={() => setActiveTab('health')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'health' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <Cpu className="w-4 h-4" />
            <span>Deployment Health</span>
          </button>
          <button onClick={() => setActiveTab('roles')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'roles' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <Shield className="w-4 h-4" />
            <span>Roles</span>
          </button>
          <button onClick={() => setActiveTab('panel-builder')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'panel-builder' ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-slate-300 hover:text-white'}`}>
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Panel Builder</span>
          </button>
        </nav>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div key="dash" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
            <div className="bg-panel border border-amber-400/40 rounded-[2rem] p-6 shadow-2xl space-y-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5"><Crown className="w-32 h-32 text-amber-300" /></div>
               <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                  <div className="space-y-1">
                     <div className="text-xs font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Owner Security & Role Diagnostic Panel
                     </div>
                     <div className="text-xs text-slate-300 font-mono">Auth UID: <span className="text-cyan-400">{currentUser?.uid || 'N/A'}</span></div>
                     <div className="text-xs text-slate-300 font-mono">Firestore Document Role: <span className="text-emerald-400 font-bold">{firestoreRole}</span></div>
                     <div className="text-xs text-slate-300 font-mono">Email: <span className="text-white">{currentUser?.email || 'N/A'}</span></div>
                  </div>
                  <button
                     onClick={handleVerifyOwner}
                     disabled={verifyingOwner}
                     className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-black font-black uppercase text-xs rounded-xl shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                     {verifyingOwner ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                     <span>Verify Owner</span>
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2 shadow-xl hover:border-amber-400/20 transition-all">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Users</span>
                <div className="text-3xl font-black text-white">{stats.totalUsers}</div>
              </div>
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2 shadow-xl hover:border-cyan-400/20 transition-all">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Apps</span>
                <div className="text-3xl font-black text-cyan-400">{stats.pendingApps}</div>
              </div>
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2 shadow-xl hover:border-emerald-400/20 transition-all">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accepted</span>
                <div className="text-3xl font-black text-emerald-400">{stats.acceptedApps}</div>
              </div>
              <div className="bg-panel border border-secondary/30 p-6 rounded-3xl space-y-2 shadow-xl hover:border-amber-400/20 transition-all">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Reports</span>
                <div className="text-3xl font-black text-amber-400">{stats.openReports}</div>
              </div>
            </div>

            <StaffPerformanceDashboard
              applications={applications}
              reports={reports}
              auditLogs={auditLogs}
              currentUserName={currentUserProfile?.name || currentUser?.email || 'Owner'}
              currentRole={currentUserProfile?.role || 'OWNER'}
            />
            <SystemHealthPanel />

            <div className="bg-panel border border-secondary/30 rounded-[2rem] p-6 space-y-4 shadow-2xl">
               <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 px-2"><Activity className="w-5 h-5 text-amber-300" /> Recent System Audit</h3>
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {auditLogs.slice(0, 8).map(log => (
                    <div key={log.id} className="p-4 bg-canvas/60 rounded-2xl border border-secondary/10 flex items-center justify-between text-[11px] group hover:bg-canvas transition-all">
                       <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-white group-hover:text-amber-300 transition-colors">{log.actorName} <span className="text-slate-500 font-medium">({log.actorRole})</span></span>
                          <span className="text-amber-400 font-bold uppercase">{log.action}</span>
                       </div>
                       <span className="text-slate-500 font-mono italic">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name, email, or UID..." className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-amber-400" />
              </div>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-canvas border border-secondary/30 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer">
                <option value="All">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MOD">Moderator</option>
                <option value="STAFF">Staff</option>
                <option value="USER">User</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {paginatedUsers.map(u => (
                  <div key={u.uid} className="bg-panel border border-secondary/30 rounded-[1.5rem] p-5 flex items-center justify-between group hover:border-amber-400/40 transition-all shadow-lg hover:shadow-amber-400/5">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center font-black text-white shadow-xl border border-secondary/30 overflow-hidden shrink-0">
                           {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                           <div className="text-sm font-black text-white truncate">{u.name}</div>
                           <div className="text-[10px] text-slate-500 font-mono truncate">{u.role}</div>
                        </div>
                     </div>
                     <button onClick={() => setSelectedInspectUser(u)} className="p-2.5 bg-canvas hover:bg-amber-400 hover:text-black rounded-xl border border-secondary/30 transition-all shrink-0"><Eye className="w-4 h-4" /></button>
                  </div>
               ))}
            </div>

            {totalUserPages > 1 && (
              <div className="flex items-center justify-between bg-panel border border-secondary/30 rounded-2xl p-4">
                <button
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-amber-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-xs font-mono font-bold text-slate-300">
                  Page {userPage} of {totalUserPages}
                </span>
                <button
                  onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                  disabled={userPage === totalUserPages}
                  className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-amber-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}

          </motion.div>
        )}

        {activeTab === 'reports' && (
           <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-6">
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} className="bg-canvas border border-secondary/30 rounded-xl px-4 py-2 text-[11px] font-black text-white outline-none cursor-pointer pr-10 appearance-none min-w-[160px]">
                       <option value="All">All</option>
                       <option value="Saved">Saved</option>
                       <option value="Basic">Basic</option>
                       <option value="Video">Video</option>
                       <option value="Photo">Photo</option>
                    </select>
                 </div>
                 <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} placeholder="Search reports..." className="w-full bg-canvas border border-secondary/30 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-white outline-none focus:border-amber-400" />
                 </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                 {filteredReports.length === 0 ? (
                    <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-500 font-bold uppercase text-xs">
                       {reportFilter === 'Saved' ? 'No saved reports for later' : 'No reports match criteria'}
                    </div>
                 ) : (
                    paginatedReports.map(r => (
                       <div key={r.id} className="bg-panel border border-secondary/30 rounded-[2rem] p-6 shadow-2xl hover:border-amber-400/20 transition-all flex flex-col sm:flex-row justify-between gap-6">
                          <div className="space-y-3 flex-1">
                             <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${r.status === 'Resolved' ? 'bg-emerald-950 text-emerald-400' : 'bg-blue-950 text-blue-400'}`}>{r.status}</span>
                                {currentUser && r.savedBy?.includes(currentUser.uid) && (
                                   <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/30 uppercase flex items-center gap-1">
                                      <Bookmark className="w-3 h-3 fill-amber-300" /> Saved
                                   </span>
                                )}
                                <h4 className="text-base font-black text-white uppercase">{r.subject}</h4>
                             </div>
                             <p className="text-xs text-slate-300 italic bg-canvas/40 p-4 rounded-2xl border border-secondary/10 leading-relaxed">"{r.description}"</p>
                             <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                                <span>REPORTER: <span className="text-white">{r.authorName}</span></span>
                                <span>DATE: <span className="text-white">{new Date(r.createdAt).toLocaleDateString()}</span></span>
                             </div>
                          </div>
                          <div className="flex flex-col gap-3 shrink-0 min-w-[150px]">
                             <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 py-2 px-3 bg-canvas/60 rounded-xl border border-secondary/20 flex-1 justify-center">
                                   {r.videoLink && <Video className="w-4 h-4 text-indigo-400" />}
                                   {r.evidenceUrl && <ImageIcon className="w-4 h-4 text-cyan-400" />}
                                   {!r.videoLink && !r.evidenceUrl && <FileText className="w-4 h-4 text-slate-600" />}
                                </div>
                                <div className="flex items-center gap-1">
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
                                </div>
                             </div>
                             <button onClick={() => setSelectedReport(r)} className="w-full py-2 bg-canvas hover:bg-amber-400 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-wider border border-secondary/35 transition-all">Review</button>
                             <button onClick={() => {
                                updateReport(r.id!, { status: r.status === 'Resolved' ? 'Open' : 'Resolved' });
                                loadOwnerData();
                             }} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md ${r.status === 'Resolved' ? 'bg-canvas text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
                                {r.status === 'Resolved' ? 'Re-open' : 'Mark Resolved'}
                             </button>
                          </div>
                       </div>
                    ))
                 )}
              </div>

              {totalReportPages > 1 && (
                <div className="flex items-center justify-between bg-panel border border-secondary/30 rounded-2xl p-4">
                  <button
                    onClick={() => setReportPage(p => Math.max(1, p - 1))}
                    disabled={reportPage === 1}
                    className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-amber-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Page {reportPage} of {totalReportPages}
                  </span>
                  <button
                    onClick={() => setReportPage(p => Math.min(totalReportPages, p + 1))}
                    disabled={reportPage === totalReportPages}
                    className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-amber-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}

           </motion.div>
        )}

        {activeTab === 'applications' && (
           <motion.div key="applications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-4">
                 <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <select value={appCategoryFilter} onChange={(e) => setAppCategoryFilter(e.target.value)} className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2.5 text-[11px] font-black text-white outline-none cursor-pointer appearance-none min-w-[180px] focus:border-amber-400/50">
                        <option value="All">All Categories</option>
                        <option value="Developer Apply">Developer Apply</option>
                        <option value="Staff Apply">Staff Apply</option>
                        <option value="Moderator Apply">Moderator Apply</option>
                        <option value="Helper Apply">Helper Apply</option>
                      </select>
                    </div>
                    
                    <div className="relative">
                      <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <select value={appStatusFilter} onChange={(e) => setAppStatusFilter(e.target.value)} className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2.5 text-[11px] font-black text-white outline-none cursor-pointer appearance-none pr-10 focus:border-amber-400/50">
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
                    <input type="text" value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder="Search applicants by name, discord, or ID..." className="w-full bg-canvas border border-secondary/30 rounded-2xl py-2.5 pl-12 pr-4 text-xs text-white outline-none focus:border-amber-400" />
                 </div>
              </div>
              <div className="space-y-4">
                 {activeApplications.length === 0 ? (
                    <div className="bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-500 font-bold uppercase text-xs">
                       No applications found matching the selected filters.
                    </div>
                 ) : (
                     paginatedApps.map(app => {
                    const isSeen = Array.isArray(app.seenBy)
                      ? app.seenBy.includes(currentUser?.uid || "")
                      : app.seenBy && typeof app.seenBy === "object"
                      ? Boolean((app.seenBy as any)[currentUser?.uid || ""])
                      : false;

                    return (
                      <div key={app.id} className="bg-panel border border-secondary/30 rounded-[2rem] p-6 sm:p-8 shadow-2xl hover:border-cyan-400/20 transition-all space-y-6">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-4">
                            <div>
                               <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[10px] font-mono font-bold text-slate-500">ID: {app.id}</span>
                                  {isSeen ? (
                                    <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-slate-800/80 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider flex items-center gap-1">
                                      <Eye className="w-3 h-3 text-cyan-400" /> SEEN
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-400/40 uppercase tracking-wider animate-pulse flex items-center gap-1">
                                      ✨ NEW
                                    </span>
                                  )}
                               </div>
                               <h4 className="text-xl font-black text-white uppercase tracking-tight">{app.applicantName} <span className="text-slate-500 font-medium text-sm">({app.discordUsername})</span></h4>
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
                    className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-amber-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Page {appPage} of {totalAppPages}
                  </span>
                  <button
                    onClick={() => setAppPage(p => Math.min(totalAppPages, p + 1))}
                    disabled={appPage === totalAppPages}
                    className="px-4 py-2 bg-canvas border border-secondary/30 rounded-xl text-xs font-bold text-white hover:bg-amber-400 hover:text-black transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}

           </motion.div>
        )}

        {activeTab === 'settings' && (
           <motion.div key="settings" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto py-8 space-y-8">
               <OwnerDiagnosticPanel />
              {/* Recruitment Category Toggles */}
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Settings className="w-40 h-40" /></div>
                 <div className="relative space-y-2">
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Portal Configuration</h3>
                    <p className="text-sm text-slate-400 font-medium">Toggle recruitment availability globally for each application category.</p>
                 </div>
                 <div className="grid grid-cols-1 gap-3">
                    {(['Developer Apply', 'Staff Apply', 'Moderator Apply', 'Helper Apply'] as ApplicationCategory[]).map(cat => {
                       const enabled = systemSettings?.categoryToggles[cat] !== false;
                       return (
                          <div key={cat} className="flex items-center justify-between p-5 bg-canvas/60 rounded-2xl border border-secondary/10 group hover:border-amber-400/40 transition-all shadow-sm">
                             <div className="flex items-center gap-4">
                                <div className={`p-3.5 rounded-xl ${enabled ? 'bg-primary/20 text-cyan-400 border border-cyan-400/30 shadow-cyan-400/5' : 'bg-canvas text-slate-600 border border-secondary/20'} border transition-all`}>
                                   {cat === 'Developer Apply' ? <Activity className="w-5 h-5" /> : cat === 'Staff Apply' ? <Shield className="w-5 h-5" /> : cat === 'Moderator Apply' ? <Hammer className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                   <div className="text-sm font-black text-white uppercase tracking-wide">{cat}</div>
                                   <div className={`text-[9px] font-black uppercase tracking-widest ${enabled ? 'text-emerald-400' : 'text-slate-500'}`}>{enabled ? 'RECRUITMENT OPEN' : 'RECRUITMENT CLOSED'}</div>
                                </div>
                             </div>
                             <button 
                                onClick={() => handleToggleCategory(cat)} 
                                disabled={updatingCategories[cat]}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ${enabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-700 shadow-inner'} ${updatingCategories[cat] ? 'opacity-50 cursor-not-allowed' : ''}`}
                             >
                                {updatingCategories[cat] ? (
                                   <RefreshCw className="w-4 h-4 text-white animate-spin mx-auto" />
                                ) : (
                                   <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all shadow-md ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                )}
                             </button>
                          </div>
                       );
                    })}
                 </div>
              </div>

              {/* Requirements & Guidelines Settings */}
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden">
                 <div className="relative space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Application Requirements & Guidelines</h3>
                    <p className="text-sm text-slate-400 font-medium">Custom text displayed to applicants on the application submission page.</p>
                 </div>
                 <div className="space-y-4">
                    <textarea 
                       value={systemSettings?.requirementsText || ''}
                       onChange={(e) => setSystemSettingsState(prev => prev ? { ...prev, requirementsText: e.target.value } : null)}
                       placeholder="e.g. Min. Age: 14+, Active on Discord, Clean disciplinary history..."
                       rows={3}
                       className="w-full bg-canvas border border-secondary/30 rounded-2xl p-4 text-xs text-white outline-none focus:border-amber-400 shadow-inner resize-none"
                    />
                    <button 
                       onClick={async () => {
                          if (!systemSettings) return;
                          await saveSystemSettings({ requirementsText: systemSettings.requirementsText });
                          alert('Application requirements updated globally.');
                       }}
                       className="py-3 px-6 bg-amber-400 hover:bg-amber-300 text-black font-black uppercase text-xs rounded-xl shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2"
                    >
                       <CheckCircle2 className="w-4 h-4" />
                       <span>Save Requirements</span>
                    </button>
                 </div>
              </div>

              {/* Auto-Reject Expiration Timer Settings */}
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden">
                 <div className="relative space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Auto-Expiration Policy</h3>
                    <p className="text-sm text-slate-400 font-medium">Automatically purge pending applications inactive past the threshold.</p>
                 </div>
                 <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Auto-Removal Threshold (Hours)</label>
                       <select 
                          value={systemSettings?.autoRejectHours || 48}
                          onChange={async (e) => {
                             const hours = parseInt(e.target.value, 10);
                             setSystemSettingsState(prev => prev ? { ...prev, autoRejectHours: hours } : null);
                             await saveSystemSettings({ autoRejectHours: hours });
                          }}
                          className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer"
                       >
                          <option value={24}>24 Hours (1 Day)</option>
                          <option value={48}>48 Hours (2 Days)</option>
                          <option value={72}>72 Hours (3 Days)</option>
                          <option value={168}>168 Hours (1 Week)</option>
                       </select>
                    </div>
                    <div className="p-4 bg-canvas/40 rounded-2xl border border-secondary/10 text-xs text-slate-300 flex-1">
                       <Clock className="w-4 h-4 text-amber-400 inline mr-1.5" />
                       Pending applications without reviewer movement past this duration will be auto-removed.
                    </div>
                 </div>
              </div>

              {/* Global Security & Emergency Actions */}
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Activity className="w-40 h-40" /></div>
                 <div className="relative space-y-2">
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Global Platform Controls</h3>
                    <p className="text-sm text-slate-400 font-medium">Manage platform accessibility, broadcasts, and system emergency resets.</p>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between p-5 bg-canvas/60 rounded-2xl border border-secondary/10">
                          <div className="flex items-center gap-4">
                             <div className={`p-3 rounded-xl ${systemSettings?.maintenanceMode ? 'bg-red-950 text-red-400 border-red-500/30' : 'bg-canvas text-slate-500 border-secondary/20'} border transition-all`}>
                                <Hammer className="w-5 h-5" />
                             </div>
                             <div>
                                <div className="text-sm font-black text-white uppercase tracking-wide">Maintenance Mode</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Disable user portal access</div>
                             </div>
                          </div>
                          <button 
                             onClick={async () => {
                                if (!systemSettings) return;
                                const newVal = !systemSettings.maintenanceMode;
                                setSystemSettingsState({ ...systemSettings, maintenanceMode: newVal });
                                await saveSystemSettings({ maintenanceMode: newVal });
                             }}
                             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${systemSettings?.maintenanceMode ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-slate-700 shadow-inner'}`}
                          >
                             <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${systemSettings?.maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                       </div>

                       <div className="flex items-center justify-between p-5 bg-canvas/60 rounded-2xl border border-secondary/10">
                          <div className="flex items-center gap-4">
                             <div className={`p-3 rounded-xl ${systemSettings?.registrationLocked ? 'bg-amber-950 text-amber-400 border-amber-500/30' : 'bg-canvas text-slate-500 border-secondary/20'} border transition-all`}>
                                <Shield className="w-5 h-5" />
                             </div>
                             <div>
                                <div className="text-sm font-black text-white uppercase tracking-wide">Registration Lock</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Prevent new user registrations</div>
                             </div>
                          </div>
                          <button 
                             onClick={async () => {
                                if (!systemSettings) return;
                                const newVal = !systemSettings.registrationLocked;
                                setSystemSettingsState({ ...systemSettings, registrationLocked: newVal });
                                await saveSystemSettings({ registrationLocked: newVal });
                             }}
                             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${systemSettings?.registrationLocked ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-slate-700 shadow-inner'}`}
                          >
                             <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${systemSettings?.registrationLocked ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="p-5 bg-canvas/60 rounded-2xl border border-secondary/10 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest">
                             <Megaphone className="w-4 h-4 text-amber-400" />
                             <span>Public Broadcast</span>
                          </div>
                          <textarea 
                             value={systemSettings?.publicAnnouncement || ''}
                             onChange={(e) => setSystemSettingsState(prev => prev ? { ...prev, publicAnnouncement: e.target.value } : null)}
                             placeholder="Broadcast a message to all users on the login page..."
                             className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 h-24 resize-none shadow-inner"
                          />
                          <button 
                             onClick={async () => {
                                if (!systemSettings) return;
                                await saveSystemSettings({ publicAnnouncement: systemSettings.publicAnnouncement });
                                alert('Announcement updated globally.');
                             }}
                             className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-black font-black uppercase text-[10px] rounded-xl shadow-lg shadow-amber-400/20 transition-all"
                          >
                             Update Broadcast Message
                          </button>
                       </div>
                    </div>
                 </div>

                 {/* Real Browser Notifications Configuration */}
                 <div className="border-t border-secondary/20 pt-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                       <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                             <Bell className="w-4 h-4 text-cyan-400" /> Browser & Desktop Notifications
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                             Current browser permission: <span className={`font-mono font-bold uppercase ${browserNotificationPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'}`}>{browserNotificationPermission}</span>
                          </p>
                       </div>
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${browserNotificationPermission === 'granted' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'}`}>
                          {browserNotificationPermission === 'granted' ? 'Active' : 'Not Granted'}
                       </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                       <button
                          onClick={async () => {
                             if (!('Notification' in window)) {
                                alert('Desktop notifications are not supported on this browser.');
                                return;
                             }
                             try {
                                const perm = await Notification.requestPermission();
                                setBrowserNotificationPermission(perm);
                                if (perm === 'granted') {
                                   new Notification('Flick Staff Apply V2.1', {
                                      body: 'Browser notifications are now actively enabled for your session!',
                                      icon: '/favicon.ico',
                                   });
                                   alert('Browser notifications successfully enabled!');
                                } else {
                                   alert(`Notification permission status: ${perm}`);
                                }
                             } catch (err: any) {
                                alert('Error requesting notifications: ' + err?.message);
                             }
                          }}
                          className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                       >
                          <Bell className="w-4 h-4" />
                          <span>Enable Browser Notifications</span>
                       </button>

                       <button
                          onClick={() => {
                             if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                                new Notification('Flick Staff Apply V2.1 Test Alert', {
                                   body: 'Test notification: New application received for Developer Apply position.',
                                   icon: '/favicon.ico',
                                });
                             } else {
                                alert('Please click "Enable Browser Notifications" first to grant permission.');
                             }
                          }}
                          className="py-3 px-5 bg-canvas hover:bg-slate-800 border border-secondary/30 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                       >
                          <span>Send Test Notification</span>
                       </button>
                    </div>
                 </div>

                 {/* System Danger Zone */}
                 <div className="border-t border-secondary/20 pt-6 space-y-4">
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4 text-red-400" /> System Danger Zone
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-4">
                       <button 
                          onClick={async () => {
                             if (confirm('AUDIT ROLES: Are you sure you want to scan and downgrade any unauthorized accounts holding OWNER privileges?')) {
                                const removed = await auditAndFixOwnerRoles();
                                alert(`Audit completed. Revoked ${removed} unauthorized owner role assignment(s).`);
                                loadOwnerData();
                             }
                          }}
                          className="flex-1 py-3 px-4 bg-canvas hover:bg-amber-950/40 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2"
                       >
                          <Shield className="w-4 h-4" />
                          <span>Audit Unauthorized Owners</span>
                       </button>

                       <button 
                          onClick={() => {
                             setPurgeError(null);
                             setShowPurgeModal(true);
                          }}
                          className="flex-1 py-3 px-4 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2"
                       >
                          <Trash2 className="w-4 h-4" />
                          <span>Purge All Applications</span>
                       </button>
                    </div>
                 </div>
              </div>

              <GitHubSyncCard />
           </motion.div>
        )}

        {activeTab === 'tasks' && (
           <motion.div key="tasks" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto py-8 space-y-8">
              <TaskDelegationForm onTaskAdded={loadOwnerData} />
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
                 <StaffTasksPanel panelRole="OWNER" />
              </div>
           </motion.div>
        )}

        {activeTab === 'health' && (
           <motion.div key="health" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto py-8">
              <DeploymentHealthChecker />
           </motion.div>
        )}

        {activeTab === 'roles' && (
           <motion.div key="roles" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-6xl mx-auto py-8 space-y-8">
              {/* Role Header Banner */}
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-widest">
                       <ShieldCheck className="w-4 h-4" />
                       <span>Firebase RBAC Architecture</span>
                    </div>
                    <h3 className="text-3xl font-black text-white uppercase italic tracking-tight">Role Management & Permissions</h3>
                    <p className="text-sm text-slate-400 max-w-xl font-medium">
                       Configure built-in system tiers, define custom granular role permissions, and assign authorized privileges to community members with real-time Firebase sync.
                    </p>
                 </div>
                 <button
                    onClick={() => {
                       setEditingRole(null);
                       setRoleNameToCreate('');
                       setRolePermissionsToCreate([]);
                       setShowCreateRoleModal(true);
                    }}
                    className="py-3.5 px-6 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-400/20 transition-all cursor-pointer"
                 >
                    <Plus className="w-4 h-4" />
                    <span>Create Custom Role</span>
                 </button>
              </div>

              {/* Official Built-In System Roles */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Shield className="w-4 h-4 text-amber-400" /> Official Built-In System Roles
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Protected System Hierarchy</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                       { name: 'OWNER', badge: 'bg-amber-400/10 text-amber-300 border-amber-500/30', desc: 'Supreme system executive with unrestricted access across all portals, database operations, and settings.', count: users.filter(u => u.role === 'OWNER').length },
                       { name: 'ADMIN', badge: 'bg-primary/20 text-cyan-300 border-cyan-500/30', desc: 'Administrative management authorized to assign Moderator & Staff roles, coordinate tasks, and review applications.', count: users.filter(u => u.role === 'ADMIN').length },
                       { name: 'MOD', label: 'MODERATOR', badge: 'bg-emerald-950 text-emerald-300 border-emerald-500/30', desc: 'Incident responders authorized to resolve community disputes, manage reports, and review candidates.', count: users.filter(u => u.role === 'MOD').length },
                       { name: 'STAFF', badge: 'bg-indigo-950 text-indigo-300 border-indigo-500/30', desc: 'Active staff team authorized to review candidate questionnaires and file internal recommendations.', count: users.filter(u => u.role === 'STAFF').length },
                       { name: 'USER', badge: 'bg-slate-800 text-slate-300 border-slate-700', desc: 'Standard verified community members with application filing and safety report submission privileges.', count: users.filter(u => u.role === 'USER' || !u.role).length },
                    ].map((sysRole) => (
                       <div key={sysRole.name} className="bg-panel border border-secondary/30 rounded-3xl p-6 shadow-xl space-y-4 hover:border-amber-400/30 transition-all flex flex-col justify-between">
                          <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${sysRole.badge}`}>
                                   {sysRole.label || sysRole.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                   {sysRole.count} Member{sysRole.count === 1 ? '' : 's'}
                                </span>
                             </div>
                             <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {sysRole.desc}
                             </p>
                          </div>
                          <div className="pt-3 border-t border-secondary/15 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                             <span>Immutable Core Role</span>
                             <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Active</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Custom Roles List */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Key className="w-4 h-4 text-cyan-400" /> Custom Defined Roles ({roles.length})
                    </h4>
                 </div>

                 {roles.length === 0 ? (
                    <div className="bg-panel border border-secondary/30 rounded-3xl p-8 text-center space-y-2">
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No custom roles defined yet.</p>
                       <p className="text-xs text-slate-500">Click "Create Custom Role" above to configure a custom title with specific permissions.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {roles.map((r) => {
                          const assignedCount = users.filter((u) => u.customRoleId === r.id || u.role === r.name).length;
                          return (
                             <div key={r.id} className="bg-panel border border-secondary/30 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between hover:border-cyan-400/30 transition-all">
                                <div className="space-y-3">
                                   <div className="flex items-center justify-between">
                                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                         {r.name}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500">
                                         {assignedCount} Assigned
                                      </span>
                                   </div>
                                   <div className="space-y-1.5">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Granted Permissions ({r.permissions?.length || 0})</span>
                                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                         {r.permissions?.map((p) => (
                                            <span key={p} className="text-[9px] font-bold px-2 py-0.5 rounded bg-canvas border border-secondary/20 text-slate-300">
                                               {p}
                                            </span>
                                         ))}
                                      </div>
                                   </div>
                                </div>
                                <div className="pt-3 border-t border-secondary/20 flex gap-2">
                                   <button
                                      onClick={() => {
                                         setEditingRole(r);
                                         setRoleNameToCreate(r.name);
                                         setRolePermissionsToCreate(r.permissions || []);
                                         setShowCreateRoleModal(true);
                                      }}
                                      className="flex-1 py-2 bg-canvas hover:bg-slate-800 border border-secondary/30 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                   >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Edit</span>
                                   </button>
                                   <button
                                      onClick={async () => {
                                         if (r.isSystemRole) {
                                            alert('Built-in system roles cannot be deleted.');
                                            return;
                                         }
                                         const count = users.filter((u) => u.customRoleId === r.id || u.role === r.name).length;
                                         if (confirm(`Are you sure you want to delete role "${r.name}"?${count > 0 ? ` ${count} user(s) with this role will be reassigned to USER.` : ''}`)) {
                                            if (count > 0) {
                                               for (const u of users.filter((user) => user.customRoleId === r.id || user.role === r.name)) {
                                                  await updateUserRole(u.uid, 'USER', currentUser?.uid || 'OWNER');
                                               }
                                            }
                                            await deleteCustomRole(r.id);
                                            await loadOwnerData();
                                            alert(`Role "${r.name}" deleted.`);
                                         }
                                      }}
                                      className="p-2 bg-red-950/40 hover:bg-red-900 border border-red-500/40 text-red-300 rounded-xl transition-all cursor-pointer"
                                      title="Delete Role"
                                   >
                                      <Trash2 className="w-3.5 h-3.5" />
                                   </button>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 )}
              </div>

              {/* Member Role Assignment Section */}
              <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-6">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-6">
                    <div>
                       <h4 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                          <UserCheck className="w-5 h-5 text-amber-400" /> Member Role Assignment
                       </h4>
                       <p className="text-xs text-slate-400 mt-1">Assign built-in or custom roles to registered community members with real-time Firebase sync.</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                       <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input
                          type="text"
                          value={roleMemberSearch}
                          onChange={(e) => setRoleMemberSearch(e.target.value)}
                          placeholder="Search member by name or email..."
                          className="w-full bg-canvas border border-secondary/30 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                    {users
                       .filter((u) =>
                          u.name.toLowerCase().includes(roleMemberSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(roleMemberSearch.toLowerCase()) ||
                          u.role.toLowerCase().includes(roleMemberSearch.toLowerCase())
                       )
                       .map((u) => (
                          <div key={u.uid} className="bg-canvas/60 border border-secondary/20 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-amber-400/20 transition-all">
                             <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 text-primary font-black flex items-center justify-center shrink-0 uppercase">
                                   {u.name.substring(0, 2)}
                                </div>
                                <div className="min-w-0">
                                   <div className="text-sm font-black text-white truncate">{u.name}</div>
                                   <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                                   <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                         u.role === 'OWNER' ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30' :
                                         u.role === 'ADMIN' ? 'bg-primary/20 text-cyan-300 border border-cyan-500/30' :
                                         u.role === 'MOD' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' :
                                         u.role === 'STAFF' ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30' :
                                         'bg-slate-800 text-slate-400 border border-secondary/20'
                                      }`}>
                                         {u.role}
                                      </span>
                                   </div>
                                </div>
                             </div>
                             <button
                                onClick={() => {
                                   setRoleMemberAssignUser(u);
                                   setSelectedAssignRole(u.role);
                                }}
                                className="py-2 px-3.5 bg-canvas hover:bg-slate-800 border border-secondary/30 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-black uppercase transition-all shrink-0 cursor-pointer"
                             >
                                Change Role
                             </button>
                          </div>
                       ))}
                 </div>
              </div>
           </motion.div>
        )}

        {activeTab === "panel-builder" && (
          <motion.div key="panel-builder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Header Banner */}
            <div className="bg-panel border border-cyan-500/30 rounded-[2rem] p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-2 text-xs font-black text-cyan-400 uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" /> Dynamic Panel Builder & Management
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                  Custom Role Panels
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl font-medium">
                  Create custom panels assigned to specific Discord-style roles with selected features. Saved in real-time to Firebase.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingPanel(null);
                  setPanelFormName("");
                  setPanelFormDesc("");
                  setPanelFormColor("#06b6d4");
                  setPanelFormRole("STAFF");
                  setPanelFormFeatures(["Dashboard", "Applications"]);
                  setPanelFormEmoji("⚡");
                  setPanelFormVisibility("role_only");
                  setPanelFormSidebarOrder(10);
                  setPanelFormFeaturePermissions({
                    Dashboard: { view: true, create: false, edit: false, delete: false },
                    Applications: { view: true, create: false, edit: true, delete: false },
                  });
                  setPanelFormAIConfig({
                    enabled: true,
                    defaultModelId: 'gemini-3.8-flash',
                    systemInstruction: 'Analyze candidate responses and evaluate rule compliance impartially.',
                    models: DEFAULT_AI_MODELS,
                  });
                  setIsFormDirty(false);
                  setPanelError(null);
                  setIsPanelModalOpen(true);
                }}
                className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 shadow-lg shadow-cyan-500/20 cursor-pointer shrink-0 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Panel</span>
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="bg-panel border border-secondary/30 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={panelSearch}
                  onChange={(e) => setPanelSearch(e.target.value)}
                  placeholder="Search custom panels by name, role, or feature..."
                  className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">
                {customPanels.length} Panel{customPanels.length === 1 ? "" : "s"} Created
              </div>
            </div>

            {/* Panel Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {customPanels.length === 0 ? (
                <div className="col-span-full bg-panel border border-secondary/30 rounded-3xl p-12 text-center text-slate-400 font-bold uppercase text-xs space-y-3">
                  <Sparkles className="w-10 h-10 text-cyan-400 mx-auto" />
                  <p>No custom panels created yet. Click "Create Custom Panel" to build one.</p>
                </div>
              ) : (
                customPanels
                  .filter(
                    (p) =>
                      p.name.toLowerCase().includes(panelSearch.toLowerCase()) ||
                      p.assignedRole.toLowerCase().includes(panelSearch.toLowerCase()) ||
                      (p.description && p.description.toLowerCase().includes(panelSearch.toLowerCase()))
                  )
                  .map((p) => (
                    <div
                      key={p.id}
                      className="bg-panel border border-secondary/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5 flex flex-col justify-between hover:border-cyan-400/40 transition-all"
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5"
                        style={{ backgroundColor: p.color || "#06b6d4" }}
                      />

                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-canvas border border-secondary/30 flex items-center justify-center text-2xl shadow-inner">
                            {p.emoji || "⚡"}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-canvas text-cyan-300 border border-cyan-500/30">
                            Role: {p.assignedRole}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl font-black uppercase tracking-tight text-white">{p.name}</h3>
                          <p className="text-xs text-slate-400 font-medium line-clamp-2 mt-1">
                            {p.description || "No description provided."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {p.features.map((feat) => (
                            <span
                              key={feat}
                              className="text-[9px] font-bold px-2.5 py-0.5 rounded-md bg-canvas/80 text-slate-300 border border-secondary/20 uppercase"
                            >
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-secondary/20">
                        <button
                          onClick={() => {
                            setEditingPanel(p);
                            setPanelFormName(p.name);
                            setPanelFormDesc(p.description || "");
                            setPanelFormColor(p.color || "#06b6d4");
                            setPanelFormRole(p.assignedRole || "STAFF");
                            setPanelFormFeatures(p.features || ["Dashboard", "Applications"]);
                            setPanelFormEmoji(p.emoji || "⚡");
                            setPanelFormVisibility(p.visibility || "role_only");
                            setPanelFormSidebarOrder(p.sidebarOrder ?? 10);
                            setPanelFormFeaturePermissions(p.featurePermissions || {});
                            setPanelFormAIConfig(
                              p.aiConfig && p.aiConfig.models && p.aiConfig.models.length > 0
                                ? p.aiConfig
                                : {
                                    enabled: true,
                                    defaultModelId: 'gemini-3.8-flash',
                                    systemInstruction: 'Analyze candidate responses and evaluate rule compliance impartially.',
                                    models: DEFAULT_AI_MODELS,
                                  }
                            );
                            setIsFormDirty(false);
                            setPanelError(null);
                            setIsPanelModalOpen(true);
                          }}
                          className="flex-1 py-2.5 bg-canvas hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border border-secondary/30 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setPanelToDelete(p)}
                          className="py-2.5 px-3.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-xl text-xs font-black uppercase flex items-center justify-center border border-red-500/30 transition-all cursor-pointer"
                          title="Delete Panel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* System Panels Management Section */}
            <div className="space-y-4 pt-8 border-t border-secondary/20">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" /> System Panels Configuration (Admin, Moderator, Staff)
                </h3>
                <span className="text-[10px] font-mono text-slate-500 uppercase">System Tiers</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['admin', 'mod', 'staff'].map((sysKey) => {
                  const sp = systemPanelsConfig[sysKey] || DEFAULT_SYSTEM_PANELS[sysKey];
                  return (
                    <div key={sysKey} className="bg-panel border border-secondary/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5 flex flex-col justify-between hover:border-amber-400/30 transition-all">
                      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: sp.color || '#a855f7' }} />
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-canvas border border-secondary/30 flex items-center justify-center text-2xl shadow-inner">
                            {sp.emoji || '🛡️'}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-canvas text-amber-300 border border-amber-500/30">
                            System Panel
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase tracking-tight text-white">{sp.name}</h4>
                          <p className="text-xs text-slate-400 font-medium line-clamp-2 mt-1">{sp.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {sp.features.map(f => (
                            <span key={f} className="text-[9px] font-bold px-2.5 py-0.5 rounded-md bg-canvas/80 text-slate-300 border border-secondary/20 uppercase">{f}</span>
                          ))}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-secondary/20">
                        <button
                          onClick={() => {
                            setEditingSystemPanel(sp);
                            setSysFormName(sp.name);
                            setSysFormDesc(sp.description);
                            setSysFormColor(sp.color);
                            setSysFormEmoji(sp.emoji);
                            setSysFormFeatures(sp.features);
                          }}
                          className="w-full py-2.5 bg-canvas hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border border-secondary/30 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Configure System Panel</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {inspectUser && (
        <UserProfileDetailModal
          user={inspectUser}
          isOpen={!!inspectUser}
          onClose={() => setSelectedInspectUser(null)}
          onProfileUpdated={() => loadOwnerData()}
        />
      )}
      {selectedReport && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-secondary/40 rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative">
               <button onClick={() => setSelectedReport(null)} className="absolute top-6 right-6 p-2 hover:bg-canvas rounded-xl"><ChevronRight className="w-6 h-6 rotate-180" /></button>
               <div className="space-y-6">
                  <div className="flex items-center gap-2 flex-wrap">
                     <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${selectedReport.status === 'Resolved' ? 'bg-emerald-950 text-emerald-400' : 'bg-blue-950 text-blue-400'}`}>{selectedReport.status}</span>
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
                        loadOwnerData();
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

      {/* Owner Report Delete Confirmation Modal */}
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

      {/* Emergency Applications Purge Confirmation Modal */}
      <ConfirmationDialog
        isOpen={showPurgeModal}
        title="Emergency Application Purge"
        message="EMERGENCY ACTION: Are you sure you want to PERMANENTLY DELETE ALL APPLICATIONS from the database? This operation cannot be undone."
        confirmLabel="Purge All Records"
        isLoading={isPurging}
        error={purgeError}
        onConfirm={async () => {
          setIsPurging(true);
          setPurgeError(null);
          try {
            await deleteAllApplications();
            setShowPurgeModal(false);
            loadOwnerData();
          } catch (err: any) {
            console.error('Application purge error:', err);
            setPurgeError(err?.message || 'Failed to purge applications.');
          } finally {
            setIsPurging(false);
          }
        }}
        onCancel={() => {
          setShowPurgeModal(false);
          setPurgeError(null);
        }}
      />

      {/* Application Detail Full Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          isOpen={!!selectedApp}
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={loadOwnerData}
        />
      )}

      {/* Create / Edit Custom Role Modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-panel border border-secondary/40 rounded-[2.5rem] max-w-2xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6 text-white"
          >
            <button
              onClick={() => {
                setShowCreateRoleModal(false);
                setEditingRole(null);
              }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-canvas rounded-xl"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                {editingRole ? 'Modify Existing Role' : 'Create Custom Role Definition'}
              </span>
              <h3 className="text-2xl font-black uppercase italic tracking-tight">
                {editingRole ? `Edit Role: ${editingRole.name}` : 'New Custom Role'}
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Role Display Name
              </label>
              <input
                type="text"
                value={roleNameToCreate}
                onChange={(e) => setRoleNameToCreate(e.target.value)}
                placeholder="e.g. Senior Recruiter, Community Lead, Lead Developer..."
                className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-bold"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Assign Granular Permissions ({rolePermissionsToCreate.length} Selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRolePermissionsToCreate(ALL_PERMISSIONS.map((p) => p.id))}
                    className="text-[10px] font-black text-amber-400 hover:underline uppercase"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => setRolePermissionsToCreate([])}
                    className="text-[10px] font-black text-slate-400 hover:underline uppercase"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map((perm) => {
                  const isChecked = rolePermissionsToCreate.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-amber-400/10 border-amber-400/40 text-white'
                          : 'bg-canvas/60 border-secondary/20 text-slate-400 hover:border-secondary/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setRolePermissionsToCreate((prev) => prev.filter((p) => p !== perm.id));
                          } else {
                            setRolePermissionsToCreate((prev) => [...prev, perm.id]);
                          }
                        }}
                        className="mt-0.5 rounded border-secondary/40 text-amber-400 focus:ring-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-[11px] leading-tight text-white">{perm.label}</div>
                        <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{perm.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-secondary/20 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateRoleModal(false);
                  setEditingRole(null);
                }}
                className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 text-slate-300 rounded-xl text-xs font-black uppercase transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRole || !roleNameToCreate.trim()}
                onClick={async () => {
                  if (!roleNameToCreate.trim()) return;
                  setSavingRole(true);
                  try {
                    if (editingRole) {
                      await updateCustomRole(editingRole.id, {
                        name: roleNameToCreate.trim(),
                        permissions: rolePermissionsToCreate,
                      });
                      alert('Role updated successfully.');
                    } else {
                      await addCustomRole({
                        name: roleNameToCreate.trim(),
                        permissions: rolePermissionsToCreate,
                        isSystemRole: false,
                      });
                      alert('Custom role created and synchronized to Firestore.');
                    }
                    setShowCreateRoleModal(false);
                    setEditingRole(null);
                    setRoleNameToCreate('');
                    setRolePermissionsToCreate([]);
                    await loadOwnerData();
                  } catch (err: any) {
                    alert(err?.message || 'Failed to save role.');
                  } finally {
                    setSavingRole(false);
                  }
                }}
                className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-amber-400/20 disabled:opacity-50 cursor-pointer"
              >
                {savingRole ? 'Saving Role...' : editingRole ? 'Update Role' : 'Save Role to Firebase'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Member Role Assignment Modal */}
      {roleMemberAssignUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-panel border border-secondary/40 rounded-[2.5rem] max-w-md w-full p-8 shadow-2xl relative space-y-6 text-white"
          >
            <button
              onClick={() => setRoleMemberAssignUser(null)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-canvas rounded-xl"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                Assign Authorized Privileges
              </span>
              <h3 className="text-xl font-black uppercase italic tracking-tight">
                Change Role: {roleMemberAssignUser.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">{roleMemberAssignUser.email}</p>
            </div>

            <div className="p-4 bg-canvas/60 rounded-2xl border border-secondary/20 space-y-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                Currently Assigned
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-primary/20 text-cyan-300 border border-cyan-500/30 inline-block">
                {roleMemberAssignUser.role}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Select New Official or Custom Role
              </label>
              <select
                value={selectedAssignRole}
                onChange={(e) => setSelectedAssignRole(e.target.value)}
                className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer"
              >
                <optgroup label="Official System Roles">
                  <option value="USER">USER (Community Member)</option>
                  <option value="STAFF">STAFF (Support & Intake)</option>
                  <option value="MOD">MODERATOR (Safety & Reports)</option>
                  <option value="ADMIN">ADMIN (Operations & Team Management)</option>
                  <option value="OWNER">OWNER (Supreme Access)</option>
                </optgroup>
                {roles.length > 0 && (
                  <optgroup label="Custom Roles">
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} (Custom Role)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="pt-4 border-t border-secondary/20 flex gap-3">
              <button
                type="button"
                onClick={() => setRoleMemberAssignUser(null)}
                className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 text-slate-300 rounded-xl text-xs font-black uppercase transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const activeOwners = users.filter((u) => u.role === 'OWNER');
                  if (roleMemberAssignUser.role === 'OWNER' && selectedAssignRole !== 'OWNER' && activeOwners.length <= 1) {
                    alert('Security Block: You cannot demote or remove the last active Owner of the system.');
                    return;
                  }
                  try {
                    await updateUserRole(roleMemberAssignUser.uid, selectedAssignRole as UserRole, currentUser?.uid || 'OWNER');
                    await logAuditEvent({
                      action: `ROLE_ASSIGNMENT_${selectedAssignRole}`,
                      actorUid: currentUser?.uid || '',
                      actorName: currentUserProfile?.name || 'Owner',
                      actorEmail: currentUser?.email || '',
                      actorRole: 'OWNER',
                      targetResource: 'users',
                      targetUid: roleMemberAssignUser.uid,
                      metadata: { previousRole: roleMemberAssignUser.role, assignedRole: selectedAssignRole },
                    });
                    setRoleMemberAssignUser(null);
                    await loadOwnerData();
                    alert(`Successfully updated role to ${selectedAssignRole}.`);
                  } catch (err: any) {
                    alert(err?.message || 'Failed to update user role.');
                  }
                }}
                className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-amber-400/20 cursor-pointer"
              >
                Save Assignment
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Advanced Panel Builder V2 Modal */}
      {isPanelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-panel border border-secondary/40 rounded-[2.5rem] max-w-5xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-6 text-white"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-secondary/20 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {editingPanel ? 'Edit Custom Role Panel' : 'Advanced Panel Builder V2'}
                </span>
                <h3 className="text-2xl font-black uppercase italic tracking-tight">
                  {editingPanel ? `Edit Panel: ${editingPanel.name}` : 'Create Custom Panel'}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Live preview, drag & reorder modules, role permissions, and Gemini AI defaults.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isFormDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
                  setIsPanelModalOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-white bg-canvas rounded-xl transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {panelError && (
              <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{panelError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomPanel} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Configuration Controls (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-3 bg-canvas/40 p-5 rounded-2xl border border-secondary/20">
                    <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4" /> 1. Panel Identification
                    </h4>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Panel Name
                      </label>
                      <input
                        type="text"
                        value={panelFormName}
                        onChange={(e) => {
                          setPanelFormName(e.target.value);
                          setIsFormDirty(true);
                        }}
                        placeholder="e.g. Senior Staff Operations"
                        className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-400 font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Description
                      </label>
                      <textarea
                        value={panelFormDesc}
                        onChange={(e) => {
                          setPanelFormDesc(e.target.value);
                          setIsFormDirty(true);
                        }}
                        placeholder="Operational scope, workflows, and responsibilities for this role workspace..."
                        rows={2}
                        className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-400 resize-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Styling & Placement */}
                  <div className="space-y-3 bg-canvas/40 p-5 rounded-2xl border border-secondary/20">
                    <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4" /> 2. Appearance & Navigation
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Accent Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={panelFormColor}
                            onChange={(e) => {
                              setPanelFormColor(e.target.value);
                              setIsFormDirty(true);
                            }}
                            className="w-10 h-10 rounded-xl bg-canvas border border-secondary/30 cursor-pointer p-1 shrink-0"
                          />
                          <input
                            type="text"
                            value={panelFormColor}
                            onChange={(e) => {
                              setPanelFormColor(e.target.value);
                              setIsFormDirty(true);
                            }}
                            className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white font-mono uppercase"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Emoji / Icon
                        </label>
                        <input
                          type="text"
                          value={panelFormEmoji}
                          onChange={(e) => {
                            setPanelFormEmoji(e.target.value);
                            setIsFormDirty(true);
                          }}
                          placeholder="⚡"
                          className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white text-center text-lg outline-none focus:border-cyan-400"
                          maxLength={4}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Assigned Role
                        </label>
                        <select
                          value={panelFormRole}
                          onChange={(e) => {
                            setPanelFormRole(e.target.value);
                            setIsFormDirty(true);
                          }}
                          className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
                        >
                          <option value="STAFF">STAFF</option>
                          <option value="MOD">MODERATOR</option>
                          <option value="ADMIN">ADMIN</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.name} (Custom Role)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Sidebar Order
                        </label>
                        <input
                          type="number"
                          value={panelFormSidebarOrder}
                          onChange={(e) => {
                            setPanelFormSidebarOrder(Number(e.target.value));
                            setIsFormDirty(true);
                          }}
                          min={1}
                          max={99}
                          className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white font-bold outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Visibility Setting */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Panel Visibility
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'role_only', label: 'Assigned Role', icon: Lock },
                          { id: 'public', label: 'Public (All)', icon: Globe },
                          { id: 'hidden', label: 'Stealth / Hidden', icon: EyeOff },
                        ].map((v) => {
                          const active = panelFormVisibility === v.id;
                          const IconComp = v.icon;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setPanelFormVisibility(v.id as any);
                                setIsFormDirty(true);
                              }}
                              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                active
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md'
                                  : 'bg-canvas/60 border-secondary/20 text-slate-400 hover:text-white'
                              }`}
                            >
                              <IconComp className="w-3.5 h-3.5" />
                              <span className="text-[10px]">{v.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Feature Modules & Ordering */}
                  <div className="space-y-3 bg-canvas/40 p-5 rounded-2xl border border-secondary/20">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                        <GripVertical className="w-4 h-4" /> 3. Ordered Feature Modules
                      </h4>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {panelFormFeatures.length} Active Modules
                      </span>
                    </div>

                    {/* Ordered Modules List */}
                    <div className="space-y-1.5">
                      {panelFormFeatures.map((feat, idx) => (
                        <div
                          key={feat}
                          className="flex items-center justify-between p-2.5 bg-canvas rounded-xl border border-secondary/20 text-xs text-white"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-panel flex items-center justify-center text-[10px] font-black text-slate-400 font-mono">
                              {idx + 1}
                            </span>
                            <span className="font-bold">{feat}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const next = [...panelFormFeatures];
                                const temp = next[idx - 1];
                                next[idx - 1] = next[idx];
                                next[idx] = temp;
                                setPanelFormFeatures(next);
                                setIsFormDirty(true);
                              }}
                              className="p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-20 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === panelFormFeatures.length - 1}
                              onClick={() => {
                                const next = [...panelFormFeatures];
                                const temp = next[idx + 1];
                                next[idx + 1] = next[idx];
                                next[idx] = temp;
                                setPanelFormFeatures(next);
                                setIsFormDirty(true);
                              }}
                              className="p-1 text-slate-400 hover:text-cyan-400 disabled:opacity-20 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPanelFormFeatures(panelFormFeatures.filter((f) => f !== feat));
                                setIsFormDirty(true);
                              }}
                              className="p-1 text-slate-500 hover:text-red-400 ml-1 cursor-pointer"
                              title="Disable Module"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Available Module Chips to add */}
                    <div className="pt-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                        Click to add module:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            'Dashboard',
                            'Applications',
                            'Application Management',
                            'Reports',
                            'Users',
                            'Staff Management',
                            'Task Management',
                            'Analytics',
                            'Performance',
                            'Notifications',
                            'Settings',
                            'Custom features',
                          ] as PanelFeature[]
                        )
                          .filter((f) => !panelFormFeatures.includes(f))
                          .map((feat) => (
                            <button
                              key={feat}
                              type="button"
                              onClick={() => {
                                setPanelFormFeatures([...panelFormFeatures, feat]);
                                setIsFormDirty(true);
                              }}
                              className="px-2.5 py-1 bg-canvas hover:bg-cyan-500/10 border border-secondary/20 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-cyan-400" />
                              <span>{feat}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Role-Based Feature Permissions Matrix */}
                  <div className="space-y-3 bg-canvas/40 p-5 rounded-2xl border border-secondary/20">
                    <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4" /> 4. Module Permissions Matrix
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Configure granular action permissions for the assigned role across active modules.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-secondary/20 text-slate-400 text-[10px] uppercase font-black">
                            <th className="pb-2">Module</th>
                            <th className="pb-2 text-center">View</th>
                            <th className="pb-2 text-center">Create</th>
                            <th className="pb-2 text-center">Edit</th>
                            <th className="pb-2 text-center">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary/10">
                          {panelFormFeatures.slice(0, 5).map((feat) => {
                            const perms = panelFormFeaturePermissions[feat] || {
                              view: true,
                              create: false,
                              edit: false,
                              delete: false,
                            };
                            const togglePerm = (action: keyof PanelPermissionSettings) => {
                              setPanelFormFeaturePermissions({
                                ...panelFormFeaturePermissions,
                                [feat]: {
                                  ...perms,
                                  [action]: !perms[action],
                                },
                              });
                              setIsFormDirty(true);
                            };
                            return (
                              <tr key={feat} className="text-white">
                                <td className="py-2 font-bold">{feat}</td>
                                <td className="py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perms.view}
                                    onChange={() => togglePerm('view')}
                                    className="rounded border-secondary/40 text-cyan-400 focus:ring-0 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perms.create}
                                    onChange={() => togglePerm('create')}
                                    className="rounded border-secondary/40 text-cyan-400 focus:ring-0 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perms.edit}
                                    onChange={() => togglePerm('edit')}
                                    className="rounded border-secondary/40 text-cyan-400 focus:ring-0 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perms.delete}
                                    onChange={() => togglePerm('delete')}
                                    className="rounded border-secondary/40 text-cyan-400 focus:ring-0 cursor-pointer"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* AI Model Defaults & Configuration */}
                  <div className="space-y-4 bg-canvas/40 p-5 rounded-2xl border border-secondary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                          5. AI Models & Screening Intelligence
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                        <input
                          type="checkbox"
                          checked={panelFormAIConfig.enabled}
                          onChange={(e) => {
                            setPanelFormAIConfig({ ...panelFormAIConfig, enabled: e.target.checked });
                            setIsFormDirty(true);
                          }}
                          className="rounded border-secondary/40 text-cyan-400 focus:ring-0"
                        />
                        <span>AI Enabled</span>
                      </label>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Supported high-speed Gemini models are enabled by default for candidate evaluation, triage, and policy checks.
                    </p>

                    {/* Models Toggles */}
                    <div className="space-y-2">
                      {panelFormAIConfig.models.map((m) => (
                        <div
                          key={m.modelId}
                          className="p-3 bg-canvas rounded-xl border border-secondary/20 flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">{m.name}</span>
                              <span className="text-[9px] font-mono font-bold text-slate-500">
                                ({m.modelId})
                              </span>
                              {m.available ? (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 uppercase">
                                  Available
                                </span>
                              ) : (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                                  Unavailable
                                </span>
                              )}
                              {m.requiresPaidKey && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/30 uppercase">
                                  Paid Key Req.
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">{m.description}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                            <input
                              type="checkbox"
                              checked={m.enabled}
                              onChange={(e) => {
                                const updatedModels = panelFormAIConfig.models.map((mod) =>
                                  mod.modelId === m.modelId ? { ...mod, enabled: e.target.checked } : mod
                                );
                                setPanelFormAIConfig({ ...panelFormAIConfig, models: updatedModels });
                                setIsFormDirty(true);
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        AI System Screener Instructions
                      </label>
                      <textarea
                        value={panelFormAIConfig.systemInstruction || ''}
                        onChange={(e) => {
                          setPanelFormAIConfig({ ...panelFormAIConfig, systemInstruction: e.target.value });
                          setIsFormDirty(true);
                        }}
                        rows={2}
                        placeholder="Evaluation instructions for applicants..."
                        className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-400 resize-none font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Interactive Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="sticky top-4 space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        Live Card & Navigation Preview
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 animate-pulse">
                        LIVE SYNC
                      </span>
                    </div>

                    {/* Preview Panel Card */}
                    <div
                      className="bg-panel border border-secondary/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5 transition-all"
                      style={{ borderColor: `${panelFormColor}60` }}
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5 transition-all"
                        style={{ backgroundColor: panelFormColor }}
                      />

                      <div className="flex items-center justify-between pt-1">
                        <div
                          className="w-12 h-12 rounded-2xl bg-canvas border flex items-center justify-center text-2xl shadow-inner transition-all"
                          style={{ borderColor: `${panelFormColor}50` }}
                        >
                          {panelFormEmoji || '⚡'}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-canvas text-cyan-300 border border-cyan-500/30">
                            Role: {panelFormRole}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 font-mono">
                            Order #{panelFormSidebarOrder}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">
                          {panelFormName.trim() || 'Untitled Custom Panel'}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium line-clamp-2">
                          {panelFormDesc.trim() || 'No description provided. Add one in identification settings.'}
                        </p>
                      </div>

                      {/* Active Modules Badges in configured order */}
                      <div className="space-y-1.5 pt-1 border-t border-secondary/20">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                          Configured Modules ({panelFormFeatures.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {panelFormFeatures.length === 0 ? (
                            <span className="text-[10px] text-slate-500 italic">No modules selected</span>
                          ) : (
                            panelFormFeatures.map((feat) => (
                              <span
                                key={feat}
                                className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-canvas text-slate-200 border border-secondary/20 uppercase"
                              >
                                {feat}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* AI Integration Snapshot */}
                      <div className="pt-2 border-t border-secondary/20 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[10px] font-bold">
                            {panelFormAIConfig.enabled
                              ? `${panelFormAIConfig.models.filter((m) => m.enabled).length} AI Models Active`
                              : 'AI Disabled'}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            panelFormVisibility === 'public'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
                              : panelFormVisibility === 'hidden'
                              ? 'bg-red-950/80 text-red-300 border border-red-500/30'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {panelFormVisibility === 'role_only'
                            ? 'Role Only'
                            : panelFormVisibility === 'public'
                            ? 'Public'
                            : 'Hidden'}
                        </span>
                      </div>
                    </div>

                    {/* Sidebar item preview */}
                    <div className="p-4 bg-canvas/70 border border-secondary/30 rounded-2xl space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                        Sidebar Navigation Appearance
                      </span>
                      <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-canvas border border-secondary/30">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black border shrink-0"
                            style={{
                              backgroundColor: `${panelFormColor}25`,
                              borderColor: `${panelFormColor}50`,
                              color: panelFormColor,
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                          </div>
                          <span className="text-xs font-bold text-white truncate max-w-[140px]">
                            {panelFormName.trim() || 'Custom Panel'}
                          </span>
                        </div>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-panel text-cyan-300 border border-cyan-500/30 uppercase">
                          {panelFormRole}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-secondary/20 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isFormDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
                    setIsPanelModalOpen(false);
                  }}
                  className="py-3 px-6 bg-canvas hover:bg-slate-800 border border-secondary/30 text-slate-300 rounded-xl text-xs font-black uppercase transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPanel || !panelFormName.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingPanel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Firebase...</span>
                    </>
                  ) : (
                    <span>{editingPanel ? 'Save Changes' : 'Create & Save Panel'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit System Panel Modal with Reset to Default */}
      {editingSystemPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-panel border border-secondary/40 rounded-[2.5rem] max-w-xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6 text-white">
            <button onClick={() => setEditingSystemPanel(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-canvas rounded-xl"><XCircle className="w-5 h-5" /></button>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">System Panel Configuration</span>
              <h3 className="text-2xl font-black uppercase italic tracking-tight">Edit System Panel: {editingSystemPanel.name}</h3>
            </div>
            <form onSubmit={handleSaveSystemPanel} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Panel Display Name</label>
                <input type="text" value={sysFormName} onChange={e => setSysFormName(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 font-bold" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Description</label>
                <textarea value={sysFormDesc} onChange={e => setSysFormDesc(e.target.value)} rows={2} className="w-full bg-canvas border border-secondary/30 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={sysFormColor} onChange={e => setSysFormColor(e.target.value)} className="w-10 h-10 rounded-xl bg-canvas border border-secondary/30 cursor-pointer p-1" />
                    <input type="text" value={sysFormColor} onChange={e => setSysFormColor(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white font-mono uppercase" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Emoji</label>
                  <input type="text" value={sysFormEmoji} onChange={e => setSysFormEmoji(e.target.value)} className="w-full bg-canvas border border-secondary/30 rounded-xl p-2.5 text-xs text-white text-center text-lg outline-none focus:border-amber-400" maxLength={4} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Enabled Feature Modules</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(['Dashboard', 'Applications', 'Application Management', 'Reports', 'Users', 'Staff Management', 'Task Management', 'Analytics', 'Performance', 'Notifications', 'Settings', 'Custom features'] as PanelFeature[]).map(feat => {
                    const checked = sysFormFeatures.includes(feat);
                    return (
                      <label key={feat} className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-all ${checked ? 'bg-amber-400/10 border-amber-400/40 text-white font-bold' : 'bg-canvas/60 border-secondary/20 text-slate-400'}`}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          if (checked) setSysFormFeatures(prev => prev.filter(f => f !== feat));
                          else setSysFormFeatures(prev => [...prev, feat]);
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
                    if (window.confirm(`Reset "${editingSystemPanel.name}" settings to default?`)) {
                      try {
                        setSavingSystemPanel(true);
                        const updated = await resetSystemPanelToDefault(editingSystemPanel.id);
                        const restored = updated[editingSystemPanel.id];
                        if (restored) {
                          setEditingSystemPanel(restored);
                          setSysFormName(restored.name);
                          setSysFormDesc(restored.description || '');
                          setSysFormColor(restored.color || '#fbbf24');
                          setSysFormEmoji(restored.emoji || '👑');
                          setSysFormFeatures(restored.features || []);
                        }
                        alert(`System panel "${editingSystemPanel.name}" reset to default successfully.`);
                      } catch (err: any) {
                        alert('Failed to reset: ' + (err?.message || 'Unknown error'));
                      } finally {
                        setSavingSystemPanel(false);
                      }
                    }
                  }}
                  disabled={savingSystemPanel}
                  className="py-3 px-4 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-50"
                >
                  Reset to Default
                </button>
                <button type="button" onClick={() => setEditingSystemPanel(null)} className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 text-slate-300 rounded-xl text-xs font-black uppercase transition-all">Cancel</button>
                <button type="submit" disabled={savingSystemPanel || !sysFormName.trim()} className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-amber-400/20 disabled:opacity-50 cursor-pointer">
                  {savingSystemPanel ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Custom Panel Confirmation Dialog */}
      {panelToDelete && (
        <ConfirmationDialog
          isOpen={!!panelToDelete}
          title="Delete Custom Panel"
          message={`Are you sure you want to permanently delete custom panel "${panelToDelete.name}"? This action cannot be undone.`}
          itemName={panelToDelete.name}
          onConfirm={async () => {
            try {
              await deleteCustomPanel(panelToDelete.id);
              setPanelToDelete(null);
              loadOwnerData();
              alert('Custom panel deleted successfully.');
            } catch (err: any) {
              alert('Failed to delete panel: ' + (err?.message || 'Unknown error'));
            }
          }}
          onCancel={() => setPanelToDelete(null)}
        />
      )}
    </div>
  );
};

