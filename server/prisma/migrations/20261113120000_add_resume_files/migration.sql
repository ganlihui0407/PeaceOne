-- Additive unique so resume_files.user_id cannot disagree with the parent resume owner.
CREATE UNIQUE INDEX "resumes_id_user_id_key" ON "resumes"("id", "user_id");

-- CreateTable
CREATE TABLE "resume_files" (
    "id" UUID NOT NULL,
    "resume_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "stored_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resume_files_resume_id_key" ON "resume_files"("resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_files_resume_id_user_id_key" ON "resume_files"("resume_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_files_stored_filename_key" ON "resume_files"("stored_filename");

-- CreateIndex
CREATE INDEX "resume_files_user_id_idx" ON "resume_files"("user_id");

-- AddForeignKey
ALTER TABLE "resume_files"
ADD CONSTRAINT "resume_files_resume_id_user_id_fkey"
FOREIGN KEY ("resume_id", "user_id") REFERENCES "resumes"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_files"
ADD CONSTRAINT "resume_files_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
