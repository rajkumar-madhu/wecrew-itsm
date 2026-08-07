# Argus ITSM — Frontend routes & nav map

Base UI: http://127.0.0.1:5174/

## Public
| Path | Page |
|------|------|
| `/` | Landing / redirect home |
| `/login` | Login |
| `/signup` | Signup |
| `/docs` | Developer docs |
| `/status/:orgSlug` | Public status page |

## Protected (sidebar)

### Operations
| Path | Nav label |
|------|-----------|
| `/dashboard` | Dashboard |
| `/incidents` | Incidents |
| `/incidents/create` | (from list) |
| `/incidents/:id` | detail |
| `/changes` | Changes |
| `/changes/calendar` | Change Calendar |
| `/changes/create` | (from list) |
| `/changes/:id` | detail |
| `/sla` | SLA Policies |
| `/problems` | Problems |
| `/problems/create` | (from list) |
| `/problems/:id` | detail |
| `/oncall` | On-Call |
| `/oncall-calendar` | On-Call Calendar |
| `/escalation` | Escalation Policies |
| `/maintenance` | Maintenance Windows |

### Monitoring
| Path | Nav label |
|------|-----------|
| `/alerts` | Alerts |
| `/assets` | Assets / CMDB |
| `/assets/create` | (from list) |
| `/assets/:id` | detail |
| `/network` | Network |
| `/metrics` | Metrics |
| `/apm` | Service Health |
| `/k8s` | Kubernetes |
| `/logs` | Log Explorer |
| `/noc` | NOC View |
| `/pagerduty` | PagerDuty |

### Communications
| Path | Nav label |
|------|-----------|
| `/sms` | SMS Gateway |
| `/voice` | Voice Agent |

### Intelligence
| Path | Nav label |
|------|-----------|
| `/ai-insights` | AI Insights |
| `/automation` | Automation |
| `/knowledge-base` | Knowledge Base |
| `/reports` | Reports |

### Platform
| Path | Nav label | Roles |
|------|-----------|-------|
| `/integrations` | Integrations | ADMIN |
| `/teams` | Teams | |
| `/users` | Users | ADMIN, MANAGER |
| `/audit` | Audit Log | ADMIN, MANAGER |
| `/profile` | My Profile | |
| `/settings` | Settings | |

## API base
Frontend proxies `/api/*` → `http://localhost:5001`
Auth: `POST /api/v1/auth/login`
