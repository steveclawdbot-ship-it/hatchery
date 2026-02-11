import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get conversations with recent activity (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        participants,
        message_count,
        last_message,
        last_active,
        created_at
      `)
      .gte('last_active', thirtyMinutesAgo)
      .order('last_active', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    // Transform to conversation format
    const transformedConversations = (conversations || []).map((conv: any) => ({
      id: conv.id,
      participants: conv.participants || [],
      messageCount: conv.message_count || 0,
      lastMessage: conv.last_message || '',
      lastActive: conv.last_active,
      createdAt: conv.created_at,
    }));

    return NextResponse.json({
      conversations: transformedConversations,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
