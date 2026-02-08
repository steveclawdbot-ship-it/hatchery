import { Step, WorkerContext, StepResult } from '../../workers/base-worker.js';
import { TwitterClient } from './client.js';

/**
 * Step handler: draft_tweet
 * Uses LLM to generate a tweet, stores as output.
 */
export async function draftTweet(step: Step, context: WorkerContext): Promise<StepResult> {
  const { llm, logger } = context;

  const topic = step.payload?.topic ?? step.payload?.description ?? 'company update';
  const style = step.payload?.style ?? 'engaging, concise, with a hook';

  const tweet = await llm.generate(
    `Write a tweet about: ${topic}\nStyle: ${style}\nMax 280 characters. Just the tweet text, nothing else.`,
    { tier: 'cheap' },
  );

  const cleaned = tweet.trim().replace(/^["']|["']$/g, '');

  if (cleaned.length > 280) {
    logger.warn(`Draft tweet too long (${cleaned.length} chars), truncating`);
  }

  return {
    success: true,
    output: {
      draft: cleaned.slice(0, 280),
      topic,
      charCount: Math.min(cleaned.length, 280),
    },
  };
}

/**
 * Step handler: post_tweet
 * Posts a pre-drafted tweet to Twitter/X.
 */
export async function postTweet(step: Step, context: WorkerContext): Promise<StepResult> {
  const text = step.payload?.draft ?? step.payload?.text;
  if (!text) {
    return { success: false, error: 'No tweet text provided' };
  }

  const config = {
    apiKey: process.env.TWITTER_API_KEY ?? '',
    apiSecret: process.env.TWITTER_API_SECRET ?? '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN ?? '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET ?? '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN ?? '',
  };

  if (!config.bearerToken) {
    return { success: false, error: 'TWITTER_BEARER_TOKEN not configured' };
  }

  const client = new TwitterClient(config);
  const tweet = await client.postTweet(text as string);

  context.logger.info(`Posted tweet: ${tweet.id}`);

  return {
    success: true,
    output: {
      tweetId: tweet.id,
      text: tweet.text,
      postedAt: tweet.createdAt,
    },
  };
}

/**
 * Step handler: analyze_tweet
 * Fetches metrics for a posted tweet and generates analysis.
 */
export async function analyzeTweet(step: Step, context: WorkerContext): Promise<StepResult> {
  const tweetId = step.payload?.tweetId;
  if (!tweetId) {
    return { success: false, error: 'No tweetId provided' };
  }

  const config = {
    apiKey: '', apiSecret: '', accessToken: '', accessSecret: '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN ?? '',
  };

  const client = new TwitterClient(config);
  const metrics = await client.getTweetMetrics(tweetId as string);

  const analysis = await context.llm.generate(
    `Analyze this tweet's performance:\nLikes: ${metrics?.likes}, Retweets: ${metrics?.retweets}, Replies: ${metrics?.replies}, Impressions: ${metrics?.impressions}\n\nProvide a brief analysis (2-3 sentences) of what worked or didn't.`,
    { tier: 'cheap' },
  );

  return {
    success: true,
    output: {
      tweetId,
      metrics,
      analysis,
    },
  };
}
