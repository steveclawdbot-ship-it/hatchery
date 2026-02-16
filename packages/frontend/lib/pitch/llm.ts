import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type PitchProvider = 'anthropic' | 'openai' | 'google' | 'kimi' | 'zai';
export interface PitchModelOption {
  id: string;
  displayName: string;
}

type CompletionMode = 'chat' | 'synthesis' | 'generation';

const DEFAULT_PROVIDER: PitchProvider = 'anthropic';
const ANTHROPIC_API_VERSION = '2023-06-01';
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const MAX_MODEL_ID_LENGTH = 160;

const MODELS: Record<PitchProvider, { chat: string; synthesis: string; generation: string }> = {
  anthropic: {
    chat: 'claude-sonnet-4-20250514',
    synthesis: 'claude-sonnet-4-20250514',
    generation: 'claude-sonnet-4-20250514',
  },
  openai: {
    chat: 'gpt-5.3',
    synthesis: 'gpt-5.3',
    generation: 'gpt-5.3',
  },
  google: {
    chat: 'gemini-2.5-pro',
    synthesis: 'gemini-2.5-pro',
    generation: 'gemini-2.5-pro',
  },
  kimi: {
    chat: 'moonshot-v1-128k',
    synthesis: 'moonshot-v1-128k',
    generation: 'moonshot-v1-128k',
  },
  zai: {
    chat: 'glm-4.5',
    synthesis: 'glm-4.5',
    generation: 'glm-4.5',
  },
};

const FALLBACK_MODEL_OPTIONS: Record<PitchProvider, PitchModelOption[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-1', displayName: 'Claude Opus 4.1' },
    { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-5.3', displayName: 'GPT-5.3' },
    { id: 'gpt-5.3-mini', displayName: 'GPT-5.3 Mini' },
    { id: 'o1', displayName: 'o1' },
  ],
  google: [
    { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
  ],
  kimi: [
    { id: 'moonshot-v1-128k', displayName: 'Moonshot v1 128K' },
    { id: 'moonshot-v1-32k', displayName: 'Moonshot v1 32K' },
    { id: 'moonshot-v1-8k', displayName: 'Moonshot v1 8K' },
  ],
  zai: [
    { id: 'glm-4.5', displayName: 'GLM-4.5' },
    { id: 'glm-4.5-air', displayName: 'GLM-4.5 Air' },
    { id: 'glm-4.5-flash', displayName: 'GLM-4.5 Flash' },
  ],
};

const PROVIDER_API_KEY_ENV: Record<PitchProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  kimi: 'KIMI_API_KEY',
  zai: 'ZAI_API_KEY',
};

interface ProviderContext {
  provider: PitchProvider;
  apiKey: string;
  baseURL?: string;
}

interface CompletionRequest {
  mode: CompletionMode;
  model?: string;
  system?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
}

export function normalizePitchProvider(value: unknown): PitchProvider | null {
  if (
    value === 'anthropic'
    || value === 'openai'
    || value === 'google'
    || value === 'kimi'
    || value === 'zai'
  ) {
    return value;
  }
  return null;
}

export function getPitchProviderOrDefault(value: unknown): PitchProvider {
  return normalizePitchProvider(value) ?? DEFAULT_PROVIDER;
}

export function normalizePitchModel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MODEL_ID_LENGTH) {
    return null;
  }
  return trimmed;
}

export function getPitchProviderApiKeyEnvVar(provider: PitchProvider): string {
  return PROVIDER_API_KEY_ENV[provider];
}

export function getFallbackPitchModels(provider: PitchProvider): PitchModelOption[] {
  return FALLBACK_MODEL_OPTIONS[provider].map((model) => ({ ...model }));
}

export function getProviderContext(provider: PitchProvider): ProviderContext | null {
  const apiKeyEnvVar = getPitchProviderApiKeyEnvVar(provider);
  const apiKey = process.env[apiKeyEnvVar];
  if (!apiKey) return null;

  const kimiBaseURL = process.env.KIMI_BASE_URL ?? process.env.KIMI_API_BASE_URL;
  const zaiBaseURL = process.env.ZAI_BASE_URL ?? process.env.ZAI_API_BASE_URL;

  if (provider === 'kimi') {
    return { provider, apiKey, baseURL: kimiBaseURL || 'https://api.moonshot.cn/v1' };
  }

  if (provider === 'zai') {
    return { provider, apiKey, baseURL: zaiBaseURL || 'https://api.z.ai/api/paas/v4' };
  }

  return { provider, apiKey };
}

export function getMissingProviderKeyError(provider: PitchProvider): string {
  return `${getPitchProviderApiKeyEnvVar(provider)} not configured`;
}

function resolveModel(provider: PitchProvider, request: CompletionRequest): string {
  const explicitModel = normalizePitchModel(request.model);
  if (explicitModel) {
    return explicitModel;
  }

  const providerKey = provider.toUpperCase();
  const modeKey = request.mode.toUpperCase();
  const modeOverride = normalizePitchModel(process.env[`PITCH_MODEL_${providerKey}_${modeKey}`]);
  const providerOverride = normalizePitchModel(process.env[`PITCH_MODEL_${providerKey}`]);
  return modeOverride || providerOverride || MODELS[provider][request.mode];
}

function createOpenAIClient(context: ProviderContext): OpenAI {
  if (context.baseURL) {
    return new OpenAI({ apiKey: context.apiKey, baseURL: context.baseURL });
  }
  return new OpenAI({ apiKey: context.apiKey });
}

async function generateGoogleText(
  apiKey: string,
  model: string,
  request: CompletionRequest
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: request.prompt }] }],
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
    },
  };

  if (request.system) {
    body.systemInstruction = { parts: [{ text: request.system }] };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('') ?? '';
}

async function listAnthropicModels(apiKey: string): Promise<PitchModelOption[]> {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    data?: Array<{ id?: string; display_name?: string; displayName?: string }>;
  };

  return (data.data ?? []).map((model) => ({
    id: typeof model.id === 'string' ? model.id : '',
    displayName:
      typeof model.display_name === 'string'
        ? model.display_name
        : typeof model.displayName === 'string'
          ? model.displayName
          : typeof model.id === 'string'
            ? model.id
            : '',
  }));
}

async function listGoogleModels(apiKey: string): Promise<PitchModelOption[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };

  const options: PitchModelOption[] = [];
  for (const model of data.models ?? []) {
    const methods = Array.isArray(model.supportedGenerationMethods)
      ? model.supportedGenerationMethods
      : [];
    if (!methods.includes('generateContent')) {
      continue;
    }

    const rawName = typeof model.name === 'string' ? model.name : '';
    const id = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName;
    if (!id) {
      continue;
    }

    options.push({
      id,
      displayName:
        typeof model.displayName === 'string' && model.displayName.trim()
          ? model.displayName.trim()
          : id,
    });
  }

  return options;
}

function buildOpenAICompatibleModelsUrl(baseURL?: string): string {
  const root = (baseURL ?? OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, '');
  return `${root}/models`;
}

async function listOpenAICompatibleModels(context: ProviderContext): Promise<PitchModelOption[]> {
  const response = await fetch(buildOpenAICompatibleModelsUrl(context.baseURL), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${context.apiKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Model list API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    data?: Array<{ id?: string }>;
  };

  return (data.data ?? []).map((model) => ({
    id: typeof model.id === 'string' ? model.id : '',
    displayName: typeof model.id === 'string' ? model.id : '',
  }));
}

function isLikelyChatModel(provider: PitchProvider, modelId: string): boolean {
  const id = modelId.toLowerCase();

  if (provider === 'openai') {
    if (
      id.startsWith('gpt-image-')
      || id.startsWith('text-embedding-')
      || id.startsWith('omni-moderation-')
      || id.startsWith('whisper-')
      || id.startsWith('tts-')
      || id.startsWith('dall-e-')
    ) {
      return false;
    }
    return id.startsWith('gpt-') || id.startsWith('chatgpt-') || /^o\d/.test(id);
  }

  if (provider === 'kimi') {
    return id.includes('moonshot') || id.includes('kimi');
  }

  if (provider === 'zai') {
    return id.includes('glm');
  }

  if (provider === 'google') {
    return id.includes('gemini');
  }

  return id.includes('claude');
}

function dedupeAndSortModels(models: PitchModelOption[]): PitchModelOption[] {
  const deduped = new Map<string, PitchModelOption>();

  for (const model of models) {
    const id = normalizePitchModel(model.id);
    if (!id || deduped.has(id)) {
      continue;
    }

    const displayName =
      typeof model.displayName === 'string' && model.displayName.trim() ? model.displayName.trim() : id;
    deduped.set(id, { id, displayName });
  }

  return Array.from(deduped.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export async function listPitchProviderModels(provider: PitchProvider): Promise<PitchModelOption[]> {
  const context = getProviderContext(provider);
  if (!context) {
    throw new Error(getMissingProviderKeyError(provider));
  }

  let models: PitchModelOption[];
  if (provider === 'anthropic') {
    models = await listAnthropicModels(context.apiKey);
  } else if (provider === 'google') {
    models = await listGoogleModels(context.apiKey);
  } else {
    models = await listOpenAICompatibleModels(context);
  }

  const likelyChatModels = models.filter((model) => isLikelyChatModel(provider, model.id));
  const candidateModels = likelyChatModels.length > 0 ? likelyChatModels : models;
  const normalized = dedupeAndSortModels(candidateModels);

  if (normalized.length === 0) {
    return getFallbackPitchModels(provider);
  }

  return normalized;
}

export async function* streamPitchText(
  context: ProviderContext,
  request: CompletionRequest
): AsyncGenerator<string> {
  const model = resolveModel(context.provider, request);

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

  if (context.provider === 'google') {
    const text = await generateGoogleText(context.apiKey, model, request);
    if (text) {
      yield text;
    }
    return;
  }

  const openai = createOpenAIClient(context);
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
  const model = resolveModel(context.provider, request);

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

  if (context.provider === 'google') {
    return generateGoogleText(context.apiKey, model, request);
  }

  const openai = createOpenAIClient(context);
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
