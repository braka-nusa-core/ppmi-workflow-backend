-- CreateEnum
CREATE TYPE "VesselPolicyStatus" AS ENUM ('ON', 'NEW_VESSEL', 'OFF', 'CANCEL', 'SELL');

-- CreateTable
CREATE TABLE "club" (
    "_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "club_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "vessel" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "vesselType" TEXT,
    "builtYear" INTEGER,
    "grossTonnage" DECIMAL(15,2),
    "vesselClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vessel_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "vessel_policy" (
    "_id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "coverageKey" TEXT NOT NULL,
    "policyNumber" TEXT,
    "policyNumberRaw" TEXT,
    "insuredRaw" TEXT,
    "periodRaw" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "club" TEXT,
    "status" "VesselPolicyStatus",
    "statusRaw" TEXT,
    "paymentDate" TIMESTAMP(3),
    "paymentStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vessel_policy_pkey" PRIMARY KEY ("_id")
);

-- Seed klub P&I
INSERT INTO "club" ("_id", "code", "name", "updatedAt", "deletedAt")
VALUES
    ('club_msig', 'MSIG', 'MSIG Specialty Marine NV', CURRENT_TIMESTAMP, NULL),
    ('club_eom', 'EOM', 'Eagle Ocean Marine', CURRENT_TIMESTAMP, NULL),
    ('club_hydor', 'HYDOR', 'HYDOR', CURRENT_TIMESTAMP, NULL),
    ('club_inigo', 'INIGO', 'Inigo Syndicate 1301', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Pastikan tidak ada data P&I dengan nilai di luar daftar yang sudah dipetakan
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "pni_quotation"
        WHERE "clubFormat"::text NOT IN ('MSIG_SPECIALTY_MARINE_NV', 'EAGLE_OCEAN_MARINE', 'INIGO_SYNDICATE_1301')
    ) THEN
        RAISE EXCEPTION 'pni_quotation memakai club format yang tidak dikenal';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "qs_template"
        WHERE "pniClubFormat" IS NOT NULL
          AND "pniClubFormat"::text NOT IN ('MSIG_SPECIALTY_MARINE_NV', 'EAGLE_OCEAN_MARINE', 'INIGO_SYNDICATE_1301')
    ) THEN
        RAISE EXCEPTION 'qs_template memakai club format yang tidak dikenal';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "qs_template" ADD COLUMN "clubId" TEXT;

-- AlterTable
ALTER TABLE "pni_quotation" ADD COLUMN "clubId" TEXT,
ADD COLUMN "qsTemplateId" TEXT;

-- Isi kolom baru dari kolom enum lama
UPDATE "qs_template"
SET "clubId" = CASE "pniClubFormat"::text
    WHEN 'MSIG_SPECIALTY_MARINE_NV' THEN 'club_msig'
    WHEN 'EAGLE_OCEAN_MARINE' THEN 'club_eom'
    WHEN 'INIGO_SYNDICATE_1301' THEN 'club_inigo'
END
WHERE "pniClubFormat" IS NOT NULL;

UPDATE "pni_quotation"
SET "clubId" = CASE "clubFormat"::text
    WHEN 'MSIG_SPECIALTY_MARINE_NV' THEN 'club_msig'
    WHEN 'EAGLE_OCEAN_MARINE' THEN 'club_eom'
    WHEN 'INIGO_SYNDICATE_1301' THEN 'club_inigo'
END;

-- Hubungkan quotation P&I ke template terbaru milik klubnya
UPDATE "pni_quotation" AS pq
SET "qsTemplateId" = (
    SELECT t."_id"
    FROM "qs_template" AS t
    WHERE t."clubId" = pq."clubId"
      AND t."deletedAt" IS NULL
    ORDER BY t."updatedAt" DESC
    LIMIT 1
);

-- AlterTable
ALTER TABLE "pni_quotation" ALTER COLUMN "clubId" SET NOT NULL;

-- DropIndex
DROP INDEX "qs_template_pniClubFormat_idx";

-- DropIndex
DROP INDEX "pni_quotation_clubFormat_idx";

-- AlterTable
ALTER TABLE "qs_template" DROP COLUMN "pniClubFormat";

-- AlterTable
ALTER TABLE "pni_quotation" DROP COLUMN "clubFormat";

-- DropEnum
DROP TYPE "PniClubFormat";

-- CreateIndex
CREATE UNIQUE INDEX "club_code_key" ON "club"("code");

-- CreateIndex
CREATE INDEX "club_deletedAt_idx" ON "club"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_identityKey_key" ON "vessel"("identityKey");

-- CreateIndex
CREATE INDEX "vessel_normalizedName_idx" ON "vessel"("normalizedName");

-- CreateIndex
CREATE INDEX "vessel_deletedAt_idx" ON "vessel"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_policy_coverageKey_key" ON "vessel_policy"("coverageKey");

-- CreateIndex
CREATE INDEX "vessel_policy_vesselId_idx" ON "vessel_policy"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_policy_clientId_idx" ON "vessel_policy"("clientId");

-- CreateIndex
CREATE INDEX "vessel_policy_policyNumber_idx" ON "vessel_policy"("policyNumber");

-- CreateIndex
CREATE INDEX "vessel_policy_periodEnd_idx" ON "vessel_policy"("periodEnd");

-- CreateIndex
CREATE INDEX "vessel_policy_deletedAt_idx" ON "vessel_policy"("deletedAt");

-- CreateIndex
CREATE INDEX "qs_template_clubId_idx" ON "qs_template"("clubId");

-- CreateIndex
CREATE INDEX "pni_quotation_clubId_idx" ON "pni_quotation"("clubId");

-- CreateIndex
CREATE INDEX "pni_quotation_qsTemplateId_idx" ON "pni_quotation"("qsTemplateId");

-- AddForeignKey
ALTER TABLE "qs_template" ADD CONSTRAINT "qs_template_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_quotation" ADD CONSTRAINT "pni_quotation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_quotation" ADD CONSTRAINT "pni_quotation_qsTemplateId_fkey" FOREIGN KEY ("qsTemplateId") REFERENCES "qs_template"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_policy" ADD CONSTRAINT "vessel_policy_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessel"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_policy" ADD CONSTRAINT "vessel_policy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
