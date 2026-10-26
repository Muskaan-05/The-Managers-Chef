import React from 'react';
import { 
  LayoutDashboard, 
  Brain, 
  Calendar, 
  CalendarDays,
  CheckSquare, 
  CheckCircle2,
  BookmarkCheck,
  Bell,
  Settings, 
  Sparkles,
  X,
  Compass,
  LogOut
} from 'lucide-react';

export default function Sidebar({ 
  activeNav, 
  setActiveNav, 
  isMobileOpen, 
  setIsMobileOpen,
  user,
  tasksBadge,
  meetingsBadge,
  eventsBadge,
  commitmentsBadge,
  remindersBadge,
  onLogout
}) {

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'memories', label: 'Memories', icon: Brain, badge: '4 new' },
    { 
      id: 'meetings', 
      label: 'Meetings', 
      icon: Calendar,
      badge: meetingsBadge !== undefined ? (meetingsBadge > 0 ? String(meetingsBadge) : undefined) : undefined
    },
    { 
      id: 'events', 
      label: 'Events', 
      icon: CalendarDays,
      badge: eventsBadge !== undefined ? (eventsBadge > 0 ? String(eventsBadge) : undefined) : undefined
    },
    { 
      id: 'commitments', 
      label: 'Commitments', 
      icon: CheckCircle2,
      badge: commitmentsBadge !== undefined ? (commitmentsBadge > 0 ? String(commitmentsBadge) : undefined) : undefined
    },
    { 
      id: 'decisions', 
      label: 'Decisions', 
      icon: BookmarkCheck,
    },
    { 
      id: 'reminders', 
      label: 'Reminders', 
      icon: Bell,
      badge: remindersBadge !== undefined ? (remindersBadge > 0 ? String(remindersBadge) : undefined) : undefined
    },
    { 
      id: 'tasks', 
      label: 'Tasks', 
      icon: CheckSquare, 
      badge: tasksBadge !== undefined ? (tasksBadge > 0 ? String(tasksBadge) : undefined) : '2' 
    },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];


  const handleNavClick = (id) => {
    setActiveNav(id);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        {/* Top Branding Section */}
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-brand" onClick={() => handleNavClick('landing')} style={{ cursor: 'pointer' }} title="Return to Landing Page">
            <div className="brand-icon-box">
              <Sparkles className="brand-icon" size={18} />
            </div>
            <div className="brand-text-group">
              <span className="brand-title">The Manager’s Chef</span>
              <span className="brand-tagline">AI Memory Workspace</span>
            </div>
          </div>
          {isMobileOpen && (
            <button 
              className="sidebar-close-btn"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="nav-group-label">WORKSPACE</div>
          <ul className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`nav-button ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="nav-icon" size={18} />
                    <span className="nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`nav-badge ${item.badge.includes('new') ? 'badge-new' : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile Mini Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-summary">
            <div className="user-avatar-initials">
              {user?.avatarInitials || 'EM'}
            </div>
            <div className="user-meta-group">
              <span className="user-full-name">{user?.name || 'Alex Morgan'}</span>
            </div>
            {onLogout && (
              <button 
                type="button" 
                className="sidebar-logout-btn" 
                onClick={onLogout}
                title="Log out of session"
                aria-label="Log out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
