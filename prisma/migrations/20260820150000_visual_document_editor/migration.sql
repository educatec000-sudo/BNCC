-- Canonical editable document, lightweight revisions and auditable AI/manual operations.
ALTER TABLE "LessonPlan"
  ADD COLUMN "editorDocument" JSONB,
  ADD COLUMN "editorVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "editorUpdatedAt" TIMESTAMP(3);

CREATE TABLE "DocumentRevision" (
  "id" TEXT NOT NULL,
  "lessonPlanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "document" JSONB NOT NULL,
  "changeType" TEXT NOT NULL DEFAULT 'MANUAL_EDIT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRevision_lessonPlanId_version_key"
  ON "DocumentRevision"("lessonPlanId", "version");
CREATE INDEX "DocumentRevision_userId_createdAt_idx"
  ON "DocumentRevision"("userId", "createdAt");

ALTER TABLE "DocumentRevision"
  ADD CONSTRAINT "DocumentRevision_lessonPlanId_fkey"
  FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRevision"
  ADD CONSTRAINT "DocumentRevision_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MaterialOperation" (
  "id" TEXT NOT NULL,
  "lessonPlanId" TEXT,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "usesAi" BOOLEAN NOT NULL DEFAULT false,
  "units" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT,
  "model" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialOperation_userId_createdAt_idx"
  ON "MaterialOperation"("userId", "createdAt");
CREATE INDEX "MaterialOperation_lessonPlanId_createdAt_idx"
  ON "MaterialOperation"("lessonPlanId", "createdAt");
CREATE INDEX "MaterialOperation_type_createdAt_idx"
  ON "MaterialOperation"("type", "createdAt");

ALTER TABLE "MaterialOperation"
  ADD CONSTRAINT "MaterialOperation_lessonPlanId_fkey"
  FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialOperation"
  ADD CONSTRAINT "MaterialOperation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Image revisions preserve the original and explicitly regenerated/uploaded versions.
-- Document revisions keep only image IDs, so regular text edits never duplicate image bytes.
CREATE TABLE "MaterialImageVersion" (
  "id" TEXT NOT NULL,
  "materialImageId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "imageData" BYTEA NOT NULL,
  "imageHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialImageVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialImageVersion_materialImageId_version_key"
  ON "MaterialImageVersion"("materialImageId", "version");
CREATE INDEX "MaterialImageVersion_materialImageId_createdAt_idx"
  ON "MaterialImageVersion"("materialImageId", "createdAt");

ALTER TABLE "MaterialImageVersion"
  ADD CONSTRAINT "MaterialImageVersion_materialImageId_fkey"
  FOREIGN KEY ("materialImageId") REFERENCES "MaterialImage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill a version-1 asset for images that already exist.
INSERT INTO "MaterialImageVersion" (
  "id", "materialImageId", "version", "provider", "model",
  "mimeType", "imageData", "imageHash", "createdAt"
)
SELECT
  'imgver_' || md5(random()::text || i."id"),
  i."id",
  1,
  i."provider",
  i."model",
  i."mimeType",
  i."imageData",
  COALESCE(i."imageHash", md5(i."imageData"::text)),
  i."createdAt"
FROM "MaterialImage" i
WHERE i."status" = 'READY'
  AND i."imageData" IS NOT NULL
  AND i."mimeType" IS NOT NULL;
