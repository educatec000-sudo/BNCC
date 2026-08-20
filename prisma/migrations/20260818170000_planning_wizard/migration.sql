-- Evolve the existing LessonPlan table for the guided planning wizard.
CREATE TYPE "PlanningStatus" AS ENUM ('DRAFT', 'COMPLETED', 'ARCHIVED');

ALTER TABLE "LessonPlan"
  ADD COLUMN "educationStage" TEXT NOT NULL DEFAULT 'Não informado',
  ADD COLUMN "planningType" TEXT NOT NULL DEFAULT 'Plano de aula',
  ADD COLUMN "request" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "additionalPreferences" TEXT,
  ADD COLUMN "bnccSkills" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "status" "PlanningStatus" NOT NULL DEFAULT 'COMPLETED';

UPDATE "LessonPlan"
SET
  "request" = "theme",
  "educationStage" = CASE
    WHEN lower("grade") LIKE '%ensino médio%' OR lower("grade") LIKE '%ensino medio%'
      THEN 'Ensino Médio'
    WHEN lower("grade") ~ '^[6-9]' AND lower("grade") LIKE '%fundamental%'
      THEN 'Ensino Fundamental II'
    WHEN lower("grade") LIKE '%fundamental%'
      THEN 'Ensino Fundamental I'
    ELSE 'Não informado'
  END,
  "bnccSkills" = COALESCE("content"->'habilidadesBncc', '[]'::jsonb);

ALTER TABLE "LessonPlan" ALTER COLUMN "request" DROP DEFAULT;

CREATE INDEX "LessonPlan_userId_createdAt_idx"
  ON "LessonPlan"("userId", "createdAt");
CREATE INDEX "LessonPlan_userId_planningType_idx"
  ON "LessonPlan"("userId", "planningType");
