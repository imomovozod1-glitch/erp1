/**
 * ISO weekday (1 = Monday) → message key in the `distribution` namespace.
 *
 * A shared array rather than a switch in each component: the routes table, the
 * route form and the route card all have to name the same day the same way,
 * and `distribution_routes.weekday` is stored as the ISO number.
 */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]
