import React, { useState } from 'react'

interface Props {
  disabled: boolean;
  value: string;
}

export default function CopyButton({ disabled, value }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (disabled) return
    
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <button
      className={`ml-2 px-2 py-1 text-sm border rounded ${
        disabled 
          ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400' 
          : 'hover:bg-gray-100 bg-white text-gray-700'
      }`}
      onClick={handleCopy}
      disabled={disabled}
      title={disabled ? 'Field invalid - copy disabled' : 'Copy to clipboard'}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}
