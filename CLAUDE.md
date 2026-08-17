@AGENTS.md

# Project Overview

`erp` is a Next.js 16 / React 19 ERP admin system covering inventory, sales, procurement, finance, HR, POS, analytics, and support, with Uzbek/Russian/English localization. Backend is Supabase (Postgres + Auth). AI-assisted OCR and stock-count scanning run on Gemini.

## Commands

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint, includes React Compiler purity rules (see Gotchas)

## Architecture

### Routing & tenancy

- App Router under `src/app/[lang]/`, locale-prefixed (`uz` default, `ru`, `en` — `src/i18n/routing.ts`). Route groups: `(auth)` for `/login`, `(dashboard)` for the authenticated shell.
- `src/proxy.ts` (the middleware entrypoint) parses a tenant subdomain (`tenant.urlerp.com` / `tenant.localhost`) and forwards it as an `x-tenant-subdomain` header, enforces auth via `src/lib/supabase/middleware.ts`, then hands off to `next-intl`'s middleware.
- **Caveat**: this subdomain parsing is scaffolding only. `supabase/schema.sql` has **no `tenant_id`/`company_id` column on any table**, and every RLS policy is `USING (true)` for any authenticated user (see Gotchas). Don't assume tenant isolation exists at the data layer — it doesn't yet.

### Auth & session caching

- `src/lib/auth.ts`: `getSessionUser()` reads the session from the JWT cookie directly (no network call, `cache()`-memoized per request). `getCachedProfile(userId)` caches the profile row 5 minutes via `unstable_cache`, tagged `profile:<userId>`. This is only safe because the middleware already validates the JWT with `getUser()` on every request — don't remove that check or reuse this pattern somewhere the middleware doesn't run first.

### Data layer & mutation pattern

There are **no Server Actions performing actual writes**. The only `'use server'` file is `src/lib/data/revalidate.ts`, and it exists purely for cache invalidation — one exported function per entity (`invalidateProducts`, `invalidateOrders`, `invalidateCustomers`, `invalidateEmployees`, `invalidateSuppliers`, `invalidatePurchaseOrders`, `invalidateTransactions`, `invalidateTransactionCategories`, `invalidateInvoices`, `invalidateMovements`, `invalidateCategories`, `invalidateDepartments`, `invalidateAnalytics`, `invalidateProfile`, `invalidateAll`), each calling `updateTag()` from `next/cache`.

The real write path, consistent across every `*-form.tsx`:

1. `'use client'` form calls `createClient()` from `@/lib/supabase/client` (browser Supabase client).
2. `onSubmit` calls `supabase.from('<table>').insert(...)` / `.update(...).eq('id', ...)` **directly from the client** — no API route or Server Action wraps the write itself.
3. On success: `toast.success(...)` (sonner) → `await invalidate<Entity>()` → optionally `clearPersistedForm(id)` → `router.push(...)` back to the list/detail page.

Row-level quick actions inside tables (status toggle, delete, Excel upload — e.g. `products-table.tsx`) follow the same direct-Supabase-call pattern. Reads go through `src/lib/data/queries.ts` (server-side cached queries) rendered from Server Components.

API routes exist only for non-CRUD server work: `src/app/api/ocr/route.ts` and `src/app/api/inventory/scan/route.ts` (AI receipt/stock-count parsing).

### Forms

- `react-hook-form` + `zod`, schema defined **inline in the component** (`const formSchema = z.object({...})`, `zodResolver`) — not in a separate `schemas/` directory.
- Numeric/money fields use `Controller` + `<NumericInput>` (`src/components/ui/numeric-input.tsx`), not plain `register`.
- Field errors render inline: `{errors.field && <p className="text-sm text-red-500">{errors.field.message}</p>}` — no toast for validation errors, only for submit success/failure.
- `src/lib/hooks/use-persisted-form.ts` (`usePersistedForm`) auto-saves form state to `sessionStorage` (keyed by `form_persist_<formId>` + pathname) so a draft survives navigation away and back; call `clearPersistedForm(formId)` after a successful submit. Not every form uses it — check before assuming a form is draft-persisted (e.g. `employee-form.tsx` uses plain `useForm`).

### Excel import/export

- `src/lib/excel-io.ts`: `exportRowsToExcel`, `downloadExcelTemplate`, `readExcelFile`, `pickField` (tolerant multi-language header matching), all thin wrappers over `xlsx`.
- `src/components/shared/import-export-menu.tsx` (`ImportExportMenu`) is the generic toolbar widget (export / import / download-template), used by **employees, suppliers, customers** (`*-import-export.tsx` in their respective domain folders).
- **Products are the exception**: import/export is implemented directly inside `src/components/inventory/products-table.tsx`, not via `ImportExportMenu`, because it needs extra unit-of-measurement validation (`resolveMeasurementUnit`) and an `upsert(..., { onConflict: 'sku' })`.

### Database

`supabase/schema.sql` — 16 tables (+ `sales_order_items`, `purchase_order_items` join tables), RLS enabled everywhere:

| Table | Purpose |
| --- | --- |
| `profiles` | Extends `auth.users`; name, role (`admin`/`manager`/`staff`), department. Auto-created on signup via `handle_new_user()` trigger. |
| `departments` | Org departments, optional `manager_id` → `profiles`. |
| `employees` | HR records, 1:1 with `profiles` via `profile_id`. |
| `categories` | Self-referential product category tree. |
| `products` | SKU, unit, price/cost_price, stock/min/max, category. |
| `customers` | CRM — contact, geolocation, `credit_balance` (overpayment/deposit). |
| `suppliers` | Vendors — contact, geolocation, TIN. |
| `sales_orders` / `sales_order_items` | Customer orders and line items. |
| `invoices` | Billing docs tied to an order/customer, incl. receipt `image_url`. |
| `purchase_orders` / `purchase_order_items` | Supplier orders and line items (with partial-receipt `received_qty`). |
| `stock_movements` | Audit log of inventory changes (`in`/`out`/`adjustment`), polymorphic reference. |
| `transactions` | Finance ledger (`income`/`expense`), polymorphic reference to employee/supplier/customer. |
| `transaction_categories` | Configurable transaction categories, seeded with 11 defaults. |
| `cashboxes` | Cash/card/transfer accounts with a running `balance`. |

- `src/lib/finance-helpers.ts`: `adjustCashboxBalance(...)` mutates a cashbox's balance (throws `InsufficientFundsError` on an overdraft expense), with a `localStorage['erp_cashboxes']` fallback mirror if the Supabase call fails. `applyCustomerCredit(...)` draws down a customer's `credit_balance` against a new purchase.
- `src/lib/units.ts`: manages the configurable measurement-unit list per language (`localStorage['measurement_units']`), with `resolveMeasurementUnit` doing fuzzy matching for Excel imports.

### AI features

`src/lib/gemini.ts` wraps Gemini (`GEMINI_API_KEY`), used by `/api/ocr` and `/api/inventory/scan` for receipt/stock-count image parsing (`src/components/inventory/ai-stock-scanner-modal.tsx`). `src/lib/openai.ts` is an OpenAI-compatible fallback.

### i18n

Message catalogs: `messages/{uz,ru,en}.json`, ~540 keys each across 14 namespaces (`common`, `nav`, `auth`, `dashboard`, `inventory`, `sales`, `finance`, `hr`, `procurement`, `analytics`, `settings`, `tools`, `pos`, `support`). Keep all three files in sync when adding a key.

## Conventions

- Path alias `@/*` → `src/*`.
- `src/components/ui/` (27 files, shadcn-based) — primitives only. Notably **missing**: `form.tsx`, `pagination.tsx`, `alert-dialog.tsx`, `toast.tsx` — that's why forms use raw `react-hook-form` + manual error `<p>` tags, and tables hand-roll pagination (see `AGENTS.md` § Table Interfaces).
- Feature components are grouped by domain (`inventory/`, `sales/`, `hr/`, `finance/`, `procurement/`, `analytics/`, `pos/`, `settings/`, `support/`), with `shared/` for cross-domain pieces (`PageHeader`, `PageClock`, `StatsCard`, `StatusBadge`, `ImportExportMenu`).
- Locale-aware formatting follows the ternary pattern `lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'`, not automatic `Intl` locale negotiation.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` — `next build` will NOT fail on type errors. Run `tsc --noEmit` or `npm run lint` to actually catch them.

## Gotchas

- **RLS is not real tenant/role isolation today**: every table's policies are `FOR SELECT/ALL TO authenticated USING (true)`. Any authenticated user can read/write any row, regardless of the `x-tenant-subdomain` header set in middleware. The one exception is `profiles`, which restricts updates to self or an admin. Don't assume per-tenant or per-role data scoping is enforced anywhere below the UI.
- **Unused dependencies — don't assume they're wired up**: `@tanstack/react-table` and `zustand` are in `package.json` but have zero usages in `src/`. Tables are hand-rolled (see `AGENTS.md`); there's no global client store. `@tanstack/react-query` is installed and provided (`src/components/providers/query-provider.tsx`) but is likewise essentially unused elsewhere — most reads are Server Components + `unstable_cache`, not client-side queries.
- **React Compiler purity rules are lint errors, not warnings**: no impure calls (`Date.now()`, `Math.random()`) during render, and no `setState` called synchronously inside `useEffect` (`react-hooks/set-state-in-effect`). For values that change outside React's render cycle (clocks, external subscriptions), use `useSyncExternalStore` — see `src/components/shared/page-clock.tsx`.
- Check `node_modules/next/dist/docs/` before assuming an API from training data — this Next.js version has breaking changes (per `AGENTS.md`).
