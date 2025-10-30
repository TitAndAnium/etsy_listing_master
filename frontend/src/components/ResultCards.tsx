import React from 'react';
import StatusBadge from './StatusBadge';
import CopyButton from './CopyButton';
import type { FieldState } from '../types';

interface ResultCardsProps {
  fields: FieldState[];
}

export default function ResultCards({ fields }: ResultCardsProps) {
  if (!fields.length) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {fields.map((field) => (
        <div key={field.label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, display: 'grid', gap: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{field.label}</strong>
              <StatusBadge status={field.status} />
              {field.warnings > 0 && (
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                  {field.warnings} warning{field.warnings !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <CopyButton disabled={field.status === 'error'} value={field.content} />
          </div>
          {field.message && (
            <div style={{ fontSize: 12, color: '#4b5563', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px' }}>
              {field.message}
            </div>
          )}
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              background: '#f9fafb',
              borderRadius: 6,
              padding: 12,
              border: '1px solid #e5e7eb',
              margin: 0,
            }}
            data-testid={`result-card-${field.label.toLowerCase()}`}
          >
            {field.content}
          </pre>
        </div>
      ))}
    </div>
  );
}
