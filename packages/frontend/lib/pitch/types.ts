// Pitch session types for web interface

export interface Round {
  round: number;
  focus: string;
  founderInput: string;
  vcResponse: string;
}

export interface PitchSession {
  id: string;
  startup_name: string | null;
  provider: string;
  status: 'in_progress' | 'synthesis' | 'approval' | 'generation' | 'completed';
  current_round: number;
  rounds: Round[];
  revised_pitch: string | null;
  revised_pitch_approved: boolean;
  agent_config: AgentConfig | null;
  worker_config: WorkerConfig | null;
  strategy: string | null;
  configs: GeneratedConfigs | null;
  created_at: string;
  updated_at: string;
}

// Agent configuration types (matching CLI schemas)
export interface Agent {
  id: string;
  displayName: string;
  role: string;
  tone: string;
  systemDirective: string;
  quirk: string;
  canInitiate: boolean;
  cooldownHours: number;
}

export interface Affinity {
  agentA: string;
  agentB: string;
  affinity: number;
  reason: string;
}

export interface ScheduleEntry {
  hour: number;
  format: string;
  probability: number;
  participants: string;
}

export interface AgentConfig {
  agents: Agent[];
  initialAffinities: Affinity[];
  conversationFormats: string[];
  dailySchedule: ScheduleEntry[];
}

// Worker configuration types
export interface StepKind {
  kind: string;
  displayName: string;
  workerType: string;
  description: string;
  requiredConfig: string[];
  capGatePolicyKey?: string;
}

export interface Trigger {
  name: string;
  eventPattern: string;
  condition?: Record<string, unknown>;
  proposalTemplate: {
    title: string;
    steps: Array<{ kind: string; description: string }>;
  };
  cooldownMinutes: number;
  isActive: boolean;
}

export interface Policies {
  auto_approve: {
    enabled: boolean;
    allowed_step_kinds: string[];
  };
  daily_quotas: Record<string, unknown>;
  memory_influence: {
    enabled: boolean;
    probability: number;
  };
}

export interface WorkerConfig {
  stepKinds: StepKind[];
  triggers: Trigger[];
  policies: Policies;
  capGates: Record<string, { limit: number; period: string }>;
}

// Generated configuration files
export interface GeneratedConfigs {
  agents_json: string;
  policies_json: string;
  seed_sql: string;
  env_example: string;
  strategy_md: string;
}

// Message types for chat UI
export interface ChatMessage {
  id: string;
  role: 'founder' | 'vc';
  content: string;
  round?: number;
  focus?: string;
  timestamp: string;
  isStreaming?: boolean;
}
