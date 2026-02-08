import { DBClient } from '../db/client.js';

export interface Memory {
  id: string;
  agent_id: string;
  type: 'insight' | 'pattern' | 'strategy' | 'preference' | 'lesson';
  content: string;
  confidence: number;
  tags: string[];
  created_at: string;
}

export class MemoryStore {
  constructor(private db: DBClient) {}

  async create(memory: Omit<Memory, 'id' | 'created_at'>): Promise<string> {
    const { data, error } = await this.db
      .from('ops_memories')
      .insert(memory)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create memory: ${error.message}`);
    return data.id;
  }

  async getForAgent(
    agentId: string,
    options: { type?: string; minConfidence?: number; limit?: number } = {},
  ): Promise<Memory[]> {
    let query = this.db
      .from('ops_memories')
      .select('*')
      .eq('agent_id', agentId)
      .is('superseded_by', null)
      .order('confidence', { ascending: false });

    if (options.type) query = query.eq('type', options.type);
    if (options.minConfidence) query = query.gte('confidence', options.minConfidence);
    if (options.limit) query = query.limit(options.limit);

    const { data } = await query;
    return (data as Memory[]) ?? [];
  }

  async getInfluentialMemories(agentId: string): Promise<Memory[]> {
    // 30% probability of memory influence
    if (Math.random() > 0.3) return [];

    return this.getForAgent(agentId, {
      minConfidence: 0.60,
      limit: 3,
    });
  }

  async promoteCorroborated(): Promise<number> {
    // Find memories with similar content across agents and bump confidence
    const { data: clusters } = await this.db.rpc('find_corroborated_memories');
    if (!clusters?.length) return 0;

    let promoted = 0;
    for (const cluster of clusters) {
      const newConfidence = Math.min(cluster.confidence + 0.05, 1.0);
      await this.db
        .from('ops_memories')
        .update({ confidence: newConfidence, updated_at: new Date().toISOString() })
        .eq('id', cluster.id);
      promoted++;
    }
    return promoted;
  }

  async supersede(oldId: string, newMemory: Omit<Memory, 'id' | 'created_at'>): Promise<string> {
    const newId = await this.create(newMemory);
    await this.db
      .from('ops_memories')
      .update({ superseded_by: newId })
      .eq('id', oldId);
    return newId;
  }

  async search(query: string, options: { agentId?: string; limit?: number } = {}): Promise<Memory[]> {
    let q = this.db
      .from('ops_memories')
      .select('*')
      .is('superseded_by', null)
      .ilike('content', `%${query}%`)
      .order('confidence', { ascending: false })
      .limit(options.limit ?? 10);

    if (options.agentId) q = q.eq('agent_id', options.agentId);

    const { data } = await q;
    return (data as Memory[]) ?? [];
  }
}
