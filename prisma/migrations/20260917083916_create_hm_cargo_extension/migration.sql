-- CreateEnum
CREATE TYPE "QsTemplateDomain" AS ENUM ('PNI', 'HULL_MACHINERY', 'CARGO');

-- CreateEnum
CREATE TYPE "CargoInstituteClause" AS ENUM ('INSTITUTE_CARGO_A', 'INSTITUTE_CARGO_B', 'INSTITUTE_CARGO_C', 'INSTITUTE_BULK_OIL', 'INSTITUTE_COAL', 'INSTITUTE_CARGO_AIR');

-- CreateEnum
CREATE TYPE "QuotationTermSection" AS ENUM ('TERMS_CONDITIONS', 'ADJUSTER_SURVEYOR');

-- AlterTable
ALTER TABLE "qs_template" ADD COLUMN     "templateDomain" "QsTemplateDomain";

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "attentionTo" TEXT,
ADD COLUMN     "confirmedAcceptedBy" TEXT,
ADD COLUMN     "deductibleBasis" TEXT,
ADD COLUMN     "deductibleText" TEXT,
ADD COLUMN     "insuranceLabelValue" TEXT,
ADD COLUMN     "periodText" TEXT,
ADD COLUMN     "recipient" TEXT,
ADD COLUMN     "sumInsured" DECIMAL(15,2),
ADD COLUMN     "sumInsuredCurrency" TEXT;

-- AlterTable
ALTER TABLE "quotation_term" ADD COLUMN     "conditionRule" JSONB,
ADD COLUMN     "isEditable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRemovable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSelected" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "section" "QuotationTermSection" NOT NULL DEFAULT 'TERMS_CONDITIONS',
ADD COLUMN     "selectionGroup" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotation_warranty" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "hm_quotation" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "vesselType" TEXT,
    "tradingWarranty" TEXT,
    "premiumPaymentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "brokerageEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hm_quotation_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "cargo_quotation" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "interestInsured" TEXT,
    "voyageFrom" TEXT,
    "voyageTo" TEXT,
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "conveyance" TEXT,
    "instituteCargoClause" "CargoInstituteClause",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cargo_quotation_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "hm_quotation_installment" (
    "_id" TEXT NOT NULL,
    "hmQuotationId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2),
    "dueAfterDays" INTEGER,
    "amount" DECIMAL(15,2),
    "currency" TEXT,
    "dueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hm_quotation_installment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_adjuster" (
    "quotationId" TEXT NOT NULL,
    "adjusterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_adjuster_pkey" PRIMARY KEY ("quotationId","adjusterId")
);

-- CreateTable
CREATE TABLE "quotation_surveyor" (
    "quotationId" TEXT NOT NULL,
    "surveyorId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_surveyor_pkey" PRIMARY KEY ("quotationId","surveyorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "hm_quotation_quotationId_key" ON "hm_quotation"("quotationId");

-- CreateIndex
CREATE INDEX "hm_quotation_deletedAt_idx" ON "hm_quotation"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_quotation_quotationId_key" ON "cargo_quotation"("quotationId");

-- CreateIndex
CREATE INDEX "cargo_quotation_deletedAt_idx" ON "cargo_quotation"("deletedAt");

-- CreateIndex
CREATE INDEX "hm_quotation_installment_deletedAt_idx" ON "hm_quotation_installment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "hm_quotation_installment_hmQuotationId_installmentNo_key" ON "hm_quotation_installment"("hmQuotationId", "installmentNo");

-- CreateIndex
CREATE INDEX "quotation_adjuster_adjusterId_idx" ON "quotation_adjuster"("adjusterId");

-- CreateIndex
CREATE INDEX "quotation_surveyor_surveyorId_idx" ON "quotation_surveyor"("surveyorId");

-- CreateIndex
CREATE INDEX "qs_template_templateDomain_idx" ON "qs_template"("templateDomain");

-- AddForeignKey
ALTER TABLE "hm_quotation" ADD CONSTRAINT "hm_quotation_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_quotation" ADD CONSTRAINT "cargo_quotation_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hm_quotation_installment" ADD CONSTRAINT "hm_quotation_installment_hmQuotationId_fkey" FOREIGN KEY ("hmQuotationId") REFERENCES "hm_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_adjuster" ADD CONSTRAINT "quotation_adjuster_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_adjuster" ADD CONSTRAINT "quotation_adjuster_adjusterId_fkey" FOREIGN KEY ("adjusterId") REFERENCES "adjuster"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_surveyor" ADD CONSTRAINT "quotation_surveyor_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_surveyor" ADD CONSTRAINT "quotation_surveyor_surveyorId_fkey" FOREIGN KEY ("surveyorId") REFERENCES "surveyor"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
