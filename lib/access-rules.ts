export type PaidSubscriptionStatus =
  | "ACTIVE"
  | "LATE"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "CHARGEBACK"

export interface PaidAccessInput {
  status: PaidSubscriptionStatus
  currentPeriodEnd: Date | null
  lateSince: Date | null
  graceDays: number
  now: Date
}

export function getGracePeriodEnd(lateSince: Date, graceDays: number): Date {
  const end = new Date(lateSince)
  end.setUTCDate(end.getUTCDate() + graceDays)
  return end
}

export function hasPaidAccess(input: PaidAccessInput): boolean {
  if (input.status === "ACTIVE" || input.status === "CANCELLED") {
    return Boolean(input.currentPeriodEnd && input.currentPeriodEnd > input.now)
  }

  if (input.status === "LATE") {
    return Boolean(
      input.lateSince && getGracePeriodEnd(input.lateSince, input.graceDays) > input.now,
    )
  }

  return false
}

export function shouldExpirePaidSubscription(input: PaidAccessInput): boolean {
  return ["ACTIVE", "LATE", "CANCELLED"].includes(input.status) && !hasPaidAccess(input)
}

export function hasAvailableUsage(used: number, limit: number): boolean {
  return used >= 0 && used < limit
}

export function isUsageNearLimit(used: number, limit: number): boolean {
  const remaining = limit - used
  const threshold = Math.max(1, Math.ceil(limit * 0.1))
  return remaining > 0 && remaining <= threshold
}
