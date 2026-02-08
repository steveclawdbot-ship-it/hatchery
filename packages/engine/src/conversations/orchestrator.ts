import { DBClient } from '../db/client.js';
import { DEFAULT_FORMATS, ConversationFormat } from './formats.js';
import { SpeakerSelector, SpeakerCandidate } from './speaker-selector.js';
import { distillMemories } from './memory-distiller.js';
import { MemoryStore } from '../memory/store.js';
import { RelationshipTracker } from '../relationships/tracker.js';

interface Turn {
  speaker: string;
  dialogue: string;
  turn: number;
}

interface AgentInfo {
  id: string;
  displayName: string;
  tone: string;
  systemDirective: string;
  quirk: string;
}

export class ConversationOrchestrator {
  private db: DBClient;
  private llmGenerate: (prompt: string, opts: { tier: string; system?: string; temperature?: number }) => Promise<string>;
  private memory: MemoryStore;
  private relationships: RelationshipTracker;
  private speakerSelector: SpeakerSelector;

  constructor(
    db: DBClient,
    llmGenerate: (prompt: string, opts: { tier: string; system?: string; temperature?: number }) => Promise<string>,
  ) {
    this.db = db;
    this.llmGenerate = llmGenerate;
    this.memory = new MemoryStore(db);
    this.relationships = new RelationshipTracker(db);
    this.speakerSelector = new SpeakerSelector(this.relationships);
  }

  async startConversation(
    formatId: string,
    topic?: string,
    participantIds?: string[],
  ): Promise<string> {
    const format = DEFAULT_FORMATS[formatId];
    if (!format) throw new Error(`Unknown conversation format: ${formatId}`);

    // Load agents
    const agents = await this.loadAgents();
    const participants = participantIds
      ? agents.filter((a) => participantIds.includes(a.id))
      : this.selectParticipants(agents, format);

    // Generate topic if not provided
    const conversationTopic = topic ?? await this.generateTopic(format, participants);

    // Create conversation record
    const { data: conv } = await this.db
      .from('ops_conversations')
      .insert({
        format: formatId,
        topic: conversationTopic,
        participants: participants.map((p) => p.id),
      })
      .select('id')
      .single();

    const conversationId = conv!.id;

    // Run conversation turns
    const turns = await this.runTurns(format, participants, conversationTopic);

    // Save turns
    await this.db
      .from('ops_conversations')
      .update({ turns, completed_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Emit event for each turn (real-time feed)
    for (const turn of turns) {
      await this.db.from('ops_events').insert({
        agent_id: turn.speaker,
        kind: 'conversation.turn',
        title: `${turn.speaker} said something`,
        summary: turn.dialogue,
        payload: { conversationId, format: formatId, turn: turn.turn },
        visibility: 'public',
      });
    }

    // Distill memories
    const distilled = await distillMemories(
      this.llmGenerate,
      turns,
      formatId,
      participants.map((p) => p.id),
    );

    // Save memories
    for (const mem of distilled.memories) {
      await this.memory.create(mem);
    }

    // Apply relationship drift
    for (const drift of distilled.pairwise_drift) {
      await this.relationships.applyDrift(
        drift.agent_a,
        drift.agent_b,
        drift.drift,
        drift.reason,
      );
    }

    // Save action items as proposals
    if (format.extractActionItems && distilled.action_items.length > 0) {
      for (const item of distilled.action_items) {
        await this.db.from('ops_proposals').insert({
          agent_id: item.agent_id,
          title: item.title,
          proposed_steps: [{ kind: item.step_kind, description: item.title }],
          source: 'reaction',
          source_trace_id: `conversation:${conversationId}`,
        });
      }
    }

    // Mark memories as extracted
    await this.db
      .from('ops_conversations')
      .update({
        memories_extracted: true,
        action_items: distilled.action_items,
      })
      .eq('id', conversationId);

    // Emit completion event
    await this.db.from('ops_events').insert({
      agent_id: 'system',
      kind: 'conversation.completed',
      title: `${format.displayName} completed`,
      summary: `${turns.length} turns, ${distilled.memories.length} memories extracted`,
      payload: {
        conversationId,
        format: formatId,
        topic: conversationTopic,
        turnCount: turns.length,
        memoriesExtracted: distilled.memories.length,
      },
      visibility: 'public',
    });

    return conversationId;
  }

  private async runTurns(
    format: ConversationFormat,
    participants: AgentInfo[],
    topic: string,
  ): Promise<Turn[]> {
    const turns: Turn[] = [];
    const speakCounts = new Map<string, number>();
    participants.forEach((p) => speakCounts.set(p.id, 0));

    const numTurns = format.minTurns +
      Math.floor(Math.random() * (format.maxTurns - format.minTurns + 1));

    // Preload affinities
    const affinities = new Map<string, number>();
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const aff = await this.relationships.getAffinity(
          participants[i].id,
          participants[j].id,
        );
        affinities.set(`${participants[i].id}:${participants[j].id}`, aff);
      }
    }

    for (let turn = 0; turn < numTurns; turn++) {
      // Select speaker
      const candidates: SpeakerCandidate[] = participants.map((p) => ({
        id: p.id,
        speakCount: speakCounts.get(p.id) ?? 0,
      }));

      const lastSpeaker = turns.length > 0 ? turns[turns.length - 1].speaker : null;

      let speakerId: string;
      if (turn === 0) {
        // First speaker: random from initiators
        speakerId = participants[Math.floor(Math.random() * participants.length)].id;
      } else {
        speakerId = await this.speakerSelector.selectNextSpeaker(
          candidates,
          lastSpeaker,
          affinities,
        );
      }

      const speaker = participants.find((p) => p.id === speakerId)!;

      // Build conversation history
      const history = turns
        .map((t) => `${t.speaker}: ${t.dialogue}`)
        .join('\n');

      // Generate dialogue
      const system = `You are ${speaker.displayName}. ${speaker.systemDirective} Your communication style: ${speaker.tone}. Quirk: ${speaker.quirk}. You are in a ${format.displayName}. Keep responses under 120 characters. Be authentic to your personality.`;

      const prompt = turn === 0
        ? `Start a ${format.displayName} about: ${topic}\nSay something to kick it off.`
        : `Topic: ${topic}\n\nConversation so far:\n${history}\n\nIt's your turn to respond. Stay in character. Be concise.`;

      let dialogue = await this.llmGenerate(prompt, {
        tier: 'cheap',
        system,
        temperature: format.temperature,
      });

      // Cap at 120 chars
      if (dialogue.length > 120) {
        dialogue = dialogue.slice(0, 117) + '...';
      }

      // Clean up any quotes or role prefixes
      dialogue = dialogue.replace(/^["']|["']$/g, '').replace(/^[\w]+:\s*/, '');

      turns.push({ speaker: speakerId, dialogue, turn });
      speakCounts.set(speakerId, (speakCounts.get(speakerId) ?? 0) + 1);
    }

    return turns;
  }

  private async loadAgents(): Promise<AgentInfo[]> {
    // Load from a policies entry or a dedicated config
    const { data } = await this.db
      .from('ops_policies')
      .select('value')
      .eq('key', 'agent_configs')
      .single();

    if (data?.value?.agents) return data.value.agents;

    // Fallback: empty list
    return [];
  }

  private selectParticipants(agents: AgentInfo[], format: ConversationFormat): AgentInfo[] {
    const count = format.minParticipants +
      Math.floor(Math.random() * (format.maxParticipants - format.minParticipants + 1));

    // Shuffle and take
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  private async generateTopic(format: ConversationFormat, participants: AgentInfo[]): Promise<string> {
    const names = participants.map((p) => p.displayName).join(', ');
    const raw = await this.llmGenerate(
      `Generate a brief topic (under 60 chars) for a ${format.displayName} between ${names}. The topic should be relevant to an AI startup team. Just output the topic, nothing else.`,
      { tier: 'cheap' },
    );
    return raw.trim().replace(/^["']|["']$/g, '');
  }
}
