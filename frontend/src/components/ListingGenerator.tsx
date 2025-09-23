import React, { useState } from 'react';
import { postGenerate } from '../api/httpGenerate';

export default function ListingGenerator() {
  const [text, setText] = useState('silver moon phase ring, handmade');
  const [uid, setUid] = useState('srv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await postGenerate(text, uid);
      setCredits(res.creditsRemaining);
      if (res.ok === false) setError(res.error || 'Unknown error');
      else setResult(res.result);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '2rem auto', fontFamily: 'system-ui, Arial' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Listing Generator</h2>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>Product prompt</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            style={{ padding: '0.6rem', fontSize: '1rem' }}
            required
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span>UID</span>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            style={{ padding: '0.6rem', fontSize: '1rem' }}
            required
          />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '0.6rem 1rem', fontSize: '1rem', cursor: 'pointer' }}
          >
            {loading ? 'Bezig…' : 'Generate'}
          </button>
          <span style={{ opacity: 0.8 }}>
            Credits: {credits === undefined ? '—' : credits}
          </span>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: '1rem', color: '#b00020' }}>⚠️ {error}</div>
      )}

      {result && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: 8
          }}
        >
          <h3 style={{ marginTop: 0 }}>Resultaat</h3>
          <div><strong>Title:</strong> {result?.fields?.title}</div>
          <div style={{ margin: '0.5rem 0' }}>
            <strong>Tags:</strong> {(result?.fields?.tags || []).join(', ')}
          </div>
          <div>
            <strong>Description:</strong>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{result?.fields?.description}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
