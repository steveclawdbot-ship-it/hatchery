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

  async generateJSON<T>(prompt: string, schema: ZodSchema<T>, opts: GenerateOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No explanation, no markdown fences.`;
    const raw = await this.generate(jsonPrompt, opts);
    const json = extractJSON(raw);
    return schema.parse(JSON.parse(json));
  }
}
