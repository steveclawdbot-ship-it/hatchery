import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { VC_SYSTEM_PROMPT, PITCH_ROUNDS, buildConversationHistory } from '@/lib/pitch/prompts';
import type { Round } from '@/lib/pitch/types';

export async function POST(
  req: Request,
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
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get current session
    const { data: session, error: sessionError } = await db
      .from('pitch_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'in_progress') {
      return Response.json({ error: 'Session is not in progress' }, { status: 400 });
    }

    const currentRound = session.current_round;
    const rounds: Round[] = session.rounds || [];
    const roundConfig = PITCH_ROUNDS[currentRound - 1];

    if (!roundConfig) {
      return Response.json({ error: 'Invalid round' }, { status: 400 });
    }

    // Build conversation context
    const history = buildConversationHistory(rounds, message);
    const systemPrompt = `${VC_SYSTEM_PROMPT}\n\n${roundConfig.systemAddendum}`;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropic = new Anthropic({ apiKey });
          let fullResponse = '';

          const streamResponse = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            system: systemPrompt,
            messages: [{ role: 'user', content: history }],
            max_tokens: 1024,
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

          // Save the completed round to database
          const newRound: Round = {
            round: currentRound,
            focus: roundConfig.focus,
            founderInput: message,
            vcResponse: fullResponse,
          };

          const updatedRounds = [...rounds, newRound];
          const nextRound = currentRound + 1;
          const isComplete = nextRound > PITCH_ROUNDS.length;

          await db
            .from('pitch_sessions')
            .update({
              rounds: updatedRounds,
              current_round: isComplete ? currentRound : nextRound,
            })
            .eq('id', sessionId);

          // Send completion event
          const done = JSON.stringify({
            done: true,
            round: newRound,
            nextRound: isComplete ? null : nextRound,
            canSynthesize: currentRound >= 4,
          });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
          controller.close();
        } catch (err) {
          console.error('Streaming error:', err);
          const error = JSON.stringify({ error: 'Streaming failed' });
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
    console.error('Error in respond endpoint:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
