import { DBClient } from '../db/client.js';

/**
 * Atomic step claim using Postgres compare-and-swap.
 * This ensures only one worker can claim a step, even under concurrency.
 */
export async function atomicClaimStep(
  db: DBClient,
  stepId: string,
  workerId: string,
): Promise<boolean> {
  const { data } = await db.rpc('claim_step', {
    p_step_id: stepId,
    p_worker_id: workerId,
  });

  return !!data;
}

/**
 * Complete a step and potentially finalize the parent mission.
 */
export async function atomicCompleteStep(
  db: DBClient,
  stepId: string,
  status: 'succeeded' | 'failed',
  output?: Record<string, unknown>,
): Promise<string> {
  const { data } = await db.rpc('complete_step', {
    p_step_id: stepId,
    p_status: status,
    p_output: output ?? null,
  });

  return data as string;
}
