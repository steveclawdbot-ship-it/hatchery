import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type DBClient = SupabaseClient;

export function createDBClient(url: string, serviceKey: string): DBClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
