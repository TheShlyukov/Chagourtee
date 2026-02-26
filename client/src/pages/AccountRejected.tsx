import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function AccountRejected() {
  const [message, setMessage] = useState<string | null>(null);
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    // Extract the message from URL query parameters
    const params = new URLSearchParams(location.search);
    const messageParam = params.get('message');
    setMessage(messageParam ? decodeURIComponent(messageParam) : 'Ваша заявка на верификацию была отклонена');
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
        borderRadius: 'var(--radius-large)',
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
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        
        <h1 style={{ 
          fontSize: '1.75rem', 
          fontWeight: 700, 
          marginBottom: '1rem',
          color: 'var(--text)',
        }}>
          Аккаунт отклонен
        </h1>
        
        <p style={{ 
          fontSize: '1.1rem', 
          color: 'var(--text-muted)', 
          marginBottom: '2rem',
          lineHeight: 1.6,
        }}>
          {message}
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={handleGoToLogin}
            style={{
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              borderRadius: 'var(--radius-default)',
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