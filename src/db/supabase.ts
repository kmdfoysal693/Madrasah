import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  var _supabaseAdminClient: SupabaseClient | undefined;
  var _supabaseRuntimeDisabled: boolean | undefined;
}

function isValidSupabaseProjectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      /\.supabase\.(co|in)$/i.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function isValidSupabaseApiKey(key: string): boolean {
  return /^(eyJ|sb_secret_|sb_publishable_)/.test(key);
}

function getSupabaseServerUrl(): string {
  const raw = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  return isValidSupabaseProjectUrl(normalized) ? normalized : '';
}

function getSupabaseServerKey(): string {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ];
  for (const raw of candidates) {
    const trimmed = (raw ?? '').trim();
    if (trimmed && isValidSupabaseApiKey(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

export function isSupabaseConfigured(): boolean {
  if (global._supabaseRuntimeDisabled) {
    return false;
  }
  return Boolean(getSupabaseServerUrl() && getSupabaseServerKey());
}

export function markSupabaseUnavailable(): void {
  global._supabaseRuntimeDisabled = true;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!global._supabaseAdminClient) {
    const url = getSupabaseServerUrl();
    const key = getSupabaseServerKey();

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_PUBLISHABLE_KEY) must be valid.',
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

export function isSupabaseRlsError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === 'object' && current !== null) {
      const rec = current as { code?: unknown; message?: unknown; cause?: unknown };
      if (rec.code === '42501') return true;
      if (
        typeof rec.message === 'string' &&
        rec.message.toLowerCase().includes('row-level security')
      ) {
        return true;
      }
      current = rec.cause;
    } else {
      break;
    }
  }
  return false;
}

