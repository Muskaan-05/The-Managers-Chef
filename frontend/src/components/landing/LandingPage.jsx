import React from 'react';
import {
  Sparkles,
  Brain,
  Calendar,
  CheckSquare,
  Compass,
  ArrowRight,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
  Users
} from 'lucide-react';
import '../../styles/landing.css';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-page-container">
      {/* 1. Header Navigation Bar */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand" onClick={() => onNavigate('landing')}>
            <div className="brand-icon-box">
              <Sparkles size={18} />
            </div>
            <div className="brand-text-group">
              <span className="landing-brand-title">The Manager’s Chef</span>
              <span className="landing-brand-tagline">AI Memory Workspace</span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <button type="button" className="landing-nav-link" onClick={() => {
              const el = document.getElementById('features');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>
              Features
            </button>
            <button type="button" className="landing-nav-link" onClick={() => {
              const el = document.getElementById('how-it-works');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>
              How It Works
            </button>
          </nav>

          <div className="landing-header-actions">
            <button
              type="button"
              className="btn-landing-secondary"
              onClick={() => onNavigate('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="btn-landing-primary"
              onClick={() => onNavigate('signup')}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-badge">
          <Sparkles size={13} />
          <span>AI Memory Workspace for Engineering & Product Managers</span>
        </div>

        <h1 className="landing-hero-title">
          Find the context you need, <br />
          <span className="landing-hero-title-accent">when you need it.</span>
        </h1>

        <p className="landing-hero-desc">
          The Manager’s Chef is your intelligent AI executive assistant. It automatically captures
          meeting transcripts, decision logs, client commitments, and action items so you never lose
          critical context.
        </p>

        <div className="landing-hero-ctas">
          <button
            type="button"
            className="btn-landing-primary btn-hero-lg"
            onClick={() => onNavigate('signup')}
          >
            Get Started Free <ArrowRight size={16} style={{ display: 'inline', marginLeft: '6px' }} />
          </button>
          <button
            type="button"
            className="btn-landing-secondary btn-hero-lg"
            onClick={() => onNavigate('signin')}
          >
            Sign In to Workspace
          </button>
        </div>

        {/* Hero Interactive UI Preview Mockup */}
        <div className="landing-hero-preview">
          <div className="preview-window">
            <div className="preview-bar">
              <span className="preview-dot dot-red" />
              <span className="preview-dot dot-yellow" />
              <span className="preview-dot dot-green" />
              <span className="preview-title">The Manager’s Chef — Dashboard & Context Engine</span>
            </div>
            <div className="preview-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  ⚡ Executive AI Brief
                </div>
                <div className="preview-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--badge-amber-text)', backgroundColor: 'var(--badge-amber-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                      Upcoming Meeting
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Today • 10:30 AM</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                    Sprint Alignment with Tech Leads
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Prep notes ready: 2 unresolved questions regarding Q4 migration timelines and API schema sign-off.
                  </div>
                </div>

                <div className="preview-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--badge-indigo-text)', backgroundColor: 'var(--badge-indigo-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                      Important Follow-up
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Due Today • 03:00 PM</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                    Client X SLA Delivery Verification
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Elena flagged a 48h buffer requirement in the Sept 12 sync. Final sign-off needed before Friday EOD.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  🧠 Relevant Memories
                </div>
                <div className="preview-card-item" style={{ backgroundColor: '#ffffff' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-main)' }}>
                    Client X — Delivery Deadline
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-body)' }}>
                    "During Sept 12 sync, Client X requested delivery before Friday for a 48h QA acceptance window."
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                    Sep 12 • Meeting Transcript
                  </div>
                </div>

                <div className="preview-card-item" style={{ backgroundColor: '#ffffff' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-main)' }}>
                    Q4 Staffing & Hiring Order
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-body)' }}>
                    "Agreed with VP Eng to prioritize 1 Senior Distributed Systems Engineer."
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                    Sep 10 • 1:1 with VP Eng
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section className="landing-features-section" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Core Workspace Capabilities</span>
            <h2 className="landing-section-title">Everything you need to lead with clarity</h2>
            <p className="landing-section-subtitle">
              Built specifically for engineering managers, product leads, and executive directors who manage complex projects and high-volume communication.
            </p>
          </div>

          <div className="landing-features-grid">
            {/* Feature 1: Memories */}
            <div className="landing-feature-card">
              <div className="feature-icon-box feature-icon-indigo">
                <Brain size={22} />
              </div>
              <h3 className="feature-card-title">Memories Workspace</h3>
              <p className="feature-card-desc">
                Find past decisions, client commitments, and policy notes instantly. Search across titles, clients, projects, or people involved.
              </p>
            </div>

            {/* Feature 2: Meetings */}
            <div className="landing-feature-card">
              <div className="feature-icon-box feature-icon-emerald">
                <Calendar size={22} />
              </div>
              <h3 className="feature-card-title">Smart Meetings</h3>
              <p className="feature-card-desc">
                Organize meeting agendas, participants, previous context, and AI-extracted key decisions and action items in one place.
              </p>
            </div>

            {/* Feature 3: Tasks */}
            <div className="landing-feature-card">
              <div className="feature-icon-box feature-icon-amber">
                <CheckSquare size={22} />
              </div>
              <h3 className="feature-card-title">Executive Tasks</h3>
              <p className="feature-card-desc">
                Track high-priority deliverables and postpone deadlines cleanly without losing trace of linked meetings or original context.
              </p>
            </div>

            {/* Feature 4: AI Context */}
            <div className="landing-feature-card">
              <div className="feature-icon-box feature-icon-rose">
                <Compass size={22} />
              </div>
              <h3 className="feature-card-title">AI-Powered Context</h3>
              <p className="feature-card-desc">
                Connect the dots automatically. See how tasks, meetings, decisions, and memories interlink without complicated database setups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section className="landing-steps-section" id="how-it-works">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-tag">Simple & Seamless Flow</span>
            <h2 className="landing-section-title">How The Manager’s Chef Works</h2>
            <p className="landing-section-subtitle">
              Designed to sit naturally alongside your existing calendar and workflow.
            </p>
          </div>

          <div className="landing-steps-grid">
            <div className="landing-step-card">
              <div className="step-number">1</div>
              <h3 className="step-title">Ingest Context & Notes</h3>
              <p className="step-desc">
                Your calendar events, meeting transcripts, and manager notes are organized into structured context blocks automatically.
              </p>
            </div>

            <div className="landing-step-card">
              <div className="step-number">2</div>
              <h3 className="step-title">AI Extracts Key Memory Points</h3>
              <p className="step-desc">
                The Chef extracts key decisions, deadlines, client commitments, and follow-up items with zero manual effort required.
              </p>
            </div>

            <div className="landing-step-card">
              <div className="step-number">3</div>
              <h3 className="step-title">Execute with Full Clarity</h3>
              <p className="step-desc">
                Search your workspace instantly, jump into prep notes before meetings, and execute tasks backed by complete historical context.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA Banner Section */}
      <section className="landing-banner-section">
        <div className="landing-banner-card">
          <h2 className="banner-title">Ready to streamline your management workflow?</h2>
          <p className="banner-desc">
            Join engineering managers who use The Manager’s Chef to stay ahead of deadlines, meetings, and critical decisions.
          </p>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-banner-light"
              onClick={() => onNavigate('signup')}
            >
              Get Started Free
            </button>
            <button
              type="button"
              className="btn-landing-secondary"
              style={{ backgroundColor: 'transparent', color: '#ffffff', borderColor: '#818cf8' }}
              onClick={() => onNavigate('signin')}
            >
              Sign In to Workspace
            </button>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>The Manager’s Chef</span>
            <span>© 2026. All rights reserved.</span>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
