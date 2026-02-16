import { redirect } from 'next/navigation';
import DashboardHome from '@/components/dashboard/dashboard-home';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

interface SessionActivationRow {
  id: string;
}

interface AgentPolicyRow {
  value: unknown;
}

function hasConfiguredAgents(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const agents = (value as Record<string, unknown>).agents;
  return Array.isArray(agents) && agents.length > 0;
}

async function hasExistingStartup(): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;

  const [{ data: activatedSessions, error: activationError }, { data: agentPolicy, error: agentPolicyError }] =
    await Promise.all([
      db.from('pitch_sessions').select('id').not('activated_at', 'is', null).limit(1).returns<SessionActivationRow[]>(),
      db.from('ops_policies').select('value').eq('key', 'agent_configs').maybeSingle().returns<AgentPolicyRow | null>(),
    ]);

  if (!activationError && (activatedSessions?.length ?? 0) > 0) {
    return true;
  }

  if (!agentPolicyError && hasConfiguredAgents(agentPolicy?.value)) {
    return true;
  }

  return false;
}

export default async function HomePage() {
  const startupExists = await hasExistingStartup();

  if (!startupExists) {
    redirect('/pitch');
  }

  return <DashboardHome />;
}
