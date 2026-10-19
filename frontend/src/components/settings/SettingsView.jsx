import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Trash2, 
  User, 
  Layers, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import { 
  getGoogleStatus, 
  getGoogleConnectUrl, 
  syncGoogleCalendar, 
  disconnectGoogle,
  ensureDefaultContext 
} from '../../services/api';
import '../../styles/settings.css';

export default function SettingsView({ user, onNotify }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Load connection status
  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        setIsLoadingStatus(true);
        const res = await getGoogleStatus();
        if (isMounted) {
          setIsConnected(Boolean(res?.connected));
        }
      } catch (err) {
        console.warn('Error fetching Google status:', err);
      } finally {
        if (isMounted) setIsLoadingStatus(false);
      }
    }
    checkStatus();
    return () => { isMounted = false; };
  }, []);

  const handleConnect = async () => {
    try {
      setErrorMsg('');
      const res = await getGoogleConnectUrl();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error('No authorization URL received from backend.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initiate Google connection');
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setErrorMsg('');
      setSyncResult(null);
      const contextId = await ensureDefaultContext();
      const res = await syncGoogleCalendar(contextId);
      setSyncResult(res);
      if (onNotify) {
        onNotify(`Calendar synced: ${res?.synced || 0} events (${res?.created || 0} created, ${res?.updated || 0} updated)`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to synchronize Google Calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar? This will remove saved credentials.')) {
      return;
    }
    try {
      setErrorMsg('');
      await disconnectGoogle();
      setIsConnected(false);
      setSyncResult(null);
      if (onNotify) {
        onNotify('Google Calendar disconnected successfully');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to disconnect Google Calendar');
    }
  };

  return (
    <div className="settings-container">
      {/* 1. Google Calendar Integration Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
            <div className="settings-icon-box">
              <Calendar size={22} />
            </div>
            <div className="settings-title-group">
              <h2>Google Calendar Integration</h2>
              <p>Connect your primary Google Calendar (read-only) to import meetings and events into your workspace.</p>
            </div>
          </div>
          <div className="settings-header-right">
            {isLoadingStatus ? (
              <span className="settings-status-pill status-disconnected">Checking...</span>
            ) : isConnected ? (
              <span className="settings-status-pill status-connected">
                <span className="status-dot" /> Connected
              </span>
            ) : (
              <span className="settings-status-pill status-disconnected">
                <span className="status-dot" /> Disconnected
              </span>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="settings-alert alert-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {syncResult && (
          <div className="settings-alert alert-success">
            <CheckCircle2 size={16} />
            <span>
              Sync complete: <strong>{syncResult.synced}</strong> events processed ({syncResult.created} created, {syncResult.updated} updated).
            </span>
          </div>
        )}

        <div className="settings-card-body">
          <div className="settings-info-row">
            <span className="settings-info-label">Scope</span>
            <span className="settings-info-value">https://www.googleapis.com/auth/calendar.readonly (Read-only)</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Sync Window</span>
            <span className="settings-info-value">Upcoming 60 days</span>
          </div>

          <div className="settings-actions-row">
            {isConnected ? (
              <>
                <button
                  type="button"
                  className="btn-settings-primary"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw size={15} className={isSyncing ? 'spin-icon' : ''} />
                  <span>{isSyncing ? 'Synchronizing Events...' : 'Sync Calendar Now'}</span>
                </button>
                <button
                  type="button"
                  className="btn-settings-danger"
                  onClick={handleDisconnect}
                  disabled={isSyncing}
                >
                  <Trash2 size={15} />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-settings-primary"
                onClick={handleConnect}
              >
                <ExternalLink size={15} />
                <span>Connect Google Calendar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. User & Workspace Profile Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
            <div className="settings-icon-box" style={{ background: '#ecfdf5', color: '#047857' }}>
              <User size={22} />
            </div>
            <div className="settings-title-group">
              <h2>Workspace Profile</h2>
              <p>Your authenticated manager account details and settings.</p>
            </div>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="settings-info-row">
            <span className="settings-info-label">Full Name</span>
            <span className="settings-info-value">{user?.name || 'Manager'}</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Work Email</span>
            <span className="settings-info-value">{user?.email || 'N/A'}</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Timezone</span>
            <span className="settings-info-value">{user?.timezone || 'UTC'}</span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Account Security</span>
            <span className="settings-info-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#047857' }}>
              <ShieldCheck size={14} /> Supabase Auth JWT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

