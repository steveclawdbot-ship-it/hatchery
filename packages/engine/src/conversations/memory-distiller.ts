import { extractJSON } from './json-utils.js';

export interface DistilledMemories {
  memories: Array<{
    agent_id: string;
    type: 'insight' | 'pattern' | 'strategy' | 'preference' | 'lesson';
    content: string;
    confidence: number;
    tags: string[];
  }>;
  pairwise_drift: Array<{
    agent_a: string;
    agent_b: string;
    drift: number;
    reason: string;
  }>;
  action_items: Array<{
    title: string;
    agent_id: string;
    step_kind: string;
  }>;
}

const DISTILL_PROMPT = `Analyze this conversation and extract:
1. Memories: key insights, patterns, strategies, preferences, or lessons learned by individual agents (max 6, min confidence 0.55)
2. Pairwise drift: how relationships shifted during this conversation (drift range: -0.03 to +0.03)
3. Action items: concrete next steps mentioned (only for standup, war_room, and brainstorm formats)

Output JSON:
{
  "memories": [{"agent_id": "...", "type": "insight|pattern|strategy|preference|lesson", "content": "...", "confidence": 0.55-0.95, "tags": ["..."]}],
  "pairwise_drift": [{"agent_a": "...", "agent_b": "...", "drift": -0.03 to 0.03, "reason": "..."}],
  "action_items": [{"title": "...", "agent_id": "...", "step_kind": "..."}]
}

Rules:
- Max 6 memories total
- Min confidence 0.55
- Only extract genuine insights, not restated facts
- Drift should reflect actual disagreements or agreements observed
- action_items only if the conversation format warrants them`;

export async function distillMemories(
  llmGenerate: (prompt: string, opts: { tier: string; system?: string }) => Promise<string>,
  conversationTurns: Array<{ speaker: string; dialogue: string }>,
  format: string,
  participants: string[],
): Promise<DistilledMemories> {
  const transcript = conversationTurns
    .map((t) => `${t.speaker}: ${t.dialogue}`)
    .join('\n');

  const prompt = `${DISTILL_PROMPT}\n\nFormat: ${format}\nParticipants: ${participants.join(', ')}\n\nTranscript:\n${transcript}`;

  const raw = await llmGenerate(prompt, { tier: 'mid' });
  const json = extractJSON(raw);
  const result = JSON.parse(json) as DistilledMemories;

  // Validate and clamp
  result.memories = result.memories
    .filter((m) => m.confidence >= 0.55)
    .slice(0, 6);

  result.pairwise_drift = result.pairwise_drift.map((d) => ({
    ...d,
    drift: Math.max(-0.03, Math.min(0.03, d.drift)),
  }));

  return result;
}
