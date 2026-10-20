import React from 'react';
import { 
  LayoutDashboard, 
  Brain, 
  Calendar, 
  CalendarDays,
  CheckSquare, 
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
                      <span className={`nav-badge ${isActive ? 'badge-active' : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Calm Context Pill / Hint */}
        <div className="sidebar-context-status">
          <div className="context-indicator">
            <span className="status-ping" />
            <span className="status-text">Context Synced</span>
          </div>
          <p className="context-note">
            Ingesting calendar & meeting transcripts
          </p>
        </div>

        {/* User Profile Section at bottom */}
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {user?.avatarInitials || 'MG'}
          </div>
          <div className="profile-info" style={{ flex: 1 }}>
            <span className="profile-name">{user?.name || 'Alex Morgan'}</span>
            <span className="profile-role">{user?.role || 'Engineering Manager'}</span>
          </div>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={onLogout ? onLogout : () => handleNavClick('landing')}
            title="Sign Out to Landing Page"

            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
