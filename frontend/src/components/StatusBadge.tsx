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
      ? 'bg-red-100 text-red-800'
      : status === 'warn'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-green-100 text-green-800'

  return (
    <span
      data-testid={dataTestId ?? (field ? `badge-${field}-${status}` : `badge-${status}`)}
      className={`px-2 py-1 rounded ${color}`}
    >
      {status}
    </span>
  )
}
