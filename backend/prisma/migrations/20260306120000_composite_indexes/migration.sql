-- Composite indexes for Incident — speeds up dashboard, incident list, escalation engine
CREATE INDEX IF NOT EXISTS "Incident_organizationId_state_idx" ON "Incident"("organizationId", "state");
CREATE INDEX IF NOT EXISTS "Incident_organizationId_priority_state_idx" ON "Incident"("organizationId", "priority", "state");
CREATE INDEX IF NOT EXISTS "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Incident_organizationId_slaBreached_idx" ON "Incident"("organizationId", "slaBreached");

-- Composite indexes for Alert — speeds up alert list, alert stats, alert sync
CREATE INDEX IF NOT EXISTS "Alert_organizationId_status_idx" ON "Alert"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Alert_organizationId_severity_idx" ON "Alert"("organizationId", "severity");
CREATE INDEX IF NOT EXISTS "Alert_organizationId_firedAt_idx" ON "Alert"("organizationId", "firedAt");
