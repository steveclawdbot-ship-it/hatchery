import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// GET: Fetch session by ID
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createSupabaseAdminClient();

  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { data, error } = await db
      .from('pitch_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    console.error('Error fetching session:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH: Update session
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createSupabaseAdminClient();

  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();

    // Only allow updating specific fields
    const allowedFields = [
      'startup_name',
      'status',
      'current_round',
      'rounds',
      'revised_pitch',
      'revised_pitch_approved',
      'agent_config',
      'worker_config',
      'strategy',
      'configs',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const { data, error } = await db
      .from('pitch_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update session:', error);
      return Response.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    console.error('Error updating session:', err);
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
