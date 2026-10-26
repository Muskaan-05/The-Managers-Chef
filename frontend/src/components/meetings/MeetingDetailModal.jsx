import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  Video, 
  Clock, 
  Calendar, 
  Folder, 
  Users, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Sparkles,
  BookmarkCheck,
  ListTodo,
  RefreshCw,
  Bot,
  Square,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  getMeeting, 
  getDecisions, 
  getCommitments, 
  joinMeeting, 
  launchBotForEvent, 
  processMeetingAI 
} from '../../services/api';

export default function MeetingDetailModal({
  isOpen,
  onClose,
  meeting,
  onSaveMeetingNotes,
  onToggleFollowUp,
  onCreateFollowUpTask,
  onJoinMeeting,
  onProcessAI,
  onStartBot,
  onEndMeeting,
  onRefreshMeeting
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'notes' | 'ai'
  const [notes, setNotes] = useState('');
  const [keyDecisions, setKeyDecisions] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [newDecision, setNewDecision] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  // Live AI & Bot states
  const [currentMeeting, setCurrentMeeting] = useState(meeting);
  const [aiStatus, setAiStatus] = useState('pending');
  const [aiSummary, setAiSummary] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiDecisions, setAiDecisions] = useState([]);
  const [aiCommitments, setAiCommitments] = useState([]);
  const [aiError, setAiError] = useState(null);
  const [aiProcessedAt, setAiProcessedAt] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [isRetryingAI, setIsRetryingAI] = useState(false);
  const [botActionError, setBotActionError] = useState(null);

  const pollTimerRef = useRef(null);

  // Synchronize base meeting props when modal opens or meeting changes
  useEffect(() => {
    if (meeting) {
      setCurrentMeeting(meeting);
      setNotes(meeting.notes || meeting.transcript || '');
      setKeyDecisions(meeting.keyDecisions || []);
      setActionItems(meeting.actionItems || []);
      setAiStatus(meeting.ai_status || 'pending');
      setAiSummary(meeting.summary || '');
      setAiTranscript(meeting.transcript || '');
      setAiError(meeting.ai_error || null);
      setAiProcessedAt(meeting.ai_processed_at || null);
      setNewDecision('');
      setNewActionItem('');
      setHasUnsavedNotes(false);
      setBotActionError(null);

      // Default to AI tab if completed summary exists, otherwise overview
      if (meeting.summary || meeting.ai_status === 'completed') {
        setActiveTab('ai');
      } else {
        setActiveTab('overview');
      }
    }
  }, [meeting, isOpen]);

  // Fetch full details, decisions, and commitments for existing meetings
  const fetchLatestMeetingDetails = useCallback(async (meetingId, isEvent = false) => {
    if (!meetingId || isEvent) return;
    try {
      setIsLoadingDetails(true);
      const [mRes, dRes, cRes] = await Promise.all([
        getMeeting(meetingId).catch(() => null),
        getDecisions({ meeting_id: meetingId }).catch(() => []),
        getCommitments({ meeting_id: meetingId }).catch(() => []),
      ]);

      if (mRes) {
        setCurrentMeeting((prev) => ({
          ...prev,
          ...mRes,
          meetingLink: mRes.meet_link || prev.meetingLink,
          rawStatus: mRes.status,
        }));
        setAiStatus(mRes.ai_status || 'pending');
        setAiSummary(mRes.summary || '');
        setAiTranscript(mRes.transcript || '');
        setAiError(mRes.ai_error || null);
        setAiProcessedAt(mRes.ai_processed_at || null);
        if (mRes.transcript && !notes) {
          setNotes(mRes.transcript);
        }
        if (onRefreshMeeting) {
          onRefreshMeeting(mRes);
        }
      }

      if (Array.isArray(dRes)) {
        setAiDecisions(dRes);
      }
      if (Array.isArray(cRes)) {
        setAiCommitments(cRes);
      }
    } catch (err) {
      console.warn('Could not load fresh meeting details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [notes, onRefreshMeeting]);

  // Initial fetch on open for non-event meetings
  useEffect(() => {
    if (isOpen && meeting && meeting.id && !meeting.isEvent) {
      fetchLatestMeetingDetails(meeting.id, false);
    }
  }, [isOpen, meeting, fetchLatestMeetingDetails]);

  // Auto-polling for processing completion: refresh without requiring manual page reload
  useEffect(() => {
    if (!isOpen || !currentMeeting?.id || currentMeeting.isEvent) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    if (aiStatus === 'processing' || currentMeeting.rawStatus === 'bot_active') {
      pollTimerRef.current = setInterval(() => {
        fetchLatestMeetingDetails(currentMeeting.id, false);
      }, 3000);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, aiStatus, currentMeeting?.rawStatus, currentMeeting?.id, currentMeeting?.isEvent, fetchLatestMeetingDetails]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !meeting) return null;

  const mData = currentMeeting || meeting;
  const isPast = mData.isPast || mData.status === 'completed' || mData.rawStatus === 'ended';
  const isCompleted = isPast;
  const isBotActive = mData.rawStatus === 'bot_active';
  const hasConferenceLink = Boolean(mData.meetingLink && mData.meetingLink.startsWith('http'));

  const handleCopyLink = () => {
    if (mData.meetingLink) {
      navigator.clipboard?.writeText(mData.meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySummary = () => {
    if (aiSummary) {
      navigator.clipboard?.writeText(aiSummary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleNotesChange = (val) => {
    setNotes(val);
    setHasUnsavedNotes(true);
  };

  const handleSaveNotes = () => {
    if (onSaveMeetingNotes) {
      onSaveMeetingNotes(mData.id, {
        notes,
        keyDecisions,
        actionItems,
      });
    }
    setHasUnsavedNotes(false);
  };

  const handleAddDecision = (e) => {
    e.preventDefault();
    if (!newDecision.trim()) return;
    const updated = [...keyDecisions, newDecision.trim()];
    setKeyDecisions(updated);
    setNewDecision('');
    if (onSaveMeetingNotes) {
      onSaveMeetingNotes(mData.id, {
        notes,
        keyDecisions: updated,
        actionItems,
      });
    }
  };

  const handleDeleteDecision = (idx) => {
    const updated = keyDecisions.filter((_, i) => i !== idx);
    setKeyDecisions(updated);
    if (onSaveMeetingNotes) {
      onSaveMeetingNotes(mData.id, {
        notes,
        keyDecisions: updated,
        actionItems,
      });
    }
  };

  const handleAddActionItem = (e) => {
    e.preventDefault();
    if (!newActionItem.trim()) return;
    const updated = [...actionItems, { text: newActionItem.trim(), done: false }];
    setActionItems(updated);
    setNewActionItem('');
    if (onSaveMeetingNotes) {
      onSaveMeetingNotes(mData.id, {
        notes,
        keyDecisions,
        actionItems: updated,
      });
    }
  };

  const handleToggleActionItem = (idx) => {
    const updated = actionItems.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    setActionItems(updated);
    if (onSaveMeetingNotes) {
      onSaveMeetingNotes(mData.id, {
        notes,
        keyDecisions,
        actionItems: updated,
      });
    }
  };

  const handleDeleteActionItem = (idx) => {
    const updated = actionItems.filter((_, i) => i !== idx);
    setActionItems(updated);
    if (onSaveMeetingNotes) {
      onSaveMeetingNotes(mData.id, {
        notes,
        keyDecisions,
        actionItems: updated,
      });
    }
  };

  // Launch AI Bot action
  const handleLaunchBotClick = async () => {
    if (isStartingBot) return;
    setIsStartingBot(true);
    setBotActionError(null);
    try {
      if (onStartBot) {
        await onStartBot(mData);
      } else {
        const isEvent = Boolean(mData.isEvent);
        if (isEvent) {
          await launchBotForEvent(mData.id);
        } else {
          await joinMeeting(mData.id, mData.meetingLink);
        }
      }
      setCurrentMeeting((prev) => ({ ...prev, rawStatus: 'bot_active' }));
      // Fetch fresh status
      if (!mData.isEvent) {
        await fetchLatestMeetingDetails(mData.id, false);
      }
    } catch (err) {
      const msg = err?.message || 'Failed to start AI meeting bot.';
      setBotActionError(msg);
    } finally {
      setIsStartingBot(false);
    }
  };

  // End & process action
  const handleEndMeetingClick = async () => {
    if (isEndingMeeting) return;
    setIsEndingMeeting(true);
    setBotActionError(null);
    try {
      if (onEndMeeting) {
        await onEndMeeting(mData);
      }
      setCurrentMeeting((prev) => ({ ...prev, rawStatus: 'ended' }));
      if (!mData.isEvent) {
        await fetchLatestMeetingDetails(mData.id, false);
      }
    } catch (err) {
      const msg = err?.message || 'Failed to end meeting session.';
      setBotActionError(msg);
    } finally {
      setIsEndingMeeting(false);
    }
  };

  // Optional manual retry if processing failed
  const handleRetryProcessing = async () => {
    if (isRetryingAI || mData.isEvent) return;
    setIsRetryingAI(true);
    setBotActionError(null);
    try {
      await processMeetingAI(mData.id);
      await fetchLatestMeetingDetails(mData.id, false);
    } catch (err) {
      setBotActionError(`Reprocessing error: ${err.message || 'Pipeline failed'}`);
    } finally {
      setIsRetryingAI(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="meeting-type-badge">{mData.meetingType || 'Meeting'}</span>
              <span className="meeting-project-badge">
                <Folder size={12} style={{ color: 'var(--text-subtle)' }} />
                <span>{mData.clientProject || 'General'}</span>
              </span>

              {/* Bot Capture Status Pill */}
              {isBotActive ? (
                <span className="status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontWeight: 600 }}>
                  ● Bot Active Recording
                </span>
              ) : mData.rawStatus === 'failed' ? (
                <span className="status-pill" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                  Bot Failed
                </span>
              ) : mData.rawStatus === 'ended' ? (
                <span className="status-pill status-completed">
                  Bot Ended
                </span>
              ) : null}

              {/* AI Processing Status Pill */}
              {aiStatus === 'processing' ? (
                <span className="status-pill" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', border: '1px solid #3b82f6', fontWeight: 600 }}>
                  ● AI: Processing...
                </span>
              ) : aiStatus === 'completed' ? (
                <span className="status-pill status-completed">
                  AI: Completed
                </span>
              ) : aiStatus === 'failed' ? (
                <span className="status-pill" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                  AI: Failed
                </span>
              ) : (
                <span className="status-pill status-pending">
                  AI: Pending
                </span>
              )}

              {mData.needsFollowUp && (
                <span className="meeting-followup-badge">
                  <AlertTriangle size={11} />
                  <span>Needs Follow-up</span>
                </span>
              )}
            </div>

            <h3 className="modal-title">{mData.title}</h3>
            <p className="modal-subtitle">
              {mData.timeLabel || `${mData.date} · ${mData.time}`} • {mData.location || 'Online'}
            </p>
          </div>

          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="meeting-detail-tabs">
          <button
            type="button"
            className={`meeting-detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Calendar size={14} />
            <span>Context & Prep</span>
          </button>

          <button
            type="button"
            className={`meeting-detail-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={14} />
            <span>AI Intelligence & Summary</span>
            {aiSummary && (
              <span className="filter-count-badge" style={{ marginLeft: 4, backgroundColor: 'var(--accent-primary)', color: '#fff' }}>
                Ready
              </span>
            )}
          </button>

          <button
            type="button"
            className={`meeting-detail-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <BookmarkCheck size={14} />
            <span>Meeting Notes & Decisions</span>
            {(keyDecisions.length > 0 || actionItems.length > 0) && (
              <span className="filter-count-badge" style={{ marginLeft: 4 }}>
                {keyDecisions.length + actionItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 22px' }}>
          {/* Action error banner */}
          {botActionError && (
            <div className="postpone-notice-box" style={{ backgroundColor: 'var(--badge-rose-bg)', borderColor: 'var(--badge-rose-border)', color: 'var(--badge-rose-text)', marginBottom: 14 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5 }}>{botActionError}</div>
            </div>
          )}

          {/* Tab 1: Overview & Context */}
          {activeTab === 'overview' && (
            <div className="meeting-detail-content">
              {/* Meeting Follow-up Banner if needed */}
              {mData.needsFollowUp && (
                <div className="followup-action-banner">
                  <div className="followup-text-group">
                    <AlertTriangle size={16} />
                    <span>This meeting was flagged for manager follow-up.</span>
                  </div>
                  {onCreateFollowUpTask && (
                    <button
                      type="button"
                      className="btn-create-followup-task"
                      onClick={() => onCreateFollowUpTask(mData)}
                    >
                      <Plus size={13} />
                      <span>Create Follow-up Task</span>
                    </button>
                  )}
                </div>
              )}

              {/* Bot Control Card in Overview */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bot size={16} style={{ color: isBotActive ? '#10b981' : 'var(--accent-primary)' }} />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>
                      {isBotActive ? 'AI Bot Recording Active' : 'AI Meeting Bot Scraper'}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                      {isBotActive
                        ? 'Selenium worker is listening to captions and storing the transcript.'
                        : 'Automatically joins the Google Meet room, turns on captions, and saves transcripts.'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {!isBotActive && !isCompleted && (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isStartingBot}
                      onClick={handleLaunchBotClick}
                      style={{ fontSize: '12.5px', padding: '6px 14px' }}
                    >
                      {isStartingBot ? (
                        <>
                          <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                          <span>Joining Bot...</span>
                        </>
                      ) : (
                        <>
                          <Bot size={13} style={{ marginRight: 5 }} />
                          <span>Join Bot</span>
                        </>
                      )}
                    </button>
                  )}

                  {isBotActive && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isEndingMeeting}
                      onClick={handleEndMeetingClick}
                      style={{ fontSize: '12.5px', padding: '6px 12px', color: '#ef4444', borderColor: '#fca5a5' }}
                    >
                      {isEndingMeeting ? (
                        <>
                          <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                          <span>Ending...</span>
                        </>
                      ) : (
                        <>
                          <Square size={13} style={{ marginRight: 5 }} />
                          <span>End & Process</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Agenda Section */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <Clock size={13} />
                  Meeting Agenda & Scope
                </span>
                <div className="detail-card-box" style={{ whiteSpace: 'pre-line' }}>
                  {mData.agenda || 'No agenda items added.'}
                </div>
              </div>

              {/* Attendees & Link */}
              <div className="form-row-2">
                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <Users size={13} />
                    Participants
                  </span>
                  <div className="detail-card-box">
                    {mData.participants && mData.participants.length > 0 ? (
                      <ul style={{ listStyle: 'disc', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {mData.participants.map((p, idx) => (
                          <li key={idx} style={{ fontSize: 12.5 }}>{p}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>No participants listed.</span>
                    )}
                  </div>
                </div>

                <div className="detail-section-block">
                  <span className="detail-block-title">
                    <Video size={13} />
                    Conference Location / Link
                  </span>
                  <div className="detail-card-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{mData.location || 'Google Meet'}</span>
                      {hasConferenceLink && (
                        <button
                          type="button"
                          className="meeting-copy-btn"
                          onClick={handleCopyLink}
                          title="Copy meeting link"
                        >
                          {copied ? (
                            <>
                              <Check size={12} style={{ color: '#10b981' }} />
                              <span style={{ color: '#10b981' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {hasConferenceLink && (
                      <a
                        href={mData.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11.5, color: 'var(--accent-primary)', wordBreak: 'break-all', marginTop: 4, display: 'block' }}
                      >
                        {mData.meetingLink}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: AI Intelligence & Summary */}
          {activeTab === 'ai' && (
            <div className="meeting-detail-content">
              {/* Bot & Pipeline Actions Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bot size={16} style={{ color: isBotActive ? '#10b981' : 'var(--accent-primary)' }} />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>
                      AI Intelligence Lifecycle Controller
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>
                      Status: <strong>{aiStatus.toUpperCase()}</strong>
                      {aiProcessedAt && ` • Processed at ${new Date(aiProcessedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Join Bot */}
                  {!isBotActive && !isCompleted && (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isStartingBot}
                      onClick={handleLaunchBotClick}
                      style={{ fontSize: '12.5px', padding: '6px 14px' }}
                    >
                      {isStartingBot ? (
                        <>
                          <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                          <span>Joining Bot...</span>
                        </>
                      ) : (
                        <>
                          <Bot size={13} style={{ marginRight: 5 }} />
                          <span>Join Bot</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* End & Process */}
                  {isBotActive && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isEndingMeeting}
                      onClick={handleEndMeetingClick}
                      style={{ fontSize: '12.5px', padding: '6px 12px', color: '#ef4444', borderColor: '#fca5a5' }}
                    >
                      {isEndingMeeting ? (
                        <>
                          <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                          <span>Ending...</span>
                        </>
                      ) : (
                        <>
                          <Square size={13} style={{ marginRight: 5 }} />
                          <span>End & Process</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Retry AI (only visible if processing failed or needs manual trigger) */}
                  {aiStatus === 'failed' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isRetryingAI}
                      onClick={handleRetryProcessing}
                      style={{ fontSize: '12.5px', padding: '6px 12px' }}
                    >
                      {isRetryingAI ? (
                        <>
                          <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                          <span>Retrying...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={13} style={{ marginRight: 5 }} />
                          <span>Retry AI Processing</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              {aiStatus === 'processing' && (
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#1d4ed8' }}>
                  <Loader2 size={18} className="spin-icon" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 13 }}>
                    <strong>AI Analysis in Progress:</strong> The backend is analyzing the transcript, generating the summary, and extracting key decisions and action items. This view will update automatically.
                  </div>
                </div>
              )}

              {aiStatus === 'failed' && (
                <div style={{ backgroundColor: 'var(--badge-rose-bg)', border: '1px solid var(--badge-rose-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--badge-rose-text)' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 13 }}>
                    <strong>AI Processing Failed:</strong> {aiError || 'Intelligence extraction encountered an error.'} You can click "Retry AI Processing" above.
                  </div>
                </div>
              )}

              {/* AI Executive Summary Block */}
              <div className="detail-section-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="detail-block-title">
                    <Sparkles size={13} style={{ color: 'var(--accent-primary)' }} />
                    AI Executive Summary
                  </span>
                  {aiSummary && (
                    <button
                      type="button"
                      className="btn-inline-add"
                      onClick={handleCopySummary}
                    >
                      {copiedSummary ? <Check size={11} style={{ marginRight: 3, color: '#10b981' }} /> : <Copy size={11} style={{ marginRight: 3 }} />}
                      <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                    </button>
                  )}
                </div>

                {aiSummary ? (
                  <div className="detail-card-box" style={{ whiteSpace: 'pre-line', lineHeight: 1.6, backgroundColor: 'var(--accent-primary-light)', borderColor: 'var(--accent-primary-border)', color: 'var(--text-main)', fontSize: '13px' }}>
                    {aiSummary}
                  </div>
                ) : (
                  <div className="detail-card-box" style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
                    <Sparkles size={22} style={{ margin: '0 auto 8px', color: 'var(--accent-primary)', opacity: 0.8 }} />
                    {aiStatus === 'completed' ? (
                      <>
                        <p style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: 4, fontSize: '13px' }}>
                          No Speech or Captions Detected
                        </p>
                        <p style={{ fontSize: '12px' }}>
                          The bot recorded the call, but no spoken captions were detected. The transcript is empty.
                        </p>
                      </>
                    ) : aiStatus === 'pending' ? (
                      <>
                        <p style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: 4, fontSize: '13px' }}>
                          AI Summary Scheduled
                        </p>
                        <p style={{ fontSize: '12px' }}>
                          {aiTranscript 
                            ? 'Transcript has been captured. AI intelligence processing will run automatically when the scheduled meeting end time arrives.'
                            : 'Launch the AI Meeting Bot during your call. When the meeting concludes, your executive summary and action items will appear here automatically.'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: 4, fontSize: '13px' }}>
                          Summary Unavailable
                        </p>
                        <p style={{ fontSize: '12px' }}>
                          AI intelligence extraction has not completed yet.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Extracted Key Decisions */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <CheckCircle2 size={13} style={{ color: 'var(--accent-primary)' }} />
                  Extracted Key Decisions ({aiDecisions.length})
                </span>
                {aiDecisions.length > 0 ? (
                  <div className="item-list-container">
                    {aiDecisions.map((dec, idx) => (
                      <div key={dec.id || idx} className="decision-item-row" style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-primary)', flexShrink: 0 }} />
                          <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>{dec.decision}</span>
                        </div>
                        {dec.created_at && (
                          <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
                            {new Date(dec.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="detail-card-box" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {aiStatus === 'completed'
                      ? 'No formal decisions were extracted from this meeting transcript.'
                      : 'Key decisions agreed upon during the sync will be extracted automatically.'}
                  </div>
                )}
              </div>

              {/* Extracted Commitments & Action Items */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <ListTodo size={13} style={{ color: 'var(--accent-primary)' }} />
                  Extracted Commitments & Tasks ({aiCommitments.length})
                </span>
                {aiCommitments.length > 0 ? (
                  <div className="item-list-container">
                    {aiCommitments.map((com, idx) => (
                      <div key={com.id || idx} className="action-item-row" style={{ padding: '8px 12px', alignItems: 'center' }}>
                        <CheckSquare size={14} style={{ color: com.status === 'completed' ? '#10b981' : 'var(--text-subtle)', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-main)' }}>
                            {com.task}
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '11px', color: 'var(--text-subtle)' }}>
                            <span><strong>Assignee:</strong> {com.person || 'Unassigned'}</span>
                            {com.deadline && (
                              <span><strong>Deadline:</strong> {new Date(com.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            )}
                          </div>
                        </div>
                        <span className={`status-pill status-${com.status || 'pending'}`}>
                          {com.status || 'pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="detail-card-box" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {aiStatus === 'completed'
                      ? 'No action items or individual commitments were detected in this transcript.'
                      : 'Action items assigned to team members will be extracted automatically.'}
                  </div>
                )}
              </div>

              {/* Meeting Transcript Viewer */}
              <div className="detail-section-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="detail-block-title">
                    <FileText size={13} />
                    Meeting Transcript
                  </span>
                  {aiTranscript && (
                    <button
                      type="button"
                      className="btn-inline-add"
                      onClick={() => {
                        navigator.clipboard?.writeText(aiTranscript);
                        setCopiedTranscript(true);
                        setTimeout(() => setCopiedTranscript(false), 2000);
                      }}
                    >
                      {copiedTranscript ? <Check size={11} style={{ marginRight: 3, color: '#10b981' }} /> : <Copy size={11} style={{ marginRight: 3 }} />}
                      <span>{copiedTranscript ? 'Copied' : 'Copy Transcript'}</span>
                    </button>
                  )}
                </div>
                {aiTranscript ? (
                  <div className="detail-card-box" style={{ maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11.5px', lineHeight: 1.5, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-light)' }}>
                    {aiTranscript}
                  </div>
                ) : (
                  <div className="detail-card-box" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    No transcript recorded yet. Launch the AI Meeting Bot during live calls to capture captions automatically.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Notes & Decisions (for manual manager notes) */}
          {activeTab === 'notes' && (
            <div className="meeting-detail-content">
              {/* Meeting Notes */}
              <div className="detail-section-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="detail-block-title">
                    <FileText size={13} />
                    Meeting Notes
                  </span>
                  {hasUnsavedNotes && (
                    <button
                      type="button"
                      className="btn-inline-add"
                      onClick={handleSaveNotes}
                    >
                      Save Notes
                    </button>
                  )}
                </div>
                <textarea
                  className="notes-textarea"
                  placeholder="Capture summary notes, key points discussed, or transcript highlights..."
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                />
              </div>

              {/* Key Decisions */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <CheckCircle2 size={13} />
                  Key Decisions Agreed ({keyDecisions.length})
                </span>
                <div className="item-list-container">
                  {keyDecisions.map((dec, idx) => (
                    <div key={idx} className="decision-item-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span>{dec}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDecision(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 2 }}
                        title="Remove decision"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <form onSubmit={handleAddDecision} className="add-inline-input-group">
                    <input
                      type="text"
                      className="add-inline-input"
                      placeholder="Add an agreed decision..."
                      value={newDecision}
                      onChange={(e) => setNewDecision(e.target.value)}
                    />
                    <button type="submit" className="btn-inline-add">
                      <Plus size={12} style={{ marginRight: 4 }} />
                      Add
                    </button>
                  </form>
                </div>
              </div>

              {/* Action Items */}
              <div className="detail-section-block">
                <span className="detail-block-title">
                  <ListTodo size={13} />
                  Action Items & Follow-ups ({actionItems.length})
                </span>
                <div className="item-list-container">
                  {actionItems.map((item, idx) => (
                    <div key={idx} className={`action-item-row ${item.done ? 'done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleActionItem(idx)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1 }}>{item.text}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteActionItem(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 2 }}
                        title="Remove action item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <form onSubmit={handleAddActionItem} className="add-inline-input-group">
                    <input
                      type="text"
                      className="add-inline-input"
                      placeholder="Add an action item (e.g. Elena to send schema draft)..."
                      value={newActionItem}
                      onChange={(e) => setNewActionItem(e.target.value)}
                    />
                    <button type="submit" className="btn-inline-add">
                      <Plus size={12} style={{ marginRight: 4 }} />
                      Add
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
          <div>
            {onToggleFollowUp && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onToggleFollowUp(mData)}
                style={mData.needsFollowUp ? { color: 'var(--badge-amber-text)', borderColor: 'var(--badge-amber-border)' } : {}}
              >
                <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {mData.needsFollowUp ? 'Remove Follow-up' : 'Mark as Follow-up'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Join Bot in Footer */}
            {!isBotActive && !isCompleted && (
              <button
                type="button"
                className="btn-primary"
                disabled={isStartingBot}
                onClick={handleLaunchBotClick}
              >
                {isStartingBot ? (
                  <>
                    <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                    <span>Joining Bot...</span>
                  </>
                ) : (
                  <>
                    <Bot size={13} style={{ marginRight: 5 }} />
                    <span>Join Bot</span>
                  </>
                )}
              </button>
            )}

            {/* End & Process in Footer if bot is running */}
            {isBotActive && (
              <button
                type="button"
                className="btn-secondary"
                disabled={isEndingMeeting}
                onClick={handleEndMeetingClick}
                style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              >
                {isEndingMeeting ? (
                  <>
                    <Loader2 size={13} className="spin-icon" style={{ marginRight: 5 }} />
                    <span>Ending...</span>
                  </>
                ) : (
                  <>
                    <Square size={13} style={{ marginRight: 5 }} />
                    <span>End & Process</span>
                  </>
                )}
              </button>
            )}

            {/* Manual Join Meeting button */}
            {hasConferenceLink && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (onJoinMeeting) {
                    onJoinMeeting(mData);
                  } else {
                    window.open(mData.meetingLink, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <Video size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Join Call
              </button>
            )}

            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
