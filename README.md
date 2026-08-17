# ERP

A Next.js 16 / React 19 ERP admin system for retail and wholesale businesses — inventory, sales, procurement, finance, HR, point of sale, analytics, and support in a single dashboard, localized in Uzbek, Russian, and English.

**Language / Til:** [English](#english) · [O'zbekcha](#ozbekcha)

---

<a id="english"></a>

## English

### Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Internationalization](#internationalization)
- [Known limitations](#known-limitations)

### Features

**Dashboard** — real-time KPIs, revenue chart, recent orders, low-stock alerts, live clock.

**Inventory** (`/inventory`) — products (with SKU, unit, cost/sale price, min/max stock), categories, configurable units of measurement, a full stock-movement audit log, Excel import/export with a downloadable template, and an AI-assisted stock scanner that turns a photo of a shelf/receipt into a structured stock count (Gemini).

**Sales** (`/sales`) — orders and invoices with line items, a customer registry with a map picker for delivery coordinates, and per-customer credit balances for overpayments/deposits.

**Procurement** (`/procurement`) — suppliers and purchase orders with partial-receipt tracking, Excel import/export.

**Finance** (`/finance`) — cashboxes (cash / card / transfer / other) with running balances, an income/expense transaction ledger, configurable transaction categories, and automatic insufficient-funds protection on cashbox withdrawals.

**HR** (`/hr`) — employees and departments, Excel import/export.

**POS** (`/pos`) — point-of-sale checkout flow.

**Analytics** (`/analytics`) — sales/stock charts and a sold-products breakdown.

**Support** (`/support`) — a support/help section with its own live clock.

**Settings** (`/settings`) — company profile, user management, personal profile, and security settings.

**Auth** — Supabase-backed session auth, locale-aware login, subdomain-based tenant header parsing (see [Known limitations](#known-limitations) for current scope).

### Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/ui-style primitives, Radix UI, Lucide icons |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Maps | Leaflet / react-leaflet |
| Backend | [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security) |
| i18n | next-intl (`uz`, `ru`, `en`) |
| AI | Google Gemini — OCR & stock-count image parsing, with an OpenAI-compatible fallback |
| Spreadsheets | `xlsx` for Excel import/export |

> `@tanstack/react-table`, `@tanstack/react-query`, and `zustand` are installed but only lightly used or unused today — data tables are hand-rolled, and most data fetching happens in React Server Components rather than client-side queries. See `CLAUDE.md` for the exact patterns in use before reaching for these libraries.

> **Note:** This project runs a pre-release Next.js build with breaking changes vs. the public docs. See `AGENTS.md` before making framework-level changes.

### Data model

Schema lives in `supabase/schema.sql`. Sixteen core tables, all with Row Level Security enabled:

| Table | Purpose |
| --- | --- |
| `profiles` | Extends Supabase `auth.users` — name, role (admin/manager/staff), department. |
| `departments` | Organizational departments. |
| `employees` | HR records, linked 1:1 to a profile. |
| `categories` | Self-referential product category tree. |
| `products` | Inventory items — SKU, unit, pricing, stock levels. |
| `customers` | CRM customers — contact info, geolocation, credit balance. |
| `suppliers` | Vendors — contact info, geolocation. |
| `sales_orders` / `sales_order_items` | Customer orders and their line items. |
| `invoices` | Billing documents, optionally with a scanned receipt image. |
| `purchase_orders` / `purchase_order_items` | Supplier orders and line items, with partial-receipt tracking. |
| `stock_movements` | Full audit trail of inventory changes. |
| `transactions` | Income/expense finance ledger. |
| `transaction_categories` | Configurable categories for the ledger. |
| `cashboxes` | Cash, card, and transfer accounts with running balances. |

### Getting started

#### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project — apply `supabase/schema.sql` and any migration files alongside it
- A Gemini API key for the AI-assisted OCR/stock-scanning features

#### Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=
GEMINI_API_KEY=
```

#### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to a locale-prefixed route (e.g. `/uz/login`).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

### Project structure

```
src/
  app/
    [lang]/
      (auth)/       # login — public routes
      (dashboard)/  # authenticated shell: dashboard, inventory, sales,
                     # procurement, finance, hr, pos, analytics, support, settings
    api/            # route handlers (OCR, inventory scan)
  components/
    ui/             # shadcn-based primitives (button, table, dialog, ...)
    shared/         # cross-domain pieces (PageHeader, PageClock, StatsCard,
                     # StatusBadge, ImportExportMenu)
    <domain>/       # feature components grouped by module
  lib/
    supabase/       # client, server, middleware, cache clients
    data/           # cached queries + cache-tag revalidation
    gemini.ts       # AI OCR/scan wrapper
    excel-io.ts     # xlsx import/export helpers
    finance-helpers.ts
    units.ts
  i18n/             # next-intl routing/request config
  proxy.ts          # middleware: tenant header, auth, i18n
messages/           # uz.json, ru.json, en.json translation catalogs
supabase/           # schema.sql and SQL migrations
```

### Internationalization

Three locales — Uzbek (default), Russian, English — routed via a locale prefix (`/uz/...`, `/ru/...`, `/en/...`) with `next-intl`. Translation catalogs live in `messages/{uz,ru,en}.json`, roughly 540 keys each across 14 namespaces (dashboard, inventory, sales, finance, hr, procurement, analytics, settings, pos, support, auth, nav, common, tools).

### Known limitations

- **Tenant isolation is not yet enforced at the database level.** The middleware (`src/proxy.ts`) parses a tenant subdomain and forwards it as a header, but `supabase/schema.sql` has no `tenant_id` column and every table's Row Level Security policy currently allows any authenticated user to read/write any row. Treat the subdomain routing as UI/branding scaffolding, not a security boundary, until per-tenant scoping is added.
- **Dark mode is styled but not switchable.** CSS variables and `dark:` utility classes exist throughout, but no theme provider currently toggles the `dark` class.

---

<a id="ozbekcha"></a>

## O'zbekcha

### Mundarija

- [Imkoniyatlar](#imkoniyatlar)
- [Texnologiyalar](#texnologiyalar)
- [Ma'lumotlar modeli](#malumotlar-modeli)
- [Ishga tushirish](#ishga-tushirish)
- [Skriptlar](#skriptlar)
- [Loyiha tuzilishi](#loyiha-tuzilishi)
- [Ko'p tillilik (i18n)](#kop-tillilik-i18n)
- [Ma'lum cheklovlar](#malum-cheklovlar)

### Imkoniyatlar

**Dashboard (Boshqaruv paneli)** — real vaqtda KPI ko'rsatkichlari, daromad grafigi, so'nggi buyurtmalar, kam qolgan tovarlar haqida ogohlantirish, jonli soat.

**Ombor (Inventory, `/inventory`)** — mahsulotlar (SKU, o'lchov birligi, tannarx/sotuv narxi, min/max qoldiq), kategoriyalar, sozlanuvchi o'lchov birliklari, tovar harakati bo'yicha to'liq audit jurnali, Excel orqali import/eksport (yuklab olinadigan shablon bilan) hamda rasm orqali (sun'iy intellekt — Gemini) tovar hisobini avtomatik aniqlaydigan skaner.

**Savdo (Sales, `/sales`)** — buyurtmalar va hisob-fakturalar (mahsulot qatorlari bilan), yetkazib berish manzilini xaritadan tanlash imkoniyatiga ega mijozlar reyestri, har bir mijoz uchun ortiqcha to'lov/depozit bo'yicha kredit balansi.

**Ta'minot (Procurement, `/procurement`)** — yetkazib beruvchilar va qisman qabul qilishni kuzatib boradigan xarid buyurtmalari, Excel import/eksport.

**Moliya (Finance, `/finance`)** — kassalar (naqd / karta / o'tkazma / boshqa), joriy balansni kuzatuvchi, daromad/xarajat tranzaksiyalari jurnali, sozlanuvchi tranzaksiya kategoriyalari va kassadan pul yechishda avtomatik yetarli mablag' tekshiruvi.

**HR (Kadrlar, `/hr`)** — xodimlar va bo'limlar, Excel import/eksport.

**POS (Kassa, `/pos`)** — kassa/sotuv jarayoni.

**Analitika (`/analytics`)** — savdo/tovar grafiklari va sotilgan mahsulotlar bo'yicha tahlil.

**Qo'llab-quvvatlash (Support, `/support`)** — o'z jonli soatiga ega yordam bo'limi.

**Sozlamalar (Settings, `/settings`)** — kompaniya profili, foydalanuvchilarni boshqarish, shaxsiy profil va xavfsizlik sozlamalari.

**Autentifikatsiya** — Supabase asosidagi sessiya autentifikatsiyasi, tilga mos login sahifasi, subdomain orqali tenant sarlavhasini aniqlash (joriy holati uchun [Ma'lum cheklovlar](#malum-cheklovlar) bo'limiga qarang).

### Texnologiyalar

| Qatlam | Texnologiya |
| --- | --- |
| Freymvork | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, shadcn/ui uslubidagi komponentlar, Radix UI, Lucide ikonkalari |
| Formalar | React Hook Form + Zod |
| Grafiklar | Recharts |
| Xaritalar | Leaflet / react-leaflet |
| Backend | [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security) |
| Ko'p tillilik | next-intl (`uz`, `ru`, `en`) |
| Sun'iy intellekt | Google Gemini — chek/tovar hisobini rasmdan aniqlash, zaxira sifatida OpenAI-mos API |
| Elektron jadval | Excel import/eksport uchun `xlsx` |

> `@tanstack/react-table`, `@tanstack/react-query` va `zustand` paketlari o'rnatilgan, ammo hozircha deyarli yoki umuman ishlatilmaydi — jadvallar qo'lda yozilgan, ma'lumotlarning katta qismi esa client-side so'rovlar emas, balki React Server Components orqali olinadi. Bu kutubxonalardan foydalanishdan oldin aniq qolipларни `CLAUDE.md` faylidan tekshiring.

> **Eslatma:** Loyiha ochiq hujjatlardan farq qiluvchi, buzuvchi (breaking) o'zgarishlarga ega Next.js versiyasida ishlaydi. Freymvork darajasidagi o'zgarish kiritishdan oldin `AGENTS.md` faylini o'qing.

### Ma'lumotlar modeli

Sxema `supabase/schema.sql` faylida joylashgan. O'n oltita asosiy jadval, barchasida Row Level Security yoqilgan:

| Jadval | Vazifasi |
| --- | --- |
| `profiles` | Supabase `auth.users`ni kengaytiradi — ism, rol (admin/menejer/xodim), bo'lim. |
| `departments` | Tashkilot bo'limlari. |
| `employees` | Kadrlar bo'yicha ma'lumotlar, profilga 1:1 bog'langan. |
| `categories` | O'z-o'ziga bog'langan mahsulot kategoriyalari daraxti. |
| `products` | Ombordagi mahsulotlar — SKU, o'lchov birligi, narxlar, qoldiq. |
| `customers` | CRM mijozlar — aloqa ma'lumotlari, geolokatsiya, kredit balansi. |
| `suppliers` | Yetkazib beruvchilar — aloqa ma'lumotlari, geolokatsiya. |
| `sales_orders` / `sales_order_items` | Mijoz buyurtmalari va ularning qatorlari. |
| `invoices` | Hisob-fakturalar, ixtiyoriy ravishda skanerlangan chek rasmi bilan. |
| `purchase_orders` / `purchase_order_items` | Yetkazib beruvchi buyurtmalari, qisman qabul qilishni kuzatish bilan. |
| `stock_movements` | Ombordagi barcha o'zgarishlarning to'liq audit jurnali. |
| `transactions` | Daromad/xarajat moliyaviy jurnali. |
| `transaction_categories` | Jurnal uchun sozlanuvchi kategoriyalar. |
| `cashboxes` | Naqd, karta va o'tkazma hisoblari, joriy balans bilan. |

### Ishga tushirish

#### Talablar

- Node.js 20+
- [Supabase](https://supabase.com) loyihasi — `supabase/schema.sql` va unga tegishli migratsiya fayllarini qo'llang
- Sun'iy intellekt (OCR/tovar skaneri) funksiyalari uchun Gemini API kaliti

#### Muhit o'zgaruvchilari

`.env.local` faylini yarating:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=
GEMINI_API_KEY=
```

#### O'rnatish va ishga tushirish

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) manzilini oching — siz tilga mos yo'nalishga (masalan, `/uz/login`) yo'naltirilasiz.

### Skriptlar

| Buyruq | Tavsifi |
| --- | --- |
| `npm run dev` | Dasturlash serverini ishga tushirish (Turbopack) |
| `npm run build` | Production uchun build yig'ish |
| `npm run start` | Production serverini ishga tushirish |
| `npm run lint` | ESLint tekshiruvini ishga tushirish |

### Loyiha tuzilishi

```
src/
  app/
    [lang]/
      (auth)/       # login — ochiq (public) yo'nalishlar
      (dashboard)/  # autentifikatsiyadan o'tgan qism: dashboard, inventory,
                     # sales, procurement, finance, hr, pos, analytics, support, settings
    api/            # route handler'lar (OCR, ombor skaneri)
  components/
    ui/             # shadcn asosidagi komponentlar (button, table, dialog, ...)
    shared/         # bo'limlararo umumiy qismlar (PageHeader, PageClock,
                     # StatsCard, StatusBadge, ImportExportMenu)
    <domen>/        # modul bo'yicha guruhlangan funksional komponentlar
  lib/
    supabase/       # client, server, middleware, cache clientlari
    data/           # keshlangan so'rovlar + cache-tag revalidatsiya
    gemini.ts       # AI OCR/skaner wrapper'i
    excel-io.ts     # xlsx import/eksport yordamchilari
    finance-helpers.ts
    units.ts
  i18n/             # next-intl routing/request konfiguratsiyasi
  proxy.ts          # middleware: tenant sarlavhasi, autentifikatsiya, i18n
messages/           # uz.json, ru.json, en.json tarjima fayllari
supabase/           # schema.sql va SQL migratsiyalari
```

### Ko'p tillilik (i18n)

Uchta til — o'zbek (asosiy), rus, ingliz — `next-intl` yordamida til prefiksi orqali (`/uz/...`, `/ru/...`, `/en/...`) yo'naltiriladi. Tarjima fayllari `messages/{uz,ru,en}.json`da joylashgan, har birida taxminan 540 ta kalit, 14 ta bo'lim (dashboard, inventory, sales, finance, hr, procurement, analytics, settings, pos, support, auth, nav, common, tools) bo'yicha taqsimlangan.

### Ma'lum cheklovlar

- **Tenant izolyatsiyasi hozircha ma'lumotlar bazasi darajasida ta'minlanmagan.** Middleware (`src/proxy.ts`) subdomain orqali tenantni aniqlab, uni sarlavha sifatida uzatadi, ammo `supabase/schema.sql`da `tenant_id` ustuni mavjud emas va har bir jadvalning Row Level Security siyosati hozircha har qanday autentifikatsiyadan o'tgan foydalanuvchiga istalgan qatorni o'qish/yozishga ruxsat beradi. Har bir tenant uchun alohida cheklov qo'shilmaguncha, subdomain marshrutlashni xavfsizlik chegarasi emas, balki UI/brending uchun tayyorgarlik sifatida qabul qiling.
- **Qorong'i rejim (dark mode) uslubi tayyor, ammo almashtirib bo'lmaydi.** CSS o'zgaruvchilari va `dark:` klasslari butun loyiha bo'ylab mavjud, biroq hozircha `dark` klassini yoqadigan theme provider yo'q.

---

## License

Private / unlicensed.
