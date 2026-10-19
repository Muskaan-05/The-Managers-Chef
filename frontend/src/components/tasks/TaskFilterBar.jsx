import React from 'react';
import { Search, X } from 'lucide-react';

export default function TaskFilterBar({
  activeFilter = 'all',
  onFilterChange,
  searchQuery = '',
  onSearchChange,
  counts = { all: 0, pending: 0, completed: 0, overdue: 0 }
}) {
  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'overdue', label: 'Overdue', count: counts.overdue, isUrgent: counts.overdue > 0 },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="tasks-toolbar">
      <div className="filter-tabs" role="tablist" aria-label="Task status filters">
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

      <div className="tasks-search-wrapper">
        <Search className="tasks-search-icon" size={15} />
        <input
          type="text"
          className="tasks-search-input"
          placeholder="Search tasks, project, priority..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search tasks"
        />
        {searchQuery && (
          <button
            type="button"
            className="tasks-search-clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear task search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
