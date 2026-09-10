'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

/**
 * Cross-links between the three sign-in surfaces.
 *
 * On the web each portal has its own subdomain, so a user can simply type the
 * right one. The Capacitor shell can't: it opens on the bare app host with no
 * address bar (see `server.url` in capacitor.config.ts), so without these
 * links a super-admin or support agent has no way to reach their own login
 * from inside the app.
 *
 * The hrefs are deliberately path-based, not subdomain-based — `src/proxy.ts`
 * fast-paths `/admin/**` and `/support/**` before any tenant resolution, so
 * these resolve identically on the app host, on a tenant subdomain, and on
 * `admin.`/`support.` themselves.
 */
type Portal = 'tenant' | 'admin' | 'support'

export function AuthPortalLinks({ current, lang }: { current: Portal; lang?: string }) {
  const t = useTranslations('auth')

  const portals = [
    { key: 'tenant' as const, href: `/${lang ?? 'uz'}/login`, label: t('tenantPortal'), },
    { key: 'admin' as const, href: '/admin/login', label: t('adminPortal'), },
    { key: 'support' as const, href: '/support/login', label: t('supportPortal'), },
  ].filter((p) => p.key !== current)

  return (
    // No chrome of its own — AuthCard's `behind` slot owns the panel, its
    // divider and its spacing.
    <div>
      {/* <p className="text-slate-400 text-xs mb-2.5">{t('staffAccess')}</p> */}
      <div className="flex flex-wrap gap-2">
        {portals.map(({ key, href, label, }) => (
          <Link
            key={key}
            href={href}
            // Leaves the Next.js router: /admin and /support are separate root
            // layouts with their own auth model, so a soft client-side
            // navigation would try to reuse this tree's providers.
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
          >
            {/* <Icon className="h-3.5 w-3.5" /> */}
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
