import { DBClient } from '../../db/client.js';
import { DiscordClient } from './client.js';

/**
 * Send Discord notifications for key events.
 * Called from heartbeat or event listeners.
 */
export class DiscordNotifier {
  private client: DiscordClient;
  private db: DBClient;

  constructor(db: DBClient, config: { botToken: string; channelId: string }) {
    this.db = db;
    this.client = new DiscordClient(config);
  }

  async notifyMissionCompleted(missionId: string): Promise<void> {
    const { data: mission } = await this.db
      .from('ops_missions')
      .select('title, status, created_by, created_at, completed_at')
      .eq('id', missionId)
      .single();

    if (!mission) return;

    const icon = mission.status === 'succeeded' ? '✅' : '❌';
    const duration = mission.completed_at
      ? this.formatDuration(new Date(mission.created_at), new Date(mission.completed_at))
      : 'unknown';

    await this.client.sendEmbed(
      `${icon} Mission ${mission.status}: ${mission.title}`,
      `Proposed by **${mission.created_by}** | Duration: ${duration}`,
      [],
      mission.status === 'succeeded' ? 0x57F287 : 0xED4245,
    );
  }

  async notifyConversationCompleted(conversationId: string): Promise<void> {
    const { data: conv } = await this.db
      .from('ops_conversations')
      .select('format, topic, participants, turns')
      .eq('id', conversationId)
      .single();

    if (!conv) return;

    const turnCount = (conv.turns as unknown[])?.length ?? 0;
    const participants = (conv.participants as string[]).join(', ');

    await this.client.sendMessage(
      `💬 **${conv.format}** completed: "${conv.topic}"\nParticipants: ${participants} | ${turnCount} turns`,
    );
  }

  async notifyAlert(title: string, details: string): Promise<void> {
    await this.client.sendEmbed(
      `⚠️ ${title}`,
      details,
      [],
      0xFEE75C,
    );
  }

  async postConversationTranscript(conversationId: string, transcriptChannelId: string): Promise<void> {
    const { data: conv } = await this.db
      .from('ops_conversations')
      .select('format, topic, turns')
      .eq('id', conversationId)
      .single();

    if (!conv?.turns) return;

    const turns = conv.turns as Array<{ speaker: string; dialogue: string }>;
    const lines = turns.map((t) => `**${t.speaker}:** ${t.dialogue}`);
    const transcript = `## ${conv.format}: ${conv.topic}\n\n${lines.join('\n')}`;

    // Split into 2000-char chunks (Discord message limit)
    const chunks = splitIntoChunks(transcript, 2000);
    for (const chunk of chunks) {
      await this.client.sendMessage(chunk, transcriptChannelId);
    }
  }

  private formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    const splitAt = remaining.lastIndexOf('\n', maxLength);
    const cut = splitAt > 0 ? splitAt : maxLength;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return chunks;
}
