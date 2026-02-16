import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  AGENT_GENERATION_PROMPT,
  WORKER_GENERATION_PROMPT,
  STRATEGY_GENERATION_PROMPT,
  formatTranscript,
} from '@/lib/pitch/prompts';
import {
  generatePitchText,
  getMissingProviderKeyError,
  getPitchProviderOrDefault,
  getProviderContext,
  type PitchProvider,
} from '@/lib/pitch/llm';
import type { Round, AgentConfig, WorkerConfig, GeneratedConfigs } from '@/lib/pitch/types';
import { generateSeedSql } from '@/lib/pitch/seed-sql';

const STRATEGY_SYSTEM_PROMPT =
  'You are a startup strategist. Write actionable strategy documents, not fluffy mission statements.';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createSupabaseAdminClient();

  if (!db) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
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

    const provider = getPitchProviderOrDefault(session.provider);
    const providerContext = getProviderContext(provider);
    if (!providerContext) {
      return Response.json({ error: getMissingProviderKeyError(provider) }, { status: 500 });
    }

    const rounds: Round[] = session.rounds || [];
    const revisedPitch = session.revised_pitch;
    const startupName = session.startup_name || 'AI Startup';

    const persistedAgentConfig = isAgentConfig(session.agent_config) ? session.agent_config : null;
    const persistedWorkerConfig = isWorkerConfig(session.worker_config) ? session.worker_config : null;
    const persistedStrategy =
      typeof session.strategy === 'string' && session.strategy.trim().length > 0
        ? session.strategy
        : null;
    const persistedConfigs = isGeneratedConfigs(session.configs) ? session.configs : null;

    // Create streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendEvent(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          // Step 1: Generate Agent Team (or resume)
          let agentConfig: AgentConfig;
          if (persistedAgentConfig) {
            agentConfig = persistedAgentConfig;
            sendEvent({ completed: 'agents', resumed: true });
          } else {
            sendEvent({ step: 'agents' });

            const agentText = await generatePitchText(providerContext, {
              mode: 'generation',
              maxTokens: 4000,
              temperature: 0.7,
              prompt: `${AGENT_GENERATION_PROMPT}\n\n--- REVISED PITCH ---\n${revisedPitch}\n\nRespond ONLY with valid JSON, no other text.`,
            });

            agentConfig = parseJsonObject<AgentConfig>(agentText, 'agent configuration');

            const { error: agentSaveError } = await db
              .from('pitch_sessions')
              .update({ agent_config: agentConfig })
              .eq('id', sessionId);

            if (agentSaveError) {
              throw new Error(`Failed to save agent config: ${agentSaveError.message}`);
            }

            sendEvent({ completed: 'agents' });
          }

          // Step 2: Generate Worker Configuration (or resume)
          let workerConfig: WorkerConfig;
          if (persistedWorkerConfig) {
            workerConfig = persistedWorkerConfig;
            sendEvent({ completed: 'workers', resumed: true });
          } else {
            sendEvent({ step: 'workers' });

            const agentSummary = agentConfig.agents
              .map((a) => `- ${a.displayName} (${a.id}): ${a.role}`)
              .join('\n');

            const workerText = await generatePitchText(providerContext, {
              mode: 'generation',
              maxTokens: 4000,
              temperature: 0.6,
              prompt: `${WORKER_GENERATION_PROMPT}\n\n--- REVISED PITCH ---\n${revisedPitch}\n\n--- AGENT TEAM ---\n${agentSummary}\n\nRespond ONLY with valid JSON, no other text.`,
            });

            workerConfig = parseJsonObject<WorkerConfig>(workerText, 'worker configuration');

            const { error: workerSaveError } = await db
              .from('pitch_sessions')
              .update({ worker_config: workerConfig })
              .eq('id', sessionId);

            if (workerSaveError) {
              throw new Error(`Failed to save worker config: ${workerSaveError.message}`);
            }

            sendEvent({ completed: 'workers' });
          }

          // Step 3: Generate Strategy (or resume)
          let strategy: string;
          if (persistedStrategy) {
            strategy = persistedStrategy;
            sendEvent({ completed: 'strategy', resumed: true });
          } else {
            sendEvent({ step: 'strategy' });

            const transcriptText = formatTranscript(rounds);
            strategy = await generatePitchText(providerContext, {
              mode: 'generation',
              system: STRATEGY_SYSTEM_PROMPT,
              maxTokens: 4000,
              temperature: 0.6,
              prompt: `${STRATEGY_GENERATION_PROMPT}\n\nStartup name: ${startupName}\n\n--- PITCH MEETING TRANSCRIPT ---\n${transcriptText}\n\n--- REVISED PITCH ---\n${revisedPitch}`,
            });

            const { error: strategySaveError } = await db
              .from('pitch_sessions')
              .update({ strategy })
              .eq('id', sessionId);

            if (strategySaveError) {
              throw new Error(`Failed to save strategy: ${strategySaveError.message}`);
            }

            sendEvent({ completed: 'strategy' });
          }

          // Step 4: Generate Config Files (or resume)
          sendEvent({ step: 'configs' });

          const configs =
            persistedConfigs ??
            buildGeneratedConfigs({
              startupName,
              provider,
              agentConfig,
              workerConfig,
              strategy,
            });

          const completionUpdate = persistedConfigs
            ? { status: 'completed' }
            : { configs, status: 'completed' };

          const { error: completionError } = await db
            .from('pitch_sessions')
            .update(completionUpdate)
            .eq('id', sessionId);

          if (completionError) {
            throw new Error(`Failed to save generated configs: ${completionError.message}`);
          }

          sendEvent({ completed: 'configs', resumed: Boolean(persistedConfigs) });
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

function buildGeneratedConfigs(params: {
  startupName: string;
  provider: PitchProvider;
  agentConfig: AgentConfig;
  workerConfig: WorkerConfig;
  strategy: string;
}): GeneratedConfigs {
  const { startupName, provider, agentConfig, workerConfig, strategy } = params;

  return {
    'agents.json': buildAgentsJson(startupName, agentConfig),
    'policies.json': buildPoliciesJson(workerConfig),
    'triggers.json': buildTriggersJson(workerConfig),
    'conversations.json': buildConversationsJson(agentConfig),
    'step-registry.json': buildStepRegistryJson(workerConfig),
    'seed.sql': generateSeedSql(startupName, agentConfig, workerConfig),
    '.env.example': generateEnvExample(workerConfig, provider),
    'STRATEGY.md': strategy,
  };
}

function buildAgentsJson(startupName: string, agentConfig: AgentConfig): string {
  return JSON.stringify(
    {
      version: '1.0',
      startup: startupName,
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
      conversationFormats: agentConfig.conversationFormats,
      dailySchedule: agentConfig.dailySchedule,
    },
    null,
    2
  );
}

function buildPoliciesJson(workerConfig: WorkerConfig): string {
  return JSON.stringify(
    {
      version: '1.0',
      ...workerConfig.policies,
      cap_gates: workerConfig.capGates,
    },
    null,
    2
  );
}

function buildTriggersJson(workerConfig: WorkerConfig): string {
  return JSON.stringify(
    {
      version: '1.0',
      triggers: workerConfig.triggers,
    },
    null,
    2
  );
}

function buildConversationsJson(agentConfig: AgentConfig): string {
  return JSON.stringify(
    {
      version: '1.0',
      formats: Object.fromEntries(
        agentConfig.conversationFormats.map((format) => [format, getDefaultFormatConfig(format)])
      ),
    },
    null,
    2
  );
}

function buildStepRegistryJson(workerConfig: WorkerConfig): string {
  return JSON.stringify(
    {
      version: '1.0',
      steps: Object.fromEntries(
        workerConfig.stepKinds.map((sk) => [
          sk.kind,
          {
            displayName: sk.displayName,
            workerType: sk.workerType,
            description: sk.description,
            requiredConfig: sk.requiredConfig,
            capGatePolicyKey: sk.capGatePolicyKey ?? null,
          },
        ])
      ),
    },
    null,
    2
  );
}

function generateEnvExample(workerConfig: WorkerConfig, provider: PitchProvider): string {
  const requiredVars = new Set<string>();
  requiredVars.add('SUPABASE_URL');
  requiredVars.add('SUPABASE_SERVICE_KEY');
  requiredVars.add('LLM_PROVIDER');
  requiredVars.add(provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY');

  for (const sk of workerConfig.stepKinds) {
    for (const v of sk.requiredConfig) {
      requiredVars.add(v);
    }
  }

  const lines: string[] = [];
  for (const variableName of requiredVars) {
    if (variableName === 'LLM_PROVIDER') {
      lines.push(`LLM_PROVIDER=${provider}`);
      continue;
    }
    lines.push(`${variableName}=`);
  }

  return lines.join('\n');
}

function parseJsonObject<T>(text: string, label: string): T {
  try {
    return JSON.parse(extractJsonObject(text)) as T;
  } catch {
    throw new Error(`Failed to parse ${label}`);
  }
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  const source = fenced ? fenced[1].trim() : text;

  const start = source.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') depth++;
    if (char === '}') depth--;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error('Unbalanced JSON object in model response');
}

function getDefaultFormatConfig(format: string) {
  const defaults: Record<string, object> = {
    standup: {
      minParticipants: 3,
      maxParticipants: 6,
      minTurns: 6,
      maxTurns: 12,
      temperature: 0.7,
      extractActionItems: true,
    },
    debate: {
      minParticipants: 2,
      maxParticipants: 4,
      minTurns: 8,
      maxTurns: 16,
      temperature: 0.85,
      extractActionItems: false,
    },
    watercooler: {
      minParticipants: 2,
      maxParticipants: 3,
      minTurns: 4,
      maxTurns: 8,
      temperature: 0.9,
      extractActionItems: false,
    },
    brainstorm: {
      minParticipants: 3,
      maxParticipants: 5,
      minTurns: 10,
      maxTurns: 20,
      temperature: 0.85,
      extractActionItems: true,
    },
    war_room: {
      minParticipants: 3,
      maxParticipants: 6,
      minTurns: 8,
      maxTurns: 15,
      temperature: 0.6,
      extractActionItems: true,
    },
    retrospective: {
      minParticipants: 3,
      maxParticipants: 6,
      minTurns: 6,
      maxTurns: 12,
      temperature: 0.7,
      extractActionItems: true,
    },
    one_on_one: {
      minParticipants: 2,
      maxParticipants: 2,
      minTurns: 6,
      maxTurns: 10,
      temperature: 0.75,
      extractActionItems: false,
    },
    celebration: {
      minParticipants: 3,
      maxParticipants: 6,
      minTurns: 4,
      maxTurns: 8,
      temperature: 0.95,
      extractActionItems: false,
    },
  };

  return (
    defaults[format] ?? {
      minParticipants: 2,
      maxParticipants: 4,
      minTurns: 6,
      maxTurns: 12,
      temperature: 0.7,
      extractActionItems: false,
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isAgentConfig(value: unknown): value is AgentConfig {
  return isRecord(value) && Array.isArray(value.agents) && Array.isArray(value.initialAffinities);
}

function isWorkerConfig(value: unknown): value is WorkerConfig {
  return isRecord(value) && Array.isArray(value.stepKinds) && Array.isArray(value.triggers);
}

function isGeneratedConfigs(value: unknown): value is GeneratedConfigs {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === 'string');
}
