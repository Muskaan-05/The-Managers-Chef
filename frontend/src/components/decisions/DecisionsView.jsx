import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getDecisions, updateDecision, getMeetings } from '../../services/api';
import { 
  CheckCircle2, 
  Video, 
  Edit2, 
  Search, 
  Sparkles, 
  AlertCircle, 
  RefreshCw,
  X,
  Check,
  Calendar
} from 'lucide-react';
import '../../styles/tasks.css';

export default function DecisionsView({ onNavigateToMeeting }) {
  const [decisions, setDecisions] = useState([]);
  const [meetingsMap, setMeetingsMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit modal state
  const [editingDecision, setEditingDecision] = useState(null);
  const [editText, setEditText] = useState('');
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
      const [decsData, meetsData] = await Promise.all([
        getDecisions(),
        getMeetings().catch(() => []),
      ]);

      setDecisions(decsData || []);
      
      const mMap = {};
      (meetsData || []).forEach((m) => {
        mMap[m.id] = m;
      });
      setMeetingsMap(mMap);
    } catch (err) {
      console.error('Failed to load decisions:', err);
      setError(err.message || 'Failed to load decisions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (d.decision || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [decisions, searchQuery]);

  const handleEditClick = (d) => {
    setEditingDecision(d);
    setEditText(d.decision || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDecision) return;

    try {
      setIsSubmitting(true);
      const updates = {
        decision: editText.trim(),
      };

      const updated = await updateDecision(editingDecision.id, updates);
      setDecisions((prev) =>
        prev.map((d) => (d.id === editingDecision.id ? { ...d, ...updated } : d))
      );
      setEditingDecision(null);
      showToast('Decision updated successfully.');
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to update decision'}`);
    } finally {
      setIsSubmitting(false);
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

      {/* Header Info Banner explaining AI extracted decisions */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: 'var(--accent-primary-light, #eef2ff)',
        border: '1px solid var(--accent-primary-border, #c7d2fe)',
        borderRadius: 'var(--radius-md, 8px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        color: 'var(--text-main)',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%'
      }}>
        <Sparkles size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span>
          <strong>AI-Extracted Decisions:</strong> Key team decisions and consensus agreements are extracted automatically from meeting transcripts. You can edit decision text below to refine accuracy.
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

      {/* Search Bar */}
      <div className="task-filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
          <span>Total Decisions ({decisions.length})</span>
        </div>

        <div className="filter-controls-group">
          <div className="search-input-wrapper">
            <Search size={14} className="search-input-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search decisions..."
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
              <div className="skeleton skeleton-title" style={{ width: '60%' }} />
              <div className="skeleton skeleton-text" style={{ width: '80%' }} />
              <div className="skeleton skeleton-text" style={{ width: '30%' }} />
            </div>
          ))}
        </div>
      ) : filteredDecisions.length === 0 ? (
        <div className="task-table-card">
          <div className="tasks-empty-state">
            <CheckCircle2 size={36} className="tasks-empty-icon" />
            <h3 className="tasks-empty-title">No decisions recorded</h3>
            <p className="tasks-empty-desc">
              {searchQuery
                ? 'No decisions match your search query.'
                : 'Decisions will automatically appear here once team meetings are concluded and processed by AI.'}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredDecisions.map((d) => {
            const meeting = meetingsMap[d.meeting_id];

            return (
              <article
                key={d.id}
                className="task-item-card"
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxSizing: 'border-box',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: 'var(--badge-emerald-bg, #ecfdf5)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2
                  }}>
                    <CheckCircle2 size={16} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontSize: '15px',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      margin: 0,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}>
                      {d.decision}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {d.created_at && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          <span>{new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </span>
                      )}

                      {meeting && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>Source meeting:</span>
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
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-event-action"
                    onClick={() => handleEditClick(d)}
                    title="Edit decision text"
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

      {/* Edit Decision Modal */}
      {editingDecision && (
        <div className="modal-overlay" onClick={() => setEditingDecision(null)} role="dialog" aria-modal="true">
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">Edit Decision</h3>
                <p className="modal-subtitle">Update or clarify the agreed team decision.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingDecision(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Agreed Decision *</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    required
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Describe the agreed decision..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setEditingDecision(null)}
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

