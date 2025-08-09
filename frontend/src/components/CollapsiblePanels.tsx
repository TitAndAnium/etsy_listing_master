import React from 'react'
import StatusBadge from './StatusBadge'
import CopyButton from './CopyButton'
import { FieldState } from '../types'

interface Props {
  fields: FieldState[];
}

export default function CollapsiblePanels({ fields }: Props) {
  return (
    <div className="space-y-4 mt-6">
      {fields.map((field) => (
        <details key={field.label} className="border border-gray-300 rounded-lg">
          <summary className="cursor-pointer select-none p-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100">
            <div className="flex items-center">
              <StatusBadge status={field.status} data-testid={`${field.label.toLowerCase()}-badge`} />
              <span className="font-medium">{field.label}</span>
              {field.warnings > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                  {field.warnings} warning{field.warnings !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <CopyButton disabled={field.status === 'error'} value={field.content} />
          </summary>
          <div className="p-4 bg-white">
            <pre 
              className="whitespace-pre-wrap break-words text-sm font-mono bg-gray-50 p-3 rounded border"
              data-testid={`generated-${field.label.toLowerCase()}`}
            >
              {field.content}
            </pre>
          </div>
        </details>
      ))}
    </div>
  )
}
