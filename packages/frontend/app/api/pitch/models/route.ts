import {
  getFallbackPitchModels,
  listPitchProviderModels,
  normalizePitchProvider,
} from '@/lib/pitch/llm';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedProvider = searchParams.get('provider');

  if (!requestedProvider) {
    return Response.json({ error: 'provider query parameter is required' }, { status: 400 });
  }

  const provider = normalizePitchProvider(requestedProvider);
  if (!provider) {
    return Response.json({ error: `Unsupported provider: ${requestedProvider}` }, { status: 400 });
  }

  try {
    const models = await listPitchProviderModels(provider);
    return Response.json({ provider, models, source: 'live' });
  } catch (err) {
    const warning = err instanceof Error ? err.message : 'Failed to load live models';
    const models = getFallbackPitchModels(provider);
    return Response.json({ provider, models, source: 'fallback', warning });
  }
}
