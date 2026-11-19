/**
 * Pure aggregation helpers shared by the five sales reports.
 *
 * The reports differ only in what they group by — day, seller, customer,
 * product, revenue share — so the filtering, bucketing and ranking live here
 * once and each report page is left holding nothing but its own table markup.
 * Nothing in this file touches React, the network or the clock beyond the
 * range it is handed, which is what makes the numbers on five screens
 * provably the same numbers.
 */

export * from './analytics/types'
export * from './analytics/dates'
export * from './analytics/aggregate'
export * from './analytics/abc'
export * from './analytics/slow-movers'
