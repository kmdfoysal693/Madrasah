import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

// Keep Firebase ID token strictly in memory (never in localStorage)
let inMemoryFirebaseIdToken: string | null = null;

export function setInMemoryFirebaseToken(token: string | null) {
  inMemoryFirebaseIdToken = token;
}

export function getInMemoryFirebaseToken(): string | null {
  return inMemoryFirebaseIdToken;
}
