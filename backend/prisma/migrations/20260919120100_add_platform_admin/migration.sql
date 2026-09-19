-- AddColumn
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every ADMIN that exists before self-service signup is platform
-- staff and keeps its cross-organization access. Admins created afterwards
-- (self-registered trial owners) default to false and stay in their own org.
UPDATE "User" SET "isPlatformAdmin" = true WHERE "role" = 'ADMIN';
