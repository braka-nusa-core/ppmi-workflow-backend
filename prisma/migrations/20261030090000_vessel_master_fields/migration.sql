-- AlterTable
ALTER TABLE "vessel" ADD COLUMN     "classNotApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flag" TEXT,
ADD COLUMN     "imoNumber" TEXT,
ADD COLUMN     "portOfRegistry" TEXT,
ADD COLUMN     "tradingArea" TEXT;

-- AlterTable
ALTER TABLE "pni_vessel" ADD COLUMN     "vesselId" TEXT;

-- CreateIndex
CREATE INDEX "vessel_imoNumber_idx" ON "vessel"("imoNumber");

-- CreateIndex
CREATE INDEX "pni_vessel_vesselId_idx" ON "pni_vessel"("vesselId");

-- AddForeignKey
ALTER TABLE "pni_vessel" ADD CONSTRAINT "pni_vessel_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "vessel"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
