import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  parseInterventionActionRequest,
  type InterventionAction,
  type InterventionSeverity,
  type InterventionStatus,
} from '@/lib/interventions/actions';

interface InterventionRow {
  id: string;
  status: InterventionStatus;
  reason: string;
  severity: InterventionSeverity;
  title: string;
  description: string | null;
  step_id: string | null;
  mission_id: string | null;
  action_run_id: string | null;
  assigned_to: string | null;
  context: unknown;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  updated_at: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ interventionId: string }> },
) {
  const { interventionId } = await params;
  const db = createSupabaseAdminClient();

  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const actionRequest = parseInterventionActionRequest(body);
  if (!actionRequest) {
    return NextResponse.json({ error: 'Invalid intervention action payload' }, { status: 400 });
  }

  const interventionResult = await db
    .from('ops_interventions')
    .select(
      'id, status, reason, severity, title, description, step_id, mission_id, action_run_id, assigned_to, context, created_at, acknowledged_at, resolved_at, updated_at',
    )
    .eq('id', interventionId)
    .single();

  if (interventionResult.error || !interventionResult.data) {
    return NextResponse.json({ error: 'Intervention not found' }, { status: 404 });
  }

  const intervention = interventionResult.data as InterventionRow;
  if (intervention.status === 'resolved' && actionRequest.action !== 'resolve') {
    return NextResponse.json(
      { error: 'Intervention is already resolved.' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const currentContext = asRecord(intervention.context);

  if (actionRequest.action === 'retry') {
    if (!intervention.step_id) {
      return NextResponse.json(
        { error: 'Retry requires an intervention with a linked step.' },
        { status: 400 },
      );
    }

    const { error: stepError } = await db
      .from('ops_steps')
      .update({
        status: 'queued',
        reserved_by: null,
        reserved_at: null,
        completed_at: null,
        output: null,
      })
      .eq('id', intervention.step_id);

    if (stepError) {
      return NextResponse.json(
        { error: `Failed to requeue step: ${stepError.message}` },
        { status: 500 },
      );
    }

    if (intervention.mission_id) {
      await db
        .from('ops_missions')
        .update({
          status: 'approved',
          completed_at: null,
        })
        .eq('id', intervention.mission_id)
        .eq('status', 'failed');
    }
  }

  const nextStatus = resolveNextStatus(actionRequest.action, intervention.status);
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    assigned_to: actionRequest.assignee ?? intervention.assigned_to,
    context: {
      ...currentContext,
      lastAction: actionRequest.action,
      lastActionAt: now,
      lastActionNote: actionRequest.note ?? null,
      retryCount:
        actionRequest.action === 'retry'
          ? (readNumber(currentContext.retryCount) ?? 0) + 1
          : readNumber(currentContext.retryCount) ?? 0,
    },
  };

  if (nextStatus === 'acknowledged' && !intervention.acknowledged_at) {
    updatePayload.acknowledged_at = now;
  }

  if (actionRequest.action === 'resolve') {
    updatePayload.resolved_at = now;
  }

  const updateResult = await db
    .from('ops_interventions')
    .update(updatePayload)
    .eq('id', interventionId)
    .select(
      'id, status, reason, severity, title, description, step_id, mission_id, action_run_id, assigned_to, context, created_at, acknowledged_at, resolved_at, updated_at',
    )
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { error: `Failed to update intervention: ${updateResult.error?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  const updated = updateResult.data as InterventionRow;
  await emitOperatorEvent(db, updated, actionRequest.action, actionRequest.note);

  return NextResponse.json({
    ok: true,
    intervention: mapIntervention(updated),
  });
}

function resolveNextStatus(
  action: InterventionAction,
  currentStatus: InterventionStatus,
): InterventionStatus {
  if (action === 'resolve') return 'resolved';
  if (action === 'acknowledge') return 'acknowledged';
  if (action === 'retry') return 'acknowledged';
  if (action === 'reassign') return currentStatus === 'open' ? 'acknowledged' : currentStatus;
  return currentStatus;
}

async function emitOperatorEvent(
  db: ReturnType<typeof createSupabaseAdminClient>,
  intervention: InterventionRow,
  action: InterventionAction,
  note?: string,
) {
  if (!db) return;

  await db.from('ops_events').insert({
    agent_id: intervention.assigned_to ?? 'operator',
    kind: `operator.intervention.${action}`,
    title: `Intervention ${action}: ${intervention.title}`,
    summary: note ?? null,
    payload: {
      interventionId: intervention.id,
      reason: intervention.reason,
      severity: intervention.severity,
      status: intervention.status,
      stepId: intervention.step_id,
      missionId: intervention.mission_id,
      note: note ?? null,
    },
    visibility: 'internal',
  });
}

function mapIntervention(row: InterventionRow) {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    severity: row.severity,
    title: row.title,
    description: row.description ?? '',
    stepId: row.step_id,
    missionId: row.mission_id,
    actionRunId: row.action_run_id,
    assignedTo: row.assigned_to,
    context: asRecord(row.context),
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    updatedAt: row.updated_at,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
