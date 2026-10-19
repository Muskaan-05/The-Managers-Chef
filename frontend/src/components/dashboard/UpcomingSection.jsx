import React from 'react';
import { Calendar, CheckSquare, Clock, Users, ArrowUpRight } from 'lucide-react';

export default function UpcomingSection({ items = [] }) {
  const getItemIcon = (type) => {
    switch (type) {
      case 'meeting':
        return <Calendar size={14} className="timeline-type-icon icon-meeting" />;
      case 'task':
        return <CheckSquare size={14} className="timeline-type-icon icon-task" />;
      case 'commitment':
        return <Clock size={14} className="timeline-type-icon icon-commitment" />;
      default:
        return <Calendar size={14} className="timeline-type-icon" />;
    }
  };

  return (
    <aside className="dashboard-section upcoming-section" aria-label="Upcoming Schedule">
      <div className="section-header">
        <div className="section-title-group">
          <h2 className="section-title">Upcoming</h2>
          <span className="section-count-badge">Today & Next</span>
        </div>
      </div>

      <div className="upcoming-timeline">
        {items.map((item, index) => {
          const isFirst = index === 0;
          return (
            <div 
              key={item.id} 
              className={`timeline-item ${isFirst ? 'timeline-item-current' : ''}`}
            >
              <div className="timeline-time-col">
                <span className="timeline-time">{item.time}</span>
                <span className="timeline-duration">{item.duration}</span>
              </div>

              <div className="timeline-node-col">
                <div className={`timeline-dot dot-${item.status}`}>
                  {getItemIcon(item.type)}
                </div>
                {index < items.length - 1 && <div className="timeline-line" />}
              </div>

              <div className="timeline-content-col">
                <div className="timeline-title-row">
                  <h4 className="timeline-item-title">{item.title}</h4>
                  {item.statusLabel && (
                    <span className={`timeline-tag tag-${item.status}`}>
                      {item.statusLabel}
                    </span>
                  )}
                </div>
                {item.subtitle && (
                  <p className="timeline-item-subtitle">{item.subtitle}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
