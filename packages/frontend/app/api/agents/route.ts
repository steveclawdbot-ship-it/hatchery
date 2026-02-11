import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    // Get live agent states from the database
    // This aggregates the most recent events per agent
    const { data: agents, error } = await supabase
      .from('agent_states')
      .select(`
        id,
        name,
        display_name,
        state,
        current_task,
        level,
        class,
        desk_id,
        last_active,
        color,
        updated_at
      `)
      .order('last_active', { ascending: false });

    if (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

    // Transform to VisualAgent format
    const visualAgents = (agents || []).map((agent: any) => ({
      id: agent.id,
      displayName: agent.display_name || agent.name,
      state: agent.state || 'idle',
      x: getDeskX(agent.desk_id),
      y: getDeskY(agent.desk_id),
      deskId: agent.desk_id,
      level: agent.level || 1,
      class: agent.class || 'Novice',
      currentTask: agent.current_task,
      lastActive: agent.last_active,
      color: agent.color,
    }));

    return NextResponse.json({ agents: visualAgents });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Desk position mapping
function getDeskX(deskId: number): number {
  const positions: Record<number, number> = {
    1: 80,
    2: 480,
    3: 80,
    4: 480,
    5: 280,
    6: 480,
  };
  return positions[deskId] || 280;
}

function getDeskY(deskId: number): number {
  const positions: Record<number, number> = {
    1: 140,
    2: 140,
    3: 240,
    4: 240,
    5: 300,
    6: 300,
  };
  return positions[deskId] || 200;
}

// Also support POST for state updates from agents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, state, currentTask } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('agent_states')
      .upsert({
        id: agentId,
        state,
        current_task: currentTask,
        last_active: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error updating agent state:', error);
      return NextResponse.json(
        { error: 'Failed to update agent state' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
