import React from 'react';
import { 
  Check, 
  Calendar, 
  AlertCircle, 
  Folder, 
  Video, 
  SearchX, 
  CheckSquare, 
  Plus 
} from 'lucide-react';
import TaskActionsMenu from './TaskActionsMenu';

export default function TaskTable({
  tasks = [],
  onToggleComplete,
  onEdit,
  onPostpone,
  onJoinMeeting,
  onDelete,
  onResetFilters,
  onAddTask,
  isFiltered = false
}) {
  if (tasks.length === 0) {
    return (
      <div className="task-table-card">
        <div className="tasks-empty-state">
          {isFiltered ? (
            <>
              <SearchX size={36} className="tasks-empty-icon" />
              <h3 className="tasks-empty-title">No matching tasks found</h3>
              <p className="tasks-empty-desc">
                No tasks match your current filter or search criteria. Try clearing your filters.
              </p>
              <button
                type="button"
                className="tasks-empty-action-btn"
                onClick={onResetFilters}
              >
                Clear all filters
              </button>
            </>
          ) : (
            <>
              <CheckSquare size={36} className="tasks-empty-icon" />
              <h3 className="tasks-empty-title">All caught up!</h3>
              <p className="tasks-empty-desc">
                You have no pending tasks in your queue. Enjoy your focus time or create a new task.
              </p>
              <button
                type="button"
                className="tasks-empty-action-btn"
                onClick={onAddTask}
              >
                <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Add your first task
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="task-table-card">
      <div className="task-table-wrapper">
        <table className="task-table">
          <thead>
            <tr>
              <th className="th-checkbox" aria-label="Status Checkbox"></th>
              <th className="th-name">Task Name</th>
              <th className="th-priority">Priority</th>
              <th className="th-due">Due Date</th>
              <th className="th-project">Project / Client</th>
              <th className="th-status">Status</th>
              <th className="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isOverdue = task.status === 'overdue';

              return (
                <tr 
                  key={task.id} 
                  className={`task-row ${isCompleted ? 'row-completed' : ''} ${isOverdue ? 'row-overdue' : ''}`}
                >
                  {/* 1. Checkbox / status */}
                  <td className="th-checkbox">
                    <button
                      type="button"
                      className={`task-checkbox-btn ${isCompleted ? 'checked' : ''}`}
                      onClick={() => onToggleComplete(task)}
                      aria-label={isCompleted ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as completed`}
                      title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {isCompleted && <Check size={13} strokeWidth={3} />}
                    </button>
                  </td>

                  {/* 2. Task Name & details */}
                  <td>
                    <div className="task-info-cell">
                      <div className="task-title-line">
                        <span className={`task-title-text ${isCompleted ? 'completed' : ''}`}>
                          {task.title}
                        </span>
                        {task.meeting && !isCompleted && (
                          <span 
                            className="task-meeting-inline-badge"
                            title={`Meeting: ${task.meeting.title}`}
                          >
                            <Video size={11} />
                            <span>Meeting</span>
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="task-desc-text">{task.description}</p>
                      )}
                    </div>
                  </td>

                  {/* 3. Priority */}
                  <td>
                    <span className={`priority-pill priority-${task.priority}`}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                  </td>

                  {/* 4. Due Date */}
                  <td>
                    <div className={`due-date-cell ${isOverdue ? 'overdue' : ''}`}>
                      {isOverdue ? (
                        <AlertCircle size={14} className="due-icon" />
                      ) : (
                        <Calendar size={14} className="due-icon" />
                      )}
                      <span>{task.dueDate}</span>
                    </div>
                  </td>

                  {/* 5. Related Project / Client */}
                  <td>
                    <span className="project-tag">
                      <Folder size={12} className="project-icon" />
                      <span>{task.project || 'General'}</span>
                    </span>
                  </td>

                  {/* 6. Status */}
                  <td>
                    <span className={`status-pill status-${task.status}`}>
                      {task.status}
                    </span>
                  </td>

                  {/* 7. Actions */}
                  <td>
                    <div className="actions-cell-wrapper">
                      {task.meeting && !isCompleted && (
                        <button
                          type="button"
                          className="quick-join-btn"
                          onClick={() => onJoinMeeting(task)}
                          title="Join connected meeting"
                        >
                          <Video size={12} />
                          <span>Join</span>
                        </button>
                      )}
                      <TaskActionsMenu
                        task={task}
                        onEdit={onEdit}
                        onToggleComplete={onToggleComplete}
                        onPostpone={onPostpone}
                        onJoinMeeting={onJoinMeeting}
                        onDelete={onDelete}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
