import { ZodSchema } from 'zod';
import { LLMProvider, GenerateOptions, getModelForTier, extractJSON } from '../provider.js';

export class KimiProvider implements LLMProvider {
  name = 'kimi';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    const model = getModelForTier('kimi', opts.tier);
    const messages: Array<{ role: string; content: string }> = [];
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? '';
  }

  async generateJSON<T>(prompt: string, schema: ZodSchema<T>, opts: GenerateOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No explanation, no markdown fences.`;
    const raw = await this.generate(jsonPrompt, opts);
    const json = extractJSON(raw);
    return schema.parse(JSON.parse(json));
  }
}
