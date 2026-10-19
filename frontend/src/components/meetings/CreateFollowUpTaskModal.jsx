import React, { useState, useEffect } from 'react';
import { X, CheckSquare, AlertCircle, Calendar } from 'lucide-react';

export default function CreateFollowUpTaskModal({
  isOpen,
  onClose,
  meeting,
  onCreateTask
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('high');
  const [dueDate, setDueDate] = useState('Tomorrow, 5:00 PM');
  const [project, setProject] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (meeting && isOpen) {
      setTitle(`Follow-up: ${meeting.title}`);
      setDescription(`Action item following sync on ${meeting.date}. Ensure commitments and unblocks are delivered.`);
      setPriority('high');
      setDueDate('Tomorrow, 5:00 PM');
      setProject(meeting.clientProject || 'General');
      setError('');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    const newTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate.trim() || 'Tomorrow, 5:00 PM',
      project: project.trim() || 'General',
      status: 'pending',
      meeting: {
        title: meeting.title,
        link: meeting.meetingLink,
        time: meeting.timeLabel,
        attendees: meeting.participants?.join(', ') || 'Team',
        agenda: meeting.agenda || 'Meeting follow-up.'
      }
    };

    onCreateTask(meeting.id, newTask);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Create Follow-up Task</h3>
            <p className="modal-subtitle">
              Add a commitment linked to "{meeting.title}".
            </p>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="postpone-notice-box" style={{ backgroundColor: 'var(--badge-rose-bg)', borderColor: 'var(--badge-rose-border)', color: 'var(--badge-rose-text)' }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="followup-title-input">
                Task Name <span style={{ color: 'var(--badge-rose-text)' }}>*</span>
              </label>
              <input
                id="followup-title-input"
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="followup-desc-input">
                Notes & Context
              </label>
              <textarea
                id="followup-desc-input"
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <div className="priority-selector">
                  {['high', 'medium', 'low'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`priority-option-btn ${priority === p ? `selected-${p}` : ''}`}
                      onClick={() => setPriority(p)}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="followup-due-input">Due Date / Time</label>
                <input
                  id="followup-due-input"
                  type="text"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="followup-proj-input">Project / Client</label>
              <input
                id="followup-proj-input"
                type="text"
                className="form-input"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <CheckSquare size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
