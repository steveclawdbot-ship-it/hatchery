import { ZodSchema } from 'zod';
import { LLMProvider, GenerateOptions, getModelForTier, extractJSON } from '../provider.js';

export class GoogleProvider implements LLMProvider {
  name = 'google';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    const model = getModelForTier('google', opts.tier);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 4096,
      },
    };

    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
    return data.candidates[0]?.content?.parts[0]?.text ?? '';
  }

  async generateJSON<T>(prompt: string, schema: ZodSchema<T>, opts: GenerateOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No explanation, no markdown fences.`;
    const raw = await this.generate(jsonPrompt, opts);
    const json = extractJSON(raw);
    return schema.parse(JSON.parse(json));
  }
}
