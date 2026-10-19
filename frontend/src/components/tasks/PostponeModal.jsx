import React, { useState, useEffect } from 'react';
import { X, CalendarClock, AlertCircle, CheckCircle } from 'lucide-react';

export default function PostponeModal({
  isOpen,
  onClose,
  onPostpone,
  task
}) {
  const [selectedDueDate, setSelectedDueDate] = useState('');
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (task) {
      setSelectedDueDate('');
      setCustomInput('');
    }
  }, [task, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const isOverdue = task.status === 'overdue';

  const presets = [
    { label: '+1 Day (Tomorrow)', value: 'Tomorrow, 5:00 PM' },
    { label: '+3 Days', value: 'In 3 days • 5:00 PM' },
    { label: '+1 Week', value: 'Next week • Monday 9:00 AM' },
    { label: '+2 Weeks', value: 'In 2 weeks • EOD' },
  ];

  const handleSelectPreset = (val) => {
    setSelectedDueDate(val);
    setCustomInput('');
  };

  const handleCustomChange = (e) => {
    setCustomInput(e.target.value);
    setSelectedDueDate(e.target.value);
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    const finalDate = customInput.trim() || selectedDueDate || 'Tomorrow, 5:00 PM';
    onPostpone(task.id, finalDate);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Extend Deadline</h3>
            <p className="modal-subtitle">Postpone task to a later date and time.</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirm}>
          <div className="modal-body">
            <div>
              <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                TASK
              </span>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
                {task.title}
              </h4>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Current due date: <strong style={{ color: isOverdue ? 'var(--badge-rose-text)' : 'var(--text-main)' }}>{task.dueDate}</strong>
                {isOverdue && ' (Overdue)'}
              </p>
            </div>

            {isOverdue && (
              <div className="postpone-notice-box">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  This task is currently <strong>Overdue</strong>. Postponing it to a new deadline will automatically restore its status to <strong>Pending</strong>.
                </span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Quick Presets</label>
              <div className="postpone-preset-grid">
                {presets.map((preset) => {
                  const isSelected = selectedDueDate === preset.value && !customInput;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`postpone-preset-btn ${isSelected ? 'active' : ''}`}
                      style={isSelected ? { borderColor: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', color: 'var(--accent-primary)', fontWeight: 600 } : {}}
                      onClick={() => handleSelectPreset(preset.value)}
                    >
                      <span>{preset.label}</span>
                      <CalendarClock size={13} style={{ color: 'var(--text-subtle)' }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="custom-postpone-input">Or specify custom deadline</label>
              <input
                id="custom-postpone-input"
                type="text"
                className="form-input"
                placeholder="e.g. Next Friday, 3:00 PM"
                value={customInput}
                onChange={handleCustomChange}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Update Deadline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
