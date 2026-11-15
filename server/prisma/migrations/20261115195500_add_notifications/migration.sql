-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'APPLICATION_SUBMITTED',
  'APPLICATION_SHORTLISTED',
  'APPLICATION_REJECTED',
  'INTERVIEW_INVITED',
  'INTERVIEW_ACCEPTED',
  'INTERVIEW_RESCHEDULE_REQUESTED',
  'INTERVIEW_RESCHEDULE_CONFIRMED',
  'INTERVIEW_CANCELLED',
  'INTERVIEW_COMPLETED'
);

-- CreateEnum
CREATE TYPE "NotificationRelatedEntityType" AS ENUM ('APPLICATION', 'INTERVIEW');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "related_entity_type" "NotificationRelatedEntityType" NOT NULL,
    "related_entity_id" UUID NOT NULL,
    "deduplication_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_deduplication_key_key" ON "notifications"("deduplication_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_idx" ON "notifications"("recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_related_entity_type_related_entity_id_idx" ON "notifications"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_unread_created_at_idx" ON "notifications"("recipient_user_id", "created_at" DESC) WHERE "read_at" IS NULL;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
