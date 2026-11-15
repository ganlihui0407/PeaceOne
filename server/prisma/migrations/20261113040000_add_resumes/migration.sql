-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "template_key" TEXT NOT NULL DEFAULT 'classic',
    "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_education" (
    "id" UUID NOT NULL,
    "resume_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "institution" TEXT NOT NULL,
    "qualification" TEXT,
    "field_of_study" TEXT,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_experience" (
    "id" UUID NOT NULL,
    "resume_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "job_title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "location" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT FALSE,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_skills" (
    "id" UUID NOT NULL,
    "resume_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "skill_id" UUID,
    "label" TEXT NOT NULL,
    "proficiency_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_certifications" (
    "id" UUID NOT NULL,
    "resume_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "year" INTEGER,
    "credential_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_certifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "resumes"
ADD CONSTRAINT "resumes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_education"
ADD CONSTRAINT "resume_education_resume_id_fkey"
FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_experience"
ADD CONSTRAINT "resume_experience_resume_id_fkey"
FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_skills"
ADD CONSTRAINT "resume_skills_resume_id_fkey"
FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_skills"
ADD CONSTRAINT "resume_skills_skill_id_fkey"
FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_certifications"
ADD CONSTRAINT "resume_certifications_resume_id_fkey"
FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "resumes_user_id_idx" ON "resumes"("user_id");

-- CreateIndex
CREATE INDEX "resumes_user_id_updated_at_idx" ON "resumes"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "resume_education_resume_id_sort_order_idx" ON "resume_education"("resume_id", "sort_order");

-- CreateIndex
CREATE INDEX "resume_experience_resume_id_sort_order_idx" ON "resume_experience"("resume_id", "sort_order");

-- CreateIndex
CREATE INDEX "resume_skills_resume_id_sort_order_idx" ON "resume_skills"("resume_id", "sort_order");

-- CreateIndex
CREATE INDEX "resume_skills_skill_id_idx" ON "resume_skills"("skill_id");

-- CreateIndex
CREATE INDEX "resume_certifications_resume_id_sort_order_idx" ON "resume_certifications"("resume_id", "sort_order");

-- One primary resume per user
CREATE UNIQUE INDEX "resumes_one_primary_per_user"
ON "resumes"("user_id")
WHERE "is_primary" = TRUE;

-- One ESCO skill reference per resume
CREATE UNIQUE INDEX "resume_skills_one_skill_per_resume"
ON "resume_skills"("resume_id", "skill_id")
WHERE "skill_id" IS NOT NULL;
