import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { VC_REVISION_PROMPT, REVISED_PITCH_PROMPT, formatTranscript } from '@/lib/pitch/prompts';
import type { Round } from '@/lib/pitch/types';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createSupabaseAdminClient();

  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Get current session
    const { data: session, error: sessionError } = await db
      .from('pitch_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'synthesis') {
      return Response.json({ error: 'Session is not in synthesis state' }, { status: 400 });
    }

    const rounds: Round[] = session.rounds || [];
    if (rounds.length < 1) {
      return Response.json({ error: 'No rounds to synthesize' }, { status: 400 });
    }

    // Format transcript for synthesis
    const transcriptText = formatTranscript(rounds);
    const prompt = `${REVISED_PITCH_PROMPT}\n\n--- PITCH MEETING TRANSCRIPT ---\n${transcriptText}`;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropic = new Anthropic({ apiKey });
          let fullResponse = '';

          const streamResponse = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            system: VC_REVISION_PROMPT,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 3000,
          });

          for await (const event of streamResponse) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta as { type: string; text?: string };
              if (delta.type === 'text_delta' && delta.text) {
                fullResponse += delta.text;
                const chunk = JSON.stringify({ chunk: delta.text });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
            }
          }

          // Save revised pitch to database and update status
          await db
            .from('pitch_sessions')
            .update({
              revised_pitch: fullResponse,
              status: 'approval',
            })
            .eq('id', sessionId);

          // Send completion event
          const done = JSON.stringify({ done: true });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
          controller.close();
        } catch (err) {
          console.error('Synthesis streaming error:', err);
          const error = JSON.stringify({ error: 'Synthesis failed' });
          controller.enqueue(encoder.encode(`data: ${error}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Error in synthesize endpoint:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
