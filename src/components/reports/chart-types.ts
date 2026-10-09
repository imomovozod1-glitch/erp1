/**
 * The report builder's chart kinds. Kept apart from report-chart.tsx so the
 * builder can list them without statically importing that module — it pulls
 * in recharts, which is loaded on demand only when a chart is shown.
 */
export const CHART_TYPES = ['bar', 'line', 'area', 'pie'] as const
export type ChartType = (typeof CHART_TYPES)[number]
