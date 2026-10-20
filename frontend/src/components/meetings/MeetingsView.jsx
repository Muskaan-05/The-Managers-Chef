import React, { useState, useMemo, useEffect, useCallback } from 'react';
import MeetingSummary from './MeetingSummary';
import MeetingFilterBar from './MeetingFilterBar';
import MeetingList from './MeetingList';
import MeetingDetailModal from './MeetingDetailModal';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import CreateFollowUpTaskModal from './CreateFollowUpTaskModal';
import JoinMeetingModal from '../tasks/JoinMeetingModal';
import { 
  getMeetings, 
  createMeeting, 
  updateMeeting,
  deleteMeeting, 
  getEvents, 
  updateEvent,
  deleteEvent, 
  createTask, 
  ensureDefaultContext,
  getDecisions,
  createDecision,
  submitMeetingTranscript,
  joinMeeting
} from '../../services/api';
import { formatDisplayDate, parseMeetingTimes, isMeetingEntry } from '../../utils/dateUtils';
import { Check, RefreshCw, AlertCircle } from 'lucide-react';
import '../../styles/meetings.css';

export default function MeetingsView({
  isScheduleModalOpen = false,
  setIsScheduleModalOpen,
  onMeetingsCountChange
}) {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Internal modal states
  const [localScheduleOpen, setLocalScheduleOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedDetailMeeting, setSelectedDetailMeeting] = useState(null);
  const [joiningMeeting, setJoiningMeeting] = useState(null);
  const [followUpTaskMeeting, setFollowUpTaskMeeting] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const isScheduleOpen = isScheduleModalOpen || localScheduleOpen;
  const closeScheduleModal = () => {
    setLocalScheduleOpen(false);
    setEditingMeeting(null);
    if (setIsScheduleModalOpen) setIsScheduleModalOpen(false);
  };

  // Map backend meeting record to frontend display model
  const mapBackendMeeting = useCallback((m) => {
    const start = m.start_time ? new Date(m.start_time) : new Date();
    const end = m.end_time ? new Date(m.end_time) : new Date(start.getTime() + 45 * 60 * 1000);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const isPast = end < now;
    const computedStatus = isPast ? 'completed' : (isToday ? 'today' : 'upcoming');

    const formattedStart = formatDisplayDate(m.start_time);
    const timeOnly = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + 
      (m.end_time ? ` - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '');

    return {
      id: m.id,
      title: m.title,
      clientProject: 'General',
      meetingType: m.bot_process_id ? 'AI Monitored' : 'Team Sync',
      date: isToday ? 'Today' : start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      time: timeOnly,
      timeLabel: `${formattedStart} (${m.status || 'scheduled'})`,
      participants: m.participants || [],
      location: m.meet_link ? 'Google Meet' : 'Meeting Room',
      meetingLink: m.meet_link || '',
      status: computedStatus,
      rawStatus: m.status,
      needsFollowUp: false,
      agenda: m.summary || m.transcript || 'Review milestones and sync on updates.',
      previousContext: m.summary ? `Summary: ${m.summary.slice(0, 150)}...` : '',
      relatedMemories: [],
      relatedTasks: [],
      notes: m.transcript || '',
      keyDecisions: [],
      actionItems: [],
      isEvent: false,
      context_id: m.context_id,
      bot_process_id: m.bot_process_id,
      startDate: start,
      endDate: end,
      isPast: isPast,
      isGoogle: false,
      source: 'manual',
    };
  }, []);

  // Map backend event record (e.g. from Google Calendar) to frontend display model
  const mapBackendEvent = useCallback((e) => {
    const start = e.start_time ? new Date(e.start_time) : new Date();
    const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 30 * 60 * 1000);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const isPast = end < now;
    const computedStatus = isPast ? 'completed' : (isToday ? 'today' : 'upcoming');

    const isGoogle = e.source === 'google_calendar' || Boolean(e.google_event_id);
    const formattedStart = formatDisplayDate(e.start_time);
    const timeOnly = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    return {
      id: e.id,
      title: e.title,
      clientProject: isGoogle ? 'Google Calendar' : 'General',
      meetingType: isGoogle ? 'Google Meeting' : 'Calendar Meeting',
      date: isToday ? 'Today' : start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      time: timeOnly,
      timeLabel: `${formattedStart} · ${isGoogle ? 'Google Calendar' : 'Calendar Event'}`,
      participants: e.participants || [],
      location: e.location || (isGoogle ? 'Google Calendar' : 'Calendar'),
      meetingLink: (e.location && e.location.startsWith('http')) ? e.location : '',
      status: computedStatus,
      rawStatus: 'scheduled',
      needsFollowUp: false,
      agenda: e.description || 'Calendar schedule event.',
      previousContext: isGoogle ? 'Imported from Google Calendar' : '',
      relatedMemories: [],
      relatedTasks: [],
      notes: e.description || '',
      keyDecisions: [],
      actionItems: [],
      isEvent: true,
      context_id: e.context_id,
      source: e.source || (isGoogle ? 'google_calendar' : 'manual'),
      google_event_id: e.google_event_id,
      startDate: start,
      endDate: end,
      isPast: isPast,
      isGoogle: isGoogle,
    };
  }, []);

  // Fetch all meetings and calendar events
  const fetchMeetingsAndEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [meetingsData, eventsData] = await Promise.all([
        getMeetings().catch(() => []),
        getEvents().catch(() => []),
      ]);

      const mappedMeetings = (meetingsData || []).map(mapBackendMeeting);
      
      // Filter events to only display calendar items that represent meetings
      const meetingEvents = (eventsData || []).filter(isMeetingEntry);
      const mappedEvents = meetingEvents.map(mapBackendEvent);

      // Combine and split into upcoming vs past
      const combined = [...mappedMeetings, ...mappedEvents];

      // Upcoming meetings: sorted nearest first (ascending by start time)
      const upcoming = combined
        .filter((m) => !m.isPast)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      // Past meetings: sorted most recent first (descending by start time)
      const past = combined
        .filter((m) => m.isPast)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

      setMeetings([...upcoming, ...past]);
    } catch (err) {
      console.error('Failed to load meetings:', err);
      setError(err.message || 'Failed to load meetings from server');
    } finally {
      setIsLoading(false);
    }
  }, [mapBackendMeeting, mapBackendEvent]);

  useEffect(() => {
    fetchMeetingsAndEvents();
  }, [fetchMeetingsAndEvents]);

  // Update badge count
  useEffect(() => {
    if (onMeetingsCountChange) {
      const todayOrUpcoming = meetings.filter((m) => !m.isPast).length;
      onMeetingsCountChange(todayOrUpcoming);
    }
  }, [meetings, onMeetingsCountChange]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Compute counts
  const counts = useMemo(() => {
    return {
      all: meetings.length,
      today: meetings.filter((m) => m.status === 'today').length,
      upcoming: meetings.filter((m) => !m.isPast).length,
      completed: meetings.filter((m) => m.isPast).length,
      needs_followup: meetings.filter((m) => m.needsFollowUp).length,
    };
  }, [meetings]);

  // Filter & Search meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (activeFilter === 'today' && m.status !== 'today') {
        return false;
      }
      if (activeFilter === 'upcoming' && m.isPast) {
        return false;
      }
      if (activeFilter === 'completed' && !m.isPast) {
        return false;
      }
      if (activeFilter === 'needs_followup' && !m.needsFollowUp) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesProject = (m.clientProject || '').toLowerCase().includes(q);
        const matchesType = (m.meetingType || '').toLowerCase().includes(q);
        const matchesParticipants = (m.participants || []).some((p) => p.toLowerCase().includes(q));
        return matchesTitle || matchesProject || matchesType || matchesParticipants;
      }

      return true;
    });
  }, [meetings, activeFilter, searchQuery]);

  // Schedule or Edit a meeting
  const handleScheduleMeeting = async (meetingFormData, isEditing) => {
    try {
      const { startTimeISO, endTimeISO } = parseMeetingTimes(meetingFormData.date, meetingFormData.time);

      if (isEditing && editingMeeting) {
        if (editingMeeting.isEvent) {
          await updateEvent(editingMeeting.id, {
            title: meetingFormData.title,
            start_time: startTimeISO,
            end_time: endTimeISO,
            location: meetingFormData.meetingLink || meetingFormData.location,
            participants: meetingFormData.participants || [],
          });
        } else {
          await updateMeeting(editingMeeting.id, {
            title: meetingFormData.title,
            start_time: startTimeISO,
            end_time: endTimeISO,
            meet_link: meetingFormData.meetingLink,
            status: meetingFormData.status || 'scheduled',
            participants: meetingFormData.participants || [],
          });
        }
        closeScheduleModal();
        showToast('Meeting updated successfully.');
      } else {
        const contextId = await ensureDefaultContext();
        await createMeeting({
          title: meetingFormData.title,
          start_time: startTimeISO,
          end_time: endTimeISO,
          meet_link: meetingFormData.meetingLink,
          status: 'scheduled',
          participants: meetingFormData.participants || [],
          context_id: contextId,
        });
        closeScheduleModal();
        showToast('Meeting scheduled successfully.');
      }
      await fetchMeetingsAndEvents();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to save meeting'}`);
    }
  };

  const handleEditMeeting = (meeting) => {
    setEditingMeeting(meeting);
    setLocalScheduleOpen(true);
  };

  // Delete meeting or event
  const handleDeleteMeeting = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
      return;
    }
    try {
      if (item.isEvent) {
        await deleteEvent(item.id);
      } else {
        await deleteMeeting(item.id);
      }
      setMeetings((prev) => prev.filter((m) => m.id !== item.id));
      if (selectedDetailMeeting && selectedDetailMeeting.id === item.id) {
        setSelectedDetailMeeting(null);
      }
      showToast(`"${item.title}" deleted.`);
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to delete meeting'}`);
    }
  };

  const handleToggleFollowUp = (meeting) => {
    const updatedStatus = !meeting.needsFollowUp;
    setMeetings((prev) =>
      prev.map((m) => (m.id === meeting.id ? { ...m, needsFollowUp: updatedStatus } : m))
    );
    if (selectedDetailMeeting && selectedDetailMeeting.id === meeting.id) {
      setSelectedDetailMeeting((prev) => ({ ...prev, needsFollowUp: updatedStatus }));
    }
    showToast(updatedStatus ? `Marked "${meeting.title}" for follow-up.` : `Follow-up flag removed.`);
  };

  const handleSaveMeetingNotes = async (meetingId, notesData) => {
    try {
      const target = meetings.find((m) => m.id === meetingId);
      if (target && !target.isEvent && notesData.notes) {
        await submitMeetingTranscript(meetingId, notesData.notes);
      }
      setMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, ...notesData } : m))
      );
      if (selectedDetailMeeting && selectedDetailMeeting.id === meetingId) {
        setSelectedDetailMeeting((prev) => ({ ...prev, ...notesData }));
      }
      showToast('Meeting notes & decisions saved.');
    } catch (err) {
      showToast(`Saved locally: ${err.message}`);
    }
  };

  const handleCreateFollowUpTask = async (meetingId, newTask) => {
    try {
      const contextId = await ensureDefaultContext();
      await createTask({
        title: newTask.title,
        description: newTask.description || `Follow-up from meeting`,
        priority: newTask.priority || 'high',
        deadline: parseMeetingTimes('Today', '05:00 PM').startTimeISO,
        context_id: contextId,
      });

      setMeetings((prev) =>
        prev.map((m) => {
          if (m.id === meetingId) {
            const updatedRelatedTasks = [...(m.relatedTasks || []), newTask];
            return {
              ...m,
              relatedTasks: updatedRelatedTasks,
            };
          }
          return m;
        })
      );

      setFollowUpTaskMeeting(null);
      showToast(`Follow-up task created in your Tasks queue.`);
    } catch (err) {
      showToast(`Error creating task: ${err.message}`);
    }
  };

  const handleResetFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
  };

  const isFiltered = activeFilter !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="meetings-container">
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
            onClick={fetchMeetingsAndEvents}
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

      {/* Meeting Summary */}
      <MeetingSummary
        meetings={meetings}
        activeFilter={activeFilter}
        onSelectFilter={(filterId) => setActiveFilter(filterId)}
      />

      {/* Search & Filters */}
      <MeetingFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counts={counts}
      />

      {/* Upcoming & Past Meetings List */}
      {isLoading ? (
        <div className="task-table-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
          <p>Loading meetings and calendar events...</p>
        </div>
      ) : (
        <MeetingList
          meetings={filteredMeetings}
          onJoinMeeting={(meeting) => setJoiningMeeting(meeting)}
          onViewDetails={(meeting) => setSelectedDetailMeeting(meeting)}
          onToggleFollowUp={handleToggleFollowUp}
          onCreateFollowUpTask={(meeting) => setFollowUpTaskMeeting(meeting)}
          onEditMeeting={handleEditMeeting}
          onDeleteMeeting={handleDeleteMeeting}
          onResetFilters={handleResetFilters}
          onScheduleMeeting={() => {
            setEditingMeeting(null);
            setLocalScheduleOpen(true);
          }}
          isFiltered={isFiltered}
        />
      )}

      {/* Schedule / Edit Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleOpen}
        onClose={closeScheduleModal}
        onSchedule={handleScheduleMeeting}
        meetingToEdit={editingMeeting}
      />

      {/* Meeting Detail Modal */}
      <MeetingDetailModal
        isOpen={Boolean(selectedDetailMeeting)}
        onClose={() => setSelectedDetailMeeting(null)}
        meeting={selectedDetailMeeting}
        onSaveMeetingNotes={handleSaveMeetingNotes}
        onToggleFollowUp={handleToggleFollowUp}
        onCreateFollowUpTask={(meeting) => setFollowUpTaskMeeting(meeting)}
        onJoinMeeting={(meeting) => setJoiningMeeting(meeting)}
      />

      {/* Join Meeting Interface / Modal */}
      <JoinMeetingModal
        isOpen={Boolean(joiningMeeting)}
        onClose={() => setJoiningMeeting(null)}
        task={
          joiningMeeting
            ? {
                title: joiningMeeting.title,
                meeting: {
                  title: joiningMeeting.title,
                  link: joiningMeeting.meetingLink,
                  time: joiningMeeting.timeLabel || `${joiningMeeting.date} · ${joiningMeeting.time}`,
                  attendees: joiningMeeting.participants?.join(', ') || 'Participants',
                  agenda: joiningMeeting.agenda || 'Meeting sync',
                },
              }
            : null
        }
        onNotify={showToast}
      />

      {/* Create Follow-Up Task Modal */}
      <CreateFollowUpTaskModal
        isOpen={Boolean(followUpTaskMeeting)}
        onClose={() => setFollowUpTaskMeeting(null)}
        meeting={followUpTaskMeeting}
        onCreateTask={handleCreateFollowUpTask}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="toast-feedback" role="status">
          <Check size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
