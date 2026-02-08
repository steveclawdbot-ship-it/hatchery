import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type CompanyTemplate = 'research' | 'back-office' | 'creative';
type RuntimeMode = 'running' | 'paused' | 'stopped';

interface CompanyConfig {
  companyTemplate: CompanyTemplate;
  metricName: string;
  targetValue: number;
  deadlineDays: number;
  budgetLimit: number;
  loopCapPerDay: number;
  postLimitPerDay: number;
}

interface ControlState {
  mode: RuntimeMode;
  updatedAt: string | null;
  pollingMinutes: number;
}

interface PolicyRow {
  key: string;
  value: unknown;
}

const DEFAULT_CONFIG: CompanyConfig = {
  companyTemplate: 'research',
  metricName: 'Weekly qualified leads',
  targetValue: 25,
  deadlineDays: 30,
  budgetLimit: 100,
  loopCapPerDay: 24,
  postLimitPerDay: 5,
};

const DEFAULT_CONTROL: ControlState = {
  mode: 'running',
  updatedAt: null,
  pollingMinutes: 5,
};

export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const { data, error } = await db
    .from('ops_policies')
    .select('key, value')
    .in('key', ['company_runtime_config', 'runtime_control']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as PolicyRow[] | null) ?? [];
  const policyMap = new Map(rows.map((row) => [row.key, row.value]));

  return NextResponse.json({
    config: normalizeConfig(policyMap.get('company_runtime_config')),
    control: normalizeControl(policyMap.get('runtime_control')),
  });
}

export async function POST(request: Request) {
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

  const validated = validateConfig(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { error } = await db.from('ops_policies').upsert({
    key: 'company_runtime_config',
    value: validated.value,
    description: 'MVP runtime config for goal, metric, budget, and loop limits',
  }, {
    onConflict: 'key',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, config: validated.value });
}

function normalizeConfig(value: unknown): CompanyConfig {
  if (!isRecord(value)) return DEFAULT_CONFIG;
  const template = value.companyTemplate;
  const metricName = value.metricName;
  const targetValue = value.targetValue;
  const deadlineDays = value.deadlineDays;
  const budgetLimit = value.budgetLimit;
  const loopCapPerDay = value.loopCapPerDay;
  const postLimitPerDay = value.postLimitPerDay;

  return {
    companyTemplate: isTemplate(template) ? template : DEFAULT_CONFIG.companyTemplate,
    metricName: typeof metricName === 'string' && metricName.trim().length > 0
      ? metricName.trim()
      : DEFAULT_CONFIG.metricName,
    targetValue: asPositiveNumber(targetValue, DEFAULT_CONFIG.targetValue),
    deadlineDays: asPositiveNumber(deadlineDays, DEFAULT_CONFIG.deadlineDays),
    budgetLimit: asPositiveNumber(budgetLimit, DEFAULT_CONFIG.budgetLimit),
    loopCapPerDay: asPositiveNumber(loopCapPerDay, DEFAULT_CONFIG.loopCapPerDay),
    postLimitPerDay: asPositiveNumber(postLimitPerDay, DEFAULT_CONFIG.postLimitPerDay),
  };
}

function normalizeControl(value: unknown): ControlState {
  if (!isRecord(value)) return DEFAULT_CONTROL;
  const mode = value.mode;
  return {
    mode: mode === 'paused' || mode === 'stopped' ? mode : 'running',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    pollingMinutes: asPositiveNumber(value.pollingMinutes, DEFAULT_CONTROL.pollingMinutes),
  };
}

function validateConfig(value: unknown): { ok: true; value: CompanyConfig } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: 'Expected object payload' };
  }

  const metricName = typeof value.metricName === 'string' ? value.metricName.trim() : '';
  if (!metricName) {
    return { ok: false, error: 'Metric name is required' };
  }

  const config = normalizeConfig(value);

  return { ok: true, value: config };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTemplate(value: unknown): value is CompanyTemplate {
  return value === 'research' || value === 'back-office' || value === 'creative';
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
