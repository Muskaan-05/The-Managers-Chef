import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Users, AlertCircle } from 'lucide-react';
import { parseMeetingTimes } from '../../utils/dateUtils';

export default function EventModal({
  isOpen,
  onClose,
  onSave,
  eventToEdit = null
}) {
  const isEditing = Boolean(eventToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('Today');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endTime, setEndTime] = useState('11:00 AM');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setTitle(eventToEdit.title || '');
        setDescription(eventToEdit.description || '');
        setLocation(eventToEdit.location || '');
        setParticipants(
          Array.isArray(eventToEdit.participants)
            ? eventToEdit.participants.join(', ')
            : (eventToEdit.participants || '')
        );

        if (eventToEdit.startDate) {
          const d = new Date(eventToEdit.startDate);
          setDate(d.toISOString().slice(0, 10));
          setStartTime(d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        } else {
          setDate('Today');
          setStartTime('10:00 AM');
        }

        if (eventToEdit.endDate) {
          const end = new Date(eventToEdit.endDate);
          setEndTime(end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        } else {
          setEndTime('11:00 AM');
        }
      } else {
        setTitle('');
        setDescription('');
        setDate('Today');
        setStartTime('10:00 AM');
        setEndTime('11:00 AM');
        setLocation('');
        setParticipants('');
      }
      setError('');
    }
  }, [isOpen, eventToEdit]);

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
      setError('Event title is required.');
      return;
    }

    const timeRangeStr = `${startTime} - ${endTime}`;
    const { startTimeISO, endTimeISO } = parseMeetingTimes(date, timeRangeStr);

    const participantList = typeof participants === 'string'
      ? participants.split(',').map((p) => p.trim()).filter(Boolean)
      : (participants || []);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_time: startTimeISO,
      end_time: endTimeISO,
      location: location.trim() || null,
      participants: participantList,
    };

    onSave(payload, isEditing, eventToEdit?.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">{isEditing ? 'Edit Event' : 'Add Event'}</h3>
            <p className="modal-subtitle">
              {isEditing ? 'Update event details, location or schedule.' : 'Create a new calendar schedule or appointment.'}
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
              <label className="form-label" htmlFor="event-title-input">
                Event Title <span style={{ color: 'var(--badge-rose-text)' }}>*</span>
              </label>
              <input
                id="event-title-input"
                type="text"
                className="form-input"
                placeholder="e.g. Design Review, Team Lunch, Doctor Appointment"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="event-desc-input">
                Description / Agenda
              </label>
              <textarea
                id="event-desc-input"
                className="form-textarea"
                rows={3}
                placeholder="Key notes, agenda or reminders..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="event-date-input">
                  Date
                </label>
                <input
                  id="event-date-input"
                  type="text"
                  className="form-input"
                  placeholder="Today or YYYY-MM-DD"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="event-location-input">
                  Location / Room
                </label>
                <input
                  id="event-location-input"
                  type="text"
                  className="form-input"
                  placeholder="Conference Room B, Office, Remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="event-start-time">
                  Start Time
                </label>
                <input
                  id="event-start-time"
                  type="text"
                  className="form-input"
                  placeholder="10:00 AM"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="event-end-time">
                  End Time
                </label>
                <input
                  id="event-end-time"
                  type="text"
                  className="form-input"
                  placeholder="11:00 AM"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="event-participants-input">
                Participants (comma-separated)
              </label>
              <input
                id="event-participants-input"
                type="text"
                className="form-input"
                placeholder="alice@example.com, bob@example.com"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
            >
              {isEditing ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

