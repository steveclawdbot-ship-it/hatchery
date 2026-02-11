import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const after = searchParams.get('after'); // Cursor for pagination

    let query = supabase
      .from('ops_events')
      .select('*')
      .eq('agent_id', agentId)
      .eq('kind', 'agent.thought')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (after) {
      query = query.lt('created_at', after);
    }

    const { data: thoughts, error } = await query;

    if (error) {
      console.error('Error fetching thoughts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch thoughts' },
        { status: 500 }
      );
    }

    // Transform to thought trace format
    const thoughtTraces = (thoughts || []).map((event: any) => ({
      id: event.id,
      agentId: event.agent_id,
      content: event.data?.content || event.data?.message || '',
      timestamp: event.created_at,
      metadata: event.data?.metadata || {},
    }));

    return NextResponse.json({
      thoughts: thoughtTraces,
      hasMore: thoughtTraces.length === limit,
      nextCursor: thoughtTraces.length > 0 
        ? thoughtTraces[thoughtTraces.length - 1].timestamp 
        : null,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST to create a new thought (called by agents)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentId = params.id;
    const body = await request.json();
    const { content, metadata = {} } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('ops_events').insert({
      agent_id: agentId,
      kind: 'agent.thought',
      data: {
        content,
        metadata,
      },
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creating thought:', error);
      return NextResponse.json(
        { error: 'Failed to create thought' },
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
