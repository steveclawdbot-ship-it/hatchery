'use client';

import { useState } from 'react';
import OfficeCanvasWithAgents from '@/components/office/office-canvas-with-agents';
import { useAgents, useThoughts } from '@/hooks/use-agents';

export default function OfficePage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents();
  const { 
    thoughts, 
    isLoading: thoughtsLoading 
  } = useThoughts(selectedAgentId, 10);

  if (agentsLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ 
          fontFamily: '"Press Start 2P", monospace', 
          fontSize: 14,
          color: '#7c5cff' 
        }}>
          Loading agents...
        </div>
      </div>
    );
  }

  if (agentsError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#f44336' }}>
        Error loading agents: {agentsError.message}
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: 20, 
      padding: 20,
      backgroundColor: '#0a0a1a',
      minHeight: '100vh',
    }}>
      {/* Main Office Canvas */}
      <div>
        <h1 style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 16,
          color: '#7c5cff',
          marginBottom: 16,
        }}>
          🏢 Hatchery Office
        </h1>
        <OfficeCanvasWithAgents
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentClick={setSelectedAgentId}
        />
        <div style={{ 
          marginTop: 12, 
          fontSize: 10, 
          color: '#666',
          fontFamily: 'monospace',
        }}>
          💡 Click an agent to see their thoughts • Data updates every 5s
        </div>
      </div>

      {/* Thought Trace Panel */}
      <div style={{
        width: 320,
        backgroundColor: '#1a1a3a',
        border: '2px solid #2a2a5a',
        borderRadius: 4,
        padding: 16,
      }}>
        <h2 style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 10,
          color: '#7c5cff',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          💭 Live Thoughts
          <span style={{ 
            fontSize: 8, 
            color: '#4caf50',
            animation: 'pulse 2s infinite',
          }}>
            ● LIVE
          </span>
        </h2>

        {selectedAgentId ? (
          <div>
            <div style={{
              fontSize: 12,
              color: '#ccc',
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: '1px solid #2a2a5a',
            }}>
              🧠 {agents.find(a => a.id === selectedAgentId)?.displayName || selectedAgentId}
            </div>

            {thoughtsLoading ? (
              <div style={{ color: '#666', fontSize: 10 }}>Loading thoughts...</div>
            ) : thoughts.length === 0 ? (
              <div style={{ color: '#666', fontSize: 10 }}>No thoughts yet...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {thoughts.map((thought) => (
                  <ThoughtBubble key={thought.id} thought={thought} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            color: '#666',
            fontSize: 10,
            textAlign: 'center',
            padding: '40px 20px',
          }}>
            Click an agent to see their thoughts
          </div>
        )}
      </div>
    </div>
  );
}

function ThoughtBubble({ thought }: { thought: { id: string; content: string; timestamp: string } }) {
  const time = new Date(thought.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div style={{
      backgroundColor: '#252545',
      borderRadius: 4,
      padding: 12,
      position: 'relative',
    }}>
      <div style={{
        fontSize: 10,
        color: '#ccc',
        lineHeight: 1.5,
        fontFamily: 'system-ui, sans-serif',
      }}>
        {thought.content}
      </div>
      <div style={{
        fontSize: 8,
        color: '#666',
        marginTop: 8,
        textAlign: 'right',
      }}>
        {time}
      </div>
    </div>
  );
}
