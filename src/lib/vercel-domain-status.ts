import { call, missingDomainConfig, readConfig, ROOT_DOMAIN, tenantHost } from '@/lib/vercel-domains'

/** Whether the project serves a tenant's host yet: domain membership, TLS, and the wildcard fallback. */

/**
 * Every host the project currently serves, lowercased, mapped to whether the
 * platform considers it verified.
 *
 * `null` means the question could not be answered (no credentials, or the API
 * failed) — which is different from "the project serves nothing", and the
 * caller must not read it as a reason to re-register everything.
 *
 * The verified flag matters because "added to the project" and "answers on
 * HTTPS" are not the same moment: a freshly added host is in this list
 * immediately, while its TLS certificate is issued a minute or two later, and
 * until then the browser cannot open it at all (the apex sends
 * `Strict-Transport-Security: includeSubDomains; preload`, so there is not
 * even a "continue anyway" to click). Reporting only membership made the sync
 * button claim success on a host nobody could reach yet.
 */
export async function listProjectDomains(): Promise<Map<string, boolean> | null> {
  const config = readConfig()
  if (!config) return null

  const hosts = new Map<string, boolean>()
  try {
    // The project's domain list is paginated; a tenant per page boundary
    // would otherwise look unregistered and be re-added on every sync.
    let until: number | undefined
    for (let page = 0; page < 20; page++) {
      const suffix = until ? `&until=${until}` : ''
      const { status, data } = await call(
        config,
        'GET',
        `/v9/projects/${config.projectId}/domains?limit=100${suffix}`
      )
      if (status < 200 || status >= 300) return null
      for (const domain of data?.domains ?? []) {
        if (domain?.name) hosts.set(String(domain.name).toLowerCase(), domain.verified !== false)
      }
      const next = data?.pagination?.next
      if (!next) break
      until = next
    }
    return hosts
  } catch {
    return null
  }
}

/**
 * Whether the host actually answers over HTTPS yet — the only question the
 * operator cares about, and one the platform's own domain list cannot answer
 * (see above).
 *
 * A host whose certificate has not been issued fails the TLS handshake, which
 * `fetch` reports as a thrown error; ANY HTTP status back means the
 * certificate is live and the address opens in a browser. /api/build-id is
 * used because it is the one route that needs no session and returns a few
 * bytes.
 */
export async function isHostServing(host: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${host}/api/build-id`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    })
    return response.status > 0
  } catch {
    return false
  }
}

/** The one project domain that covers every tenant host at once. */
export const WILDCARD_DOMAIN = `*.${ROOT_DOMAIN}`

export interface TenantDomainStatus {
  host: string
  /** Whether this deployment can register hosts at all. */
  configured: boolean
  /** The host is on the project, by name or through the wildcard domain. */
  registered: boolean
  /** Covered by `*.<root>` rather than by a record of its own. */
  wildcard: boolean
  /** The platform considers its DNS verified. */
  verified: boolean
  /** It answers over HTTPS right now — the only state the operator can see. */
  serving: boolean
  /** Settings the deployment is missing, when `configured` is false. */
  missing: string[]
}

/**
 * Everything the console needs to say about one company's address.
 *
 * `serving` is asked directly rather than inferred, because the three
 * questions have three different answers and only the last one matches what a
 * customer experiences: a host can be registered and still be minutes away
 * from its certificate, and — once a wildcard domain exists on the project —
 * it can serve perfectly while being registered nowhere by name. Reporting
 * "registered" as though it meant "works" is what made a freshly created
 * company look broken.
 */
export async function getTenantDomainStatus(subdomain: string): Promise<TenantDomainStatus> {
  const host = tenantHost(subdomain)
  const config = readConfig()

  // Both questions at once: the platform's record, and the address itself.
  const [record, serving] = await Promise.all([
    config
      ? call(config, 'GET', `/v9/projects/${config.projectId}/domains/${host}`).catch(() => null)
      : Promise.resolve(null),
    isHostServing(host),
  ])

  const named = Boolean(record && record.status >= 200 && record.status < 300)

  // No record of its own does not mean uncovered: one `*.<root>` domain on the
  // project serves every tenant host there will ever be, and certificates are
  // issued for each of them on the fly. Without this check every company would
  // be reported as missing the moment the wildcard made per-host registration
  // unnecessary.
  let wildcard = false
  if (!named && config) {
    const covering = await call(
      config,
      'GET',
      `/v9/projects/${config.projectId}/domains/${encodeURIComponent(WILDCARD_DOMAIN)}`
    ).catch(() => null)
    wildcard = Boolean(covering && covering.status >= 200 && covering.status < 300)
  }

  return {
    host,
    configured: config !== null,
    registered: named || wildcard,
    wildcard,
    verified: named ? record?.data?.verified !== false : wildcard,
    serving,
    missing: missingDomainConfig(),
  }
}
