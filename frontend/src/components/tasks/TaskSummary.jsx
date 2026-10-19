import React from 'react';
import { CheckSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TaskSummary({ 
  tasks = [], 
  activeFilter = 'all', 
  onSelectFilter 
}) {
  const total = tasks.length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const overdue = tasks.filter((t) => t.status === 'overdue').length;

  const items = [
    {
      id: 'all',
      label: 'Total Tasks',
      count: total,
      icon: CheckSquare,
      iconClass: 'summary-icon-slate',
    },
    {
      id: 'pending',
      label: 'Pending',
      count: pending,
      icon: Clock,
      iconClass: 'summary-icon-indigo',
    },
    {
      id: 'completed',
      label: 'Completed',
      count: completed,
      icon: CheckCircle2,
      iconClass: 'summary-icon-emerald',
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: overdue,
      icon: AlertCircle,
      iconClass: 'summary-icon-rose',
    },
  ];

  return (
    <div className="task-summary-grid" role="region" aria-label="Tasks Summary">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeFilter === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`task-summary-card ${isActive ? 'active' : ''}`}
            onClick={() => onSelectFilter && onSelectFilter(item.id)}
            title={`Filter by ${item.label}`}
          >
            <div className={`summary-icon-box ${item.iconClass}`}>
              <Icon size={18} />
            </div>
            <div className="summary-info">
              <span className="summary-count">{item.count}</span>
              <span className="summary-label">{item.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
