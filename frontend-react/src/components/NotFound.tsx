import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6">
        <div className="text-8xl font-display font-bold text-signal/20">404</div>
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-900">Page Not Found</h1>
          <p className="text-sm text-stone-400 mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-ghost flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary flex items-center gap-2"
          >
            <Home size={16} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
