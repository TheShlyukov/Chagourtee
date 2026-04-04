import { Navigate } from 'react-router-dom';

/** Совместимость со старыми ссылками /profile */
export default function Profile() {
  return <Navigate to="/settings" replace />;
}
