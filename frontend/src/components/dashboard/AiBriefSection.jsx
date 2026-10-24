import React from 'react';
import { 
  Sparkles, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCheck2
} from 'lucide-react';

export default function AiBriefSection({ items = [] }) {
  const getItemIcon = (type) => {
    switch (type) {
      case 'meeting':
        return <Calendar size={15} className="brief-item-type-icon" />;
      case 'followup':
        return <AlertCircle size={15} className="brief-item-type-icon" />;
      case 'decision':
        return <CheckCircle2 size={15} className="brief-item-type-icon" />;
      case 'task':
        return <FileCheck2 size={15} className="brief-item-type-icon" />;
      default:
        return <Clock size={15} className="brief-item-type-icon" />;
    }
  };

  return (
    <section className="ai-brief-card" aria-label="AI Brief">
      <div className="ai-brief-header">
        <div className="ai-brief-title-group">
          <div className="brief-ai-badge">
            <Sparkles size={14} className="brief-spark-icon" />
            <span>AI Briefing</span>
          </div>
          <h2 className="ai-brief-heading">Your AI Brief</h2>
        </div>
        <div className="ai-brief-meta">
          <span className="ai-brief-timestamp">Curated for today</span>
        </div>
      </div>

      <div className="ai-brief-items-grid">
        {items.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
            <CheckCircle2 size={28} style={{ margin: '0 auto 8px', color: '#10b981' }} />
            <p style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: '4px' }}>All caught up for today!</p>
            <p>No critical action items or pending alerts require immediate attention.</p>
          </div>
        ) : (
          items.map((item) => (
            <div 
              key={item.id} 
              className={`ai-brief-item ${item.isHighPriority ? 'item-high-priority' : ''}`}
            >
              <div className="brief-item-header">
                <span className={`brief-category-pill pill-${item.badgeColor}`}>
                  {getItemIcon(item.type)}
                  {item.badgeLabel}
                </span>
                <span className="brief-time-indicator">
                  <Clock size={12} className="brief-clock-icon" />
                  {item.timeLabel}
                </span>
              </div>

              <h3 className="brief-item-title">{item.title}</h3>
              <p className="brief-item-desc">{item.description}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

