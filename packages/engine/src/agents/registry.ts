import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AgentConfig {
  id: string;
  displayName: string;
  role: string;
  tone: string;
  systemDirective: string;
  quirk: string;
  canInitiate: boolean;
  cooldownHours: number;
}

export class AgentRegistry {
  private agents: Map<string, AgentConfig> = new Map();

  loadFromFile(configPath: string): void {
    const filePath = join(configPath, 'agents.json');
    if (!existsSync(filePath)) {
      throw new Error(`Agent config not found: ${filePath}`);
    }

    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    for (const agent of raw.agents) {
      this.agents.set(agent.id, agent);
    }
  }

  loadFromArray(agents: AgentConfig[]): void {
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
    }
  }

  get(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }

  getAll(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  getInitiators(): AgentConfig[] {
    return this.getAll().filter((a) => a.canInitiate);
  }
}
