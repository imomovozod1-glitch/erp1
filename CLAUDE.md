@AGENTS.md

# Project Overview

`falco` (shipped as **Falco**) is a multi-tenant SaaS ERP on Next.js 16 / React 19 covering inventory, sales, procurement, finance, HR, customers, POS, reports/analytics, and support, with Uzbek/Russian/English localization. Backend is Supabase (Postgres + Auth + Realtime). AI-assisted OCR and stock-count scanning run on Gemini.

One codebase serves four front-ends:

| App | Where | Who | Code |
| --- | --- | --- | --- |
| Tenant ERP | `<tenant>.<domain>/<lang>/…` | A company's staff | `src/app/[lang]/` |
| Super-admin console | `admin.<domain>` (rewritten to `/admin`) | Platform operator: tenants, payments, support agents, admins | `src/app/admin/`, `src/components/admin/`, `src/app/api/admin/` |
| Support portal | `support.<domain>` (rewritten to `/support`) | Support agents answering tenant tickets | `src/app/support/`, `src/components/support-portal/`, `src/app/api/support/` |
| Telegram Mini App | `/tg` on the bare host | Telegram users linking to their tenant login | `src/app/tg/`, `src/components/telegram/`, `src/app/api/telegram/` |

A Capacitor shell (`capacitor.config.ts`, `android/`, `ios/`) wraps the **live Vercel deployment** in a WebView (`server.url`) — there is no static export; `public/offline.html` is the only bundled page.

## Commands

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint, includes React Compiler purity rules (see Gotchas)
- `npm run apk` / `npm run apk:release` — Android build via `scripts/build-apk.sh` (macOS-only paths: Homebrew JDK, `~/Library/Android/sdk`)

`vercel.json` pins the functions to **`hnd1` (Tokyo, `ap-northeast-1`)** — the region the Supabase project is in. Vercel defaults every new project to `iad1` (Washington), which put a trans-Pacific round trip on *every* query: a page render makes several sequential Supabase calls, so the distance was paid several times per navigation. Keep the two regions together; if the Supabase project ever moves, this moves with it (Hobby allows a single region).

Required env (`.env.local`, git-ignored, documented in `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TELEGRAM_MINIAPP_BOT_TOKEN`, `MAPBOX_ACCESS_TOKEN`. Optional: `NEXT_PUBLIC_ROOT_DOMAIN` (default `falco.business`) plus `DOMAIN_API_TOKEN` / `DOMAIN_PROJECT_ID` / `DOMAIN_TEAM_ID`, which let provisioning register each tenant's host with Vercel (`src/lib/vercel-domains.ts`) — the Hobby plan has no wildcard domain, so a tenant subdomain is only served once it is added to the project by name. `lint-results.txt` in the repo root is a stale snapshot from another machine — don't treat it as current.

## Architecture

### Routing & tenancy

- Tenant app lives under `src/app/[lang]/`, locale-prefixed (`uz` default, `ru`, `en` — `src/i18n/routing.ts`). Route groups: `(auth)` for `/login`, `(dashboard)` for the authenticated shell. `(dashboard)/@modal` holds intercepted-route "create" dialogs (`src/components/shared/route-modal.tsx`, `use-route-modal`). `[lang]/tenant-status` is the public "blocked / inactive / not-found / wrong-tenant" page.
- `src/proxy.ts` (the middleware entrypoint), in order:
  1. Parses the subdomain (`tenant.falco.business` / `tenant.localhost`; raw IPs and `*.vercel.app` are never tenants). `admin` and `support` are rewritten to their consoles (reserved in `RESERVED_SUBDOMAINS`, `src/lib/tenant-auth.ts`).
  2. Returns early — no locale, tenant gate, or auth — for `/api/**`, `/admin/**`, `/tg/**`, `/support/**`. Those areas authenticate themselves.
  3. **Tenant status gate**: looks the tenant up with the service-role REST API, cached 30 s in the unsigned `tg_cache` cookie, and flips a lapsed subscription to `blocked` (`computeEffectiveStatus`, `src/lib/tenant-status.ts`). Non-active tenants are redirected to `/tenant-status`.
  4. `updateSession()` (`src/lib/supabase/middleware.ts`), then `next-intl`'s middleware. Throttled `last_active_at` ping (`la_ping` cookie, 5 min).
- `(dashboard)/layout.tsx` redirects super-admins/support agents to their own consoles (`getStaffIdentity`) and checks that the requested subdomain matches the session's tenant.
- Tenancy IS enforced at the data layer: `supabase/migration_multi_tenant.sql` adds a NOT NULL `tenant_id` to every business table, rewrites each RLS policy to tenant scope (`get_my_tenant_id()`), and attaches a `set_tenant_id()` BEFORE INSERT trigger — which is why client-side inserts never pass `tenant_id` themselves. Server-side code using the service-role client (`getCacheClient()`) bypasses RLS and must filter `.eq('tenant_id', …)` by hand; reads through the user's own client (`@/lib/supabase/server` or `/client`) are scoped for you.

### Auth & session caching

- Everyone (tenant users, support agents, super-admins) shares Supabase Auth cookies. Tenant users and agents log in by phone, mapped to a synthetic email `{digits}@tenant.local` (`phoneToSyntheticEmail`). Logins go through rate-limited routes (`api/auth/login`, `api/admin/login`, `api/support/login`, `api/telegram/link`; `src/lib/rate-limit.ts`, table `login_attempts`). A lock answers `429 { error: 'too_many_attempts', retryAfterSeconds }` (+ `Retry-After`), the real time until the lock lifts; forms turn it into minutes with `lockMinutesFrom` (`src/lib/login-lock.ts`). A tenant owner's login is the auth user whose email is `phoneToSyntheticEmail(tenants.phone)` — resolve it with `resolveTenantOwner` (`src/lib/tenant-owner.ts`), not `tenants.owner_user_id` alone, before resetting a password or changing the tenant phone.
- `src/lib/auth.ts`:
  - `getSessionUser()` reads the JWT cookie (no network call, `cache()`-memoized). Only safe where the middleware ran first.
  - `getVerifiedUser()` calls `getUser()`; `getTenantContext()` builds on it for `/api/**` routes (the middleware never runs there) and takes `tenant_id`/`role` from the DB profile, never from the request. It also rejects deactivated (`is_active = false`) profiles.
  - `getCachedProfile(userId)` caches the profile 5 min, tag `profile:<userId>` — call `invalidateProfile()` after changing a profile.
- Middleware validation is a local ES256 check (`getClaims()` against a module-cached JWKS). Once per 20 s (`flc_cache` cookie) it takes the full `getUser()` path and reads `profiles.force_logout_at` / `is_active`, signing the user out on a password reset (`force_logout_at > last_sign_in_at`) or deactivation.
- Staff: `getSuperAdminSession()` / `getSupportAgentSession()` / `getStaffIdentity()` in `src/lib/admin-auth.ts` check the `super_admins` / `support_agents` tables with the service role. Those tables have no `authenticated` RLS policies.

### Permissions (RBAC)

- `profiles.role` (`admin`/`manager`/`staff`) plus `profiles.permissions` JSONB: `{ module: { view, create, edit, delete, export, approve, scope: 'all' | 'own' } }`. Role templates (`role_templates`) pre-fill it.
- `src/lib/permissions.ts`: `can()` (admin always passes), `normaliseModulePermission` (upgrades the legacy `{view, edit}` shape). `src/lib/permissions-server.ts`: `canDo`, `getDataScope`, `requireModuleView` (called from each module's `layout.tsx`), `requireModuleEdit`, `requireAction`, `requireTenantAdmin`.
- Tenant user management goes through `src/app/api/tenant/users/**` and `api/tenant/roles/**` (admin-only, service role).

### Feature flags & release flow

One deployment serves every tenant, so `main` deploying is every company getting the new code at once. `tenants.features` JSONB (`migration_tenant_features.sql`) is how a change reaches ONE company first: it ships switched off, the super-admin turns it on for the test company (admin → company → **Feature flags**), and only that subdomain takes the new path.

- Registry: `src/lib/features.ts` — `FEATURE_FLAGS` (key → label + description), `normaliseFeatures`, `isFeatureOn`. Pure and client-safe. Adding a key is all that is needed for the admin toggle to appear; labels live in code, not `messages/*.json`, because a flag is temporary and only the platform operator sees it.
- Reading: `hasFeature('x')` / `getCurrentTenantFeatures()` (`src/lib/features-server.ts`, off the `getCachedTenant` row — no extra query) in server code; `useFeature('x')` (`src/components/providers/features-provider.tsx`, fed once by the dashboard layout) in client components. Outside a tenant tree every flag reads as off, as it does on a database where the migration is not applied yet.
- Writing: super-admin only, through `PATCH /api/admin/tenants/[id]` (`features`), which runs the payload through `normaliseFeatures` and clears the `tenant:<id>` tag. Tenant users can read their own row but have no column grant on it, so a tenant admin cannot switch a flag on for themselves.
- NOT permissions: `permissions.ts` answers "may this USER do this?" and is permanent product configuration. A flag answers "is this code released to this COMPANY yet?" — delete the flag and its branch once the feature is on everywhere.

The flow around it: work on `dev` → CI green (`.github/workflows/ci.yml`: `npm run lint`, `npx tsc --noEmit`, `npm run build` on every push/PR to `dev` and `main`) → PR `dev` into `main` → merge → production. `tsc --noEmit` in CI is not redundant with the Vercel build: `next.config.ts` sets `typescript.ignoreBuildErrors: true`, so a production build ships type errors happily, and CI is the only place they fail. Vercel builds a preview per `dev` push automatically, but tenant subdomains do NOT resolve on `*.vercel.app` (`getTenantSubdomain`, `src/lib/tenant-host.ts`) — the preview can only exercise `/admin`, `/support`, `/tg` and the bare host, which is why tenant-facing changes are checked on the flagged test company instead.

### Data layer & mutation pattern

The only `'use server'` file is `src/lib/data/revalidate.ts`, purely for cache invalidation — one `invalidate<Entity>()` per entity (`Products`, `Categories`, `Movements`, `Orders`, `OrderItems`, `Customers`, `CustomerCategories`, `Invoices`, `Employees`, `RoleTemplates`, `Departments`, `Suppliers`, `PurchaseOrders`, `Transactions`, `TransactionCategories`, `Analytics`, `Profile`, `Tenant`, `Cashbox`, `All`), each calling `updateTag()`.

The business write path, consistent across every `*-form.tsx`:

1. `'use client'` form calls `createClient()` from `@/lib/supabase/client`.
2. `onSubmit` calls `supabase.from('<table>').insert(...)` / `.update(...)` **directly from the browser** — no API route, Server Action, `.rpc()`, or DB transaction wraps it.
3. On success: `toast.success(...)` → `await invalidate<Entity>()` → optionally `clearPersistedForm(id)` → `router.push(...)`.

**Exception — anything that moves money or stock** goes through a Postgres function instead (`supabase/migration_business_rpc.sql`), called with `callBusinessRpc(supabase, '<fn>', args)` from `src/lib/business-rpc.ts`. Each function is one transaction, locks the rows it reads, changes balances as `col = col ± x`, and checks the RBAC matrix itself. A refusal comes back as `{ ok: false, code }` and is thrown as `BusinessRpcError`; show it with `businessRpcErrorMessage(t, error)`. `RPC_MISSING` (PostgREST `PGRST202`) means the migration is not applied yet — every caller then falls back to its old browser-side path (`*InBrowser` functions, or a `// Pre-migration fallback.` block); delete those once the migration is everywhere. Invalidate the caches with the combined actions (`invalidateSale`, `invalidatePurchase`, `invalidateCashboxMovement`): Server Actions are dispatched one at a time and each `updateTag` re-renders the route, so a `Promise.all` of per-entity invalidations is N sequential round trips.

| Function | Caller | Permission |
| --- | --- | --- |
| `create_sale` | `sale-create.ts` ← POS `checkout.ts`, `sale-form.tsx` | POS: `pos.view`; form: `sales.create`/`edit` |
| `update_sale_lines` | `sale-edits.ts` ← `order-form.tsx` | `sales.edit`, own |
| `cancel_sales_order` | `status-actions.ts` ← `cancel-sale-dialog.tsx` | `sales.edit`, own |
| `set_order_status`, `set_invoice_status` | `status-actions.ts` ← orders/invoices tables | `sales.edit`, own |
| `accept_invoice_payment` | invoice detail page | `sales.edit`, own |
| `save_invoice` | `invoice-form.tsx` | `sales.create`/`edit`; existing: `sales.edit`, own |
| `receive_purchase` | `purchase-order-form.tsx` | `procurement.create`/`edit` |
| `create_cashbox`, `record_cashbox_movement` | `cashbox-client.tsx` | `finance.create`/`edit` |
| `save_transaction` | `transaction-form.tsx` | `finance.create`/`edit`; existing: `finance.edit`, own |

"own" = with an `own` data scope only records `assigned_to` the caller. Still plain browser writes: product stock adjustments (`product-form.tsx`), the AI stock scanner, cashbox rename/delete, and the non-money header fields of orders (`order-form.tsx`).

Reads: `src/lib/data/queries/*.ts` (one file per domain, re-exported from `index.ts`, tags in `cache-tags.ts`) — `unstable_cache` with 30–60 s TTLs, service-role client, explicit tenant filter. `src/lib/data/paginate.ts` (`queryPage`) is the uncached server-side paging/search path, including the "own records" scope filter.

API routes (`src/app/api/`) handle everything that needs the service role or a secret: admin/support/tenant management, logins, Telegram, `reports/run`, `ocr`, `inventory/scan`, `build-id`.

### Sales, POS & inventory costing

- Creating, editing and cancelling a sale are database functions (see the table under "Data layer & mutation pattern").
- Creating: `create_sale(jsonb)` via `createSaleRpc` (`src/lib/sale-create.ts`), called by `src/components/sales/sale-form.tsx` (`channel: 'form'`, needs `sales.create`/`edit`) and `src/components/pos/checkout.ts` `submitPosSale` (`channel: 'pos'`, needs `pos.view`). It checks stock per product total → inserts the order → `consume_cost_layers` → items + `stock_movements` + `products.stock` → customer credit (debt) or income transaction + cashbox (`pick_cashbox`, creating one of that type if missing) → invoice. Order/invoice numbers and local dates are generated by the caller.
- Cancelling (any status, including `delivered`) is `cancelSalesOrder` in `src/lib/status-actions.ts` → `cancel_sales_order(uuid)` (needs `sales.edit`; with an `own` scope only sales assigned to the caller), opened through `src/components/sales/cancel-sale-dialog.tsx`; a cancelled sale can no longer be edited. It reverses everything: stock + `in` movements + a `sale_cancellation` cost layer; the sale's income transactions are deleted and their sum withdrawn from the cashbox matching the payment method parsed from the order/invoice notes; invoices are cancelled (which removes the debt); anything else paid on the invoice (spent credit, collected debt) goes back to `customers.credit_balance`.
- Editing a sale's lines (`src/lib/sale-edits.ts` `updateSaleLines` → `update_sale_lines`, UI `sale-lines-editor.tsx` inside `order-form.tsx`): a removed line goes back to stock (`return_sale_lines_to_stock`, shared with cancelling); a price change rewrites `total_price`; the order total is recomputed (lines − discount + tax) and is read-only in the form; the difference moves the cashbox and the income transaction (cash sales) or the invoice total / debt, with any overpayment turned into customer credit (debt sales).
- `src/lib/inventory-costing.ts` + `migration_inventory_costing.sql`: FIFO / LIFO / AVECO per tenant (`tenants.costing_method`), `inventory_cost_layers` per stock-in; `products.cost_price` kept as a weighted average.
- `src/lib/finance-helpers.ts`: `adjustCashboxBalance(...)` (throws `InsufficientFundsError`; falls back to a `localStorage['erp_cashboxes']` mirror if Supabase fails), `applyCustomerCredit(...)`.
- POS (`src/components/pos/`) shows the receipt immediately and saves in the background. Printing: `src/lib/printer/` builds ESC/POS bytes (58/80 mm, CP866 Cyrillic) and sends over WebUSB or Web Bluetooth, falling back to `window.print()`; config is per-device in `localStorage['erp_printer_config']`.

### Maps & route planning

Maps are Leaflet + `react-leaflet`; **Mapbox is used for routing only**, never for the basemap. Mapbox bills its raster tiles per tile REQUEST and one Leaflet viewport is 10–20 of them, so the 50 000 free allowance is roughly 3 000 map openings a month — the basemap has free alternatives, road geometry does not.

- Basemap: `useTileConfig()` (`src/lib/map-tiles.ts`) answers a themed tile URL — CARTO's free light/dark raster pair, which is what gives the maps a dark mode. Every `<TileLayer>` in the app reads from it. Setting `NEXT_PUBLIC_MAPBOX_STYLE_TILES` + `NEXT_PUBLIC_MAPBOX_TILE_TOKEN` switches the basemap to Mapbox; `api.mapbox.com` is already in the CSP's `img-src` for that.
- Routing: `src/lib/mapbox.ts` (`server-only`). `optimizeStops()` sends ≤ 12 points to Optimization v1 (its hard cap) and orders anything longer itself with nearest-neighbour + 2-opt on straight-line distance, then draws it with `getRouteGeometry()`, which chunks at the Directions cap of 25 with one overlapping point per seam. The `solver` field says which did it — `'local'` is the weaker answer and the UI labels it as approximate.
- `MAPBOX_ACCESS_TOKEN` is **server-only on purpose**: every call runs in an API route, so `api.mapbox.com` never has to be opened in `connect-src` and the token is not in the client bundle. Without it the API routes answer `mapbox_not_configured` and routes still work, ordered by hand.
- Two routes, both `getTenantContext()` + RBAC'd, both using the caller's own Supabase client so tenant RLS applies: `POST /api/distribution/routes/[id]/optimize` (`distribution.edit`, `own` scope honoured) re-orders a saved marshrut's stops and **persists** the result; `POST /api/distribution/directions` (`customers.view`) plans an ad-hoc round and stores nothing.
- Caching is the cost control: `migration_route_geometry.sql` adds `geometry`/`distance_m`/`duration_s`/`optimized_at`/`optimized_by` to `distribution_routes`, so a company spends about one request per route EDIT rather than one per page view. A trigger on `distribution_route_stops` blanks them whenever the stops change, so a stale line is never drawn — which is why the route form writes geometry **after** the stops, never before.
- Client side: `src/lib/route-plan.ts` (fetch wrappers, `toLeafletPath` for the GeoJSON `[lng,lat]` → Leaflet `[lat,lng]` flip, `routePlanErrorMessage(tRoot, error)`) and `<RouteMap>` (`src/components/distribution/route-map.tsx`, `ssr:false` wrapper like `all-customers-map.tsx`).

### Reports

`/reports/*` pages load `getCachedSalesReportData` and compute client-side (`src/lib/reports/sales-analytics.ts`). The custom report builder (`src/components/reports/report-builder.tsx`) POSTs to `/api/reports/run` → `src/lib/reports/engine.ts` (permission + scope checked, capped at 5000 rows); sources in `definitions.ts`.

### Support, Telegram, integrations

- Support chat: `support_threads` (`kind` = `tenant` ticket or `agent` admin→agent DM) + `support_messages`; helpers in `src/lib/support-messaging.ts` (`postMessage`, `agentCanAccessThread`), realtime broadcast via `src/lib/realtime.ts`.
- Telegram Mini App: `verifyTelegramInitData` (`src/lib/telegram-miniapp.ts`), `/api/telegram/session` (lookup) and `/link` (password sign-in + `telegram_links` upsert).
- Telegram bot notifications: per-tenant `integration_settings` (service-role only), `src/lib/integrations/telegram.ts` (`notifyTelegram`, never throws), client trigger `fireTelegramNotification` → `/api/integrations/telegram/notify`.

### Offline & mobile

- `src/lib/offline/` (IndexedDB `erp_offline`, ordered `outbox`, `sync-store` via `useSyncExternalStore`) is built but **not wired into any write path yet** — only `offline-banner.tsx` uses it.
- `src/components/providers/capacitor-provider.tsx`: Android back button, status bar, splash, and a stale-build reload that compares `NEXT_PUBLIC_BUILD_ID` (from `VERCEL_GIT_COMMIT_SHA`) with `/api/build-id`. The deployment URL is hard-coded in both `capacitor.config.ts` and `public/offline.html`.

### Forms

- `react-hook-form` + `zod`, schema defined **inline in the component** (`zodResolver`) — no `schemas/` directory.
- Numeric/money fields use `Controller` + `<NumericInput>` (`src/components/ui/numeric-input.tsx`).
- Field errors render inline: `{errors.field && <p className="text-sm text-red-500">{errors.field.message}</p>}` — toasts only for submit success/failure.
- `usePersistedForm` (`src/lib/hooks/use-persisted-form.ts`) saves drafts to `sessionStorage` (24 h expiry); call `clearPersistedForm(formId)` after submit. Not every form uses it (e.g. `employee-form.tsx` doesn't).

### Excel import/export

- `src/lib/excel-io.ts` (lazy-loads `xlsx`): `exportRowsToExcel`, `downloadExcelTemplate`, `readExcelFile`, `pickField` (multi-language header matching).
- `ImportExportMenu` (`src/components/shared/import-export-menu.tsx`) is used by employees, suppliers, customers. **Products are the exception**: `products-table.tsx` implements it inline (unit validation via `resolveMeasurementUnit`, `upsert(..., { onConflict: 'tenant_id,sku' })`). Any upsert must target the per-tenant unique constraints from `migration_multi_tenant.sql` (`(tenant_id, sku)`, `(tenant_id, order_number)`, …) — a bare column target matches no constraint. `tenant_id` can stay out of the payload; the `set_tenant_id()` trigger fills it before the conflict check.

### Database

There are no migration tooling or ordering files — SQL is applied by hand. `supabase/schema.sql` is the base; `supabase/migration_*.sql` add everything else (each file's header states what it must run after). All migrations are written to be re-runnable.

Base tables (`schema.sql`): `profiles`, `departments`, `employees`, `categories`, `products`, `customers`, `suppliers`, `sales_orders`/`sales_order_items`, `invoices`, `purchase_orders`/`purchase_order_items`, `stock_movements`, `transactions`, `transaction_categories`, `cashboxes`.

Added by migrations:

| Table | Migration | Purpose |
| --- | --- | --- |
| `tenants`, `super_admins` | `multi_tenant` | SaaS account registry (status, subscription, costing method, `support_agent_id`, license seats) and vendor operators |
| `tenant_payments` | `admin_enhancements` | Payments that extend a subscription |
| `support_agents` | `support_agents` | Support staff identities |
| `support_threads`, `support_messages` | `support_messaging` (+ `support_messages_thread_check`) | Ticket / DM chat |
| `role_templates` | `roles_and_seats` | Reusable permission sets |
| `login_attempts` | `login_rate_limit` | Login throttling |
| `security_events` | `security_events` | Security audit log |
| `inventory_cost_layers` | `inventory_costing` | Costing layers (its `company_settings` is superseded by `tenants.costing_method`) |
| `customer_categories` | `customer_categories` | Customer grouping |
| `measurement_units` | `measurement_units` | Per-tenant units |
| `integration_settings` | `integrations` | Telegram bot credentials |
| `telegram_links` | `telegram_miniapp` | Telegram user → profile/tenant |
| — (columns on `distribution_routes`) | `route_geometry` | Cached Mapbox route shape, distance and duration |
| — (column on `production_order_items`) | `production_extra_materials` | `is_extra`: the line was added to this run by hand, not carried in from the composition |

`migration_tenant_features.sql` adds `tenants.features` JSONB (see Feature flags & release flow) — readable by the tenant's own members, writable only with the service role.

`migration_tenant_costing_lock.sql` makes `tenants.costing_method` immutable after creation (trigger, and revokes the tenant users' column grant). The admin tenant edit page therefore never shows it; the subscription there only moves through "Make payment" (`tenant-payment-dialog.tsx` → `POST /api/admin/tenants/[id]/payments`, which takes the term and seat count).

Functions (`migration_business_rpc.sql`): the money/stock entry points listed under "Data layer & mutation pattern" — SECURITY INVOKER, so the caller's tenant RLS and the `set_tenant_id()` triggers apply — plus their helpers `app_can`, `app_data_scope` (SECURITY DEFINER, read only the caller's own profile), `app_owns`, `consume_cost_layers`, `sync_product_average_cost`, `return_sale_lines_to_stock`, `pick_cashbox`, `credit_cashbox`.

`migration_profile_privilege_lockdown.sql` limits what a user may update on their own `profiles` row to `full_name`, `phone`, `avatar_url`, `department_id`.

### AI features

`src/lib/gemini.ts` (`GEMINI_API_KEY`) powers `/api/ocr` and `/api/inventory/scan` (`ai-stock-scanner-modal.tsx`); uploads are checked by `src/lib/file-validation.ts`. `src/lib/openai.ts` is an OpenAI-compatible fallback.

### i18n

`messages/{uz,ru,en}.json`, 24 namespaces (`common`, `nav`, `auth`, `tenantStatus`, `dashboard`, `inventory`, `sales`, `finance`, `hr`, `procurement`, `analytics`, `settings`, `tools`, `pos`, `support`, `admin`, `pageInfo`, `supportPortal`, `supportChat`, `permissions`, `guide`, `faq`, `reports`, `offline`). Keep all three files in sync (same keys, same line layout). The admin console picks its language from a cookie (`src/lib/admin-locale.ts`), not a URL prefix.

## Conventions

- Path alias `@/*` → `src/*`.
- **Line-item forms add by CLICK, not by a form row**: `<ItemPicker>` (`src/components/shared/item-picker.tsx`) is a search box whose list adds the clicked row immediately, at a quantity of 1 — a second click on the same one bumps it, and quantity/price are then edited inline in the lines table. Used by `sale-form.tsx` (where the pattern started), `bom-form.tsx`, `production-order-form.tsx`, `purchase-order-form.tsx` and `route-form.tsx` — every add-to-a-list form in the app goes through it. A row that cannot be added again (a route stop, which has no quantity) is `disabled` and badged with where it already is, rather than hidden from the list. Don't build another select → type a quantity → press "Add" row; `onPick` returning `false` keeps the list open for a refusal the user has to act on.
- **Every delete asks first**: `const [confirmDelete, confirmDialog] = useConfirmDelete()` from `src/components/shared/confirm-dialog.tsx`, `if (!(await confirmDelete({ name }))) return` at the top of the handler, and `{confirmDialog}` anywhere in the component's JSX. Never `window.confirm`.
- `src/components/ui/` (shadcn-based) — primitives only. Notably **missing**: `form.tsx`, `pagination.tsx`, `alert-dialog.tsx`, `toast.tsx` — forms use raw `react-hook-form` + manual error `<p>` tags; tables page server-side through `queryPage` + `src/components/shared/table-pagination.tsx` (see `AGENTS.md` § Table Interfaces).
- Feature components are grouped by domain (`inventory/`, `sales/`, `hr/`, `finance/`, `procurement/`, `customers` pages, `pos/`, `reports/`, `settings/`, `support/`, `admin/`, `support-portal/`, `telegram/`, `dashboard/`, `layout/`), with `shared/` for cross-domain pieces (`PageHeader`, `StatsCard`, `StatusBadge`, `ImportExportMenu`, `AssigneeSelect`, `PeriodFilter`, `ThemeToggle`, …).
- Theme: `src/components/providers/theme-provider.tsx` (`light`/`dark`/`system`, `localStorage['erp-theme']`) with `ThemeToggle` — already wired into the tenant, admin and support layouts.
- Locale-aware formatting follows the ternary pattern `lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'` — but anything rendered on BOTH sides of hydration must be locale-independent, since Node and the browser ship different ICU data (`formatCurrency`/`formatNumber` in `src/lib/utils.ts` are hand-rolled for exactly that reason).
- Never render flag emoji (🇺🇿) — Windows has no flag glyphs and shows the letters instead. Use `<CountryFlag iso="UZ" />` (`src/components/ui/country-flag.tsx`, SVGs in `public/flags/`, copied from `country-flag-icons/3x2/` — its React components are one 330 KB module), and copy the country's file there and add it to `FLAGS` when adding one to `PHONE_COUNTRIES`.
- "Today" as `YYYY-MM-DD` is `isoDate()` from `src/lib/utils.ts`, never `toISOString().slice(0, 10)` — the latter is UTC and answers with yesterday's date for the first five hours of every Uzbek day.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — `next build` will NOT fail on type errors. Run `npx tsc --noEmit` or `npm run lint` to catch them.
- `next.config.ts` also sets a strict CSP (`script-src 'self'`, `connect-src` limited to Supabase + OpenStreetMap, `frame-ancestors 'none'`) on every path — any new external script, API host, or iframe embed must be added there.

## Gotchas

- **RLS scopes by tenant, not by role**: within a tenant every authenticated member passes RLS. Per-role access is an application-level check (`permissions-server.ts`) — only the money/stock RPCs enforce it in the database (`app_can`), so raw PostgREST calls can reach data the UI hides. Guard new pages with `requireModuleView`/`requireModuleEdit` and new API routes with `canDo`/`requireAction`.
- **Plain browser writes are not atomic**: outside the money/stock RPCs, a multi-step write is a sequence of separate calls, and a value read in the browser and written back can lose a concurrent update. Product stock adjustments and the AI scanner still work that way. Anything new that moves stock, a cashbox, customer credit or cost layers belongs in `migration_business_rpc.sql`.
- **Service-role fallback**: `getCacheClient()` (`src/lib/supabase/cache-client.ts`) silently uses the anon key when `SUPABASE_SERVICE_ROLE_KEY` is missing — cached reads and staff checks then return empty/unauthorised instead of erroring.
- **Unsigned cache cookies**: `tg_cache` (tenant gate) and `flc_cache` (force-logout/deactivation check) are plain JSON — fine as short perf caches, not as security boundaries.
- **Telegram Mini App vs CSP**: `telegram.org/js/telegram-web-app.js` is not in `script-src`, and `frame-ancestors 'none'` blocks Telegram Web's iframe.
- **Unused dependency**: `zustand` is in `package.json` with zero usages; there is no global client store. `@tanstack/*` is not installed — don't reach for it.
- **React Compiler purity rules are lint errors**: no impure calls (`Date.now()`, `Math.random()`) during render, and no synchronous `setState` inside `useEffect`. For values that change outside React's render cycle use `useSyncExternalStore` (see `page-clock.tsx`, `theme-provider.tsx`).
- Check `node_modules/next/dist/docs/` before assuming an API from training data — this Next.js version has breaking changes (per `AGENTS.md`).
