-- Migration reconciled: remove default from MaterialImage.planCode
-- This migration was previously applied to Supabase but missing locally.
-- Original intent: enforce explicit planCode assignment in application code,
-- preserving cost control and plan logic.
-- Drift detected was: default changed from Some(Value(String("FREE"))) to None
ALTER TABLE "MaterialImage" ALTER COLUMN "planCode" DROP DEFAULT;
