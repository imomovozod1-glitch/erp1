<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ERP Design & Logic Guidelines

This is a style guide for building UI/logic in this ERP, benchmarked against top global and regional ERPs (Bito, Billz, Smartap). Rules below are grounded in what's already implemented in `src/` — follow the existing pattern before inventing a new one.

## 1. Clock & Time Display

Do not show a live current-time clock anywhere in the app. `src/components/shared/page-clock.tsx` (`PageClock`) is kept only as an unused, undeleted component — don't render it on new pages.
- Locale formatting: `lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US'`.

## 2. Visual & UX Standards

- **Cards**: `border-0 shadow-sm hover:shadow-md transition-shadow duration-200`, `rounded-lg`/`rounded-xl`/`rounded-2xl` radii (see `--radius-*` tokens in `globals.css`).
- **KPI tiles**: use `<StatsCard>` (`src/components/shared/stats-card.tsx`) — title + big value + icon in a colored backdrop (`p-2 rounded-lg bg-indigo-50 text-indigo-600`, swap the color per metric), optional trend line (`↑`/`↓` in `emerald-600`/`red-500`).
- **Status pills**: use `<StatusBadge>` (`src/components/shared/status-badge.tsx`) — this is the single status-pill design used across the whole app. Tones: `emerald` (success/delivered), `rose` (cancelled/danger), `amber` (pending/warning), `blue` (in-progress), `indigo` (highlight), `slate` (neutral/draft). Each tone already ships a `dark:` variant — don't hand-roll new color combos.
- **Dark/light theme**: `globals.css` defines a full `.dark` token set; `src/components/providers/theme-provider.tsx` (`light`/`dark`/`system`, persisted in `localStorage['erp-theme']`) applies the `dark` class, and `<ThemeToggle>` (`src/components/shared/theme-toggle.tsx`) is already in the tenant, admin and support headers. Every new component needs `dark:` variants — don't add a second theme mechanism.
- **Micro-animations**: prefer Tailwind's built-in `transition-*`/`duration-*` utilities (as in `StatsCard`, `PageHeader` action buttons) over adding a new animation library.

## 3. Table Interfaces

There is one established table convention — do not introduce a table library (`@tanstack/react-table` is not installed) or a new pagination primitive. Follow `src/components/inventory/products-table.tsx` / `src/components/sales/orders-table.tsx`:

- Built from `src/components/ui/table.tsx` primitives (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`).
- **Pagination is server-side and URL-driven**: the list `page.tsx` reads `?page=&q=` with `readPageParams` and fetches one page with `queryPage` (`src/lib/data/paginate.ts`, `DEFAULT_PAGE_SIZE = 10`); the table renders `<TableSearch>`, `<TableFilterChips param=…>` and `<TablePagination page totalPages total pageSize>` from `src/components/shared/table-pagination.tsx`, which update the query string (and reset to page 1 on search/filter change). Don't keep page or search state in `useState`, and don't `.slice()` a full list client-side.
- **Row actions**: a trailing `w-12` column with a `DropdownMenu` behind a `MoreHorizontal` trigger; call `e.stopPropagation()` on the trigger so it doesn't also fire the row's own click-to-navigate handler.
- **Clickable rows**: `<TableRow onClick={() => router.push(detailUrl)}>` for navigation to a detail page, in addition to (not instead of) the actions menu.
- **Toolbar**: `<TableSearch>` plus `<TableFilterChips>` plus export/import actions, in a `flex flex-wrap items-center justify-between border-b` bar.
- **Empty state**: one centered `TableCell colSpan={N}` with a muted icon and `t('common.noData')`.
- Format money/numbers with `formatCurrency`/`formatNumber` and dates with `formatDate` from `@/lib/utils` — never format inline with ad-hoc string concatenation.
- Real-time feel: after any mutation, call the matching `invalidate*()` action from `src/lib/data/revalidate.ts` (Next.js cache tags) — don't hand-roll polling. Its response already carries the current route re-rendered, so do **not** follow it with `router.refresh()` (that renders the page a second time); only `router.push()` when the flow navigates away. Logout is a full `window.location.replace(...)` to the login page.

## 4. Logic & Architecture

- Keep analytics/charts on `recharts` via the existing `src/components/ui/chart.tsx` wrapper — this is the only charting library in the project.
- **Translations/locales**: `uz` (default), `ru`, `en` — see `src/i18n/routing.ts` and `messages/{uz,ru,en}.json`. Every user-facing string goes through `next-intl` (`useTranslations`/`getTranslations`), never hardcoded. Keep all three message files in sync when adding a key.
  - A component that pulls from **several** namespaces should use the root translator with fully-qualified keys — `const t = useTranslations()` and `t('support.title')` — as `products-table.tsx` and `support-client.tsx` do. With more than one `useTranslations()` in a file the editor's i18n plugin cannot tell which namespace an unqualified `t('title')` belongs to and flags every key in the file as missing; a full key is unambiguous to it and to the reader. Where a file does keep a single bare `t`, declare it **last** of the group (see `pos-client.tsx`) — order has no runtime effect, it only decides what the editor attributes calls to.
- **Mutations**: write directly with the Supabase browser client from the form component, then call the relevant `invalidate*()` cache-tag action — see `CLAUDE.md` → Architecture → Data layer for the full pattern before adding a new API route or Server Action.
