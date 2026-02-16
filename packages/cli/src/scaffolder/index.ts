import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { WizardResult } from '../wizard/index.js';
import { renderTemplate } from './template-engine.js';

export interface ScaffoldOptions {
  name: string;
  outputDir: string;
  provider: string;
}

export function scaffoldProject(
  result: WizardResult,
  options: ScaffoldOptions,
): string {
  const projectDir = join(options.outputDir, options.name);

  console.log('');
  console.log(chalk.bold.yellow('═══ SCAFFOLDING ═══'));
  console.log(chalk.dim(`  Output: ${projectDir}`));
  console.log('');

  // Create directory structure
  const dirs = [
    '',
    'config',
    'workers',
    'migrations',
    'scripts',
    'logs',
  ];

  for (const dir of dirs) {
    const fullPath = join(projectDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  // Write config files
  for (const [filename, content] of Object.entries(result.configs)) {
    const filePath = join(projectDir, 'config', filename);
    if (typeof content === 'string') {
      writeFileSync(filePath, content, 'utf-8');
    } else {
      writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    }
    console.log(chalk.dim(`  ✓ config/${filename}`));
  }

  // Write STRATEGY.md
  writeFileSync(join(projectDir, 'STRATEGY.md'), result.strategy, 'utf-8');
  console.log(chalk.dim('  ✓ STRATEGY.md'));

  // Write .env.example
  const envVars = collectRequiredEnvVars(result, options.provider);
  const envContent = envVars
    .map((v) => `${v.key}=${v.example}`)
    .join('\n');
  writeFileSync(join(projectDir, '.env.example'), envContent + '\n', 'utf-8');
  writeFileSync(join(projectDir, '.env'), envContent + '\n', 'utf-8');
  console.log(chalk.dim('  ✓ .env.example'));

  // Write .gitignore
  writeFileSync(
    join(projectDir, '.gitignore'),
    ['.env', 'node_modules/', 'logs/', '*.log', '.DS_Store', 'dist/'].join('\n') + '\n',
    'utf-8',
  );
  console.log(chalk.dim('  ✓ .gitignore'));

  // Write package.json
  const pkgJson = {
    name: options.name,
    version: '0.1.0',
    private: true,
    type: 'module',
    description: `AI-agent company: ${options.name} (created by Hatchery)`,
    scripts: {
      heartbeat: 'node scripts/heartbeat.js',
      'worker:start': 'node scripts/worker.js',
      seed: 'node scripts/seed.js',
    },
    dependencies: {
      '@hatchery/engine': '^0.1.0',
      '@supabase/supabase-js': '^2.49.0',
      dotenv: '^16.4.0',
    },
  };
  writeFileSync(join(projectDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n', 'utf-8');
  console.log(chalk.dim('  ✓ package.json'));

  // Write runtime scripts referenced by package.json.
  writeRuntimeScripts(projectDir);
  console.log(chalk.dim('  ✓ scripts/heartbeat.js, scripts/worker.js, scripts/seed.js'));

  // Write docker-compose.yml
  const dockerCompose = renderTemplate(DOCKER_COMPOSE_TEMPLATE, {
    name: options.name,
    workerKinds: result.workerConfig.stepKinds.map((sk) => sk.kind),
  });
  writeFileSync(join(projectDir, 'docker-compose.yml'), dockerCompose, 'utf-8');
  console.log(chalk.dim('  ✓ docker-compose.yml'));

  // Write systemd service templates
  writeSystemdTemplates(projectDir, options.name);
  console.log(chalk.dim('  ✓ systemd/ templates'));

  // Write database migrations
  writeMigrations(projectDir);
  console.log(chalk.dim('  ✓ migrations/ (6 files)'));

  // Write worker stubs
  for (const sk of result.workerConfig.stepKinds) {
    const workerContent = renderTemplate(WORKER_STUB_TEMPLATE, {
      kind: sk.kind,
      displayName: sk.displayName,
      description: sk.description,
    });
    writeFileSync(join(projectDir, 'workers', `${sk.kind}.ts`), workerContent, 'utf-8');
  }
  console.log(chalk.dim(`  ✓ workers/ (${result.workerConfig.stepKinds.length} stubs)`));

  // Write pitch transcript for reference
  const transcriptMd = result.transcript.rounds
    .map((r) => `## Round ${r.round}: ${r.focus}\n\n**Founder:** ${r.founderInput}\n\n**VC:** ${r.vcResponse}`)
    .join('\n\n---\n\n');
  writeFileSync(
    join(projectDir, 'PITCH-TRANSCRIPT.md'),
    `# Pitch Meeting Transcript\n\n${transcriptMd}\n`,
    'utf-8',
  );
  console.log(chalk.dim('  ✓ PITCH-TRANSCRIPT.md'));

  // Write revised pitch
  writeFileSync(
    join(projectDir, 'REVISED-PITCH.md'),
    `# Revised Pitch\n\n${result.revisedPitch.raw}\n`,
    'utf-8',
  );
  console.log(chalk.dim('  ✓ REVISED-PITCH.md'));

  console.log('');
  console.log(chalk.bold.green(`  Project scaffolded at ${projectDir}`));
  console.log('');

  return projectDir;
}

function collectRequiredEnvVars(result: WizardResult, provider: string) {
  const vars = [
    { key: 'SUPABASE_URL', example: 'https://your-project.supabase.co' },
    { key: 'SUPABASE_SERVICE_KEY', example: 'your-service-role-key' },
    { key: 'LLM_PROVIDER', example: provider },
  ];

  const keyMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    kimi: 'KIMI_API_KEY',
  };

  vars.push({ key: keyMap[provider] ?? 'LLM_API_KEY', example: 'your-api-key' });

  // Collect required config from step kinds
  const seenKeys = new Set(vars.map((v) => v.key));
  for (const sk of result.workerConfig.stepKinds) {
    for (const rc of sk.requiredConfig) {
      if (!seenKeys.has(rc)) {
        seenKeys.add(rc);
        vars.push({ key: rc, example: '' });
      }
    }
  }

  return vars;
}

function writeSystemdTemplates(projectDir: string, name: string) {
  const serviceDir = join(projectDir, 'systemd');
  mkdirSync(serviceDir, { recursive: true });

  writeFileSync(
    join(serviceDir, `${name}-heartbeat.service`),
    `[Unit]
Description=${name} Heartbeat
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node ${projectDir}/scripts/heartbeat.js
WorkingDirectory=${projectDir}
EnvironmentFile=${projectDir}/.env
Restart=always
RestartSec=300

[Install]
WantedBy=multi-user.target
`,
    'utf-8',
  );

  writeFileSync(
    join(serviceDir, `${name}-worker@.service`),
    `[Unit]
Description=${name} Worker (%i)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node ${projectDir}/scripts/worker.js %i
WorkingDirectory=${projectDir}
EnvironmentFile=${projectDir}/.env
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
`,
    'utf-8',
  );
}

function writeMigrations(projectDir: string) {
  const migDir = join(projectDir, 'migrations');

  writeFileSync(join(migDir, '001_core_schema.sql'), MIGRATION_001, 'utf-8');
  writeFileSync(join(migDir, '002_memory_schema.sql'), MIGRATION_002, 'utf-8');
  writeFileSync(join(migDir, '003_conversation.sql'), MIGRATION_003, 'utf-8');
  writeFileSync(join(migDir, '004_config.sql'), MIGRATION_004, 'utf-8');
  writeFileSync(join(migDir, '005_audit.sql'), MIGRATION_005, 'utf-8');
  writeFileSync(join(migDir, '006_functions.sql'), MIGRATION_006, 'utf-8');
}

function writeRuntimeScripts(projectDir: string) {
  writeFileSync(join(projectDir, 'scripts', 'heartbeat.js'), HEARTBEAT_SCRIPT, 'utf-8');
  writeFileSync(join(projectDir, 'scripts', 'worker.js'), WORKER_SCRIPT, 'utf-8');
  writeFileSync(join(projectDir, 'scripts', 'seed.js'), SEED_SCRIPT, 'utf-8');
}

// ─── Templates ───────────────────────────────────────────────

const DOCKER_COMPOSE_TEMPLATE = `version: '3.8'

services:
  heartbeat:
    build: .
    command: node scripts/heartbeat.js
    env_file: .env
    restart: always

{{#each workerKinds}}
  worker-{{this}}:
    build: .
    command: node scripts/worker.js {{this}}
    env_file: .env
    restart: on-failure
{{/each}}
`;

const WORKER_STUB_TEMPLATE = `/**
 * Worker: {{displayName}}
 * Kind: {{kind}}
 * {{description}}
 *
 * Generated by Hatchery. Customize the execute() function.
 */

import type { Step, WorkerContext, StepResult } from '@hatchery/engine';

export async function execute(step: Step, context: WorkerContext): Promise<StepResult> {
  const { llm, db, logger } = context;

  // TODO: Implement {{kind}} logic
  logger.info(\`Executing {{kind}}: \${step.payload?.description ?? 'no description'}\`);

  // Example: Use LLM for generation
  // const result = await llm.generate('...', { tier: 'mid' });

  return {
    success: true,
    output: {
      message: '{{displayName}} completed',
    },
  };
}
`;

const HEARTBEAT_SCRIPT = `#!/usr/bin/env node
import 'dotenv/config';
import { createDBClient, Heartbeat } from '@hatchery/engine';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Placeholder generator keeps runtime script callable until provider wiring is completed.
async function llmGenerate() {
  return 'LLM placeholder: configure a provider before production use.';
}

const db = createDBClient(url, key);
const heartbeat = new Heartbeat({ db, llmGenerate });

heartbeat.tick()
  .then((result) => {
    console.log('Heartbeat completed:', result);
  })
  .catch((err) => {
    console.error('Heartbeat failed:', err);
    process.exitCode = 1;
  });
`;

const WORKER_SCRIPT = `#!/usr/bin/env node
import 'dotenv/config';

const kind = process.argv[2];
if (!kind) {
  console.error('Usage: node scripts/worker.js <step-kind>');
  process.exit(1);
}

console.error('Worker runtime bootstrap is scaffolded but not fully generated.');
console.error('Implement worker loading/execution for step kind:', kind);
process.exitCode = 1;
`;

const SEED_SCRIPT = `#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const seedPath = resolve(process.cwd(), 'config', 'seed.sql');
if (!existsSync(seedPath)) {
  console.error('Missing seed.sql at config/seed.sql');
  process.exit(1);
}

const sql = readFileSync(seedPath, 'utf-8');
console.log('seed.sql loaded.');
console.log('Execute this SQL manually in Supabase SQL editor or your migration pipeline.');
console.log('---');
console.log(sql.slice(0, 500) + (sql.length > 500 ? '\\n... (truncated)' : ''));
`;

// ─── SQL Migrations ───────────────────────────────────────────

const MIGRATION_001 = `-- 001: Core execution schema
-- proposals → missions → steps → events

CREATE TABLE IF NOT EXISTS ops_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  proposed_steps JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL CHECK (source IN ('manual', 'trigger', 'reaction', 'initiative')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  source_trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ops_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES ops_proposals(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'running', 'succeeded', 'failed')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ops_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES ops_missions(id),
  step_number INT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  payload JSONB DEFAULT '{}',
  output JSONB,
  reserved_by TEXT,
  reserved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ops_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  payload JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposals_agent ON ops_proposals(agent_id);
CREATE INDEX idx_proposals_status ON ops_proposals(status);
CREATE INDEX idx_missions_status ON ops_missions(status);
CREATE INDEX idx_steps_status ON ops_steps(status);
CREATE INDEX idx_steps_mission ON ops_steps(mission_id);
CREATE INDEX idx_steps_kind ON ops_steps(kind);
CREATE INDEX idx_events_kind ON ops_events(kind);
CREATE INDEX idx_events_agent ON ops_events(agent_id);
CREATE INDEX idx_events_created ON ops_events(created_at DESC);
`;

const MIGRATION_002 = `-- 002: Memory and relationship schema

CREATE TABLE IF NOT EXISTS ops_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('insight', 'pattern', 'strategy', 'preference', 'lesson')),
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0.00 AND confidence <= 1.00),
  tags TEXT[] DEFAULT '{}',
  source_trace_id TEXT,
  superseded_by UUID REFERENCES ops_memories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_a TEXT NOT NULL,
  agent_b TEXT NOT NULL,
  affinity NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (affinity >= 0.10 AND affinity <= 0.95),
  total_interactions INT NOT NULL DEFAULT 0,
  positive_interactions INT NOT NULL DEFAULT 0,
  negative_interactions INT NOT NULL DEFAULT 0,
  drift_log JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_a, agent_b),
  CHECK (agent_a < agent_b)
);

CREATE INDEX idx_memories_agent ON ops_memories(agent_id);
CREATE INDEX idx_memories_type ON ops_memories(type);
CREATE INDEX idx_memories_confidence ON ops_memories(confidence DESC);
CREATE INDEX idx_memories_tags ON ops_memories USING GIN(tags);
CREATE INDEX idx_relationships_agents ON ops_relationships(agent_a, agent_b);
`;

const MIGRATION_003 = `-- 003: Conversation and initiative schema

CREATE TABLE IF NOT EXISTS ops_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  topic TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  turns JSONB NOT NULL DEFAULT '[]',
  memories_extracted BOOLEAN NOT NULL DEFAULT FALSE,
  action_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ops_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'proposed', 'failed')),
  generated_proposal_id UUID REFERENCES ops_proposals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_format ON ops_conversations(format);
CREATE INDEX idx_conversations_created ON ops_conversations(created_at DESC);
CREATE INDEX idx_initiatives_agent ON ops_initiatives(agent_id);
CREATE INDEX idx_initiatives_status ON ops_initiatives(status);
`;

const MIGRATION_004 = `-- 004: Configuration schema

CREATE TABLE IF NOT EXISTS ops_policies (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_pattern TEXT NOT NULL,
  condition JSONB DEFAULT '{}',
  proposal_template JSONB NOT NULL,
  cooldown_minutes INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  fire_count INT NOT NULL DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  event_pattern TEXT NOT NULL,
  probability NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  cooldown_minutes INT NOT NULL DEFAULT 30,
  proposal_template JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops_step_registry (
  kind TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  worker_type TEXT NOT NULL,
  description TEXT NOT NULL,
  required_config TEXT[] DEFAULT '{}',
  cap_gate_policy_key TEXT REFERENCES ops_policies(key),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_triggers_active ON ops_triggers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_reactions_agent ON ops_reactions(agent_id);
`;

const MIGRATION_005 = `-- 005: Audit and views

CREATE TABLE IF NOT EXISTS ops_action_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  details JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_action_runs_action ON ops_action_runs(action);
CREATE INDEX idx_action_runs_started ON ops_action_runs(started_at DESC);

-- Active missions view
CREATE OR REPLACE VIEW active_missions AS
SELECT m.*, p.agent_id as proposer,
  (SELECT COUNT(*) FROM ops_steps s WHERE s.mission_id = m.id AND s.status = 'succeeded') as completed_steps,
  (SELECT COUNT(*) FROM ops_steps s WHERE s.mission_id = m.id) as total_steps
FROM ops_missions m
JOIN ops_proposals p ON m.proposal_id = p.id
WHERE m.status IN ('approved', 'running');

-- Agent activity view
CREATE OR REPLACE VIEW agent_activity AS
SELECT
  agent_id,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as events_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as events_7d,
  MAX(created_at) as last_active
FROM ops_events
GROUP BY agent_id;
`;

const MIGRATION_006 = `-- 006: Postgres functions for atomic operations

-- Atomic step claim (compare-and-swap)
CREATE OR REPLACE FUNCTION claim_step(
  p_step_id UUID,
  p_worker_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  UPDATE ops_steps
  SET status = 'running',
      reserved_by = p_worker_id,
      reserved_at = NOW()
  WHERE id = p_step_id
    AND status = 'queued'
    AND reserved_by IS NULL;

  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$ LANGUAGE plpgsql;

-- Complete step and potentially finalize mission
CREATE OR REPLACE FUNCTION complete_step(
  p_step_id UUID,
  p_status TEXT,
  p_output JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_mission_id UUID;
  v_all_done BOOLEAN;
  v_any_failed BOOLEAN;
BEGIN
  -- Update the step
  UPDATE ops_steps
  SET status = p_status,
      output = p_output,
      completed_at = NOW()
  WHERE id = p_step_id
  RETURNING mission_id INTO v_mission_id;

  -- Check if all steps in the mission are done
  SELECT
    NOT EXISTS(SELECT 1 FROM ops_steps WHERE mission_id = v_mission_id AND status IN ('queued', 'running')),
    EXISTS(SELECT 1 FROM ops_steps WHERE mission_id = v_mission_id AND status = 'failed')
  INTO v_all_done, v_any_failed;

  -- If all done, finalize the mission
  IF v_all_done THEN
    UPDATE ops_missions
    SET status = CASE WHEN v_any_failed THEN 'failed' ELSE 'succeeded' END,
        completed_at = NOW()
    WHERE id = v_mission_id;
  ELSIF p_status = 'running' THEN
    -- First step running → mark mission as running
    UPDATE ops_missions
    SET status = 'running'
    WHERE id = v_mission_id AND status = 'approved';
  END IF;

  RETURN v_mission_id;
END;
$$ LANGUAGE plpgsql;
`;
