import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  getPitchProviderOrDefault,
  normalizePitchModel,
  normalizePitchProvider,
} from '@/lib/pitch/llm';

// POST: Create new pitch session
export async function POST(req: Request) {
  const db = createSupabaseAdminClient();
  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const startup_name = typeof body?.startup_name === 'string' ? body.startup_name : null;
    const requestedProvider = body?.provider;
    const requestedModel = body?.model;
    const provider =
      requestedProvider === undefined
        ? getPitchProviderOrDefault(undefined)
        : normalizePitchProvider(requestedProvider);
    const model = normalizePitchModel(requestedModel);

    if (!provider) {
      return Response.json(
        { error: `Unsupported provider: ${String(requestedProvider)}` },
        { status: 400 }
      );
    }

    if (requestedModel !== undefined && !model) {
      return Response.json({ error: 'Invalid model value' }, { status: 400 });
    }

    const { data, error } = await db
      .from('pitch_sessions')
      .insert({
        startup_name,
        provider,
        model,
        status: 'in_progress',
        current_round: 1,
        rounds: [],
      })
      .select()
      .single();

    if (error) {
      const errorMessage = typeof error.message === 'string' ? error.message.toLowerCase() : '';
      if (
        errorMessage.includes('model')
        && (errorMessage.includes('column') || errorMessage.includes('schema cache'))
      ) {
        return Response.json(
          { error: 'Database schema is outdated: missing pitch_sessions.model column' },
          { status: 500 }
        );
      }
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
