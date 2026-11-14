-- CreateTable
CREATE TABLE "sample_vendor_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "totalHkd" INTEGER NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "sample_vendor_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sample_vendor_orders_vendorId_placedAt_idx" ON "sample_vendor_orders"("vendorId", "placedAt");

-- AddForeignKey
ALTER TABLE "sample_vendor_orders" ADD CONSTRAINT "sample_vendor_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
