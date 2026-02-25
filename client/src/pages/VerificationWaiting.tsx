import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { verification } from '../api';
import { useNavigate } from 'react-router-dom';

export default function VerificationWaiting() {
  const { user, refresh } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Refresh user data periodically to check verification status
    const interval = setInterval(() => {
      refresh();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    // If user becomes verified, redirect to home
    if (user?.verified) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleUseCode = async () => {
    if (!verificationCode.trim()) {
      setError('Введите код для верификации');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await verification.useCode(verificationCode);
      setSuccess('Верификация прошла успешно! Перенаправление...');
      // Refresh user data to update verification status
      await refresh();
      // Wait a moment before navigating
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при верификации');
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div className="card" style={{ border: '2px solid var(--danger)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.2rem', color: 'var(--danger)'}}>⏳ Ожидание верификации</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Ваш аккаунт ожидает подтверждения от владельца сервера. 
            Вы можете использовать одноразовый код для мгновенной верификации, если он у вас есть.
          </p>
          
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Использовать одноразовый код</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Введите код верификации"
                style={{ flex: 1, minWidth: '200px' }}
              />
              <button 
                onClick={handleUseCode}
                style={{ whiteSpace: 'nowrap' }}
              >
                Применить код
              </button>
            </div>
            {error && <p className="error" style={{ margin: '0.5rem 0 0 0' }}>{error}</p>}
            {success && <p style={{ color: 'var(--success)', margin: '0.5rem 0 0 0' }}>{success}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}