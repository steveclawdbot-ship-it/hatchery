import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'SSE endpoint is disabled for MVP. Use /api/events/history polling instead.',
    },
    { status: 410 },
  );
}
