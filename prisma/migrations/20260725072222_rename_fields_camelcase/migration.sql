/*
  Warnings:

  - The primary key for the `log` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `log` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `log` table. All the data in the column will be lost.
  - You are about to drop the column `reference_id` on the `log` table. All the data in the column will be lost.
  - You are about to drop the column `reference_type` on the `log` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `log` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `log` table. All the data in the column will be lost.
  - The primary key for the `organization_unit` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `organization_unit` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `organization_unit` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `organization_unit` table. All the data in the column will be lost.
  - You are about to drop the column `parent_id` on the `organization_unit` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `organization_unit` table. All the data in the column will be lost.
  - The primary key for the `organization_unit_permission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `organization_unit_id` on the `organization_unit_permission` table. All the data in the column will be lost.
  - You are about to drop the column `permission_id` on the `organization_unit_permission` table. All the data in the column will be lost.
  - The primary key for the `permission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `permission` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `permission` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `permission` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `permission` table. All the data in the column will be lost.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `organization_unit_id` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `user` table. All the data in the column will be lost.
  - The required column `_id` was added to the `log` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `log` table without a default value. This is not possible if the table is not empty.
  - The required column `_id` was added to the `organization_unit` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `organization_unit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationUnitId` to the `organization_unit_permission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permissionId` to the `organization_unit_permission` table without a default value. This is not possible if the table is not empty.
  - The required column `_id` was added to the `permission` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `permission` table without a default value. This is not possible if the table is not empty.
  - The required column `_id` was added to the `user` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updatedAt` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "log" DROP CONSTRAINT "log_user_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_unit" DROP CONSTRAINT "organization_unit_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_unit_permission" DROP CONSTRAINT "organization_unit_permission_organization_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_unit_permission" DROP CONSTRAINT "organization_unit_permission_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_organization_unit_id_fkey";

-- DropIndex
DROP INDEX "log_reference_type_reference_id_idx";

-- AlterTable
ALTER TABLE "log" DROP CONSTRAINT "log_pkey",
DROP COLUMN "created_at",
DROP COLUMN "id",
DROP COLUMN "reference_id",
DROP COLUMN "reference_type",
DROP COLUMN "updated_at",
DROP COLUMN "user_id",
ADD COLUMN     "_id" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" "LogReferenceType",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ADD CONSTRAINT "log_pkey" PRIMARY KEY ("_id");

-- AlterTable
ALTER TABLE "organization_unit" DROP CONSTRAINT "organization_unit_pkey",
DROP COLUMN "created_at",
DROP COLUMN "deleted_at",
DROP COLUMN "id",
DROP COLUMN "parent_id",
DROP COLUMN "updated_at",
ADD COLUMN     "_id" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "organization_unit_pkey" PRIMARY KEY ("_id");

-- AlterTable
ALTER TABLE "organization_unit_permission" DROP CONSTRAINT "organization_unit_permission_pkey",
DROP COLUMN "organization_unit_id",
DROP COLUMN "permission_id",
ADD COLUMN     "organizationUnitId" TEXT NOT NULL,
ADD COLUMN     "permissionId" TEXT NOT NULL,
ADD CONSTRAINT "organization_unit_permission_pkey" PRIMARY KEY ("organizationUnitId", "permissionId");

-- AlterTable
ALTER TABLE "permission" DROP CONSTRAINT "permission_pkey",
DROP COLUMN "created_at",
DROP COLUMN "deleted_at",
DROP COLUMN "id",
DROP COLUMN "updated_at",
ADD COLUMN     "_id" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "permission_pkey" PRIMARY KEY ("_id");

-- AlterTable
ALTER TABLE "user" DROP CONSTRAINT "user_pkey",
DROP COLUMN "created_at",
DROP COLUMN "deleted_at",
DROP COLUMN "id",
DROP COLUMN "organization_unit_id",
DROP COLUMN "updated_at",
ADD COLUMN     "_id" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "organizationUnitId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "user_pkey" PRIMARY KEY ("_id");

-- CreateIndex
CREATE INDEX "log_referenceType_referenceId_idx" ON "log"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "organization_unit" ADD CONSTRAINT "organization_unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization_unit"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_unit"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit_permission" ADD CONSTRAINT "organization_unit_permission_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "organization_unit"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit_permission" ADD CONSTRAINT "organization_unit_permission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
