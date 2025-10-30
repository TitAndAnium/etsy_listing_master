import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import type { User } from 'firebase/auth';
import {
  observeAuthState,
  loginWithEmail,
  logout as firebaseLogout,
  type AuthState,
} from '../../firebase/auth';

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  initializing: boolean;
  actionPending: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatFirebaseError(err: FirebaseError | Error | unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Combinatie van e-mail en wachtwoord klopt niet.';
      case 'auth/user-not-found':
        return 'Geen gebruiker gevonden met dit e-mailadres.';
      case 'auth/invalid-email':
        return 'Dit e-mailadres lijkt ongeldig.';
      case 'auth/too-many-requests':
        return 'Teveel mislukte pogingen. Probeer het later opnieuw.';
      default:
        return err.message || 'Onbekende Firebase-fout.';
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Onbekende fout tijdens authenticatie.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, idToken: null });
  const [initializing, setInitializing] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = observeAuthState((next) => {
      setState(next);
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string) => {
    setActionPending(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setError(formatFirebaseError(err));
      throw err;
    } finally {
      setActionPending(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setActionPending(true);
    setError(null);
    try {
      await firebaseLogout();
    } catch (err) {
      setError(formatFirebaseError(err));
      throw err;
    } finally {
      setActionPending(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      idToken: state.idToken,
      initializing,
      actionPending,
      error,
      login,
      logout,
      clearError,
    }),
    [state.user, state.idToken, initializing, actionPending, error, login, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth moet binnen een AuthProvider gebruikt worden.');
  }
  return ctx;
}
