-- AlterTable
ALTER TABLE "job_installments" ADD COLUMN "paymentMethodRaw" TEXT;
ALTER TABLE "job_installments" ADD COLUMN "purchaseOrderStatus" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "purchaseOrderStatus" TEXT;
