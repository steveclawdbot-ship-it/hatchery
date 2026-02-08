import { DBClient } from '../db/client.js';

export interface VoiceModifier {
  modifier: string;
  source: string;
}

/**
 * Derives personality modifiers from an agent's accumulated memories.
 * These modifiers are appended to the agent's system prompt to make
 * their voice evolve based on experience.
 *
 * Max 3 modifiers to avoid prompt bloat.
 */
export async function deriveVoiceModifiers(
  db: DBClient,
  agentId: string,
): Promise<VoiceModifier[]> {
  const modifiers: VoiceModifier[] = [];

  // Get memory stats
  const { data: memories } = await db
    .from('ops_memories')
    .select('type, tags, content, confidence')
    .eq('agent_id', agentId)
    .is('superseded_by', null)
    .gte('confidence', 0.6)
    .order('confidence', { ascending: false });

  if (!memories?.length) return [];

  // Count by type
  const typeCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  for (const m of memories) {
    typeCounts[m.type] = (typeCounts[m.type] ?? 0) + 1;
    for (const tag of m.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  // Top tag
  const topTag = Object.entries(tagCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

  // Rule: many lessons about engagement → reference engagement insights
  if ((typeCounts['lesson'] ?? 0) > 10 && tagCounts['engagement']) {
    modifiers.push({
      modifier: 'Reference what works in engagement when relevant — you have real data.',
      source: `${typeCounts['lesson']} lessons about engagement`,
    });
  }

  // Rule: many patterns about content → content expertise
  if ((typeCounts['pattern'] ?? 0) > 5 && topTag === 'content') {
    modifiers.push({
      modifier: "You've developed expertise in content strategy. Speak with authority on it.",
      source: `${typeCounts['pattern']} content patterns observed`,
    });
  }

  // Rule: many strategies → strategic thinker
  if ((typeCounts['strategy'] ?? 0) > 8) {
    modifiers.push({
      modifier: 'You think in terms of strategy. Frame operational discussions in strategic terms.',
      source: `${typeCounts['strategy']} strategic memories`,
    });
  }

  // Rule: many insights → analytical
  if ((typeCounts['insight'] ?? 0) > 15) {
    modifiers.push({
      modifier: 'You notice patterns others miss. Share non-obvious observations.',
      source: `${typeCounts['insight']} insights accumulated`,
    });
  }

  // Rule: strong preference → opinionated
  if ((typeCounts['preference'] ?? 0) > 5) {
    modifiers.push({
      modifier: "You've formed strong opinions from experience. Don't be afraid to push back.",
      source: `${typeCounts['preference']} preferences formed`,
    });
  }

  return modifiers.slice(0, 3);
}
