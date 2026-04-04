import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type SettingsChromeValue = {
  sectionTitle: string;
  panelOpen: boolean;
  onBack: () => void;
};

type Ctx = {
  chrome: SettingsChromeValue | null;
  setSettingsChrome: (value: SettingsChromeValue | null) => void;
};

const SettingsChromeContext = createContext<Ctx | null>(null);

export function SettingsChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<SettingsChromeValue | null>(null);
  const setSettingsChrome = useCallback((value: SettingsChromeValue | null) => {
    setChrome(value);
  }, []);
  const value = useMemo(() => ({ chrome, setSettingsChrome }), [chrome, setSettingsChrome]);
  return <SettingsChromeContext.Provider value={value}>{children}</SettingsChromeContext.Provider>;
}

export function useSettingsChrome() {
  const ctx = useContext(SettingsChromeContext);
  if (!ctx) {
    throw new Error('useSettingsChrome must be used within SettingsChromeProvider');
  }
  return ctx;
}
