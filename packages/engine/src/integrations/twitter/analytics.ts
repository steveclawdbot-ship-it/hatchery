import { DBClient } from '../../db/client.js';
import { MemoryStore } from '../../memory/store.js';

/**
 * Outcome learning: review tweet performance and generate lessons.
 * Called during heartbeat to analyze recently posted tweets.
 */
export async function reviewTweetPerformance(
  db: DBClient,
  llmGenerate: (prompt: string, opts: { tier: string }) => Promise<string>,
): Promise<number> {
  const memory = new MemoryStore(db);

  // Find recent analyze_tweet step outputs
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: analyses } = await db
    .from('ops_steps')
    .select('output, payload')
    .eq('kind', 'analyze_tweet')
    .eq('status', 'succeeded')
    .gte('completed_at', oneDayAgo);

  if (!analyses?.length) return 0;

  // Batch analyze for lessons
  const summaries = analyses
    .map((a) => {
      const m = a.output?.metrics ?? {};
      return `Tweet (${a.output?.tweetId}): ${m.likes} likes, ${m.retweets} RTs, ${m.impressions} impressions. Analysis: ${a.output?.analysis}`;
    })
    .join('\n');

  const lessons = await llmGenerate(
    `Review these recent tweet performances and extract 1-3 lessons about what content performs well:\n\n${summaries}\n\nOutput each lesson as a single sentence.`,
    { tier: 'cheap' },
  );

  // Save lessons as memories
  const lessonLines = lessons.split('\n').filter((l) => l.trim().length > 10);
  let created = 0;
  for (const lesson of lessonLines.slice(0, 3)) {
    await memory.create({
      agent_id: 'system',
      type: 'lesson',
      content: lesson.replace(/^\d+\.\s*/, '').trim(),
      confidence: 0.65,
      tags: ['twitter', 'engagement', 'content'],
    });
    created++;
  }

  return created;
}
