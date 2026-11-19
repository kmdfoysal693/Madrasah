import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  var _supabaseAdminClient: SupabaseClient | undefined;
}

function getSupabaseServerUrl(): string {
  const raw = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

function getSupabaseServerKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseServerUrl() && getSupabaseServerKey());
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!global._supabaseAdminClient) {
    const url = getSupabaseServerUrl();
    const key = getSupabaseServerKey();

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_PUBLISHABLE_KEY) must be configured.',
      );
    }

    global._supabaseAdminClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return global._supabaseAdminClient;
}
