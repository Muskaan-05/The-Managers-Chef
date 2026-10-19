import React from 'react';
import { Search, X } from 'lucide-react';

export default function MeetingFilterBar({
  activeFilter = 'all',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  counts = { all: 0, today: 0, upcoming: 0, completed: 0, needs_followup: 0 }
}) {
  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'today', label: 'Today', count: counts.today },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'needs_followup', label: 'Needs Follow-up', count: counts.needs_followup, isUrgent: counts.needs_followup > 0 },
  ];

  return (
    <div className="meetings-toolbar">
      <div className="filter-tabs" role="tablist" aria-label="Meeting filters">
        {tabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`filter-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onFilterChange(tab.id)}
            >
              <span>{tab.label}</span>
              <span className={`filter-count-badge ${tab.isUrgent && !isActive ? 'badge-urgent' : ''}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="meetings-search-wrapper">
        <Search className="meetings-search-icon" size={15} />
        <input
          type="text"
          className="meetings-search-input"
          placeholder="Search by title, client, or project..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search meetings"
        />
        {searchQuery && (
          <button
            type="button"
            className="meetings-search-clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear meeting search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
