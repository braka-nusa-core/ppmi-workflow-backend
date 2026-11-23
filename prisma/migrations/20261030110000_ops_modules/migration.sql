-- AlterEnum
ALTER TYPE "LogReferenceType" ADD VALUE 'VESSEL_SURVEY';

-- AlterEnum
ALTER TYPE "LogReferenceType" ADD VALUE 'ASSIGNMENT';

-- AlterEnum
ALTER TYPE "LogReferenceType" ADD VALUE 'MEETING';

-- AlterEnum
ALTER TYPE "LogReferenceType" ADD VALUE 'FOLLOW_UP';


-- CreateEnum
CREATE TYPE "AssignmentEntityType" AS ENUM ('VESSEL', 'QUOTATION', 'POLICY', 'CLIENT');

-- CreateEnum
CREATE TYPE "AssignmentCategory" AS ENUM ('INTERNAL', 'EXTERNAL', 'INSURER', 'INSURED');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');


-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" TEXT,
ADD COLUMN     "type" TEXT;

-- CreateTable
CREATE TABLE "assignment" (
    "_id" TEXT NOT NULL,
    "entityType" "AssignmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" "AssignmentCategory" NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "organizationName" TEXT,
    "role" TEXT,
    "note" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "meeting" (
    "_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "participants" TEXT,
    "agenda" TEXT,
    "outcome" TEXT,
    "entityType" "AssignmentEntityType",
    "entityId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "meeting_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "follow_up" (
    "_id" TEXT NOT NULL,
    "meetingId" TEXT,
    "entityType" "AssignmentEntityType",
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "follow_up_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "vessel_survey" (
    "_id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "surveyorId" TEXT,
    "quotationId" TEXT,
    "surveyType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "nominatedAt" TIMESTAMP(3),
    "surveyDate" TIMESTAMP(3),
    "reportDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "reportDocumentId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vessel_survey_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_term_version" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "terms" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_term_version_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "cargo_quotation_installment" (
    "_id" TEXT NOT NULL,
    "cargoQuotationId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2),
    "dueAfterDays" INTEGER,
    "amount" DECIMAL(15,2),
    "currency" TEXT,
    "dueDate" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cargo_quotation_installment_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_dedupeKey_key" ON "notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "notification_recipientId_isRead_idx" ON "notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "assignment_entityType_entityId_idx" ON "assignment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "assignment_userId_idx" ON "assignment"("userId");

-- CreateIndex
CREATE INDEX "assignment_deletedAt_idx" ON "assignment"("deletedAt");

-- CreateIndex
CREATE INDEX "meeting_entityType_entityId_idx" ON "meeting"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "meeting_meetingDate_idx" ON "meeting"("meetingDate");

-- CreateIndex
CREATE INDEX "meeting_deletedAt_idx" ON "meeting"("deletedAt");

-- CreateIndex
CREATE INDEX "follow_up_meetingId_idx" ON "follow_up"("meetingId");

-- CreateIndex
CREATE INDEX "follow_up_entityType_entityId_idx" ON "follow_up"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "follow_up_assigneeId_idx" ON "follow_up"("assigneeId");

-- CreateIndex
CREATE INDEX "follow_up_status_dueDate_idx" ON "follow_up"("status", "dueDate");

-- CreateIndex
CREATE INDEX "follow_up_deletedAt_idx" ON "follow_up"("deletedAt");

-- CreateIndex
CREATE INDEX "vessel_survey_vesselId_idx" ON "vessel_survey"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_survey_surveyorId_idx" ON "vessel_survey"("surveyorId");

-- CreateIndex
CREATE INDEX "vessel_survey_quotationId_idx" ON "vessel_survey"("quotationId");

-- CreateIndex
CREATE INDEX "vessel_survey_validUntil_idx" ON "vessel_survey"("validUntil");

-- CreateIndex
CREATE INDEX "vessel_survey_deletedAt_idx" ON "vessel_survey"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_term_version_quotationId_idx" ON "quotation_term_version"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_term_version_quotationId_version_key" ON "quotation_term_version"("quotationId", "version");

-- CreateIndex
CREATE INDEX "cargo_quotation_installment_dueDate_idx" ON "cargo_quotation_installment"("dueDate");

-- CreateIndex
CREATE INDEX "cargo_quotation_installment_deletedAt_idx" ON "cargo_quotation_installment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_quotation_installment_cargoQuotationId_installmentNo_key" ON "cargo_quotation_installment"("cargoQuotationId", "installmentNo");

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_survey" ADD CONSTRAINT "vessel_survey_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessel"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_survey" ADD CONSTRAINT "vessel_survey_surveyorId_fkey" FOREIGN KEY ("surveyorId") REFERENCES "surveyor"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_survey" ADD CONSTRAINT "vessel_survey_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_survey" ADD CONSTRAINT "vessel_survey_reportDocumentId_fkey" FOREIGN KEY ("reportDocumentId") REFERENCES "vessel_document"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_term_version" ADD CONSTRAINT "quotation_term_version_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_quotation_installment" ADD CONSTRAINT "cargo_quotation_installment_cargoQuotationId_fkey" FOREIGN KEY ("cargoQuotationId") REFERENCES "cargo_quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
