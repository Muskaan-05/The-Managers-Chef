import React, { useState, useMemo, useEffect, useCallback } from 'react';
import TaskSummary from './TaskSummary';
import TaskFilterBar from './TaskFilterBar';
import TaskTable from './TaskTable';
import TaskModal from './TaskModal';
import PostponeModal from './PostponeModal';
import JoinMeetingModal from './JoinMeetingModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  ensureDefaultContext 
} from '../../services/api';
import { formatDisplayDate, parseDateToISO, isDateOverdue } from '../../utils/dateUtils';
import { Check, RefreshCw, AlertCircle } from 'lucide-react';
import '../../styles/tasks.css';

export default function TasksView({
  isAddModalOpen = false,
  setIsAddModalOpen,
  onTasksCountChange
}) {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Internal modal states
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [postponingTask, setPostponingTask] = useState(null);
  const [joiningTask, setJoiningTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const isModalAddOpen = isAddModalOpen || localAddOpen;
  const closeAddModal = () => {
    setLocalAddOpen(false);
    if (setIsAddModalOpen) setIsAddModalOpen(false);
  };

  // Map backend task object to frontend display model
  const mapBackendTask = useCallback((t) => {
    const isCompleted = t.status === 'completed';
    const isOverdue = !isCompleted && t.deadline && isDateOverdue(t.deadline);
    const computedStatus = isCompleted ? 'completed' : (isOverdue ? 'overdue' : 'pending');

    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
      dueDate: formatDisplayDate(t.deadline, 'No deadline'),
      rawDueDate: t.deadline || '',
      project: 'General',
      status: computedStatus,
      rawStatus: t.status,
      context_id: t.context_id,
      estimated_duration: t.estimated_duration,
      source: t.source || 'manual',
    };
  }, []);

  // Fetch tasks from real backend API
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getTasks();
      const mapped = data.map(mapBackendTask);
      setTasks(mapped);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError(err.message || 'Failed to load tasks from server');
    } finally {
      setIsLoading(false);
    }
  }, [mapBackendTask]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Update badge count in parent
  useEffect(() => {
    if (onTasksCountChange) {
      const pendingCount = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue').length;
      onTasksCountChange(pendingCount);
    }
  }, [tasks, onTasksCountChange]);

  // Show auto-dismissing toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Compute status counts for badges
  const counts = useMemo(() => {
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      overdue: tasks.filter((t) => t.status === 'overdue').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    };
  }, [tasks]);

  // Filter & Search tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Status Filter
      if (activeFilter !== 'all' && task.status !== activeFilter) {
        return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = (task.description || '').toLowerCase().includes(q);
        const matchesProject = (task.project || '').toLowerCase().includes(q);
        const matchesPriority = task.priority.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesProject || matchesPriority;
      }

      return true;
    });
  }, [tasks, activeFilter, searchQuery]);

  // Toggle complete state
  const handleToggleComplete = async (task) => {
    const isNowCompleted = task.status !== 'completed';
    const newStatus = isNowCompleted ? 'completed' : 'pending';

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    try {
      await updateTask(task.id, { status: newStatus });
      showToast(isNowCompleted ? `Task "${task.title}" completed.` : `Task "${task.title}" restored to Pending.`);
    } catch (err) {
      // Revert on failure
      fetchTasks();
      showToast(`Error: ${err.message || 'Failed to update task status'}`);
    }
  };

  // Save (Create or Edit)
  const handleSaveTask = async (taskData) => {
    try {
      const deadlineISO = parseDateToISO(taskData.dueDate);

      if (editingTask) {
        // Edit existing task
        await updateTask(editingTask.id, {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          deadline: deadlineISO,
        });
        setEditingTask(null);
        showToast('Task updated successfully.');
      } else {
        // Create new task
        const contextId = await ensureDefaultContext();
        await createTask({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          deadline: deadlineISO,
          context_id: contextId,
          estimated_duration: 30,
        });
        closeAddModal();
        showToast('New task created successfully.');
      }
      await fetchTasks();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to save task'}`);
    }
  };

  // Postpone deadline
  const handlePostponeDeadline = async (taskId, newDueDate) => {
    try {
      const deadlineISO = parseDateToISO(newDueDate);
      await updateTask(taskId, {
        deadline: deadlineISO,
        status: 'pending',
      });
      setPostponingTask(null);
      showToast(`Deadline extended.`);
      await fetchTasks();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to postpone deadline'}`);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setDeletingTask(null);
      showToast('Task deleted from workspace.');
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to delete task'}`);
    }
  };

  const handleResetFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
  };

  const isFiltered = activeFilter !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="tasks-container">
      {/* Error state if API fails */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--badge-rose-bg)',
          color: 'var(--badge-rose-text)',
          border: '1px solid var(--badge-rose-border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13.5px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchTasks}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Task Summary Cards */}
      <TaskSummary
        tasks={tasks}
        activeFilter={activeFilter}
        onSelectFilter={(filterId) => setActiveFilter(filterId)}
      />

      {/* Filters & Search Toolbar */}
      <TaskFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counts={counts}
      />

      {/* Task List & Table */}
      {isLoading ? (
        <div className="task-table-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
          <p>Loading tasks from workspace...</p>
        </div>
      ) : (
        <TaskTable
          tasks={filteredTasks}
          onToggleComplete={handleToggleComplete}
          onEdit={(task) => setEditingTask(task)}
          onPostpone={(task) => setPostponingTask(task)}
          onJoinMeeting={(task) => setJoiningTask(task)}
          onDelete={(task) => setDeletingTask(task)}
          onResetFilters={handleResetFilters}
          onAddTask={() => setLocalAddOpen(true)}
          isFiltered={isFiltered}
        />
      )}

      {/* Modals & Dialogs */}
      {/* Add Task Modal */}
      <TaskModal
        isOpen={isModalAddOpen}
        onClose={closeAddModal}
        onSave={handleSaveTask}
        task={null}
      />

      {/* Edit Task Modal */}
      <TaskModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
        task={editingTask}
      />

      {/* Postpone Deadline Modal */}
      <PostponeModal
        isOpen={Boolean(postponingTask)}
        onClose={() => setPostponingTask(null)}
        onPostpone={handlePostponeDeadline}
        task={postponingTask}
      />

      {/* Join Meeting Modal */}
      <JoinMeetingModal
        isOpen={Boolean(joiningTask)}
        onClose={() => setJoiningTask(null)}
        task={joiningTask}
        onNotify={showToast}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteTask}
        task={deletingTask}
      />

      {/* Feedback Toast */}
      {toastMessage && (
        <div className="toast-feedback" role="status">
          <Check size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
