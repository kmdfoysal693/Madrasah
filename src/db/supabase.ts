import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  var _supabaseAdminClient: SupabaseClient | undefined;
}

const DEFAULT_PUBLIC_SUPABASE_URL = 'https://kjpghibnggzvfbeozxiq.supabase.co';
const DEFAULT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_6mbpT-gFs03LmnXngWBiWw_Eq3Y5CA0';

function normalizeSupabaseApiUrl(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('YOUR_PROJECT_REF')) return '';

  // Handle accidental Supabase Dashboard URL (e.g. https://supabase.com/dashboard/project/<ref>)
  const dashMatch = trimmed.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashMatch?.[1]) {
    return `https://${dashMatch[1]}.supabase.co`;
  }

  // Accept valid Supabase API project URLs (with or without /rest/v1)
  const apiMatch = trimmed.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/i);
  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  return '';
}

function isValidSupabaseKey(raw: string | undefined): raw is string {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('YOUR_') || trimmed.startsWith('SUPABASE_')) return false;
  return (
    trimmed.startsWith('eyJ') ||
    trimmed.startsWith('sb_secret_') ||
    trimmed.startsWith('sb_publishable_')
  );
}

function getSupabaseServerUrl(): string {
  return (
    normalizeSupabaseApiUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseApiUrl(process.env.VITE_SUPABASE_URL) ||
    DEFAULT_PUBLIC_SUPABASE_URL
  );
}

function getSupabaseServerKey(): string {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ];
  for (const candidate of candidates) {
    if (isValidSupabaseKey(candidate)) {
      return candidate.trim();
    }
  }
  return DEFAULT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseServerUrl() && getSupabaseServerKey());
}

export function isSupabaseRlsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (errObj.code === '42501') return true;
  if (
    typeof errObj.message === 'string' &&
    errObj.message.toLowerCase().includes('row-level security')
  ) {
    return true;
  }
  if (errObj.cause) return isSupabaseRlsError(errObj.cause);
  return false;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!global._supabaseAdminClient) {
    const url = getSupabaseServerUrl();
    const key = getSupabaseServerKey();

    if (!url || !key) {
      throw new Error('Supabase URL and API key must be configured.');
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
