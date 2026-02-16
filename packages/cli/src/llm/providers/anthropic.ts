import Anthropic from '@anthropic-ai/sdk';
import { ZodSchema } from 'zod';
import { LLMProvider, GenerateOptions, getModelForTier, extractJSON } from '../provider.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    const model = getModelForTier('anthropic', opts.tier);
    const response = await this.client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.system ?? '',
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    return block.text;
  }

  async *generateStream(prompt: string, opts: GenerateOptions): AsyncGenerator<string> {
    const model = getModelForTier('anthropic', opts.tier);
    const stream = await this.client.messages.stream({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.system ?? '',
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue;
      const delta = event.delta as { type: string; text?: string };
      if (delta.type === 'text_delta' && delta.text) {
        yield delta.text;
      }
    }
  }

  async generateJSON<T>(prompt: string, schema: ZodSchema<T>, opts: GenerateOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No explanation, no markdown fences.`;
    const raw = await this.generate(jsonPrompt, opts);
    const json = extractJSON(raw);
    return schema.parse(JSON.parse(json));
  }
}
