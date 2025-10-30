import { FirebaseError, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
  type User,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

export type AuthState = {
  user: User | null;
  idToken: string | null;
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let emulatorLinked = false;

function readEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const metaValue = (import.meta.env as Record<string, string | undefined>)[key];
    if (metaValue) return metaValue;
  }
  // Vite injecteert ook op globalThis.process.env tijdens testen/build
  const globalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return globalProcess?.env?.[key];
}

function getConfig() {
  const apiKey = readEnv('VITE_FIREBASE_API_KEY') ?? 'fake-api-key';
  const authDomain = readEnv('VITE_FIREBASE_AUTH_DOMAIN') ?? 'localhost';
  const projectId = readEnv('VITE_FIREBASE_PROJECT_ID') ?? 'etsy-ai-hacker';
  const appId = readEnv('VITE_FIREBASE_APP_ID') ?? 'fake-app-id';

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
  };
}

export function ensureFirebase() {
  if (!firebaseApp) {
    const config = getConfig();
    firebaseApp = getApps().length ? getApps()[0] : initializeApp(config);
  }
  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp);
    if (import.meta.env?.DEV && !emulatorLinked) {
      connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
      emulatorLinked = true;
    }
  }
  return { app: firebaseApp!, auth: firebaseAuth! };
}

export function observeAuthState(callback: (state: AuthState) => void) {
  const { auth } = ensureFirebase();
  return onIdTokenChanged(auth, async (user) => {
    let idToken: string | null = null;
    if (user) {
      try {
        idToken = await user.getIdToken();
      } catch (err) {
        console.warn('[auth] kon idToken niet ophalen', err);
      }
    }
    callback({ user, idToken });
  });
}

export async function loginWithEmail(email: string, password: string) {
  const { auth } = ensureFirebase();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const { auth } = ensureFirebase();
  await signOut(auth);
}
