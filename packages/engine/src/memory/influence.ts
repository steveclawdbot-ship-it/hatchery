import { MemoryStore, Memory } from './store.js';

/**
 * Memory influence system: 30% probability that agent memories
 * affect topic selection during trigger evaluation and conversations.
 */
export class MemoryInfluence {
  constructor(private store: MemoryStore) {}

  async getInfluence(agentId: string, availableTopics: string[]): Promise<{
    topic: string | null;
    memory: Memory | null;
    memoryInfluenced: boolean;
  }> {
    // 30% chance of memory influence
    if (Math.random() > 0.3) {
      return { topic: null, memory: null, memoryInfluenced: false };
    }

    const memories = await this.store.getForAgent(agentId, {
      minConfidence: 0.60,
      limit: 10,
    });

    if (!memories.length) {
      return { topic: null, memory: null, memoryInfluenced: false };
    }

    // Match memory keywords against available topics
    for (const memory of memories) {
      const keywords = memory.tags.concat(
        memory.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4),
      );

      for (const topic of availableTopics) {
        const topicWords = topic.toLowerCase().split(/\s+/);
        const overlap = keywords.filter((k) => topicWords.some((t) => t.includes(k) || k.includes(t)));
        if (overlap.length > 0) {
          return { topic, memory, memoryInfluenced: true };
        }
      }
    }

    return { topic: null, memory: null, memoryInfluenced: false };
  }
}
