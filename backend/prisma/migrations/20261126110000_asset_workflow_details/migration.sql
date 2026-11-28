-- Add workflow detail fields without changing or removing existing asset records.
CREATE TYPE "AssetMaintenanceType" AS ENUM ('REPAIR', 'MAINTENANCE', 'UPGRADE', 'INSPECTION');

ALTER TABLE "asset_maintenance"
    ADD COLUMN "type" "AssetMaintenanceType" NOT NULL DEFAULT 'MAINTENANCE',
    ADD COLUMN "diagnosis" TEXT,
    ADD COLUMN "resolution" TEXT,
    ADD COLUMN "notes" TEXT;

ALTER TABLE "asset_assignments"
    ADD COLUMN "condition_at_assignment" "AssetCondition",
    ADD COLUMN "condition_at_return" "AssetCondition";
