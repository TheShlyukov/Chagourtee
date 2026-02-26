import React, { useState, useEffect } from 'react';
import { serverVersion, VersionInfo } from '../api';

const ServerVersion: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const data = await serverVersion.get();
        setVersionInfo(data);
        setLoading(false);
      } catch (err) {
        setError((err as Error).message || 'Failed to fetch server version');
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1">
        Loading version...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400 px-2 py-1">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1">
      {versionInfo?.name} {versionInfo?.version}
    </div>
  );
};

export default ServerVersion;