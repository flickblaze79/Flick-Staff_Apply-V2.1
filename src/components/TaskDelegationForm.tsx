import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_OWNER_EMAILS, DEFAULT_OWNER_UIDS, addTask, addAuditLog, fetchUsersFromFirestore } from '../lib/storage';
import { UserRole, TaskPriority, UserProfile } from '../types';
import { ClipboardList, Send, Loader2, Calendar, UserCheck } from 'lucide-react';

interface TaskDelegationFormProps {
  onTaskAdded?: () => void;
}

export const TaskDelegationForm: React.FC<TaskDelegationFormProps> = ({ onTaskAdded }) => {
  const { currentUser, userProfile, isOwner, isAdmin } = useAuth();
  
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskRole, setTaskRole] = useState<UserRole | 'ALL'>('STAFF');
  const [selectedUserUid, setSelectedUserUid] = useState<string>('ALL');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [isDelegating, setIsDelegating] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);

  const isOwnerUser = isOwner || 
    userProfile?.role === 'OWNER' || 
    (currentUser?.email && DEFAULT_OWNER_EMAILS.some(e => e.toLowerCase() === currentUser.email?.toLowerCase())) ||
    (currentUser?.uid && DEFAULT_OWNER_UIDS.includes(currentUser.uid));

  const isAuthorizedCreator = isOwnerUser || isAdmin || userProfile?.role === 'ADMIN';

  useEffect(() => {
    if (isAuthorizedCreator) {
      fetchUsersFromFirestore().then((users) => {
        // Filter users who are staff/mods/admins/owners
        const team = users.filter((u) => ['STAFF', 'MOD', 'ADMIN', 'OWNER'].includes(u.role));
        setTeamMembers(team);
      }).catch(err => console.warn('Error fetching team members:', err));
    }
  }, [isAuthorizedCreator]);

  // If user is neither Owner nor Admin, do not render task delegation form
  if (!isAuthorizedCreator) return null;

  // Recipient Role Options
  const roleOptions: { label: string; value: UserRole | 'ALL' }[] = isOwnerUser ? [
    { label: 'All Staff / Roles', value: 'ALL' },
    { label: 'Owner', value: 'OWNER' },
    { label: 'Admin', value: 'ADMIN' },
    { label: 'Moderator', value: 'MOD' },
    { label: 'Staff', value: 'STAFF' },
  ] : [
    { label: 'All Staff / Roles', value: 'ALL' },
    { label: 'Admin', value: 'ADMIN' },
    { label: 'Moderator', value: 'MOD' },
    { label: 'Staff', value: 'STAFF' },
  ];

  // Filter team members based on selected recipient role
  const eligibleUsers = useMemo(() => {
    if (taskRole === 'ALL') return teamMembers;
    return teamMembers.filter((u) => u.role === taskRole);
  }, [teamMembers, taskRole]);

  const handleDelegate = async () => {
    if (!taskTitle.trim() || !taskDesc.trim()) {
      alert('Please provide a task title and detailed description.');
      return;
    }

    setIsDelegating(true);
    try {
      let assignedToName = 'All Team Members';
      if (selectedUserUid !== 'ALL') {
        const found = teamMembers.find((u) => u.uid === selectedUserUid);
        if (found) assignedToName = found.name;
      } else if (taskRole !== 'ALL') {
        assignedToName = `All ${taskRole}s`;
      }

      const newTask = await addTask({
        assignedByUid: currentUser?.uid || 'SYSTEM',
        assignedByName: userProfile?.name || currentUser?.displayName || 'Authorized Admin',
        assignedToUid: selectedUserUid,
        assignedToName,
        assignedToRole: taskRole,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        priority: taskPriority,
        status: 'Pending',
        dueDate: dueDate || undefined,
      });

      await addAuditLog({
        action: 'TASK_DELEGATED',
        actorUid: currentUser?.uid || '',
        actorName: userProfile?.name || 'Authorized Staff',
        actorEmail: currentUser?.email || '',
        actorRole: userProfile?.role || 'ADMIN',
        targetResource: 'tasks',
        targetUid: newTask.id,
        timestamp: new Date().toISOString(),
        metadata: { role: taskRole, assignedToUid: selectedUserUid, priority: taskPriority, title: taskTitle }
      });

      setTaskTitle('');
      setTaskDesc('');
      setSelectedUserUid('ALL');
      setDueDate('');
      alert('Task successfully created and delegated!');
      if (onTaskAdded) onTaskAdded();
    } catch (err: any) {
      console.error('Task delegation error:', err);
      alert('Failed to assign task: ' + (err?.message || 'Permission denied'));
    } finally {
      setIsDelegating(false);
    }
  };

  return (
    <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><ClipboardList className="w-40 h-40" /></div>
      <div className="relative space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-xl text-amber-300 text-[10px] font-black uppercase tracking-wider">
          <UserCheck className="w-3.5 h-3.5" /> Task Delegation & Role Assignment
        </div>
        <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Create & Assign New Task</h3>
        <p className="text-xs text-slate-400 font-medium">Assign tasks to specific team members or entire role groups in real-time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Task Title</label>
            <input 
              type="text" 
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Review Pending Applications / Update Moderation Rules" 
              className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-amber-400 shadow-inner" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Detailed Description & Context</label>
            <textarea 
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              rows={4} 
              placeholder="Provide clear instructions, requirements, and context for the assignee..." 
              className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-amber-400 shadow-inner resize-none" 
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Assign to Role</label>
              <select 
                value={taskRole}
                onChange={(e) => {
                  const val = e.target.value as UserRole | 'ALL';
                  setTaskRole(val);
                  setSelectedUserUid('ALL');
                }}
                className="w-full bg-canvas border border-secondary/30 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer appearance-none"
              >
                {roleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Assign to Specific Person</label>
              <select 
                value={selectedUserUid}
                onChange={(e) => setSelectedUserUid(e.target.value)}
                className="w-full bg-canvas border border-secondary/30 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer appearance-none"
              >
                <option value="ALL">All {taskRole === 'ALL' ? 'Team Members' : `${taskRole}s`}</option>
                {eligibleUsers.map(user => (
                  <option key={user.uid} value={user.uid}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Priority Level</label>
              <select 
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                className="w-full bg-canvas border border-secondary/30 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer appearance-none"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Urgent">🔥 Urgent Priority</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" /> Due Date (Optional)
              </label>
              <input 
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-canvas border border-secondary/30 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              disabled={isDelegating}
              onClick={handleDelegate}
              className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black uppercase text-xs rounded-2xl shadow-xl shadow-amber-400/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isDelegating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Assign & Delegate Task</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
