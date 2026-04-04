import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function AccountDeleted() {
  const [reason, setReason] = useState<string | null>(null);
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reasonParam = params.get('reason');
    setReason(reasonParam ? decodeURIComponent(reasonParam) : 'Администратором');
  }, [location]);

  const handleGoToLogin = () => {
    logout();
  };

  return (
    <div className="account-status-page">
      <div className="account-status-card">
        <div className="account-status-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
          </svg>
        </div>

        <h1 className="account-status-title">Аккаунт удален</h1>

        <p className="account-status-text">
          Ваш аккаунт был удален по причине: <strong>{reason}</strong>
        </p>

        <div className="account-status-actions">
          <button type="button" onClick={handleGoToLogin}>
            Перейти на страницу входа
          </button>
        </div>
      </div>
    </div>
  );
}
