import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext'; // Import the auth context
import logoImage from '../assets/Images/Chagourtee_512px.png';

export default function InternalServerError() {
  const navigate = useNavigate();
  const { logout: doLogout } = useAuth(); // Get the logout function from auth context
  const [errorDetails, setErrorDetails] = useState<{ url?: string; status?: string } | null>(null);

  useEffect(() => {
    // Check if there are error details stored in sessionStorage
    const lastErrorStatus = sessionStorage.getItem('lastErrorStatus');
    const lastErrorUrl = sessionStorage.getItem('lastErrorUrl');
    
    if (lastErrorStatus || lastErrorUrl) {
      setErrorDetails({
        status: lastErrorStatus || undefined,
        url: lastErrorUrl || undefined
      });
      
      // Clear the session storage after reading
      sessionStorage.removeItem('lastErrorStatus');
      sessionStorage.removeItem('lastErrorUrl');
    }
  }, []);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleLogout = async () => {
    try {
      // Actually perform the logout
      await doLogout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if logout fails, still redirect to login
    } finally {
      navigate('/login');
    }
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
      }}
    >
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-large)',
            padding: '2.5rem 2rem',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          {/* Logo at the top */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img
              src={logoImage}
              alt="Chagourtee Logo"
              style={{
                maxWidth: '100px',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
                filter: 'grayscale(100%) opacity(0.7)', // Apply monochrome effect as per spec
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                fontSize: '4rem',
                fontWeight: 'bold',
                color: 'var(--danger)',
                lineHeight: '1',
                marginBottom: '1rem',
              }}
            >
              500
            </div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                margin: '0 0 1rem 0',
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Внутренняя ошибка сервера
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Произошла внутренняя ошибка сервера. Возможно, вы обнаружили программную ошибку в коде.
              Администраторы могут использовать детали ошибки ниже для диагностики проблемы.
            </p>
            
            {errorDetails && (
              <div 
                style={{ 
                  backgroundColor: 'rgba(255, 71, 87, 0.1)', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-default)', 
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
                }}
              >
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500, color: 'var(--danger)' }}>
                  Детали ошибки:
                </p>
                {errorDetails.status && (
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>Код состояния:</strong> {errorDetails.status}
                  </p>
                )}
                {errorDetails.url && (
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>Адрес запроса:</strong> {errorDetails.url}
                  </p>
                )}
                <p style={{ marginTop: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  Эти данные будут автоматически удалены после закрытия этой страницы.
                </p>
              </div>
            )}
            
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'var(--bg)', 
              borderRadius: 'var(--radius-default)', 
              textAlign: 'left'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)' }}>Что произошло?</h3>
              <p style={{ margin: '0.5rem 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Сервер столкнулся с неожиданной ситуацией, которая помешала ему выполнить запрос. 
                Это может быть вызвано ошибками в серверном коде, проблемами с конфигурацией или 
                непредвиденными исключениями.
              </p>
              
              <h3 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--accent)' }}>Что делать дальше?</h3>
              <ul style={{ textAlign: 'left', paddingLeft: '1.25rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <li>Попробуйте обновить страницу через несколько секунд</li>
                <li>Сообщите администратору о времени и характере возникновения ошибки</li>
                <li>Если ошибка повторяется, возможно, она связана с определенным действием, которое стоит избегать до устранения проблемы</li>
              </ul>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <button
              onClick={handleGoHome}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-default)',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 500,
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--accent)';
              }}
            >
              Вернуться на главную
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-default)',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 500,
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--bg)';
              }}
            >
              Выйти и повторить вход
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}