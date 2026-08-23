import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

/** At least one lowercase, one uppercase, one digit — checked as three independent lookaheads. */
const HAS_LOWER = /[a-z]/
const HAS_UPPER = /[A-Z]/
const HAS_DIGIT = /\d/

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    HAS_LOWER.test(password) &&
    HAS_UPPER.test(password) &&
    HAS_DIGIT.test(password)
  )
}

/**
 * Zod schema for a password being SET (signup, change, admin-reset) — never
 * for a login field, where the only thing that matters is "non-empty" since
 * an existing password may predate this policy.
 */
export function newPasswordSchema(message: string) {
  return z.string().refine(isStrongPassword, message)
}
