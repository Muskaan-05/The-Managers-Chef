import React from 'react';
import { Search, Menu, X, Plus } from 'lucide-react';

export default function TopSection({ 
  searchQuery, 
  setSearchQuery, 
  onMenuToggle, 
  greetingName = "Manager",
  activeNav = "dashboard",
  onAddTask,
  onScheduleMeeting
}) {
  const isTasksView     = activeNav === 'tasks';
  const isMeetingsView  = activeNav === 'meetings';
  const isMemoriesView  = activeNav === 'memories';
  const isSettingsView  = activeNav === 'settings';
  const isPageView      = isTasksView || isMeetingsView || isMemoriesView || isSettingsView;

  const pageTitle = isTasksView
    ? 'Tasks'
    : isMeetingsView
    ? 'Meetings'
    : isMemoriesView
    ? 'Memories'
    : isSettingsView
    ? 'Settings'
    : `Good morning, ${greetingName}`;

  const pageSubtitle = isTasksView
    ? 'Stay on top of what needs to get done.'
    : isMeetingsView
    ? 'Stay prepared for what\'s next.'
    : isMemoriesView
    ? 'Find the context you need, when you need it.'
    : isSettingsView
    ? 'Manage your integrations, calendar sync, and account preferences.'
    : 'Here\'s what needs your attention today.';

  return (
    <header className="top-section">
      <div className="top-greeting-container">
        <div className="top-left-row">
          <button 
            type="button" 
            className="mobile-menu-trigger" 
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="greeting-text">
            <h1 className="greeting-title">{pageTitle}</h1>
            <p className="greeting-subtitle">{pageSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="top-actions-container">
        {isTasksView ? (
          <button 
            type="button" 
            className="primary-add-task-btn"
            onClick={onAddTask}
          >
            <Plus size={16} />
            <span>Add Task</span>
          </button>
        ) : isMeetingsView ? (
          <button
            type="button"
            className="primary-add-task-btn primary-schedule-meeting-btn"
            onClick={onScheduleMeeting}
          >
            <Plus size={16} />
            <span>Schedule Meeting</span>
          </button>
        ) : (isMemoriesView || isSettingsView) ? (
          null
        ) : (
          <div className="search-bar-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search memories, decisions, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search memories"
            />
            {searchQuery ? (
              <button 
                type="button" 
                className="search-clear-btn" 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <div className="search-shortcut" title="Search shortcut">
                <span className="shortcut-key">⌘</span>
                <span className="shortcut-key">K</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}


