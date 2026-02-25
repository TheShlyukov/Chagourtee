import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function AccountDeleted() {
  const [reason, setReason] = useState<string | null>(null);
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    // Extract the reason from URL query parameters
    const params = new URLSearchParams(location.search);
    const reasonParam = params.get('reason');
    setReason(reasonParam ? decodeURIComponent(reasonParam) : 'Администратором');
  }, [location]);

  const handleGoToLogin = () => {
    // Log out the user and redirect to login
    logout();
  };

  return (
    <div 
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'var(--gradient-bg)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ 
        width: '100%', 
        maxWidth: 500, 
        textAlign: 'center',
        padding: '2rem',
        background: 'var(--bg-elevated)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
          </svg>
        </div>
        
        <h1 style={{ 
          fontSize: '1.75rem', 
          fontWeight: 700, 
          marginBottom: '1rem',
          color: 'var(--text)',
        }}>
          Аккаунт удален
        </h1>
        
        <p style={{ 
          fontSize: '1.1rem', 
          color: 'var(--text-muted)', 
          marginBottom: '2rem',
          lineHeight: 1.6,
        }}>
          Ваш аккаунт был удален по причине: <strong>{reason}</strong>
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleGoToLogin}
            style={{
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => {
              (e.target as HTMLElement).style.background = 'var(--accent-hover)';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLElement).style.background = 'var(--accent)';
            }}
          >
            Перейти на страницу входа
          </button>
        </div>
      </div>
    </div>
  );
}