-- Daily image budget and auditable plan/consumption metadata.
ALTER TABLE "Usage"
  ADD COLUMN "dailyImagesUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "imageUsageDay" TIMESTAMP(3);

ALTER TABLE "MaterialImage"
  ADD COLUMN "planCode" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN "usageUnits" INTEGER NOT NULL DEFAULT 1;
