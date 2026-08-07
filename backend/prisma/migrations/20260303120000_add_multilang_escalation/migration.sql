-- Add preferredLanguage to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT DEFAULT 'en';

-- Add preferredLanguage to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT DEFAULT 'en';

-- Add escalation fields to Incident
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "escalationLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "lastEscalatedAt" TIMESTAMP(3);

-- Create EscalationLog model
CREATE TABLE IF NOT EXISTS "EscalationLog" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "notifyType" TEXT NOT NULL,
    "targetContact" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetName" TEXT,
    "status" TEXT NOT NULL,
    "callSid" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "EscalationLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for EscalationLog
CREATE INDEX IF NOT EXISTS "EscalationLog_incidentId_idx" ON "EscalationLog"("incidentId");
CREATE INDEX IF NOT EXISTS "EscalationLog_attemptedAt_idx" ON "EscalationLog"("attemptedAt");

-- Add foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'EscalationLog_incidentId_fkey'
    ) THEN
        ALTER TABLE "EscalationLog" ADD CONSTRAINT "EscalationLog_incidentId_fkey"
            FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
