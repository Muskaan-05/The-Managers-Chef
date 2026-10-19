import React from 'react';
import { Calendar, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function MeetingSummary({
  meetings = [],
  activeFilter = 'all',
  onSelectFilter
}) {
  const todayCount = meetings.filter((m) => m.status === 'today').length;
  const upcomingCount = meetings.filter((m) => m.status === 'upcoming' || m.status === 'today').length;
  const completedCount = meetings.filter((m) => m.status === 'completed').length;
  const followUpCount = meetings.filter((m) => m.needsFollowUp).length;

  const items = [
    {
      id: 'today',
      label: 'Today',
      count: todayCount,
      icon: Clock,
      iconClass: 'summary-icon-indigo',
    },
    {
      id: 'upcoming',
      label: 'Upcoming',
      count: upcomingCount,
      icon: Calendar,
      iconClass: 'summary-icon-amber',
    },
    {
      id: 'completed',
      label: 'Completed',
      count: completedCount,
      icon: CheckCircle2,
      iconClass: 'summary-icon-emerald',
    },
    {
      id: 'needs_followup',
      label: 'Needs Follow-up',
      count: followUpCount,
      icon: AlertTriangle,
      iconClass: 'summary-icon-rose',
    },
  ];

  return (
    <div className="meeting-summary-grid" role="region" aria-label="Meeting Summary">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeFilter === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`meeting-summary-card ${isActive ? 'active' : ''}`}
            onClick={() => onSelectFilter && onSelectFilter(item.id)}
            title={`Filter by ${item.label}`}
          >
            <div className={`summary-icon-box ${item.iconClass}`}>
              <Icon size={18} />
            </div>
            <div className="summary-info">
              <span className="summary-count">{item.count}</span>
              <span className="summary-label">{item.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
