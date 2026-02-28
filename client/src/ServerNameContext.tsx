import { createContext, useContext, useEffect, useState } from 'react';
import type { ServerSettings } from './api';
import { serverSettings as serverSettingsApi, serverVersion, VersionInfo } from './api';

type ServerNameContextValue = {
  rawName: string | null;
  displayName: string;
  serverTagline: string;
  reload: () => Promise<void>;
  setRawNameLocal: (name: string | null) => void;
  getTruncatedName: (name: string) => string; // New function to truncate names to 32 chars
};

const DEFAULT_BASE_NAME = 'Chagourtee';
const MAX_SERVER_NAME_LENGTH = 32; // Maximum length for server name

const ServerNameContext = createContext<ServerNameContextValue | undefined>(undefined);

export function ServerNameProvider({ children }: { children: React.ReactNode }) {
  const [rawName, setRawName] = useState<string | null>(null);
  const [versionInfo, setVersionInfo] = useState<string>(''); // Store version info

  const load = async () => {
    try {
      const settings: ServerSettings = await serverSettingsApi.get();
      // Ensure the raw name doesn't exceed the maximum length
      const limitedName = settings.name && settings.name.length > MAX_SERVER_NAME_LENGTH 
        ? settings.name.substring(0, MAX_SERVER_NAME_LENGTH) 
        : settings.name;
      setRawName(limitedName ?? null);
      
      // Load version info
      const versionData: VersionInfo = await serverVersion.get();
      setVersionInfo(`${versionData.name} ${versionData.version}`);
    } catch (e) {
      // If request fails (e.g. not logged in yet), just keep default
      console.error('Failed to load server settings or version info', e);
      
      // Fallback to default version info if loading fails
      setVersionInfo(DEFAULT_BASE_NAME);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const displayName = `${rawName && rawName.trim().length > 0 ? rawName.trim() : DEFAULT_BASE_NAME}`;
  
  // Function to truncate names to the maximum length
  const getTruncatedName = (name: string): string => {
    return name.length > MAX_SERVER_NAME_LENGTH 
      ? name.substring(0, MAX_SERVER_NAME_LENGTH) 
      : name;
  };

  const value: ServerNameContextValue = {
    rawName,
    displayName,
    serverTagline: versionInfo, // Use version info as tagline
    reload: load,
    setRawNameLocal: setRawName,
    getTruncatedName,
  };

  // Set document title whenever displayName changes (without tagline)
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