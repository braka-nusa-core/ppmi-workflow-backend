-- CreateTable
CREATE TABLE "vessel_document" (
    "_id" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "documentDate" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vessel_document_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE INDEX "vessel_document_vesselId_idx" ON "vessel_document"("vesselId");

-- CreateIndex
CREATE INDEX "vessel_document_category_idx" ON "vessel_document"("category");

-- CreateIndex
CREATE INDEX "vessel_document_validUntil_idx" ON "vessel_document"("validUntil");

-- CreateIndex
CREATE INDEX "vessel_document_deletedAt_idx" ON "vessel_document"("deletedAt");

-- AddForeignKey
ALTER TABLE "vessel_document" ADD CONSTRAINT "vessel_document_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessel"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
