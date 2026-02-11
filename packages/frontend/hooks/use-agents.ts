'use client';

import useSWR from 'swr';
import { VisualAgent } from '@/lib/types/rpg';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const POLLING_INTERVAL = 5000; // 5 seconds

// Hook for fetching all agents with live polling
export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/agents',
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    }
  );

  return {
    agents: (data?.agents || []) as VisualAgent[],
    isLoading,
    error,
    refresh: mutate,
  };
}

// Hook for fetching a single agent's thoughts
export function useThoughts(agentId: string | null, limit = 20) {
  const { data, error, isLoading, mutate } = useSWR(
    agentId ? `/api/agents/${agentId}/thoughts?limit=${limit}` : null,
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  return {
    thoughts: (data?.thoughts || []) as ThoughtTrace[],
    hasMore: data?.hasMore || false,
    nextCursor: data?.nextCursor || null,
    isLoading,
    error,
    refresh: mutate,
    loadMore: async () => {
      if (!data?.nextCursor || !agentId) return;
      const res = await fetch(
        `/api/agents/${agentId}/thoughts?limit=${limit}&after=${data.nextCursor}`
      );
      const newData = await res.json();
      mutate(
        {
          ...data,
          thoughts: [...data.thoughts, ...newData.thoughts],
          hasMore: newData.hasMore,
          nextCursor: newData.nextCursor,
        },
        false
      );
    },
  };
}

// Hook for fetching events stream
export function useEvents(limit = 50, kinds?: string[]) {
  const kindParam = kinds?.length ? `&kinds=${kinds.join(',')}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/events?limit=${limit}${kindParam}`,
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  return {
    events: (data?.events || []) as OfficeEvent[],
    hasMore: data?.hasMore || false,
    isLoading,
    error,
    refresh: mutate,
  };
}

// Hook for active conversations
export function useConversations() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/conversations/active',
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  return {
    conversations: (data?.conversations || []) as Conversation[],
    isLoading,
    error,
    refresh: mutate,
  };
}

// Types
export interface ThoughtTrace {
  id: string;
  agentId: string;
  content: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface OfficeEvent {
  id: string;
  kind: string;
  agentId: string;
  data: Record<string, any>;
  timestamp: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  messageCount: number;
  lastMessage: string;
  lastActive: string;
}

// Hook for agent state updates (mutation)
export function useUpdateAgentState() {
  const updateState = async (
    agentId: string,
    state: string,
    currentTask?: string
  ) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, state, currentTask }),
    });

    if (!res.ok) {
      throw new Error('Failed to update agent state');
    }

    return res.json();
  };

  return { updateState };
}

// Hook for submitting thoughts (mutation)
export function useSubmitThought() {
  const submitThought = async (
    agentId: string,
    content: string,
    metadata?: Record<string, any>
  ) => {
    const res = await fetch(`/api/agents/${agentId}/thoughts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, metadata }),
    });

    if (!res.ok) {
      throw new Error('Failed to submit thought');
    }

    return res.json();
  };

  return { submitThought };
}
