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
        // Demo data
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

  return (
    <div>
      <h2 style={{ fontSize: 10, marginBottom: 16 }}>Memory Browser</h2>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            fontSize: 8,
            padding: '6px 10px',
            backgroundColor: '#1a1a3a',
            border: '1px solid #2a2a5a',
            borderRadius: 4,
            color: '#e0e0e0',
            fontFamily: 'inherit',
            width: 200,
          }}
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            fontSize: 8,
            padding: '6px 10px',
            backgroundColor: '#1a1a3a',
            border: '1px solid #2a2a5a',
            borderRadius: 4,
            color: '#e0e0e0',
            fontFamily: 'inherit',
          }}
        >
          <option value="all">All types</option>
          <option value="insight">Insight</option>
          <option value="pattern">Pattern</option>
          <option value="strategy">Strategy</option>
          <option value="preference">Preference</option>
          <option value="lesson">Lesson</option>
        </select>

        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          style={{
            fontSize: 8,
            padding: '6px 10px',
            backgroundColor: '#1a1a3a',
            border: '1px solid #2a2a5a',
            borderRadius: 4,
            color: '#e0e0e0',
            fontFamily: 'inherit',
          }}
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Memory cards */}
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 8, color: '#666' }}>
            No memories found.
          </div>
        ) : (
          filtered.map((memory) => (
            <div
              key={memory.id}
              style={{
                padding: '10px 14px',
                border: '1px solid #2a2a5a',
                borderRadius: 4,
                borderLeft: `3px solid ${TYPE_COLORS[memory.type] ?? '#666'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 6,
                    padding: '2px 6px',
                    backgroundColor: (TYPE_COLORS[memory.type] ?? '#666') + '22',
                    color: TYPE_COLORS[memory.type] ?? '#666',
                    borderRadius: 2,
                  }}>
                    {memory.type}
                  </span>
                  <span style={{ fontSize: 7, color: '#7c5cff' }}>{memory.agent_id}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Confidence bar */}
                  <div style={{
                    width: 40, height: 4,
                    backgroundColor: '#1a1a3a',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${memory.confidence * 100}%`,
                      height: '100%',
                      backgroundColor: memory.confidence > 0.7 ? '#4CAF50' : '#FF9800',
                    }} />
                  </div>
                  <span style={{ fontSize: 6, color: '#888' }}>
                    {(memory.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 8, lineHeight: 1.5 }}>{memory.content}</div>
              {memory.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {memory.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 6,
                        padding: '1px 4px',
                        backgroundColor: '#2a2a5a',
                        borderRadius: 2,
                        color: '#999',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
