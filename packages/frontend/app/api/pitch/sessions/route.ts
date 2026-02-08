import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// POST: Create new pitch session
export async function POST(req: Request) {
  const db = createSupabaseAdminClient();
  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { startup_name, provider = 'anthropic' } = body;

    const { data, error } = await db
      .from('pitch_sessions')
      .insert({
        startup_name,
        provider,
        status: 'in_progress',
        current_round: 1,
        rounds: [],
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return Response.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    console.error('Error creating session:', err);
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// GET: List recent sessions
export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { data, error } = await db
      .from('pitch_sessions')
      .select('id, startup_name, status, current_round, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to list sessions:', error);
      return Response.json({ error: 'Failed to list sessions' }, { status: 500 });
    }

    return Response.json({ sessions: data || [] });
  } catch (err) {
    console.error('Error listing sessions:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
