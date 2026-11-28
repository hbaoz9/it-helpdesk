-- Existing assets remain private until an administrator explicitly enables shared reporting.
ALTER TABLE "assets" ADD COLUMN "shared_reportable" BOOLEAN NOT NULL DEFAULT false;
