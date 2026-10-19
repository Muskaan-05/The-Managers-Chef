import React, { useState, useEffect } from 'react';
import { X, Video, Users, Clock, Copy, Check, ExternalLink, Calendar } from 'lucide-react';

export default function JoinMeetingModal({
  isOpen,
  onClose,
  task,
  onNotify
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [task, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task || !task.meeting) return null;

  const meeting = task.meeting;

  const handleCopyLink = () => {
    if (meeting.link) {
      navigator.clipboard?.writeText(meeting.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onNotify) onNotify('Meeting link copied to clipboard.');
    }
  };

  const handleJoinCall = () => {
    if (onNotify) onNotify(`Launching video session for "${meeting.title}"...`);
    // Open in new tab or simulate launching
    if (meeting.link && meeting.link.startsWith('http')) {
      window.open(meeting.link, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span className="brief-category-pill pill-indigo">
                <Video size={11} />
                <span>Connected Meeting</span>
              </span>
            </div>
            <h3 className="modal-title">{meeting.title}</h3>
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

        <div className="modal-body">
          {/* Meeting Details Card */}
          <div className="meeting-detail-card">
            <div className="meeting-row">
              <Clock size={15} className="meeting-row-icon" />
              <span><strong>Scheduled:</strong> {meeting.time || task.dueDate}</span>
            </div>
            {meeting.attendees && (
              <div className="meeting-row">
                <Users size={15} className="meeting-row-icon" />
                <span><strong>Participants:</strong> {meeting.attendees}</span>
              </div>
            )}
            <div className="meeting-row">
              <Calendar size={15} className="meeting-row-icon" />
              <span><strong>Related Task:</strong> {task.title}</span>
            </div>
          </div>

          {/* Agenda / Context */}
          {meeting.agenda && (
            <div className="form-group">
              <label className="form-label">Briefing & Agenda Notes</label>
              <p style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.45, backgroundColor: 'var(--bg-app)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                {meeting.agenda}
              </p>
            </div>
          )}

          {/* Meeting Link & Copy */}
          <div className="form-group">
            <label className="form-label">Conference Link</label>
            <div className="meeting-link-copy-box">
              <span className="meeting-url-text">{meeting.link || 'https://meet.google.com/chef-team-sync'}</span>
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
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Dismiss
          </button>
          <button type="button" className="btn-primary" onClick={handleJoinCall}>
            <ExternalLink size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Join Call Now
          </button>
        </div>
      </div>
    </div>
  );
}
