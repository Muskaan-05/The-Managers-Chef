import React, { useMemo } from 'react';
import MeetingCard from './MeetingCard';
import { SearchX, Calendar, Plus } from 'lucide-react';

export default function MeetingList({
  meetings = [],
  onJoinMeeting,
  onViewDetails,
  onToggleFollowUp,
  onCreateFollowUpTask,
  onOpenNotes,
  onEditMeeting,
  onDeleteMeeting,
  onResetFilters,
  onScheduleMeeting,
  isFiltered = false
}) {
  const upcomingMeetings = useMemo(() => {
    return meetings.filter((m) => !m.isPast);
  }, [meetings]);

  const pastMeetings = useMemo(() => {
    return meetings.filter((m) => m.isPast);
  }, [meetings]);

  if (meetings.length === 0) {
    return (
      <div className="task-table-card">
        <div className="tasks-empty-state">
          {isFiltered ? (
            <>
              <SearchX size={36} className="tasks-empty-icon" />
              <h3 className="tasks-empty-title">No matching meetings found</h3>
              <p className="tasks-empty-desc">
                No meetings match your current filter or search criteria. Try clearing your filters.
              </p>
              <button
                type="button"
                className="tasks-empty-action-btn"
                onClick={onResetFilters}
              >
                Clear all filters
              </button>
            </>
          ) : (
            <>
              <Calendar size={36} className="tasks-empty-icon" />
              <h3 className="tasks-empty-title">No scheduled meetings</h3>
              <p className="tasks-empty-desc">
                Your calendar is clear. You can schedule a new meeting or prep briefing anytime.
              </p>
              <button
                type="button"
                className="tasks-empty-action-btn"
                onClick={onScheduleMeeting}
              >
                <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Schedule a meeting
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="meetings-list-wrapper">
      {/* 1. Upcoming Meetings Section (Meetings that have not ended) */}
      {upcomingMeetings.length > 0 && (
        <section className="meetings-section upcoming-meetings-section">
          <div className="meetings-section-header">
            <h3 className="meetings-section-title">Upcoming Meetings</h3>
            <span className="meetings-section-count">{upcomingMeetings.length}</span>
          </div>
          <div className="meetings-list-container">
            {upcomingMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onJoinMeeting={onJoinMeeting}
                onViewDetails={onViewDetails}
                onToggleFollowUp={onToggleFollowUp}
                onCreateFollowUpTask={onCreateFollowUpTask}
                onOpenNotes={onOpenNotes}
                onEditMeeting={onEditMeeting}
                onDeleteMeeting={onDeleteMeeting}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Past Meetings Section (Meetings whose end time has passed) */}
      {pastMeetings.length > 0 && (
        <section className="meetings-section past-meetings-section">
          <div className="meetings-section-header">
            <h3 className="meetings-section-title">Past Meetings</h3>
            <span className="meetings-section-count">{pastMeetings.length}</span>
          </div>
          <div className="meetings-list-container">
            {pastMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onJoinMeeting={onJoinMeeting}
                onViewDetails={onViewDetails}
                onToggleFollowUp={onToggleFollowUp}
                onCreateFollowUpTask={onCreateFollowUpTask}
                onOpenNotes={onOpenNotes}
                onEditMeeting={onEditMeeting}
                onDeleteMeeting={onDeleteMeeting}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
