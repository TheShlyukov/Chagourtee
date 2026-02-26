import { createContext, useContext, useEffect, useState } from 'react';
import type { ServerSettings } from './api';
import { serverSettings as serverSettingsApi } from './api';

type ServerNameContextValue = {
  rawName: string | null;
  displayName: string;
  reload: () => Promise<void>;
  setRawNameLocal: (name: string | null) => void;
};

const DEFAULT_BASE_NAME = 'Chagourtee сервер';
const SUFFIX = ' (Работает на Chagourtee)';

const ServerNameContext = createContext<ServerNameContextValue | undefined>(undefined);

export function ServerNameProvider({ children }: { children: React.ReactNode }) {
  const [rawName, setRawName] = useState<string | null>(null);

  const load = async () => {
    try {
      const settings: ServerSettings = await serverSettingsApi.get();
      setRawName(settings.name ?? null);
    } catch (e) {
      // If request fails (e.g. not logged in yet), just keep default
      console.error('Failed to load server settings', e);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const displayName = `${rawName && rawName.trim().length > 0 ? rawName.trim() : DEFAULT_BASE_NAME}${SUFFIX}`;

  const value: ServerNameContextValue = {
    rawName,
    displayName,
    reload: load,
    setRawNameLocal: setRawName,
  };

  // Set document title whenever displayName changes
  useEffect(() => {
    document.title = displayName;
  }, [displayName]);

  return (
    <ServerNameContext.Provider value={value}>
      {children}
    </ServerNameContext.Provider>
  );
}

export function useServerName() {
  const ctx = useContext(ServerNameContext);
  if (!ctx) {
    throw new Error('useServerName must be used within ServerNameProvider');
  }
  return ctx;
}

