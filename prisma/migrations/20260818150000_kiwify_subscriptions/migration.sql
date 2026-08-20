-- Replace the legacy Stripe-oriented plan enum with the three BNCC Planner plans.
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PROFESSOR', 'PREMIUM');
ALTER TABLE "Subscription"
  ALTER COLUMN "plan" TYPE "SubscriptionPlan"
  USING (
    CASE "plan"::text
      WHEN 'PRO' THEN 'PROFESSOR'
      WHEN 'SCHOOL' THEN 'PREMIUM'
      ELSE 'FREE'
    END
  )::"SubscriptionPlan";
DROP TYPE "SubscriptionPlan_old";
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'FREE';

-- Convert the free-form legacy status into explicit subscription lifecycle states.
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'LATE',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'CHARGEBACK'
);
ALTER TABLE "Subscription"
  ALTER COLUMN "status" TYPE "SubscriptionStatus"
  USING (
    CASE lower("status")
      WHEN 'active' THEN 'ACTIVE'
      WHEN 'late' THEN 'LATE'
      WHEN 'canceled' THEN 'CANCELLED'
      WHEN 'cancelled' THEN 'CANCELLED'
      WHEN 'refunded' THEN 'REFUNDED'
      WHEN 'chargeback' THEN 'CHARGEBACK'
      ELSE 'EXPIRED'
    END
  )::"SubscriptionStatus";
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Add Kiwify identifiers and paid-period metadata.
ALTER TABLE "Subscription"
  ADD COLUMN "kiwifyCustomerId" TEXT,
  ADD COLUMN "kiwifySubscriptionId" TEXT,
  ADD COLUMN "kiwifyOrderId" TEXT,
  ADD COLUMN "kiwifyProductId" TEXT,
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "lateSince" TIMESTAMP(3);

UPDATE "Subscription"
SET "currentPeriodEnd" = "expiresAt"
WHERE "expiresAt" IS NOT NULL;

ALTER TABLE "Subscription"
  DROP COLUMN "stripeId",
  DROP COLUMN "stripePriceId",
  DROP COLUMN "expiresAt";

CREATE UNIQUE INDEX "Subscription_kiwifySubscriptionId_key"
  ON "Subscription"("kiwifySubscriptionId");
CREATE INDEX "Subscription_kiwifyOrderId_idx"
  ON "Subscription"("kiwifyOrderId");
CREATE INDEX "Subscription_kiwifyProductId_idx"
  ON "Subscription"("kiwifyProductId");

-- Ensure every existing user has a free entitlement record.
INSERT INTO "Subscription" (
  "id", "userId", "plan", "status", "createdAt", "updatedAt"
)
SELECT
  'legacy_sub_' || md5(random()::text || u."id"),
  u."id",
  'FREE'::"SubscriptionPlan",
  'ACTIVE'::"SubscriptionStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "Subscription" s ON s."userId" = u."id"
WHERE s."id" IS NULL;

-- Persist free and monthly usage independently from cookies/browser state.
CREATE TABLE "Usage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "freeGenerationsUsed" INTEGER NOT NULL DEFAULT 0,
  "monthlyGenerationsUsed" INTEGER NOT NULL DEFAULT 0,
  "usagePeriodStart" TIMESTAMP(3),
  "usagePeriodEnd" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Usage_userId_key" ON "Usage"("userId");
ALTER TABLE "Usage"
  ADD CONSTRAINT "Usage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Usage" (
  "id",
  "userId",
  "freeGenerationsUsed",
  "monthlyGenerationsUsed",
  "usagePeriodStart",
  "usagePeriodEnd",
  "updatedAt"
)
SELECT
  'legacy_usage_' || md5(random()::text || u."id"),
  u."id",
  LEAST(COUNT(lp."id") FILTER (WHERE s."plan" = 'FREE'), 2)::INTEGER,
  (COUNT(lp."id") FILTER (
    WHERE s."plan" <> 'FREE'
      AND lp."createdAt" >= date_trunc('month', CURRENT_TIMESTAMP)
  ))::INTEGER,
  CASE WHEN s."plan" <> 'FREE' THEN date_trunc('month', CURRENT_TIMESTAMP) END,
  CASE WHEN s."plan" <> 'FREE' THEN date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month' END,
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Subscription" s ON s."userId" = u."id"
LEFT JOIN "LessonPlan" lp ON lp."userId" = u."id"
GROUP BY u."id", s."plan";

-- Auditable and idempotent Kiwify webhook inbox.
CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
CREATE INDEX "WebhookEvent_eventType_createdAt_idx"
  ON "WebhookEvent"("eventType", "createdAt");
CREATE INDEX "WebhookEvent_processed_createdAt_idx"
  ON "WebhookEvent"("processed", "createdAt");
