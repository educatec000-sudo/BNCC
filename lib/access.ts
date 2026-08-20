import "server-only"

import type { Prisma, Subscription, SubscriptionPlan, Usage } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  FREE_TOTAL_LIMIT,
  getDailyImageLimit,
  getImageLimit,
  isImageGenerationEnabled,
  getLateGraceDays,
  getMonthlyLimit,
  type PlanCode,
} from "@/lib/plans"
import {
  hasAvailableUsage,
  hasPaidAccess,
  isUsageNearLimit,
  shouldExpirePaidSubscription,
} from "@/lib/access-rules"

export type AccessErrorCode =
  | "FREE_TRIAL_ENDED"
  | "SUBSCRIPTION_INACTIVE"
  | "PLAN_LIMIT_REACHED"
  | "IMAGE_LIMIT_REACHED"

export class AccessDeniedError extends Error {
  readonly code: AccessErrorCode
  readonly status: number
  readonly upgradeRequired: boolean

  constructor(code: AccessErrorCode, message: string, upgradeRequired = true) {
    super(message)
    this.name = "AccessDeniedError"
    this.code = code
    this.status = 403
    this.upgradeRequired = upgradeRequired
  }
}

export interface AccessSnapshot {
  plan: PlanCode
  status: Subscription["status"]
  canGenerate: boolean
  used: number
  limit: number
  remaining: number
  imageUsed: number
  imageLimit: number
  imageRemaining: number
  nearLimit: boolean
  upgradeRequired: boolean
  currentPeriodEnd: Date | null
  message?: string
}

export interface GenerationReservation extends AccessSnapshot {
  userId: string
  counter: "free" | "monthly"
}

export interface ImageGenerationReservation {
  userId: string
  counter: "free-image" | "monthly-image"
  plan: PlanCode
  used: number
  limit: number
  remaining: number
}

type DbClient = Prisma.TransactionClient | typeof prisma

function asPlanCode(plan: SubscriptionPlan): PlanCode {
  return plan
}

function calendarMonth(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start, end }
}

async function ensureRecords(db: DbClient, userId: string) {
  const [subscription, usage] = await Promise.all([
    db.subscription.upsert({
      where: { userId },
      update: {},
      create: { userId, plan: "FREE", status: "ACTIVE" },
    }),
    db.usage.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
  ])

  return { subscription, usage }
}

export async function ensureUserAccessRecords(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await ensureRecords(tx, userId)
  })
}

async function expireIfNecessary(
  db: DbClient,
  subscription: Subscription,
  now: Date,
): Promise<Subscription> {
  if (subscription.plan === "FREE") return subscription

  const shouldExpire = shouldExpirePaidSubscription({
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    lateSince: subscription.lateSince,
    graceDays: getLateGraceDays(),
    now,
  })

  if (!shouldExpire) return subscription

  return db.subscription.update({
    where: { id: subscription.id },
    data: { status: "EXPIRED" },
  })
}

function hasPaidPeriodAccess(subscription: Subscription, now: Date): boolean {
  if (subscription.plan === "FREE") return false

  return hasPaidAccess({
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    lateSince: subscription.lateSince,
    graceDays: getLateGraceDays(),
    now,
  })
}

async function ensurePaidUsagePeriod(
  db: DbClient,
  subscription: Subscription,
  usage: Usage,
  now: Date,
): Promise<Usage> {
  const fallback = calendarMonth(now)
  const periodStart = subscription.currentPeriodStart || fallback.start
  const periodEnd = subscription.currentPeriodEnd || fallback.end
  const periodChanged =
    !usage.usagePeriodStart ||
    !usage.usagePeriodEnd ||
    usage.usagePeriodEnd <= now ||
    usage.usagePeriodStart.getTime() !== periodStart.getTime() ||
    usage.usagePeriodEnd.getTime() !== periodEnd.getTime()

  if (!periodChanged) return usage

  return db.usage.update({
    where: { id: usage.id },
    data: {
      monthlyGenerationsUsed: 0,
      monthlyImagesUsed: 0,
      usagePeriodStart: periodStart,
      usagePeriodEnd: periodEnd,
    },
  })
}

function freeSnapshot(subscription: Subscription, usage: Usage): AccessSnapshot {
  const used = Math.min(usage.freeGenerationsUsed, FREE_TOTAL_LIMIT)
  const remaining = Math.max(0, FREE_TOTAL_LIMIT - used)
  const canGenerate = hasAvailableUsage(used, FREE_TOTAL_LIMIT)

  return {
    plan: "FREE",
    status: subscription.status,
    canGenerate,
    used,
    limit: FREE_TOTAL_LIMIT,
    remaining,
    imageUsed: usage.freeImagesUsed,
    imageLimit: getImageLimit("FREE"),
    imageRemaining: Math.max(0, getImageLimit("FREE") - usage.freeImagesUsed),
    nearLimit: used === 1,
    upgradeRequired: !canGenerate,
    currentPeriodEnd: null,
    ...(!canGenerate
      ? {
          message:
            "Você utilizou seus 2 planos gratuitos. Assine o BNCC Planner para continuar criando planos de aula.",
        }
      : {}),
  }
}

function paidSnapshot(subscription: Subscription, usage: Usage, now: Date): AccessSnapshot {
  const plan = asPlanCode(subscription.plan)
  const limit = getMonthlyLimit(plan) || 0
  const used = usage.monthlyGenerationsUsed
  const remaining = Math.max(0, limit - used)
  const active = hasPaidPeriodAccess(subscription, now)
  const withinLimit = hasAvailableUsage(used, limit)
  const canGenerate = active && withinLimit
  let message: string | undefined

  if (!active) message = "Sua assinatura não está ativa. Regularize seu plano para continuar."
  else if (!withinLimit) message = "Você atingiu o limite de utilização do seu plano neste período."
  else if (isUsageNearLimit(used, limit)) message = "Você está próximo do limite de utilização do seu plano."
  else if (subscription.status === "LATE") {
    message = `Pagamento atrasado. O acesso permanece em tolerância por até ${getLateGraceDays()} dias.`
  } else if (subscription.status === "CANCELLED" && subscription.currentPeriodEnd) {
    message = `Assinatura cancelada. Seu acesso continua até ${subscription.currentPeriodEnd.toLocaleDateString("pt-BR")}.`
  }

  return {
    plan,
    status: subscription.status,
    canGenerate,
    used,
    limit,
    remaining,
    imageUsed: usage.monthlyImagesUsed,
    imageLimit: getImageLimit(plan),
    imageRemaining: Math.max(0, getImageLimit(plan) - usage.monthlyImagesUsed),
    nearLimit: active && isUsageNearLimit(used, limit),
    upgradeRequired: plan === "PROFESSOR" && (!withinLimit || !active),
    currentPeriodEnd: subscription.currentPeriodEnd,
    ...(message ? { message } : {}),
  }
}

export async function getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
  return prisma.$transaction(async (tx) => {
    const records = await ensureRecords(tx, userId)
    const now = new Date()
    const subscription = await expireIfNecessary(tx, records.subscription, now)

    if (subscription.plan === "FREE") return freeSnapshot(subscription, records.usage)

    const usage = await ensurePaidUsagePeriod(tx, subscription, records.usage, now)
    return paidSnapshot(subscription, usage, now)
  })
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const access = await getAccessSnapshot(userId)
  return access.plan !== "FREE" && access.canGenerate
}

export async function reserveGeneration(userId: string): Promise<GenerationReservation> {
  return prisma.$transaction(async (tx) => {
    const records = await ensureRecords(tx, userId)
    const now = new Date()
    const subscription = await expireIfNecessary(tx, records.subscription, now)

    if (subscription.plan === "FREE") {
      const reserved = await tx.usage.updateMany({
        where: {
          id: records.usage.id,
          freeGenerationsUsed: { lt: FREE_TOTAL_LIMIT },
        },
        data: { freeGenerationsUsed: { increment: 1 } },
      })

      if (reserved.count === 0) {
        throw new AccessDeniedError(
          "FREE_TRIAL_ENDED",
          "Você utilizou seus 2 planos gratuitos. Assine o BNCC Planner para continuar criando planos de aula.",
        )
      }

      const usage = await tx.usage.findUniqueOrThrow({ where: { id: records.usage.id } })
      const snapshot = freeSnapshot(subscription, usage)
      const message =
        usage.freeGenerationsUsed === 1
          ? "Você utilizou 1 dos 2 planos gratuitos disponíveis."
          : "Você utilizou seus 2 planos gratuitos. Assine o BNCC Planner para continuar criando planos de aula."

      return { ...snapshot, userId, counter: "free", message }
    }

    if (!hasPaidPeriodAccess(subscription, now)) {
      throw new AccessDeniedError(
        "SUBSCRIPTION_INACTIVE",
        "Sua assinatura não está ativa. Regularize seu plano para continuar.",
        subscription.plan === "PROFESSOR",
      )
    }

    const usage = await ensurePaidUsagePeriod(tx, subscription, records.usage, now)
    const limit = getMonthlyLimit(asPlanCode(subscription.plan)) || 0
    const reserved = await tx.usage.updateMany({
      where: {
        id: usage.id,
        monthlyGenerationsUsed: { lt: limit },
      },
      data: { monthlyGenerationsUsed: { increment: 1 } },
    })

    if (reserved.count === 0) {
      throw new AccessDeniedError(
        "PLAN_LIMIT_REACHED",
        "Você atingiu o limite de utilização do seu plano neste período.",
        subscription.plan === "PROFESSOR",
      )
    }

    const updatedUsage = await tx.usage.findUniqueOrThrow({ where: { id: usage.id } })
    const snapshot = paidSnapshot(subscription, updatedUsage, now)

    return { ...snapshot, userId, counter: "monthly" }
  })
}

export async function releaseGeneration(reservation: GenerationReservation): Promise<void> {
  if (reservation.counter === "free") {
    await prisma.usage.updateMany({
      where: { userId: reservation.userId, freeGenerationsUsed: { gt: 0 } },
      data: { freeGenerationsUsed: { decrement: 1 } },
    })
    return
  }

  await prisma.usage.updateMany({
    where: { userId: reservation.userId, monthlyGenerationsUsed: { gt: 0 } },
    data: { monthlyGenerationsUsed: { decrement: 1 } },
  })
}

export async function reserveImageGeneration(
  userId: string,
): Promise<ImageGenerationReservation> {
  if (!isImageGenerationEnabled()) {
    throw new AccessDeniedError(
      "IMAGE_LIMIT_REACHED",
      "A geração de imagens está temporariamente desativada pelo administrador.",
      false,
    )
  }

  return prisma.$transaction(async (tx) => {
    const records = await ensureRecords(tx, userId)
    const now = new Date()
    const subscription = await expireIfNecessary(tx, records.subscription, now)
    const plan = asPlanCode(subscription.plan)
    const limit = getImageLimit(plan)
    const dailyLimit = getDailyImageLimit()
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    let usage = records.usage
    if (!usage.imageUsageDay || usage.imageUsageDay < dayStart) {
      usage = await tx.usage.update({
        where: { id: usage.id },
        data: { dailyImagesUsed: 0, imageUsageDay: dayStart },
      })
    }

    if (subscription.plan === "FREE") {
      const reserved = await tx.usage.updateMany({
        where: {
          id: usage.id,
          freeImagesUsed: { lt: limit },
          dailyImagesUsed: { lt: dailyLimit },
        },
        data: {
          freeImagesUsed: { increment: 1 },
          dailyImagesUsed: { increment: 1 },
        },
      })
      if (reserved.count === 0) {
        throw new AccessDeniedError(
          "IMAGE_LIMIT_REACHED",
          "Você atingiu o limite diário ou total de geração de imagens do teste gratuito.",
        )
      }
      const updatedUsage = await tx.usage.findUniqueOrThrow({ where: { id: usage.id } })
      return {
        userId,
        counter: "free-image",
        plan,
        used: updatedUsage.freeImagesUsed,
        limit,
        remaining: Math.max(0, limit - updatedUsage.freeImagesUsed),
      }
    }

    if (!hasPaidPeriodAccess(subscription, now)) {
      throw new AccessDeniedError(
        "SUBSCRIPTION_INACTIVE",
        "Sua assinatura não está ativa para gerar imagens.",
        subscription.plan === "PROFESSOR",
      )
    }

    const periodUsage = await ensurePaidUsagePeriod(tx, subscription, usage, now)
    const reserved = await tx.usage.updateMany({
      where: {
        id: periodUsage.id,
        monthlyImagesUsed: { lt: limit },
        dailyImagesUsed: { lt: dailyLimit },
      },
      data: {
        monthlyImagesUsed: { increment: 1 },
        dailyImagesUsed: { increment: 1 },
      },
    })
    if (reserved.count === 0) {
      throw new AccessDeniedError(
        "IMAGE_LIMIT_REACHED",
        "Você atingiu o limite diário ou mensal de geração de imagens do seu plano.",
        subscription.plan === "PROFESSOR",
      )
    }
    const updated = await tx.usage.findUniqueOrThrow({ where: { id: periodUsage.id } })
    return {
      userId,
      counter: "monthly-image",
      plan,
      used: updated.monthlyImagesUsed,
      limit,
      remaining: Math.max(0, limit - updated.monthlyImagesUsed),
    }
  })
}

export async function releaseImageGeneration(
  reservation: ImageGenerationReservation,
): Promise<void> {
  if (reservation.counter === "free-image") {
    await prisma.usage.updateMany({
      where: { userId: reservation.userId, freeImagesUsed: { gt: 0 } },
      data: {
        freeImagesUsed: { decrement: 1 },
        dailyImagesUsed: { decrement: 1 },
      },
    })
    return
  }
  await prisma.usage.updateMany({
    where: { userId: reservation.userId, monthlyImagesUsed: { gt: 0 } },
    data: {
      monthlyImagesUsed: { decrement: 1 },
      dailyImagesUsed: { decrement: 1 },
    },
  })
}
