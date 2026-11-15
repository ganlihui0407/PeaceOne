-- CreateEnum
CREATE TYPE "PositionChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "position_change_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_position" TEXT,
    "requested_position" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PositionChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_change_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "position_change_requests"
ADD CONSTRAINT "position_change_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_change_requests"
ADD CONSTRAINT "position_change_requests_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "position_change_requests_user_id_idx" ON "position_change_requests"("user_id");

-- CreateIndex
CREATE INDEX "position_change_requests_status_idx" ON "position_change_requests"("status");

-- CreateIndex
CREATE INDEX "position_change_requests_created_at_idx" ON "position_change_requests"("created_at");

-- CreateIndex
CREATE INDEX "position_change_requests_reviewed_by_idx" ON "position_change_requests"("reviewed_by");

-- One pending request per staff user
CREATE UNIQUE INDEX "position_change_requests_one_pending_per_user"
ON "position_change_requests"("user_id")
WHERE "status" = 'PENDING';
