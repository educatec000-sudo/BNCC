-- Persistent AI-generated images linked to private pedagogical materials.
ALTER TABLE "Usage"
  ADD COLUMN "freeImagesUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "monthlyImagesUsed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "LessonPlan"
  ADD COLUMN "imageMode" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "imageStyle" TEXT NOT NULL DEFAULT 'EDUCATIONAL',
  ADD COLUMN "coloringPage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accessibleImages" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "generateAltText" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');

CREATE TABLE "MaterialImage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lessonPlanId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "status" "ImageStatus" NOT NULL DEFAULT 'PENDING',
  "altText" TEXT,
  "placementKey" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "widthPercent" INTEGER NOT NULL DEFAULT 100,
  "version" INTEGER NOT NULL DEFAULT 1,
  "mimeType" TEXT,
  "imageData" BYTEA,
  "imageHash" TEXT,
  "cacheKey" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialImage_userId_createdAt_idx"
  ON "MaterialImage"("userId", "createdAt");
CREATE INDEX "MaterialImage_lessonPlanId_placementKey_position_idx"
  ON "MaterialImage"("lessonPlanId", "placementKey", "position");
CREATE INDEX "MaterialImage_cacheKey_status_idx"
  ON "MaterialImage"("cacheKey", "status");

ALTER TABLE "MaterialImage"
  ADD CONSTRAINT "MaterialImage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialImage"
  ADD CONSTRAINT "MaterialImage_lessonPlanId_fkey"
  FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
