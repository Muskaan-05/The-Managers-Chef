import React, { useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  task
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Delete Task?</h3>
            <p className="modal-subtitle">This action cannot be undone.</p>
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

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--badge-rose-bg)',
              color: 'var(--badge-rose-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.45 }}>
                Are you sure you want to delete <strong>"{task.title}"</strong>?
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                It will be removed from your active task queue and workspace summary.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onConfirm(task.id)}
          >
            <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Delete Task
          </button>
        </div>
      </div>
    </div>
  );
}
