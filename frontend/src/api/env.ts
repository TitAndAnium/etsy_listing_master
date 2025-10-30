import type { ApiMode } from './types';

// ✅ Compile-time reads: Vite replaces these with literal values during build
const API_BASE_URL_RAW = import.meta.env.VITE_API_BASE_URL || '';
const API_MODE_RAW = import.meta.env.VITE_API_MODE;

// Validate and export base URL
if (!API_BASE_URL_RAW) {
  throw new Error('VITE_API_BASE_URL is not configured.');
}

export const API_BASE_URL = API_BASE_URL_RAW.replace(/\/$/, '');

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\//, '')}`;
}

export function getApiMode(): ApiMode {
  // If explicitly set to legacy, use legacy
  if (API_MODE_RAW === 'legacy') {
    return 'legacy';
  }
  // Default to v2
  return 'v2';
}
