import React, { FormEvent, useState } from 'react';
import { useAuth } from './AuthProvider';

export function LoginPanel() {
  const { user, login, logout, error, clearError, actionPending, initializing } = useAuth();
  const [email, setEmail] = useState('tester@example.com');
  const [password, setPassword] = useState('Geheim123!');
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
    } catch (err) {
      // error is al gezet in context; we tonen enkel fallback
      if (!(err instanceof Error)) {
        setLocalError('Onbekende fout tijdens inloggen.');
      }
    }
  }

  async function handleLogout() {
    setLocalError(null);
    await logout();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, alignItems: 'flex-end' }}>
      <strong>Authenticatie</strong>
      {initializing && <span>Bezig met laden…</span>}
      {user ? (
        <>
          <span>Ingelogd als <strong>{user.email}</strong></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleLogout} disabled={actionPending} style={{ padding: '4px 8px' }}>
              Uitloggen
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 6, minWidth: 220 }}>
          <label style={{ display: 'grid', gap: 2 }}>
            <span>E-mailadres</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={{ padding: 6 }} required />
          </label>
          <label style={{ display: 'grid', gap: 2 }}>
            <span>Wachtwoord</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={{ padding: 6 }} required />
          </label>
          <button type="submit" disabled={actionPending} style={{ padding: '6px 10px' }}>
            {actionPending ? 'Inloggen…' : 'Inloggen'}
          </button>
        </form>
      )}

      {(error || localError) && (
        <div style={{ color: '#b00020' }}>
          ⚠️ {error || localError}
          <button type="button" onClick={clearError} style={{ marginLeft: 8, fontSize: 11 }}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
