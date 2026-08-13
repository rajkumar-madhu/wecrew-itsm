-- Multi-tenancy layer.
--
-- This layer was added to schema.prisma and applied to live databases with
-- `prisma db push` / by hand, but never written to migration history. Without it
-- the history cannot replay from empty: 20260303120000_add_multilang_escalation
-- ALTERs "Organization", and 20260306120000_composite_indexes indexes
-- "Incident"/"Alert" ("organizationId"), neither of which existed.
--
-- The timestamp deliberately sorts after 20260215151722_init and before
-- 20260303120000_add_multilang_escalation. "preferredLanguage" is intentionally
-- omitted from "Organization" here — the 20260303120000 migration adds it.

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('PROD', 'DR', 'UAT', 'DEV');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "environment" "Environment" NOT NULL DEFAULT 'PROD',
    "serverIp" TEXT,
    "fqdn" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_isActive_idx" ON "Organization"("isActive");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Change" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ConfigurationItem" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "SLADefinition" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "SMSLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "VoiceCallLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "SlackIntegration" ADD COLUMN     "organizationId" TEXT;

-- DropIndex
-- Uniqueness becomes per-tenant: @@unique([name, organizationId])
DROP INDEX "Team_name_key";

-- DropIndex
-- Uniqueness becomes per-tenant: @@unique([alertId, organizationId])
DROP INDEX "Alert_alertId_key";

-- DropIndex
-- Uniqueness becomes per-tenant: @@unique([priority, organizationId])
DROP INDEX "SLADefinition_priority_key";

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_organizationId_key" ON "Team"("name", "organizationId");

-- CreateIndex
CREATE INDEX "Incident_organizationId_idx" ON "Incident"("organizationId");

-- CreateIndex
CREATE INDEX "Change_organizationId_idx" ON "Change"("organizationId");

-- CreateIndex
CREATE INDEX "Problem_organizationId_idx" ON "Problem"("organizationId");

-- CreateIndex
CREATE INDEX "ConfigurationItem_organizationId_idx" ON "ConfigurationItem"("organizationId");

-- CreateIndex
CREATE INDEX "Alert_organizationId_idx" ON "Alert"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_alertId_organizationId_key" ON "Alert"("alertId", "organizationId");

-- CreateIndex
CREATE INDEX "SLADefinition_organizationId_idx" ON "SLADefinition"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SLADefinition_priority_organizationId_key" ON "SLADefinition"("priority", "organizationId");

-- CreateIndex
CREATE INDEX "SMSLog_organizationId_idx" ON "SMSLog"("organizationId");

-- CreateIndex
CREATE INDEX "VoiceCallLog_organizationId_idx" ON "VoiceCallLog"("organizationId");

-- CreateIndex
CREATE INDEX "Integration_organizationId_idx" ON "Integration"("organizationId");

-- CreateIndex
CREATE INDEX "SlackIntegration_organizationId_idx" ON "SlackIntegration"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationItem" ADD CONSTRAINT "ConfigurationItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLADefinition" ADD CONSTRAINT "SLADefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SMSLog" ADD CONSTRAINT "SMSLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallLog" ADD CONSTRAINT "VoiceCallLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackIntegration" ADD CONSTRAINT "SlackIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
