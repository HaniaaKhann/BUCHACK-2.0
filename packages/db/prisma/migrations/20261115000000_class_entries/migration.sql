-- CreateTable
CREATE TABLE "class_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "class_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_entries_userId_weekday_idx" ON "class_entries"("userId", "weekday");

-- AddForeignKey
ALTER TABLE "class_entries" ADD CONSTRAINT "class_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_entries" ADD CONSTRAINT "class_entries_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
