export interface DiscordConfig {
  botToken: string;
  channelId: string;
  webhookUrl?: string;
}

export class DiscordClient {
  private config: DiscordConfig;

  constructor(config: DiscordConfig) {
    this.config = config;
  }

  async sendMessage(content: string, channelId?: string): Promise<string> {
    const targetChannel = channelId ?? this.config.channelId;

    const response = await fetch(
      `https://discord.com/api/v10/channels/${targetChannel}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${this.config.botToken}`,
        },
        body: JSON.stringify({ content }),
      },
    );

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }

  async sendWebhook(content: string, username?: string): Promise<void> {
    if (!this.config.webhookUrl) {
      throw new Error('No webhook URL configured');
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username: username ?? 'Hatchery',
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook error: ${response.status}`);
    }
  }

  async sendEmbed(
    title: string,
    description: string,
    fields: Array<{ name: string; value: string; inline?: boolean }>,
    color?: number,
  ): Promise<string> {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${this.config.channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${this.config.botToken}`,
        },
        body: JSON.stringify({
          embeds: [{
            title,
            description,
            fields,
            color: color ?? 0x5865F2,
            timestamp: new Date().toISOString(),
          }],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  }
}
