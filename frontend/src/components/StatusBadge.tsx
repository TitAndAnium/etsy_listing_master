import React from 'react'

type Status = 'ok' | 'warn' | 'error'

interface Props {
  status: Status;
  field?: string;
  'data-testid'?: string;
}

export default function StatusBadge({ status, field, 'data-testid': dataTestId }: Props) {
  const color =
    status === 'error'
      ? 'bg-red-100 text-red-800 border-red-300'
      : status === 'warn'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
      : 'bg-green-100 text-green-800 border-green-300'

  return (
    <span
      data-testid={dataTestId ?? (field ? `badge-${field}-${status}` : `badge-${status}`)}
      className={`px-2 py-1 rounded border ${color}`}
      style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
    >
      {status}
    </span>
  )
}
