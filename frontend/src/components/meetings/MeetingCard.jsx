import React, { useState, useRef, useEffect } from 'react';
import { 
  Video, 
  Clock, 
  Calendar, 
  Folder, 
  Users, 
  MoreHorizontal, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  PlusSquare,
  Pencil,
  Trash2,
  Globe
} from 'lucide-react';

export default function MeetingCard({
  meeting,
  onJoinMeeting,
  onViewDetails,
  onToggleFollowUp,
  onCreateFollowUpTask,
  onOpenNotes,
  onEditMeeting,
  onDeleteMeeting
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const isToday = meeting.status === 'today';
  const isPast = meeting.isPast || meeting.status === 'completed';
  const isCompleted = isPast;
  const isUpcoming = !isPast;
  const isGoogle = meeting.isGoogle || meeting.source === 'google_calendar';

  const handleAction = (callback) => {
    setIsMenuOpen(false);
    if (callback) callback(meeting);
  };

  return (
    <article 
      className={`meeting-card-item ${isToday ? 'item-today' : ''} ${isPast ? 'item-past' : ''} ${meeting.needsFollowUp ? 'item-needs-followup' : ''}`}
    >
      {/* Card Header */}
      <div className="meeting-card-header">
        <div className="meeting-header-main">
          <div className="meeting-meta-row">
            {isGoogle ? (
              <span className="meeting-google-badge" title="Synced from Google Calendar (Read-only)">
                <Globe size={11} />
                <span>Google Calendar</span>
              </span>
            ) : (
              <span className="meeting-type-badge">
                {meeting.meetingType || 'Meeting'}
              </span>
            )}
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
            {isPast ? (
              <span className="status-pill status-completed">
                Past
              </span>
            ) : isToday ? (
              <span className="status-pill status-today">
                Today
              </span>
            ) : null}
          </div>

          <h3 
            className="meeting-card-title" 
            onClick={() => onViewDetails(meeting)}
            title="Click to view full meeting context"
          >
            {meeting.title}
          </h3>
        </div>

        {/* Time Badge */}
        <div className={`meeting-time-badge ${isToday ? 'time-today' : ''} ${isPast ? 'time-past' : ''}`}>
          <Clock size={14} />
          <span>{meeting.timeLabel || `${meeting.date} · ${meeting.time}`}</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="meeting-card-body">
        {/* Agenda / Brief snippet */}
        {meeting.agenda && (
          <div className="meeting-agenda-snippet">
            {meeting.agenda}
          </div>
        )}

        {/* Participants */}
        {meeting.participants && meeting.participants.length > 0 && (
          <div className="meeting-participants-row">
            <span className="participants-label">Attendees:</span>
            {meeting.participants.map((p, idx) => (
              <span key={idx} className="participant-chip">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer & Action Buttons */}
      <div className="meeting-card-footer">
        <div className="meeting-footer-left">
          {meeting.relatedMemories && meeting.relatedMemories.length > 0 && (
            <div className="meeting-indicator-item" title={`${meeting.relatedMemories.length} connected memories`}>
              <FileText size={14} style={{ color: 'var(--text-subtle)' }} />
              <span>{meeting.relatedMemories.length} {meeting.relatedMemories.length === 1 ? 'memory' : 'memories'}</span>
            </div>
          )}
          {meeting.relatedTasks && meeting.relatedTasks.length > 0 && (
            <div className="meeting-indicator-item" title={`${meeting.relatedTasks.length} connected tasks`}>
              <CheckCircle2 size={14} style={{ color: 'var(--text-subtle)' }} />
              <span>{meeting.relatedTasks.length} {meeting.relatedTasks.length === 1 ? 'task' : 'tasks'}</span>
            </div>
          )}
          {meeting.location && (
            <div className="meeting-indicator-item">
              <Video size={14} style={{ color: 'var(--text-subtle)' }} />
              <span>{meeting.location}</span>
            </div>
          )}
        </div>

        <div className="meeting-actions-group">
          {/* Join Meeting button (for upcoming / today meetings) */}
          {isUpcoming && meeting.meetingLink && (
            <button
              type="button"
              className="btn-join-meeting"
              onClick={() => onJoinMeeting(meeting)}
              title="Launch meeting"
            >
              <Video size={13} />
              <span>Join Meeting</span>
            </button>
          )}

          {/* View Details button */}
          <button
            type="button"
            className="btn-view-details"
            onClick={() => onViewDetails(meeting)}
          >
            <span>View Details</span>
          </button>

          {/* Contextual Three-dot Actions Menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`action-menu-trigger ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="More meeting actions"
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
            >
              <MoreHorizontal size={16} />
            </button>

            {isMenuOpen && (
              <div className="actions-dropdown-menu" role="menu">
                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => handleAction(onViewDetails)}
                >
                  <FileText size={14} />
                  <span>View Details & Notes</span>
                </button>

                {/* Edit Action */}
                {!isGoogle && onEditMeeting && (
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    role="menuitem"
                    onClick={() => handleAction(onEditMeeting)}
                  >
                    <Pencil size={14} />
                    <span>Edit Meeting</span>
                  </button>
                )}

                {isUpcoming && meeting.meetingLink && (
                  <button
                    type="button"
                    className="dropdown-item-btn"
                    role="menuitem"
                    onClick={() => handleAction(onJoinMeeting)}
                  >
                    <Video size={14} />
                    <span>Join Meeting</span>
                  </button>
                )}

                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => handleAction(onToggleFollowUp)}
                >
                  <AlertTriangle size={14} />
                  <span>{meeting.needsFollowUp ? 'Clear Follow-up' : 'Mark as Follow-up'}</span>
                </button>

                <button
                  type="button"
                  className="dropdown-item-btn"
                  role="menuitem"
                  onClick={() => handleAction(onCreateFollowUpTask)}
                >
                  <PlusSquare size={14} />
                  <span>Create Follow-up Task</span>
                </button>

                {onDeleteMeeting && !isGoogle && (
                  <>
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item-btn item-danger"
                      role="menuitem"
                      onClick={() => handleAction(onDeleteMeeting)}
                    >
                      <Trash2 size={14} />
                      <span>Delete Meeting</span>
                    </button>
                  </>
                )}
                {isGoogle && (
                  <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Google Calendar (Read-only)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
