-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'SENT_TO_INSURANCE', 'REVISION', 'POLICY_ISSUED');

-- CreateEnum
CREATE TYPE "QuotationApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'REVISION');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('POLICY_ISSUED', 'PLACEMENT_COMPLETED');

-- CreateEnum
CREATE TYPE "RequestInvoiceStatus" AS ENUM ('DRAFT', 'RFI_SUBMITTED', 'RETURNED_TO_TECHNICAL', 'READY_FOR_INVOICE');

-- CreateEnum
CREATE TYPE "RequestInvoiceReviewAction" AS ENUM ('APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RequestInvoiceDocumentType" AS ENUM ('POLICY_DOCUMENT', 'SIGNED_QS', 'CN_DN', 'RENEWAL_ATTACHMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceDocumentType" AS ENUM ('INVOICE_PDF', 'VOUCHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('INVOICE_ISSUED', 'UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "IncomingPaymentStatus" AS ENUM ('PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OutgoingPaymentStatus" AS ENUM ('WAITING_PAYMENT', 'PARTIAL_PAYMENT', 'FULLY_PAID');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('SHIPPED', 'DELIVERED', 'COMPLETED');

-- CreateTable
CREATE TABLE "insurance_type" (
    "_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "insurance_type_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "insurance_company" (
    "_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "insurance_company_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "bank" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bank_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "qs_template" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateVersion" TEXT,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "qs_template_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "warranty" (
    "_id" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "warranty_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "terms_condition" (
    "_id" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "terms_condition_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "surveyor" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "surveyor_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "adjuster" (
    "_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "adjuster_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "client" (
    "_id" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "client_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation" (
    "_id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "insuranceTypeId" TEXT NOT NULL,
    "insured" TEXT,
    "address" TEXT,
    "quotationDate" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "interest" TEXT,
    "rate" DECIMAL(15,4),
    "premium" DECIMAL(15,2),
    "deductible" DECIMAL(15,2),
    "brokerage" DECIMAL(15,4),
    "status" "QuotationStatus" NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "templateVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_object" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_object_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_coverage" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "coverageType" TEXT,
    "description" TEXT,
    "value" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_coverage_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_term" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "termsConditionId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_term_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_warranty" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "warrantyId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_warranty_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_attachment" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "fileName" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotation_attachment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_approval" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "approverId" TEXT,
    "action" "QuotationApprovalAction" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_approval_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "quotation_history" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "fromStatus" "QuotationStatus",
    "toStatus" "QuotationStatus" NOT NULL,
    "action" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_history_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "policy" (
    "_id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "policyDate" TIMESTAMP(3),
    "insuranceTypeId" TEXT NOT NULL,
    "policyDocumentUrl" TEXT,
    "status" "PolicyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "policy_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "policy_participant" (
    "_id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "share" DECIMAL(5,2) NOT NULL,
    "orderNo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "policy_participant_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "policy_history" (
    "_id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "fromStatus" "PolicyStatus",
    "toStatus" "PolicyStatus" NOT NULL,
    "action" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_history_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "request_invoice" (
    "_id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "RequestInvoiceStatus" NOT NULL,
    "notes" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "request_invoice_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "request_invoice_document" (
    "_id" TEXT NOT NULL,
    "requestInvoiceId" TEXT NOT NULL,
    "documentType" "RequestInvoiceDocumentType" NOT NULL,
    "fileName" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "request_invoice_document_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "request_invoice_review" (
    "_id" TEXT NOT NULL,
    "requestInvoiceId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "action" "RequestInvoiceReviewAction" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_invoice_review_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "_id" TEXT NOT NULL,
    "requestInvoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(15,2),
    "ppn" DECIMAL(15,2),
    "grandTotal" DECIMAL(15,2),
    "status" "InvoiceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "invoice_document" (
    "_id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "documentType" "InvoiceDocumentType" NOT NULL,
    "fileName" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoice_document_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "incoming_payment" (
    "_id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "amount" DECIMAL(15,2),
    "paymentMethod" TEXT,
    "bankId" TEXT,
    "receiptNumber" TEXT,
    "proofOfPaymentUrl" TEXT,
    "status" "IncomingPaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "incoming_payment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "incoming_payment_installment" (
    "_id" TEXT NOT NULL,
    "incomingPaymentId" TEXT NOT NULL,
    "installmentOrder" INTEGER,
    "amount" DECIMAL(15,2),
    "dueDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "proofOfPaymentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "incoming_payment_installment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "outgoing_payment" (
    "_id" TEXT NOT NULL,
    "policyParticipantId" TEXT NOT NULL,
    "amount" DECIMAL(15,2),
    "paymentDate" TIMESTAMP(3),
    "status" "OutgoingPaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "outgoing_payment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "outgoing_installment" (
    "_id" TEXT NOT NULL,
    "outgoingPaymentId" TEXT NOT NULL,
    "installmentOrder" INTEGER,
    "amount" DECIMAL(15,2),
    "paymentDate" TIMESTAMP(3),
    "proofOfPaymentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "outgoing_installment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "_id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "courier" TEXT,
    "trackingNumber" TEXT,
    "shipmentDate" TIMESTAMP(3),
    "receiver" TEXT,
    "status" "ShipmentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "shipment_document" (
    "_id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "documentType" TEXT,
    "fileName" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "shipment_document_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "_id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "file_upload" (
    "_id" TEXT NOT NULL,
    "module" TEXT,
    "referenceId" TEXT,
    "fileName" TEXT,
    "url" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "file_upload_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_type_code_key" ON "insurance_type"("code");

-- CreateIndex
CREATE INDEX "insurance_type_deletedAt_idx" ON "insurance_type"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_company_code_key" ON "insurance_company"("code");

-- CreateIndex
CREATE INDEX "insurance_company_deletedAt_idx" ON "insurance_company"("deletedAt");

-- CreateIndex
CREATE INDEX "bank_deletedAt_idx" ON "bank"("deletedAt");

-- CreateIndex
CREATE INDEX "qs_template_deletedAt_idx" ON "qs_template"("deletedAt");

-- CreateIndex
CREATE INDEX "warranty_deletedAt_idx" ON "warranty"("deletedAt");

-- CreateIndex
CREATE INDEX "terms_condition_deletedAt_idx" ON "terms_condition"("deletedAt");

-- CreateIndex
CREATE INDEX "surveyor_deletedAt_idx" ON "surveyor"("deletedAt");

-- CreateIndex
CREATE INDEX "adjuster_deletedAt_idx" ON "adjuster"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_clientCode_key" ON "client"("clientCode");

-- CreateIndex
CREATE INDEX "client_deletedAt_idx" ON "client"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_quotationNumber_key" ON "quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "quotation_clientId_idx" ON "quotation"("clientId");

-- CreateIndex
CREATE INDEX "quotation_insuranceTypeId_idx" ON "quotation"("insuranceTypeId");

-- CreateIndex
CREATE INDEX "quotation_status_idx" ON "quotation"("status");

-- CreateIndex
CREATE INDEX "quotation_deletedAt_idx" ON "quotation"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_object_quotationId_idx" ON "quotation_object"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_object_deletedAt_idx" ON "quotation_object"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_coverage_quotationId_idx" ON "quotation_coverage"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_coverage_deletedAt_idx" ON "quotation_coverage"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_term_quotationId_idx" ON "quotation_term"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_term_termsConditionId_idx" ON "quotation_term"("termsConditionId");

-- CreateIndex
CREATE INDEX "quotation_term_deletedAt_idx" ON "quotation_term"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_warranty_quotationId_idx" ON "quotation_warranty"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_warranty_warrantyId_idx" ON "quotation_warranty"("warrantyId");

-- CreateIndex
CREATE INDEX "quotation_warranty_deletedAt_idx" ON "quotation_warranty"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_attachment_quotationId_idx" ON "quotation_attachment"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_attachment_deletedAt_idx" ON "quotation_attachment"("deletedAt");

-- CreateIndex
CREATE INDEX "quotation_approval_quotationId_idx" ON "quotation_approval"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_history_quotationId_idx" ON "quotation_history"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_quotationId_key" ON "policy"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_policyNumber_key" ON "policy"("policyNumber");

-- CreateIndex
CREATE INDEX "policy_quotationId_idx" ON "policy"("quotationId");

-- CreateIndex
CREATE INDEX "policy_insuranceTypeId_idx" ON "policy"("insuranceTypeId");

-- CreateIndex
CREATE INDEX "policy_status_idx" ON "policy"("status");

-- CreateIndex
CREATE INDEX "policy_deletedAt_idx" ON "policy"("deletedAt");

-- CreateIndex
CREATE INDEX "policy_participant_policyId_idx" ON "policy_participant"("policyId");

-- CreateIndex
CREATE INDEX "policy_participant_insuranceCompanyId_idx" ON "policy_participant"("insuranceCompanyId");

-- CreateIndex
CREATE INDEX "policy_participant_deletedAt_idx" ON "policy_participant"("deletedAt");

-- CreateIndex
CREATE INDEX "policy_history_policyId_idx" ON "policy_history"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "request_invoice_requestNumber_key" ON "request_invoice"("requestNumber");

-- CreateIndex
CREATE INDEX "request_invoice_policyId_idx" ON "request_invoice"("policyId");

-- CreateIndex
CREATE INDEX "request_invoice_status_idx" ON "request_invoice"("status");

-- CreateIndex
CREATE INDEX "request_invoice_deletedAt_idx" ON "request_invoice"("deletedAt");

-- CreateIndex
CREATE INDEX "request_invoice_document_requestInvoiceId_idx" ON "request_invoice_document"("requestInvoiceId");

-- CreateIndex
CREATE INDEX "request_invoice_document_deletedAt_idx" ON "request_invoice_document"("deletedAt");

-- CreateIndex
CREATE INDEX "request_invoice_review_requestInvoiceId_idx" ON "request_invoice_review"("requestInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_invoiceNumber_key" ON "invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_requestInvoiceId_idx" ON "invoice"("requestInvoiceId");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "invoice"("status");

-- CreateIndex
CREATE INDEX "invoice_deletedAt_idx" ON "invoice"("deletedAt");

-- CreateIndex
CREATE INDEX "invoice_document_invoiceId_idx" ON "invoice_document"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_document_deletedAt_idx" ON "invoice_document"("deletedAt");

-- CreateIndex
CREATE INDEX "incoming_payment_invoiceId_idx" ON "incoming_payment"("invoiceId");

-- CreateIndex
CREATE INDEX "incoming_payment_bankId_idx" ON "incoming_payment"("bankId");

-- CreateIndex
CREATE INDEX "incoming_payment_deletedAt_idx" ON "incoming_payment"("deletedAt");

-- CreateIndex
CREATE INDEX "incoming_payment_installment_incomingPaymentId_idx" ON "incoming_payment_installment"("incomingPaymentId");

-- CreateIndex
CREATE INDEX "incoming_payment_installment_deletedAt_idx" ON "incoming_payment_installment"("deletedAt");

-- CreateIndex
CREATE INDEX "outgoing_payment_policyParticipantId_idx" ON "outgoing_payment"("policyParticipantId");

-- CreateIndex
CREATE INDEX "outgoing_payment_status_idx" ON "outgoing_payment"("status");

-- CreateIndex
CREATE INDEX "outgoing_payment_deletedAt_idx" ON "outgoing_payment"("deletedAt");

-- CreateIndex
CREATE INDEX "outgoing_installment_outgoingPaymentId_idx" ON "outgoing_installment"("outgoingPaymentId");

-- CreateIndex
CREATE INDEX "outgoing_installment_deletedAt_idx" ON "outgoing_installment"("deletedAt");

-- CreateIndex
CREATE INDEX "shipment_invoiceId_idx" ON "shipment"("invoiceId");

-- CreateIndex
CREATE INDEX "shipment_status_idx" ON "shipment"("status");

-- CreateIndex
CREATE INDEX "shipment_deletedAt_idx" ON "shipment"("deletedAt");

-- CreateIndex
CREATE INDEX "shipment_document_shipmentId_idx" ON "shipment_document"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_document_deletedAt_idx" ON "shipment_document"("deletedAt");

-- CreateIndex
CREATE INDEX "notification_recipientId_idx" ON "notification"("recipientId");

-- CreateIndex
CREATE INDEX "file_upload_module_referenceId_idx" ON "file_upload"("module", "referenceId");

-- CreateIndex
CREATE INDEX "file_upload_deletedAt_idx" ON "file_upload"("deletedAt");

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_insuranceTypeId_fkey" FOREIGN KEY ("insuranceTypeId") REFERENCES "insurance_type"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_object" ADD CONSTRAINT "quotation_object_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_coverage" ADD CONSTRAINT "quotation_coverage_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_term" ADD CONSTRAINT "quotation_term_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_term" ADD CONSTRAINT "quotation_term_termsConditionId_fkey" FOREIGN KEY ("termsConditionId") REFERENCES "terms_condition"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_warranty" ADD CONSTRAINT "quotation_warranty_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_warranty" ADD CONSTRAINT "quotation_warranty_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "warranty"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_attachment" ADD CONSTRAINT "quotation_attachment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approval" ADD CONSTRAINT "quotation_approval_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_history" ADD CONSTRAINT "quotation_history_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_insuranceTypeId_fkey" FOREIGN KEY ("insuranceTypeId") REFERENCES "insurance_type"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_participant" ADD CONSTRAINT "policy_participant_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_participant" ADD CONSTRAINT "policy_participant_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "insurance_company"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_history" ADD CONSTRAINT "policy_history_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_invoice" ADD CONSTRAINT "request_invoice_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policy"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_invoice_document" ADD CONSTRAINT "request_invoice_document_requestInvoiceId_fkey" FOREIGN KEY ("requestInvoiceId") REFERENCES "request_invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_invoice_review" ADD CONSTRAINT "request_invoice_review_requestInvoiceId_fkey" FOREIGN KEY ("requestInvoiceId") REFERENCES "request_invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_requestInvoiceId_fkey" FOREIGN KEY ("requestInvoiceId") REFERENCES "request_invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_document" ADD CONSTRAINT "invoice_document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_payment" ADD CONSTRAINT "incoming_payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_payment" ADD CONSTRAINT "incoming_payment_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "bank"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_payment_installment" ADD CONSTRAINT "incoming_payment_installment_incomingPaymentId_fkey" FOREIGN KEY ("incomingPaymentId") REFERENCES "incoming_payment"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_payment" ADD CONSTRAINT "outgoing_payment_policyParticipantId_fkey" FOREIGN KEY ("policyParticipantId") REFERENCES "policy_participant"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_installment" ADD CONSTRAINT "outgoing_installment_outgoingPaymentId_fkey" FOREIGN KEY ("outgoingPaymentId") REFERENCES "outgoing_payment"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_document" ADD CONSTRAINT "shipment_document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("_id") ON DELETE RESTRICT ON UPDATE CASCADE;
