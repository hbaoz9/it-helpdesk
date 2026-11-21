-- Existing SLA rows have no reliable policy target history. Keep these columns
-- nullable until a reviewed backfill can establish their original values.
ALTER TABLE "ticket_sla"
  ADD COLUMN "response_target_minutes" INTEGER,
  ADD COLUMN "resolution_target_minutes" INTEGER;
