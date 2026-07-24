/*
  Warnings:

  - You are about to drop the column `code` on the `organization_unit` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,type]` on the table `organization_unit` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "organization_unit_code_key";

-- AlterTable
ALTER TABLE "organization_unit" DROP COLUMN "code";

-- CreateIndex
CREATE UNIQUE INDEX "organization_unit_name_type_key" ON "organization_unit"("name", "type");
