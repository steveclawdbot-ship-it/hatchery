import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

interface EventRow {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary: string | null;
  created_at: string;
}

export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const { data, error } = await db
    .from('ops_events')
    .select('id, agent_id, kind, title, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as EventRow[] | null) ?? [];
  const events = rows.map((event) => ({
    id: event.id,
    agentId: event.agent_id,
    kind: event.kind,
    title: event.title,
    summary: event.summary ?? '',
    createdAt: event.created_at,
  }));

  return NextResponse.json(events);
}
