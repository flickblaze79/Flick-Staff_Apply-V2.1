import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToTasks, updateTask, deleteTask } from '../lib/storage';
import { Task, TaskStatus, UserRole } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import {
  ClipboardList,
  Search,
  Play,
  CheckCircle2,
  FlaskConical,
  RotateCcw,
  Trash2,
  Loader2,
  Calendar,
  AlertTriangle,
  User,
  Filter,
} from 'lucide-react';

interface StaffTasksPanelProps {
  panelRole?: UserRole;
  refreshKey?: number;
}

export const StaffTasksPanel: React.FC<StaffTasksPanelProps> = ({ panelRole, refreshKey }) => {
  const { currentUser, userProfile, isOwner, isAdmin } = useAuth();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeRole: UserRole = panelRole || userProfile?.role || 'STAFF';

  useEffect(() => {
    setLoading(true);
    // Subscribe to real-time Firestore task updates
    const unsubscribe = subscribeToTasks((updatedTasks) => {
      setTasks(updatedTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeRole, refreshKey]);

  // Role & Recipient Filter: Enforces role assignment, private task privacy, and creator visibility
  const roleFilteredTasks = useMemo(() => {
    const currentUid = currentUser?.uid;

    if (isOwner || activeRole === 'OWNER') {
      return tasks; // Owner sees all tasks across all roles
    }

    return tasks.filter((t) => {
      // 1. Task creator always sees tasks they created
      if (currentUid && t.assignedByUid === currentUid) {
        return true;
      }

      // 2. Specific User Assignment Check (Private Tasks)
      if (t.assignedToUid && t.assignedToUid !== 'ALL') {
        // Visible ONLY to the specifically assigned user
        return currentUid === t.assignedToUid;
      }

      // 3. Role Group Assignment Check (when assignedToUid === 'ALL')
      if (t.assignedToRole === 'ALL') {
        return true; // Global task for all team members
      }

      // Visible if assigned to this panel's role
      return t.assignedToRole === activeRole;
    });
  }, [tasks, activeRole, isOwner, currentUser]);

  // Status & Search Filter
  const filteredTasks = useMemo(() => {
    return roleFilteredTasks.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.assignedByName.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || t.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [roleFilteredTasks, search, statusFilter]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      // Optimistic update
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      await updateTask(taskId, { status: newStatus });
    } catch (err: any) {
      console.error('Status update error:', err);
      alert('Failed to update task status: ' + (err?.message || 'Permission denied'));
    }
  };

  const handlePromptDeleteTask = (task: Task) => {
    const canDelete = isOwner || isAdmin || task.assignedByUid === currentUser?.uid;
    if (!canDelete) {
      alert('Unauthorized: Only task creators, Admins, or Owners can delete tasks.');
      return;
    }
    setTaskToDelete(task);
    setDeleteError(null);
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete || deletingTaskId) return;

    const targetId = taskToDelete.id;
    const previousTasks = [...tasks];
    setDeletingTaskId(targetId);
    setDeleteError(null);

    try {
      // Optimistic local state removal
      setTasks((prev) => prev.filter((t) => t.id !== targetId));
      await deleteTask(targetId);
      setTaskToDelete(null);
    } catch (err: any) {
      console.error('Task deletion error:', err);
      setTasks(previousTasks);
      setDeleteError(err?.message || 'Failed to delete task. Missing or insufficient permissions.');
    } finally {
      setDeletingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-secondary/20 pb-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-400" />
            <span>Tasks Panel — {activeRole}</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-medium">Real-time synchronized tasks assigned to {activeRole}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-canvas border border-secondary/30 rounded-xl pl-9 pr-8 py-2 text-[10px] font-black text-white outline-none cursor-pointer appearance-none focus:border-amber-400"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Testing">Testing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, desc, creator..." 
              className="w-full bg-canvas border border-secondary/30 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white outline-none focus:border-amber-400" 
            />
          </div>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-canvas/40 border border-secondary/20 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connecting real-time task sync...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-canvas/40 border border-secondary/20 rounded-2xl p-8 text-center text-slate-500 font-bold uppercase text-[10px]">
            {statusFilter === 'All' ? `No tasks assigned to ${activeRole}.` : `No tasks matching status "${statusFilter}".`}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const canDelete = isOwner || isAdmin || task.assignedByUid === currentUser?.uid;

            return (
              <div 
                key={task.id} 
                className="p-5 bg-canvas/60 rounded-2xl border border-secondary/20 flex flex-col md:flex-row items-start justify-between gap-6 hover:border-amber-400/30 transition-all shadow-lg group"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                      task.priority === 'Urgent' ? 'bg-red-950 text-red-400 border border-red-500/50 animate-pulse' :
                      task.priority === 'High' ? 'bg-amber-950 text-amber-400 border border-amber-500/30' :
                      task.priority === 'Medium' ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {task.priority === 'Urgent' ? '🔥 URGENT' : `${task.priority || 'Medium'} PRIORITY`}
                    </span>

                    <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase border ${
                      task.status === 'Completed' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' : 
                      task.status === 'In Progress' ? 'bg-cyan-950 text-cyan-400 border-cyan-500/30' :
                      task.status === 'Testing' ? 'bg-purple-950 text-purple-400 border-purple-500/30' :
                      'bg-slate-800 text-slate-400 border-secondary/20'
                    }`}>
                      {task.status}
                    </span>

                    <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-panel text-slate-400 border border-secondary/20 uppercase">
                      Target: {task.assignedToName || task.assignedToRole}
                    </span>
                  </div>

                  <h4 className="font-black text-white text-base uppercase tracking-tight group-hover:text-amber-300 transition-colors">
                    {task.title}
                  </h4>
                  
                  <p className="text-xs text-slate-300 leading-relaxed font-medium bg-canvas/40 p-3 rounded-xl border border-secondary/10">
                    {task.description}
                  </p>

                  <div className="text-[10px] font-bold text-slate-500 flex flex-wrap items-center gap-4 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      Assigned by: <span className="text-white">{task.assignedByName}</span>
                    </span>

                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Calendar className="w-3 h-3" />
                        Due: <span className="font-mono text-white">{new Date(task.dueDate).toLocaleDateString()}</span>
                      </span>
                    )}

                    <span className="text-slate-600 font-mono">
                      Created: {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Quick Status & Delete Controls */}
                <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Task Actions</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                      onClick={() => handleStatusChange(task.id, 'In Progress')}
                      title="Set In Progress"
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border flex items-center gap-1 ${
                        task.status === 'In Progress' 
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md' 
                          : 'bg-canvas border-secondary/30 text-slate-400 hover:text-cyan-400'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start</span>
                    </button>

                    <button 
                      onClick={() => handleStatusChange(task.id, 'Testing')}
                      title="Set Testing"
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border flex items-center gap-1 ${
                        task.status === 'Testing' 
                          ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                          : 'bg-canvas border-secondary/30 text-slate-400 hover:text-purple-400'
                      }`}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Test</span>
                    </button>

                    <button 
                      onClick={() => handleStatusChange(task.id, 'Completed')}
                      title="Set Completed"
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border flex items-center gap-1 ${
                        task.status === 'Completed' 
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md' 
                          : 'bg-canvas border-secondary/30 text-slate-400 hover:text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete</span>
                    </button>

                    {task.status === 'Completed' && (
                      <button 
                        onClick={() => handleStatusChange(task.id, 'Pending')}
                        title="Reopen Task"
                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border bg-canvas border-secondary/30 text-slate-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen</span>
                      </button>
                    )}

                    {canDelete && (
                      <button 
                        onClick={() => handlePromptDeleteTask(task)}
                        disabled={deletingTaskId === task.id}
                        title="Delete Task Permanently"
                        className="p-2 bg-canvas hover:bg-red-950/60 border border-secondary/30 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-xl transition-all"
                      >
                        {deletingTaskId === task.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={!!taskToDelete}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task? This action cannot be undone and will remove it from all role panels immediately."
        itemName={taskToDelete?.title}
        isDeleting={!!deletingTaskId}
        error={deleteError}
        onConfirm={handleConfirmDeleteTask}
        onCancel={() => {
          setTaskToDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
};
