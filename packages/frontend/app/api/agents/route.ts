import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

interface AgentConfig {
  id: string;
  displayName: string;
  role: string;
}

interface AgentConfigsPolicyObject {
  version?: string;
  startup?: string;
  agents?: AgentConfig[];
  conversationFormats?: string[];
  dailySchedule?: unknown[];
}

const DESK_POSITIONS = [
  { x: 120, y: 100 },
  { x: 300, y: 100 },
  { x: 480, y: 100 },
  { x: 120, y: 250 },
  { x: 300, y: 250 },
  { x: 480, y: 250 },
];

export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  // Load agent configs from policies
  const { data: policyRow, error: policyError } = await db
    .from('ops_policies')
    .select('value')
    .eq('key', 'agent_configs')
    .single();

  if (policyError || !policyRow) {
    return NextResponse.json({ error: 'No agent configs found' }, { status: 404 });
  }

  const agentConfigs = parseAgentConfigsPolicy(policyRow.value);
  if (!agentConfigs) {
    return NextResponse.json({ error: 'Invalid agent configs policy shape' }, { status: 500 });
  }

  // Get recent events to derive agent states
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentEvents } = await db
    .from('ops_events')
    .select('agent_id, kind')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false });

  const eventsByAgent = new Map<string, string[]>();
  for (const event of recentEvents ?? []) {
    if (!event.agent_id) continue;
    const kinds = eventsByAgent.get(event.agent_id) ?? [];
    kinds.push(event.kind);
    eventsByAgent.set(event.agent_id, kinds);
  }

  const agents = agentConfigs.map((agent, i) => {
    const kinds = eventsByAgent.get(agent.id) ?? [];
    let state: string = 'idle';
    if (kinds.some((k) => k === 'conversation.turn')) {
      state = 'chatting';
    } else if (kinds.some((k) => k === 'step.running')) {
      state = 'working';
    }

    const pos = DESK_POSITIONS[i % DESK_POSITIONS.length];
    return {
      id: agent.id,
      displayName: agent.displayName,
      state,
      x: pos.x,
      y: pos.y,
    };
  });

  return NextResponse.json(agents);
}

function parseAgentConfigsPolicy(value: unknown): AgentConfig[] | null {
  // Legacy shape support: policy value is a direct array of agents.
  if (Array.isArray(value)) {
    return value as AgentConfig[];
  }

  // Canonical shape support: { version, startup, agents, ... }.
  if (isRecord(value)) {
    const obj = value as AgentConfigsPolicyObject;
    if (Array.isArray(obj.agents)) {
      return obj.agents;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
