import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopSection from './components/dashboard/TopSection';
import AiBriefSection from './components/dashboard/AiBriefSection';
import RelevantMemoriesSection from './components/dashboard/RelevantMemoriesSection';
import UpcomingSection from './components/dashboard/UpcomingSection';
import TasksView from './components/tasks/TasksView';
import MeetingsView from './components/meetings/MeetingsView';
import MemoriesView from './components/memories/MemoriesView';
import LandingPage from './components/landing/LandingPage';
import SignInPage from './components/auth/SignInPage';
import SignUpPage from './components/auth/SignUpPage';
import { 
  mockCurrentUser, 
  mockAiBriefItems, 
  mockRelevantMemories, 
  mockUpcomingItems 
} from './data/mockData';
import { Brain, Settings } from 'lucide-react';
import './styles/dashboard.css';

function App() {
  const [activeNav, setActiveNav] = useState('landing');
  const [currentUser, setCurrentUser] = useState(mockCurrentUser);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Tasks page state
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [tasksBadgeCount, setTasksBadgeCount] = useState(6);

  // Meetings page state
  const [isScheduleMeetingModalOpen, setIsScheduleMeetingModalOpen] = useState(false);
  const [meetingsBadgeCount, setMeetingsBadgeCount] = useState(5);

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

  // Filter memories live based on user query
  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return mockRelevantMemories;
    const q = searchQuery.toLowerCase().trim();
    return mockRelevantMemories.filter((mem) =>
      mem.title.toLowerCase().includes(q) ||
      mem.summary.toLowerCase().includes(q) ||
      mem.category.toLowerCase().includes(q) ||
      mem.dateSource.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Render view content based on navigation
  const renderContent = () => {
    if (activeNav === 'landing') {
  return <LandingPage onNavigate={setActiveNav} />;
}
    if (activeNav === 'dashboard') {
      return (
        <div className="dashboard-grid">
          {/* Primary Column: What needs attention & what to remember */}
          <div className="dashboard-primary-col">
            <AiBriefSection items={mockAiBriefItems} />
            <RelevantMemoriesSection 
              memories={filteredMemories} 
              searchQuery={searchQuery}
              onResetSearch={() => setSearchQuery('')}
            />
          </div>
          {/* Secondary Column: What is coming next */}
          <div className="dashboard-secondary-col">
            <UpcomingSection items={mockUpcomingItems} />
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

    if (activeNav === 'memories') {
      return (
        <MemoriesView
          onNavigate={(view) => setActiveNav(view)}
        />
      );
    }

    // Fallback placeholder views for remaining sidebar items
    const views = {
      settings: {
        icon: Settings,
        title: "Workspace & Model Preferences",
        desc: "Configure calendar ingestion, AI brief generation frequency, and sync settings.",
      },
    };

    const currentView = views[activeNav] || views.settings;
    const ViewIcon = currentView.icon;

    return (
      <div className="secondary-view-container">
        <div className="secondary-view-badge">
          <ViewIcon size={14} />
          <span>{activeNav}</span>
        </div>
        <h2 className="secondary-view-title">{currentView.title}</h2>
        <p className="secondary-view-desc">{currentView.desc}</p>
        <button
          type="button"
          className="secondary-view-return-btn"
          onClick={() => setActiveNav('dashboard')}
        >
          Return to Dashboard
        </button>
      </div>
    );
  };

  const handleSignIn = (email) => {
    if (email) {
      const nameFromEmail = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      setCurrentUser((prev) => ({
        ...prev,
        email: email,
        name: nameFromEmail || prev.name,
      }));
    }
    setActiveNav('dashboard');
  };

  const handleSignUp = (name, email) => {
    const initials = name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'AM';
    setCurrentUser({
      id: `usr_${Date.now()}`,
      name: name || 'Alex Morgan',
      role: 'Engineering Manager',
      greetingRole: name ? name.split(' ')[0] : 'Manager',
      email: email || 'alex.morgan@company.internal',
      avatarInitials: initials || 'AM',
      status: 'Active Briefing',
    });
    setActiveNav('dashboard');
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
      {/* 1. Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        user={currentUser}
        tasksBadge={tasksBadgeCount}
        meetingsBadge={meetingsBadgeCount}
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