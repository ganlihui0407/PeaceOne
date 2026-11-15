-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "applicant_user_id" UUID NOT NULL,
    "selected_resume_id" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_resume_snapshots" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "resume_title" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "structured_snapshot" JSONB NOT NULL,
    "generated_pdf_filename" TEXT NOT NULL,
    "generated_pdf_content_type" TEXT NOT NULL,
    "generated_pdf_size" INTEGER NOT NULL,
    "generated_pdf_sha256" TEXT NOT NULL,
    "original_file_filename" TEXT,
    "original_file_content_type" TEXT,
    "original_file_size" INTEGER,
    "original_file_sha256" TEXT,
    "original_file_stored_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_resume_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_id_applicant_user_id_key" ON "applications"("job_id", "applicant_user_id");

-- CreateIndex
CREATE INDEX "applications_applicant_user_id_applied_at_idx" ON "applications"("applicant_user_id", "applied_at");

-- CreateIndex
CREATE INDEX "applications_job_id_idx" ON "applications"("job_id");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_selected_resume_id_idx" ON "applications"("selected_resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_resume_snapshots_application_id_key" ON "application_resume_snapshots"("application_id");

-- CreateIndex
CREATE INDEX "application_status_events_application_id_created_at_idx" ON "application_status_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "application_status_events_actor_user_id_idx" ON "application_status_events"("actor_user_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_selected_resume_id_fkey" FOREIGN KEY ("selected_resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_resume_snapshots" ADD CONSTRAINT "application_resume_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
