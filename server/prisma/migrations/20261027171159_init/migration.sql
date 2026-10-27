-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'JOB_SEEKER', 'COMPANY_STAFF', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupations" (
    "id" UUID NOT NULL,
    "source_system" TEXT NOT NULL DEFAULT 'ESCO',
    "source_uri" TEXT NOT NULL,
    "preferred_label" TEXT NOT NULL,
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occupations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "source_system" TEXT NOT NULL DEFAULT 'ESCO',
    "source_uri" TEXT NOT NULL,
    "preferred_label" TEXT NOT NULL,
    "skill_type" TEXT,
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupation_skill_relations" (
    "id" UUID NOT NULL,
    "occupation_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "source_system" TEXT NOT NULL DEFAULT 'ESCO',
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occupation_skill_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "proficiency_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "occupations_source_uri_key" ON "occupations"("source_uri");

-- CreateIndex
CREATE INDEX "occupations_preferred_label_idx" ON "occupations"("preferred_label");

-- CreateIndex
CREATE INDEX "occupations_source_system_idx" ON "occupations"("source_system");

-- CreateIndex
CREATE UNIQUE INDEX "skills_source_uri_key" ON "skills"("source_uri");

-- CreateIndex
CREATE INDEX "skills_preferred_label_idx" ON "skills"("preferred_label");

-- CreateIndex
CREATE INDEX "skills_skill_type_idx" ON "skills"("skill_type");

-- CreateIndex
CREATE INDEX "skills_source_system_idx" ON "skills"("source_system");

-- CreateIndex
CREATE INDEX "occupation_skill_relations_skill_id_idx" ON "occupation_skill_relations"("skill_id");

-- CreateIndex
CREATE INDEX "occupation_skill_relations_occupation_id_idx" ON "occupation_skill_relations"("occupation_id");

-- CreateIndex
CREATE UNIQUE INDEX "occupation_skill_relations_occupation_id_skill_id_relation__key" ON "occupation_skill_relations"("occupation_id", "skill_id", "relation_type");

-- CreateIndex
CREATE INDEX "user_skills_skill_id_idx" ON "user_skills"("skill_id");

-- CreateIndex
CREATE INDEX "user_skills_user_id_idx" ON "user_skills"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_user_id_skill_id_key" ON "user_skills"("user_id", "skill_id");

-- AddForeignKey
ALTER TABLE "occupation_skill_relations" ADD CONSTRAINT "occupation_skill_relations_occupation_id_fkey" FOREIGN KEY ("occupation_id") REFERENCES "occupations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupation_skill_relations" ADD CONSTRAINT "occupation_skill_relations_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
