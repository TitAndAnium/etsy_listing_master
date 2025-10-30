import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { client, HttpError, setRuntimeApiMode } from '../api/client';
import StatusBadge from './StatusBadge';
import CopyButton from './CopyButton';
import { LoginPanel } from './auth/LoginPanel';
import { useAuth } from './auth/AuthProvider';
import { useApiMode } from './dev/ApiModeContext';
import type { FieldState } from '../types';
import type { UserWalletSummary } from '../api/types';
import ResultCards from './ResultCards';

type LedgerEntry = UserWalletSummary['ledger'][number];

interface RunLog {
  ts: string;
  status: 'ok' | 'warn' | 'error';
  durationMs?: number;
  http?: { status: number; credits?: number | null };
  note?: string;
}

export default function ListingGenerator() {
  const { user, idToken } = useAuth();
  const { mode, useV2, setUseV2 } = useApiMode();
  const [text, setText] = useState(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('lg_text') || 'silver moon phase ring, handmade'
      : 'silver moon phase ring, handmade'
  );
  const [uid, setUid] = useState(
    typeof localStorage !== 'undefined' ? localStorage.getItem('lg_uid') || 'srv' : 'srv'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | undefined>();
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [wallet, setWallet] = useState<UserWalletSummary | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [runs, setRuns] = useState<RunLog[]>([]);

  // Context & Targeting fields
  const [audience, setAudience] = useState('');
  const [ageBracket, setAgeBracket] = useState<'18-24' | '25-34' | '35-44' | '45-54' | '55+' | ''>('');
  const [toneProfile, setToneProfile] = useState('');
  const [giftMode, setGiftMode] = useState(false);

  const walletRows = useMemo(() => {
    if (!wallet?.ledger) return [] as Array<{ key: React.Key; timestamp: string; type: string; credits: string; source: string; note: string }>;

    return wallet.ledger.map((entry, idx) => {
      const cast = entry as LedgerEntry;
      const rawTs = cast?.createdAt as unknown;
      let ts: string | null = null;
      if (rawTs && typeof rawTs === 'object' && 'toDate' in (rawTs as Record<string, unknown>) && typeof (rawTs as { toDate?: () => Date }).toDate === 'function') {
        ts = (rawTs as { toDate: () => Date }).toDate().toLocaleString();
      } else if (rawTs && typeof rawTs === 'object' && 'seconds' in (rawTs as Record<string, unknown>) && typeof (rawTs as { seconds?: number }).seconds === 'number') {
        ts = new Date(((rawTs as { seconds: number }).seconds ?? 0) * 1000).toLocaleString();
      } else if (rawTs && typeof rawTs === 'object' && '_seconds' in (rawTs as Record<string, unknown>) && typeof (rawTs as { _seconds?: number })._seconds === 'number') {
        ts = new Date(((rawTs as { _seconds: number })._seconds ?? 0) * 1000).toLocaleString();
      } else if (typeof rawTs === 'string' || typeof rawTs === 'number') {
        const parsed = new Date(rawTs);
        ts = Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
      }

      const note =
        (cast?.reason as string | undefined) ??
        (cast?.priceId as string | undefined) ??
        (cast?.eventId as string | undefined) ??
        (cast?.requestId as string | undefined) ??
        '—';

      return {
        key: (cast?.id as React.Key | undefined) ?? `${idx}`,
        timestamp: ts ?? 'Onbekende datum',
        type: (cast?.type as string | undefined) ?? '—',
        credits: typeof cast?.credits === 'number' ? cast.credits.toString() : '—',
        source: (cast?.source as string | undefined) ?? '—',
        note,
      };
    });
  }, [wallet]);

  useEffect(() => {
    try {
      localStorage.setItem('lg_text', text);
    } catch {/* SSR / incognito */}
  }, [text]);
  useEffect(() => {
    if (mode === 'legacy') {
      try {
        localStorage.setItem('lg_uid', uid);
      } catch {/* SSR / incognito */}
    }
  }, [uid, mode]);

  useEffect(() => {
    setRuntimeApiMode(mode);
  }, [mode]);

  function pushRun(log: RunLog) {
    setRuns((prev) => [log, ...prev].slice(0, 5));
  }

  const refreshCredits = useCallback(async (): Promise<number | null> => {
    if (mode !== 'v2' || !idToken) {
      setCredits(undefined);
      return null;
    }
    setCreditsLoading(true);
    try {
      const summary = await client.getUserCredits();
      setCredits(summary.credits);
      return summary.credits;
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        setCredits(undefined);
      } else {
        console.warn('Kon credits niet ophalen', err);
      }
      return null;
    } finally {
      setCreditsLoading(false);
    }
  }, [mode, idToken]);

  const refreshWallet = useCallback(async () => {
    if (mode !== 'v2' || !idToken) {
      setWallet(null);
      return;
    }
    setWalletLoading(true);
    try {
      const summary = await client.getWallet();
      setWallet(summary);
    } catch (err) {
      if (!(err instanceof HttpError && err.status === 401)) {
        console.warn('Kon wallet niet ophalen', err);
      }
    } finally {
      setWalletLoading(false);
    }
  }, [mode, idToken]);

  useEffect(() => {
    if (mode === 'v2') {
      if (idToken) {
        void refreshCredits();
        if (showWallet) {
          void refreshWallet();
        }
      } else {
        setCredits(undefined);
        setWallet(null);
      }
    } else {
      setCredits(undefined);
      setWallet(null);
    }
  }, [mode, idToken, refreshCredits, refreshWallet, showWallet]);

  function mapErrorMessage(err: unknown): { status: number; message: string } {
    if (err instanceof HttpError) {
      if (err.status === 401) {
        return { status: 401, message: 'Niet geautoriseerd. Log in om de v2-endpoint te gebruiken.' };
      }
      if (err.status === 409) {
        return { status: 409, message: 'Conflicterende gegevens. Controleer UID/token combinatie.' };
      }
      if (err.status === 429) {
        return { status: 429, message: 'Te veel verzoeken of geen credits beschikbaar. Wacht even en probeer opnieuw.' };
      }
      return { status: err.status, message: err.message };
    }
    if (err instanceof Error) {
      return { status: 0, message: err.message };
    }
    return { status: 0, message: 'Onbekende fout tijdens het genereren.' };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'v2' && !idToken) {
      setError('Log eerst in om v2 te gebruiken.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = performance.now();
    let creditsAfter: number | null = null;
    try {
      const body = {
        mode: 'dump' as const,
        payload: text,
        ...(mode === 'legacy' ? { uid } : {}),
        ...(mode === 'v2' && (audience || ageBracket || toneProfile || giftMode) ? {
          settings: {
            ...(audience ? { audience } : {}),
            ...(ageBracket ? { age_bracket: ageBracket } : {}),
            ...(toneProfile ? { tone_profile: toneProfile } : {}),
            ...(giftMode ? { gift_mode: true } : {}),
          }
        } : {}),
      };
      const res = await client.generateListing(body);
      const dur = Math.round(performance.now() - t0);
      setRaw(res);
      setResult(res);
      if (mode === 'v2') {
        creditsAfter = await refreshCredits();
        if (showWallet) {
          void refreshWallet();
        }
      }
      pushRun({ ts: new Date().toLocaleTimeString(), status: 'ok', durationMs: dur, http: { status: 200, credits: creditsAfter ?? null }, note: 'generated' });
    } catch (err) {
      const dur = Math.round(performance.now() - t0);
      const { status, message } = mapErrorMessage(err);
      setError(message);
      if (mode === 'v2' && idToken && status === 429) {
        creditsAfter = await refreshCredits();
        if (showWallet) {
          void refreshWallet();
        }
      }
      pushRun({ ts: new Date().toLocaleTimeString(), status: 'error', durationMs: dur, http: { status, credits: creditsAfter ?? null }, note: message });
    } finally {
      setLoading(false);
    }
  }

  const fields = useMemo(() => {
    if (!result) return [];

    const out: FieldState[] = [];

    if (result?.title) {
      const warnings = Array.isArray(result.title.warnings) ? result.title.warnings.length : 0;
      out.push({
        label: 'Title',
        content: result.title.value ?? '',
        warnings,
        status: warnings ? 'warn' : 'ok',
        isValid: warnings === 0,
      });
    }

    if (result?.description) {
      const warnings = Array.isArray(result.description.warnings) ? result.description.warnings.length : 0;
      out.push({
        label: 'Description',
        content: result.description.value ?? '',
        warnings,
        status: warnings ? 'warn' : 'ok',
        isValid: warnings === 0,
      });
    }

    if (result?.tags) {
      const warnings = Array.isArray(result.tags.warnings) ? result.tags.warnings.length : 0;
      out.push({
        label: 'Tags',
        content: Array.isArray(result.tags.items) ? result.tags.items.join(', ') : '',
        warnings,
        status: warnings ? 'warn' : 'ok',
        isValid: warnings === 0,
      });
    }

    return out;
  }, [result]);

  const rightCard = (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fdfdfd', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusBadge status={error ? 'error' : loading ? 'warn' : 'ok'} />
      </div>
      {error && <div style={{ color: '#b00020' }}>⚠️ {error}</div>}
      {fields.length > 0 && <ResultCards fields={fields} />}
      {raw && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong>Raw JSON</strong>
            <CopyButton value={JSON.stringify(raw, null, 2)} />
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto', background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #eee' }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '2rem auto', fontFamily: 'system-ui, Arial' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Listing Generator</h2>
        <div style={{ display: 'grid', gap: 8, fontSize: 12, justifyItems: 'end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={useV2}
                onChange={(e) => setUseV2(e.target.checked)}
              />
              <span>Use v2 (auth required)</span>
            </label>
            <span style={{ padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
              Actief: {mode}
            </span>
            {mode === 'v2' && (
              <span style={{ padding: '2px 6px', borderRadius: 4, background: user ? '#dcfce7' : '#fee2e2', border: '1px solid #e5e7eb' }}>
                {user ? `Ingelogd als ${user.email}` : 'Niet ingelogd'}
              </span>
            )}
          </div>
          <LoginPanel />
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Credits:{' '}
            {mode !== 'v2'
              ? 'n.v.t.'
              : creditsLoading
                ? 'laden…'
                : credits !== undefined
                  ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {credits}
                      <StatusBadge status={credits > 0 ? 'ok' : 'warn'} />
                      {credits === 0 && (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            alert('Stripe checkout flow nog in ontwikkeling. Gebruik voorlopig: npm run test:e2e (in functions/) voor dev credits via CLI-bypass.');
                          }}
                          style={{ fontSize: 11, textDecoration: 'underline', color: '#2563eb' }}
                        >
                          + Add credits
                        </a>
                      )}
                    </span>
                  )
                  : '—'}
            {mode === 'v2' && idToken && (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showWallet;
                    setShowWallet(next);
                    if (next) {
                      void refreshWallet();
                    }
                  }}
                  style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                >
                  {showWallet ? 'Verberg wallet' : 'Toon wallet'}
                </button>
                {showWallet && (
                  <button
                    type="button"
                    onClick={() => void refreshWallet()}
                    disabled={walletLoading}
                    style={{ padding: '2px 8px', fontSize: 11, cursor: walletLoading ? 'wait' : 'pointer' }}
                  >
                    {walletLoading ? 'Ververs…' : 'Ververs'}
                  </button>
                )}
              </span>
            )}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Product prompt</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ padding: 10, fontSize: 14 }} required />
            </label>
            {mode === 'legacy' && (
              <label style={{ display: 'grid', gap: 6 }}>
                <span>UID</span>
                <input value={uid} onChange={(e) => setUid(e.target.value)} style={{ padding: 10, fontSize: 14 }} required />
              </label>
            )}
            {mode === 'v2' && (
              <details style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fafafa' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Context & Targeting (optioneel)</summary>
                <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Audience</span>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="b.v. yoga enthusiasts, hikers"
                      style={{ padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Age Bracket</span>
                    <select
                      value={ageBracket}
                      onChange={(e) => setAgeBracket(e.target.value as any)}
                      style={{ padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4 }}
                    >
                      <option value="">Niet opgegeven</option>
                      <option value="18-24">18-24</option>
                      <option value="25-34">25-34</option>
                      <option value="35-44">35-44</option>
                      <option value="45-54">45-54</option>
                      <option value="55+">55+</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Tone Profile</span>
                    <input
                      type="text"
                      value={toneProfile}
                      onChange={(e) => setToneProfile(e.target.value)}
                      placeholder="b.v. casual, professional, playful"
                      style={{ padding: 8, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={giftMode}
                      onChange={(e) => setGiftMode(e.target.checked)}
                    />
                    <span style={{ fontSize: 13 }}>Gift Mode (optimaliseer voor cadeau-angle)</span>
                  </label>
                </div>
              </details>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={loading || (mode === 'v2' && !idToken)} style={{ padding: '8px 14px', cursor: 'pointer' }}>
                {loading ? 'Bezig…' : mode === 'v2' ? 'Generate (v2)' : 'Generate'}
              </button>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{text.length} chars</span>
            </div>
            {mode === 'v2' && !idToken && (
              <div style={{ color: '#b00020', fontSize: 12 }}>
                Log in om de v2-endpoint te gebruiken.
              </div>
            )}
          </form>

          <div style={{ marginTop: 16 }}>
            <strong>Laatste runs (max 5)</strong>
            <ul style={{ margin: '8px 0 0 18px' }}>
              {runs.map((run, idx) => (
                <li key={idx}>
                  [{run.ts}] <StatusBadge status={run.status} /> {run.durationMs ? `${run.durationMs}ms` : ''} · HTTP {run.http?.status ?? '-'} · credits {run.http?.credits ?? '—'} {run.note ? `· ${run.note}` : ''}
                </li>
              ))}
              {runs.length === 0 && <li>— nog geen runs —</li>}
            </ul>
          </div>
        </div>

        {/* RIGHT */}
        {rightCard}
      </div>

      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: 16, borderRadius: 8, border: '1px solid #ddd', background: 'white' }}>Generating…</div>
        </div>
      )}
    </div>
  );
}
