import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(
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
    const { approved, editedPitch } = body;

    // Get current session
    const { data: session, error: sessionError } = await db
      .from('pitch_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'approval') {
      return Response.json({ error: 'Session is not in approval state' }, { status: 400 });
    }

    if (!approved) {
      // User rejected, go back to synthesis
      const { error: updateError } = await db
        .from('pitch_sessions')
        .update({
          status: 'synthesis',
          revised_pitch: null,
        })
        .eq('id', sessionId);

      if (updateError) {
        return Response.json({ error: 'Failed to update session' }, { status: 500 });
      }

      return Response.json({ status: 'synthesis' });
    }

    // User approved (possibly with edits)
    const finalPitch = editedPitch || session.revised_pitch;

    const { error: updateError } = await db
      .from('pitch_sessions')
      .update({
        revised_pitch: finalPitch,
        revised_pitch_approved: true,
        status: 'generation',
      })
      .eq('id', sessionId);

    if (updateError) {
      return Response.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return Response.json({ status: 'generation' });
  } catch (err) {
    console.error('Error in approve endpoint:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
