import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import logoImage from '../assets/Images/Chagourtee_512px.png';

export default function InternalServerError() {
  const navigate = useNavigate();
  const { logout: doLogout } = useAuth();
  const [errorDetails, setErrorDetails] = useState<{ url?: string; status?: string } | null>(null);

  useEffect(() => {
    const lastErrorStatus = sessionStorage.getItem('lastErrorStatus');
    const lastErrorUrl = sessionStorage.getItem('lastErrorUrl');

    if (lastErrorStatus || lastErrorUrl) {
      setErrorDetails({
        status: lastErrorStatus || undefined,
        url: lastErrorUrl || undefined,
      });
      sessionStorage.removeItem('lastErrorStatus');
      sessionStorage.removeItem('lastErrorUrl');
    }
  }, []);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      await doLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="full-page-error">
      <div className="full-page-error-inner">
        <div className="full-page-error-card">
          <div className="error-500-logo-wrap">
            <img src={logoImage} alt="Chagourtee Logo" className="error-500-logo" />
          </div>

          <div className="error-500-code">500</div>
          <h1 className="error-500-title">Внутренняя ошибка сервера</h1>
          <p className="error-500-lead">
            Произошла внутренняя ошибка сервера. Возможно, вы обнаружили программную ошибку в коде. Администраторы
            могут использовать детали ошибки ниже для диагностики проблемы.
          </p>

          {errorDetails && (
            <div className="error-500-details">
              <p className="error-500-details-title">Детали ошибки:</p>
              {errorDetails.status && (
                <p className="error-500-details-row">
                  <strong>Код состояния:</strong> {errorDetails.status}
                </p>
              )}
              {errorDetails.url && (
                <p className="error-500-details-row">
                  <strong>Адрес запроса:</strong> {errorDetails.url}
                </p>
              )}
              <p className="error-500-details-foot">Эти данные будут автоматически удалены после закрытия этой страницы.</p>
            </div>
          )}

          <div className="error-500-help">
            <h3>Что произошло?</h3>
            <p>
              Сервер столкнулся с неожиданной ситуацией, которая помешала ему выполнить запрос. Это может быть вызвано
              ошибками в серверном коде, проблемами с конфигурацией или непредвиденными исключениями.
            </p>
            <h3>Что делать дальше?</h3>
            <ul>
              <li>Попробуйте обновить страницу через несколько секунд</li>
              <li>Сообщите администратору о времени и характере возникновения ошибки</li>
              <li>Если ошибка повторяется, возможно, она связана с определённым действием, которое стоит избегать до устранения проблемы</li>
            </ul>
          </div>

          <div className="error-500-actions">
            <button type="button" onClick={handleGoHome}>
              Вернуться на главную
            </button>
            <button type="button" className="secondary" onClick={handleLogout}>
              Выйти и повторить вход
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
