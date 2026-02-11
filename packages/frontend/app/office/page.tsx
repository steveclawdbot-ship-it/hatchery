'use client';

import { useState, useMemo } from 'react';
import OfficeCanvasWithAgents from '@/components/office/office-canvas-with-agents';
import ThoughtTracePanel from '@/components/office/thought-trace-panel';
import CommunicationsLayer from '@/components/office/communications-layer';
import EventStreamPanel from '@/components/office/event-stream-panel';
import { useAgents, useThoughts, useEvents } from '@/hooks/use-agents';

export default function OfficePage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents();
  const { thoughts, isLoading: thoughtsLoading } = useThoughts(selectedAgentId, 20);
  const { events } = useEvents(100);

  // Transform events to messages for communications layer
  const messages = useMemo(() => {
    return events
      .filter((e) => e.kind?.includes('message') || e.kind?.includes('dm'))
      .map((e) => ({
        id: e.id,
        fromAgentId: e.agentId,
        toAgentId: e.data?.toAgentId || e.agentId,
        content: e.data?.content || e.data?.message || '',
        type: e.kind.includes('dm') ? 'dm' : e.kind.includes('system') ? 'system' : 'chat',
        timestamp: e.timestamp,
      }));
  }, [events]);

  // Build agent positions map for communications
  const agentPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; color: string }> = {};
    agents.forEach((agent) => {
      positions[agent.id] = {
        x: agent.x,
        y: agent.y - 20,
        color: agent.color || '#9e9e9e',
      };
    });
    return positions;
  }, [agents]);

  // Transform agents for thought panel
  const agentList = useMemo(() => {
    return agents.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      color: a.color || '#9e9e9e',
    }));
  }, [agents]);

  // Get all thoughts for the panel
  const allThoughts = useThoughts(null, 20).thoughts;

  if (agentsLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 14,
            color: '#7c5cff',
          }}
        >
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#0a0a1a',
        overflow: 'hidden',
      }}
    >
      {/* Main content area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: 20,
          padding: 20,
          overflow: 'hidden',
        }}
      >
        {/* Office Canvas */}
        <div style={{ position: 'relative', flex: 1 }}>
          <h1
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 16,
              color: '#7c5cff',
              marginBottom: 16,
            }}
          >
            🏢 Hatchery Office
          </h1>
          <div style={{ position: 'relative' }}>
            <OfficeCanvasWithAgents
              agents={agents}
              selectedAgentId={selectedAgentId}
              onAgentClick={setSelectedAgentId}
            />
            <CommunicationsLayer
              messages={messages}
              agentPositions={agentPositions}
            />
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              color: '#666',
              fontFamily: 'monospace',
            }}
          >
            💡 Click an agent to filter • Watch messages flow between agents • Data updates
            every 5s
          </div>
        </div>

        {/* Thought Trace Panel */}
        <ThoughtTracePanel
          thoughts={allThoughts}
          agents={agentList}
          selectedAgentId={selectedAgentId}
          onAgentClick={setSelectedAgentId}
          isLoading={thoughtsLoading}
        />
      </div>

      {/* Event Stream Panel */}
      <EventStreamPanel events={events} agents={agentList} />
    </div>
  );
}
