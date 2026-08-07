-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('LEAD', 'MEMBER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "IncidentState" AS ENUM ('NEW', 'IN_PROGRESS', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Impact" AS ENUM ('ENTERPRISE', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('MANUAL', 'PROMETHEUS', 'GRAFANA', 'API', 'EMAIL', 'VOICE', 'SLACK');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('NORMAL', 'STANDARD', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ChangeState" AS ENUM ('NEW', 'ASSESSMENT', 'APPROVAL', 'SCHEDULED', 'IMPLEMENTING', 'REVIEW', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProblemState" AS ENUM ('NEW', 'INVESTIGATION', 'RCA_IN_PROGRESS', 'KNOWN_ERROR', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CIType" AS ENUM ('SERVER', 'KUBERNETES_CLUSTER', 'DATABASE', 'APPLICATION', 'NETWORK', 'STORAGE', 'CONTAINER', 'VM', 'LOAD_BALANCER');

-- CreateEnum
CREATE TYPE "CIStatus" AS ENUM ('LIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'PLANNED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('FIRING', 'RESOLVED', 'ACKNOWLEDGED', 'SILENCED');

-- CreateEnum
CREATE TYPE "AlertSource" AS ENUM ('PROMETHEUS', 'GRAFANA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkNoteSource" AS ENUM ('MANUAL', 'AI', 'SYSTEM', 'SLACK');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INCIDENT', 'CHANGE', 'PROBLEM', 'ALERT', 'SLA', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WEB', 'EMAIL', 'SMS', 'SLACK', 'VOICE');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('SLACK', 'SERVICENOW', 'PROMETHEUS', 'GRAFANA', 'LOKI', 'EMAIL', 'TWILIO', 'MSG91', 'KALEYRA', 'WEBHOOK', 'N8N');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SMSProvider" AS ENUM ('TWILIO', 'MSG91', 'KALEYRA');

-- CreateEnum
CREATE TYPE "SMSDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "VoiceDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "VoiceHandler" AS ENUM ('AI_BOT', 'HUMAN', 'IVR');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('CAUSED_BY', 'RESOLVED_BY', 'RELATED');

-- CreateEnum
CREATE TYPE "ProblemLinkType" AS ENUM ('CAUSED_BY', 'RELATED', 'SYMPTOM_OF');

-- CreateEnum
CREATE TYPE "ClosureCode" AS ENUM ('SUCCESSFUL', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "NotifyType" AS ENUM ('SMS_NOTIFY', 'EMAIL_NOTIFY', 'SLACK_NOTIFY', 'VOICE_NOTIFY', 'ALL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "department" TEXT,
    "jobTitle" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "lastLogin" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "ssoProvider" TEXT,
    "ssoId" TEXT,
    "skills" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "slackChannel" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT,
    "state" "IncidentState" NOT NULL DEFAULT 'NEW',
    "impact" "Impact" NOT NULL DEFAULT 'INDIVIDUAL',
    "urgency" "Urgency" NOT NULL DEFAULT 'LOW',
    "priority" "Priority" NOT NULL DEFAULT 'P4',
    "category" TEXT,
    "subcategory" TEXT,
    "assignedToId" TEXT,
    "assignmentGroupId" TEXT,
    "createdById" TEXT NOT NULL,
    "configItemId" TEXT,
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "responseTime" TIMESTAMP(3),
    "resolutionTime" TIMESTAMP(3),
    "slaTargetResponse" TIMESTAMP(3),
    "slaTargetResolution" TIMESTAMP(3),
    "slaPausedAt" TIMESTAMP(3),
    "slaPausedDuration" INTEGER NOT NULL DEFAULT 0,
    "source" "IncidentSource" NOT NULL DEFAULT 'MANUAL',
    "sourceAlertId" TEXT,
    "sourceAlertName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolutionCode" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Change" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChangeType" NOT NULL DEFAULT 'NORMAL',
    "state" "ChangeState" NOT NULL DEFAULT 'NEW',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "assignedToId" TEXT,
    "assignmentGroupId" TEXT,
    "createdById" TEXT NOT NULL,
    "justification" TEXT,
    "implementationPlan" TEXT,
    "rollbackPlan" TEXT,
    "testPlan" TEXT,
    "communicationPlan" TEXT,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "affectedServices" TEXT,
    "downtime" INTEGER,
    "userImpact" TEXT,
    "gitRepoUrl" TEXT,
    "gitBranch" TEXT,
    "gitCommitHash" TEXT,
    "pullRequestUrl" TEXT,
    "reviewNotes" TEXT,
    "closureCode" "ClosureCode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT,
    "state" "ProblemState" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'P4',
    "category" TEXT,
    "assignedToId" TEXT,
    "assignmentGroupId" TEXT,
    "createdById" TEXT NOT NULL,
    "rootCause" TEXT,
    "rootCauseAnalysis" JSONB,
    "workaround" TEXT,
    "workaroundEffective" BOOLEAN NOT NULL DEFAULT false,
    "permanentFix" TEXT,
    "fixImplemented" BOOLEAN NOT NULL DEFAULT false,
    "relatedChangeId" TEXT,
    "isKnownError" BOOLEAN NOT NULL DEFAULT false,
    "knownErrorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "state" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CIType" NOT NULL,
    "status" "CIStatus" NOT NULL DEFAULT 'PLANNED',
    "category" TEXT,
    "subcategory" TEXT,
    "description" TEXT,
    "serialNumber" TEXT,
    "assetTag" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "version" TEXT,
    "location" TEXT,
    "rackPosition" TEXT,
    "dataCenter" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "hostname" TEXT,
    "fqdn" TEXT,
    "cpu" TEXT,
    "memory" TEXT,
    "storage" TEXT,
    "os" TEXT,
    "osVersion" TEXT,
    "ownerId" TEXT,
    "supportGroupId" TEXT,
    "vendor" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "endOfLife" TIMESTAMP(3),
    "endOfSupport" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION,
    "monthlyCost" DOUBLE PRECISION,
    "costCenter" TEXT,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prometheusJob" TEXT,
    "grafanaDashboard" TEXT,
    "lokiLabels" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'FIRING',
    "source" "AlertSource" NOT NULL DEFAULT 'PROMETHEUS',
    "description" TEXT,
    "metric" TEXT,
    "currentValue" TEXT,
    "threshold" TEXT,
    "labels" TEXT,
    "annotations" TEXT,
    "configItemId" TEXT,
    "incidentId" TEXT,
    "firedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "silenceUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "source" "WorkNoteSource" NOT NULL DEFAULT 'MANUAL',
    "incidentId" TEXT,
    "changeId" TEXT,
    "problemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT,
    "incidentId" TEXT,
    "changeId" TEXT,
    "problemId" TEXT,
    "configItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "incidentId" TEXT,
    "changeId" TEXT,
    "problemId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WEB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLADefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "responseTimeMinutes" INTEGER NOT NULL,
    "resolutionTimeMinutes" INTEGER NOT NULL,
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLADefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationPolicy" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "notifyType" "NotifyType" NOT NULL,
    "notifyTargets" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnCallSchedule" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnCallSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentChange" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "linkType" "LinkType" NOT NULL,
    "notes" TEXT,
    "linkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentProblem" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "linkType" "ProblemLinkType" NOT NULL,
    "notes" TEXT,
    "linkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeCI" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "configItemId" TEXT NOT NULL,
    "impactType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeCI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateId" TEXT,
    "templateData" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SMSLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "templateId" TEXT,
    "provider" "SMSProvider" NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT,
    "cost" DOUBLE PRECISION,
    "latency" INTEGER,
    "direction" "SMSDirection" NOT NULL DEFAULT 'OUTBOUND',
    "incidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SMSLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallLog" (
    "id" TEXT NOT NULL,
    "callSid" TEXT,
    "direction" "VoiceDirection" NOT NULL,
    "callerNumber" TEXT,
    "callerName" TEXT,
    "handler" "VoiceHandler" NOT NULL DEFAULT 'AI_BOT',
    "duration" INTEGER,
    "status" TEXT,
    "recordingUrl" TEXT,
    "transcript" TEXT,
    "sentiment" TEXT,
    "language" TEXT,
    "linkedIncidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'INACTIVE',
    "config" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhook" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "workspaceName" TEXT,
    "botToken" TEXT,
    "accessToken" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cronPattern" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_number_key" ON "Incident"("number");

-- CreateIndex
CREATE INDEX "Incident_state_idx" ON "Incident"("state");

-- CreateIndex
CREATE INDEX "Incident_priority_idx" ON "Incident"("priority");

-- CreateIndex
CREATE INDEX "Incident_assignedToId_idx" ON "Incident"("assignedToId");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "Incident_number_idx" ON "Incident"("number");

-- CreateIndex
CREATE INDEX "Incident_assignmentGroupId_idx" ON "Incident"("assignmentGroupId");

-- CreateIndex
CREATE INDEX "Incident_slaBreached_idx" ON "Incident"("slaBreached");

-- CreateIndex
CREATE UNIQUE INDEX "Change_number_key" ON "Change"("number");

-- CreateIndex
CREATE INDEX "Change_state_idx" ON "Change"("state");

-- CreateIndex
CREATE INDEX "Change_type_idx" ON "Change"("type");

-- CreateIndex
CREATE INDEX "Change_assignedToId_idx" ON "Change"("assignedToId");

-- CreateIndex
CREATE INDEX "Change_createdAt_idx" ON "Change"("createdAt");

-- CreateIndex
CREATE INDEX "Change_number_idx" ON "Change"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_number_key" ON "Problem"("number");

-- CreateIndex
CREATE INDEX "Problem_state_idx" ON "Problem"("state");

-- CreateIndex
CREATE INDEX "Problem_priority_idx" ON "Problem"("priority");

-- CreateIndex
CREATE INDEX "Problem_isKnownError_idx" ON "Problem"("isKnownError");

-- CreateIndex
CREATE INDEX "Problem_number_idx" ON "Problem"("number");

-- CreateIndex
CREATE INDEX "Approval_changeId_idx" ON "Approval"("changeId");

-- CreateIndex
CREATE INDEX "Approval_approverId_idx" ON "Approval"("approverId");

-- CreateIndex
CREATE INDEX "ConfigurationItem_type_idx" ON "ConfigurationItem"("type");

-- CreateIndex
CREATE INDEX "ConfigurationItem_status_idx" ON "ConfigurationItem"("status");

-- CreateIndex
CREATE INDEX "ConfigurationItem_name_idx" ON "ConfigurationItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_alertId_key" ON "Alert"("alertId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_firedAt_idx" ON "Alert"("firedAt");

-- CreateIndex
CREATE INDEX "Alert_configItemId_idx" ON "Alert"("configItemId");

-- CreateIndex
CREATE INDEX "WorkNote_incidentId_idx" ON "WorkNote"("incidentId");

-- CreateIndex
CREATE INDEX "WorkNote_changeId_idx" ON "WorkNote"("changeId");

-- CreateIndex
CREATE INDEX "WorkNote_problemId_idx" ON "WorkNote"("problemId");

-- CreateIndex
CREATE INDEX "WorkNote_createdAt_idx" ON "WorkNote"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_incidentId_idx" ON "Activity"("incidentId");

-- CreateIndex
CREATE INDEX "Activity_changeId_idx" ON "Activity"("changeId");

-- CreateIndex
CREATE INDEX "Activity_problemId_idx" ON "Activity"("problemId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE INDEX "Attachment_incidentId_idx" ON "Attachment"("incidentId");

-- CreateIndex
CREATE INDEX "Attachment_changeId_idx" ON "Attachment"("changeId");

-- CreateIndex
CREATE INDEX "Attachment_problemId_idx" ON "Attachment"("problemId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SLADefinition_priority_key" ON "SLADefinition"("priority");

-- CreateIndex
CREATE INDEX "EscalationPolicy_teamId_idx" ON "EscalationPolicy"("teamId");

-- CreateIndex
CREATE INDEX "EscalationRule_policyId_idx" ON "EscalationRule"("policyId");

-- CreateIndex
CREATE INDEX "OnCallSchedule_teamId_idx" ON "OnCallSchedule"("teamId");

-- CreateIndex
CREATE INDEX "OnCallSchedule_startTime_endTime_idx" ON "OnCallSchedule"("startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentChange_incidentId_changeId_key" ON "IncidentChange"("incidentId", "changeId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentProblem_incidentId_problemId_key" ON "IncidentProblem"("incidentId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeCI_changeId_configItemId_key" ON "ChangeCI"("changeId", "configItemId");

-- CreateIndex
CREATE INDEX "EmailQueue_status_idx" ON "EmailQueue"("status");

-- CreateIndex
CREATE INDEX "EmailQueue_scheduledAt_idx" ON "EmailQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "SMSLog_incidentId_idx" ON "SMSLog"("incidentId");

-- CreateIndex
CREATE INDEX "SMSLog_createdAt_idx" ON "SMSLog"("createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallLog_createdAt_idx" ON "VoiceCallLog"("createdAt");

-- CreateIndex
CREATE INDEX "Integration_type_idx" ON "Integration"("type");

-- CreateIndex
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- CreateIndex
CREATE INDEX "IntegrationWebhook_integrationId_idx" ON "IntegrationWebhook"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_name_key" ON "ScheduledJob"("name");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignmentGroupId_fkey" FOREIGN KEY ("assignmentGroupId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigurationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_assignmentGroupId_fkey" FOREIGN KEY ("assignmentGroupId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_assignmentGroupId_fkey" FOREIGN KEY ("assignmentGroupId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationItem" ADD CONSTRAINT "ConfigurationItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationItem" ADD CONSTRAINT "ConfigurationItem_supportGroupId_fkey" FOREIGN KEY ("supportGroupId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigurationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkNote" ADD CONSTRAINT "WorkNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkNote" ADD CONSTRAINT "WorkNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkNote" ADD CONSTRAINT "WorkNote_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkNote" ADD CONSTRAINT "WorkNote_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigurationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "EscalationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallSchedule" ADD CONSTRAINT "OnCallSchedule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallSchedule" ADD CONSTRAINT "OnCallSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentChange" ADD CONSTRAINT "IncidentChange_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentChange" ADD CONSTRAINT "IncidentChange_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentChange" ADD CONSTRAINT "IncidentChange_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentProblem" ADD CONSTRAINT "IncidentProblem_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentProblem" ADD CONSTRAINT "IncidentProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentProblem" ADD CONSTRAINT "IncidentProblem_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeCI" ADD CONSTRAINT "ChangeCI_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "Change"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeCI" ADD CONSTRAINT "ChangeCI_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigurationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SMSLog" ADD CONSTRAINT "SMSLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhook" ADD CONSTRAINT "IntegrationWebhook_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
