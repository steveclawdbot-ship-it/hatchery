import { RelationshipTracker } from '../relationships/tracker.js';

export interface SpeakerCandidate {
  id: string;
  speakCount: number;
}

export class SpeakerSelector {
  constructor(private relationships: RelationshipTracker) {}

  async selectNextSpeaker(
    candidates: SpeakerCandidate[],
    lastSpeaker: string | null,
    affinities: Map<string, number>,
  ): Promise<string> {
    const weights = await Promise.all(
      candidates.map(async (agent) => {
        // Never let the same agent speak twice in a row
        if (agent.id === lastSpeaker) return { id: agent.id, weight: 0 };

        let w = 1.0;

        // Affinity to last speaker (agents who like each other respond more)
        if (lastSpeaker) {
          const affinity = affinities.get(`${agent.id}:${lastSpeaker}`) ??
            affinities.get(`${lastSpeaker}:${agent.id}`) ?? 0.5;
          w += affinity * 0.6;
        }

        // Recency penalty (spoke a lot → lower weight)
        const totalSpeaks = candidates.reduce((sum, c) => sum + c.speakCount, 0);
        if (totalSpeaks > 0) {
          const speakRatio = agent.speakCount / totalSpeaks;
          w -= speakRatio * 0.4;
        }

        // Jitter for variety
        w += Math.random() * 0.4 - 0.2;

        return { id: agent.id, weight: Math.max(0.01, w) };
      }),
    );

    return weightedRandomPick(weights);
  }
}

function weightedRandomPick(items: Array<{ id: string; weight: number }>): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.id;
  }

  return items[items.length - 1].id;
}
