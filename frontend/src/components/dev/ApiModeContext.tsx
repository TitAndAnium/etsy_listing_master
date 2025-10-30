import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getApiMode } from '../../api/env';
import type { ApiMode } from '../../api/types';

interface ApiModeContextValue {
  mode: ApiMode;
  useV2: boolean;
  setUseV2: (value: boolean) => void;
}

const ApiModeContext = createContext<ApiModeContextValue | undefined>(undefined);

export function ApiModeProvider({ children }: { children: ReactNode }) {
  const defaultMode = getApiMode();
  const [useV2, setUseV2] = useState(() => {
    if (typeof window === 'undefined') return defaultMode === 'v2';
    try {
      const stored = window.localStorage.getItem('lg_api_mode');
      if (stored === 'v2' || stored === 'legacy') {
        return stored === 'v2';
      }
    } catch {/* ignore */}
    return defaultMode === 'v2';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('lg_api_mode', useV2 ? 'v2' : 'legacy');
    } catch {/* ignore */}
  }, [useV2]);

  const value = useMemo<ApiModeContextValue>(
    () => ({
      mode: useV2 ? 'v2' : 'legacy',
      useV2,
      setUseV2,
    }),
    [useV2]
  );

  return <ApiModeContext.Provider value={value}>{children}</ApiModeContext.Provider>;
}

export function useApiMode(): ApiModeContextValue {
  const ctx = useContext(ApiModeContext);
  if (!ctx) {
    throw new Error('useApiMode moet binnen ApiModeProvider gebruikt worden.');
  }
  return ctx;
}
