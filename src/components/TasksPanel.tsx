import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  ExternalLink, 
  ListTodo, 
  RefreshCw, 
  CheckCircle,
  Clock,
  LogIn,
  Sparkles,
  UserPlus,
  UserX,
  User,
  ShieldCheck
} from 'lucide-react';
import { 
  fetchGoogleTasks, 
  updateGoogleTaskStatus, 
  deleteGoogleTask, 
  createGoogleTask,
  GoogleUser as FirebaseUser
} from '../lib/auth';
import { LinkedAccount } from '../types';

interface TasksPanelProps {
  user: FirebaseUser | null;
  onSignIn: () => void;
  syncedTrigger: number; // Increment this to force reload tasks when a task is synced from outside
  linkedAccounts: LinkedAccount[];
  onLinkAccount: () => Promise<void>;
  onUnlinkAccount: (email: string) => void;
}

export default function TasksPanel({
  user,
  onSignIn,
  syncedTrigger,
  linkedAccounts = [],
  onLinkAccount,
  onUnlinkAccount
}: TasksPanelProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('active');

  // Load tasks on mount, when linkedAccounts change, or syncedTrigger increments
  useEffect(() => {
    if (linkedAccounts.length > 0) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [linkedAccounts, syncedTrigger]);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (linkedAccounts.length === 0) {
        setTasks([]);
        setIsLoading(false);
        return;
      }

      const allTasks: any[] = [];
      const fetchErrors: string[] = [];

      await Promise.all(
        linkedAccounts.map(async (account) => {
          try {
            const items = await fetchGoogleTasks(account.accessToken);
            const taggedItems = items.map((t: any) => ({
              ...t,
              accountEmail: account.email,
              accountPhoto: account.photoURL,
              accountName: account.displayName
            }));
            allTasks.push(...taggedItems);
          } catch (err: any) {
            console.error(`Failed to fetch tasks for ${account.email}:`, err);
            fetchErrors.push(`${account.email}: ${err.message || 'Access token expired'}`);
          }
        })
      );

      // Sort tasks: Active first (newest updated first), then Completed (newest completed first)
      allTasks.sort((a, b) => {
        if (a.status === b.status) {
          const dateA = a.updated ? new Date(a.updated).getTime() : 0;
          const dateB = b.updated ? new Date(b.updated).getTime() : 0;
          return dateB - dateA; // Newest first
        }
        return a.status === 'completed' ? 1 : -1;
      });

      setTasks(allTasks);
      
      if (fetchErrors.length > 0 && allTasks.length === 0) {
        setError(`Connection issue on all connected accounts. Try re-authenticating:\n\n${fetchErrors.join('\n')}`);
      } else if (fetchErrors.length > 0) {
        // Some accounts failed, but some succeeded. We can keep running but show warning
        console.warn("Some linked accounts had sync errors:", fetchErrors);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch tasks from connected Google accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (task: any) => {
    const isCompleted = task.status === 'completed';
    const originalStatus = task.status;
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        return { ...t, status: isCompleted ? 'needsAction' : 'completed' };
      }
      return t;
    }));

    try {
      const account = linkedAccounts.find(a => a.email === task.accountEmail);
      if (!account) {
        throw new Error(`Auth credentials for ${task.accountEmail} not found in current workspace session.`);
      }
      await updateGoogleTaskStatus(task.id, !isCompleted, account.accessToken);
    } catch (err: any) {
      console.error(err);
      // Revert on error
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          return { ...t, status: originalStatus };
        }
        return t;
      }));
      alert(`Failed to update task: ${err.message || "An unexpected error occurred."}`);
    }
  };

  const handleDelete = async (taskId: string, title: string, accountEmail: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the task "${title}" from your real Google Tasks account (${accountEmail})?`);
    if (!confirmed) return;

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const account = linkedAccounts.find(a => a.email === accountEmail);
      if (!account) {
        throw new Error(`Auth credentials for ${accountEmail} not found.`);
      }
      await deleteGoogleTask(taskId, account.accessToken);
    } catch (err: any) {
      console.error(err);
      setTasks(previousTasks);
      alert(`Failed to delete task: ${err.message || "An unexpected error occurred."}`);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsAdding(true);
    try {
      if (linkedAccounts.length === 0) {
        throw new Error("No connected Google accounts found. Please connect an account first.");
      }

      // Parallel creation across ALL linked accounts for unified workspace experience
      await Promise.all(
        linkedAccounts.map(async (account) => {
          await createGoogleTask(newTaskTitle.trim(), newTaskNotes.trim(), account.accessToken);
        })
      );

      setNewTaskTitle('');
      setNewTaskNotes('');
      await loadTasks(); // Reload fully formed list
      alert(`Successfully added task to all ${linkedAccounts.length} connected accounts!`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to create task.');
    } finally {
      setIsAdding(false);
    }
  };

  // Filter tasks based on status
  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'active') return t.status === 'needsAction';
    if (activeTab === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            T
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5 font-display">
              Google Tasks Sync
            </h2>
            <p className="text-xs text-slate-500">Unified Multi-Account Aggregator</p>
          </div>
        </div>

        {/* Quick Launch Google Tasks */}
        <a 
          href="https://tasks.google.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:text-indigo-700 hover:underline bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200/50 cursor-pointer self-start sm:self-auto"
        >
          <span>Open Tasks App</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Multi-Account Connection Manager Widget */}
      <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Connected Accounts ({linkedAccounts.length})</span>
          </h3>
          <button
            onClick={onLinkAccount}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
            title="Connect an additional Google account to merge and sync tasks simultaneously"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Connect Account</span>
          </button>
        </div>

        {linkedAccounts.length > 0 ? (
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {linkedAccounts.map((account) => (
              <div 
                key={account.email}
                className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 group/acc"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {account.photoURL ? (
                    <img 
                      src={account.photoURL} 
                      alt={account.displayName} 
                      className="w-5 h-5 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-[10px] text-indigo-600 font-bold font-display uppercase">
                      {account.email.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate leading-tight">
                      {account.displayName}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate leading-none">
                      {account.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onUnlinkAccount(account.email)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-0 group-hover/acc:opacity-100 transition-all cursor-pointer"
                  title={`Disconnect account: ${account.email}`}
                >
                  <UserX className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-slate-400 font-semibold">No Google accounts linked yet.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Link your primary and secondary accounts to sync simultaneously!</p>
          </div>
        )}
      </div>

      {linkedAccounts.length === 0 ? (
        /* Sign-in CTA state when no account is connected */
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 border border-indigo-100 shadow-xs">
            <ListTodo className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 font-display mb-1">
            Connect Google Accounts
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mb-6">
            Log in with your Google accounts (likitmamba@gmail.com, etc.) to view, create, complete, and synchronize study checklists across multiple accounts simultaneously!
          </p>
          <button
            onClick={onSignIn}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all hover:scale-102"
          >
            <LogIn className="w-4 h-4" />
            <span>Connect to Google Tasks</span>
          </button>
        </div>
      ) : (
        /* Authenticated tasks interface */
        <div className="flex-1 flex flex-col h-full space-y-5">
          
          {/* Quick add form */}
          <form onSubmit={handleAddTask} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Task</span>
              <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                Will sync to {linkedAccounts.length} accounts
              </span>
            </div>
            <input 
              type="text" 
              placeholder="Create a new task..." 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 outline-hidden placeholder-slate-400 mb-1.5 font-display"
              required
            />
            <textarea 
              placeholder="Details / Takeaways (optional)" 
              rows={1}
              value={newTaskNotes}
              onChange={(e) => setNewTaskNotes(e.target.value)}
              className="w-full text-[11px] text-slate-600 outline-hidden placeholder-slate-400 resize-none font-sans"
            />
            
            <div className="flex items-center justify-end pt-2 mt-1 border-t border-slate-100">
              <button
                type="submit"
                disabled={isAdding || !newTaskTitle.trim()}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isAdding ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add Task to All</span>
              </button>
            </div>
          </form>

          {/* Controls & Sync State */}
          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
            {/* Tab switchers */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('active')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'active' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'completed' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
            </div>

            {/* Refresh list */}
            <button
              onClick={loadTasks}
              disabled={isLoading}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh merged Tasks Feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tasks list items */}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px] pr-1 scrollbar-thin">
            {isLoading && tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></span>
                <p className="text-xs">Loading Cloud Tasks...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl text-center">
                <p className="text-xs font-semibold mb-1">Cloud Sync Error</p>
                <p className="text-[10px] leading-relaxed mb-3 whitespace-pre-wrap">{error}</p>
                <button 
                  onClick={loadTasks} 
                  className="text-[10px] font-bold bg-white border border-red-200 px-3 py-1 rounded-md hover:bg-red-50"
                >
                  Retry Connection
                </button>
              </div>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map(task => {
                const isCompleted = task.status === 'completed';
                return (
                  <div 
                    key={task.id}
                    className={`flex items-start gap-3 bg-white border border-slate-200 p-3.5 rounded-xl hover:border-indigo-400 transition-all shadow-xs group/item ${
                      isCompleted ? 'bg-slate-50/50 opacity-75' : ''
                    }`}
                  >
                    {/* Completion button */}
                    <button
                      onClick={() => handleToggleTask(task)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer mt-0.5 shrink-0"
                    >
                      {isCompleted ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Title, Notes & Source Account */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded tracking-wide truncate max-w-[140px]">
                          {task.accountEmail}
                        </span>
                      </div>
                      <h4 className={`text-xs font-bold text-slate-800 line-clamp-2 leading-tight ${
                        isCompleted ? 'line-through text-slate-400' : ''
                      }`}>
                        {task.title}
                      </h4>
                      {task.notes && (
                        <p className={`text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap mt-1 line-clamp-4 ${
                          isCompleted ? 'text-slate-400' : ''
                        }`}>
                          {task.notes}
                        </p>
                      )}
                    </div>

                    {/* Delete item */}
                    <button
                      onClick={() => handleDelete(task.id, task.title, task.accountEmail)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer self-start shrink-0"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <CheckCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs">No tasks in this list.</p>
                <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                  Click 'Sync Task' on any curated video card or use the quick add form above to sync a new task!
                </p>
              </div>
            )}
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl p-3 text-[10px] text-indigo-700 leading-relaxed flex items-start gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Tasks here are compiled from all connected <strong>Google Tasks</strong> clouds. Changes made in this workspace will instantly sync to the respective Google accounts.</span>
          </div>

        </div>
      )}
    </div>
  );
}
