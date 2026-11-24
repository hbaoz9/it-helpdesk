-- CreateEnum
CREATE TYPE "RemoteSessionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeviceVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "remote_support_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preferred_device_id" UUID;

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "rustdesk_id" TEXT NOT NULL,
    "os_name" TEXT,
    "verification_status" "DeviceVerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_support_sessions" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "status" "RemoteSessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "request_note" TEXT,
    "rejection_reason" TEXT,
    "cancel_reason" TEXT,
    "result_summary" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "approval_expires_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "remote_support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rustdesk_server_configs" (
    "id" UUID NOT NULL,
    "singleton_key" TEXT NOT NULL DEFAULT 'PRIMARY',
    "id_server_host" TEXT NOT NULL,
    "relay_server_host" TEXT NOT NULL,
    "public_key" TEXT,
    "approval_ttl_minutes" INTEGER NOT NULL DEFAULT 15,
    "client_guide_url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rustdesk_server_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_rustdesk_id_key" ON "user_devices"("rustdesk_id");

-- CreateIndex
CREATE INDEX "user_devices_owner_id_active_idx" ON "user_devices"("owner_id", "active");

-- CreateIndex
CREATE INDEX "tickets_preferred_device_id_idx" ON "tickets"("preferred_device_id");

-- CreateIndex
CREATE INDEX "remote_support_sessions_ticket_id_requested_at_idx" ON "remote_support_sessions"("ticket_id", "requested_at");

-- CreateIndex
CREATE INDEX "remote_support_sessions_device_id_status_idx" ON "remote_support_sessions"("device_id", "status");

-- CreateIndex
CREATE INDEX "remote_support_sessions_requester_id_status_idx" ON "remote_support_sessions"("requester_id", "status");

-- CreateIndex
CREATE INDEX "remote_support_sessions_technician_id_status_idx" ON "remote_support_sessions"("technician_id", "status");

-- CreateIndex
CREATE INDEX "remote_support_sessions_status_requested_at_idx" ON "remote_support_sessions"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "rustdesk_server_configs_singleton_key_key" ON "rustdesk_server_configs"("singleton_key");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_preferred_device_id_fkey" FOREIGN KEY ("preferred_device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_support_sessions" ADD CONSTRAINT "remote_support_sessions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_support_sessions" ADD CONSTRAINT "remote_support_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_support_sessions" ADD CONSTRAINT "remote_support_sessions_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_support_sessions" ADD CONSTRAINT "remote_support_sessions_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default RustDesk Server OSS primary configuration
INSERT INTO "rustdesk_server_configs" ("id", "singleton_key", "id_server_host", "relay_server_host", "public_key", "approval_ttl_minutes", "client_guide_url", "enabled", "created_at", "updated_at")
VALUES (
    '30000000-0000-4000-8000-000000000001',
    'PRIMARY',
    '127.0.0.1:21116',
    '127.0.0.1:21117',
    NULL,
    15,
    'https://rustdesk.com/docs/en/client/',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("singleton_key") DO NOTHING;
