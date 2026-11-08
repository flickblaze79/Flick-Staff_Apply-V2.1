import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { logAuditEvent } from '../../lib/auditLogger';
import {
  getApplications,
  getReports,
  getAuditLogs,
  updateUserRole,
  setUserSuspension,
  addNotification,
} from '../../lib/storage';
import { UserProfile, UserRole, StaffApplication, UserReport, AuditLogEntry } from '../../types';
import { X } from 'lucide-react';

interface UserProfileDetailModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export const UserProfileDetailModal: React.FC<UserProfileDetailModalProps> = ({
  user,
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const { currentUser, userProfile: currentUserProfile, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'applications' | 'role' | 'moderation' | 'activity'>('account');

  const [userApps, setUserApps] = useState<StaffApplication[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [userAuditLogs, setUserAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [updatingRole, setUpdatingRole] = useState(false);

  const [suspensionReason, setSuspensionReason] = useState(user.suspensionReason || '');
  const [updatingSuspension, setUpdatingSuspension] = useState(false);

  useEffect(() => {
    setSelectedRole(user.role);
    setSuspensionReason(user.suspensionReason || '');
  }, [user]);

  useEffect(() => {
    function loadTargetUserData() {
      if (!isOpen || !user.uid) return;
      setLoadingData(true);
      try {
        const apps = getApplications().filter((a) => a.applicantUid === user.uid);
        apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setUserApps(apps);

        const reports = getReports().filter((r) => r.authorUid === user.uid);
        reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setUserReports(reports);

        const logs = getAuditLogs().filter((l) => l.targetUid === user.uid);
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setUserAuditLogs(logs);
      } catch (err) {
        console.warn('Error loading detailed profile data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadTargetUserData();
  }, [isOpen, user.uid]);

  if (!isOpen) return null;

  // Role Assignment (Only Owner or Admin can assign allowed roles)
  const handleAssignRole = async () => {
    if (!currentUser || selectedRole === user.role) return;

    if (user.role === 'OWNER' && !isOwner) {
      alert('Only the Owner can modify Owner roles.');
      return;
    }
    if (selectedRole === 'OWNER' && !isOwner) {
      alert('Only the Owner can grant the Owner role.');
      return;
    }

    setUpdatingRole(true);
    try {
      const assignedBy = currentUserProfile?.name || currentUser.email || 'Owner';
      await updateUserRole(user.uid, selectedRole, assignedBy);

      await addNotification({
        recipientUid: user.uid,
        title: `Role Updated: ${selectedRole}`,
        message: `Your account role has been updated to ${selectedRole}.`,
        type: 'role',
        read: false,
        createdAt: new Date().toISOString(),
      });

      await logAuditEvent({
        action: 'USER_ROLE_UPDATED',
        actorUid: currentUser.uid,
        actorName: currentUserProfile?.name || 'Administrator',
        actorEmail: currentUser.email || '',
        actorRole: currentUserProfile?.role || 'ADMIN',
        targetResource: 'users',
        targetUid: user.uid,
        metadata: { previousRole: user.role, newRole: selectedRole },
      });

      onProfileUpdated();
      alert(`User role updated to ${selectedRole}!`);
    } catch (err: any) {
      alert(err?.message || 'Failed to update role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleToggleSuspension = async () => {
    if (!currentUser) return;
    setUpdatingSuspension(true);
    const nextState = !user.isSuspended;
    try {
      const suspendedBy = currentUserProfile?.name || 'Moderation';
      await setUserSuspension(user.uid, nextState, suspensionReason.trim() || 'Rule violation', suspendedBy);

      await logAuditEvent({
        action: nextState ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
        actorUid: currentUser.uid,
        actorName: currentUserProfile?.name || 'Administrator',
        actorEmail: currentUser.email || '',
        actorRole: currentUserProfile?.role || 'ADMIN',
        targetResource: 'users',
        targetUid: user.uid,
        metadata: { isSuspended: nextState, reason: suspensionReason },
      });

      onProfileUpdated();
      alert(nextState ? 'User account suspended.' : 'User account activated.');
    } catch (err: any) {
      alert(err?.message || 'Failed to update suspension status.');
    } finally {
      setUpdatingSuspension(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto text-white">
      <div className="relative w-full max-w-4xl bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2.5 text-slate-400 hover:text-white hover:bg-canvas rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-secondary/20 pb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center font-black text-3xl text-white shadow-lg">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-black text-white">{user.name}</h2>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-canvas text-cyan-300 border border-secondary/40 uppercase">
                {user.role}
              </span>
              {user.isSuspended && (
                <span className="text-xs font-black px-3 py-1 rounded-full bg-red-950 text-red-300 border border-red-800 uppercase">
                  SUSPENDED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 font-medium">{user.email}</p>
            <p className="text-[10px] font-mono text-slate-400">UID: {user.uid}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-secondary/20 pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('account')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'account' ? 'bg-primary text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Account Details
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'applications' ? 'bg-primary text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Applications ({userApps.length})
          </button>
          <button
            onClick={() => setActiveTab('role')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'role' ? 'bg-primary text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Role & Permissions
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'moderation' ? 'bg-primary text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Moderation ({userReports.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'activity' ? 'bg-primary text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Audit History ({userAuditLogs.length})
          </button>
        </div>

        {activeTab === 'account' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-canvas/80 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">User ID (UID)</span>
              <span className="font-mono text-white font-bold break-all">{user.uid}</span>
            </div>
            <div className="bg-canvas/80 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Email Address</span>
              <span className="text-white font-bold">{user.email}</span>
            </div>
            <div className="bg-canvas/80 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Account Creation Date</span>
              <span className="text-white font-bold">{new Date(user.createdAt || Date.now()).toLocaleString()}</span>
            </div>
            <div className="bg-canvas/80 p-4 rounded-2xl border border-secondary/20 space-y-1">
              <span className="text-slate-400 uppercase font-bold text-[10px] block">Current Role</span>
              <span className="text-cyan-300 font-black uppercase">{user.role}</span>
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-3 text-xs">
            {loadingData ? (
              <div className="text-center py-6 text-slate-300">Loading user application history...</div>
            ) : userApps.length === 0 ? (
              <div className="p-8 text-center bg-canvas/60 rounded-2xl border border-secondary/20 text-slate-400 font-medium">
                No applications submitted by this user.
              </div>
            ) : (
              userApps.map((app) => (
                <div key={app.id} className="p-4 bg-canvas/80 rounded-2xl border border-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white">Category: {app.category}</span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-panel text-cyan-300 uppercase text-[10px]">
                      {app.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    App ID: <span className="font-mono text-white">{app.id}</span> | Submitted: {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                  {app.reviewNotes && (
                    <div className="p-2.5 bg-panel rounded-xl text-cyan-200/90 italic">
                      "Review Notes: {app.reviewNotes}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'role' && (
          <div className="space-y-6 text-xs bg-canvas/80 p-6 rounded-2xl border border-secondary/20">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Assign User Role & Hierarchy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-300 mb-1.5 uppercase tracking-wider text-[10px]">
                  Target Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  disabled={user.role === 'OWNER' && !isOwner}
                  className="w-full bg-panel border border-secondary/30 rounded-xl py-2.5 px-3 font-bold text-cyan-300 outline-none"
                >
                  <option value="USER">USER</option>
                  <option value="STAFF">STAFF</option>
                  <option value="MOD">MOD</option>
                  <option value="ADMIN">ADMIN</option>
                  {isOwner && <option value="OWNER">OWNER</option>}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAssignRole}
                  disabled={updatingRole || selectedRole === user.role}
                  className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {updatingRole ? 'Assigning...' : 'Confirm Role Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="space-y-6 text-xs">
            <div className="bg-canvas/80 p-6 rounded-2xl border border-secondary/20 space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Account Suspension Control
              </h3>
              <div>
                <label className="block font-bold text-slate-300 mb-1.5 uppercase tracking-wider text-[10px]">
                  Suspension Reason
                </label>
                <input
                  type="text"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Specify violation or reason for suspension..."
                  className="w-full bg-panel border border-secondary/30 rounded-xl py-2.5 px-3 text-white outline-none"
                />
              </div>

              <button
                onClick={handleToggleSuspension}
                disabled={updatingSuspension}
                className={`w-full py-3 font-black uppercase tracking-wider rounded-xl transition-all ${
                  user.isSuspended
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-lg'
                }`}
              >
                {user.isSuspended ? 'Activate User Account' : 'Suspend User Account'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-2 text-xs font-mono">
            {userAuditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-canvas/80 rounded-xl border border-secondary/20 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">{log.actorName}:</span>{' '}
                  <span className="text-cyan-300">{log.action}</span>
                </div>
                <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
