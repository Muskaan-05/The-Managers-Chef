import React from 'react';
import { Bookmark, Calendar, FileText, SearchX } from 'lucide-react';

export default function RelevantMemoriesSection({ 
  memories = [], 
  searchQuery = '', 
  onResetSearch 
}) {
  return (
    <section className="dashboard-section relevant-memories-section">
      <div className="section-header">
        <div className="section-title-group">
          <h2 className="section-title">Relevant Memories</h2>
          <span className="section-count-badge">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
          </span>
        </div>
        {searchQuery && (
          <span className="search-filter-status">
            Filtering by "{searchQuery}"
          </span>
        )}
      </div>

      {memories.length === 0 ? (
        <div className="memories-empty-state">
          <SearchX size={32} className="empty-icon" />
          <p className="empty-title">No memories matching "{searchQuery}"</p>
          <p className="empty-desc">Try searching for keywords like "Client", "Staffing", "Security", or "Escalation".</p>
          {onResetSearch && (
            <button 
              type="button" 
              className="empty-reset-btn" 
              onClick={onResetSearch}
            >
              Clear search filter
            </button>
          )}
        </div>
      ) : (
        <div className="memories-grid">
          {memories.map((mem) => (
            <article key={mem.id} className="memory-card">
              <div className="memory-card-header">
                <span className={`memory-category-tag tag-${mem.tagColor || 'slate'}`}>
                  {mem.category}
                </span>
                <span className="memory-date-source">
                  {mem.dateSource}
                </span>
              </div>

              <h3 className="memory-card-title">{mem.title}</h3>
              <p className="memory-card-summary">{mem.summary}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
