-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'vendor_staff', 'vendor_owner', 'admin');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "ChatLanguage" AS ENUM ('en', 'zh_HK', 'zh_CN');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('open', 'closed_for_renovation');

-- CreateEnum
CREATE TYPE "BusyState" AS ENUM ('quiet', 'normal', 'rush');

-- CreateEnum
CREATE TYPE "WalkTimeType" AS ENUM ('b2v', 'b2b');

-- CreateEnum
CREATE TYPE "WalkTimeSource" AS ENUM ('estimate', 'measured');

-- CreateEnum
CREATE TYPE "TagsStatus" AS ENUM ('verified', 'unverified');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('in_stock', 'out_of_stock');

-- CreateEnum
CREATE TYPE "MenuSource" AS ENUM ('generic', 'kaggle');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('placed', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('sim', 'csv', 'adapter');

-- CreateEnum
CREATE TYPE "LedgerReason" AS ENUM ('seed', 'pay', 'refund');

-- CreateEnum
CREATE TYPE "AcademicWeekType" AS ENUM ('teaching', 'reading', 'exam', 'holiday');

-- CreateEnum
CREATE TYPE "ClockMode" AS ENUM ('real', 'demo');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'student',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "userId" TEXT NOT NULL,
    "dietTags" TEXT[],
    "allergens" TEXT[],
    "goal" TEXT,
    "eatMinutes" INTEGER NOT NULL,
    "chatLanguage" "ChatLanguage" NOT NULL DEFAULT 'en',
    "currentBuildingId" TEXT,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "free_windows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "prevBuildingId" TEXT,
    "nextBuildingId" TEXT,

    CONSTRAINT "free_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "campus" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "source" TEXT NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "walk_times" (
    "id" TEXT NOT NULL,
    "fromBuildingId" TEXT NOT NULL,
    "toBuildingId" TEXT,
    "toVendorId" TEXT,
    "type" "WalkTimeType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "source" "WalkTimeSource" NOT NULL DEFAULT 'estimate',

    CONSTRAINT "walk_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campus" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "foodType" TEXT NOT NULL,
    "officialDietaryOptions" TEXT[],
    "openingHours" JSONB NOT NULL,
    "pickupEnabled" BOOLEAN NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'open',
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "ticketsIncludeAppOrders" BOOLEAN NOT NULL DEFAULT false,
    "capacityPriorPerMin" DOUBLE PRECISION,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "busyState" "BusyState" NOT NULL DEFAULT 'normal',
    "busyUntil" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,

    CONSTRAINT "vendor_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceHkd" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "dietTags" TEXT[],
    "allergens" TEXT[],
    "tagsStatus" "TagsStatus" NOT NULL DEFAULT 'unverified',
    "tagsVerifiedBy" TEXT,
    "tagsVerifiedAt" TIMESTAMP(3),
    "prepPriorMin" DOUBLE PRECISION NOT NULL,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'in_stock',
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "source" "MenuSource" NOT NULL DEFAULT 'generic',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "totalHkd" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "fireAt" TIMESTAMP(3),
    "slotStart" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "predictedPoint" TIMESTAMP(3) NOT NULL,
    "predictedLow" TIMESTAMP(3) NOT NULL,
    "predictedHigh" TIMESTAMP(3) NOT NULL,
    "modelVersion" TEXT NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "priceHkdSnapshot" INTEGER NOT NULL,
    "prepPriorSnapshotMin" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_slots" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "cap" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pickup_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "busy_events" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "state" "BusyState" NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "busy_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_counts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "source" "TicketSource" NOT NULL,

    CONSTRAINT "ticket_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_snapshots" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "engine_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deltaHkd" INTEGER NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "refOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "appliedFilters" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_weeks" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "type" "AcademicWeekType" NOT NULL,

    CONSTRAINT "academic_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_clock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" "ClockMode" NOT NULL,
    "currentTime" TIMESTAMP(3) NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_clock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_observations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "readyAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "real_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "free_windows_userId_weekday_idx" ON "free_windows"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_campus_name_key" ON "buildings"("campus", "name");

-- CreateIndex
CREATE UNIQUE INDEX "walk_times_fromBuildingId_toBuildingId_key" ON "walk_times"("fromBuildingId", "toBuildingId");

-- CreateIndex
CREATE UNIQUE INDEX "walk_times_fromBuildingId_toVendorId_key" ON "walk_times"("fromBuildingId", "toVendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_name_key" ON "vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_members_userId_vendorId_key" ON "vendor_members"("userId", "vendorId");

-- CreateIndex
CREATE INDEX "menu_items_vendorId_stockStatus_idx" ON "menu_items"("vendorId", "stockStatus");

-- CreateIndex
CREATE INDEX "menu_items_dietTags_idx" ON "menu_items" USING GIN ("dietTags");

-- CreateIndex
CREATE INDEX "menu_items_allergens_idx" ON "menu_items" USING GIN ("allergens");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_vendorId_name_key" ON "menu_items"("vendorId", "name");

-- CreateIndex
CREATE INDEX "orders_vendorId_status_idx" ON "orders"("vendorId", "status");

-- CreateIndex
CREATE INDEX "orders_vendorId_placedAt_idx" ON "orders"("vendorId", "placedAt");

-- CreateIndex
CREATE INDEX "orders_studentId_placedAt_idx" ON "orders"("studentId", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_slots_vendorId_slotStart_key" ON "pickup_slots"("vendorId", "slotStart");

-- CreateIndex
CREATE INDEX "busy_events_vendorId_setAt_idx" ON "busy_events"("vendorId", "setAt");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_counts_vendorId_slotStart_key" ON "ticket_counts"("vendorId", "slotStart");

-- CreateIndex
CREATE INDEX "engine_snapshots_vendorId_computedAt_idx" ON "engine_snapshots"("vendorId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "wallet_ledger_userId_createdAt_idx" ON "wallet_ledger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "academic_weeks_weekStart_key" ON "academic_weeks"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_key" ON "public_holidays"("date");

-- CreateIndex
CREATE INDEX "real_observations_vendorId_placedAt_idx" ON "real_observations"("vendorId", "placedAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_currentBuildingId_fkey" FOREIGN KEY ("currentBuildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_windows" ADD CONSTRAINT "free_windows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_windows" ADD CONSTRAINT "free_windows_prevBuildingId_fkey" FOREIGN KEY ("prevBuildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_windows" ADD CONSTRAINT "free_windows_nextBuildingId_fkey" FOREIGN KEY ("nextBuildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walk_times" ADD CONSTRAINT "walk_times_fromBuildingId_fkey" FOREIGN KEY ("fromBuildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walk_times" ADD CONSTRAINT "walk_times_toBuildingId_fkey" FOREIGN KEY ("toBuildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "walk_times" ADD CONSTRAINT "walk_times_toVendorId_fkey" FOREIGN KEY ("toVendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_members" ADD CONSTRAINT "vendor_members_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "busy_events" ADD CONSTRAINT "busy_events_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_counts" ADD CONSTRAINT "ticket_counts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_snapshots" ADD CONSTRAINT "engine_snapshots_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_refOrderId_fkey" FOREIGN KEY ("refOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_observations" ADD CONSTRAINT "real_observations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

