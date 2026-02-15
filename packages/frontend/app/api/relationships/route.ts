import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const { data, error } = await db
    .from('ops_relationships')
    .select('agent_a, agent_b, affinity');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const relationships = (data ?? []).map((row) => ({
    source: row.agent_a,
    target: row.agent_b,
    affinity: row.affinity,
  }));

  return NextResponse.json(relationships);
}
