import React from 'react'

type Status = 'ok' | 'warn' | 'error'

interface Props {
  status: Status;
  'data-testid'?: string;
}

export default function StatusBadge({ status, 'data-testid': dataTestId }: Props) {
  const colorMap = {
    ok: 'bg-green-100',
    warn: 'bg-yellow-100',
    error: 'bg-red-100'
  } as const

  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${colorMap[status]} mr-2`}
      title={status}
      data-testid={dataTestId}
    />
  )
}
