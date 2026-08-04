-- AlterTable
ALTER TABLE "job_installments" ADD COLUMN "invoiceStatus" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "invoiceStatus" TEXT;
ALTER TABLE "jobs" ADD COLUMN "paymentAmount" INTEGER;
