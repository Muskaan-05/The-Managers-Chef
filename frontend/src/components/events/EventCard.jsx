import React from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Pencil, 
  Trash2, 
  Globe, 
  FileText,
  Bot
} from 'lucide-react';

export default function EventCard({
  event,
  onEdit,
  onDelete,
  onJoinBot
}) {
  const isGoogle = event.source === 'google_calendar' || Boolean(event.google_event_id);
  const isPast = event.isPast;
  const isToday = event.isToday;

  return (
    <article className={`event-card-item ${isToday ? 'item-today' : ''} ${isPast ? 'item-past' : ''}`}>
      <div className="event-card-header">
        <div className="event-header-main">
          <div className="event-meta-row">
            {isGoogle ? (
              <span className="event-google-badge" title="Synced from Google Calendar (Read-only)">
                <Globe size={11} />
                <span>Google Calendar</span>
              </span>
            ) : (
              <span className="event-source-badge">
                <Calendar size={11} />
                <span>Event</span>
              </span>
            )}

            {isPast ? (
              <span className="status-pill status-completed">Past</span>
            ) : isToday ? (
              <span className="status-pill status-today">Today</span>
            ) : (
              <span className="status-pill status-pending">Upcoming</span>
            )}
          </div>

          <h3 className="event-card-title">{event.title}</h3>
        </div>

        <div className={`event-time-badge ${isToday ? 'time-today' : ''} ${isPast ? 'time-past' : ''}`}>
          <Clock size={13} />
          <span>{event.timeLabel || event.formattedStart}</span>
        </div>
      </div>

      <div className="event-card-body">
        {event.description && (
          <div className="event-description-snippet">
            {event.description}
          </div>
        )}

        <div className="event-details-row">
          {event.location && (
            <div className="event-detail-item" title="Event location">
              <MapPin size={13} style={{ color: 'var(--text-subtle)' }} />
              <span>{event.location}</span>
            </div>
          )}

          {event.participants && event.participants.length > 0 && (
            <div className="event-detail-item" title="Participants">
              <Users size={13} style={{ color: 'var(--text-subtle)' }} />
              <span>{event.participants.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="event-card-footer">
        <div className="event-footer-left">
          {isGoogle ? (
            <span className="read-only-tag">Google Calendar (Read-only)</span>
          ) : (
            <span>Manual Event</span>
          )}
        </div>

        <div className="event-actions-group">
          {event.location && event.location.startsWith('http') && onJoinBot && (
            <button
              type="button"
              className="btn-event-action"
              onClick={() => onJoinBot(event)}
              title="Launch AI Meeting Bot for this conference"
              style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary-border)', fontWeight: 600 }}
            >
              <Bot size={12} />
              <span>Join Bot</span>
            </button>
          )}

          {!isGoogle && onEdit && (
            <button
              type="button"
              className="btn-event-action"
              onClick={() => onEdit(event)}
              aria-label="Edit event"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          )}

          {!isGoogle && onDelete && (
            <button
              type="button"
              className="btn-event-action action-delete"
              onClick={() => onDelete(event)}
              aria-label="Delete event"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

