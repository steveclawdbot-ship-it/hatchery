export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
}

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
}

export class TwitterClient {
  private config: TwitterConfig;

  constructor(config: TwitterConfig) {
    this.config = config;
  }

  async postTweet(text: string): Promise<Tweet> {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.bearerToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { data: { id: string; text: string } };
    return {
      id: data.data.id,
      text: data.data.text,
      createdAt: new Date().toISOString(),
    };
  }

  async getTweetMetrics(tweetId: string): Promise<Tweet['metrics']> {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.bearerToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status}`);
    }

    const data = await response.json() as {
      data: { public_metrics: { like_count: number; retweet_count: number; reply_count: number; impression_count: number } };
    };

    const m = data.data.public_metrics;
    return {
      likes: m.like_count,
      retweets: m.retweet_count,
      replies: m.reply_count,
      impressions: m.impression_count,
    };
  }
}
