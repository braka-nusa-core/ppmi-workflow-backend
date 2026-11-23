-- CreateEnum
CREATE TYPE "VoyageType" AS ENUM ('UNDER_VOYAGE', 'SINGLE_VOYAGE');

-- CreateEnum
CREATE TYPE "PniVesselScope" AS ENUM ('SINGLE', 'FLEET');

-- CreateEnum
CREATE TYPE "PniCoverType" AS ENUM ('FULL', 'LIMITED');

-- CreateEnum
CREATE TYPE "PniPremiumType" AS ENUM ('MUTUAL', 'FIX');

-- DropForeignKey
ALTER TABLE "policy_participant" DROP CONSTRAINT "policy_participant_policyId_fkey";

-- DropIndex
DROP INDEX "policy_policyNumber_key";

-- AlterTable
ALTER TABLE "bank" ADD COLUMN     "currency" TEXT;

-- AlterTable
ALTER TABLE "qs_template" ADD COLUMN     "coverType" "PniCoverType";

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "voyageType" "VoyageType";

-- AlterTable
ALTER TABLE "pni_quotation" ADD COLUMN     "coverType" "PniCoverType",
ADD COLUMN     "declaredVesselCount" INTEGER,
ADD COLUMN     "premiumType" "PniPremiumType",
ADD COLUMN     "referenceDate" TIMESTAMP(3),
ADD COLUMN     "vesselScope" "PniVesselScope";

-- AlterTable
ALTER TABLE "policy" ADD COLUMN     "issuedById" TEXT,
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "placementCompletedAt" TIMESTAMP(3),
ADD COLUMN     "policyDocumentName" TEXT;

-- AlterTable
ALTER TABLE "policy_participant" ADD COLUMN     "quotationId" TEXT NOT NULL,
ALTER COLUMN "policyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "request_invoice_document" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "amountInWords" TEXT,
ADD COLUMN     "balanceDue" DECIMAL(18,2),
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankId" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "billToAddress" TEXT,
ADD COLUMN     "billToName" TEXT,
ADD COLUMN     "coverName" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'IDR',
ADD COLUMN     "discount" DECIMAL(18,2),
ADD COLUMN     "grossPremium" DECIMAL(18,2),
ADD COLUMN     "insuranceTypeLabel" TEXT,
ADD COLUMN     "issuedById" TEXT,
ADD COLUMN     "nettPremium" DECIMAL(18,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentDetail" TEXT,
ADD COLUMN     "paymentTermDays" INTEGER,
ADD COLUMN     "signerName" TEXT,
ADD COLUMN     "signerTitle" TEXT,
ADD COLUMN     "stampDutyPolicyCost" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "incoming_payment" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "outgoing_payment" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "shipment" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "receivedDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "invoice_item" (
    "_id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "policyNumber" TEXT,
    "voyageFrom" TEXT,
    "voyageTo" TEXT,
    "subjectInterest" TEXT,
    "sailingStart" TIMESTAMP(3),
    "sailingEnd" TIMESTAMP(3),
    "sumInsured" DECIMAL(18,2),
    "rate" DECIMAL(9,4),
    "total" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoice_item_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "invoice_number_setting" (
    "_id" TEXT NOT NULL,
    "insuranceTypeId" TEXT NOT NULL,
    "suffix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_number_setting_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "qs_option" (
    "_id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "qs_option_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE INDEX "invoice_item_invoiceId_idx" ON "invoice_item"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_item_deletedAt_idx" ON "invoice_item"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_number_setting_insuranceTypeId_key" ON "invoice_number_setting"("insuranceTypeId");

-- CreateIndex
CREATE INDEX "qs_option_group_idx" ON "qs_option"("group");

-- CreateIndex
CREATE INDEX "qs_option_deletedAt_idx" ON "qs_option"("deletedAt");

-- CreateIndex
CREATE INDEX "qs_template_coverType_idx" ON "qs_template"("coverType");

-- CreateIndex
CREATE INDEX "policy_policyNumber_idx" ON "policy"("policyNumber");

-- CreateIndex
CREATE INDEX "policy_participant_quotationId_idx" ON "policy_participant"("quotationId");

-- AddForeignKey
ALTER TABLE "policy_participant" ADD CONSTRAINT "policy_participant_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_participant" ADD CONSTRAINT "policy_participant_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
