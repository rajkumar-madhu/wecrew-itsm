-- ═══════════════════════════════════════════════════════════
-- LinkedEye ITSM — Full-Text Search & Performance Indexes
-- Run manually: psql $DATABASE_URL -f add-indexes.sql
-- ═══════════════════════════════════════════════════════════

-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Full-Text Search (GIN) Indexes ──

-- Incidents: search on number, shortDescription, description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_search_trgm
  ON "Incident" USING gin (
    ("number" || ' ' || "shortDescription" || ' ' || COALESCE("description", '')) gin_trgm_ops
  );

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_short_desc_trgm
  ON "Incident" USING gin ("shortDescription" gin_trgm_ops);

-- Changes: search on shortDescription
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_changes_short_desc_trgm
  ON "Change" USING gin ("shortDescription" gin_trgm_ops);

-- Problems: search on shortDescription
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_short_desc_trgm
  ON "Problem" USING gin ("shortDescription" gin_trgm_ops);

-- Configuration Items: search on name, hostname
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_name_trgm
  ON "ConfigurationItem" USING gin ("name" gin_trgm_ops);

-- ── B-Tree Performance Indexes ──

-- Incidents: common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_state_priority
  ON "Incident" ("state", "priority");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_assigned_state
  ON "Incident" ("assignedToId", "state") WHERE "assignedToId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_group_state
  ON "Incident" ("assignmentGroupId", "state") WHERE "assignmentGroupId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_sla_breached
  ON "Incident" ("slaBreached", "state") WHERE "slaBreached" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_source
  ON "Incident" ("source", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_created_desc
  ON "Incident" ("createdAt" DESC);

-- Changes: common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_changes_state_type
  ON "Change" ("state", "type");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_changes_planned_dates
  ON "Change" ("plannedStartDate", "plannedEndDate");

-- Problems: common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_known_error
  ON "Problem" ("isKnownError") WHERE "isKnownError" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_state_priority
  ON "Problem" ("state", "priority");

-- Alerts: common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_status_severity
  ON "Alert" ("status", "severity");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_ci_status
  ON "Alert" ("configItemId", "status") WHERE "configItemId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_fired_desc
  ON "Alert" ("firedAt" DESC);

-- Configuration Items: type + status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_type_status
  ON "ConfigurationItem" ("type", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ci_monitoring
  ON "ConfigurationItem" ("monitoringEnabled") WHERE "monitoringEnabled" = true;

-- Activities: recent activity lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_incident_created
  ON "Activity" ("incidentId", "createdAt" DESC) WHERE "incidentId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_change_created
  ON "Activity" ("changeId", "createdAt" DESC) WHERE "changeId" IS NOT NULL;

-- Work Notes: incident lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worknotes_incident_created
  ON "WorkNote" ("incidentId", "createdAt" DESC) WHERE "incidentId" IS NOT NULL;

-- Audit Log: entity lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditlog_entity
  ON "AuditLog" ("entityType", "entityId", "createdAt" DESC);

-- Notifications: user unread
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON "Notification" ("userId", "isRead", "createdAt" DESC) WHERE "isRead" = false;

-- Email Queue: pending emails
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emailqueue_pending
  ON "EmailQueue" ("status", "scheduledAt") WHERE "status" = 'PENDING';

-- SMS Log: recent logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_smslog_created_desc
  ON "SMSLog" ("createdAt" DESC);

-- Voice Call Log: recent logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voicecalllog_created_desc
  ON "VoiceCallLog" ("createdAt" DESC);

-- ── Analyze tables after index creation ──
ANALYZE "Incident";
ANALYZE "Change";
ANALYZE "Problem";
ANALYZE "Alert";
ANALYZE "ConfigurationItem";
ANALYZE "Activity";
ANALYZE "WorkNote";
ANALYZE "AuditLog";
ANALYZE "Notification";
