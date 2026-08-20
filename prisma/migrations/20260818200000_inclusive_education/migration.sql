-- Add inclusive education context to the existing planning record.
ALTER TABLE "LessonPlan"
  ADD COLUMN "inclusionMode" TEXT NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN "inclusionNeeds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "accessibilityResources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "pedagogicalProfile" JSONB,
  ADD COLUMN "adaptedContent" JSONB,
  ADD COLUMN "adaptedFor" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX "LessonPlan_userId_inclusionMode_idx"
  ON "LessonPlan"("userId", "inclusionMode");
