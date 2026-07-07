-- AlterTable
ALTER TABLE "document_receipt" ADD COLUMN     "payment_id" TEXT;

-- AlterTable
ALTER TABLE "document_shipment" ADD COLUMN     "payment_id" TEXT,
ALTER COLUMN "invoice_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "document_shipment" ADD CONSTRAINT "document_shipment_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_receipt" ADD CONSTRAINT "document_receipt_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
