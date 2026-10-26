import React, { useState, useEffect } from 'react';
import { 
  X, 
  Video, 
  Users, 
  Clock, 
  Copy, 
  Check, 
  ExternalLink, 
  Calendar,
  Bot,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { joinMeeting, launchBotForEvent } from '../../services/api';

export default function JoinMeetingModal({
  isOpen,
  onClose,
  task,
  onNotify,
  onStartBot
}) {
  const [copied, setCopied] = useState(false);
  const [isLaunchingBot, setIsLaunchingBot] = useState(false);
  const [botSuccess, setBotSuccess] = useState(null);
  const [botError, setBotError] = useState(null);

  useEffect(() => {
    setCopied(false);
    setIsLaunchingBot(false);
    setBotSuccess(null);
    setBotError(null);
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
  const isBotActive = meeting.rawStatus === 'bot_active' || Boolean(botSuccess);

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
    if (meeting.link && meeting.link.startsWith('http')) {
      window.open(meeting.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLaunchBot = async () => {
    if (isLaunchingBot) return;
    setIsLaunchingBot(true);
    setBotError(null);
    setBotSuccess(null);

    try {
      if (onStartBot) {
        await onStartBot(meeting);
      } else {
        // Direct fallback: verify whether identifier belongs to event or meeting
        const isEvent = Boolean(meeting.isEvent);
        if (isEvent && meeting.id) {
          await launchBotForEvent(meeting.id);
        } else if (meeting.id) {
          await joinMeeting(meeting.id, meeting.link);
        } else {
          throw new Error('No valid meeting or event identifier found.');
        }
      }
      setBotSuccess('AI Meeting Bot launched successfully and joined background capture.');
      if (onNotify) onNotify('AI Meeting Bot launched in background.');
    } catch (err) {
      const errMsg = err?.message || 'Failed to launch AI Meeting Bot';
      setBotError(errMsg);
      if (onNotify) onNotify(`Bot error: ${errMsg}`);
    } finally {
      setIsLaunchingBot(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="brief-category-pill pill-indigo">
                <Video size={11} />
                <span>Connected Meeting</span>
              </span>
              {isBotActive && (
                <span className="status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontWeight: 600 }}>
                  ● Bot Active Recording
                </span>
              )}
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
          {/* Bot Feedback Banners */}
          {botError && (
            <div className="postpone-notice-box" style={{ backgroundColor: 'var(--badge-rose-bg)', borderColor: 'var(--badge-rose-border)', color: 'var(--badge-rose-text)', marginBottom: 14 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                <strong>Bot Launch Failed:</strong> {botError}
              </div>
            </div>
          )}

          {botSuccess && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#065f46', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 14, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={16} style={{ color: '#10b981', flexShrink: 0 }} />
              <span>{botSuccess}</span>
            </div>
          )}

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
              <span><strong>Source:</strong> {meeting.isEvent ? 'Google Calendar Event' : (meeting.clientProject || 'Workspace Meeting')}</span>
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

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Dismiss
          </button>
          
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Manual Join Call Now Button */}
            <button
              type="button"
              className="btn-secondary"
              onClick={handleJoinCall}
              title="Open Google Meet in browser window"
            >
              <ExternalLink size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Join Call Now
            </button>

            {/* AI Scraper Bot Launch Button */}
            <button
              type="button"
              className="btn-primary"
              disabled={isLaunchingBot || isBotActive}
              onClick={handleLaunchBot}
              title="Launch the AI Meeting Bot to transcribe and extract intelligence"
              style={{ minWidth: 120 }}
            >
              {isLaunchingBot ? (
                <>
                  <Loader2 size={14} className="spin-icon" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Joining Bot...
                </>
              ) : isBotActive ? (
                <>
                  <Bot size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#10b981' }} />
                  Bot Active
                </>
              ) : (
                <>
                  <Bot size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Join Bot
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
