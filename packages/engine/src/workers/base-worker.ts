import { DBClient } from '../db/client.js';

export interface Step {
  id: string;
  mission_id: string;
  step_number: number;
  kind: string;
  status: string;
  payload: Record<string, unknown>;
  output: Record<string, unknown> | null;
}

export interface WorkerContext {
  db: DBClient;
  llm: {
    generate: (prompt: string, opts: { tier: string; system?: string }) => Promise<string>;
  };
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };
}

export interface StepResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export type StepHandler = (step: Step, context: WorkerContext) => Promise<StepResult>;

export class BaseWorker {
  private kind: string;
  private handler: StepHandler;
  private db: DBClient;
  private context: WorkerContext;
  private workerId: string;
  private consecutiveFailures = 0;
  private maxFailures = 3;
  private running = false;
  private pollIntervalMs = 5000;

  constructor(
    kind: string,
    handler: StepHandler,
    db: DBClient,
    context: WorkerContext,
  ) {
    this.kind = kind;
    this.handler = handler;
    this.db = db;
    this.context = context;
    this.workerId = `worker-${kind}-${Date.now()}`;
  }

  async start() {
    this.running = true;
    this.context.logger.info(`Worker ${this.workerId} started (kind: ${this.kind})`);

    while (this.running) {
      if (this.consecutiveFailures >= this.maxFailures) {
        this.context.logger.error(
          `Circuit breaker tripped for ${this.kind} after ${this.maxFailures} failures`,
        );
        await this.emitAlert(`Circuit breaker: ${this.kind} auto-disabled`);
        this.running = false;
        break;
      }

      try {
        const step = await this.claimNextStep();
        if (!step) {
          await this.sleep(this.pollIntervalMs);
          continue;
        }

        this.context.logger.info(`Claimed step ${step.id} (${step.kind})`);
        const result = await this.handler(step, this.context);

        if (result.success) {
          await this.completeStep(step.id, 'succeeded', result.output ?? {});
          this.consecutiveFailures = 0;
          this.context.logger.info(`Step ${step.id} succeeded`);
        } else {
          await this.completeStep(step.id, 'failed', { error: result.error });
          this.consecutiveFailures++;
          this.context.logger.error(`Step ${step.id} failed: ${result.error}`);
        }
      } catch (err) {
        this.consecutiveFailures++;
        this.context.logger.error(`Worker error: ${(err as Error).message}`);
        await this.sleep(this.pollIntervalMs * 2);
      }
    }
  }

  stop() {
    this.running = false;
  }

  private async claimNextStep(): Promise<Step | null> {
    // Find next queued step of our kind
    const { data: step } = await this.db
      .from('ops_steps')
      .select('*')
      .eq('kind', this.kind)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!step) return null;

    // Atomic claim via Postgres function
    const { data: claimed } = await this.db.rpc('claim_step', {
      p_step_id: step.id,
      p_worker_id: this.workerId,
    });

    if (!claimed) return null;
    return { ...step, status: 'running' };
  }

  private async completeStep(
    stepId: string,
    status: 'succeeded' | 'failed',
    output: Record<string, unknown>,
  ) {
    await this.db.rpc('complete_step', {
      p_step_id: stepId,
      p_status: status,
      p_output: output,
    });

    // Emit event
    await this.db.from('ops_events').insert({
      agent_id: this.workerId,
      kind: `step.${status}`,
      title: `Step ${status}: ${this.kind}`,
      payload: { stepId, output },
      visibility: 'internal',
    });
  }

  private async emitAlert(message: string) {
    await this.db.from('ops_events').insert({
      agent_id: 'system',
      kind: 'system.alert',
      title: message,
      payload: { worker: this.workerId, kind: this.kind },
      tags: ['alert', 'circuit-breaker'],
      visibility: 'public',
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
