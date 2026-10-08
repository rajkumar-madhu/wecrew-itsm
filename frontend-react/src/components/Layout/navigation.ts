// ═══════════════════════════════════════════════════════════
// Argus ITSM — Navigation map
// Six work hubs plus Admin. Shared by the Sidebar and the command palette.
// ═══════════════════════════════════════════════════════════

import {
  LayoutDashboard, AlertTriangle, GitBranch, Bug, Bell,
  Server, Network, Brain, Zap, BarChart3, Plug, Users,
  Settings, Shield, Eye, MessageSquare, Mic, Activity, Phone, Layers, MessagesSquare,
  Monitor, CalendarDays, CalendarClock, GitMerge, Terminal,
  BookOpen, Clock, FileSearch, UserCircle, Home, LifeBuoy, Radar, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  roles?: string[];
  badge?: 'LIVE' | 'AI' | 'NEW';
  /** Extra words the command palette matches on */
  keywords?: string;
}

export interface NavHub {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  items: NavItem[];
}

export const NAV_HUBS: NavHub[] = [
  {
    id: 'home', label: 'Home', icon: Home, description: 'Overview, AI insights and reports',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true, keywords: 'overview home kpi' },
      { to: '/ai-insights', icon: Brain, label: 'AI Insights', badge: 'AI', keywords: 'predictions anomalies' },
      { to: '/reports', icon: BarChart3, label: 'Reports', keywords: 'analytics mttr mtta export' },
    ],
  },
  {
    id: 'service-desk', label: 'Service Desk', icon: LifeBuoy, description: 'Incidents, problems and SLAs',
    items: [
      { to: '/incidents', icon: AlertTriangle, label: 'Incidents', keywords: 'tickets inc outage' },
      { to: '/problems', icon: Bug, label: 'Problems', keywords: 'rca root cause prb kedb' },
      { to: '/sla', icon: Clock, label: 'SLA Policies', keywords: 'targets response resolution breach' },
    ],
  },
  {
    id: 'change', label: 'Change', icon: GitBranch, description: 'Changes, calendar and maintenance',
    items: [
      { to: '/changes', icon: GitBranch, label: 'Changes', end: true, keywords: 'chg cab release deploy' },
      { to: '/changes/calendar', icon: CalendarDays, label: 'Change Calendar', keywords: 'schedule freeze' },
      { to: '/maintenance', icon: CalendarClock, label: 'Maintenance Windows', keywords: 'downtime planned' },
    ],
  },
  {
    id: 'observe', label: 'Observe', icon: Radar, description: 'Alerts, health, metrics, logs and CMDB',
    items: [
      { to: '/alerts', icon: Bell, label: 'Alerts', keywords: 'prometheus grafana firing' },
      { to: '/apm', icon: Eye, label: 'Service Health', badge: 'LIVE', keywords: 'apm latency errors' },
      { to: '/metrics', icon: Activity, label: 'Metrics', keywords: 'cpu memory prometheus' },
      { to: '/logs', icon: Terminal, label: 'Log Explorer', keywords: 'loki logs search' },
      { to: '/k8s', icon: Layers, label: 'Kubernetes', keywords: 'pods nodes cluster k8s' },
      { to: '/network', icon: Network, label: 'Network', keywords: 'topology' },
      { to: '/assets', icon: Server, label: 'Assets / CMDB', keywords: 'ci configuration items servers' },
      { to: '/noc', icon: Monitor, label: 'NOC View', badge: 'LIVE', keywords: 'wallboard tv' },
    ],
  },
  {
    id: 'oncall', label: 'On-Call', icon: Phone, description: 'Schedules, escalation and paging',
    items: [
      { to: '/oncall', icon: Phone, label: 'On-Call', keywords: 'rota roster who is on call' },
      { to: '/oncall-calendar', icon: CalendarDays, label: 'On-Call Calendar', keywords: 'schedule shifts' },
      { to: '/escalation', icon: GitMerge, label: 'Escalation Policies', keywords: 'paging levels' },
      { to: '/pagerduty', icon: Bell, label: 'PagerDuty' },
      { to: '/chat', icon: MessagesSquare, label: 'Team Chat', badge: 'LIVE', keywords: 'messages war room' },
      { to: '/sms', icon: MessageSquare, label: 'SMS Gateway', keywords: 'text messages' },
      { to: '/voice', icon: Mic, label: 'Voice Agent', keywords: 'calls phone' },
    ],
  },
  {
    id: 'knowledge', label: 'Knowledge', icon: BookOpen, description: 'Known errors and runbook automation',
    items: [
      { to: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base', keywords: 'kb articles known errors workaround' },
      { to: '/automation', icon: Zap, label: 'Automation', keywords: 'runbooks remediation pipeline' },
    ],
  },
];

export const ADMIN_HUB: NavHub = {
  id: 'admin', label: 'Admin', icon: Wrench, description: 'Organization, people and integrations',
  items: [
    { to: '/teams', icon: Users, label: 'Teams', keywords: 'groups members' },
    { to: '/users', icon: Shield, label: 'Users', roles: ['ADMIN', 'MANAGER'], keywords: 'people accounts roles' },
    { to: '/integrations', icon: Plug, label: 'Integrations', roles: ['ADMIN'], keywords: 'slack prometheus grafana webhooks' },
    { to: '/audit', icon: FileSearch, label: 'Audit Log', roles: ['ADMIN', 'MANAGER'], keywords: 'history who changed' },
    { to: '/settings', icon: Settings, label: 'Settings', keywords: 'preferences password mfa security' },
    { to: '/profile', icon: UserCircle, label: 'My Profile', keywords: 'account me' },
  ],
};

export function visibleItems(hub: NavHub, role: string): NavItem[] {
  return hub.items.filter((i) => !i.roles || i.roles.includes(role));
}

/** Which hub owns a pathname (longest matching prefix wins) */
export function hubForPath(pathname: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const hub of [...NAV_HUBS, ADMIN_HUB]) {
    for (const item of hub.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        if (!best || item.to.length > best.len) best = { id: hub.id, len: item.to.length };
      }
    }
  }
  return best?.id ?? null;
}
