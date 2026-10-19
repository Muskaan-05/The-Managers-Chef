import React, { useState, useEffect } from 'react';
import { X, Calendar, Video, Folder, Users, AlertCircle } from 'lucide-react';

export default function ScheduleMeetingModal({
  isOpen,
  onClose,
  onSchedule
}) {
  const [title, setTitle] = useState('');
  const [clientProject, setClientProject] = useState('');
  const [meetingType, setMeetingType] = useState('Team Sync');
  const [date, setDate] = useState('Today');
  const [time, setTime] = useState('04:00 PM - 04:45 PM');
  const [location, setLocation] = useState('Google Meet');
  const [meetingLink, setMeetingLink] = useState('https://meet.google.com/chef-new-sync');
  const [participants, setParticipants] = useState('Elena Rostova, Alex Morgan');
  const [agenda, setAgenda] = useState('');
  const [previousContext, setPreviousContext] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setClientProject('');
      setMeetingType('Team Sync');
      setDate('Today');
      setTime('04:00 PM - 04:45 PM');
      setLocation('Google Meet');
      setMeetingLink('https://meet.google.com/chef-new-sync');
      setParticipants('Elena Rostova, Alex Morgan');
      setAgenda('');
      setPreviousContext('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    const newMeeting = {
      id: `meet-${Date.now()}`,
      title: title.trim(),
      clientProject: clientProject.trim() || 'General',
      meetingType,
      date: date.trim() || 'Today',
      time: time.trim() || 'TBD',
      timeLabel: `${date.trim() || 'Today'} · ${time.trim() || 'TBD'}`,
      participants: participants.split(',').map((p) => p.trim()).filter(Boolean),
      location: location.trim() || 'Google Meet',
      meetingLink: meetingLink.trim() || 'https://meet.google.com/chef-team-sync',
      status: date.toLowerCase().includes('today') ? 'today' : 'upcoming',
      needsFollowUp: false,
      agenda: agenda.trim() || 'Discuss project milestones and sync on action items.',
      previousContext: previousContext.trim() || '',
      relatedMemories: [],
      relatedTasks: [],
      notes: '',
      keyDecisions: [],
      actionItems: []
    };

    onSchedule(newMeeting);
  };

  const meetingTypes = ['Team Sync', '1:1', 'Client Review', 'Architecture Review', 'Strategy', 'Incident Post-Mortem'];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Schedule Meeting</h3>
            <p className="modal-subtitle">Add an upcoming discussion, client review, or 1:1.</p>
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
              <label className="form-label" htmlFor="meeting-title-input">
                Meeting Title <span style={{ color: 'var(--badge-rose-text)' }}>*</span>
              </label>
              <input
                id="meeting-title-input"
                type="text"
                className="form-input"
                placeholder="e.g. Sprint Alignment with Tech Leads"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="meeting-type-select">Meeting Type</label>
                <select
                  id="meeting-type-select"
                  className="form-select"
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                >
                  {meetingTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="meeting-project-input">Client / Project</label>
                <input
                  id="meeting-project-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sprint Planning, Client X SLA"
                  value={clientProject}
                  onChange={(e) => setClientProject(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="meeting-date-input">Date</label>
                <input
                  id="meeting-date-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Today, Tomorrow, Oct 04"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="meeting-time-input">Time</label>
                <input
                  id="meeting-time-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 03:00 PM - 04:00 PM"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="meeting-loc-input">Location</label>
                <input
                  id="meeting-loc-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Google Meet, Zoom, Room 4B"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="meeting-link-input">Meeting Link</label>
                <input
                  id="meeting-link-input"
                  type="url"
                  className="form-input"
                  placeholder="https://meet.google.com/..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="meeting-part-input">
                Participants <span className="form-label-optional">(Comma-separated)</span>
              </label>
              <input
                id="meeting-part-input"
                type="text"
                className="form-input"
                placeholder="Elena Rostova, Marcus Thorne, Alex Morgan"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="meeting-agenda-input">
                Meeting Agenda & Objectives
              </label>
              <textarea
                id="meeting-agenda-input"
                className="form-textarea"
                placeholder="Key discussion topics or question items..."
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="meeting-context-input">
                Previous Context <span className="form-label-optional">(Optional memory notes)</span>
              </label>
              <textarea
                id="meeting-context-input"
                className="form-textarea"
                placeholder="Relevant decisions or context from prior syncs..."
                value={previousContext}
                onChange={(e) => setPreviousContext(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Schedule Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
