import { DBClient } from '../db/client.js';
import { MemoryStore } from '../memory/store.js';
import { extractJSON } from '../conversations/json-utils.js';

export interface GeneratedInitiative {
  title: string;
  description: string;
  steps: Array<{ kind: string; description: string }>;
  reasoning: string;
}

export async function generateInitiative(
  db: DBClient,
  llmGenerate: (prompt: string, opts: { tier: string; system?: string }) => Promise<string>,
  agentId: string,
  agentDirective: string,
): Promise<GeneratedInitiative> {
  const memoryStore = new MemoryStore(db);

  // Get agent's top memories
  const memories = await memoryStore.getForAgent(agentId, {
    minConfidence: 0.6,
    limit: 15,
  });

  const memoryContext = memories
    .map((m) => `[${m.type}] (${m.confidence}) ${m.content}`)
    .join('\n');

  // Get available step kinds
  const { data: stepKinds } = await db
    .from('ops_step_registry')
    .select('kind, display_name, description');

  const kindsContext = (stepKinds ?? [])
    .map((sk) => `- ${sk.kind}: ${sk.display_name} — ${sk.description}`)
    .join('\n');

  const prompt = `You are ${agentId}, an AI agent with the following directive: ${agentDirective}

Based on your accumulated memories and observations, propose a self-directed initiative (a mission you want to carry out on your own).

Your memories:
${memoryContext}

Available step kinds for your mission:
${kindsContext}

Output JSON:
{
  "title": "Brief initiative title",
  "description": "What you want to do and why",
  "steps": [{"kind": "step_kind_from_list", "description": "what this step accomplishes"}],
  "reasoning": "Why this initiative matters now, based on your memories"
}

Rules:
- Only use step kinds from the available list
- Max 4 steps per initiative
- The initiative should build on your memory insights
- Be specific, not vague`;

  const raw = await llmGenerate(prompt, { tier: 'mid' });
  const json = extractJSON(raw);
  return JSON.parse(json) as GeneratedInitiative;
}
