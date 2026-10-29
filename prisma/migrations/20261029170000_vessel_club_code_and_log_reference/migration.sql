-- AlterTable
ALTER TABLE "vessel_policy" RENAME COLUMN "club" TO "clubCode";

-- AlterTable
ALTER TABLE "vessel_policy" ADD COLUMN "clubRaw" TEXT;

-- AlterEnum
ALTER TYPE "LogReferenceType" ADD VALUE 'VESSEL';

-- AlterEnum
ALTER TYPE "LogReferenceType" ADD VALUE 'VESSEL_POLICY';
