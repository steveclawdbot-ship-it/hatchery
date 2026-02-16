import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  VC_SYSTEM_PROMPT,
  PITCH_ROUNDS,
  buildConversationHistory,
  type RoundConfig,
} from '@/lib/pitch/prompts';
import { assessBuildReadiness } from '@/lib/pitch/readiness';
import {
  generatePitchText,
  getMissingProviderKeyError,
  getPitchProviderOrDefault,
  getProviderContext,
  normalizePitchModel,
  streamPitchText,
} from '@/lib/pitch/llm';
import { shouldAdvancePitchRound } from '@/lib/pitch/state-machine';
import type { Round } from '@/lib/pitch/types';

const EMPTY_RESPONSE_RETRY_INSTRUCTION = `Your previous response was empty. Reply now in a natural conversational style.
Requirements:
- 3-6 concise sentences (no rigid template, no section labels)
- include one concrete next step
- ask at most one focused question
- non-empty output`;

const EMERGENCY_FALLBACK_BY_ROUND: Record<
  number,
  { risk: string; move: string; question: string }
> = {
  1: {
    risk: 'the story lacks a concrete user, trigger event, and desired outcome',
    move: 'define one primary user persona, the pain event that triggers use, and a measurable near-term outcome',
    question:
      'Who is the first user persona, what event triggers usage, and what measurable outcome do they need within 7 days?',
  },
  2: {
    risk: 'there is no measurable baseline to prove improvement',
    move: 'capture current alternatives and baseline metrics for time, cost, quality, or error rate',
    question:
      'What are users doing today, and what baseline metric will you improve first?',
  },
  3: {
    risk: 'goals and missions are not yet verifiable',
    move: 'set 2-4 measurable 30-day goals and define the first 3 missions with explicit done criteria',
    question:
      'What are your top 3 30-day goals, and what exact metric/target/deadline defines success for each?',
  },
  4: {
    risk: 'agent ownership and handoffs are ambiguous',
    move: 'assign mission ownership per agent and define handoff plus escalation rules for failures',
    question:
      'Which agent owns each mission, and what is the fallback handoff when that agent cannot complete a step?',
  },
  5: {
    risk: 'missions are not translated into an executable prioritized backlog',
    move: 'define top-priority tasks with dependencies, triggers, and acceptance tests',
    question:
      'What are the top 5 tasks to run first, and what dependency or trigger unlocks each one?',
  },
  6: {
    risk: 'the operating contract for week one is still unclear',
    move: 'commit to a first-week schedule, KPI cadence, and one owner for each critical risk',
    question:
      'What is your week-one execution plan, and which KPI checkpoint will prove you are on track?',
  },
};

function buildEmergencyVcFallback(roundConfig: RoundConfig): string {
  const template = EMERGENCY_FALLBACK_BY_ROUND[roundConfig.round] ?? EMERGENCY_FALLBACK_BY_ROUND[3];
  return [
    `You're currently working through ${roundConfig.focus.toLowerCase()}.`,
    `The biggest missing piece right now is that ${template.risk}.`,
    `Next, ${template.move}.`,
    template.question,
  ].join(' ');
}

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
    const founderMessage = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!founderMessage) {
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

    const provider = getPitchProviderOrDefault(session.provider);
    const providerContext = getProviderContext(provider);
    if (!providerContext) {
      return Response.json({ error: getMissingProviderKeyError(provider) }, { status: 500 });
    }
    const chatMaxTokens = provider === 'google' ? 1024 : 512;
    const model = normalizePitchModel(session.model) ?? undefined;

    const currentRound = session.current_round;
    const rounds: Round[] = session.rounds || [];
    const roundIndex = Math.max(0, Math.min(currentRound - 1, PITCH_ROUNDS.length - 1));
    const roundConfig = PITCH_ROUNDS[roundIndex];

    if (!roundConfig) {
      return Response.json({ error: 'Invalid round' }, { status: 400 });
    }

    // Build conversation context
    const history = buildConversationHistory(rounds, founderMessage);
    const readinessBefore = assessBuildReadiness(rounds);
    const readinessGuidance = readinessBefore.ready
      ? 'Build-readiness is already strong. Keep the conversation natural and ask one final high-leverage clarification only if needed.'
      : `Current build-readiness gaps: ${readinessBefore.missing.join(', ')}. Ask one focused question that closes the highest-impact gap.`;
    const systemPrompt = `${VC_SYSTEM_PROMPT}\n\n${roundConfig.systemAddendum}\n\n${readinessGuidance}`;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send an immediate event so browsers/proxies establish the SSE stream promptly.
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ connected: true })}\n\n`));

          let fullResponse = '';
          let hasVisibleText = false;

          for await (const text of streamPitchText(providerContext, {
            mode: 'chat',
            model,
            system: systemPrompt,
            prompt: history,
            maxTokens: chatMaxTokens,
            temperature: 0.8,
          })) {
            fullResponse += text;
            if (/\S/.test(text)) {
              hasVisibleText = true;
            }
            const chunk = JSON.stringify({ chunk: text });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }

          let finalResponse = fullResponse;
          if (!hasVisibleText) {
            console.warn(`Empty VC response for session ${sessionId}, round ${currentRound}. Retrying once.`);
            try {
              const retryResponse = await generatePitchText(providerContext, {
                mode: 'chat',
                model,
                system: `${systemPrompt}\n\n${EMPTY_RESPONSE_RETRY_INSTRUCTION}`,
                prompt: history,
                maxTokens: chatMaxTokens,
                temperature: 0.55,
              });
              if (/\S/.test(retryResponse)) {
                finalResponse = retryResponse;
              }
            } catch (retryError) {
              console.error('Retry after empty VC response failed:', retryError);
            }

            if (!/\S/.test(finalResponse)) {
              finalResponse = buildEmergencyVcFallback(roundConfig);
            }

            const fallbackChunk = JSON.stringify({ chunk: finalResponse });
            controller.enqueue(encoder.encode(`data: ${fallbackChunk}\n\n`));
          }

          // Save the completed round to database
          const newRound: Round = {
            round: rounds.length + 1,
            focus: roundConfig.focus,
            founderInput: founderMessage,
            vcResponse: finalResponse,
          };

          const updatedRounds = [...rounds, newRound];
          const readinessAfter = assessBuildReadiness(updatedRounds);
          const shouldAdvance = shouldAdvancePitchRound(currentRound, founderMessage);
          const nextRound = shouldAdvance
            ? Math.min(currentRound + 1, PITCH_ROUNDS.length)
            : currentRound;

          const { error: updateError } = await db
            .from('pitch_sessions')
            .update({
              rounds: updatedRounds,
              current_round: nextRound,
              status: 'in_progress',
            })
            .eq('id', sessionId);

          if (updateError) {
            throw new Error(`Failed to persist round: ${updateError.message}`);
          }

          // Send completion event
          const done = JSON.stringify({
            done: true,
            round: newRound,
            nextRound,
            advancedRound: shouldAdvance,
            canSynthesize: readinessAfter.ready,
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
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('Error in respond endpoint:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
