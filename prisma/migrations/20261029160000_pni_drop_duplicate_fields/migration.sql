-- Pindahkan nilai ke blok yang belum punya nilai
UPDATE "pni_insurance_block" AS b
SET "security" = pq."insurerOrSecurity"
FROM "pni_quotation" AS pq
WHERE b."pniQuotationId" = pq."_id"
  AND b."security" IS NULL
  AND pq."insurerOrSecurity" IS NOT NULL;

UPDATE "pni_insurance_block" AS b
SET "tradingArea" = pq."tradingLimits"
FROM "pni_quotation" AS pq
WHERE b."pniQuotationId" = pq."_id"
  AND b."tradingArea" IS NULL
  AND pq."tradingLimits" IS NOT NULL;

-- AlterTable
ALTER TABLE "pni_quotation" DROP COLUMN "insurerOrSecurity",
DROP COLUMN "tradingLimits";
