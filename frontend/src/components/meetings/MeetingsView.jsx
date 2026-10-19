import React, { useState, useMemo, useEffect } from 'react';
import MeetingSummary from './MeetingSummary';
import MeetingFilterBar from './MeetingFilterBar';
import MeetingList from './MeetingList';
import MeetingDetailModal from './MeetingDetailModal';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import CreateFollowUpTaskModal from './CreateFollowUpTaskModal';
import JoinMeetingModal from '../tasks/JoinMeetingModal';
import { mockInitialMeetings } from '../../data/mockData';
import { Check } from 'lucide-react';
import '../../styles/meetings.css';

export default function MeetingsView({
  isScheduleModalOpen = false,
  setIsScheduleModalOpen,
  onMeetingsCountChange
}) {
  const [meetings, setMeetings] = useState(() => {
    try {
      const saved = localStorage.getItem('tmc_manager_meetings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return mockInitialMeetings;
  });

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Internal modal states
  const [localScheduleOpen, setLocalScheduleOpen] = useState(false);
  const [selectedDetailMeeting, setSelectedDetailMeeting] = useState(null);
  const [joiningMeeting, setJoiningMeeting] = useState(null);
  const [followUpTaskMeeting, setFollowUpTaskMeeting] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const isScheduleOpen = isScheduleModalOpen || localScheduleOpen;
  const closeScheduleModal = () => {
    setLocalScheduleOpen(false);
    if (setIsScheduleModalOpen) setIsScheduleModalOpen(false);
  };

  // Sync meetings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tmc_manager_meetings', JSON.stringify(meetings));
    } catch (e) {
      // ignore
    }
    if (onMeetingsCountChange) {
      const todayOrUpcoming = meetings.filter(m => m.status === 'today' || m.status === 'upcoming').length;
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
      upcoming: meetings.filter((m) => m.status === 'upcoming' || m.status === 'today').length,
      completed: meetings.filter((m) => m.status === 'completed').length,
      needs_followup: meetings.filter((m) => m.needsFollowUp).length,
    };
  }, [meetings]);

  // Filter & Search meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      // 1. Status Filter
      if (activeFilter === 'today' && m.status !== 'today') {
        return false;
      }
      if (activeFilter === 'upcoming' && m.status !== 'upcoming' && m.status !== 'today') {
        return false;
      }
      if (activeFilter === 'completed' && m.status !== 'completed') {
        return false;
      }
      if (activeFilter === 'needs_followup' && !m.needsFollowUp) {
        return false;
      }

      // 2. Search Query (title, clientProject, meetingType, participants)
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

  // Handlers
  const handleScheduleMeeting = (newMeeting) => {
    setMeetings((prev) => [newMeeting, ...prev]);
    closeScheduleModal();
    showToast(`Meeting "${newMeeting.title}" scheduled.`);
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

  const handleSaveMeetingNotes = (meetingId, notesData) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, ...notesData } : m))
    );
    if (selectedDetailMeeting && selectedDetailMeeting.id === meetingId) {
      setSelectedDetailMeeting((prev) => ({ ...prev, ...notesData }));
    }
    showToast('Meeting notes & decisions saved.');
  };

  const handleCreateFollowUpTask = (meetingId, newTask) => {
    // 1. Update meeting's relatedTasks
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

    // 2. Persist to tmc_manager_tasks so it appears on Tasks page as well
    try {
      const existingTasksStr = localStorage.getItem('tmc_manager_tasks');
      let currentTasks = [];
      if (existingTasksStr) {
        currentTasks = JSON.parse(existingTasksStr);
      }
      const updatedTasks = [newTask, ...currentTasks];
      localStorage.setItem('tmc_manager_tasks', JSON.stringify(updatedTasks));
    } catch (e) {
      // ignore
    }

    setFollowUpTaskMeeting(null);
    showToast(`Follow-up task created and added to Tasks queue.`);
  };

  const handleResetFilters = () => {
    setActiveFilter('all');
    setSearchQuery('');
  };

  const isFiltered = activeFilter !== 'all' || Boolean(searchQuery.trim());

  return (
    <div className="meetings-container">
      {/* 3. Meeting Summary (Compact, minimal) */}
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

      {/* 4. Upcoming / Filtered Meetings List */}
      <MeetingList
        meetings={filteredMeetings}
        onJoinMeeting={(meeting) => setJoiningMeeting(meeting)}
        onViewDetails={(meeting) => setSelectedDetailMeeting(meeting)}
        onToggleFollowUp={handleToggleFollowUp}
        onCreateFollowUpTask={(meeting) => setFollowUpTaskMeeting(meeting)}
        onResetFilters={handleResetFilters}
        onScheduleMeeting={() => setLocalScheduleOpen(true)}
        isFiltered={isFiltered}
      />

      {/* Modals */}
      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleOpen}
        onClose={closeScheduleModal}
        onSchedule={handleScheduleMeeting}
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
