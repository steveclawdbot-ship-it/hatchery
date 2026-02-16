'use client';

import { useState, useEffect } from 'react';

interface Memory {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  confidence: number;
  tags: string[];
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  insight: '#2196F3',
  pattern: '#9C27B0',
  strategy: '#FF9800',
  preference: '#4CAF50',
  lesson: '#E91E63',
};

export default function MemoryBrowser() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await fetch('/api/memories');
        if (res.ok) {
          const data: Memory[] = await res.json();
          setMemories(data);
          setAgents([...new Set(data.map((m) => m.agent_id))]);
        }
      } catch {
        setMemories([
          { id: '1', agent_id: 'brain', type: 'insight', content: 'Users engage 3x more with data-backed content', confidence: 0.82, tags: ['engagement', 'content'], created_at: new Date().toISOString() },
          { id: '2', agent_id: 'buzz', type: 'lesson', content: 'Morning tweets get more impressions than afternoon', confidence: 0.71, tags: ['twitter', 'timing'], created_at: new Date().toISOString() },
          { id: '3', agent_id: 'boss', type: 'strategy', content: 'Focus on B2B over B2C for initial traction', confidence: 0.65, tags: ['strategy', 'market'], created_at: new Date().toISOString() },
        ]);
        setAgents(['brain', 'buzz', 'boss', 'pixel']);
      }
    };
    fetchMemories();
  }, []);

  const filtered = memories.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (filterAgent !== 'all' && m.agent_id !== filterAgent) return false;
    if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectStyle = {
    fontSize: 12,
    fontFamily: 'var(--hatch-font-body)',
    padding: '6px 10px',
    backgroundColor: 'var(--hatch-bg-surface)',
    border: '1px solid var(--hatch-border-default)',
    borderRadius: 6,
    color: 'var(--hatch-text-primary)',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  };

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <h2 style={{
        fontSize: 13,
        fontFamily: 'var(--hatch-font-display)',
        color: 'var(--hatch-text-primary)',
        marginBottom: 16,
      }}>
        MEMORY BROWSER
      </h2>

      {/* Filters */}
      <div className="glass-card" style={{
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        padding: '12px 14px',
      }}>
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            ...selectStyle,
            width: 200,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
            e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
          <option value="all">All types</option>
          <option value="insight">Insight</option>
          <option value="pattern">Pattern</option>
          <option value="strategy">Strategy</option>
          <option value="preference">Preference</option>
          <option value="lesson">Lesson</option>
        </select>
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={selectStyle}>
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Memory cards */}
      <div className="stagger-mount" style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 11,
            fontFamily: 'var(--hatch-font-body)',
            color: 'var(--hatch-text-muted)',
          }}>
            No memories found.
          </div>
        ) : (
          filtered.map((memory) => {
            const typeColor = TYPE_COLORS[memory.type] ?? '#666';
            const isHovered = hoveredId === memory.id;
            return (
              <div
                key={memory.id}
                onMouseEnter={() => setHoveredId(memory.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '12px 14px',
                  background: 'var(--hatch-bg-surface)',
                  border: '1px solid var(--hatch-border-default)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${typeColor}`,
                  transition: 'all 200ms ease',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHovered ? `0 4px 16px rgba(0,0,0,0.3), inset 0 0 0 1px ${typeColor}22` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'var(--hatch-font-display)',
                      padding: '2px 6px',
                      backgroundColor: `${typeColor}1a`,
                      color: typeColor,
                      borderRadius: 3,
                      textShadow: `0 0 6px ${typeColor}44`,
                    }}>
                      {memory.type}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--hatch-font-body)',
                      color: 'var(--hatch-accent-primary)',
                    }}>
                      {memory.agent_id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      width: 44,
                      height: 4,
                      backgroundColor: 'var(--hatch-bg-elevated)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${memory.confidence * 100}%`,
                        height: '100%',
                        backgroundColor: memory.confidence > 0.7 ? 'var(--hatch-success)' : 'var(--hatch-warning)',
                        boxShadow: `0 0 4px ${memory.confidence > 0.7 ? 'rgba(76,175,80,0.5)' : 'rgba(255,152,0,0.5)'}`,
                        borderRadius: 2,
                      }} />
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'var(--hatch-font-body)',
                      color: 'var(--hatch-text-muted)',
                    }}>
                      {(memory.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div style={{
                  fontSize: 12,
                  fontFamily: 'var(--hatch-font-body)',
                  lineHeight: 1.6,
                  color: 'var(--hatch-text-primary)',
                }}>
                  {memory.content}
                </div>
                {memory.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {memory.tags.map((tag) => (
                      <span key={tag} style={{
                        fontSize: 10,
                        fontFamily: 'var(--hatch-font-body)',
                        padding: '2px 6px',
                        backgroundColor: 'var(--hatch-bg-elevated)',
                        borderRadius: 3,
                        color: 'var(--hatch-text-secondary)',
                        transition: 'color 150ms ease',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
