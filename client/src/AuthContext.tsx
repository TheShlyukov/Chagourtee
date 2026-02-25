import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, User } from './api';
import { 
  initializeWebSocket, 
  closeWebSocket, 
  addMessageHandler, 
  removeMessageHandler,
  isWebSocketConnected 
} from './websocket';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Message handler for auth-related events
  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'user_deleted':
        // Use a more robust comparison to handle potential type differences
        // and check that user is not null
        if (user && Number(data.userId) === Number(user.id)) {
          // Navigate to account deleted page instead of showing alert
          navigate(`/account-deleted?reason=${encodeURIComponent(data.reason || 'Администратором')}`);
        }
        break;
        
      case 'user_verified':
        if (user && Number(data.userId) === Number(user.id)) {
          // Refresh user data to reflect verification status
          refresh();
        }
        break;
        
      case 'user_rejected':
        if (user && Number(data.userId) === Number(user.id)) {
          // Navigate to account rejected page instead of showing alert
          navigate(`/account-rejected?message=${encodeURIComponent(data.message || 'Ваша заявка на верификацию была отклонена')}`);
        }
        break;
        
      case 'verification_settings_updated':
        // We could handle this if needed, but typically settings changes
        // would be noticed on subsequent page loads or API calls
        break;
    }
  };

  // Connect to WebSocket and handle events
  useEffect(() => {
    if (!user) {
      // Close WebSocket when user is not authenticated
      closeWebSocket();
      return;
    }

    // Initialize WebSocket connection
    initializeWebSocket();

    // Add message handler for auth-related events
    addMessageHandler(handleMessage);

    // Handle visibility change to manage WebSocket connection when tab is not active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isWebSocketConnected()) {
        console.log('Tab became visible, attempting to reconnect to WebSocket...');
        initializeWebSocket();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeMessageHandler(handleMessage);
    };
  }, [user, navigate]); // Make sure to reinitialize when user changes

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('chagourtee_token'); // In case token was stored
      closeWebSocket(); // Close WebSocket on logout
      navigate('/login');
    }
  };

  const refresh = async () => {
    if (!user) {
      try {
        const userData = await api<User>('/api/auth/me');
        setUser(userData);
      } catch (error) {
        // User is not logged in or session expired
        setUser(null);
      }
    } else {
      try {
        const userData = await api<User>('/api/auth/me');
        setUser(userData);
      } catch (error) {
        // Session may have expired
        setUser(null);
        navigate('/login');
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await api<User>('/api/auth/me');
        setUser(userData);
      } catch (error) {
        // Not authenticated
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (login: string, password: string) => {
    setLoading(true);
    try {
      const response = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      setUser(response.user);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await handleLogout();
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refresh,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Export the hook to allow other components to access the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}