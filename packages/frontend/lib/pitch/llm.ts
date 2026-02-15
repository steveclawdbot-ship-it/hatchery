import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type PitchProvider = 'anthropic' | 'openai';

const DEFAULT_PROVIDER: PitchProvider = 'anthropic';

const MODELS: Record<PitchProvider, { chat: string; synthesis: string; generation: string }> = {
  anthropic: {
    chat: 'claude-sonnet-4-20250514',
    synthesis: 'claude-sonnet-4-20250514',
    generation: 'claude-sonnet-4-20250514',
  },
  openai: {
    chat: 'gpt-4o',
    synthesis: 'gpt-4o',
    generation: 'gpt-4o',
  },
};

interface ProviderContext {
  provider: PitchProvider;
  apiKey: string;
}

interface CompletionRequest {
  mode: 'chat' | 'synthesis' | 'generation';
  system?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
}

export function normalizePitchProvider(value: unknown): PitchProvider | null {
  if (value === 'anthropic' || value === 'openai') {
    return value;
  }
  return null;
}

export function getPitchProviderOrDefault(value: unknown): PitchProvider {
  return normalizePitchProvider(value) ?? DEFAULT_PROVIDER;
}

export function getProviderContext(provider: PitchProvider): ProviderContext | null {
  const apiKey = provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return { provider, apiKey };
}

export function getMissingProviderKeyError(provider: PitchProvider): string {
  return provider === 'anthropic'
    ? 'ANTHROPIC_API_KEY not configured'
    : 'OPENAI_API_KEY not configured';
}

export async function* streamPitchText(
  context: ProviderContext,
  request: CompletionRequest
): AsyncGenerator<string> {
  const model = MODELS[context.provider][request.mode];

  if (context.provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: context.apiKey });
    const streamResponse = await anthropic.messages.stream({
      model,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });

    for await (const event of streamResponse) {
      if (event.type !== 'content_block_delta') continue;
      const delta = event.delta as { type: string; text?: string };
      if (delta.type === 'text_delta' && delta.text) {
        yield delta.text;
      }
    }
    return;
  }

  const openai = new OpenAI({ apiKey: context.apiKey });
  const streamResponse = await openai.chat.completions.create({
    model,
    stream: true,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    messages: [
      ...(request.system ? [{ role: 'system', content: request.system } as const] : []),
      { role: 'user', content: request.prompt },
    ],
  });

  for await (const chunk of streamResponse) {
    const text = chunk.choices[0]?.delta?.content;
    if (typeof text === 'string' && text) {
      yield text;
    }
  }
}

export async function generatePitchText(
  context: ProviderContext,
  request: CompletionRequest
): Promise<string> {
  const model = MODELS[context.provider][request.mode];

  if (context.provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: context.apiKey });
    const response = await anthropic.messages.create({
      model,
      system: request.system,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: [{ role: 'user', content: request.prompt }],
    });

    return response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
  }

  const openai = new OpenAI({ apiKey: context.apiKey });
  const response = await openai.chat.completions.create({
    model,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    messages: [
      ...(request.system ? [{ role: 'system', content: request.system } as const] : []),
      { role: 'user', content: request.prompt },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
