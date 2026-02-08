import { DBClient } from '../db/client.js';

export interface InitiativeEligibility {
  agentId: string;
  eligible: boolean;
  reason?: string;
  highConfMemoryCount: number;
  hoursSinceLastInitiative: number | null;
}

/**
 * Check if an agent is eligible to generate a self-directed initiative.
 * Requirements:
 * - At least 5 high-confidence (>=0.6) memories
 * - At least 4 hours since last initiative
 */
export async function checkEligibility(
  db: DBClient,
  agentId: string,
): Promise<InitiativeEligibility> {
  // Count high-confidence memories
  const { count: memCount } = await db
    .from('ops_memories')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .is('superseded_by', null)
    .gte('confidence', 0.6);

  const highConfMemoryCount = memCount ?? 0;

  if (highConfMemoryCount < 5) {
    return {
      agentId,
      eligible: false,
      reason: `Only ${highConfMemoryCount}/5 high-confidence memories`,
      highConfMemoryCount,
      hoursSinceLastInitiative: null,
    };
  }

  // Check cooldown
  const { data: lastInit } = await db
    .from('ops_initiatives')
    .select('created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let hoursSince: number | null = null;
  if (lastInit) {
    hoursSince = (Date.now() - new Date(lastInit.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 4) {
      return {
        agentId,
        eligible: false,
        reason: `Cooldown: ${hoursSince.toFixed(1)}h since last initiative (need 4h)`,
        highConfMemoryCount,
        hoursSinceLastInitiative: hoursSince,
      };
    }
  }

  return {
    agentId,
    eligible: true,
    highConfMemoryCount,
    hoursSinceLastInitiative: hoursSince,
  };
}
