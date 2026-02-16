import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { InterventionStatus, InterventionSeverity } from '@/lib/interventions/actions';

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
  context: Record<string, unknown> | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  updated_at: string;
}

export async function GET(request: Request) {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get('status');

  const validStatus =
    requestedStatus === 'open' ||
    requestedStatus === 'acknowledged' ||
    requestedStatus === 'resolved'
      ? requestedStatus
      : requestedStatus === 'all'
        ? 'all'
        : null;

  let query = db
    .from('ops_interventions')
    .select(
      'id, status, reason, severity, title, description, step_id, mission_id, action_run_id, assigned_to, context, created_at, acknowledged_at, resolved_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (validStatus === 'open' || validStatus === 'acknowledged' || validStatus === 'resolved') {
    query = query.eq('status', validStatus);
  } else if (validStatus !== 'all') {
    query = query.neq('status', 'resolved');
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as InterventionRow[] | null) ?? [];
  const interventions = rows.map((row) => ({
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
    context: row.context ?? {},
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({
    interventions,
  });
}
