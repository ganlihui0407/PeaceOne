-- AlterTable
ALTER TABLE "users" ADD COLUMN     "target_occupation_id" UUID;

-- CreateIndex
CREATE INDEX "users_target_occupation_id_idx" ON "users"("target_occupation_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_target_occupation_id_fkey" FOREIGN KEY ("target_occupation_id") REFERENCES "occupations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
