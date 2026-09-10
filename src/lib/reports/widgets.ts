/**
 * Which blocks of the reports overview a user wants to see.
 *
 * The overview answers the usual questions with a fixed set of blocks, but
 * "the usual questions" differ per role — a warehouse manager cares about low
 * stock and not about profit charts. Rather than build a second page per role,
 * each user hides what they don't need.
 *
 * The *hidden* ids are stored, never the visible ones: that way a block added
 * in a later release shows up for everybody by default instead of staying
 * invisible for every existing user. Same reasoning as the report builder's
 * column picker, which also tracks `hidden`.
 */

export const OVERVIEW_WIDGETS = [
  'kpi',
  'revenueChart',
  'topProducts',
  'recentOrders',
  'lowStock',
  'soldProducts',
] as const

export type OverviewWidget = (typeof OVERVIEW_WIDGETS)[number]

/** Per browser, like the saved reports and measurement units already are. */
const STORAGE_KEY = 'erp_overview_hidden_widgets'

export function readHiddenWidgets(): OverviewWidget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    // Drop ids from an older release so a renamed block can't hide forever.
    return parsed.filter((id): id is OverviewWidget =>
      (OVERVIEW_WIDGETS as readonly string[]).includes(id)
    )
  } catch {
    return []
  }
}

export function persistHiddenWidgets(hidden: OverviewWidget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden))
  } catch {
    /* private mode / quota — the choice just isn't remembered next visit */
  }
}
