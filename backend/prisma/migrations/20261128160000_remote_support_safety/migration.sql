-- Self-registered device identifiers have not been independently verified.
ALTER TABLE "user_devices" ALTER COLUMN "verification_status" SET DEFAULT 'PENDING';
UPDATE "user_devices" SET "verification_status" = 'PENDING'
WHERE "verification_status" = 'VERIFIED';

-- Enabling remote access requires explicit administrator configuration.
ALTER TABLE "rustdesk_server_configs" ALTER COLUMN "enabled" SET DEFAULT false;
UPDATE "rustdesk_server_configs" SET "enabled" = false;

-- One active approval or connection per Ticket and per target device.
CREATE UNIQUE INDEX "remote_support_active_ticket_key" ON "remote_support_sessions" ("ticket_id")
WHERE "status" IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS');
CREATE UNIQUE INDEX "remote_support_active_device_key" ON "remote_support_sessions" ("device_id")
WHERE "status" IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS');
