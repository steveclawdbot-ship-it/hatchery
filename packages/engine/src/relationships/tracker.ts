import { DBClient } from '../db/client.js';

export interface Relationship {
  agent_a: string;
  agent_b: string;
  affinity: number;
  total_interactions: number;
  positive_interactions: number;
  negative_interactions: number;
}

export class RelationshipTracker {
  constructor(private db: DBClient) {}

  async getAffinity(agentA: string, agentB: string): Promise<number> {
    const [a, b] = [agentA, agentB].sort();
    const { data } = await this.db
      .from('ops_relationships')
      .select('affinity')
      .eq('agent_a', a)
      .eq('agent_b', b)
      .single();

    return data?.affinity ?? 0.50;
  }

  async getAllForAgent(agentId: string): Promise<Relationship[]> {
    const { data: asA } = await this.db
      .from('ops_relationships')
      .select('*')
      .eq('agent_a', agentId);

    const { data: asB } = await this.db
      .from('ops_relationships')
      .select('*')
      .eq('agent_b', agentId);

    return [...(asA ?? []), ...(asB ?? [])] as Relationship[];
  }

  async applyDrift(
    agentA: string,
    agentB: string,
    drift: number,
    reason: string,
  ): Promise<number> {
    const [a, b] = [agentA, agentB].sort();

    const { data: existing } = await this.db
      .from('ops_relationships')
      .select('*')
      .eq('agent_a', a)
      .eq('agent_b', b)
      .single();

    const currentAffinity = existing?.affinity ?? 0.50;
    const newAffinity = Math.max(0.10, Math.min(0.95, currentAffinity + drift));

    const isPositive = drift > 0;
    const driftEntry = {
      drift,
      reason,
      timestamp: new Date().toISOString(),
    };

    if (existing) {
      const driftLog = [...(existing.drift_log ?? []), driftEntry].slice(-20);
      await this.db
        .from('ops_relationships')
        .update({
          affinity: newAffinity,
          total_interactions: existing.total_interactions + 1,
          positive_interactions: existing.positive_interactions + (isPositive ? 1 : 0),
          negative_interactions: existing.negative_interactions + (isPositive ? 0 : 1),
          drift_log: driftLog,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_a', a)
        .eq('agent_b', b);
    } else {
      await this.db.from('ops_relationships').insert({
        agent_a: a,
        agent_b: b,
        affinity: newAffinity,
        total_interactions: 1,
        positive_interactions: isPositive ? 1 : 0,
        negative_interactions: isPositive ? 0 : 1,
        drift_log: [driftEntry],
      });
    }

    return newAffinity;
  }
}
