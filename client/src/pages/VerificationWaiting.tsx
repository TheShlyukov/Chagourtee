import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { verification } from '../api';
import { useNavigate } from 'react-router-dom';
import { IconHourglass } from '../components/icons/Icons';

export default function VerificationWaiting() {
  const { user, refresh } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
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
      await refresh();
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при верификации');
    }
  };

  return (
    <div className="page-content page-content--max-800">
      <div className="verify-page-stack">
        <div className="card card-verify-danger">
          <h3 className="verify-title-danger">
            <span className="icon-inline" aria-hidden>
              <IconHourglass />
            </span>
            Ожидание верификации
          </h3>
          <p className="settings-lead muted-text">
            Ваш аккаунт ожидает подтверждения от владельца сервера. Вы можете использовать одноразовый код для
            мгновенной верификации, если он у вас есть.
          </p>

          <div className="verify-section">
            <h4>Использовать одноразовый код</h4>
            <div className="verify-code-row">
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Введите код верификации"
                className="verify-code-input"
              />
              <button type="button" onClick={handleUseCode} className="verify-code-btn">
                Применить код
              </button>
            </div>
            {error && <p className="error error-margin-top">{error}</p>}
            {success && <p className="success-margin-top">{success}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
