import { DBClient } from '../db/client.js';

export interface ProposalInput {
  agentId: string;
  title: string;
  description?: string;
  steps: Array<{ kind: string; description: string; payload?: Record<string, unknown> }>;
  source: 'manual' | 'trigger' | 'reaction' | 'initiative';
  sourceTraceId?: string;
}

export class ProposalService {
  constructor(private db: DBClient) {}

  async createProposal(input: ProposalInput): Promise<{ proposalId: string; autoApproved: boolean }> {
    // Check daily limit for agent
    const dailyLimit = await this.getDailyLimit();
    if (dailyLimit > 0) {
      const todayCount = await this.countTodayProposals(input.agentId);
      if (todayCount >= dailyLimit) {
        throw new Error(`Agent ${input.agentId} at daily proposal limit (${dailyLimit})`);
      }
    }

    // Check cap gates for each step kind
    for (const step of input.steps) {
      const gateOk = await this.checkCapGate(step.kind);
      if (!gateOk.ok) {
        throw new Error(`Cap gate blocked for ${step.kind}: ${gateOk.reason}`);
      }
    }

    // Insert proposal
    const { data: proposal, error } = await this.db
      .from('ops_proposals')
      .insert({
        agent_id: input.agentId,
        title: input.title,
        description: input.description,
        proposed_steps: input.steps,
        source: input.source,
        source_trace_id: input.sourceTraceId,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create proposal: ${error.message}`);

    // Check auto-approve
    const autoApprove = await this.checkAutoApprove(input.steps.map((s) => s.kind));
    if (autoApprove) {
      await this.approveProposal(proposal.id, input);
      return { proposalId: proposal.id, autoApproved: true };
    }

    return { proposalId: proposal.id, autoApproved: false };
  }

  async approveProposal(proposalId: string, input?: ProposalInput): Promise<string> {
    // Update proposal status
    await this.db
      .from('ops_proposals')
      .update({ status: 'accepted', decided_at: new Date().toISOString() })
      .eq('id', proposalId);

    // Get steps from proposal if not provided
    let steps = input?.steps;
    let agentId = input?.agentId;
    if (!steps) {
      const { data } = await this.db
        .from('ops_proposals')
        .select('proposed_steps, agent_id, title, description')
        .eq('id', proposalId)
        .single();
      steps = data?.proposed_steps ?? [];
      agentId = data?.agent_id;
    }

    // Create mission
    const { data: mission, error: mErr } = await this.db
      .from('ops_missions')
      .insert({
        proposal_id: proposalId,
        title: input?.title ?? 'Auto-approved mission',
        description: input?.description,
        created_by: agentId!,
      })
      .select('id')
      .single();

    if (mErr) throw new Error(`Failed to create mission: ${mErr.message}`);

    // Create steps
    const stepRecords = steps!.map((s, i) => ({
      mission_id: mission.id,
      step_number: i + 1,
      kind: s.kind,
      payload: s.payload ?? { description: s.description },
    }));

    const { error: sErr } = await this.db.from('ops_steps').insert(stepRecords);
    if (sErr) throw new Error(`Failed to create steps: ${sErr.message}`);

    return mission.id;
  }

  private async checkAutoApprove(stepKinds: string[]): Promise<boolean> {
    const { data: policy } = await this.db
      .from('ops_policies')
      .select('value')
      .eq('key', 'auto_approve')
      .single();

    if (!policy?.value?.enabled) return false;
    const allowed = policy.value.allowed_step_kinds ?? [];
    return stepKinds.every((k) => allowed.includes(k));
  }

  private async checkCapGate(stepKind: string): Promise<{ ok: boolean; reason?: string }> {
    // Look up cap gate policy key from step registry
    const { data: reg } = await this.db
      .from('ops_step_registry')
      .select('cap_gate_policy_key')
      .eq('kind', stepKind)
      .single();

    if (!reg?.cap_gate_policy_key) return { ok: true };

    const { data: policy } = await this.db
      .from('ops_policies')
      .select('value')
      .eq('key', reg.cap_gate_policy_key)
      .single();

    if (!policy?.value?.limit) return { ok: true };

    // Count today's completed steps of this kind
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await this.db
      .from('ops_steps')
      .select('*', { count: 'exact', head: true })
      .eq('kind', stepKind)
      .eq('status', 'succeeded')
      .gte('completed_at', today.toISOString());

    if ((count ?? 0) >= policy.value.limit) {
      return { ok: false, reason: `Quota full: ${count}/${policy.value.limit}` };
    }

    return { ok: true };
  }

  private async getDailyLimit(): Promise<number> {
    const { data } = await this.db
      .from('ops_policies')
      .select('value')
      .eq('key', 'daily_proposal_limit')
      .single();
    return data?.value?.limit ?? 0;
  }

  private async countTodayProposals(agentId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await this.db
      .from('ops_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('created_at', today.toISOString());

    return count ?? 0;
  }
}
