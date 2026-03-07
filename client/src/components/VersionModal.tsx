import React, { useEffect } from 'react';
import { serverVersion } from '../api';
import logoImage from '../assets/Images/Chagourtee_512px.png'; // Import the logo image

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

  // Close modal when clicking outside of it
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div 
        className="modal-content"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-medium)',
          padding: '1.5rem',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <img 
            src={logoImage} 
            alt="Chagourtee Logo" 
            style={{ 
              maxWidth: '80px', 
              height: 'auto',
              marginBottom: '0.75rem'
            }} 
          />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--text)', alignSelf: 'center' }}>О приложении</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '0.25rem',
              borderRadius: 'var(--radius-small)',
              position: 'absolute',
              top: '1rem',
              right: '1rem',
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Загрузка информации...</p>
          ) : error ? (
            <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</p>
          ) : (
            <div>
              <p style={{ margin: '0.5rem 0', color: 'var(--text)' }}>
                Версия: {versionInfo?.version}
              </p>
              <p style={{ margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Работает на {versionInfo?.name}
              </p>
            </div>
          )}
          
          <a 
            href="https://github.com/TheShlyukov/Chagourtee" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginTop: '1rem',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: '0.95rem',
            }}
          >
            GitHub Repository ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default VersionModal;