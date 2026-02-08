import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  AGENT_GENERATION_PROMPT,
  WORKER_GENERATION_PROMPT,
  STRATEGY_GENERATION_PROMPT,
  formatTranscript,
} from '@/lib/pitch/prompts';
import type { Round, AgentConfig, WorkerConfig } from '@/lib/pitch/types';

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

    if (session.status !== 'generation') {
      return Response.json({ error: 'Session is not in generation state' }, { status: 400 });
    }

    if (!session.revised_pitch) {
      return Response.json({ error: 'No revised pitch to generate from' }, { status: 400 });
    }

    const rounds: Round[] = session.rounds || [];
    const revisedPitch = session.revised_pitch;
    const startupName = session.startup_name || 'AI Startup';

    // Create streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const anthropic = new Anthropic({ apiKey });

        function sendEvent(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          // Step 1: Generate Agent Team
          sendEvent({ step: 'agents' });

          const agentResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: `${AGENT_GENERATION_PROMPT}\n\n--- REVISED PITCH ---\n${revisedPitch}\n\nRespond ONLY with valid JSON, no other text.`,
              },
            ],
          });

          const agentText =
            agentResponse.content[0].type === 'text' ? agentResponse.content[0].text : '';
          let agentConfig: AgentConfig;

          try {
            // Extract JSON from response (handle potential markdown code blocks)
            const jsonMatch = agentText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found in agent response');
            agentConfig = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error('Failed to parse agent configuration');
          }

          // Save agent config
          await db
            .from('pitch_sessions')
            .update({ agent_config: agentConfig })
            .eq('id', sessionId);

          sendEvent({ completed: 'agents' });

          // Step 2: Generate Worker Configuration
          sendEvent({ step: 'workers' });

          const agentSummary = agentConfig.agents
            .map((a) => `- ${a.displayName} (${a.id}): ${a.role}`)
            .join('\n');

          const workerResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: `${WORKER_GENERATION_PROMPT}\n\n--- REVISED PITCH ---\n${revisedPitch}\n\n--- AGENT TEAM ---\n${agentSummary}\n\nRespond ONLY with valid JSON, no other text.`,
              },
            ],
          });

          const workerText =
            workerResponse.content[0].type === 'text' ? workerResponse.content[0].text : '';
          let workerConfig: WorkerConfig;

          try {
            const jsonMatch = workerText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found in worker response');
            workerConfig = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error('Failed to parse worker configuration');
          }

          // Save worker config
          await db
            .from('pitch_sessions')
            .update({ worker_config: workerConfig })
            .eq('id', sessionId);

          sendEvent({ completed: 'workers' });

          // Step 3: Generate Strategy
          sendEvent({ step: 'strategy' });

          const transcriptText = formatTranscript(rounds);

          const strategyResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            system:
              'You are a startup strategist. Write actionable strategy documents, not fluffy mission statements.',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: `${STRATEGY_GENERATION_PROMPT}\n\nStartup name: ${startupName}\n\n--- PITCH MEETING TRANSCRIPT ---\n${transcriptText}\n\n--- REVISED PITCH ---\n${revisedPitch}`,
              },
            ],
          });

          const strategy =
            strategyResponse.content[0].type === 'text'
              ? strategyResponse.content[0].text
              : '';

          // Save strategy
          await db
            .from('pitch_sessions')
            .update({ strategy })
            .eq('id', sessionId);

          sendEvent({ completed: 'strategy' });

          // Step 4: Generate Config Files
          sendEvent({ step: 'configs' });

          // Generate agents.json
          const agentsJson = JSON.stringify(
            {
              version: '1.0',
              agents: agentConfig.agents.map((a) => ({
                id: a.id,
                displayName: a.displayName,
                role: a.role,
                tone: a.tone,
                systemDirective: a.systemDirective,
                quirk: a.quirk,
                canInitiate: a.canInitiate,
                cooldownHours: a.cooldownHours,
              })),
              initialAffinities: agentConfig.initialAffinities,
              conversationFormats: agentConfig.conversationFormats,
              dailySchedule: agentConfig.dailySchedule,
            },
            null,
            2
          );

          // Generate policies.json
          const policiesJson = JSON.stringify(
            {
              version: '1.0',
              stepKinds: workerConfig.stepKinds,
              triggers: workerConfig.triggers,
              policies: workerConfig.policies,
              capGates: workerConfig.capGates,
            },
            null,
            2
          );

          // Generate seed.sql
          const seedSql = generateSeedSql(agentConfig, startupName);

          // Generate .env.example
          const envExample = generateEnvExample(workerConfig);

          const configs = {
            agents_json: agentsJson,
            policies_json: policiesJson,
            seed_sql: seedSql,
            env_example: envExample,
            strategy_md: strategy,
          };

          // Save configs and mark complete
          await db
            .from('pitch_sessions')
            .update({
              configs,
              status: 'completed',
            })
            .eq('id', sessionId);

          sendEvent({ completed: 'configs' });
          sendEvent({ done: true });
          controller.close();
        } catch (err) {
          console.error('Generation error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Generation failed';
          sendEvent({ error: errorMsg });
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
    console.error('Error in generate endpoint:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

function generateSeedSql(agentConfig: AgentConfig, startupName: string): string {
  const agentInserts = agentConfig.agents
    .map(
      (a) =>
        `INSERT INTO agents (id, display_name, role, tone, system_directive, quirk, can_initiate, cooldown_hours)
VALUES ('${a.id}', '${escapeSQL(a.displayName)}', '${escapeSQL(a.role)}', '${escapeSQL(a.tone)}', '${escapeSQL(a.systemDirective)}', '${escapeSQL(a.quirk)}', ${a.canInitiate}, ${a.cooldownHours});`
    )
    .join('\n\n');

  const affinityInserts = agentConfig.initialAffinities
    .map(
      (af) =>
        `INSERT INTO relationships (agent_a, agent_b, affinity, reason)
VALUES ('${af.agentA}', '${af.agentB}', ${af.affinity}, '${escapeSQL(af.reason)}');`
    )
    .join('\n\n');

  return `-- Seed data for ${startupName}
-- Generated by Hatchery

-- Agents
${agentInserts}

-- Initial Relationships
${affinityInserts}
`;
}

function generateEnvExample(workerConfig: WorkerConfig): string {
  const requiredVars = new Set<string>();
  requiredVars.add('SUPABASE_URL');
  requiredVars.add('SUPABASE_SERVICE_KEY');
  requiredVars.add('ANTHROPIC_API_KEY');

  for (const sk of workerConfig.stepKinds) {
    for (const v of sk.requiredConfig) {
      requiredVars.add(v);
    }
  }

  return Array.from(requiredVars)
    .map((v) => `${v}=`)
    .join('\n');
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}
