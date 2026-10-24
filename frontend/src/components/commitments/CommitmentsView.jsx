import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getCommitments, updateCommitment, getMeetings } from '../../services/api';
import { formatDisplayDate } from '../../utils/dateUtils';
import { 
  CheckCircle2, 
  Clock, 
  User, 
  Video, 
  Edit2, 
  Search, 
  Sparkles, 
  AlertCircle, 
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import '../../styles/tasks.css';

export default function CommitmentsView({ onNavigateToMeeting, onCommitmentsCountChange }) {
  const [commitments, setCommitments] = useState([]);
  const [meetingsMap, setMeetingsMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Edit modal state
  const [editingCommitment, setEditingCommitment] = useState(null);
  const [editPerson, setEditPerson] = useState('');
  const [editTask, setEditTask] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((curr) => (curr === msg ? null : curr)), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [commsData, meetsData] = await Promise.all([
        getCommitments(),
        getMeetings().catch(() => []),
      ]);

      setCommitments(commsData || []);
      
      const mMap = {};
      (meetsData || []).forEach((m) => {
        mMap[m.id] = m;
      });
      setMeetingsMap(mMap);
    } catch (err) {
      console.error('Failed to load commitments:', err);
      setError(err.message || 'Failed to load commitments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (onCommitmentsCountChange) {
      const pendingCount = commitments.filter((c) => c.status === 'pending').length;
      onCommitmentsCountChange(pendingCount);
    }
  }, [commitments, onCommitmentsCountChange]);

  const filteredCommitments = useMemo(() => {
    return commitments.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPerson = (c.person || '').toLowerCase().includes(q);
        const matchesTask = (c.task || '').toLowerCase().includes(q);
        return matchesPerson || matchesTask;
      }
      return true;
    });
  }, [commitments, statusFilter, searchQuery]);

  const handleEditClick = (c) => {
    setEditingCommitment(c);
    setEditPerson(c.person || '');
    setEditTask(c.task || '');
    setEditDeadline(c.deadline ? c.deadline.slice(0, 10) : '');
    setEditStatus(c.status || 'pending');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCommitment) return;

    try {
      setIsSubmitting(true);
      const updates = {
        person: editPerson.trim() || 'Unspecified',
        task: editTask.trim(),
        status: editStatus,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      };

      const updated = await updateCommitment(editingCommitment.id, updates);
      setCommitments((prev) =>
        prev.map((c) => (c.id === editingCommitment.id ? { ...c, ...updated } : c))
      );
      setEditingCommitment(null);
      showToast('Commitment updated successfully.');
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to update commitment'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (c) => {
    const nextStatus = c.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateCommitment(c.id, { status: nextStatus });
      setCommitments((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, status: nextStatus } : item))
      );
      showToast(`Marked commitment as ${nextStatus}.`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="tasks-container">
      {/* Toast */}
      {toastMessage && (
        <div className="toast-feedback" role="status">
          <Check size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info Banner explaining AI generated commitments */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: 'var(--accent-primary-light, #eef2ff)',
        border: '1px solid var(--accent-primary-border, #c7d2fe)',
        borderRadius: 'var(--radius-md, 8px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        color: 'var(--text-main)'
      }}>
        <Sparkles size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span>
          <strong>AI-Extracted Commitments:</strong> Commitments are automatically captured by AI when meeting transcripts are processed. You can edit assignees, deadlines, and statuses below.
        </span>
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
            onClick={loadData}
            style={{ background: 'none', border: 'none', color: 'currentColor', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="task-filter-bar">
        <div className="filter-tabs-group">
          <button
            type="button"
            className={`filter-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({commitments.length})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({commitments.filter((c) => c.status === 'pending').length})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({commitments.filter((c) => c.status === 'completed').length})
          </button>
        </div>

        <div className="filter-controls-group">
          <div className="search-input-wrapper">
            <Search size={14} className="search-input-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by assignee or task..."
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
        </div>
      </div>

      {/* Content list or Loading Skeleton */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card">
              <div className="skeleton skeleton-title" style={{ width: '40%' }} />
              <div className="skeleton skeleton-text" style={{ width: '80%' }} />
              <div className="skeleton skeleton-text" style={{ width: '30%' }} />
            </div>
          ))}
        </div>
      ) : filteredCommitments.length === 0 ? (
        <div className="task-table-card">
          <div className="tasks-empty-state">
            <CheckCircle2 size={36} className="tasks-empty-icon" />
            <h3 className="tasks-empty-title">No commitments found</h3>
            <p className="tasks-empty-desc">
              {searchQuery || statusFilter !== 'all'
                ? 'No commitments match your current search or filter.'
                : 'Commitments will appear here automatically when meetings with assigned action items are processed.'}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredCommitments.map((c) => {
            const meeting = meetingsMap[c.source_reference];
            const isDone = c.status === 'completed';

            return (
              <article
                key={c.id}
                className="task-item-card"
                style={{
                  padding: '16px 20px',
                  backgroundColor: isDone ? 'var(--bg-card-subtle, #f8fafc)' : 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  opacity: isDone ? 0.78 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => handleStatusToggle(c)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: isDone ? '#10b981' : 'var(--text-subtle)',
                      padding: 0,
                      marginTop: 2
                    }}
                    title={isDone ? 'Mark as pending' : 'Mark as completed'}
                  >
                    <CheckCircle2 size={20} />
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="status-pill status-today" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        <strong>{c.person || 'Unspecified'}</strong>
                      </span>

                      {c.deadline && (
                        <span className="status-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card-subtle)' }}>
                          <Clock size={12} />
                          <span>Due {formatDisplayDate(c.deadline)}</span>
                        </span>
                      )}

                      <span className={`status-pill status-${c.status || 'pending'}`}>
                        {c.status || 'pending'}
                      </span>
                    </div>

                    <p style={{
                      fontSize: '14.5px',
                      color: 'var(--text-main)',
                      fontWeight: 500,
                      margin: 0,
                      textDecoration: isDone ? 'line-through' : 'none'
                    }}>
                      {c.task}
                    </p>

                    {meeting && (
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>From meeting: </span>
                        <button
                          type="button"
                          onClick={() => onNavigateToMeeting && onNavigateToMeeting(meeting.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Video size={12} />
                          <span>{meeting.title}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-event-action"
                    onClick={() => handleEditClick(c)}
                    title="Edit commitment"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Edit Commitment Modal */}
      {editingCommitment && (
        <div className="modal-overlay" onClick={() => setEditingCommitment(null)} role="dialog" aria-modal="true">
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">Edit Commitment</h3>
                <p className="modal-subtitle">Update assignee, description, or due date.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingCommitment(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Responsible Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editPerson}
                    onChange={(e) => setEditPerson(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Task Description *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    required
                    value={editTask}
                    onChange={(e) => setEditTask(e.target.value)}
                    placeholder="What was committed..."
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Deadline</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setEditingCommitment(null)}
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
                    'Save Changes'
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
