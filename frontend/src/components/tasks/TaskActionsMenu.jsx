import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreHorizontal, 
  Pencil, 
  Check, 
  RotateCcw, 
  CalendarClock, 
  Video, 
  Trash2 
} from 'lucide-react';

export default function TaskActionsMenu({
  task,
  onEdit,
  onToggleComplete,
  onPostpone,
  onJoinMeeting,
  onDelete
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (callback) => {
    setIsOpen(false);
    callback(task);
  };

  const isCompleted = task.status === 'completed';

  return (
    <div className="task-actions-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`action-menu-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Task actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div className="actions-dropdown-menu" role="menu">
          <button
            type="button"
            className="dropdown-item-btn"
            role="menuitem"
            onClick={() => handleAction(onToggleComplete)}
          >
            {isCompleted ? (
              <>
                <RotateCcw size={14} />
                <span>Mark as Pending</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Mark as Completed</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="dropdown-item-btn"
            role="menuitem"
            onClick={() => handleAction(onEdit)}
          >
            <Pencil size={14} />
            <span>Edit Task</span>
          </button>

          <button
            type="button"
            className="dropdown-item-btn"
            role="menuitem"
            onClick={() => handleAction(onPostpone)}
          >
            <CalendarClock size={14} />
            <span>Postpone Deadline</span>
          </button>

          {task.meeting && (
            <button
              type="button"
              className="dropdown-item-btn"
              role="menuitem"
              onClick={() => handleAction(onJoinMeeting)}
            >
              <Video size={14} />
              <span>Join Meeting</span>
            </button>
          )}

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-item-btn item-danger"
            role="menuitem"
            onClick={() => handleAction(onDelete)}
          >
            <Trash2 size={14} />
            <span>Delete Task</span>
          </button>
        </div>
      )}
    </div>
  );
}
