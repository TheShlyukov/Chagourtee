import { Route, Navigate, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ServerNameProvider } from './ServerNameContext';
import Layout from './Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import VerificationWaiting from './pages/VerificationWaiting';
import AccountDeleted from './pages/AccountDeleted';
import AccountRejected from './pages/AccountRejected';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Загрузка…</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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
        <AppRoutes />
      </ServerNameProvider>
    </AuthProvider>
  );
}