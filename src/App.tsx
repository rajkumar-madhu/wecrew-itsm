import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import Layout from './components/Layout/Layout';
import LoginPage from './components/Auth/LoginPage';
const SignupPage = lazy(() => import('./components/Auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./components/Auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./components/Auth/ResetPasswordPage'));
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';

// Public marketing site — see src/components/Public/
const PublicLayout = lazy(() => import('./components/Public/PublicLayout'));
const HomePage = lazy(() => import('./components/Public/HomePage'));
const ItsmPage = lazy(() => import('./components/Public/ItsmPage'));
const ModulesPage = lazy(() => import('./components/Public/ModulesPage'));
const SecurityPage = lazy(() => import('./components/Public/SecurityPage'));
const PricingPage = lazy(() => import('./components/Public/PricingPage'));
const PilotPage = lazy(() => import('./components/Public/PilotPage'));
const ContactPage = lazy(() => import('./components/Public/ContactPage'));

const Dashboard = lazy(() => import('./components/Dashboard/DashboardOverview'));
const IncidentList = lazy(() => import('./components/Incidents/IncidentList'));
const IncidentCreate = lazy(() => import('./components/Incidents/IncidentCreate'));
const IncidentDetail = lazy(() => import('./components/Incidents/IncidentDetail'));
const ChangeList = lazy(() => import('./components/Changes/ChangeList'));
const ChangeCreate = lazy(() => import('./components/Changes/ChangeCreate'));
const ChangeDetail = lazy(() => import('./components/Changes/ChangeDetail'));
const ProblemList = lazy(() => import('./components/Problems/ProblemList'));
const ProblemCreate = lazy(() => import('./components/Problems/ProblemCreate'));
const ProblemDetail = lazy(() => import('./components/Problems/ProblemDetail'));
const AlertList = lazy(() => import('./components/Alerts/AlertList'));
const AssetList = lazy(() => import('./components/Assets/AssetList'));
const AssetCreate = lazy(() => import('./components/Assets/AssetCreate'));
const AssetDetail = lazy(() => import('./components/Assets/AssetDetail'));
const IntegrationHub = lazy(() => import('./components/Integrations/IntegrationHub'));
const TeamList = lazy(() => import('./components/Teams/TeamList'));
const ReportsDashboard = lazy(() => import('./components/Reports/ReportsDashboard'));
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage'));
const SMSDashboard = lazy(() => import('./components/SMS/SMSDashboard'));
const VoiceDashboard = lazy(() => import('./components/Voice/VoiceDashboard'));
const NetworkTopology = lazy(() => import('./components/Network/NetworkTopology'));
const MetricsDashboard = lazy(() => import('./components/Metrics/MetricsDashboard'));
const AIInsightsDashboard = lazy(() => import('./components/AI/AIInsightsDashboard'));
const AutomationDashboard = lazy(() => import('./components/Automation/AutomationDashboard'));
const UserList = lazy(() => import('./components/Users/UserList'));
const OnCallDashboard = lazy(() => import('./components/OnCall/OnCallDashboard'));
const OnCallCalendar = lazy(() => import('./components/OnCall/OnCallCalendar'));
const NOCView = lazy(() => import('./components/NOC/NOCView'));
const EscalationPolicyBuilder = lazy(() => import('./components/Escalation/EscalationPolicyBuilder'));
const MaintenanceWindowScheduler = lazy(() => import('./components/Maintenance/MaintenanceWindowScheduler'));
const NotFound = lazy(() => import('./components/NotFound'));
const K8sClusterDashboard = lazy(() => import('./components/K8s/K8sClusterDashboard'));
const PagerDutyDashboard = lazy(() => import('./components/Integrations/PagerDutyDashboard'));
const APMDashboard = lazy(() => import('./components/APM/APMDashboard'));
const DeveloperDocs = lazy(() => import('./components/Docs/DeveloperDocs'));
const StatusPage = lazy(() => import('./components/Status/StatusPage'));
const LogExplorer = lazy(() => import('./components/Logs/LogExplorer'));
const ChangeCalendar = lazy(() => import('./components/Changes/ChangeCalendar'));
const KnowledgeBasePage = lazy(() => import('./components/KnowledgeBase/KnowledgeBasePage'));
const SLAPolicyPage = lazy(() => import('./components/SLA/SLAPolicyPage'));
const AuditLogPage = lazy(() => import('./components/Audit/AuditLogPage'));
const ProfilePage = lazy(() => import('./components/Profile/ProfilePage'));
const BillingPage = lazy(() => import('./components/Billing/BillingPage'));
const TeamChat = lazy(() => import('./components/Chat/TeamChat'));
// GPRC module (static demo data, see src/data/gprc.ts)
const GprcCommandCenter = lazy(() => import('./components/Gprc/GprcCommandCenter'));
const RiskRegister = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.RiskRegister })));
const ComplianceCenter = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.ComplianceCenter })));
const InternalAudit = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.InternalAudit })));
const PerformanceManagement = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.PerformanceManagement })));
const ControlsCapa = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.ControlsCapa })));
const EsgHub = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.EsgHub })));
const OperationalResilience = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.OperationalResilience })));
const DigitalTwin = lazy(() => import('./components/Gprc/GprcModules').then((m) => ({ default: m.DigitalTwin })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-signal/30 border-t-signal rounded-full animate-spin" />
        <span className="text-sm text-gray-500 font-mono">Loading module...</span>
      </div>
    </div>
  );
}

/**
 * "/" serves the public marketing home to visitors and sends signed-in users
 * to the app, preserving the previous redirect behaviour for them.
 *
 * Branching on `token` rather than `isLoading` is deliberate: `isLoading`
 * starts `true` on purpose (see authStore), so gating on it would blank the
 * landing page for a frame on every anonymous visit. The persisted token is
 * already there on first render, so anonymous visitors render the page
 * immediately and only a returning session pays for the /auth/me round-trip.
 */
function PublicHome() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!token) return <HomePage />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  // Stale token being validated — a failed check clears it and falls through.
  return <div style={{ minHeight: '60vh' }} />;
}

/** Public pages are lazy; each gets its own boundary so a chunk fetch never
 *  unmounts the surrounding PublicLayout chrome. */
function PublicChunk({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>{children}</Suspense>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    // Prefer rehydrate hook in store; also run once if already hydrated
    const persistApi = (useAuthStore as any).persist;
    if (persistApi?.hasHydrated?.()) {
      checkAuth();
      return;
    }
    const unsub = persistApi?.onFinishHydration?.(() => {
      checkAuth();
    });
    // Fallback if persist API missing
    const t = setTimeout(() => checkAuth(), 50);
    return () => {
      unsub?.();
      clearTimeout(t);
    };
  }, [checkAuth]);

  return (
    <Routes>
      {/* Public marketing site */}
      <Route
        element={
          <Suspense fallback={<div style={{ background: 'var(--argus-void)', minHeight: '100vh' }} />}>
            <PublicLayout />
          </Suspense>
        }
      >
        <Route path="/" element={<PublicChunk><PublicHome /></PublicChunk>} />
        <Route path="/itsm" element={<PublicChunk><ItsmPage /></PublicChunk>} />
        <Route path="/modules" element={<PublicChunk><ModulesPage /></PublicChunk>} />
        <Route path="/security" element={<PublicChunk><SecurityPage /></PublicChunk>} />
        <Route path="/pricing" element={<PublicChunk><PricingPage /></PublicChunk>} />
        <Route path="/pilot" element={<PublicChunk><PilotPage /></PublicChunk>} />
        <Route path="/contact" element={<PublicChunk><ContactPage /></PublicChunk>} />
      </Route>

      {/* Other public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
      <Route path="/signup" element={<Suspense fallback={<div style={{ background: '#fff', minHeight: '100vh' }} />}><SignupPage /></Suspense>} />
      <Route path="/docs" element={<Suspense fallback={<div className="min-h-screen bg-void" />}><DeveloperDocs /></Suspense>} />
      <Route path="/status/:orgSlug" element={<Suspense fallback={<div style={{ background: '#030711', minHeight: '100vh' }} />}><StatusPage /></Suspense>} />

      {/* Protected app routes */}
      <Route element={<ErrorBoundary><ProtectedRoute><Layout /></ProtectedRoute></ErrorBoundary>}>
        <Route path="/dashboard" element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
        <Route path="/incidents" element={<Suspense fallback={<LoadingFallback />}><IncidentList /></Suspense>} />
        <Route path="/incidents/create" element={<Suspense fallback={<LoadingFallback />}><IncidentCreate /></Suspense>} />
        <Route path="/incidents/:id" element={<Suspense fallback={<LoadingFallback />}><IncidentDetail /></Suspense>} />
        <Route path="/changes" element={<Suspense fallback={<LoadingFallback />}><ChangeList /></Suspense>} />
        <Route path="/changes/calendar" element={<Suspense fallback={<LoadingFallback />}><ChangeCalendar /></Suspense>} />
        <Route path="/changes/create" element={<Suspense fallback={<LoadingFallback />}><ChangeCreate /></Suspense>} />
        <Route path="/changes/:id" element={<Suspense fallback={<LoadingFallback />}><ChangeDetail /></Suspense>} />
        <Route path="/problems" element={<Suspense fallback={<LoadingFallback />}><ProblemList /></Suspense>} />
        <Route path="/problems/create" element={<Suspense fallback={<LoadingFallback />}><ProblemCreate /></Suspense>} />
        <Route path="/problems/:id" element={<Suspense fallback={<LoadingFallback />}><ProblemDetail /></Suspense>} />
        <Route path="/oncall" element={<Suspense fallback={<LoadingFallback />}><OnCallDashboard /></Suspense>} />
        <Route path="/oncall-calendar" element={<Suspense fallback={<LoadingFallback />}><OnCallCalendar /></Suspense>} />
        <Route path="/escalation" element={<Suspense fallback={<LoadingFallback />}><EscalationPolicyBuilder /></Suspense>} />
        <Route path="/maintenance" element={<Suspense fallback={<LoadingFallback />}><MaintenanceWindowScheduler /></Suspense>} />
        <Route path="/noc" element={<Suspense fallback={<LoadingFallback />}><NOCView /></Suspense>} />
        <Route path="/alerts" element={<Suspense fallback={<LoadingFallback />}><AlertList /></Suspense>} />
        <Route path="/assets" element={<Suspense fallback={<LoadingFallback />}><AssetList /></Suspense>} />
        <Route path="/assets/create" element={<Suspense fallback={<LoadingFallback />}><AssetCreate /></Suspense>} />
        <Route path="/assets/:id" element={<Suspense fallback={<LoadingFallback />}><AssetDetail /></Suspense>} />
        <Route path="/network" element={<Suspense fallback={<LoadingFallback />}><NetworkTopology /></Suspense>} />
        <Route path="/metrics" element={<Suspense fallback={<LoadingFallback />}><MetricsDashboard /></Suspense>} />
        <Route path="/ai-insights" element={<Suspense fallback={<LoadingFallback />}><AIInsightsDashboard /></Suspense>} />
        <Route path="/automation" element={<Suspense fallback={<LoadingFallback />}><AutomationDashboard /></Suspense>} />
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <Suspense fallback={<LoadingFallback />}><UserList /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/integrations" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Suspense fallback={<LoadingFallback />}><IntegrationHub /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/billing" element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <Suspense fallback={<LoadingFallback />}><BillingPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/teams" element={<Suspense fallback={<LoadingFallback />}><TeamList /></Suspense>} />
        <Route path="/reports" element={<Suspense fallback={<LoadingFallback />}><ReportsDashboard /></Suspense>} />
        <Route path="/gprc" element={<Suspense fallback={<LoadingFallback />}><GprcCommandCenter /></Suspense>} />
        <Route path="/risk" element={<Suspense fallback={<LoadingFallback />}><RiskRegister /></Suspense>} />
        <Route path="/compliance" element={<Suspense fallback={<LoadingFallback />}><ComplianceCenter /></Suspense>} />
        <Route path="/internal-audit" element={<Suspense fallback={<LoadingFallback />}><InternalAudit /></Suspense>} />
        <Route path="/performance" element={<Suspense fallback={<LoadingFallback />}><PerformanceManagement /></Suspense>} />
        <Route path="/controls" element={<Suspense fallback={<LoadingFallback />}><ControlsCapa /></Suspense>} />
        <Route path="/esg" element={<Suspense fallback={<LoadingFallback />}><EsgHub /></Suspense>} />
        <Route path="/resilience" element={<Suspense fallback={<LoadingFallback />}><OperationalResilience /></Suspense>} />
        <Route path="/digital-twin" element={<Suspense fallback={<LoadingFallback />}><DigitalTwin /></Suspense>} />
        <Route path="/sms" element={<Suspense fallback={<LoadingFallback />}><SMSDashboard /></Suspense>} />
        <Route path="/chat" element={<Suspense fallback={<LoadingFallback />}><TeamChat /></Suspense>} />
        <Route path="/voice" element={<Suspense fallback={<LoadingFallback />}><VoiceDashboard /></Suspense>} />
        <Route path="/k8s" element={<Suspense fallback={<LoadingFallback />}><K8sClusterDashboard /></Suspense>} />
        <Route path="/logs" element={<Suspense fallback={<LoadingFallback />}><LogExplorer /></Suspense>} />
        <Route path="/pagerduty" element={<Suspense fallback={<LoadingFallback />}><PagerDutyDashboard /></Suspense>} />
        <Route path="/apm" element={<Suspense fallback={<LoadingFallback />}><APMDashboard /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<LoadingFallback />}><SettingsPage /></Suspense>} />
        <Route path="/knowledge-base" element={<Suspense fallback={<LoadingFallback />}><KnowledgeBasePage /></Suspense>} />
        <Route path="/sla" element={<Suspense fallback={<LoadingFallback />}><SLAPolicyPage /></Suspense>} />
        <Route path="/audit" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
            <Suspense fallback={<LoadingFallback />}><AuditLogPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={<Suspense fallback={<LoadingFallback />}><ProfilePage /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<LoadingFallback />}><NotFound /></Suspense>} />
      </Route>
    </Routes>
  );
}
