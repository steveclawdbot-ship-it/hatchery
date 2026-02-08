import { DBClient } from '../db/client.js';
import { ProposalService } from './proposal-service.js';

interface Trigger {
  id: string;
  name: string;
  event_pattern: string;
  condition: Record<string, unknown>;
  proposal_template: {
    title: string;
    steps: Array<{ kind: string; description: string }>;
  };
  cooldown_minutes: number;
  last_fired_at: string | null;
  fire_count: number;
}

export class TriggerEvaluator {
  constructor(
    private db: DBClient,
    private proposals: ProposalService,
  ) {}

  async evaluateRecentEvents(): Promise<number> {
    // Get active triggers
    const { data: triggers } = await this.db
      .from('ops_triggers')
      .select('*')
      .eq('is_active', true);

    if (!triggers?.length) return 0;

    // Get events from last heartbeat window (5 min)
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: events } = await this.db
      .from('ops_events')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (!events?.length) return 0;

    let fired = 0;

    for (const trigger of triggers as Trigger[]) {
      // Check cooldown
      if (trigger.last_fired_at) {
        const elapsed = Date.now() - new Date(trigger.last_fired_at).getTime();
        if (elapsed < trigger.cooldown_minutes * 60 * 1000) continue;
      }

      // Match events against trigger pattern
      const matchingEvents = events.filter((e) => this.matchPattern(e, trigger));
      if (matchingEvents.length === 0) continue;

      // Fire trigger — create proposal
      const event = matchingEvents[0];
      try {
        await this.proposals.createProposal({
          agentId: event.agent_id,
          title: trigger.proposal_template.title,
          steps: trigger.proposal_template.steps,
          source: 'trigger',
          sourceTraceId: `trigger:${trigger.id}:${event.id}`,
        });

        // Update trigger metadata
        await this.db
          .from('ops_triggers')
          .update({
            fire_count: trigger.fire_count + 1,
            last_fired_at: new Date().toISOString(),
          })
          .eq('id', trigger.id);

        fired++;
      } catch (err) {
        // Cap gate or limit blocked it — that's OK
        console.error(`Trigger ${trigger.name} blocked: ${(err as Error).message}`);
      }
    }

    return fired;
  }

  private matchPattern(
    event: { kind: string; tags?: string[]; payload?: Record<string, unknown> },
    trigger: Trigger,
  ): boolean {
    // Simple glob match on event kind
    const pattern = trigger.event_pattern;
    if (pattern === '*') return true;

    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      if (!event.kind.startsWith(prefix)) return false;
    } else if (pattern !== event.kind) {
      return false;
    }

    // Check condition fields against event payload
    if (trigger.condition && Object.keys(trigger.condition).length > 0) {
      for (const [key, value] of Object.entries(trigger.condition)) {
        if (event.payload?.[key] !== value) return false;
      }
    }

    return true;
  }
}
