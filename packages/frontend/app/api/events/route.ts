import { createClient } from '@supabase/supabase-js';

/**
 * Server-Sent Events endpoint for real-time event streaming.
 * Listens to Supabase Realtime for new events and pushes to client.
 */
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return new Response('Missing Supabase config', { status: 500 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const db = createClient(url, key, { auth: { persistSession: false } });

      // Subscribe to new events
      const channel = db
        .channel('events')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ops_events' },
          (payload) => {
            const event = payload.new;
            const data = JSON.stringify({
              id: event.id,
              agentId: event.agent_id,
              kind: event.kind,
              title: event.title,
              summary: event.summary,
              payload: event.payload,
              tags: event.tags,
              createdAt: event.created_at,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
        )
        .subscribe();

      // Send initial ping
      controller.enqueue(encoder.encode(`data: {"type":"connected"}\n\n`));

      // Cleanup on close
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, 30000);

      return () => {
        clearInterval(interval);
        channel.unsubscribe();
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
