-- Lead: pilot / demo requests from the public marketing site.
-- Written by the unauthenticated POST /api/v1/public/leads, so the table is
-- intentionally standalone — no organizationId, no FK to User or Organization.
-- Idempotent so it is safe to re-run against a database that is partly migrated.

DO $$ BEGIN
  CREATE TYPE "LeadInterest" AS ENUM ('PILOT', 'DEMO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'SPAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Lead" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "company"   TEXT NOT NULL,
  "phone"     TEXT,
  "interest"  "LeadInterest" NOT NULL,
  "teamSize"  TEXT,
  "message"   TEXT,
  "status"    "LeadStatus" NOT NULL DEFAULT 'NEW',
  "sourceIp"  TEXT,
  "userAgent" TEXT,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Lead_status_createdAt_idx" ON "Lead" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead" ("email");
