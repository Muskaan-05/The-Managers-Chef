import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getReminders, 
  createReminder, 
  updateReminder, 
  deleteReminder 
} from '../../services/api';
import { formatDisplayDate } from '../../utils/dateUtils';
import { playNotificationSound } from '../../utils/soundUtils';
import { 
  Bell, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Search, 
  X, 
  Check 
} from 'lucide-react';
import '../../styles/tasks.css';

export default function RemindersView({
  isAddModalOpen = false,
  setIsAddModalOpen,
  onRemindersCountChange
}) {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit modal state
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = isAddModalOpen || internalModalOpen;
  const [editingReminder, setEditingReminder] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [triggerDate, setTriggerDate] = useState('');
  const [triggerTime, setTriggerTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const closeModal = () => {
    setInternalModalOpen(false);
    if (setIsAddModalOpen) setIsAddModalOpen(false);
    setEditingReminder(null);
  };

  // Notification audio / browser permissions
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserPerm, setBrowserPerm] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((c) => (c === msg ? null : c)), 3000);
  };

  const loadReminders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getReminders();
      setReminders(data || []);
    } catch (err) {
      console.error('Failed to load reminders:', err);
      setError(err.message || 'Failed to load reminders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const handleTestSound = () => {
    const success = playNotificationSound();
    if (success) {
      showToast('Notification sound played.');
    } else {
      showToast('Click anywhere on the page first to allow audio playback.');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPerm(perm);
      if (perm === 'granted') {
        showToast('Browser notifications enabled.');
      } else {
        showToast('Browser notifications were not granted.');
      }
    }
  };

  const openCreateModal = () => {
    setEditingReminder(null);
    setTitle('');
    setDescription('');
    const todayStr = new Date().toISOString().slice(0, 10);
    setTriggerDate(todayStr);
    setTriggerTime('09:00');
    setRecurrence('none');
    setInternalModalOpen(true);
  };

  useEffect(() => {
    if (isAddModalOpen) {
      openCreateModal();
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (onRemindersCountChange) {
      const pendingCount = reminders.filter((r) => r.status === 'pending').length;
      onRemindersCountChange(pendingCount);
    }
  }, [reminders, onRemindersCountChange]);

  const openEditModal = (r) => {
    setEditingReminder(r);
    setTitle(r.title);
    setDescription(r.description || '');
    if (r.trigger_time) {
      const d = new Date(r.trigger_time);
      setTriggerDate(d.toISOString().slice(0, 10));
      setTriggerTime(d.toTimeString().slice(0, 5));
    }
    setRecurrence(r.recurrence || 'none');
    setInternalModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !triggerDate || !triggerTime) {
      showToast('Title, date, and time are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const combinedDateTime = new Date(`${triggerDate}T${triggerTime}:00`);
      if (isNaN(combinedDateTime.getTime())) {
        showToast('Invalid date/time format.');
        return;
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        trigger_time: combinedDateTime.toISOString(),
        recurrence: recurrence,
      };

      if (editingReminder) {
        const updated = await updateReminder(editingReminder.id, payload);
        setReminders((prev) =>
          prev.map((r) => (r.id === editingReminder.id ? { ...r, ...updated } : r))
        );
        showToast('Reminder updated successfully.');
      } else {
        const created = await createReminder(payload);
        setReminders((prev) => [created, ...prev]);
        showToast('Reminder created successfully.');
      }
      closeModal();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to save reminder'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (r) => {
    const nextStatus = r.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateReminder(r.id, { status: nextStatus });
      setReminders((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, status: nextStatus } : item))
      );
      showToast(`Reminder marked as ${nextStatus}.`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete reminder "${r.title}"?`)) return;
    try {
      await deleteReminder(r.id);
      setReminders((prev) => prev.filter((item) => item.id !== r.id));
      showToast('Reminder deleted.');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reminders, statusFilter, searchQuery]);

  return (
    <div className="tasks-container">
      {/* Toast */}
      {toastMessage && (
        <div className="toast-feedback" role="status">
          <Check size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Notification Preferences Banner */}
      <div style={{
        padding: '12px 18px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '13px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bell size={16} style={{ color: 'var(--accent-primary)' }} />
          <span>
            <strong>Reminder Alerts:</strong> Due reminders trigger in-app alerts and sound chimes while using the application.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-event-action"
            onClick={handleTestSound}
            title="Test sound chime"
          >
            <Volume2 size={13} />
            <span>Test Sound</span>
          </button>

          {browserPerm !== 'granted' && (
            <button
              type="button"
              className="btn-event-action"
              onClick={requestNotificationPermission}
            >
              <span>Enable Browser Notifications</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
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
            onClick={loadReminders}
            style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Controls */}
      <div className="task-filter-bar">
        <div className="filter-tabs-group">
          <button
            type="button"
            className={`filter-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({reminders.length})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({reminders.filter((r) => r.status === 'pending').length})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({reminders.filter((r) => r.status === 'completed').length})
          </button>
        </div>

        <div className="filter-controls-group">
          <div className="search-input-wrapper">
            <Search size={14} className="search-input-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search reminders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="primary-add-task-btn"
            onClick={openCreateModal}
          >
            <Plus size={15} />
            <span>Add Reminder</span>
          </button>
        </div>
      </div>

      {/* Content list or Loading Skeleton */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card">
              <div className="skeleton skeleton-title" style={{ width: '50%' }} />
              <div className="skeleton skeleton-text" style={{ width: '70%' }} />
              <div className="skeleton skeleton-text" style={{ width: '25%' }} />
            </div>
          ))}
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="task-table-card">
          <div className="tasks-empty-state">
            <Bell size={36} className="tasks-empty-icon" />
            <h3 className="tasks-empty-title">No reminders scheduled</h3>
            <p className="tasks-empty-desc">
              {searchQuery || statusFilter !== 'all'
                ? 'No reminders match your filter criteria.'
                : 'Create reminders for important deadlines, 1:1 prep, or follow-up items.'}
            </p>
            <button
              type="button"
              className="tasks-empty-action-btn"
              onClick={openCreateModal}
            >
              <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Create Reminder
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredReminders.map((r) => {
            const isDone = r.status === 'completed';
            const isDue = !isDone && new Date(r.trigger_time).getTime() <= Date.now();

            return (
              <article
                key={r.id}
                className="task-item-card"
                style={{
                  padding: '16px 20px',
                  backgroundColor: isDone ? 'var(--bg-card-subtle, #f8fafc)' : 'var(--bg-card, #ffffff)',
                  border: isDue ? '1px solid #ef4444' : '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  opacity: isDone ? 0.78 : 1,
                  boxSizing: 'border-box',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(r)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isDone ? '#10b981' : isDue ? '#ef4444' : 'var(--text-subtle)',
                      padding: 0,
                      marginTop: 2
                    }}
                    title={isDone ? 'Mark as pending' : 'Dismiss / Mark completed'}
                  >
                    <CheckCircle2 size={20} />
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`status-pill ${isDue ? 'status-urgent' : isDone ? 'status-completed' : 'status-today'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        <span>{formatDisplayDate(r.trigger_time)}</span>
                      </span>

                      {r.recurrence && r.recurrence !== 'none' && (
                        <span className="status-pill" style={{ background: 'var(--bg-card-subtle)' }}>
                          Repeats: {r.recurrence}
                        </span>
                      )}

                      {isDue && (
                        <span className="status-pill status-urgent">
                          Due Now
                        </span>
                      )}
                    </div>

                    <h4 style={{
                      fontSize: '15px',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      margin: 0,
                      textDecoration: isDone ? 'line-through' : 'none',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}>
                      {r.title}
                    </h4>

                    {r.description && (
                      <p style={{ fontSize: '13px', color: 'var(--text-body)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {r.description}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-event-action"
                    onClick={() => openEditModal(r)}
                    title="Edit reminder"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    className="btn-event-action action-delete"
                    onClick={() => handleDelete(r)}
                    title="Delete reminder"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Create/Edit Reminder */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">{editingReminder ? 'Edit Reminder' : 'Add Reminder'}</h3>
                <p className="modal-subtitle">Schedule a timed alert with date and optional notes.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Reminder Title *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Prep 1:1 Talking Points for David"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Context</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional details or context..."
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={triggerDate}
                      onChange={(e) => setTriggerDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Time *</label>
                    <input
                      type="time"
                      required
                      className="form-input"
                      value={triggerTime}
                      onChange={(e) => setTriggerTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Recurrence</label>
                  <select
                    className="form-select"
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                  >
                    <option value="none">One-time alert</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="spin-icon" style={{ marginRight: 6 }} />
                      Saving...
                    </>
                  ) : (
                    editingReminder ? 'Save Changes' : 'Create Reminder'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
