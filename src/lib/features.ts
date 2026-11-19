/**
 * Per-tenant feature flags — "does THIS company have this code path yet?".
 *
 * Why they exist
 * ──────────────
 * One deployment serves every company: src/proxy.ts reads the tenant from the
 * subdomain and the same bundle answers all of them. Shipping is therefore
 * all-or-nothing — the moment `main` deploys, every company is running the new
 * code. A flag breaks that: the change ships switched off, the operator turns
 * it on for one company in the admin console (admin → company → feature flags),
 * and only that subdomain takes the new path. That is what makes "check it
 * first, then release it" possible without a second database or a second
 * deployment.
 *
 * Not the same tool as permissions
 * ────────────────────────────────
 * src/lib/permissions.ts answers "may this USER do this?" — a product rule that
 * stays forever and is set per role. A flag answers "is this code released to
 * this COMPANY yet?" — temporary by design. Once a feature is on everywhere,
 * delete the flag and the `isFeatureOn` branch with it; do not leave flags
 * lying around as permanent configuration.
 *
 * Adding one
 * ──────────
 *   1. add the key below with a label and a note,
 *   2. branch on it — `hasFeature('x')` in server code (src/lib/features-server.ts),
 *      `useFeature('x')` in client components (src/components/providers/features-provider.tsx),
 *   3. that's all: the admin console renders the registry, so the toggle
 *      appears by itself.
 *
 * Removing one: delete the entry and every branch reading it. A stale key left
 * in a company's `features` JSONB is ignored on read, so no SQL cleanup is
 * needed.
 *
 * Labels live here, NOT in messages/*.json, on purpose: only the platform
 * operator ever sees them, and a flag is short-lived — translating a string
 * into three languages for something meant to be deleted next month buys
 * nothing and leaves dead keys behind in all three files.
 *
 * This module is imported by client components, so it stays pure: no Supabase,
 * no next/cache, no server-only imports.
 */

export interface FeatureFlagMeta {
  /** Shown in the admin console's flag list. */
  label: string
  /** What turning it on actually changes, for the operator flipping it. */
  description: string
}

export const FEATURE_FLAGS = {
  test_company: {
    label: 'Test company',
    description:
      'Marks this company as the one used to try changes out before they go to real customers. Its workspace shows a "TEST" badge in the header so nobody mistakes it for live data, and any unreleased feature can be gated on this flag.',
  },
} as const satisfies Record<string, FeatureFlagMeta>

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/** Only the flags this build knows about; anything else in the row is ignored. */
export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlag[]

export type TenantFeatures = Partial<Record<FeatureFlag, boolean>>

/**
 * `tenants.features` as the app is willing to read it.
 *
 * Everything unexpected collapses to "off": a key no longer in the registry, a
 * non-boolean value, an array, a null column on a database where
 * migration_tenant_features.sql has not been applied yet. A flag is a release
 * switch — failing closed means an unfinished feature stays hidden rather than
 * appearing everywhere the moment a row looks odd.
 */
export function normaliseFeatures(raw: unknown): TenantFeatures {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const features: TenantFeatures = {}
  for (const key of FEATURE_FLAG_KEYS) {
    if (source[key] === true) features[key] = true
  }
  return features
}

export function isFeatureOn(features: TenantFeatures | null | undefined, flag: FeatureFlag): boolean {
  return features?.[flag] === true
}
