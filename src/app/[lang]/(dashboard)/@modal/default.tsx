/**
 * Renders nothing when no create route is intercepted — without this file the
 * @modal slot would have no match on every other route and Next.js would 404
 * the whole page.
 */
export default function ModalSlotDefault() {
  return null
}
