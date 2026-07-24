/*
  Warnings:

  - The `reference_type` column on the `log` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `is_admin` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `bank` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `division` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_receipt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_shipment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `file_attachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `qs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_division` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `voucher` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phone]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `action` on the `log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('DIVISION', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'USER');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'REVISION', 'CANCEL', 'LOGIN', 'LOGOUT', 'VIEW', 'CLICK', 'OTHER');

-- CreateEnum
CREATE TYPE "LogReferenceType" AS ENUM ('QUOTATION_SLIP', 'POLICY_PLACEMENT', 'REQUEST_FOR_INVOICE', 'INVOICE', 'INCOMING_PAYMENT', 'OUTGOING_PAYMENT', 'SHIPMENT', 'USER_MANAGEMENT', 'INSURANCE_COMPANY', 'SURVEYOR', 'WARRANTY', 'TERMS_AND_CONDITIONS', 'QS_TEMPLATE', 'BANK', 'INSURANCE_TYPE');

-- DropForeignKey
ALTER TABLE "document_receipt" DROP CONSTRAINT "document_receipt_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "document_receipt" DROP CONSTRAINT "document_receipt_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "document_receipt" DROP CONSTRAINT "document_receipt_received_proof_id_fkey";

-- DropForeignKey
ALTER TABLE "document_receipt" DROP CONSTRAINT "document_receipt_shipment_id_fkey";

-- DropForeignKey
ALTER TABLE "document_shipment" DROP CONSTRAINT "document_shipment_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "document_shipment" DROP CONSTRAINT "document_shipment_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "document_shipment" DROP CONSTRAINT "document_shipment_shipping_proof_id_fkey";

-- DropForeignKey
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_qs_id_fkey";

-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_voucher_id_fkey";

-- DropForeignKey
ALTER TABLE "qs" DROP CONSTRAINT "qs_division_id_fkey";

-- DropForeignKey
ALTER TABLE "user_division" DROP CONSTRAINT "user_division_division_id_fkey";

-- DropForeignKey
ALTER TABLE "user_division" DROP CONSTRAINT "user_division_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_role" DROP CONSTRAINT "user_role_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_role" DROP CONSTRAINT "user_role_user_id_fkey";

-- DropForeignKey
ALTER TABLE "voucher" DROP CONSTRAINT "voucher_bank_id_fkey";

-- DropForeignKey
ALTER TABLE "voucher" DROP CONSTRAINT "voucher_invoice_id_fkey";

-- AlterTable
ALTER TABLE "log" DROP COLUMN "action",
ADD COLUMN     "action" "LogAction" NOT NULL,
DROP COLUMN "reference_type",
ADD COLUMN     "reference_type" "LogReferenceType";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "is_admin",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "organization_unit_id" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "password" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "bank";

-- DropTable
DROP TABLE "division";

-- DropTable
DROP TABLE "document_receipt";

-- DropTable
DROP TABLE "document_shipment";

-- DropTable
DROP TABLE "file_attachment";

-- DropTable
DROP TABLE "invoice";

-- DropTable
DROP TABLE "payment";

-- DropTable
DROP TABLE "qs";

-- DropTable
DROP TABLE "role";

-- DropTable
DROP TABLE "user_division";

-- DropTable
DROP TABLE "user_role";

-- DropTable
DROP TABLE "voucher";

-- DropEnum
DROP TYPE "Action";

-- DropEnum
DROP TYPE "FileReferenceType";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "QSSTATUS";

-- DropEnum
DROP TYPE "QSType";

-- DropEnum
DROP TYPE "ReferenceType";

-- DropEnum
DROP TYPE "VoucherPaymentType";

-- DropEnum
DROP TYPE "VoucherStatus";

-- CreateTable
CREATE TABLE "organization_unit" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "UnitType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_unit_permission" (
    "organization_unit_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "organization_unit_permission_pkey" PRIMARY KEY ("organization_unit_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_unit_code_key" ON "organization_unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_resource_action_key" ON "permission"("resource", "action");

-- CreateIndex
CREATE INDEX "log_reference_type_reference_id_idx" ON "log"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- AddForeignKey
ALTER TABLE "organization_unit" ADD CONSTRAINT "organization_unit_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit_permission" ADD CONSTRAINT "organization_unit_permission_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit_permission" ADD CONSTRAINT "organization_unit_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
