-- CreateEnum
CREATE TYPE "PniClubFormat" AS ENUM ('INIGO_SYNDICATE_1301', 'EAGLE_OCEAN_MARINE', 'MSIG_SPECIALTY_MARINE_NV');

-- CreateEnum
CREATE TYPE "PniPremiumBasis" AS ENUM ('PER_ANNUM', 'PER_VESSEL_PER_ANNUM', 'PRO_RATA', 'INCLUDED_NO_ADDITIONAL_CHARGE', 'OTHER');

-- CreateEnum
CREATE TYPE "PniProvisionType" AS ENUM ('CONDITION', 'CLAUSE', 'EXCLUSION', 'WARRANTY');

-- CreateEnum
CREATE TYPE "PniProvisionSource" AS ENUM ('PREDEFINED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PniProvisionScope" AS ENUM ('QUOTE', 'ALL_VESSELS', 'SELECTED_VESSELS');

-- CreateEnum
CREATE TYPE "PniDeductibleScope" AS ENUM ('FLAT', 'CLAIM_CATEGORY', 'ALL_VESSELS', 'SELECTED_VESSELS');

-- AlterTable
ALTER TABLE "qs_template" ADD COLUMN     "pniClubFormat" "PniClubFormat";

-- CreateTable
CREATE TABLE "pni_quotation" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "clubFormat" "PniClubFormat" NOT NULL,
    "referenceNumber" TEXT,
    "validityDays" INTEGER,
    "assuredDomicile" TEXT,
    "broker" TEXT,
    "insurerOrSecurity" TEXT,
    "tradingLimits" TEXT,
    "paymentTermsText" TEXT,
    "subjectivities" TEXT,
    "importantInformation" TEXT,
    "signatureName" TEXT,
    "signatureCity" TEXT,
    "signatureDate" TIMESTAMP(3),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_quotation_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_vessel" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imoNumber" TEXT,
    "vesselType" TEXT,
    "builtYear" INTEGER,
    "flag" TEXT,
    "vesselClass" TEXT,
    "classNotApplicable" BOOLEAN NOT NULL DEFAULT false,
    "grossTonnage" DECIMAL(15,2),
    "portOfRegistry" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_vessel_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_insurance_block" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "inheritsFromBlockId" TEXT,
    "typeOfInsurance" TEXT NOT NULL,
    "security" TEXT,
    "policyWordingReference" TEXT,
    "tradingArea" TEXT,
    "paymentWarrantyText" TEXT,
    "maximumInsured" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "premium" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "premiumBasis" "PniPremiumBasis" NOT NULL DEFAULT 'PER_ANNUM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_insurance_block_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_vessel_coverage" (
    "_id" TEXT NOT NULL,
    "pniVesselId" TEXT NOT NULL,
    "insuranceBlockId" TEXT NOT NULL,
    "annualPremium" DECIMAL(15,2),
    "limitAmount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_vessel_coverage_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_provision" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "insuranceBlockId" TEXT,
    "type" "PniProvisionType" NOT NULL,
    "source" "PniProvisionSource" NOT NULL DEFAULT 'CUSTOM',
    "scope" "PniProvisionScope" NOT NULL DEFAULT 'QUOTE',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "reference" TEXT,
    "conditionRule" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_provision_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_provision_vessel" (
    "provisionId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,

    CONSTRAINT "pni_provision_vessel_pkey" PRIMARY KEY ("provisionId","vesselId")
);

-- CreateTable
CREATE TABLE "pni_deductible" (
    "_id" TEXT NOT NULL,
    "insuranceBlockId" TEXT NOT NULL,
    "scope" "PniDeductibleScope" NOT NULL,
    "claimCategory" TEXT,
    "amount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_deductible_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_deductible_vessel" (
    "deductibleId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,

    CONSTRAINT "pni_deductible_vessel_pkey" PRIMARY KEY ("deductibleId","vesselId")
);

-- CreateTable
CREATE TABLE "pni_installment" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "amount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_installment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_required_document" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_required_document_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_organization_role" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "organization" TEXT,
    "role" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_organization_role_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "pni_cover_restriction" (
    "_id" TEXT NOT NULL,
    "pniQuotationId" TEXT NOT NULL,
    "insuranceBlockId" TEXT,
    "name" TEXT NOT NULL,
    "partReference" TEXT,
    "sectionReference" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pni_cover_restriction_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pni_quotation_quotationId_key" ON "pni_quotation"("quotationId");

-- CreateIndex
CREATE INDEX "pni_quotation_clubFormat_idx" ON "pni_quotation"("clubFormat");

-- CreateIndex
CREATE INDEX "pni_quotation_deletedAt_idx" ON "pni_quotation"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_vessel_pniQuotationId_idx" ON "pni_vessel"("pniQuotationId");

-- CreateIndex
CREATE INDEX "pni_vessel_deletedAt_idx" ON "pni_vessel"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_insurance_block_pniQuotationId_idx" ON "pni_insurance_block"("pniQuotationId");

-- CreateIndex
CREATE INDEX "pni_insurance_block_inheritsFromBlockId_idx" ON "pni_insurance_block"("inheritsFromBlockId");

-- CreateIndex
CREATE INDEX "pni_insurance_block_deletedAt_idx" ON "pni_insurance_block"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_vessel_coverage_insuranceBlockId_idx" ON "pni_vessel_coverage"("insuranceBlockId");

-- CreateIndex
CREATE INDEX "pni_vessel_coverage_deletedAt_idx" ON "pni_vessel_coverage"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pni_vessel_coverage_pniVesselId_insuranceBlockId_key" ON "pni_vessel_coverage"("pniVesselId", "insuranceBlockId");

-- CreateIndex
CREATE INDEX "pni_provision_pniQuotationId_idx" ON "pni_provision"("pniQuotationId");

-- CreateIndex
CREATE INDEX "pni_provision_insuranceBlockId_idx" ON "pni_provision"("insuranceBlockId");

-- CreateIndex
CREATE INDEX "pni_provision_deletedAt_idx" ON "pni_provision"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_provision_vessel_vesselId_idx" ON "pni_provision_vessel"("vesselId");

-- CreateIndex
CREATE INDEX "pni_deductible_insuranceBlockId_idx" ON "pni_deductible"("insuranceBlockId");

-- CreateIndex
CREATE INDEX "pni_deductible_deletedAt_idx" ON "pni_deductible"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_deductible_vessel_vesselId_idx" ON "pni_deductible_vessel"("vesselId");

-- CreateIndex
CREATE INDEX "pni_installment_deletedAt_idx" ON "pni_installment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pni_installment_pniQuotationId_installmentNo_key" ON "pni_installment"("pniQuotationId", "installmentNo");

-- CreateIndex
CREATE INDEX "pni_required_document_pniQuotationId_idx" ON "pni_required_document"("pniQuotationId");

-- CreateIndex
CREATE INDEX "pni_required_document_deletedAt_idx" ON "pni_required_document"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_organization_role_pniQuotationId_idx" ON "pni_organization_role"("pniQuotationId");

-- CreateIndex
CREATE INDEX "pni_organization_role_deletedAt_idx" ON "pni_organization_role"("deletedAt");

-- CreateIndex
CREATE INDEX "pni_cover_restriction_pniQuotationId_idx" ON "pni_cover_restriction"("pniQuotationId");

-- CreateIndex
CREATE INDEX "pni_cover_restriction_insuranceBlockId_idx" ON "pni_cover_restriction"("insuranceBlockId");

-- CreateIndex
CREATE INDEX "pni_cover_restriction_deletedAt_idx" ON "pni_cover_restriction"("deletedAt");

-- CreateIndex
CREATE INDEX "qs_template_pniClubFormat_idx" ON "qs_template"("pniClubFormat");

-- AddForeignKey
ALTER TABLE "pni_quotation" ADD CONSTRAINT "pni_quotation_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_vessel" ADD CONSTRAINT "pni_vessel_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_insurance_block" ADD CONSTRAINT "pni_insurance_block_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_insurance_block" ADD CONSTRAINT "pni_insurance_block_inheritsFromBlockId_fkey" FOREIGN KEY ("inheritsFromBlockId") REFERENCES "pni_insurance_block"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_vessel_coverage" ADD CONSTRAINT "pni_vessel_coverage_pniVesselId_fkey" FOREIGN KEY ("pniVesselId") REFERENCES "pni_vessel"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_vessel_coverage" ADD CONSTRAINT "pni_vessel_coverage_insuranceBlockId_fkey" FOREIGN KEY ("insuranceBlockId") REFERENCES "pni_insurance_block"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_provision" ADD CONSTRAINT "pni_provision_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_provision" ADD CONSTRAINT "pni_provision_insuranceBlockId_fkey" FOREIGN KEY ("insuranceBlockId") REFERENCES "pni_insurance_block"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_provision_vessel" ADD CONSTRAINT "pni_provision_vessel_provisionId_fkey" FOREIGN KEY ("provisionId") REFERENCES "pni_provision"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_provision_vessel" ADD CONSTRAINT "pni_provision_vessel_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "pni_vessel"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_deductible" ADD CONSTRAINT "pni_deductible_insuranceBlockId_fkey" FOREIGN KEY ("insuranceBlockId") REFERENCES "pni_insurance_block"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_deductible_vessel" ADD CONSTRAINT "pni_deductible_vessel_deductibleId_fkey" FOREIGN KEY ("deductibleId") REFERENCES "pni_deductible"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_deductible_vessel" ADD CONSTRAINT "pni_deductible_vessel_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "pni_vessel"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_installment" ADD CONSTRAINT "pni_installment_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_required_document" ADD CONSTRAINT "pni_required_document_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_organization_role" ADD CONSTRAINT "pni_organization_role_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_cover_restriction" ADD CONSTRAINT "pni_cover_restriction_pniQuotationId_fkey" FOREIGN KEY ("pniQuotationId") REFERENCES "pni_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pni_cover_restriction" ADD CONSTRAINT "pni_cover_restriction_insuranceBlockId_fkey" FOREIGN KEY ("insuranceBlockId") REFERENCES "pni_insurance_block"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
