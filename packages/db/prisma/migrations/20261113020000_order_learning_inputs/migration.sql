-- AlterTable
ALTER TABLE "orders" ADD COLUMN "predictedBase" TIMESTAMP(3) NOT NULL,
ADD COLUMN "backlogAtPlacement" DOUBLE PRECISION NOT NULL;
