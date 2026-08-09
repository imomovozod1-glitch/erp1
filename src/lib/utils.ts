import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency: string = "UZS",
  _locale: string = "uz-UZ"
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

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("uz-UZ").format(value)
}

export function generateCode(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(6, "0")}`
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
