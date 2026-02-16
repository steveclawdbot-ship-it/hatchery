import { ZodSchema } from 'zod';

export type Tier = 'cheap' | 'mid' | 'expensive';

export interface GenerateOptions {
  tier: Tier;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  name: string;
  generate(prompt: string, opts: GenerateOptions): Promise<string>;
  generateStream?(prompt: string, opts: GenerateOptions): AsyncGenerator<string>;
  generateJSON<T>(prompt: string, schema: ZodSchema<T>, opts: GenerateOptions): Promise<T>;
}

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'kimi';

export interface TierMap {
  cheap: string;
  mid: string;
  expensive: string;
}

const TIER_MAPS: Record<ProviderName, TierMap> = {
  anthropic: {
    cheap: 'claude-haiku-4-5-20251001',
    mid: 'claude-sonnet-4-5-20250929',
    expensive: 'claude-opus-4-6',
  },
  openai: {
    cheap: 'gpt-4o-mini',
    mid: 'gpt-4o',
    expensive: 'o1',
  },
  google: {
    cheap: 'gemini-2.0-flash',
    mid: 'gemini-2.0-pro',
    expensive: 'gemini-2.5-pro',
  },
  kimi: {
    cheap: 'moonshot-v1-8k',
    mid: 'moonshot-v1-32k',
    expensive: 'moonshot-v1-128k',
  },
};

export function getModelForTier(provider: ProviderName, tier: Tier): string {
  return TIER_MAPS[provider][tier];
}

export function getTierMap(provider: ProviderName): TierMap {
  return TIER_MAPS[provider];
}

export async function createProvider(name: ProviderName, apiKey: string): Promise<LLMProvider> {
  switch (name) {
    case 'anthropic': {
      const { AnthropicProvider } = await import('./providers/anthropic.js');
      return new AnthropicProvider(apiKey);
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./providers/openai.js');
      return new OpenAIProvider(apiKey);
    }
    case 'google': {
      const { GoogleProvider } = await import('./providers/google.js');
      return new GoogleProvider(apiKey);
    }
    case 'kimi': {
      const { KimiProvider } = await import('./providers/kimi.js');
      return new KimiProvider(apiKey);
    }
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/**
 * Parse a JSON block from LLM output, handling markdown fences.
 */
export function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = text.indexOf('{');
  const bracketStart = text.indexOf('[');
  if (braceStart === -1 && bracketStart === -1) {
    throw new Error('No JSON found in LLM response');
  }
  const start = braceStart === -1 ? bracketStart
    : bracketStart === -1 ? braceStart
    : Math.min(braceStart, bracketStart);
  const isArray = text[start] === '[';
  const closer = isArray ? ']' : '}';

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === text[start]) depth++;
    if (text[i] === closer) depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Unbalanced JSON in LLM response');
}
