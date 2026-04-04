import React, { useEffect } from 'react';
import { serverVersion } from '../api';
import logoImage from '../assets/Images/Chagourtee_512px.png';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose }) => {
  const [versionInfo, setVersionInfo] = React.useState<{ version: string; name: string } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchVersion = async () => {
        try {
          setLoading(true);
          const data = await serverVersion.get();
          setVersionInfo({
            version: data.version,
            name: data.name,
          });
        } catch (err) {
          console.error('Error fetching version:', err);
          setError('Не удалось получить информацию о версии');
        } finally {
          setLoading(false);
        }
      };

      fetchVersion();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="version-modal-overlay" onClick={onClose} role="presentation">
      <div className="version-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="version-modal-heading">
        <button type="button" className="version-modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="version-modal-header">
          <img src={logoImage} alt="" className="version-modal-logo" />
          <h3 id="version-modal-heading" className="version-modal-title">
            О приложении
          </h3>
        </div>

        <div className="version-modal-body">
          {loading ? (
            <p className="version-modal-muted">Загрузка информации...</p>
          ) : error ? (
            <p className="version-modal-error">{error}</p>
          ) : (
            <div>
              <p className="version-modal-row">Версия: {versionInfo?.version}</p>
              <p className="version-modal-row-muted">Работает на {versionInfo?.name}</p>
            </div>
          )}

          <a
            href="https://github.com/TheShlyukov/Chagourtee"
            target="_blank"
            rel="noopener noreferrer"
            className="version-modal-github"
          >
            GitHub Repository ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default VersionModal;
