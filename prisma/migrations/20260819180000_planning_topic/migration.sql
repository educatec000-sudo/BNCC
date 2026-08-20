-- Add the teacher-provided subject/topic without overloading the discipline field.
ALTER TABLE "LessonPlan"
  ADD COLUMN "topic" TEXT NOT NULL DEFAULT 'Não informado';

UPDATE "LessonPlan"
SET "topic" = COALESCE(NULLIF("theme", ''), 'Não informado');
