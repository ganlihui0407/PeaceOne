-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PROPOSED', 'RESCHEDULE_REQUESTED', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('ONLINE', 'ONSITE', 'PHONE');

-- CreateEnum
CREATE TYPE "InterviewAttendance" AS ENUM ('ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "InterviewEventType" AS ENUM ('CREATED', 'SCHEDULE_UPDATED', 'ACCEPTED', 'DECLINED', 'RESCHEDULE_REQUESTED', 'RESCHEDULE_CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "candidate_user_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "round_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "interview_type" "InterviewType" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PROPOSED',
    "scheduled_start_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "meeting_link" TEXT,
    "venue" TEXT,
    "instructions" TEXT,
    "employer_notes" TEXT,
    "candidate_response_note" TEXT,
    "requested_start_at" TIMESTAMP(3),
    "requested_duration_minutes" INTEGER,
    "attendance" "InterviewAttendance",
    "outcome" "InterviewOutcome",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_events" (
    "id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "event_type" "InterviewEventType" NOT NULL,
    "previous_status" "InterviewStatus",
    "new_status" "InterviewStatus" NOT NULL,
    "event_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interviews_company_id_scheduled_start_at_idx" ON "interviews"("company_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "interviews_candidate_user_id_scheduled_start_at_idx" ON "interviews"("candidate_user_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "interviews_application_id_created_at_idx" ON "interviews"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "interviews_job_id_idx" ON "interviews"("job_id");

-- CreateIndex
CREATE INDEX "interviews_status_idx" ON "interviews"("status");

-- CreateIndex
CREATE INDEX "interviews_created_by_user_id_idx" ON "interviews"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_one_active_per_application" ON "interviews"("application_id") WHERE status IN ('PROPOSED', 'RESCHEDULE_REQUESTED', 'CONFIRMED');

-- CreateIndex
CREATE INDEX "interview_events_interview_id_created_at_idx" ON "interview_events"("interview_id", "created_at");

-- CreateIndex
CREATE INDEX "interview_events_actor_user_id_idx" ON "interview_events"("actor_user_id");

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_events" ADD CONSTRAINT "interview_events_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_events" ADD CONSTRAINT "interview_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
