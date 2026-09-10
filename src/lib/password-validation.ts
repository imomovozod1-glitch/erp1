import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

/**
 * Length is the only rule.
 *
 * The previous policy also demanded an uppercase letter, a lowercase letter
 * and a digit, which rejected an all-numeric password outright. That does not
 * fit how this system is actually used: accounts here are handed out by an
 * administrator to staff who type the password on a till or a phone, and a
 * numeric passcode is what they expect. Composition rules are also poor
 * security value — they push people toward predictable substitutions
 * ("Parol123!") while blocking long passphrases and PINs that are perfectly
 * fine. Length is what actually resists guessing, so length is what is
 * enforced.
 */
export function isStrongPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
}

/**
 * Zod schema for a password being SET (signup, change, admin-reset) — never
 * for a login field, where the only thing that matters is "non-empty" since
 * an existing password may predate this policy.
 */
export function newPasswordSchema(message: string) {
  return z.string().refine(isStrongPassword, message)
}
