import { db } from './index.ts';
import { users } from './schema.ts';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';

export async function getOrCreateUser(uid: string, email: string, displayName = '') {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('users')
        .upsert(
          {
            uid,
            email,
            display_name: displayName,
            updated_at: nowIso,
          },
          { onConflict: 'uid' },
        )
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id as number,
        uid: data.uid as string,
        email: data.email as string,
        displayName: (data.display_name as string) ?? '',
        createdAt: new Date(data.created_at as string),
        updatedAt: new Date(data.updated_at as string),
      };
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUsers() {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id as number,
        uid: row.uid as string,
        email: row.email as string,
        displayName: (row.display_name as string) ?? '',
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      }));
    }

    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed in getUsers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
