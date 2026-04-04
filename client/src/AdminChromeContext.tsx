import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AdminChromeValue = {
  sectionTitle: string;
  panelOpen: boolean;
  onBack: () => void;
};

type Ctx = {
  chrome: AdminChromeValue | null;
  setAdminChrome: (value: AdminChromeValue | null) => void;
};

const AdminChromeContext = createContext<Ctx | null>(null);

export function AdminChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<AdminChromeValue | null>(null);
  const setAdminChrome = useCallback((value: AdminChromeValue | null) => {
    setChrome(value);
  }, []);
  const value = useMemo(() => ({ chrome, setAdminChrome }), [chrome, setAdminChrome]);
  return <AdminChromeContext.Provider value={value}>{children}</AdminChromeContext.Provider>;
}

export function useAdminChrome() {
  const ctx = useContext(AdminChromeContext);
  if (!ctx) {
    throw new Error('useAdminChrome must be used within AdminChromeProvider');
  }
  return ctx;
}
