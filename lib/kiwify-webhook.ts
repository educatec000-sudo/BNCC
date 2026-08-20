import "server-only"

import { Prisma, type SubscriptionPlan } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  getKiwifyEventId,
  getKiwifyEventType,
  getKiwifyPeriod,
  getTrackingUserId,
  type KiwifyEventType,
  type KiwifyWebhookPayload,
} from "@/lib/kiwify"
import { getKiwifyProductId } from "@/lib/plans"

export interface WebhookProcessResult {
  duplicate: boolean
  eventId: string
  eventType: KiwifyEventType
  userId?: string
}

function planFromProduct(productId: string | undefined): SubscriptionPlan {
  const professorProductId = getKiwifyProductId("professor")
  const premiumProductId = getKiwifyProductId("premium")

  if (professorProductId === premiumProductId) {
    throw new Error("Os IDs dos produtos Professor e Premium devem ser diferentes.")
  }
  if (productId === professorProductId) return "PROFESSOR"
  if (productId === premiumProductId) return "PREMIUM"
  throw new Error("Produto Kiwify não corresponde aos planos Professor ou Premium.")
}

async function findWebhookUser(
  tx: Prisma.TransactionClient,
  payload: KiwifyWebhookPayload,
): Promise<string> {
  const kiwifySubscriptionId = payload.Subscription?.subscription_id
  if (kiwifySubscriptionId) {
    const existing = await tx.subscription.findUnique({
      where: { kiwifySubscriptionId },
      select: { userId: true },
    })
    if (existing) return existing.userId
  }

  const trackedUserId = getTrackingUserId(payload)
  if (trackedUserId) {
    const user = await tx.user.findUnique({ where: { id: trackedUserId }, select: { id: true } })
    if (user) return user.id
  }

  const email = payload.Customer?.email?.trim().toLowerCase()
  if (email) {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true } })
    if (user) return user.id
  }

  throw new Error(
    "Não foi possível vincular o webhook a um usuário. Verifique o e-mail e o parâmetro s1 do checkout.",
  )
}

function isStaleProfessorEvent(
  existing: { plan: SubscriptionPlan; kiwifySubscriptionId: string | null } | null,
  incomingPlan: SubscriptionPlan,
  payload: KiwifyWebhookPayload,
): boolean {
  return Boolean(
    existing?.plan === "PREMIUM" &&
      incomingPlan === "PROFESSOR" &&
      existing.kiwifySubscriptionId &&
      payload.Subscription?.subscription_id !== existing.kiwifySubscriptionId,
  )
}

function commonSubscriptionData(payload: KiwifyWebhookPayload) {
  return {
    kiwifyCustomerId: payload.Customer?.id || undefined,
    kiwifySubscriptionId: payload.Subscription?.subscription_id || undefined,
    kiwifyOrderId: payload.order_id || undefined,
    kiwifyProductId: payload.Product?.product_id || undefined,
  }
}

async function activateSubscription(
  tx: Prisma.TransactionClient,
  userId: string,
  payload: KiwifyWebhookPayload,
  eventType: "order_approved" | "subscription_renewed",
) {
  if (payload.order_status !== "paid") {
    throw new Error(`${eventType} recebido sem order_status=paid.`)
  }

  const plan = planFromProduct(payload.Product?.product_id)
  const existing = await tx.subscription.findUnique({
    where: { userId },
    select: { plan: true, kiwifySubscriptionId: true },
  })
  if (isStaleProfessorEvent(existing, plan, payload)) return

  const period = getKiwifyPeriod(payload, eventType)

  await tx.subscription.upsert({
    where: { userId },
    update: {
      plan,
      status: "ACTIVE",
      ...commonSubscriptionData(payload),
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      lateSince: null,
    },
    create: {
      userId,
      plan,
      status: "ACTIVE",
      ...commonSubscriptionData(payload),
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
    },
  })

  await tx.usage.upsert({
    where: { userId },
    update: {
      monthlyGenerationsUsed: 0,
      monthlyImagesUsed: 0,
      usagePeriodStart: period.start,
      usagePeriodEnd: period.end,
    },
    create: {
      userId,
      monthlyGenerationsUsed: 0,
      usagePeriodStart: period.start,
      usagePeriodEnd: period.end,
    },
  })
}

async function updateSubscriptionState(
  tx: Prisma.TransactionClient,
  userId: string,
  payload: KiwifyWebhookPayload,
  eventType: Exclude<KiwifyEventType, "order_approved" | "subscription_renewed">,
) {
  const plan = planFromProduct(payload.Product?.product_id)
  const existing = await tx.subscription.findUnique({ where: { userId } })
  if (isStaleProfessorEvent(existing, plan, payload)) return

  const now = new Date()
  const period = getKiwifyPeriod(payload, eventType)

  if (eventType === "subscription_late") {
    await tx.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: "LATE",
        ...commonSubscriptionData(payload),
        lateSince: now,
        currentPeriodEnd: existing?.currentPeriodEnd || period.end,
      },
      create: {
        userId,
        plan,
        status: "LATE",
        ...commonSubscriptionData(payload),
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        lateSince: now,
      },
    })
    return
  }

  if (eventType === "subscription_canceled") {
    await tx.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: "CANCELLED",
        ...commonSubscriptionData(payload),
        currentPeriodEnd: period.end,
        lateSince: null,
      },
      create: {
        userId,
        plan,
        status: "CANCELLED",
        ...commonSubscriptionData(payload),
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    })
    return
  }

  const blockedStatus = eventType === "order_refunded" ? "REFUNDED" : "CHARGEBACK"
  await tx.subscription.upsert({
    where: { userId },
    update: {
      plan,
      status: blockedStatus,
      ...commonSubscriptionData(payload),
      currentPeriodEnd: now,
      lateSince: null,
    },
    create: {
      userId,
      plan,
      status: blockedStatus,
      ...commonSubscriptionData(payload),
      currentPeriodStart: period.start,
      currentPeriodEnd: now,
    },
  })
}

async function applyWebhookEvent(
  tx: Prisma.TransactionClient,
  payload: KiwifyWebhookPayload,
  eventType: KiwifyEventType,
): Promise<string> {
  const userId = await findWebhookUser(tx, payload)

  if (eventType === "order_approved" || eventType === "subscription_renewed") {
    await activateSubscription(tx, userId, payload, eventType)
  } else {
    await updateSubscriptionState(tx, userId, payload, eventType)
  }

  return userId
}

export async function processKiwifyWebhook(
  payload: KiwifyWebhookPayload,
): Promise<WebhookProcessResult> {
  const eventType = getKiwifyEventType(payload)
  const eventId = getKiwifyEventId(payload, eventType)
  const storedPayload = payload as Prisma.InputJsonValue

  try {
    await prisma.webhookEvent.create({
      data: { eventId, eventType, payload: storedPayload },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`
      const event = await tx.webhookEvent.findUniqueOrThrow({ where: { eventId } })

      if (event.processed) return { duplicate: true, eventId, eventType }

      const userId = await applyWebhookEvent(tx, payload, eventType)
      await tx.webhookEvent.update({
        where: { eventId },
        data: { processed: true, processedAt: new Date(), error: null },
      })

      return { duplicate: false, eventId, eventType, userId }
    })
  } catch (error) {
    const safeError = error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido"
    await prisma.webhookEvent.updateMany({
      where: { eventId, processed: false },
      data: { error: safeError },
    })
    throw error
  }
}
