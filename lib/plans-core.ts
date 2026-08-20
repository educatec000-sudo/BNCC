export const FREE_TOTAL_LIMIT = 2

export type PaidPlanSlug = "professor" | "premium"
export type PlanCode = "FREE" | "PROFESSOR" | "PREMIUM"

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) return fallback

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um número inteiro maior que zero.`)
  }

  return value
}

export function getUsageLimits() {
  const professor = readPositiveInteger("PROFESSOR_MONTHLY_LIMIT", 30)
  const premium = readPositiveInteger("PREMIUM_MONTHLY_LIMIT", 100)

  if (premium <= professor) {
    throw new Error("PREMIUM_MONTHLY_LIMIT deve ser maior que PROFESSOR_MONTHLY_LIMIT.")
  }

  return {
    free: FREE_TOTAL_LIMIT,
    professor,
    premium,
  }
}

export function getMonthlyLimit(plan: PlanCode): number | null {
  const limits = getUsageLimits()
  if (plan === "PROFESSOR") return limits.professor
  if (plan === "PREMIUM") return limits.premium
  return null
}

export function getImageUsageLimits() {
  const free = readPositiveInteger("FREE_IMAGE_TOTAL_LIMIT", 2)
  const professor = readPositiveInteger("PROFESSOR_MONTHLY_IMAGE_LIMIT", 20)
  const premium = readPositiveInteger("PREMIUM_MONTHLY_IMAGE_LIMIT", 60)
  if (premium <= professor) {
    throw new Error("PREMIUM_MONTHLY_IMAGE_LIMIT deve ser maior que PROFESSOR_MONTHLY_IMAGE_LIMIT.")
  }
  return { free, professor, premium }
}

export function getImageLimit(plan: PlanCode): number {
  const limits = getImageUsageLimits()
  if (plan === "PROFESSOR") return limits.professor
  if (plan === "PREMIUM") return limits.premium
  return limits.free
}

export function getDailyImageLimit(): number {
  return readPositiveInteger("DAILY_IMAGE_LIMIT_PER_USER", 10)
}

export function isImageGenerationEnabled(): boolean {
  return process.env.IMAGE_GENERATION_ENABLED?.trim().toLowerCase() !== "false"
}

export function getLateGraceDays(): number {
  return readPositiveInteger("KIWIFY_LATE_GRACE_DAYS", 3)
}

export function getPlanDisplayConfig() {
  const limits = getUsageLimits()
  const imageLimits = getImageUsageLimits()

  return {
    free: {
      price: "R$ 0",
      limit: limits.free,
      imageLimit: imageLimits.free,
    },
    professor: {
      price: process.env.PROFESSOR_PRICE_LABEL?.trim() || "R$ 29,90/mês",
      limit: limits.professor,
      imageLimit: imageLimits.professor,
    },
    premium: {
      price: process.env.PREMIUM_PRICE_LABEL?.trim() || "R$ 49,90/mês",
      limit: limits.premium,
      imageLimit: imageLimits.premium,
    },
  }
}

export function getKiwifyProductId(plan: PaidPlanSlug): string {
  const variable =
    plan === "professor" ? "KIWIFY_PROFESSOR_PRODUCT_ID" : "KIWIFY_PREMIUM_PRODUCT_ID"
  const value = process.env[variable]?.trim()
  if (!value) throw new Error(`${variable} não configurada.`)
  return value
}

export function getKiwifyCheckoutUrl(plan: PaidPlanSlug): string {
  const variable =
    plan === "professor" ? "KIWIFY_PROFESSOR_CHECKOUT_URL" : "KIWIFY_PREMIUM_CHECKOUT_URL"
  const value = process.env[variable]?.trim()
  if (!value) throw new Error(`${variable} não configurada.`)

  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error(`${variable} deve usar HTTPS.`)
  return url.toString()
}

export function planCodeFromSlug(plan: PaidPlanSlug): PlanCode {
  return plan === "professor" ? "PROFESSOR" : "PREMIUM"
}

export function isPaidPlanSlug(value: unknown): value is PaidPlanSlug {
  return value === "professor" || value === "premium"
}
