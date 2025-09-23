import React from 'react';

export default function CopyButton({
  value,
  disabled = false
}: {
  value: string;
  disabled?: boolean;
}) {
  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value || '');
    } catch {
      /* swallow */
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 border rounded text-sm disabled:opacity-50"
      title={disabled ? 'Nothing to copy' : 'Copy content'}
    >
      Copy
    </button>
  );
}
