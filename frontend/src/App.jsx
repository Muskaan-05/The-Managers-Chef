import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopSection from './components/dashboard/TopSection';
import AiBriefSection from './components/dashboard/AiBriefSection';
import RelevantMemoriesSection from './components/dashboard/RelevantMemoriesSection';
import UpcomingSection from './components/dashboard/UpcomingSection';
import TasksView from './components/tasks/TasksView';
import MeetingsView from './components/meetings/MeetingsView';
import EventsView from './components/events/EventsView';
import CommitmentsView from './components/commitments/CommitmentsView';
import DecisionsView from './components/decisions/DecisionsView';
import RemindersView from './components/reminders/RemindersView';
import MemoriesView from './components/memories/MemoriesView';
import SettingsView from './components/settings/SettingsView';
import LandingPage from './components/landing/LandingPage';
import SignInPage from './components/auth/SignInPage';
import SignUpPage from './components/auth/SignUpPage';
import { 
  mockCurrentUser, 
  mockAiBriefItems, 
  mockRelevantMemories, 
  mockUpcomingItems 
} from './data/mockData';
import { 
  getToken, 
  getStoredUser, 
  getMe, 
  logout, 
  getDashboard,
  getReminders
} from './services/api';
import { formatDisplayDate } from './utils/dateUtils';
import { playNotificationSound } from './utils/soundUtils';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import './styles/dashboard.css';

function App() {
  const [activeNav, setActiveNav] = useState(() => (getToken() ? 'dashboard' : 'landing'));
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = getStoredUser();
    if (stored) {
      const initials = stored.name
        ? stored.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'EM';
      return {
        id: stored.id,
        name: stored.name || 'Alex Morgan',
        role: 'Engineering Manager',
        greetingRole: stored.name ? stored.name.split(' ')[0] : 'Manager',
        email: stored.email || 'alex.morgan@company.internal',
        avatarInitials: initials,
        status: 'Active Briefing',
      };
    }
    return mockCurrentUser;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Tasks page state
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [tasksBadgeCount, setTasksBadgeCount] = useState(6);

  // Meetings page state
  const [isScheduleMeetingModalOpen, setIsScheduleMeetingModalOpen] = useState(false);
  const [meetingsBadgeCount, setMeetingsBadgeCount] = useState(5);

  // Events page state
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [eventsBadgeCount, setEventsBadgeCount] = useState(undefined);

  // Commitments page state
  const [commitmentsBadgeCount, setCommitmentsBadgeCount] = useState(undefined);

  // Reminders page state
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState(false);
  const [remindersBadgeCount, setRemindersBadgeCount] = useState(undefined);

  const showToast = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Reminder alert scheduler loop: periodically check due reminders, sound chime, in-app toast, browser notification
  useEffect(() => {
    if (!getToken()) return;

    // Load already notified IDs from sessionStorage to prevent duplicate alerts on refresh/tab switch
    const getNotifiedIds = () => {
      try {
        const stored = sessionStorage.getItem('tmc_notified_reminder_ids');
        return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch {
        return new Set();
      }
    };

    const saveNotifiedIds = (idSet) => {
      try {
        sessionStorage.setItem('tmc_notified_reminder_ids', JSON.stringify([...idSet]));
      } catch (e) {
        // ignore
      }
    };

    const checkReminders = async () => {
      try {
        const reminders = await getReminders({ status: 'pending' });
        if (!Array.isArray(reminders)) return;
        
        setRemindersBadgeCount(reminders.length);

        const notifiedSet = getNotifiedIds();
        const now = new Date();

        reminders.forEach((r) => {
          if (!r.trigger_time) return;
          const triggerDate = new Date(r.trigger_time);
          if (triggerDate <= now && !notifiedSet.has(r.id)) {
            // New due reminder
            notifiedSet.add(r.id);
            saveNotifiedIds(notifiedSet);

            // Synthesize sound chime
            playNotificationSound();

            // In-app toast
            showToast(`⏰ Reminder: ${r.title}`);

            // Browser push notification if permitted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`Reminder: ${r.title}`, {
                  body: r.description || 'You have a scheduled reminder due now.',
                  icon: '/favicon.ico',
                });
              } catch (e) {
                console.warn('Browser notification failed:', e);
              }
            }
          }
        });
      } catch (err) {
        // silent fail on background check
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 25000);
    return () => clearInterval(interval);
  }, []);

  // Check URL query parameters (e.g. Google OAuth callback) and validate session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get('google');

    if (googleStatus === 'connected') {
      showToast('Google Calendar connected and events synced successfully!');
      if (getToken()) {
        setActiveNav('meetings');
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleStatus === 'error') {
      const detail = params.get('detail') || 'OAuth authorization failed';
      showToast(`Google Calendar connection error: ${detail}`, true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Verify existing token with backend
    const token = getToken();
    if (token) {
      getMe()
        .then((userData) => {
          if (userData) {
            const initials = userData.name
              ? userData.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
              : 'EM';
            setCurrentUser({
              id: userData.id,
              name: userData.name || 'Alex Morgan',
              role: 'Engineering Manager',
              greetingRole: userData.name ? userData.name.split(' ')[0] : 'Manager',
              email: userData.email,
              avatarInitials: initials,
              status: 'Active Briefing',
            });
          }
        })
        .catch((err) => {
          console.warn('Session verification error:', err);
          logout();
          setActiveNav('landing');
        });
    }
  }, []);

  // Listen for session expiration events from API layer
  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(mockCurrentUser);
      setActiveNav('signin');
      showToast('Your session has expired. Please sign in again.', true);
    };
    window.addEventListener('tmc-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('tmc-auth-expired', handleAuthExpired);
  }, []);

  // Fetch live dashboard data when on dashboard view
  useEffect(() => {
    let isCurrent = true;
    if (activeNav === 'dashboard' && getToken()) {
      setIsDashboardLoading(true);
      getDashboard()
        .then((data) => {
          if (isCurrent && data) {
            setDashboardData(data);
            if (data.today?.tasks) {
              setTasksBadgeCount(data.today.tasks.length);
            }
            if (data.upcoming?.meetings) {
              setMeetingsBadgeCount(data.upcoming.meetings.length);
            }
          }
        })
        .catch((err) => {
          console.warn('Dashboard fetch error:', err);
        })
        .finally(() => {
          if (isCurrent) setIsDashboardLoading(false);
        });
    }
    return () => {
      isCurrent = false;
    };
  }, [activeNav]);

  // Handle Cmd+K / Ctrl+K keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Map live AI Brief items from backend dashboard data
  const aiBriefItems = useMemo(() => {
    if (!getToken()) return mockAiBriefItems;
    if (!dashboardData) return [];

    const items = [];

    // Today's events
    (dashboardData.today?.events || []).forEach((ev) => {
      items.push({
        id: `ev-${ev.id}`,
        type: 'meeting',
        badgeLabel: 'Calendar Event',
        badgeColor: 'amber',
        title: ev.title,
        description: ev.description || (ev.location ? `Location: ${ev.location}` : 'Scheduled on your calendar'),
        timeLabel: formatDisplayDate(ev.start_time),
        isHighPriority: true,
      });
    });

    // Today's tasks
    (dashboardData.today?.tasks || []).forEach((t) => {
      items.push({
        id: `task-${t.id}`,
        type: 'task',
        badgeLabel: t.priority === 'urgent' ? 'Urgent Task' : 'Pending Task',
        badgeColor: t.priority === 'urgent' ? 'rose' : 'indigo',
        title: t.title,
        description: t.description || 'Action required',
        timeLabel: t.deadline ? `Due ${formatDisplayDate(t.deadline)}` : 'Pending Action',
        isHighPriority: t.priority === 'urgent' || t.priority === 'high',
      });
    });

    // Commitments
    (dashboardData.today?.commitments || []).forEach((c) => {
      items.push({
        id: `com-${c.id}`,
        type: 'followup',
        badgeLabel: 'Commitment',
        badgeColor: 'indigo',
        title: c.title || 'Pending commitment',
        description: c.description || 'Requires follow-up check',
        timeLabel: 'Pending Follow-up',
        isHighPriority: false,
      });
    });

    // Reminders
    (dashboardData.today?.reminders || []).forEach((r) => {
      items.push({
        id: `rem-${r.id}`,
        type: 'decision',
        badgeLabel: 'Reminder',
        badgeColor: 'emerald',
        title: r.title || 'Reminder Alert',
        description: r.message || '',
        timeLabel: 'Alert',
        isHighPriority: false,
      });
    });

    return items;
  }, [dashboardData]);

  // Map live Upcoming items from backend dashboard data
  const upcomingItems = useMemo(() => {
    if (!getToken()) return mockUpcomingItems;
    if (!dashboardData) return [];

    const items = [];

    (dashboardData.upcoming?.meetings || []).forEach((m, idx) => {
      const start = m.start_time ? new Date(m.start_time) : null;
      const end = m.end_time ? new Date(m.end_time) : null;
      const durationMin = start && end ? Math.round((end - start) / 60000) : 45;

      items.push({
        id: `up-m-${m.id}`,
        type: 'meeting',
        title: m.title,
        subtitle: m.meeting_url || m.platform || 'Meeting',
        time: formatDisplayDate(m.start_time),
        duration: `${durationMin} min`,
        status: idx === 0 ? 'upcoming' : 'normal',
        statusLabel: 'Meeting',
      });
    });

    (dashboardData.upcoming?.deadlines || []).forEach((d) => {
      items.push({
        id: `up-d-${d.id}`,
        type: 'task',
        title: d.title,
        subtitle: d.description || `Priority: ${d.priority}`,
        time: formatDisplayDate(d.deadline),
        duration: 'Deadline',
        status: 'important',
        statusLabel: 'Due Soon',
      });
    });

    return items;
  }, [dashboardData]);

  // Filter memories live based on user query
  const filteredMemories = useMemo(() => {
    let baseMemories = getToken() ? [] : mockRelevantMemories;
    if (dashboardData?.context_highlights?.length > 0) {
      baseMemories = dashboardData.context_highlights.map((h, i) => ({
        id: `ctx-${i}`,
        title: h.content ? (h.content.length > 40 ? h.content.slice(0, 40) + '…' : h.content) : 'Context Note',
        summary: h.content,
        dateSource: h.type || 'Context',
        category: h.type ? (h.type.charAt(0).toUpperCase() + h.type.slice(1)) : 'Project',
        tagColor: 'indigo',
      }));
    }

    if (!searchQuery.trim()) return baseMemories;
    const q = searchQuery.toLowerCase().trim();
    return baseMemories.filter((mem) =>
      mem.title.toLowerCase().includes(q) ||
      mem.summary.toLowerCase().includes(q) ||
      mem.category.toLowerCase().includes(q) ||
      mem.dateSource.toLowerCase().includes(q)
    );
  }, [dashboardData, searchQuery]);

  const handleSignIn = (userOrEmail) => {
    if (!userOrEmail) {
      setActiveNav('dashboard');
      return;
    }

    const userObj = typeof userOrEmail === 'object' && userOrEmail !== null ? userOrEmail : null;
    const userEmail = userObj ? (userObj.email || '') : (typeof userOrEmail === 'string' ? userOrEmail : '');
    const userName = userObj ? (userObj.name || userObj.user_metadata?.name || '') : '';

    const nameFromEmail = (typeof userEmail === 'string' && userEmail.includes('@'))
      ? userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : '';

    const displayName = userName || nameFromEmail || 'Manager';
    const initials = (typeof displayName === 'string' ? displayName : 'Manager')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'EM';

    setCurrentUser({
      id: userObj?.id || `usr_${Date.now()}`,
      name: displayName,
      role: 'Engineering Manager',
      greetingRole: (typeof displayName === 'string' ? displayName.split(' ')[0] : 'Manager') || 'Manager',
      email: typeof userEmail === 'string' ? userEmail : '',
      avatarInitials: initials,
      status: 'Active Briefing',
    });

    setActiveNav('dashboard');
    showToast('Signed in successfully.');
  };

  const handleSignUp = (userOrName, email, user) => {
    let authUser = user;
    let name = '';
    let userEmail = '';

    if (typeof userOrName === 'object' && userOrName !== null) {
      authUser = userOrName;
      name = authUser.name || authUser.user_metadata?.name || '';
      userEmail = authUser.email || '';
    } else {
      name = typeof userOrName === 'string' ? userOrName : '';
      userEmail = typeof email === 'string' ? email : (authUser?.email || '');
    }

    const nameFromEmail = (typeof userEmail === 'string' && userEmail.includes('@'))
      ? userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : '';

    const displayName = name || nameFromEmail || 'Manager';
    const initials = (typeof displayName === 'string' ? displayName : 'Manager')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'EM';

    setCurrentUser({
      id: authUser?.id || `usr_${Date.now()}`,
      name: displayName,
      role: 'Engineering Manager',
      greetingRole: (typeof displayName === 'string' ? displayName.split(' ')[0] : 'Manager') || 'Manager',
      email: userEmail || 'alex.morgan@company.internal',
      avatarInitials: initials,
      status: 'Active Briefing',
    });

    setActiveNav('dashboard');
    showToast('Account created successfully.');
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(mockCurrentUser);
    setActiveNav('landing');
    showToast('You have been signed out.');
  };

  // Render view content based on navigation
  const renderContent = () => {
    if (activeNav === 'dashboard') {
      return (
        <div className="dashboard-grid">
          {/* Primary Column: What needs attention & what to remember */}
          <div className="dashboard-primary-col">
            <AiBriefSection items={aiBriefItems} />
            <RelevantMemoriesSection 
              memories={filteredMemories} 
              searchQuery={searchQuery}
              onResetSearch={() => setSearchQuery('')}
            />
          </div>
          {/* Secondary Column: What is coming next */}
          <div className="dashboard-secondary-col">
            <UpcomingSection items={upcomingItems} />
          </div>
        </div>
      );
    }

    if (activeNav === 'tasks') {
      return (
        <TasksView
          isAddModalOpen={isAddTaskModalOpen}
          setIsAddModalOpen={setIsAddTaskModalOpen}
          onTasksCountChange={setTasksBadgeCount}
        />
      );
    }

    if (activeNav === 'meetings') {
      return (
        <MeetingsView
          isScheduleModalOpen={isScheduleMeetingModalOpen}
          setIsScheduleModalOpen={setIsScheduleMeetingModalOpen}
          onMeetingsCountChange={setMeetingsBadgeCount}
        />
      );
    }

    if (activeNav === 'events') {
      return (
        <EventsView
          isAddModalOpen={isAddEventModalOpen}
          setIsAddModalOpen={setIsAddEventModalOpen}
          onEventsCountChange={setEventsBadgeCount}
        />
      );
    }

    if (activeNav === 'commitments') {
      return (
        <CommitmentsView
          onNavigateToMeeting={(meetingId) => {
            setActiveNav('meetings');
          }}
          onCommitmentsCountChange={setCommitmentsBadgeCount}
        />
      );
    }

    if (activeNav === 'decisions') {
      return (
        <DecisionsView
          onNavigateToMeeting={(meetingId) => {
            setActiveNav('meetings');
          }}
        />
      );
    }

    if (activeNav === 'reminders') {
      return (
        <RemindersView
          isAddModalOpen={isAddReminderModalOpen}
          setIsAddModalOpen={setIsAddReminderModalOpen}
          onRemindersCountChange={setRemindersBadgeCount}
        />
      );
    }

    if (activeNav === 'memories') {
      return (
        <MemoriesView
          onNavigate={(view) => setActiveNav(view)}
        />
      );
    }

    if (activeNav === 'settings') {
      return (
        <SettingsView
          user={currentUser}
          onNotify={showToast}
        />
      );
    }

    return null;
  };

  // Standalone pages outside the main workspace layout
  if (activeNav === 'landing') {
    return <LandingPage onNavigate={setActiveNav} />;
  }

  if (activeNav === 'signin') {
    return <SignInPage onNavigate={setActiveNav} onSignIn={handleSignIn} />;
  }

  if (activeNav === 'signup') {
    return <SignUpPage onNavigate={setActiveNav} onSignUp={handleSignUp} />;
  }

  return (
    <div className="app-container">
      {/* Toast Notification Alert */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            backgroundColor: toast.isError ? '#ef4444' : '#10b981',
            color: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            fontSize: '13.5px',
            fontWeight: 500,
            maxWidth: '420px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'currentColor',
              cursor: 'pointer',
              opacity: 0.8,
              display: 'flex',
              padding: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 1. Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        user={currentUser}
        tasksBadge={tasksBadgeCount}
        meetingsBadge={meetingsBadgeCount}
        eventsBadge={eventsBadgeCount}
        commitmentsBadge={commitmentsBadgeCount}
        remindersBadge={remindersBadgeCount}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        {/* 2. Top section — title/subtitle and primary CTA per view */}
        <TopSection
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onMenuToggle={() => setIsMobileOpen((prev) => !prev)}
          greetingName={currentUser.greetingRole || currentUser.name?.split(' ')[0] || "Manager"}
          activeNav={activeNav}
          onAddTask={() => setIsAddTaskModalOpen(true)}
          onScheduleMeeting={() => setIsScheduleMeetingModalOpen(true)}
          onAddEvent={() => setIsAddEventModalOpen(true)}
          onAddReminder={() => setIsAddReminderModalOpen(true)}
        />

        {/* Main Workspace */}
        <main className="dashboard-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;