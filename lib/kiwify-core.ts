import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export const KIWIFY_EVENT_TYPES = [
  "order_approved",
  "order_refunded",
  "chargeback",
  "subscription_canceled",
  "subscription_late",
  "subscription_renewed",
] as const

export type KiwifyEventType = (typeof KIWIFY_EVENT_TYPES)[number]

export interface KiwifyWebhookPayload {
  order_id?: string
  order_ref?: string
  order_status?: string
  approved_date?: string | null
  refunded_at?: string | null
  created_at?: string
  updated_at?: string
  webhook_event_type?: string
  Product?: {
    product_id?: string
    product_name?: string
  }
  Customer?: {
    id?: string
    full_name?: string
    first_name?: string
    email?: string
  }
  TrackingParameters?: {
    src?: string | null
    sck?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    utm_content?: string | null
    utm_term?: string | null
    s1?: string | null
    s2?: string | null
    s3?: string | null
  }
  Subscription?: {
    start_date?: string
    next_payment?: string
    status?: string
    subscription_id?: string
    customer_access?: {
      has_access?: boolean
      active_period?: boolean
      access_until?: string
    }
    plan?: {
      id?: string
      name?: string
      frequency?: string
      qty_charges?: number
    }
  }
  [key: string]: unknown
}

interface CheckoutState {
  userId: string
  expiresAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getCheckoutStateSecret(): string {
  const secret = process.env.KIWIFY_CHECKOUT_STATE_SECRET?.trim()
  if (!secret) throw new Error("KIWIFY_CHECKOUT_STATE_SECRET não configurada.")
  return secret
}

export function getKiwifyWebhookToken(): string {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN?.trim()
  if (!token) throw new Error("KIWIFY_WEBHOOK_TOKEN não configurada.")
  return token
}

export function createCheckoutState(userId: string): string {
  const state: CheckoutState = {
    userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1_000,
  }
  const encoded = Buffer.from(JSON.stringify(state)).toString("base64url")
  const signature = createHmac("sha256", getCheckoutStateSecret())
    .update(encoded)
    .digest("base64url")

  return `${encoded}.${signature}`
}

export function readCheckoutState(value: string | null | undefined): CheckoutState | null {
  if (!value) return null
  const [encoded, receivedSignature] = value.split(".")
  if (!encoded || !receivedSignature) return null

  const expectedSignature = createHmac("sha256", getCheckoutStateSecret())
    .update(encoded)
    .digest("base64url")
  const received = Buffer.from(receivedSignature)
  const expected = Buffer.from(expectedSignature)

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    if (
      !isRecord(parsed) ||
      typeof parsed.userId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return null
    }

    return { userId: parsed.userId, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

export function verifyKiwifySignature(
  payload: KiwifyWebhookPayload,
  receivedSignature: string | null,
): boolean {
  if (!receivedSignature || !/^[a-f0-9]{40}$/i.test(receivedSignature)) return false

  const expectedSignature = createHmac("sha1", getKiwifyWebhookToken())
    .update(JSON.stringify(payload))
    .digest("hex")
  const received = Buffer.from(receivedSignature.toLowerCase(), "hex")
  const expected = Buffer.from(expectedSignature, "hex")

  return received.length === expected.length && timingSafeEqual(received, expected)
}

export function parseKiwifyPayload(value: unknown): KiwifyWebhookPayload {
  if (!isRecord(value)) throw new Error("Payload Kiwify inválido.")
  return value as KiwifyWebhookPayload
}

export function getKiwifyEventType(payload: KiwifyWebhookPayload): KiwifyEventType {
  const eventType = payload.webhook_event_type
  if (!KIWIFY_EVENT_TYPES.includes(eventType as KiwifyEventType)) {
    throw new Error(`Evento Kiwify não suportado: ${eventType || "ausente"}.`)
  }
  return eventType as KiwifyEventType
}

export function getKiwifyEventId(
  payload: KiwifyWebhookPayload,
  eventType: KiwifyEventType,
): string {
  const resourceId = payload.order_id || payload.Subscription?.subscription_id
  const eventVersion = payload.updated_at || payload.approved_date || payload.refunded_at

  if (resourceId) return [eventType, resourceId, eventVersion || "current"].join(":")

  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex")
  return `${eventType}:${digest}`
}

export function parseKiwifyDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  const normalized = new Date(`${value.replace(" ", "T")}Z`)
  return Number.isNaN(normalized.getTime()) ? null : normalized
}

export function addOneMonth(date: Date): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + 1)
  return result
}

export function getKiwifyPeriod(
  payload: KiwifyWebhookPayload,
  eventType: KiwifyEventType,
) {
  const now = new Date()
  const approvedAt = parseKiwifyDate(payload.approved_date)
  const subscriptionStart = parseKiwifyDate(payload.Subscription?.start_date)
  const nextPayment = parseKiwifyDate(payload.Subscription?.next_payment)
  const accessUntil = parseKiwifyDate(payload.Subscription?.customer_access?.access_until)
  const start = eventType === "subscription_renewed" ? approvedAt || now : subscriptionStart || approvedAt || now
  const end =
    eventType === "subscription_canceled"
      ? accessUntil || nextPayment || addOneMonth(start)
      : nextPayment || accessUntil || addOneMonth(start)

  return { start, end }
}

export function getTrackingUserId(payload: KiwifyWebhookPayload): string | null {
  return readCheckoutState(payload.TrackingParameters?.s1)?.userId ?? null
}
