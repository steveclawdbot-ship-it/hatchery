import { DBClient } from '../db/client.js';
import { ProposalService } from './proposal-service.js';

interface Reaction {
  id: string;
  agent_id: string;
  event_pattern: string;
  probability: number;
  cooldown_minutes: number;
  proposal_template: {
    title: string;
    steps: Array<{ kind: string; description: string }>;
  };
  last_fired_at: string | null;
}

export class ReactionProcessor {
  constructor(
    private db: DBClient,
    private proposals: ProposalService,
  ) {}

  async processReactions(): Promise<number> {
    const { data: reactions } = await this.db
      .from('ops_reactions')
      .select('*')
      .eq('is_active', true);

    if (!reactions?.length) return 0;

    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: events } = await this.db
      .from('ops_events')
      .select('*')
      .gte('created_at', since);

    if (!events?.length) return 0;

    let processed = 0;

    for (const reaction of reactions as Reaction[]) {
      // Check cooldown
      if (reaction.last_fired_at) {
        const elapsed = Date.now() - new Date(reaction.last_fired_at).getTime();
        if (elapsed < reaction.cooldown_minutes * 60 * 1000) continue;
      }

      // Match events
      const matching = events.filter((e) => {
        if (reaction.event_pattern === '*') return true;
        if (reaction.event_pattern.endsWith('.*')) {
          return e.kind.startsWith(reaction.event_pattern.slice(0, -2));
        }
        return e.kind === reaction.event_pattern;
      });

      if (matching.length === 0) continue;

      // Probability roll
      if (Math.random() > reaction.probability) continue;

      try {
        await this.proposals.createProposal({
          agentId: reaction.agent_id,
          title: reaction.proposal_template.title,
          steps: reaction.proposal_template.steps,
          source: 'reaction',
          sourceTraceId: `reaction:${reaction.id}:${matching[0].id}`,
        });

        await this.db
          .from('ops_reactions')
          .update({ last_fired_at: new Date().toISOString() })
          .eq('id', reaction.id);

        processed++;
      } catch {
        // Blocked by cap gate or limit — expected
      }
    }

    return processed;
  }
}
