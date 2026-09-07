import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Output is deliberately locale-independent (space-grouped digits + "soʻm"),
// so there is no locale parameter — the previous `_locale` argument was never
// read by the formatter and no caller ever passed one.
export function formatCurrency(
  amount: number,
  currency: string = "UZS"
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount).replace(/,/g, " ")

  if (currency === "UZS") {
    return `${formatted} soʻm`
  }
  return `${currency} ${formatted}`
}

export function formatDate(dateStr: string, fmt: string = "dd.MM.yyyy"): string {
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return dateStr
  }
}

/** Same as formatDate, but includes hour:minute — use for timestamps where the exact time matters (e.g. stock movements). */
export function formatDateTime(dateStr: string, fmt: string = "dd.MM.yyyy HH:mm"): string {
  return formatDate(dateStr, fmt)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("uz-UZ").format(value)
}

export function generateCode(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(6, "0")}`
}

/**
 * Builds a human-readable, collision-safe document number (sales order,
 * invoice, purchase order).
 *
 * The previous `Date.now().toString().slice(-6 | -8)` scheme only kept the
 * low digits of the ms epoch, so it wrapped — every 10^6 ms (~16.6 minutes)
 * for the 6-digit POS variant, every 10^8 ms (~27.8 hours) for the 8-digit
 * ones. Since order_number/invoice_number/po_number are UNIQUE per tenant,
 * a wrap meant a duplicate-key error that aborted checkout *after* the
 * surrounding writes had already started. A date part plus 6 random base-36
 * characters (~2.1 billion values per prefix per day) removes that.
 *
 * Impure by design — only ever call this from an event handler or effect,
 * never during render (React Compiler purity rules).
 */
export function generateDocumentNumber(prefix: string): string {
  const now = new Date()
  const datePart =
    String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0")
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")
  return `${prefix}-${datePart}-${randomPart}`
}

/**
 * Derives avatar initials from a name, ignoring parenthetical suffixes
 * (e.g. "Administrator (Owner)") and any word that doesn't start with a letter.
 */
export function getInitials(name: string | null | undefined, maxLength: number = 2): string {
  if (!name) return ''
  const cleaned = name.replace(/\([^)]*\)/g, ' ')
  const initials = cleaned
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, maxLength)
    .join('')
    .toUpperCase()
  return initials
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
