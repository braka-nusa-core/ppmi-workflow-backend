-- AlterTable
ALTER TABLE "quotation_object" ADD COLUMN     "vesselId" TEXT;

-- CreateTable
CREATE TABLE "vessel_document_requirement" (
    "_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT,
    "vesselType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vessel_document_requirement_pkey" PRIMARY KEY ("_id")
);


-- CreateIndex
CREATE INDEX "quotation_object_vesselId_idx" ON "quotation_object"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_document_requirement_category_idx" ON "vessel_document_requirement"("category");

-- CreateIndex
CREATE INDEX "vessel_document_requirement_deletedAt_idx" ON "vessel_document_requirement"("deletedAt");

-- AddForeignKey
ALTER TABLE "quotation_object" ADD CONSTRAINT "quotation_object_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessel"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
