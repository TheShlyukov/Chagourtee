import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import logoImage from '../assets/Images/Chagourtee_512px.png';
import { helpLinks } from '../constants/help';
import { IconAlertCircle } from '../components/icons/Icons';

export default function Forbidden() {
  const navigate = useNavigate();
  const { logout: doLogout, user } = useAuth();

  const handleGoChat = () => {
    navigate('/chat');
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await doLogout();
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
    navigate('/login');
  };

  return (
    <div className="full-page-error">
      <div className="full-page-error-inner">
        <div className="full-page-error-card">
          <img src={logoImage} alt="" className="full-page-error-logo" />
          <div className="icon-inline full-page-error-icon full-page-error-icon--danger">
            <IconAlertCircle title="Ошибка" />
          </div>
          <h1 className="full-page-error-title">Доступ запрещён</h1>
          <p className="full-page-error-text">
            У вас нет прав для просмотра этой страницы. Если вы считаете, что это ошибка, войдите под другой учётной
            записью или обратитесь к владельцу сервера.
          </p>
          <div className="full-page-error-actions">
            {user ? (
              <button type="button" onClick={handleGoChat}>
                Перейти в чат
              </button>
            ) : null}
            <button type="button" className="secondary" onClick={handleLogout}>
              {user ? 'Сменить аккаунт' : 'На страницу входа'}
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
