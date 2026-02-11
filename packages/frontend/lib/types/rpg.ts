/**
 * RPG Types - TypeScript definitions for agent RPG system
 */

// Role Card - 6-layer behavior definition
export interface RoleCard {
  domain: string;
  inputs: string[];
  outputs: string[];
  definitionOfDone: string[];
  hardBans: string[];
  escalation: string[];
  metrics: string[];
}

// RPG Stats - 6 attributes
export interface RPGStats {
  VRL: { value: number; relevant: boolean }; // Viral
  SPD: { value: number; relevant: boolean }; // Speed
  RCH: { value: number; relevant: boolean }; // Reach
  TRU: { value: number; relevant: boolean }; // Trust
  WIS: { value: number; relevant: boolean }; // Wisdom
  CRE: { value: number; relevant: boolean }; // Creative
}

// RPG Class assignments
export type RPGClass = 
  | 'Commander' 
  | 'Sage' 
  | 'Ranger' 
  | 'Artisan' 
  | 'Bard' 
  | 'Oracle';

// Agent type to class mapping
export const AGENT_TYPE_TO_CLASS: Record<string, RPGClass> = {
  coordinator: 'Commander',
  researcher: 'Sage',
  scout: 'Ranger',
  creative: 'Artisan',
  social: 'Bard',
  observer: 'Oracle',
};

// Stat relevance by agent type
export const STAT_RELEVANCE: Record<string, Array<keyof RPGStats>> = {
  coordinator: ['TRU', 'SPD', 'WIS', 'CRE'],
  researcher: ['WIS', 'TRU', 'SPD', 'CRE'],
  scout: ['SPD', 'RCH', 'VRL', 'WIS'],
  creative: ['CRE', 'WIS', 'VRL', 'TRU'],
  social: ['VRL', 'RCH', 'SPD', 'CRE'],
  observer: ['WIS', 'TRU', 'SPD', 'RCH'],
};

// Voice directive for personality
export interface VoiceDirective {
  personality: string;
  rules: string[];
  conflictWith?: string[];
  modifiers: string[];
}

// Relationship between agents
export interface Relationship {
  agentA: string;
  agentB: string;
  affinity: number; // 0.10 to 0.95
  driftLog: Array<{
    timestamp: Date;
    drift: number;
    reason: string;
  }>;
}

// Agent with full RPG data
export interface AgentWithRPG {
  id: string;
  displayName: string;
  level: number;
  class: RPGClass;
  xp: {
    current: number;
    nextLevel: number;
  };
  stats: RPGStats;
  roleCard: RoleCard;
  voiceModifiers: string[];
  affinity: Array<{
    agentId: string;
    agentName: string;
    affinity: number;
  }>;
}

// Agent state for office visualization
export type AgentState = 
  | 'idle'
  | 'typing'
  | 'thinking'
  | 'researching'
  | 'chatting'
  | 'calling'
  | 'coffee'
  | 'celebrating'
  | 'stuck'
  | 'commuting';

// Visual agent for office
export interface VisualAgent {
  id: string;
  displayName: string;
  state: AgentState;
  x: number;
  y: number;
  deskId: number;
  level: number;
  class: RPGClass;
  currentTask?: string;
  thought?: string;
  lastActive: Date;
}
