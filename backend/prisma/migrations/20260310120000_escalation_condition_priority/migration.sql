-- Add conditionPriority to EscalationRule
-- When set, the rule only fires for incidents matching that priority (e.g. 'P1')
ALTER TABLE "EscalationRule" ADD COLUMN IF NOT EXISTS "conditionPriority" TEXT;
