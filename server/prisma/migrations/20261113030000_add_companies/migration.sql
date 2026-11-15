-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "registration_number" TEXT,
    "industry" TEXT,
    "company_size" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "address" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "company_id" UUID;

-- CreateIndex
CREATE INDEX "companies_company_name_idx" ON "companies"("company_name");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- AddForeignKey
ALTER TABLE "users"
ADD CONSTRAINT "users_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
