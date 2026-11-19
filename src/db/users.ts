import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName = '') {
  try {
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
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed in getUsers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
