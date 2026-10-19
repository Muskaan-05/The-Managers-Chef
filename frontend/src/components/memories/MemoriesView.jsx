import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Brain,
  Search,
  X,
  Star,
  MoreHorizontal,
  Calendar,
  Clock,
  Users,
  Folder,
  CheckSquare,
  ArrowRight,
  Link2,
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  ChevronDown,
} from 'lucide-react';
import { mockMemoriesData } from '../../data/memoriesData';
import '../../styles/memories.css';

/* ─── Utility: derive CSS class from category ─────────────────────────────── */
function categoryClass(cat = '') {
  const map = {
    Meeting: 'memory-cat-meeting',
    Decision: 'memory-cat-decision',
    Task: 'memory-cat-task',
    Client: 'memory-cat-client',
    Project: 'memory-cat-project',
    Policy: 'memory-cat-policy',
    Operations: 'memory-cat-operations',
    Commitment: 'memory-cat-commitment',
  };
  return map[cat] || 'memory-cat-project';
}

/* ─── Filter definitions ──────────────────────────────────────────────────── */
const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'Meeting',    label: 'Meetings' },
  { id: 'Decision',   label: 'Decisions' },
  { id: 'Task',       label: 'Tasks' },
  { id: 'Client',     label: 'Clients' },
  { id: 'Project',    label: 'Projects' },
];

const SORT_OPTIONS = [
  { value: 'recent',   label: 'Most Recent' },
  { value: 'oldest',   label: 'Oldest' },
  { value: 'relevant', label: 'Most Relevant' },
];

/* ─── Memory Detail Modal ─────────────────────────────────────────────────── */
function MemoryDetailModal({ memory, onClose, onPin, onEdit, onDelete, onNavigate }) {
  if (!memory) return null;

  const isPinned = memory.pinned;

  return (
    <div className="memory-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="memory-modal-dialog" role="dialog" aria-modal="true" aria-label="Memory Detail">
        {/* Header */}
        <div className="memory-modal-header">
          <div className="memory-modal-header-left">
            <div className="memory-modal-meta-row">
              <span className={`memory-category-badge ${categoryClass(memory.category)}`}>
                {memory.category}
              </span>
              <span className="memory-date-badge">
                <Calendar className="memory-date-icon" size={11} />
                {memory.date}
              </span>
              {memory.source && (
                <span className="memory-source-badge">
                  <BookOpen className="memory-source-icon" size={11} />
                  {memory.source}
                </span>
              )}
            </div>
            <h2 className="memory-modal-title">{memory.title}</h2>
          </div>
          <div className="memory-modal-header-actions">
            <button
              type="button"
              className={`memory-modal-pin-btn ${isPinned ? 'pinned' : ''}`}
              onClick={() => onPin(memory.id)}
              title={isPinned ? 'Unpin memory' : 'Pin memory'}
            >
              <Star size={13} />
              {isPinned ? 'Pinned' : 'Pin'}
            </button>
            <button type="button" className="memory-modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="memory-modal-body">
          {/* Full Summary */}
          <div className="memory-detail-section">
            <div className="memory-detail-section-title">
              <Brain size={12} /> AI Summary
            </div>
            <div className="memory-detail-content-box">{memory.fullSummary || memory.summary}</div>
          </div>

          {/* Key Info Grid */}
          <div className="memory-detail-info-grid">
            {memory.client && (
              <div className="memory-detail-info-item">
                <span className="memory-detail-info-label">Client / Project</span>
                <span className="memory-detail-info-value">{memory.client}</span>
              </div>
            )}
            {memory.project && (
              <div className="memory-detail-info-item">
                <span className="memory-detail-info-label">Project</span>
                <span className="memory-detail-info-value">{memory.project}</span>
              </div>
            )}
            {memory.date && (
              <div className="memory-detail-info-item">
                <span className="memory-detail-info-label">Date</span>
                <span className="memory-detail-info-value">{memory.date}</span>
              </div>
            )}
            {memory.source && (
              <div className="memory-detail-info-item">
                <span className="memory-detail-info-label">Source</span>
                <span className="memory-detail-info-value">{memory.source}</span>
              </div>
            )}
          </div>

          {/* People Involved */}
          {memory.people && memory.people.length > 0 && (
            <div className="memory-detail-section">
              <div className="memory-detail-section-title">
                <Users size={12} /> People Involved
              </div>
              <div className="memory-people-list">
                {memory.people.map((person) => (
                  <span key={person} className="memory-person-chip">
                    <Users size={11} />
                    {person}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Decisions */}
          {memory.keyDecisions && memory.keyDecisions.length > 0 && (
            <div className="memory-detail-section">
              <div className="memory-detail-section-title">
                <Lightbulb size={12} /> Key Decisions
              </div>
              <div className="memory-decisions-list">
                {memory.keyDecisions.map((decision, i) => (
                  <div key={i} className="memory-decision-row">
                    <Check className="memory-decision-icon" size={13} />
                    <span>{decision}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Context */}
          {(memory.relatedMeeting || memory.relatedTask || memory.relatedDecision) && (
            <div className="memory-related-context">
              <div className="memory-related-context-title">
                <Link2 className="memory-related-context-icon" size={13} />
                Related Context
              </div>
              <div className="memory-related-items">
                {memory.relatedMeeting && (
                  <div
                    className="memory-related-item"
                    onClick={() => onNavigate && onNavigate('meetings', memory.relatedMeeting)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onNavigate && onNavigate('meetings', memory.relatedMeeting)}
                    title="View Related Meeting"
                  >
                    <div className="memory-related-item-icon-box related-icon-meeting">
                      <Calendar size={14} />
                    </div>
                    <div className="memory-related-item-body">
                      <span className="memory-related-item-type">Related Meeting</span>
                      <span className="memory-related-item-title">{memory.relatedMeeting}</span>
                    </div>
                    <ArrowRight className="memory-related-item-arrow" size={14} />
                  </div>
                )}
                {memory.relatedTask && (
                  <div
                    className="memory-related-item"
                    onClick={() => onNavigate && onNavigate('tasks', memory.relatedTask)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onNavigate && onNavigate('tasks', memory.relatedTask)}
                    title="View Related Task"
                  >
                    <div className="memory-related-item-icon-box related-icon-task">
                      <CheckSquare size={14} />
                    </div>
                    <div className="memory-related-item-body">
                      <span className="memory-related-item-type">Related Task</span>
                      <span className="memory-related-item-title">{memory.relatedTask}</span>
                    </div>
                    <ArrowRight className="memory-related-item-arrow" size={14} />
                  </div>
                )}
                {memory.relatedDecision && (
                  <div className="memory-related-item" style={{ cursor: 'default' }}>
                    <div className="memory-related-item-icon-box related-icon-decision">
                      <Lightbulb size={14} />
                    </div>
                    <div className="memory-related-item-body">
                      <span className="memory-related-item-type">Related Decision</span>
                      <span className="memory-related-item-title">{memory.relatedDecision}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Relevant Context / Background */}
          {memory.context && (
            <div className="memory-detail-section">
              <div className="memory-detail-section-title">
                <BookOpen size={12} /> Relevant Context
              </div>
              <div className="memory-detail-content-box">{memory.context}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="memory-modal-footer">
          <div className="memory-modal-footer-left">
            <button type="button" className="btn-modal-delete" onClick={() => { onDelete(memory.id); onClose(); }}>
              <Trash2 size={13} />
              Delete
            </button>
          </div>
          <div className="memory-modal-footer-right">
            <button type="button" className="btn-modal-edit" onClick={() => onEdit(memory)}>
              <Pencil size={13} />
              Edit
            </button>
            {memory.relatedMeeting && (
              <button
                type="button"
                className="btn-modal-meeting"
                onClick={() => { onNavigate && onNavigate('meetings'); onClose(); }}
              >
                <Calendar size={13} />
                View Meeting
              </button>
            )}
            {memory.relatedTask && (
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => { onNavigate && onNavigate('tasks'); onClose(); }}
              >
                <CheckSquare size={13} />
                View Task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Memory Modal ───────────────────────────────────────────────────── */
function EditMemoryModal({ memory, onClose, onSave }) {
  const [title, setTitle] = useState(memory?.title || '');
  const [summary, setSummary] = useState(memory?.fullSummary || memory?.summary || '');
  const [category, setCategory] = useState(memory?.category || 'Meeting');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ ...memory, title: title.trim(), summary: summary.trim(), fullSummary: summary.trim(), category });
  };

  return (
    <div className="memory-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="memory-modal-dialog memory-edit-modal-dialog" role="dialog" aria-modal="true">
        <div className="memory-modal-header">
          <div className="memory-modal-header-left">
            <div className="memory-modal-title" style={{ fontSize: '16px' }}>Edit Memory</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Update the title, summary, or category.
            </div>
          </div>
          <button type="button" className="memory-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="memory-modal-body">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Memory title"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Summary</label>
            <textarea
              className="form-textarea"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="AI-generated or manual summary"
              style={{ minHeight: '100px' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Meeting</option>
              <option>Decision</option>
              <option>Task</option>
              <option>Client</option>
              <option>Project</option>
              <option>Policy</option>
              <option>Operations</option>
              <option>Commitment</option>
            </select>
          </div>
        </div>
        <div className="memory-modal-footer">
          <div className="memory-modal-footer-left" />
          <div className="memory-modal-footer-right">
            <button type="button" className="btn-modal-edit" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-modal-primary" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ────────────────────────────────────────────────── */
function DeleteConfirmModal({ memory, onClose, onConfirm }) {
  return (
    <div className="memory-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="memory-modal-dialog memory-delete-modal-dialog" role="dialog" aria-modal="true">
        <div className="memory-modal-header">
          <div className="memory-modal-header-left">
            <div className="memory-modal-title" style={{ fontSize: '16px' }}>Delete Memory</div>
          </div>
          <button type="button" className="memory-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="memory-modal-body">
          <div className="memory-delete-warning-box">
            <AlertTriangle className="memory-delete-warning-icon" size={16} />
            <span>
              This will permanently delete <strong>"{memory?.title}"</strong>. This action cannot be undone.
            </span>
          </div>
        </div>
        <div className="memory-modal-footer">
          <div className="memory-modal-footer-left" />
          <div className="memory-modal-footer-right">
            <button type="button" className="btn-modal-edit" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn-modal-delete"
              style={{ backgroundColor: '#dc2626', color: '#fff', borderColor: 'transparent' }}
              onClick={() => { onConfirm(memory.id); onClose(); }}
            >
              <Trash2 size={13} />
              Delete Memory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Memory Card ─────────────────────────────────────────────────────────── */
function MemoryCard({ memory, onOpen, onPin, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div
      className={`memory-item-card ${memory.pinned ? 'is-pinned' : ''}`}
      onClick={() => onOpen(memory)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(memory)}
    >
      {/* Card Header */}
      <div className="memory-item-header">
        <div className="memory-item-header-main">
          <div className="memory-item-meta-row">
            <span className={`memory-category-badge ${categoryClass(memory.category)}`}>
              {memory.category}
            </span>
            <span className="memory-date-badge">
              <Calendar className="memory-date-icon" size={11} />
              {memory.date}
            </span>
            {memory.source && (
              <span className="memory-source-badge">
                <BookOpen className="memory-source-icon" size={11} />
                {memory.source}
              </span>
            )}
          </div>
          <div className="memory-item-title">{memory.title}</div>
        </div>

        {/* Header Actions */}
        <div
          className="memory-item-header-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`memory-pin-btn ${memory.pinned ? 'pinned' : ''}`}
            onClick={(e) => { e.stopPropagation(); onPin(memory.id); }}
            title={memory.pinned ? 'Unpin' : 'Pin memory'}
          >
            <Star size={13} />
          </button>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              type="button"
              className={`memory-action-menu-trigger ${menuOpen ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
              title="More actions"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div className="memory-dropdown-menu">
                <button
                  className="memory-dropdown-item"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen(memory); }}
                >
                  <BookOpen size={13} /> View Memory
                </button>
                <button
                  className="memory-dropdown-item"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPin(memory.id); }}
                >
                  <Star size={13} /> {memory.pinned ? 'Unpin Memory' : 'Pin Memory'}
                </button>
                <button
                  className="memory-dropdown-item"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(memory); }}
                >
                  <Pencil size={13} /> Edit Memory
                </button>
                <div className="memory-dropdown-divider" />
                <button
                  className="memory-dropdown-item item-danger"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(memory); }}
                >
                  <Trash2 size={13} /> Delete Memory
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="memory-item-body">
        <div className="memory-item-summary">{memory.summary}</div>

        {/* Context pills */}
        {(memory.client || memory.project || memory.relatedMeeting || memory.relatedTask) && (
          <div className="memory-context-pills">
            <span className="memory-context-label">Context:</span>
            {memory.client && (
              <span className="memory-context-pill">
                <Users className="memory-context-pill-icon" size={11} />
                {memory.client}
              </span>
            )}
            {memory.project && (
              <span className="memory-context-pill">
                <Folder className="memory-context-pill-icon" size={11} />
                {memory.project}
              </span>
            )}
            {memory.relatedMeeting && (
              <span className="memory-context-pill">
                <Calendar className="memory-context-pill-icon" size={11} />
                {memory.relatedMeeting}
              </span>
            )}
            {memory.relatedTask && (
              <span className="memory-context-pill">
                <CheckSquare className="memory-context-pill-icon" size={11} />
                {memory.relatedTask}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div
        className="memory-item-footer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="memory-footer-left">
          {memory.people && memory.people[0] && (
            <span className="memory-related-person">
              <Users className="memory-person-icon" size={12} />
              {memory.people[0]}{memory.people.length > 1 ? ` +${memory.people.length - 1}` : ''}
            </span>
          )}
        </div>
        <div className="memory-item-actions">
          <button
            type="button"
            className="btn-view-memory"
            onClick={(e) => { e.stopPropagation(); onOpen(memory); }}
          >
            <BookOpen size={12} />
            View Memory
          </button>
          {memory.relatedTask && (
            <button
              type="button"
              className="btn-related-task"
              onClick={(e) => { e.stopPropagation(); onOpen(memory); }}
            >
              <CheckSquare size={12} />
              Related Tasks
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main MemoriesView ───────────────────────────────────────────────────── */
export default function MemoriesView({ onNavigate }) {
  const [memories, setMemories] = useState(() => {
    try {
      const saved = localStorage.getItem('tmc_manager_memories');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return mockMemoriesData;
  });

  const [searchQuery, setSearchQuery]     = useState('');
  const [activeFilter, setActiveFilter]   = useState('all');
  const [sortOrder, setSortOrder]         = useState('recent');
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [editingMemory, setEditingMemory]   = useState(null);
  const [deletingMemory, setDeletingMemory] = useState(null);
  const [toastMessage, setToastMessage]     = useState(null);

  const searchRef = useRef(null);

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem('tmc_manager_memories', JSON.stringify(memories)); } catch (e) { /* ignore */ }
  }, [memories]);

  // Keyboard shortcut: Ctrl/Cmd+K focuses search
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((c) => (c === msg ? null : c)), 3000);
  };

  /* Counts per filter */
  const counts = useMemo(() => {
    const base = { all: memories.length };
    FILTERS.slice(1).forEach((f) => {
      base[f.id] = memories.filter((m) => m.category === f.id).length;
    });
    return base;
  }, [memories]);

  /* Filter + Search + Sort */
  const filteredMemories = useMemo(() => {
    let list = memories;

    // Category filter
    if (activeFilter !== 'all') {
      list = list.filter((m) => m.category === activeFilter);
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        (m.fullSummary || '').toLowerCase().includes(q) ||
        (m.client || '').toLowerCase().includes(q) ||
        (m.project || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q) ||
        (m.source || '').toLowerCase().includes(q) ||
        (m.people || []).some((p) => p.toLowerCase().includes(q)) ||
        (m.relatedMeeting || '').toLowerCase().includes(q) ||
        (m.relatedTask || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortOrder === 'recent') {
      list = [...list].sort((a, b) => b.sortTimestamp - a.sortTimestamp);
    } else if (sortOrder === 'oldest') {
      list = [...list].sort((a, b) => a.sortTimestamp - b.sortTimestamp);
    } else if (sortOrder === 'relevant') {
      // Pinned first, then by timestamp
      list = [...list].sort((a, b) => {
        if (b.pinned !== a.pinned) return b.pinned ? 1 : -1;
        return b.sortTimestamp - a.sortTimestamp;
      });
    }

    return list;
  }, [memories, activeFilter, searchQuery, sortOrder]);

  /* Handlers */
  const handlePin = (id) => {
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m));
    const mem = memories.find((m) => m.id === id);
    showToast(mem?.pinned ? `"${mem?.title}" unpinned.` : `"${mem?.title}" pinned.`);
    // Update selected memory if open
    if (selectedMemory?.id === id) {
      setSelectedMemory((prev) => prev ? { ...prev, pinned: !prev.pinned } : null);
    }
  };

  const handleEdit = (memory) => {
    setEditingMemory(memory);
    if (selectedMemory?.id === memory.id) setSelectedMemory(null);
  };

  const handleSaveEdit = (updatedMemory) => {
    setMemories((prev) => prev.map((m) => m.id === updatedMemory.id ? updatedMemory : m));
    setEditingMemory(null);
    showToast('Memory updated successfully.');
  };

  const handleDeleteRequest = (memory) => {
    setDeletingMemory(memory);
    if (selectedMemory?.id === memory.id) setSelectedMemory(null);
  };

  const handleDeleteConfirm = (id) => {
    const mem = memories.find((m) => m.id === id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setDeletingMemory(null);
    showToast(`"${mem?.title}" deleted from workspace.`);
  };

  const handleNavigate = (view) => {
    if (onNavigate) onNavigate(view);
    setSelectedMemory(null);
    showToast(`Navigating to ${view === 'meetings' ? 'Meetings' : 'Tasks'}…`);
  };

  const pinnedCount   = memories.filter((m) => m.pinned).length;
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="memories-page-container">

      {/* ── Search Hero ─────────────────────────────────────────── */}
      <div className="memories-search-hero">
        <div className="memories-search-hero-top">
          <div className="memories-hero-title-group">
            <div className="memories-hero-title">Memories</div>
            <div className="memories-hero-subtitle">Find the context you need, when you need it.</div>
          </div>
          <div className="memories-stats-row">
            <span className="memories-stat-item">
              <Brain className="memories-stat-icon" size={13} />
              <span className="memories-stat-value">{memories.length}</span> stored
            </span>
            <span className="memories-stat-item">
              <Star className="memories-stat-icon" size={13} />
              <span className="memories-stat-value">{pinnedCount}</span> pinned
            </span>
          </div>
        </div>

        {/* Main search input */}
        <div className="memories-main-search-wrapper">
          <Search className="memories-main-search-icon" size={16} />
          <input
            ref={searchRef}
            type="text"
            className="memories-main-search-input"
            placeholder="Search your memories… (title, client, project, keyword)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search memories"
          />
          {searchQuery ? (
            <button
              type="button"
              className="memories-main-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : (
            <div className="memories-search-shortcut" title="Keyboard shortcut">
              <span className="shortcut-key">⌘</span>
              <span className="shortcut-key">K</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter & Sort Toolbar ─────────────────────────────────── */}
      <div className="memories-toolbar">
        <div className="memories-filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`memories-filter-tab-btn ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
              <span className="memories-filter-count">
                {f.id === 'all' ? counts.all : (counts[f.id] ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="memories-toolbar-right">
          <span className="memories-sort-label">Sort:</span>
          <select
            className="memories-sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sort memories"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Memory Cards List ─────────────────────────────────────── */}
      <div>
        <div className="memories-list-header" style={{ marginBottom: '10px' }}>
          <div className="memories-list-label">
            <Brain size={12} />
            {isSearchActive
              ? `Search results`
              : activeFilter === 'all'
              ? 'All Memories'
              : `${activeFilter}s`}
          </div>
          <span className="memories-list-count">{filteredMemories.length}</span>
        </div>

        {filteredMemories.length > 0 ? (
          <div className="memories-list-container">
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onOpen={setSelectedMemory}
                onPin={handlePin}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        ) : (
          <div className="memories-empty-state">
            <Brain className="memories-empty-icon" size={36} />
            <div className="memories-empty-title">No memories found.</div>
            <div className="memories-empty-desc">
              {isSearchActive
                ? `No memories match "${searchQuery}". Try a different keyword, client, or project name.`
                : `No memories in this category yet.`}
            </div>
            {isSearchActive && (
              <button
                type="button"
                className="memories-empty-btn"
                onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {selectedMemory && (
        <MemoryDetailModal
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
          onPin={handlePin}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onNavigate={handleNavigate}
        />
      )}

      {editingMemory && (
        <EditMemoryModal
          memory={editingMemory}
          onClose={() => setEditingMemory(null)}
          onSave={handleSaveEdit}
        />
      )}

      {deletingMemory && (
        <DeleteConfirmModal
          memory={deletingMemory}
          onClose={() => setDeletingMemory(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="memories-toast" role="status">
          <Check size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
