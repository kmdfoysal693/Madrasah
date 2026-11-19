import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'] as const;

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export const sheetsGoogleProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  sheetsGoogleProvider.addScope(scope);
}
sheetsGoogleProvider.setCustomParameters({ prompt: 'consent select_account' });

// Keep tokens strictly in memory (never in localStorage or sessionStorage)
let inMemoryFirebaseIdToken: string | null = null;
let cachedSheetsAccessToken: string | null = null;
let isSheetsSigningIn = false;

export function setInMemoryFirebaseToken(token: string | null) {
  inMemoryFirebaseIdToken = token;
}

export function getInMemoryFirebaseToken(): string | null {
  return inMemoryFirebaseIdToken;
}

export function initSheetsAuth(
  onAuthSuccess?: (user: User, accessToken: string) => void,
  onAuthFailure?: () => void,
) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedSheetsAccessToken) {
        onAuthSuccess?.(user, cachedSheetsAccessToken);
      } else if (!isSheetsSigningIn) {
        cachedSheetsAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedSheetsAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function googleSignInForSheets(): Promise<{
  user: User;
  accessToken: string;
  idToken: string;
}> {
  try {
    isSheetsSigningIn = true;
    const result = await signInWithPopup(auth, sheetsGoogleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Sheets অনুমতি টোকেন পাওয়া যায়নি।');
    }
    const idToken = await result.user.getIdToken();
    cachedSheetsAccessToken = credential.accessToken;
    inMemoryFirebaseIdToken = idToken;
    return {
      user: result.user,
      accessToken: cachedSheetsAccessToken,
      idToken,
    };
  } finally {
    isSheetsSigningIn = false;
  }
}

export function getSheetsAccessToken(): string | null {
  return cachedSheetsAccessToken;
}

export async function logoutSheetsAuth(): Promise<void> {
  cachedSheetsAccessToken = null;
  inMemoryFirebaseIdToken = null;
  await signOut(auth);
}
