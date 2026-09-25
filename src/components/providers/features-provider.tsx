'use client'

/**
 * The current company's feature flags, for client components.
 *
 * Fed once by the dashboard layout, which already has the tenant row in hand —
 * so reading a flag in a client component costs nothing and needs no fetch.
 * Server components read the same flags through src/lib/features-server.ts
 * instead; both go through `isFeatureOn`, so they cannot disagree.
 *
 * Outside the provider every flag reads as off. That is the honest answer for
 * the trees that have no company at all (the login page, /admin, /support, the
 * Telegram Mini App) and it keeps an unreleased feature hidden rather than
 * letting it appear wherever the provider was forgotten.
 */

import { createContext, useContext } from 'react'
import { isFeatureOn, type FeatureFlag, type TenantFeatures } from '@/lib/features'

const FeaturesContext = createContext<TenantFeatures>({})

export function FeaturesProvider({
  features,
  children,
}: {
  features: TenantFeatures
  children: React.ReactNode
}) {
  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>
}

export function useFeature(flag: FeatureFlag): boolean {
  return isFeatureOn(useContext(FeaturesContext), flag)
}
