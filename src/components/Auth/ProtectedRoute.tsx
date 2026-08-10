import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isAuthenticated, user, token, isLoading } = useAuthStore();
  const location = useLocation();

  // Wait for persist rehydrate + checkAuth before redirecting
  if (isLoading || (token && !isAuthenticated && !user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-void">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-signal/30 border-t-signal rounded-full animate-spin" />
          <span className="text-sm text-muted font-mono">Restoring session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-display font-bold text-ink mb-2">Access Denied</h2>
          <p className="text-sm text-muted">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
