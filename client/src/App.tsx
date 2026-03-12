import React, { useRef } from 'react';
import { Route, Navigate, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ServerNameProvider } from './ServerNameContext';
import { UserListPanelProvider } from './UserListPanelContext';
import { ToastProvider } from './ToastContext';
import Layout from './Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import VerificationWaiting from './pages/VerificationWaiting';
import AccountDeleted from './pages/AccountDeleted';
import AccountRejected from './pages/AccountRejected';
import InternalServerError from './pages/InternalServerError'; // Import the new 500 error page

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const hasDecided = useRef<'unknown' | 'redirect' | 'show-form'>('unknown');
  const renderDecision = useRef<'redirect' | 'show-form' | 'loading'>('loading');
  
  // Only make the decision once, early in the component lifecycle
  if (hasDecided.current === 'unknown' && !loading) {
    if (user) {
      hasDecided.current = 'redirect';
      renderDecision.current = 'redirect';
    } else {
      hasDecided.current = 'show-form';
      renderDecision.current = 'show-form';
    }
  }
  
  // If decided to redirect, do it regardless of current user state
  if (renderDecision.current === 'redirect') {
    return <Navigate to="/" replace />;
  }
  
  // If still determining initial state
  if (renderDecision.current === 'loading') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка…</div>;
  }
  
  // Otherwise, show the form
  return <>{children}</>;
};

function VerificationCheckRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.verified) return <VerificationWaiting />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicOnlyRoute>
          <Login />
        </PublicOnlyRoute>
      } />
      <Route path="/register" element={
        <PublicOnlyRoute>
          <Register />
        </PublicOnlyRoute>
      } />
      <Route path="/account-deleted" element={<AccountDeleted />} />
      <Route path="/account-rejected" element={<AccountRejected />} />
      <Route path="/500" element={<InternalServerError />} /> {/* Add route for 500 error page */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={
          <VerificationCheckRoute>
            <Chat />
          </VerificationCheckRoute>
        } />
        <Route path="chat/:roomId" element={
          <VerificationCheckRoute>
            <Chat />
          </VerificationCheckRoute>
        } />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={
          <VerificationCheckRoute>
            <Admin />
          </VerificationCheckRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ServerNameProvider>
        <UserListPanelProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </UserListPanelProvider>
      </ServerNameProvider>
    </AuthProvider>
  );
}