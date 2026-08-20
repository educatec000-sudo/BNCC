-- Persist the request analysis used by specialized material generators.
ALTER TABLE "LessonPlan"
  ADD COLUMN "requestedQuantity" INTEGER,
  ADD COLUMN "difficulty" TEXT,
  ADD COLUMN "outputFormat" TEXT;
