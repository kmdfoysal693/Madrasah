import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { isSqlConfigured } from '../db/index.ts';
import { isSupabaseConfigured, markSupabaseUnavailable } from '../db/supabase.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  if (isSupabaseConfigured() || isSqlConfigured()) {
    try {
      await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email ?? '',
        decodedToken.name ?? '',
      );
    } catch {
      // If external DB is temporarily unreachable or blocked by RLS, disable Supabase for this run
      // so Google Sign-In and Google Sheets sync still proceed smoothly using verified Firebase Auth.
      if (isSupabaseConfigured()) {
        markSupabaseUnavailable();
      }
    }
  }

  next();
};
