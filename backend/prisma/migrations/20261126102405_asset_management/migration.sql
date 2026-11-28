-- Additive asset-management foundation. Existing helpdesk records are untouched.
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST');
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AssetHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'RETURNED', 'MAINTENANCE_CREATED', 'MAINTENANCE_UPDATED', 'DELETED');

CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "purchase_date" DATE,
    "purchase_cost" DECIMAL(12,2),
    "warranty_expires" DATE,
    "location" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "returned_by_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "notes" TEXT,
    "return_notes" TEXT,
    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_maintenance" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "cost" DECIMAL(12,2),
    "status" "AssetMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_maintenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_history" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "AssetHistoryAction" NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tickets" ADD COLUMN "asset_id" UUID;

CREATE UNIQUE INDEX "asset_categories_name_key" ON "asset_categories"("name");
CREATE INDEX "asset_categories_active_name_idx" ON "asset_categories"("active", "name");
CREATE UNIQUE INDEX "assets_asset_tag_key" ON "assets"("asset_tag");
CREATE UNIQUE INDEX "assets_serial_number_key" ON "assets"("serial_number");
CREATE INDEX "assets_category_id_status_idx" ON "assets"("category_id", "status");
CREATE INDEX "assets_status_deleted_at_idx" ON "assets"("status", "deleted_at");
CREATE INDEX "assets_name_idx" ON "assets"("name");
CREATE INDEX "asset_assignments_asset_id_returned_at_assigned_at_idx" ON "asset_assignments"("asset_id", "returned_at", "assigned_at");
CREATE INDEX "asset_assignments_user_id_returned_at_idx" ON "asset_assignments"("user_id", "returned_at");
CREATE INDEX "asset_maintenance_asset_id_created_at_idx" ON "asset_maintenance"("asset_id", "created_at");
CREATE INDEX "asset_maintenance_status_scheduled_at_idx" ON "asset_maintenance"("status", "scheduled_at");
CREATE INDEX "asset_history_asset_id_created_at_idx" ON "asset_history"("asset_id", "created_at");
CREATE INDEX "asset_history_actor_id_idx" ON "asset_history"("actor_id");
CREATE INDEX "tickets_asset_id_idx" ON "tickets"("asset_id");

ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "asset_categories" ("id", "name", "description") VALUES
    ('30000000-0000-4000-8000-000000000001', 'Laptop', 'Portable computers'),
    ('30000000-0000-4000-8000-000000000002', 'Desktop', 'Desktop computers and workstations'),
    ('30000000-0000-4000-8000-000000000003', 'Monitor', 'Computer displays'),
    ('30000000-0000-4000-8000-000000000004', 'Mobile', 'Phones and tablets'),
    ('30000000-0000-4000-8000-000000000005', 'Printer', 'Printers and scanners'),
    ('30000000-0000-4000-8000-000000000006', 'Network', 'Network infrastructure equipment'),
    ('30000000-0000-4000-8000-000000000007', 'Peripheral', 'Keyboards, mice, docks and accessories'),
    ('30000000-0000-4000-8000-000000000008', 'Other', 'Other IT equipment')
ON CONFLICT ("name") DO NOTHING;
