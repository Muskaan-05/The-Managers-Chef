import React, { useState, useEffect } from 'react';
import { X, Calendar, Video, Folder, AlertCircle } from 'lucide-react';

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  task = null // null for Add Task, object for Edit Task
}) {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [project, setProject] = useState('');
  const [hasMeeting, setHasMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [error, setError] = useState('');

  // Populate form when modal opens or task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate || '');
      setProject(task.project || '');
      if (task.meeting) {
        setHasMeeting(true);
        setMeetingTitle(task.meeting.title || '');
        setMeetingLink(task.meeting.link || '');
      } else {
        setHasMeeting(false);
        setMeetingTitle('');
        setMeetingLink('');
      }
    } else {
      // Defaults for new task
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('Today, 5:00 PM');
      setProject('');
      setHasMeeting(false);
      setMeetingTitle('');
      setMeetingLink('');
    }
    setError('');
  }, [task, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task name is required.');
      return;
    }

    const updatedTaskData = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate.trim() || 'Today, 5:00 PM',
      project: project.trim() || 'General',
      meeting: hasMeeting && meetingTitle.trim() ? {
        title: meetingTitle.trim(),
        link: meetingLink.trim() || 'https://meet.google.com/chef-team-sync',
        time: dueDate.trim() || 'Upcoming',
        attendees: 'Team Leads, Alex Morgan',
        agenda: description.trim() || 'Project discussion & sync.',
      } : null,
    };

    onSave(updatedTaskData);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">{isEditing ? 'Edit Task' : 'Create New Task'}</h3>
            <p className="modal-subtitle">
              {isEditing 
                ? 'Update task commitments, priority, and timeline.' 
                : 'Add a new action item to your manager queue.'}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="postpone-notice-box" style={{ backgroundColor: 'var(--badge-rose-bg)', borderColor: 'var(--badge-rose-border)', color: 'var(--badge-rose-text)' }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Task Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="task-title-input">
                Task Name <span style={{ color: 'var(--badge-rose-text)' }}>*</span>
              </label>
              <input
                id="task-title-input"
                type="text"
                className="form-input"
                placeholder="e.g. Approve Cloud Budget Reallocation"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="task-desc-input">
                Description <span className="form-label-optional">(Optional)</span>
              </label>
              <textarea
                id="task-desc-input"
                className="form-textarea"
                placeholder="Key context, requirements, or dependencies..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Priority & Due Date */}
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
                <label className="form-label" htmlFor="task-due-input">Due Date / Time</label>
                <input
                  id="task-due-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Today, 5:00 PM"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Project / Client */}
            <div className="form-group">
              <label className="form-label" htmlFor="task-project-input">
                Related Project / Client <span className="form-label-optional">(Optional)</span>
              </label>
              <input
                id="task-project-input"
                type="text"
                className="form-input"
                placeholder="e.g. Staging Benchmark, Client X SLA"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>

            {/* Meeting Attachment Toggle */}
            <div className="meeting-toggle-box">
              <label className="meeting-toggle-header">
                <input
                  type="checkbox"
                  checked={hasMeeting}
                  onChange={(e) => setHasMeeting(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <Video size={15} style={{ color: 'var(--accent-primary)' }} />
                <span className="meeting-toggle-label">Associate with an upcoming meeting</span>
              </label>

              {hasMeeting && (
                <div className="meeting-fields-group">
                  <div className="form-group">
                    <label className="form-label" htmlFor="task-meeting-title">Meeting Title</label>
                    <input
                      id="task-meeting-title"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Sprint Alignment with Tech Leads"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="task-meeting-link">Meeting Link</label>
                    <input
                      id="task-meeting-link"
                      type="url"
                      className="form-input"
                      placeholder="https://meet.google.com/..."
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {isEditing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
