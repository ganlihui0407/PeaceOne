-- CreateEnum
CREATE TYPE "LearningContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LearningDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "LearningEnrollmentStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "learning_contents" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" "LearningDifficulty" NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "thumbnail_url" TEXT,
    "status" "LearningContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_lessons" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_content_skills" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "target_proficiency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_content_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_enrollments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "status" "LearningEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "skills_awarded_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_lesson_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_assessments" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "lesson_id" UUID,
    "title" TEXT NOT NULL,
    "passing_score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_questions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_option_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_contents_slug_key" ON "learning_contents"("slug");

-- CreateIndex
CREATE INDEX "learning_contents_status_category_idx" ON "learning_contents"("status", "category");

-- CreateIndex
CREATE INDEX "learning_contents_category_idx" ON "learning_contents"("category");

-- CreateIndex
CREATE INDEX "learning_contents_status_published_at_idx" ON "learning_contents"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_lessons_content_id_sort_order_key" ON "learning_lessons"("content_id", "sort_order");

-- CreateIndex
CREATE INDEX "learning_lessons_content_id_idx" ON "learning_lessons"("content_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_content_skills_content_id_skill_id_key" ON "learning_content_skills"("content_id", "skill_id");

-- CreateIndex
CREATE INDEX "learning_content_skills_skill_id_idx" ON "learning_content_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_enrollments_user_id_content_id_key" ON "learning_enrollments"("user_id", "content_id");

-- CreateIndex
CREATE INDEX "learning_enrollments_content_id_status_idx" ON "learning_enrollments"("content_id", "status");

-- CreateIndex
CREATE INDEX "learning_enrollments_user_id_status_idx" ON "learning_enrollments"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "learning_lesson_progress_user_id_lesson_id_key" ON "learning_lesson_progress"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "learning_lesson_progress_user_id_content_id_idx" ON "learning_lesson_progress"("user_id", "content_id");

-- CreateIndex
CREATE INDEX "learning_lesson_progress_content_id_idx" ON "learning_lesson_progress"("content_id");

-- CreateIndex
CREATE INDEX "learning_assessments_content_id_idx" ON "learning_assessments"("content_id");

-- CreateIndex
CREATE INDEX "learning_assessments_lesson_id_idx" ON "learning_assessments"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_questions_assessment_id_sort_order_key" ON "learning_questions"("assessment_id", "sort_order");

-- CreateIndex
CREATE INDEX "learning_questions_assessment_id_idx" ON "learning_questions"("assessment_id");

-- CreateIndex
CREATE INDEX "learning_attempts_user_id_assessment_id_created_at_idx" ON "learning_attempts"("user_id", "assessment_id", "created_at");

-- CreateIndex
CREATE INDEX "learning_attempts_enrollment_id_idx" ON "learning_attempts"("enrollment_id");

-- CreateIndex
CREATE INDEX "learning_attempts_assessment_id_idx" ON "learning_attempts"("assessment_id");

-- AddForeignKey
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "learning_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_content_skills" ADD CONSTRAINT "learning_content_skills_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "learning_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_content_skills" ADD CONSTRAINT "learning_content_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "learning_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_lesson_progress" ADD CONSTRAINT "learning_lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_lesson_progress" ADD CONSTRAINT "learning_lesson_progress_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "learning_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_lesson_progress" ADD CONSTRAINT "learning_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "learning_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assessments" ADD CONSTRAINT "learning_assessments_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "learning_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assessments" ADD CONSTRAINT "learning_assessments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "learning_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_questions" ADD CONSTRAINT "learning_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "learning_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "learning_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "learning_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
