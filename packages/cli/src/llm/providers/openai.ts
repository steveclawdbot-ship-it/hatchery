import OpenAI from 'openai';
import { ZodSchema } from 'zod';
import { LLMProvider, GenerateOptions, getModelForTier, extractJSON } from '../provider.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    const model = getModelForTier('openai', opts.tier);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      messages,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async generateJSON<T>(prompt: string, schema: ZodSchema<T>, opts: GenerateOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No explanation, no markdown fences.`;
    const raw = await this.generate(jsonPrompt, opts);
    const json = extractJSON(raw);
    return schema.parse(JSON.parse(json));
  }
}
