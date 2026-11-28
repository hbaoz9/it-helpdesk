-- AlterTable: Self-declared devices default to PENDING until verified by IT Supervisor or Administrator
ALTER TABLE "user_devices" ALTER COLUMN "verification_status" SET DEFAULT 'PENDING';

-- CreateIndex: Partial Unique Indexes enforcing at most one active session per ticket and per device at the database level
CREATE UNIQUE INDEX IF NOT EXISTS "remote_support_sessions_active_ticket_uq"
ON "remote_support_sessions"("ticket_id")
WHERE "status" IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS');

CREATE UNIQUE INDEX IF NOT EXISTS "remote_support_sessions_active_device_uq"
ON "remote_support_sessions"("device_id")
WHERE "status" IN ('REQUESTED', 'APPROVED', 'IN_PROGRESS');
