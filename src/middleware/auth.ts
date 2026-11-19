import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { isSqlConfigured } from '../db/index.ts';
import { isSupabaseConfigured, isSupabaseRlsError } from '../db/supabase.ts';

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
    } catch (error) {
      console.error('Error syncing user record:', error);
      if (isSupabaseRlsError(error)) {
        res.status(403).json({
          error:
            'Supabase-এ Row Level Security (RLS) চালু থাকায় ডাটা সেভ হচ্ছে না। অনুগ্রহ করে Secrets-এ SUPABASE_SECRET_KEY যোগ করুন অথবা Supabase SQL Editor-এ RLS বন্ধ/পলিসি চালু করুন।',
        });
        return;
      }
      res.status(500).json({ error: 'ডাটাবেজে ব্যবহারকারীর তথ্য সংরক্ষণ করা যায়নি।' });
      return;
    }
  }

  next();
};

