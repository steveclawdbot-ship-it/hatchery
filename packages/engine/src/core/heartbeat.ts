import { DBClient } from '../db/client.js';
import { ProposalService } from './proposal-service.js';
import { TriggerEvaluator } from './trigger-evaluator.js';
import { ReactionProcessor } from './reaction-processor.js';
import { MemoryStore } from '../memory/store.js';
import { ConversationOrchestrator } from '../conversations/orchestrator.js';

export interface HeartbeatConfig {
  db: DBClient;
  llmGenerate: (prompt: string, opts: { tier: string; system?: string }) => Promise<string>;
}

export class Heartbeat {
  private db: DBClient;
  private proposals: ProposalService;
  private triggers: TriggerEvaluator;
  private reactions: ReactionProcessor;
  private memory: MemoryStore;
  private conversations: ConversationOrchestrator;

  constructor(config: HeartbeatConfig) {
    this.db = config.db;
    this.proposals = new ProposalService(config.db);
    this.triggers = new TriggerEvaluator(config.db, this.proposals);
    this.reactions = new ReactionProcessor(config.db, this.proposals);
    this.memory = new MemoryStore(config.db);
    this.conversations = new ConversationOrchestrator(config.db, config.llmGenerate);
  }

  async tick(): Promise<{
    triggersEvaluated: number;
    reactionsProcessed: number;
    memoriesPromoted: number;
    stepsRecovered: number;
    conversationScheduled: boolean;
  }> {
    const runId = await this.startRun();

    try {
      // 1. Evaluate triggers
      const triggersEvaluated = await this.triggers.evaluateRecentEvents();

      // 2. Process reaction queue
      const reactionsProcessed = await this.reactions.processReactions();

      // 3. Promote insights (bump confidence on corroborated memories)
      const memoriesPromoted = await this.memory.promoteCorroborated();

      // 4. Check initiative eligibility
      await this.checkInitiatives();

      // 5. Recover stuck steps (running > 30 min)
      const stepsRecovered = await this.recoverStuckSteps();

      // 6. Schedule conversations
      const conversationScheduled = await this.maybeScheduleConversation();

      // 7. Emit heartbeat event
      await this.emitEvent('heartbeat', {
        triggersEvaluated,
        reactionsProcessed,
        memoriesPromoted,
        stepsRecovered,
        conversationScheduled,
      });

      await this.completeRun(runId, 'succeeded', {
        triggersEvaluated,
        reactionsProcessed,
        memoriesPromoted,
        stepsRecovered,
        conversationScheduled,
      });

      return {
        triggersEvaluated,
        reactionsProcessed,
        memoriesPromoted,
        stepsRecovered,
        conversationScheduled,
      };
    } catch (err) {
      await this.completeRun(runId, 'failed', { error: (err as Error).message });
      throw err;
    }
  }

  private async checkInitiatives() {
    // Load agents from config
    const { data: agents } = await this.db.rpc('get_agents_with_memory_stats');
    if (!agents) return;

    for (const agent of agents) {
      // Needs >= 5 high-confidence memories and 4hr cooldown
      if (agent.high_conf_count < 5) continue;

      const { data: lastInit } = await this.db
        .from('ops_initiatives')
        .select('created_at')
        .eq('agent_id', agent.agent_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastInit) {
        const hoursSince = (Date.now() - new Date(lastInit.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 4) continue;
      }

      // Create initiative record (generation happens async in worker)
      await this.db.from('ops_initiatives').insert({
        agent_id: agent.agent_id,
        status: 'pending',
      });
    }
  }

  private async recoverStuckSteps(): Promise<number> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: stuck } = await this.db
      .from('ops_steps')
      .select('id')
      .eq('status', 'running')
      .lt('reserved_at', thirtyMinAgo);

    if (!stuck?.length) return 0;

    const { error } = await this.db
      .from('ops_steps')
      .update({ status: 'queued', reserved_by: null, reserved_at: null })
      .in('id', stuck.map((s) => s.id));

    if (error) console.error('Failed to recover steps:', error.message);

    return stuck.length;
  }

  private async maybeScheduleConversation(): Promise<boolean> {
    // Check daily schedule
    const { data: agentsJson } = await this.db
      .from('ops_policies')
      .select('value')
      .eq('key', 'conversation_schedule')
      .single();

    if (!agentsJson?.value?.schedule) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const schedule = agentsJson.value.schedule as Array<{
      hour: number;
      format: string;
      probability: number;
    }>;

    for (const slot of schedule) {
      if (slot.hour !== currentHour) continue;
      if (Math.random() > slot.probability) continue;

      // Check if we already ran this slot today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await this.db
        .from('ops_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('format', slot.format)
        .gte('created_at', todayStart.toISOString());

      if ((count ?? 0) > 0) continue;

      // Schedule conversation
      await this.conversations.startConversation(slot.format);
      return true;
    }

    return false;
  }

  private async emitEvent(kind: string, payload: Record<string, unknown>) {
    await this.db.from('ops_events').insert({
      agent_id: 'system',
      kind: `system.${kind}`,
      title: `Heartbeat: ${kind}`,
      summary: JSON.stringify(payload),
      payload,
      visibility: 'internal',
    });
  }

  private async startRun(): Promise<string> {
    const { data } = await this.db
      .from('ops_action_runs')
      .insert({ action: 'heartbeat' })
      .select('id')
      .single();
    return data?.id ?? '';
  }

  private async completeRun(id: string, status: string, details: Record<string, unknown>) {
    await this.db
      .from('ops_action_runs')
      .update({ status, details, completed_at: new Date().toISOString() })
      .eq('id', id);
  }
}
