import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LifeBuoy, LogOut, SearchX } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import PortalHome from './PortalHome';
import RequestForm from './RequestForm';
import ReportIssue from './ReportIssue';
import ArticleView from './ArticleView';
import { IncidentTicket, RequestTicket } from './TicketDetail';
import { BackLink, Card, EmptyState } from './ui';

/**
 * End-user self-service portal ("WeCrew Help Center").
 * Mounted at `/portal/*` OUTSIDE the agent `.app-shell`, so it uses its own light palette.
 */
export default function PortalApp() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const isRequester = user?.role === 'REQUESTER';
  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-body text-[#0F172A] antialiased" style={{ colorScheme: 'light' }}>
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[#FFFFFF] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[#4338CA] focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-[#FFFFFF]/90 backdrop-blur supports-[backdrop-filter]:bg-[#FFFFFF]/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            to="/portal"
            className="flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-sm" aria-hidden="true">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <span className="truncate font-display text-base font-semibold text-[#0F172A] sm:text-lg">WeCrew Help Center</span>
          </Link>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user && !isRequester && (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[#4338CA] hover:bg-[#EEF2FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Argus</span>
                <span className="sr-only sm:hidden">Back to Argus</span>
              </Link>
            )}
            {fullName && (
              <span className="hidden max-w-[12rem] truncate px-2 text-sm text-[#475569] md:inline" title={user?.email}>
                {fullName}
              </span>
            )}
            {fullName && (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E0E7FF] text-xs font-semibold text-[#3730A3] md:hidden"
                aria-label={`Signed in as ${fullName}`}
                role="img"
              >
                {(user?.firstName?.[0] ?? '').toUpperCase()}{(user?.lastName?.[0] ?? '').toUpperCase()}
              </span>
            )}
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-2 text-sm font-medium text-[#334155] hover:bg-[#F1F5F9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main id="portal-main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Routes>
          <Route index element={<PortalHome />} />
          <Route path="new/:itemId" element={<RequestForm />} />
          <Route path="report" element={<ReportIssue />} />
          <Route path="requests/:id" element={<RequestTicket />} />
          <Route path="incidents/:id" element={<IncidentTicket />} />
          <Route path="knowledge/:id" element={<ArticleView />} />
          <Route path="*" element={<PortalNotFound />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-[#475569] sm:px-6">
        Need urgent help? Report a problem and mark it <strong className="font-semibold text-[#334155]">High</strong> urgency.
      </footer>
    </div>
  );
}

function PortalNotFound() {
  return (
    <div className="space-y-4">
      <BackLink />
      <Card>
        <EmptyState icon={<SearchX className="h-6 w-6" />} title="Page not found">
          The page you're looking for doesn't exist. Head back to the Help Center to find what you need.
        </EmptyState>
      </Card>
    </div>
  );
}
