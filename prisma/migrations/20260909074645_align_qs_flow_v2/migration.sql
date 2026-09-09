-- CreateEnum
CREATE TYPE "InsuranceReviewAction" AS ENUM ('APPROVED', 'REVISION');

-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'INSURANCE_APPROVED';

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "insurerRevisionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "insurerRevisionUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "technicalUnitId" TEXT;

-- CreateTable
CREATE TABLE "quotation_submission" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_submission_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "insurance_review" (
    "_id" TEXT NOT NULL,
    "quotationSubmissionId" TEXT NOT NULL,
    "action" "InsuranceReviewAction" NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_review_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE INDEX "quotation_submission_quotationId_idx" ON "quotation_submission"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_submission_insuranceCompanyId_idx" ON "quotation_submission"("insuranceCompanyId");

-- CreateIndex
CREATE INDEX "insurance_review_quotationSubmissionId_idx" ON "insurance_review"("quotationSubmissionId");

-- CreateIndex
CREATE INDEX "quotation_technicalUnitId_idx" ON "quotation"("technicalUnitId");

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_technicalUnitId_fkey" FOREIGN KEY ("technicalUnitId") REFERENCES "organization_unit"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approval" ADD CONSTRAINT "quotation_approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_history" ADD CONSTRAINT "quotation_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_submission" ADD CONSTRAINT "quotation_submission_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_submission" ADD CONSTRAINT "quotation_submission_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "insurance_company"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_submission" ADD CONSTRAINT "quotation_submission_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_review" ADD CONSTRAINT "insurance_review_quotationSubmissionId_fkey" FOREIGN KEY ("quotationSubmissionId") REFERENCES "quotation_submission"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_review" ADD CONSTRAINT "insurance_review_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
