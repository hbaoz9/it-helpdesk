CREATE TYPE "TicketActivityType" AS ENUM ('STATUS', 'COMMENT');
CREATE TYPE "TicketVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

CREATE TABLE "ticket_activities" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "TicketActivityType" NOT NULL,
    "visibility" "TicketVisibility" NOT NULL DEFAULT 'PUBLIC',
    "content" TEXT,
    "from_status" "TicketStatus",
    "to_status" "TicketStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_activities_ticket_id_visibility_created_at_idx"
    ON "ticket_activities"("ticket_id", "visibility", "created_at");

ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
