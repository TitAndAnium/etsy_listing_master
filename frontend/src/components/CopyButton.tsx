import React, { useState } from 'react';

export default function CopyButton({
  value,
  disabled = false
}: {
  value: string;
  disabled?: boolean;
}) {
  const [showToast, setShowToast] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value || '');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      /* swallow */
    }
  }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="px-2 py-1 border rounded text-sm disabled:opacity-50"
        title={disabled ? 'Nothing to copy' : 'Copy content'}
      >
        Copy
      </button>
      {showToast && (
        <span
          style={{
            position: 'absolute',
            top: '-32px',
            right: '0',
            background: '#10b981',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          ✓ Gekopieerd
        </span>
      )}
    </div>
  );
}
