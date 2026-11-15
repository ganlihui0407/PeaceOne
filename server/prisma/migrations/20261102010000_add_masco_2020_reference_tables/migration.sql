-- CreateTable
CREATE TABLE "masco_unit_groups" (
    "id" UUID NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'MASCO',
    "version" TEXT NOT NULL DEFAULT '2020',
    "code" VARCHAR(4) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tasks" TEXT,
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "masco_unit_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "masco_occupation_records" (
    "id" UUID NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'MASCO',
    "version" TEXT NOT NULL DEFAULT '2020',
    "code" VARCHAR(7) NOT NULL,
    "title" TEXT NOT NULL,
    "record_scope" TEXT NOT NULL,
    "unit_group_id" UUID NOT NULL,
    "occupation_id" UUID,
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "masco_occupation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "masco_historical_crosswalks" (
    "id" UUID NOT NULL,
    "source_version" TEXT NOT NULL DEFAULT '2013',
    "target_version" TEXT NOT NULL DEFAULT '2020',
    "historical_code" VARCHAR(7) NOT NULL,
    "current_code" VARCHAR(7) NOT NULL,
    "current_record_id" UUID,
    "mapping_status" TEXT NOT NULL,
    "review_decision" TEXT,
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "masco_historical_crosswalks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "masco_unit_groups_code_idx" ON "masco_unit_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "masco_unit_groups_classification_version_code_key" ON "masco_unit_groups"("classification", "version", "code");

-- CreateIndex
CREATE UNIQUE INDEX "masco_occupation_records_occupation_id_key" ON "masco_occupation_records"("occupation_id");

-- CreateIndex
CREATE INDEX "masco_occupation_records_unit_group_id_idx" ON "masco_occupation_records"("unit_group_id");

-- CreateIndex
CREATE INDEX "masco_occupation_records_record_scope_idx" ON "masco_occupation_records"("record_scope");

-- CreateIndex
CREATE UNIQUE INDEX "masco_occupation_records_classification_version_code_key" ON "masco_occupation_records"("classification", "version", "code");

-- CreateIndex
CREATE INDEX "masco_historical_crosswalks_target_version_current_code_idx" ON "masco_historical_crosswalks"("target_version", "current_code");

-- CreateIndex
CREATE INDEX "masco_historical_crosswalks_current_record_id_idx" ON "masco_historical_crosswalks"("current_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "masco_historical_crosswalks_source_version_target_version_h_key" ON "masco_historical_crosswalks"("source_version", "target_version", "historical_code", "current_code");

-- AddForeignKey
ALTER TABLE "masco_occupation_records" ADD CONSTRAINT "masco_occupation_records_unit_group_id_fkey" FOREIGN KEY ("unit_group_id") REFERENCES "masco_unit_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "masco_occupation_records" ADD CONSTRAINT "masco_occupation_records_occupation_id_fkey" FOREIGN KEY ("occupation_id") REFERENCES "occupations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "masco_historical_crosswalks" ADD CONSTRAINT "masco_historical_crosswalks_current_record_id_fkey" FOREIGN KEY ("current_record_id") REFERENCES "masco_occupation_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

