-- CreateEnum
CREATE TYPE "SlaEventType" AS ENUM ('RESPONSE_WARNING', 'RESPONSE_BREACHED', 'RESOLUTION_WARNING', 'RESOLUTION_BREACHED');

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sla" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sla_policy_id" UUID,
    "policy_revision" INTEGER NOT NULL DEFAULT 1,
    "response_due_at" TIMESTAMP(3) NOT NULL,
    "resolution_due_at" TIMESTAMP(3) NOT NULL,
    "first_response_at" TIMESTAMP(3),
    "last_resolved_at" TIMESTAMP(3),
    "response_breached_at" TIMESTAMP(3),
    "resolution_breached_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "event_type" "SlaEventType" NOT NULL,
    "policy_revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "ticket_id" UUID,
    "before_json" TEXT,
    "after_json" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ticket_id" UUID,
    "event_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_priority_key" ON "sla_policies"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sla_ticket_id_key" ON "ticket_sla"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_sla_response_due_at_idx" ON "ticket_sla"("response_due_at");

-- CreateIndex
CREATE INDEX "ticket_sla_resolution_due_at_idx" ON "ticket_sla"("resolution_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "sla_events_ticket_id_event_type_policy_revision_key" ON "sla_events"("ticket_id", "event_type", "policy_revision");

-- CreateIndex
CREATE INDEX "sla_events_ticket_id_idx" ON "sla_events"("ticket_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_ticket_id_idx" ON "audit_logs"("ticket_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_event_key_key" ON "notifications"("user_id", "event_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "ticket_sla" ADD CONSTRAINT "ticket_sla_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla" ADD CONSTRAINT "ticket_sla_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default SLA Policies V1 (P1: 15m/4h, P2: 1h/8h, P3: 4h/24h, P4: 8h/72h)
INSERT INTO "sla_policies" ("id", "priority", "response_minutes", "resolution_minutes", "revision", "active", "created_at", "updated_at")
VALUES
    ('20000000-0000-4000-8000-000000000001', 'P1', 15, 240, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000002', 'P2', 60, 480, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000003', 'P3', 240, 1440, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000004', 'P4', 480, 4320, 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("priority") DO NOTHING;
