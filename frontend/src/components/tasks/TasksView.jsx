import React, { useState, useMemo, useEffect } from 'react';
import TaskSummary from './TaskSummary';
import TaskFilterBar from './TaskFilterBar';
import TaskTable from './TaskTable';
import TaskModal from './TaskModal';
import PostponeModal from './PostponeModal';
import JoinMeetingModal from './JoinMeetingModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { mockInitialTasks } from '../../data/mockData';
import { Check } from 'lucide-react';
import '../../styles/tasks.css';

export default function TasksView({
  isAddModalOpen = false,
  setIsAddModalOpen,
  onTasksCountChange
}) {
  const [tasks, setTasks] = useState(() => {
    // Read from localStorage if available, or fallback to mockInitialTasks
    try {
      const saved = localStorage.getItem('tmc_manager_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return mockInitialTasks;
  });

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

  // Sync tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tmc_manager_tasks', JSON.stringify(tasks));
    } catch (e) {
      // ignore
    }
    if (onTasksCountChange) {
      const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'overdue').length;
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

  // Task Actions
  const handleToggleComplete = (task) => {
    const isNowCompleted = task.status !== 'completed';
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === task.id) {
          return {
            ...t,
            status: isNowCompleted ? 'completed' : 'pending',
          };
        }
        return t;
      })
    );
    showToast(isNowCompleted ? `Task "${task.title}" completed.` : `Task "${task.title}" restored to Pending.`);
  };

  const handleSaveTask = (taskData) => {
    if (editingTask) {
      // Updating existing task
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === editingTask.id) {
            return {
              ...t,
              ...taskData,
            };
          }
          return t;
        })
      );
      setEditingTask(null);
      showToast('Task updated successfully.');
    } else {
      // Creating new task
      const newTask = {
        id: `task-${Date.now()}`,
        ...taskData,
        status: 'pending',
      };
      setTasks((prev) => [newTask, ...prev]);
      closeAddModal();
      showToast('New task added to queue.');
    }
  };

  const handlePostponeDeadline = (taskId, newDueDate) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          // If task was overdue or completed, moving due date forward makes it pending
          const newStatus = t.status === 'completed' ? 'completed' : 'pending';
          return {
            ...t,
            dueDate: newDueDate,
            status: newStatus,
          };
        }
        return t;
      })
    );
    setPostponingTask(null);
    showToast(`Deadline extended to: ${newDueDate}`);
  };

  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setDeletingTask(null);
    showToast('Task deleted from workspace.');
  };

  const handleResetFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
  };

  const isFiltered = activeFilter !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="tasks-container">
      {/* 3. Task Summary Cards */}
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

      {/* 4. Task List & Table */}
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
