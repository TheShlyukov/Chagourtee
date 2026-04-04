import { useEffect, useState } from 'react';
import logoImage from '../assets/Images/Chagourtee_512px.png';
import { helpLinks } from '../constants/help';
import { IconWifiOff } from '../components/icons/Icons';

const REASON_KEY = 'chagourtee_offline_reason';

export default function Offline() {
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    try {
      setReason(sessionStorage.getItem(REASON_KEY));
      sessionStorage.removeItem(REASON_KEY);
    } catch {
      setReason(null);
    }
  }, []);

  const handleRetry = () => {
    window.location.href = '/';
  };

  const isShutdown = reason === 'shutdown';

  return (
    <div className="full-page-error">
      <div className="full-page-error-inner">
        <div className="full-page-error-card">
          <img src={logoImage} alt="" className="full-page-error-logo" />
          <div className="icon-inline full-page-error-icon full-page-error-icon--muted">
            <IconWifiOff title="Нет соединения" />
          </div>
          <h1 className="full-page-error-title">{isShutdown ? 'Сервер остановлен' : 'Нет соединения с сервером'}</h1>
          <p className="full-page-error-text">
            {isShutdown
              ? 'Сервер был корректно остановлен. Обновите страницу после того, как администратор снова запустит сервис.'
              : 'Проверьте сеть и убедитесь, что сервер Chagourtee запущен. Страница обновится после восстановления связи.'}
          </p>
          <div className="full-page-error-actions">
            <button type="button" onClick={handleRetry}>
              Попробовать снова
            </button>
          </div>
          <div className="help-links muted-text">
            <a href={helpLinks.docs} target="_blank" rel="noreferrer">
              Документация
            </a>
            ·
            <a href={helpLinks.issues} target="_blank" rel="noreferrer">
              Сообщить о проблеме
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
