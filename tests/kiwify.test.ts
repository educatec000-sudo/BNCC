import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import {
  KIWIFY_EVENT_TYPES,
  createCheckoutState,
  getKiwifyEventId,
  getKiwifyEventType,
  getKiwifyPeriod,
  readCheckoutState,
  verifyKiwifySignature,
  type KiwifyWebhookPayload,
} from "../lib/kiwify-core"
import {
  hasAvailableUsage,
  hasPaidAccess,
  isUsageNearLimit,
  shouldExpirePaidSubscription,
} from "../lib/access-rules"
import { getUsageLimits } from "../lib/plans-core"

process.env.KIWIFY_WEBHOOK_TOKEN = "test-webhook-token"
process.env.KIWIFY_CHECKOUT_STATE_SECRET = "test-checkout-state-secret"

const payload: KiwifyWebhookPayload = {
  order_id: "da292c35-c6fc-44e7-ad19-ff7865bc2d89",
  order_status: "paid",
  approved_date: "2026-08-18T12:00:00.000Z",
  updated_at: "2026-08-18T12:00:00.000Z",
  webhook_event_type: "order_approved",
  Product: {
    product_id: "professor-product-id",
    product_name: "BNCC Planner Professor",
  },
  Customer: {
    email: "professor@example.com",
  },
  TrackingParameters: {
    s1: null,
  },
  Subscription: {
    start_date: "2026-08-18T12:00:00.000Z",
    next_payment: "2026-09-18T12:00:00.000Z",
    status: "active",
    subscription_id: "subscription-id",
    customer_access: {
      has_access: true,
      active_period: true,
      access_until: "2026-09-18T12:00:00.000Z",
    },
    plan: {
      id: "plan-id",
      name: "Professor Mensal",
      frequency: "monthly",
      qty_charges: 0,
    },
  },
}

test("valida a assinatura HMAC-SHA1 oficial da Kiwify", () => {
  const signature = createHmac("sha1", process.env.KIWIFY_WEBHOOK_TOKEN!)
    .update(JSON.stringify(payload))
    .digest("hex")

  assert.equal(verifyKiwifySignature(payload, signature), true)
  assert.equal(verifyKiwifySignature(payload, "0".repeat(40)), false)
  assert.equal(verifyKiwifySignature(payload, null), false)
})

test("assina o vínculo do usuário com o checkout e rejeita adulteração", () => {
  const state = createCheckoutState("user-123")
  assert.equal(readCheckoutState(state)?.userId, "user-123")
  assert.equal(readCheckoutState(`${state}tampered`), null)
})

test("aceita somente os seis eventos comerciais oficiais implementados", () => {
  for (const eventType of KIWIFY_EVENT_TYPES) {
    assert.equal(getKiwifyEventType({ webhook_event_type: eventType }), eventType)
  }

  assert.throws(
    () => getKiwifyEventType({ webhook_event_type: "compra_inventada" }),
    /não suportado/,
  )
})

test("gera uma chave idempotente e estável para o mesmo webhook", () => {
  const eventType = getKiwifyEventType(payload)
  const first = getKiwifyEventId(payload, eventType)
  const second = getKiwifyEventId(structuredClone(payload), eventType)

  assert.equal(first, second)
  assert.match(first, /^order_approved:/)
})

test("deriva o período mensal a partir dos campos oficiais da assinatura", () => {
  const period = getKiwifyPeriod(payload, "order_approved")
  assert.equal(period.start.toISOString(), "2026-08-18T12:00:00.000Z")
  assert.equal(period.end.toISOString(), "2026-09-18T12:00:00.000Z")
})

test("mantém acesso de cancelado apenas até o fim do período pago", () => {
  const now = new Date("2026-08-20T00:00:00.000Z")
  const future = new Date("2026-09-18T00:00:00.000Z")
  const past = new Date("2026-08-19T00:00:00.000Z")

  assert.equal(
    hasPaidAccess({ status: "CANCELLED", currentPeriodEnd: future, lateSince: null, graceDays: 3, now }),
    true,
  )
  assert.equal(
    hasPaidAccess({ status: "CANCELLED", currentPeriodEnd: past, lateSince: null, graceDays: 3, now }),
    false,
  )
})

test("aplica tolerância configurável ao pagamento atrasado", () => {
  const lateSince = new Date("2026-08-18T00:00:00.000Z")
  assert.equal(
    hasPaidAccess({
      status: "LATE",
      currentPeriodEnd: null,
      lateSince,
      graceDays: 3,
      now: new Date("2026-08-20T00:00:00.000Z"),
    }),
    true,
  )
  assert.equal(
    shouldExpirePaidSubscription({
      status: "LATE",
      currentPeriodEnd: null,
      lateSince,
      graceDays: 3,
      now: new Date("2026-08-22T00:00:00.000Z"),
    }),
    true,
  )
})

test("bloqueia acesso após reembolso, chargeback ou expiração", () => {
  const now = new Date("2026-08-20T00:00:00.000Z")
  for (const status of ["REFUNDED", "CHARGEBACK", "EXPIRED"] as const) {
    assert.equal(
      hasPaidAccess({
        status,
        currentPeriodEnd: new Date("2026-09-20T00:00:00.000Z"),
        lateSince: null,
        graceDays: 3,
        now,
      }),
      false,
    )
  }
})

test("exige que o limite Premium seja maior que o Professor", () => {
  process.env.PROFESSOR_MONTHLY_LIMIT = "30"
  process.env.PREMIUM_MONTHLY_LIMIT = "100"
  assert.deepEqual(getUsageLimits(), { free: 2, professor: 30, premium: 100 })

  process.env.PREMIUM_MONTHLY_LIMIT = "30"
  assert.throws(() => getUsageLimits(), /deve ser maior/)
  process.env.PREMIUM_MONTHLY_LIMIT = "100"
})

test("permite exatamente duas gerações gratuitas e bloqueia a terceira", () => {
  assert.equal(hasAvailableUsage(0, 2), true)
  assert.equal(hasAvailableUsage(1, 2), true)
  assert.equal(hasAvailableUsage(2, 2), false)
})

test("detecta proximidade do limite sem confundir com limite já atingido", () => {
  assert.equal(isUsageNearLimit(27, 30), true)
  assert.equal(isUsageNearLimit(30, 30), false)
  assert.equal(isUsageNearLimit(10, 30), false)
})
