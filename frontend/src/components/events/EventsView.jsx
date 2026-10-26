import React, { useState, useMemo, useEffect, useCallback } from 'react';
import EventCard from './EventCard';
import EventModal from './EventModal';
import { 
  getEvents, 
  createEvent, 
  updateEvent, 
  deleteEvent, 
  ensureDefaultContext,
  launchBotForEvent
} from '../../services/api';
import { formatDisplayDate, isMeetingEntry } from '../../utils/dateUtils';
import { 
  Calendar, 
  Clock, 
  CalendarCheck2, 
  History, 
  Search, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  SearchX,
  X 
} from 'lucide-react';
import '../../styles/events.css';

export default function EventsView({
  isAddModalOpen = false,
  setIsAddModalOpen,
  onEventsCountChange
}) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form state
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const isModalOpen = isAddModalOpen || localModalOpen;
  const closeModal = () => {
    setLocalModalOpen(false);
    setEditingEvent(null);
    if (setIsAddModalOpen) setIsAddModalOpen(false);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Map backend event object to UI model
  const mapBackendEvent = useCallback((e) => {
    const start = e.start_time ? new Date(e.start_time) : new Date();
    const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const isPast = end < now;
    const isGoogle = e.source === 'google_calendar' || Boolean(e.google_event_id);

    const formattedStart = formatDisplayDate(e.start_time);
    const timeOnly = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
      (e.end_time ? ` - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '');

    return {
      id: e.id,
      title: e.title,
      description: e.description || '',
      start_time: e.start_time,
      end_time: e.end_time,
      startDate: start,
      endDate: end,
      location: e.location || '',
      participants: e.participants || [],
      source: e.source || (isGoogle ? 'google_calendar' : 'manual'),
      google_event_id: e.google_event_id,
      isGoogle: isGoogle,
      isToday: isToday,
      isPast: isPast,
      formattedStart: formattedStart,
      timeLabel: isToday ? `Today, ${timeOnly}` : `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeOnly}`,
      context_id: e.context_id,
    };
  }, []);

  // Fetch events from backend API
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getEvents();

      // Display non-meeting events here (meeting-like Google entries are routed to Meetings view)
      const nonMeetingEvents = (data || []).filter((e) => {
        if (e.source === 'google_calendar') {
          return !isMeetingEntry(e);
        }
        return true;
      });

      const mapped = nonMeetingEvents.map(mapBackendEvent);

      // Upcoming events: nearest first
      const upcoming = mapped
        .filter((e) => !e.isPast)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      // Past events: most recent first
      const past = mapped
        .filter((e) => e.isPast)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

      setEvents([...upcoming, ...past]);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError(err.message || 'Failed to load events from server');
    } finally {
      setIsLoading(false);
    }
  }, [mapBackendEvent]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Update badge count
  useEffect(() => {
    if (onEventsCountChange) {
      const activeCount = events.filter((e) => !e.isPast).length;
      onEventsCountChange(activeCount);
    }
  }, [events, onEventsCountChange]);

  // Counts for summary metrics
  const counts = useMemo(() => {
    return {
      all: events.length,
      today: events.filter((e) => e.isToday).length,
      upcoming: events.filter((e) => !e.isPast).length,
      past: events.filter((e) => e.isPast).length,
    };
  }, [events]);

  // Filtered & searched events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (activeFilter === 'today' && !e.isToday) return false;
      if (activeFilter === 'upcoming' && e.isPast) return false;
      if (activeFilter === 'past' && !e.isPast) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesDesc = (e.description || '').toLowerCase().includes(q);
        const matchesLocation = (e.location || '').toLowerCase().includes(q);
        const matchesParticipants = (e.participants || []).some((p) => p.toLowerCase().includes(q));
        return matchesTitle || matchesDesc || matchesLocation || matchesParticipants;
      }

      return true;
    });
  }, [events, activeFilter, searchQuery]);

  const upcomingList = useMemo(() => {
    return filteredEvents.filter((e) => !e.isPast);
  }, [filteredEvents]);

  const pastList = useMemo(() => {
    return filteredEvents.filter((e) => e.isPast);
  }, [filteredEvents]);

  // Save (Create or Edit)
  const handleSaveEvent = async (payload, isEditing, eventId) => {
    try {
      if (isEditing && eventId) {
        await updateEvent(eventId, payload);
        closeModal();
        showToast('Event updated successfully.');
      } else {
        const contextId = await ensureDefaultContext();
        await createEvent({
          ...payload,
          context_id: contextId,
        });
        closeModal();
        showToast('New event created successfully.');
      }
      await fetchEvents();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to save event'}`);
    }
  };

  const handleEditClick = (event) => {
    setEditingEvent(event);
    setLocalModalOpen(true);
  };

  const handleDeleteEvent = async (event) => {
    if (event.isGoogle) {
      showToast('Synced Google Calendar events are read-only.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) {
      return;
    }
    try {
      await deleteEvent(event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      showToast(`Event "${event.title}" deleted.`);
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to delete event'}`);
    }
  };

  const handleJoinBotForEvent = async (event) => {
    try {
      showToast('Launching AI Meeting Bot for event...');
      const res = await launchBotForEvent(event.id);
      showToast(res?.message || 'AI Meeting Bot successfully queued.');
      fetchEvents();
    } catch (err) {
      showToast(`Bot error: ${err.message || 'Failed to launch bot'}`);
    }
  };

  const handleResetFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
  };

  const isFiltered = activeFilter !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="events-container">
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
            onClick={fetchEvents}
            style={{
              background: 'none',
              border: 'none',
              color: 'currentColor',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Summary Cards */}
      <div className="event-summary-grid">
        <div
          className={`event-summary-card ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          <div className="event-icon-box icon-all">
            <Calendar size={18} />
          </div>
          <div className="event-summary-content">
            <span className="event-summary-count">{counts.all}</span>
            <span className="event-summary-label">All Events</span>
          </div>
        </div>

        <div
          className={`event-summary-card ${activeFilter === 'today' ? 'active' : ''}`}
          onClick={() => setActiveFilter('today')}
        >
          <div className="event-icon-box icon-today">
            <Clock size={18} />
          </div>
          <div className="event-summary-content">
            <span className="event-summary-count">{counts.today}</span>
            <span className="event-summary-label">Today</span>
          </div>
        </div>

        <div
          className={`event-summary-card ${activeFilter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveFilter('upcoming')}
        >
          <div className="event-icon-box icon-upcoming">
            <CalendarCheck2 size={18} />
          </div>
          <div className="event-summary-content">
            <span className="event-summary-count">{counts.upcoming}</span>
            <span className="event-summary-label">Upcoming</span>
          </div>
        </div>

        <div
          className={`event-summary-card ${activeFilter === 'past' ? 'active' : ''}`}
          onClick={() => setActiveFilter('past')}
        >
          <div className="event-icon-box icon-past">
            <History size={18} />
          </div>
          <div className="event-summary-content">
            <span className="event-summary-count">{counts.past}</span>
            <span className="event-summary-label">Past Events</span>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="task-filter-bar">
        <div className="filter-tabs-group">
          <button
            type="button"
            className={`filter-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${activeFilter === 'today' ? 'active' : ''}`}
            onClick={() => setActiveFilter('today')}
          >
            Today ({counts.today})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${activeFilter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveFilter('upcoming')}
          >
            Upcoming ({counts.upcoming})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${activeFilter === 'past' ? 'active' : ''}`}
            onClick={() => setActiveFilter('past')}
          >
            Past ({counts.past})
          </button>
        </div>

        <div className="filter-controls-group">
          <div className="search-input-wrapper">
            <Search size={14} className="search-input-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search events, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="primary-add-task-btn"
            onClick={() => {
              setEditingEvent(null);
              setLocalModalOpen(true);
            }}
          >
            <Plus size={15} />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* 3. Event List Sections */}
      {isLoading ? (
        <div className="task-table-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
          <p>Loading calendar events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="task-table-card">
          <div className="tasks-empty-state">
            {isFiltered ? (
              <>
                <SearchX size={36} className="tasks-empty-icon" />
                <h3 className="tasks-empty-title">No matching events found</h3>
                <p className="tasks-empty-desc">
                  No events match your current filter or search criteria.
                </p>
                <button
                  type="button"
                  className="tasks-empty-action-btn"
                  onClick={handleResetFilters}
                >
                  Clear all filters
                </button>
              </>
            ) : (
              <>
                <Calendar size={36} className="tasks-empty-icon" />
                <h3 className="tasks-empty-title">No calendar events</h3>
                <p className="tasks-empty-desc">
                  You have no scheduled appointments or calendar events.
                </p>
                <button
                  type="button"
                  className="tasks-empty-action-btn"
                  onClick={() => {
                    setEditingEvent(null);
                    setLocalModalOpen(true);
                  }}
                >
                  <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Add an Event
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="events-list-wrapper">
          {/* Upcoming Events Section */}
          {upcomingList.length > 0 && (
            <section className="events-section upcoming-events-section">
              <div className="events-section-header">
                <h3 className="events-section-title">Upcoming Events</h3>
                <span className="events-section-count">{upcomingList.length}</span>
              </div>
              <div className="events-list-container">
                {upcomingList.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteEvent}
                    onJoinBot={handleJoinBotForEvent}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past Events Section */}
          {pastList.length > 0 && (
            <section className="events-section past-events-section">
              <div className="events-section-header">
                <h3 className="events-section-title">Past Events</h3>
                <span className="events-section-count">{pastList.length}</span>
              </div>
              <div className="events-list-container">
                {pastList.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteEvent}
                    onJoinBot={handleJoinBotForEvent}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Add / Edit Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveEvent}
        eventToEdit={editingEvent}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="toast-feedback" role="status">
          <Check size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

