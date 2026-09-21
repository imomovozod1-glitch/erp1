/**
 * Registering a tenant's own host with the hosting platform.
 *
 * Tenants live at `<subdomain>.<root domain>` (see getTenantSubdomain in
 * src/proxy.ts). On a Vercel plan that offers wildcard domains, a single
 * `*.falco.business` entry would cover every tenant that will ever exist and
 * none of this would be needed. The Hobby plan has no wildcard: a host only
 * reaches the project — and only receives a TLS certificate — once it has been
 * added to that project BY NAME. So each tenant's host is registered here, at
 * the moment the tenant is provisioned.
 *
 * DNS is deliberately not this file's job. One wildcard `CNAME *` record at the
 * registrar already points every subdomain at Vercel; what a wildcard DNS
 * record cannot do is the project-side half, which is what this adds.
 *
 * Nothing here ever throws, on purpose — the same contract as notifyTelegram
 * (src/lib/integrations/telegram.ts). A tenant whose domain call failed is
 * still a perfectly good tenant: the account exists, the owner login works,
 * and the host can be registered afterwards from Sozlamalar → Kompaniyalar
 * (POST /api/admin/domains). Provisioning a company must not fail because a
 * hosting API was briefly unreachable.
 *
 * Environment (all server-only except the root domain):
 *   DOMAIN_API_TOKEN   Vercel account token with access to the project.
 *   DOMAIN_PROJECT_ID  The project the hosts are added to (prj_…). Optional on
 *                      Vercel itself, which injects VERCEL_PROJECT_ID.
 *   DOMAIN_TEAM_ID     Only when the project belongs to a team rather than a
 *                      personal account — every call 404s without it if it does.
 *   NEXT_PUBLIC_ROOT_DOMAIN  Defaults to falco.business.
 *
 * The names deliberately do NOT start with `VERCEL_`: that prefix is reserved
 * for Vercel's own system variables and the dashboard refuses to create one.
 * The `VERCEL_*` spellings are still read as a fallback, which is what makes a
 * local .env.local written either way work.
 *
 * With none of them set every call reports `skipped` and changes nothing, so
 * local development and preview deployments behave exactly as before.
 */

const VERCEL_API = 'https://api.vercel.com'

/** The apex the tenant subdomains hang off. */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || 'falco.business'

/** The full host a tenant is served on. */
export function tenantHost(subdomain: string): string {
  return `${subdomain.toLowerCase()}.${ROOT_DOMAIN}`
}

export interface DomainResult {
  host: string
  /** The platform now serves this host (including "it already did"). */
  ok: boolean
  /** No credentials configured — nothing was attempted. */
  skipped?: boolean
  /** Human-readable reason, for the admin UI. Only set when `ok` is false. */
  error?: string
}

interface VercelConfig {
  token: string
  projectId: string
  teamId?: string
}

function readConfig(): VercelConfig | null {
  const token = (process.env.DOMAIN_API_TOKEN || process.env.VERCEL_API_TOKEN)?.trim()
  // On Vercel the project id arrives on its own as a system variable, so only
  // the token has to be set by hand there.
  const projectId = (process.env.DOMAIN_PROJECT_ID || process.env.VERCEL_PROJECT_ID)?.trim()
  if (!token || !projectId) return null
  const teamId = (process.env.DOMAIN_TEAM_ID || process.env.VERCEL_TEAM_ID)?.trim()
  return { token, projectId, teamId: teamId || undefined }
}

/** Whether tenant hosts can be registered at all in this deployment. */
export function isDomainAutomationConfigured(): boolean {
  return readConfig() !== null
}

async function call(
  config: VercelConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const url = new URL(`${VERCEL_API}${path}`)
  if (config.teamId) url.searchParams.set('teamId', config.teamId)

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // A company is waiting on the other side of this call during
    // provisioning; it is not allowed to hang there.
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  return { status: response.status, data }
}

function messageOf(data: any, fallback: string): string {
  return data?.error?.message || data?.message || fallback
}

/**
 * Adds `<subdomain>.<root domain>` to the project.
 *
 * Re-registering a host the project already serves is not an error — the API
 * answers 409 and the host is checked rather than reported as a failure, which
 * is what makes the sync endpoint safe to run as often as anyone likes.
 */
export async function registerTenantDomain(subdomain: string): Promise<DomainResult> {
  const host = tenantHost(subdomain)
  const config = readConfig()
  if (!config) return { host, ok: false, skipped: true }

  try {
    const { status, data } = await call(config, 'POST', `/v10/projects/${config.projectId}/domains`, {
      name: host,
    })
    if (status >= 200 && status < 300) return { host, ok: true }

    // Already on this project (409 domain_already_exists, and the several
    // other spellings the API has used for it) — confirm rather than trust
    // the error code, then report success.
    if (status === 409 || /already/i.test(messageOf(data, ''))) {
      const check = await call(config, 'GET', `/v9/projects/${config.projectId}/domains/${host}`)
      if (check.status >= 200 && check.status < 300) return { host, ok: true }
    }

    return { host, ok: false, error: messageOf(data, `Vercel returned ${status}`) }
  } catch (error: any) {
    return { host, ok: false, error: error?.message || 'Vercel API unreachable' }
  }
}

/**
 * Removes the tenant's host from the project.
 *
 * A host that is not there is treated as removed — a tenant deleted before
 * its domain was ever registered must not report a failure.
 */
export async function unregisterTenantDomain(subdomain: string): Promise<DomainResult> {
  const host = tenantHost(subdomain)
  const config = readConfig()
  if (!config) return { host, ok: false, skipped: true }

  try {
    const { status, data } = await call(
      config,
      'DELETE',
      `/v9/projects/${config.projectId}/domains/${host}`
    )
    if ((status >= 200 && status < 300) || status === 404) return { host, ok: true }
    return { host, ok: false, error: messageOf(data, `Vercel returned ${status}`) }
  } catch (error: any) {
    return { host, ok: false, error: error?.message || 'Vercel API unreachable' }
  }
}

/**
 * Every host the project currently serves, lowercased.
 *
 * `null` means the question could not be answered (no credentials, or the API
 * failed) — which is different from "the project serves nothing", and the
 * caller must not read it as a reason to re-register everything.
 */
export async function listProjectDomains(): Promise<Set<string> | null> {
  const config = readConfig()
  if (!config) return null

  const hosts = new Set<string>()
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
        if (domain?.name) hosts.add(String(domain.name).toLowerCase())
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
