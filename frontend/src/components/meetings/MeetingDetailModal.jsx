import React, { useState, useEffect } from 'react';
import { 
  X, 
  Video, 
  Clock, 
  Calendar, 
  Folder, 
  Users, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Sparkles,
  BookmarkCheck,
  ListTodo
} from 'lucide-react';

export default function MeetingDetailModal({
  isOpen,
  onClose,
  meeting,
  onSaveMeetingNotes,
  onToggleFollowUp,
  onCreateFollowUpTask,
  onJoinMeeting
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'notes'
  const [notes, setNotes] = useState('');
  const [keyDecisions, setKeyDecisions] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [newDecision, setNewDecision] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  useEffect(() => {
    if (meeting) {
      setNotes(meeting.notes || '');
      setKeyDecisions(meeting.keyDecisions || []);
      setActionItems(meeting.actionItems || []);
      setNewDecision('');
      setNewActionItem('');
      setHasUnsavedNotes(false);
      // If completed, default to notes tab if notes or decisions exist
      if (meeting.status === 'completed' && (meeting.notes || meeting.keyDecisions?.length > 0)) {
        setActiveTab('notes');
      } else {
        setActiveTab('overview');
      }
    }
  }, [meeting, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !meeting) return null;

  const isToday = meeting.status === 'today';
  const isUpcoming = meeting.status === 'upcoming' || isToday;
  const isCompleted = meeting.status === 'completed';

  const handleCopyLink = () => {
    if (meeting.meetingLink) {
      navigator.clipboard?.writeText(meeting.meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNotesChange = (val) => {
    setNotes(val);
    setHasUnsavedNotes(true);
  };

  const handleSaveNotes = () => {
    onSaveMeetingNotes(meeting.id, {
      notes,
      keyDecisions,
      actionItems,
    });
    setHasUnsavedNotes(false);
  };

  const handleAddDecision = (e) => {
    e.preventDefault();
    if (!newDecision.trim()) return;
    const updated = [...keyDecisions, newDecision.trim()];
    setKeyDecisions(updated);
    setNewDecision('');
    onSaveMeetingNotes(meeting.id, {
      notes,
      keyDecisions: updated,
      actionItems,
    });
  };

  const handleDeleteDecision = (idx) => {
    const updated = keyDecisions.filter((_, i) => i !== idx);
    setKeyDecisions(updated);
    onSaveMeetingNotes(meeting.id, {
      notes,
      keyDecisions: updated,
      actionItems,
    });
  };

  const handleAddActionItem = (e) => {
    e.preventDefault();
    if (!newActionItem.trim()) return;
    const updated = [...actionItems, { text: newActionItem.trim(), done: false }];
    setActionItems(updated);
    setNewActionItem('');
    onSaveMeetingNotes(meeting.id, {
      notes,
      keyDecisions,
      actionItems: updated,
    });
  };

  const handleToggleActionItem = (idx) => {
    const updated = actionItems.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    setActionItems(updated);
    onSaveMeetingNotes(meeting.id, {
      notes,
      keyDecisions,
      actionItems: updated,
    });
  };

  const handleDeleteActionItem = (idx) => {
    const updated = actionItems.filter((_, i) => i !== idx);
    setActionItems(updated);
    onSaveMeetingNotes(meeting.id, {
      notes,
      keyDecisions,
      actionItems: updated,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="meeting-type-badge">{meeting.meetingType}</span>
              <span className="meeting-project-badge">
                <Folder size={12} style={{ color: 'var(--text-subtle)' }} />
                <span>{meeting.clientProject || 'General'}</span>
              </span>
              {meeting.needsFollowUp && (
                <span className="meeting-followup-badge">
                  <AlertTriangle size={11} />
                  <span>Needs Follow-up</span>
                </span>
              )}
              {isCompleted && (
                <span className="status-pill status-completed">Completed</span>
              )}
            </div>
            <h3 className="modal-title">{meeting.title}</h3>
            <p className="modal-subtitle">
              {meeting.timeLabel || `${meeting.date} · ${meeting.time}`} • {meeting.location || 'Online'}
            </p>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="meeting-detail-tabs">
          <button
            type="button"
            className={`meeting-detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Sparkles size={14} />
            <span>Context & Prep</span>
          </button>
          <button
            type="button"
            className={`meeting-detail-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <BookmarkCheck size={14} />
            <span>Meeting Notes & Decisions</span>
            {(keyDecisions.length > 0 || actionItems.length > 0) && (
              <span className="filter-count-badge" style={{ marginLeft: 4 }}>
                {keyDecisions.length + actionItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 22px' }}>
          {/* Tab 1: Overview & Context */}
          {activeTab === 'overview' && (
            <div className="meeting-detail-content">
              {/* Meeting Follow-up Banner if needed */}
              {meeting.needsFollowUp && (
                <div className="followup-action-banner">
                  <div className="followup-text-group">
                    <AlertTriangle size={16} />
                    <span>This meeting was flagged for manager follow-up.</span>
                  </div>
                  <button
                    type="button"
                    className="btn-create-followup-task"
                    onClick={() => onCreateFollowUpTask(meeting)}
                  >
                    <Plus size={13} />
                    <span>Create Follow-up Task</span>
                  </button>
                </div>
              )}

              {/* Agenda Section */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <Clock size={13} />
                  Meeting Agenda & Scope
                </span>
                <div className="detail-card-box" style={{ whiteSpace: 'pre-line' }}>
                  {meeting.agenda || 'No agenda items added.'}
                </div>
              </div>

              {/* Previous Context Section */}
              {meeting.previousContext && (
                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <FileText size={13} />
                    Previous Context & Memory
                  </span>
                  <div className="detail-card-box" style={{ backgroundColor: 'var(--accent-primary-light)', borderColor: 'var(--accent-primary-border)', color: 'var(--text-main)' }}>
                    {meeting.previousContext}
                  </div>
                </div>
              )}

              {/* Attendees & Link */}
              <div className="form-row-2">
                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <Users size={13} />
                    Participants
                  </span>
                  <div className="detail-card-box">
                    {meeting.participants && meeting.participants.length > 0 ? (
                      <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {meeting.participants.map((p, idx) => (
                          <li key={idx} style={{ fontSize: 12.5 }}>{p}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>No participants listed.</span>
                    )}
                  </div>
                </div>

                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <Video size={13} />
                    Conference Location / Link
                  </span>
                  <div className="detail-card-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{meeting.location || 'Google Meet'}</span>
                      {meeting.meetingLink && (
                        <button
                          type="button"
                          className="meeting-copy-btn"
                          onClick={handleCopyLink}
                          title="Copy meeting link"
                        >
                          {copied ? (
                            <>
                              <Check size={12} style={{ color: '#10b981' }} />
                              <span style={{ color: '#10b981' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {meeting.meetingLink && (
                      <a
                        href={meeting.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11.5, color: 'var(--accent-primary)', wordBreak: 'break-all', marginTop: 4, display: 'block' }}
                      >
                        {meeting.meetingLink}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Related Memories */}
              {meeting.relatedMemories && meeting.relatedMemories.length > 0 && (
                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <BookmarkCheck size={13} />
                    Ingested Memories ({meeting.relatedMemories.length})
                  </span>
                  <div className="detail-memories-grid">
                    {meeting.relatedMemories.map((mem, idx) => (
                      <div key={idx} className="detail-memory-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h5 className="detail-memory-title">{mem.title}</h5>
                          <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{mem.dateSource}</span>
                        </div>
                        <p className="detail-memory-summary">{mem.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Tasks */}
              {meeting.relatedTasks && meeting.relatedTasks.length > 0 && (
                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <ListTodo size={13} />
                    Related Tasks & Commitments ({meeting.relatedTasks.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meeting.relatedTasks.map((t, idx) => (
                      <div key={idx} className="action-item-row">
                        <CheckSquare size={14} style={{ color: t.status === 'completed' ? '#10b981' : 'var(--text-subtle)' }} />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{t.title}</span>
                        <span className={`status-pill status-${t.status}`}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Notes & Decisions (for past meetings or active note-taking) */}
          {activeTab === 'notes' && (
            <div className="meeting-detail-content">
              {/* Meeting Notes */}
              <div className="detail-section-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="detail-block-title">
                    <FileText size={13} />
                    Meeting Notes
                  </span>
                  {hasUnsavedNotes && (
                    <button
                      type="button"
                      className="btn-inline-add"
                      onClick={handleSaveNotes}
                    >
                      Save Notes
                    </button>
                  )}
                </div>
                <textarea
                  className="notes-textarea"
                  placeholder="Capture summary notes, key points discussed, or transcript highlights..."
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                />
              </div>

              {/* Key Decisions */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <CheckCircle2 size={13} />
                  Key Decisions Agreed ({keyDecisions.length})
                </span>
                <div className="item-list-container">
                  {keyDecisions.map((dec, idx) => (
                    <div key={idx} className="decision-item-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span>{dec}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDecision(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 2 }}
                        title="Remove decision"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <form onSubmit={handleAddDecision} className="add-inline-input-group">
                    <input
                      type="text"
                      className="add-inline-input"
                      placeholder="Add an agreed decision..."
                      value={newDecision}
                      onChange={(e) => setNewDecision(e.target.value)}
                    />
                    <button type="submit" className="btn-inline-add">
                      <Plus size={12} style={{ marginRight: 4 }} />
                      Add
                    </button>
                  </form>
                </div>
              </div>

              {/* Action Items */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <ListTodo size={13} />
                  Action Items & Follow-ups ({actionItems.length})
                </span>
                <div className="item-list-container">
                  {actionItems.map((item, idx) => (
                    <div key={idx} className={`action-item-row ${item.done ? 'done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleActionItem(idx)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1 }}>{item.text}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteActionItem(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 2 }}
                        title="Remove action item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <form onSubmit={handleAddActionItem} className="add-inline-input-group">
                    <input
                      type="text"
                      className="add-inline-input"
                      placeholder="Add an action item (e.g. Elena to send schema draft)..."
                      value={newActionItem}
                      onChange={(e) => setNewActionItem(e.target.value)}
                    />
                    <button type="submit" className="btn-inline-add">
                      <Plus size={12} style={{ marginRight: 4 }} />
                      Add
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onToggleFollowUp(meeting)}
              style={meeting.needsFollowUp ? { color: 'var(--badge-amber-text)', borderColor: 'var(--badge-amber-border)' } : {}}
            >
              <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {meeting.needsFollowUp ? 'Remove Follow-up' : 'Mark as Follow-up'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {isUpcoming && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onClose();
                  onJoinMeeting(meeting);
                }}
              >
                <Video size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Join Meeting
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
