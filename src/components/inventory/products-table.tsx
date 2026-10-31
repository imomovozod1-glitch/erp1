"use client";

import { useCan } from "@/components/providers/permissions-provider"
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useConfirmDelete } from "@/components/shared/confirm-dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  
  Package,
  Sparkles,
  Upload,
  Power,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { invalidateProducts, invalidateMovements } from "@/lib/data/revalidate";
import {
  consumeCostLayers,
  getEffectiveCostingMethod,
  recordCostLayer,
  type CostingMethod,
} from "@/lib/inventory-costing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MobileCard, MobileCardList, MobileChip, MobileThumb } from "@/components/shared/mobile-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { AIStockScannerModal } from "@/components/inventory/ai-stock-scanner-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { exportRowsToExcel } from "@/lib/excel-io";
import { getMeasurementUnits, resolveMeasurementUnit } from "@/lib/units";
// `xlsx` is ~7MB and only needed when the user actually exports or imports.
// Loading it on demand keeps it out of this page's initial bundle.
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { TableSearch, TablePagination, TableFilterChips } from "@/components/shared/table-pagination";

interface ProductsTableProps {
  /** Only the current page's rows — the server already applied search/filter/paging. */
  products: any[];
  lang: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status: 'all' | 'active' | 'inactive';
}

/**
 * Column headers an imported Excel file may carry, per product field.
 *
 * Shops do not use the template's wording: the quantity column comes in as
 * "Soni", "Miqdor", "Qoldiq", "Кол-во" as often as "Zaxira", and a header the
 * import did not recognise was read as 0 — the products landed, their stock
 * did not. Every alias is lowercased and apostrophe-normalised here because
 * that is the shape `normaliseHeaders` puts the file's own headers into.
 */
const HEADER_ALIASES = {
  name: ["nomi", "nomlanishi", "mahsulot", "mahsulot nomi", "tovar", "name", "product", "наименование", "название", "товар"],
  sku: ["sku", "artikul", "kod", "kodi", "article", "code", "артикул", "код"],
  price: ["sotuv narxi", "sotish narxi", "narxi", "narx", "chiqim", "price", "sale price", "цена продажи", "цена", "продажа"],
  costPrice: ["tannarx", "tannarxi", "cost", "cost price", "cost_price", "себестоимость"],
  incomingCost: ["kirim narxi", "kirim cost", "kirim", "incoming_cost", "incoming price", "входящая цена", "приход"],
  stock: ["zaxira", "zaxirasi", "soni", "son", "miqdor", "miqdori", "qoldiq", "qoldig'i", "stock", "quantity", "qty", "amount", "запас", "количество", "кол-во", "остаток"],
  minStock: ["minimal zaxira", "min zaxira", "minimal qoldiq", "min_stock", "min stock", "minimum stock", "мин. запас", "минимальный запас", "мин запас"],
  unit: ["o'lchov birligi", "o'lchov", "birligi", "birlik", "unit", "uom", "ед. изм.", "ед изм", "единица измерения", "единица"],
  description: ["tavsif", "izoh", "description", "comment", "описание", "примечание"],
} as const;

/** Uzbek Latin writes the same apostrophe four ways; a header must match whichever the file used. */
const HEADER_APOSTROPHES = /[\u02bb\u02bc\u2018\u2019`\u00b4]/g;

/** The row keyed by its headers lowercased, de-spaced and apostrophe-normalised. */
function normaliseHeaders(row: Record<string, any>): Map<string, any> {
  const cells = new Map<string, any>();
  for (const [header, value] of Object.entries(row)) {
    const key = String(header)
      .replace(HEADER_APOSTROPHES, "'")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!cells.has(key)) cells.set(key, value);
  }
  return cells;
}

/** First alias the row actually carries a value for, or undefined. */
function cell(cells: Map<string, any>, aliases: readonly string[]): any {
  for (const alias of aliases) {
    const value = cells.get(alias);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

/**
 * The stock an Excel import brought in, written to the ledger.
 *
 * The import upserts `products.stock` outright, which moved the number without
 * recording why: Ombor > Zaxira harakatlari stayed empty for every unit a file
 * carried in, and FIFO/LIFO/AVECO had no layer to charge the next sale against.
 * This files the same movement and cost layer a manual stock edit does
 * (product-form.tsx), for each product whose stock the file actually changed.
 *
 * A failed movement is logged, not thrown: the products themselves are already
 * saved by this point, and losing the whole import over a ledger row would be
 * the worse outcome.
 */
async function recordImportStockMovements(
  supabase: any,
  saved: any[],
  stockBySku: Map<string, number>,
  costingMethod: CostingMethod,
  userId: string | null,
): Promise<void> {
  await Promise.all(
    saved.map(async (product: any) => {
      const before = stockBySku.get(String(product.sku)) ?? 0;
      const after = Number(product.stock) || 0;
      const diff = after - before;
      if (diff === 0) return;

      // An increase opens a layer at the cost the file carried; a decrease
      // draws existing layers down under whichever method the tenant uses.
      const isIncrease = diff > 0;
      let unitCost = Number(product.cost_price) || 0;
      let totalCost = Math.abs(diff) * unitCost;

      if (isIncrease) {
        await recordCostLayer(supabase, {
          productId: product.id,
          quantity: diff,
          unitCost,
          sourceType: before === 0 ? "initial_stock" : "adjustment",
        });
      } else {
        const consumed = await consumeCostLayers(
          supabase,
          product.id,
          Math.abs(diff),
          costingMethod,
        );
        unitCost = consumed.unitCost;
        totalCost = consumed.totalCost;
      }

      const { error } = await supabase.from("stock_movements").insert({
        product_id: product.id,
        type: isIncrease ? "in" : "out",
        quantity: Math.abs(diff),
        quantity_before: before,
        quantity_after: after,
        reference_type: "excel_import",
        reason: "Excel import",
        unit_cost: unitCost,
        total_cost: totalCost,
        created_by: userId,
      });
      if (error) console.error("Error inserting import stock movement:", error);
    }),
  );
}

export function ProductsTable({
  products,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  status,
}: ProductsTableProps) {
  const canEdit = useCan("inventory", "edit", "products")
  const canExport = useCan("inventory", "export", "products")
  const canCreate = useCan("inventory", "create", "products")
  const canDelete = useCan("inventory", "delete", "products")
  const t = useTranslations();
  const [confirmDelete, confirmDialog] = useConfirmDelete();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

 
  const downloadExcelTemplate = async () => {
    const XLSX = await import('xlsx')
    const supabase = createClient();
    const systemUnits = await getMeasurementUnits(supabase);
    // Headers in the user's language — each one is also an import alias
    // (HEADER_ALIASES), so the filled-in template reads straight back in.
    const templateData = [
      {
        [t("inventory.excel.name")]: t("inventory.excel.sampleName"),
        [t("inventory.excel.sku")]: "SKU-000001",
        [t("inventory.excel.price")]: 15000,
        [t("inventory.excel.costPrice")]: 10000,
        [t("inventory.excel.incomingCost")]: 9500,
        [t("inventory.excel.stock")]: 100,
        [t("inventory.excel.minStock")]: 10,
        [t("inventory.excel.unit")]: systemUnits[0] || t("inventory.aiScanner.defaultUnit"),
        [t("inventory.excel.description")]: t("inventory.excel.sampleDescription"),
      }
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    // Reference-only sheet — the import only reads the first sheet, so this never
    // gets treated as product data, it's just documentation for the user.
    const unitsSheet = XLSX.utils.json_to_sheet(
      systemUnits.map((u) => ({
        [t("inventory.excel.allowedUnits")]: u,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, unitsSheet, t("inventory.excel.unitsSheet"));

    XLSX.writeFile(workbook, "mahsulotlar_shablon.xlsx");
  };

  const handleExportProducts = async () => {
    const rows = products.map((p: any) => ({
      ...p,
      categoryName: p.categories?.name || '',
      statusLabel: p.is_active ? t("common.active") : t("common.inactive"),
    }));
    await exportRowsToExcel(rows, [
      { header: t("inventory.excel.name"), key: 'name' },
      { header: t("inventory.excel.sku"), key: 'sku' },
      { header: t("inventory.category"), key: 'categoryName' },
      { header: t("inventory.excel.price"), key: 'price' },
      { header: t("inventory.excel.costPrice"), key: 'cost_price' },
      { header: t("inventory.excel.stock"), key: 'stock' },
      { header: t("inventory.excel.minStock"), key: 'min_stock' },
      { header: t("inventory.excel.unit"), key: 'unit' },
      { header: t("common.status"), key: 'statusLabel' },
    ], 'mahsulotlar.xlsx');
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setIsUpdatingStatus(id);
    const supabase = createClient() as any;
    const { error } = await supabase
      .from("products")
      .update({ is_active: !currentStatus })
      .eq("id", id);
    if (error) {
      toast.error(errorMessage(t, error, t("common.error")));
    } else {
      toast.success(t("common.success"));
      await invalidateProducts();
    }
    setIsUpdatingStatus(null);
  };

  // No client-side filtering or slicing: `products` IS the current page.
  const paginated = products;
  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (product && product.stock > 0) {
      toast.error(t('inventory.cannotDeleteWithStock'));
      return;
    }
    if (!(await confirmDelete({ name: product?.name }))) return;
    
    setIsDeleting(id);
    const supabase = createClient() as any;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        const { error: updateError } = await supabase
          .from("products")
          .update({ is_active: false })
          .eq("id", id);
        
        if (updateError) {
          toast.error(t("common.error"));
        } else {
          toast.success(t("inventory.productDeactivatedInsteadOfDeleted"));
          await invalidateProducts();
        }
      } else {
        toast.error(errorMessage(t, error, t("common.error")));
      }
    } else {
      toast.success(t("common.success"));
      await invalidateProducts();
    }
    setIsDeleting(null);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const XLSX = await import('xlsx')
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error(t("common.error"));
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("common.error"));
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        // `type: 'array'` over an ArrayBuffer, not the deprecated
        // `readAsBinaryString` — see readExcelFile in lib/excel-io.ts.
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error(t("common.error"));
          return;
        }

        const supabase = createClient();
        const parseNumber = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const cleaned = String(val)
            .replace(/so'm|сум|sum|usd|\$|\s/gi, '')
            .replace(/,/g, '');
          const num = Number(cleaned);
          return isNaN(num) ? 0 : num;
        };

        // Map Excel columns to products table columns (supporting multi-language headers)
        const systemUnits = await getMeasurementUnits(supabase);
        const invalidUnitRows: { name: string; unit: string }[] = [];

        const newProducts = data
          .map((row: any) => {
            const cells = normaliseHeaders(row);
            const name = String(cell(cells, HEADER_ALIASES.name) ?? "");

            const lowerName = String(name).toLowerCase().trim();
            if (!name || lowerName === "jami" || lowerName === "jami:" || lowerName === "total" || lowerName === "итого" || lowerName === "итого:") {
              return null;
            }

            const sku =
              String(cell(cells, HEADER_ALIASES.sku) ?? "").trim() ||
              `SKU-${Math.random().toString().slice(-6)}`;
            const price = parseNumber(cell(cells, HEADER_ALIASES.price) ?? 0);
            const cost_price = parseNumber(cell(cells, HEADER_ALIASES.costPrice) ?? 0);
            const incoming_cost = parseNumber(
              cell(cells, HEADER_ALIASES.incomingCost) ?? cost_price,
            );
            const stock = parseNumber(cell(cells, HEADER_ALIASES.stock) ?? 0);
            const min_stock = parseNumber(cell(cells, HEADER_ALIASES.minStock) ?? 0);
            const rawUnit = String(cell(cells, HEADER_ALIASES.unit) ?? "").trim();
            const unit = rawUnit ? resolveMeasurementUnit(rawUnit, systemUnits) : null;
            if (!unit) {
              invalidUnitRows.push({ name: String(name), unit: rawUnit });
              return null;
            }
            const description = String(cell(cells, HEADER_ALIASES.description) ?? "");

            return {
              name,
              sku,
              price,
              cost_price,
              incoming_cost,
              stock,
              min_stock,
              unit,
              description,
              is_active: true,
            };
          })
          .filter((p) => p !== null && p.name);

        // Unit of measurement must exactly match one of the system's configured units
        // (the same list shown in the product form's dropdown) — reject the whole
        // import rather than silently defaulting or importing a mismatched unit.
        if (invalidUnitRows.length > 0) {
          const rowList = invalidUnitRows
            .map((r) => `${r.name} ("${r.unit || t("inventory.excel.emptyUnit")}")`)
            .join(', ');
          toast.error(
            t("inventory.excel.unitMismatch", { rows: rowList, units: systemUnits.join(', ') }),
            { duration: 8000 }
          );
          return;
        }

        if (newProducts.length === 0) {
          toast.error(t("inventory.noValidProducts"));
          return;
        }

        toast.loading(t("inventory.importingData"));

        // What the rows the file is about to overwrite hold right now. Read
        // before the upsert, because after it the old stock is gone and the
        // movement below would have nothing to measure the change against.
        // RLS scopes this to the caller's own tenant, where the SKU is unique.
        const skus = newProducts.map((p) => p!.sku);
        // PostgREST reads are GET requests, so a few hundred SKUs in one `in`
        // list would outgrow the URL — read them a chunk at a time.
        const skuChunks: string[][] = [];
        for (let i = 0; i < skus.length; i += 200) skuChunks.push(skus.slice(i, i + 200));
        const [existingChunks, { data: tenant }, { data: { session } }] = await Promise.all([
          Promise.all(
            skuChunks.map((chunk) =>
              supabase.from("products").select("sku, stock").in("sku", chunk),
            ),
          ),
          supabase.from("tenants").select("costing_method").limit(1).single(),
          supabase.auth.getSession(),
        ]);
        const stockBySku = new Map<string, number>(
          existingChunks
            .flatMap(({ data }: any) => data || [])
            .map((p: any) => [String(p.sku), Number(p.stock) || 0]),
        );

        // SKUs are unique per tenant (products_tenant_sku_key), not globally —
        // a bare 'sku' target matches no constraint and Postgres rejects the
        // upsert. tenant_id isn't in the payload: the set_tenant_id() BEFORE
        // INSERT trigger fills it in before the conflict check runs.
        const { data: saved, error } = await supabase
          .from("products")
          .upsert(newProducts as any, { onConflict: 'tenant_id,sku' })
          .select("id, sku, stock, cost_price");

        toast.dismiss();
        if (error) {
          toast.error(errorMessage(t, error, t("common.error")));
        } else {
          await recordImportStockMovements(
            supabase,
            saved || [],
            stockBySku,
            getEffectiveCostingMethod(tenant),
            session?.user?.id ?? null,
          );
          toast.success(t("inventory.productsImported", { count: newProducts.length }));
          await invalidateProducts();
          await invalidateMovements();
        }
      } catch {
        toast.dismiss();
        toast.error(t("inventory.excelReadError"));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };


  /** The row's actions menu, shared by the desktop table row and the phone card. */
  const renderActions = (product: any) => !(canEdit || canDelete) ? null : (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent side="left">
                  <p>{t("common.actions")}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-40">
                {canEdit && (
                  <DropdownMenuItem
                  render={
                    <Link
                      href={`/${lang}/inventory/products/${product.id}/edit`}
                      prefetch={true}
                    />
                  }
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" /> {t("common.edit")}
                </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                  onClick={() => handleToggleStatus(product.id, product.is_active)}
                  disabled={isUpdatingStatus === product.id}
                >
                  <Power className="mr-2 h-3.5 w-3.5" />{" "}
                  {product.is_active ? t("common.inactive") : t("common.active")}
                </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                  onClick={() => handleDelete(product.id)}
                  disabled={isDeleting === product.id}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("common.delete")}
                </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
  );

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm max-md:overflow-visible max-md:bg-transparent max-md:shadow-none">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 max-md:border-0 max-md:px-0 max-md:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <TableSearch />
              <TableFilterChips
                param="status"
                value={status}
                options={[
                  { value: 'all', label: t('common.all') },
                  { value: 'active', label: t('common.active') },
                  { value: 'inactive', label: t('common.inactive') },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canExport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportProducts}
                disabled={products.length === 0}
                className="h-9 gap-2 max-md:w-9 max-md:px-0 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-xs rounded-lg"
              >
                <Download className="h-4 w-4" />
                <span className="max-md:sr-only">{t("common.export", { fallback: "Eksport" })}</span>
              </Button>
              )}
              {canCreate && (
              <>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
                className="hidden"
                id="excel-upload-input"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 max-md:w-9 max-md:px-0 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors font-medium text-xs rounded-lg animate-pulse"
                    />
                  }
                >
                  <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="max-md:sr-only">{t("inventory.importExcel")}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 rounded-lg shadow-md border p-1">
                  <DropdownMenuItem
                    onClick={() => document.getElementById("excel-upload-input")?.click()}
                    className="cursor-pointer flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 rounded"
                  >
                    <Upload className="h-4 w-4 text-slate-500" />
                    {t("inventory.uploadExcelFile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={downloadExcelTemplate}
                    className="cursor-pointer flex items-center gap-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 focus:text-emerald-800 dark:focus:text-emerald-300 rounded font-medium"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    {t("inventory.downloadTemplateAction")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => setIsScanModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 max-md:w-9 max-md:px-0 border-violet-200 dark:border-violet-900/50 text-violet-700 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30 hover:bg-violet-100/70 dark:hover:bg-violet-950/50 hover:text-violet-800 dark:hover:text-violet-300 transition-colors font-medium text-xs rounded-lg cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <span className="max-md:sr-only">{t("inventory.importAI")}</span>
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>{t("inventory.aiScanner.tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <Table containerClassName="max-md:hidden">
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10 font-semibold text-center">#</TableHead>
                <TableHead className="font-semibold">
                  {t("inventory.productName")}
                </TableHead>
                <TableHead className="hidden md:table-cell">{t("inventory.sku")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("inventory.category")}</TableHead>
                <TableHead className="hidden md:table-cell text-right tabular-nums">{t("inventory.costPrice")}</TableHead>
                <TableHead className="hidden lg:table-cell text-right tabular-nums">
                  {t("inventory.incomingCost")}
                </TableHead>
                <TableHead className="text-right tabular-nums">{t("inventory.price")}</TableHead>
                <TableHead className="text-right tabular-nums">{t("inventory.stock")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{t("common.noData")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((product, index) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/inventory/products/${product.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {product.image_url ? (
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border dark:border-slate-800">
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            <Link
                              href={`/${lang}/inventory/products/${product.id}`}
                              className="text-slate-800 transition-colors hover:text-violet-600 dark:text-slate-200 dark:hover:text-violet-400"
                            >
                              {product.name}
                            </Link>
                          </p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-50">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        {product.sku}
                      </code>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{product.categories?.name ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-right font-medium tabular-nums">
                      {formatCurrency(product.cost_price)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                      {formatCurrency(product.incoming_cost || 0)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                      {formatCurrency(product.price)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <span
                        className={
                          product.stock <= product.min_stock
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-slate-700 dark:text-slate-300"
                        }
                      >
                        {formatNumber(product.stock)} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={product.is_active ? "emerald" : "slate"}
                        label={product.is_active ? t("common.active") : t("common.inactive")}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {renderActions(product)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Phones: the same rows as cards (shared/mobile-list.tsx). */}
          <MobileCardList
            isEmpty={paginated.length === 0}
            empty={
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Package className="h-8 w-8 opacity-40" />
                <p className="text-sm">{t("common.noData")}</p>
              </div>
            }
          >
            {paginated.map((product) => {
              const out = product.stock <= 0;
              const low = !out && product.stock <= product.min_stock;
              const stockTone = out ? "bad" : low ? "warn" : "good";
              return (
                <MobileCard
                  key={product.id}
                  onClick={() => router.push(`/${lang}/inventory/products/${product.id}`)}
                  leading={<MobileThumb src={product.image_url} alt={product.name} fallback={<Package />} />}
                  eyebrow={
                    <>
                      <MobileChip>{product.sku}</MobileChip>
                      {product.categories?.name && <span className="truncate">{product.categories.name}</span>}
                    </>
                  }
                  title={product.name}
                  status={
                    !product.is_active ? (
                      <StatusBadge tone="slate" label={t("common.inactive")} />
                    ) : (
                      <StatusBadge
                        tone={out ? "rose" : low ? "amber" : "emerald"}
                        label={out ? t("inventory.outOfStock") : low ? t("inventory.stockLow") : t("inventory.inStock")}
                      />
                    )
                  }
                  menu={renderActions(product)}
                  stats={[
                    { label: t("inventory.price"), value: formatCurrency(product.price), tone: "brand" },
                    { label: t("inventory.costPrice"), value: formatCurrency(product.cost_price) },
                    { label: t("inventory.stock"), value: `${formatNumber(product.stock)} ${product.unit}`, tone: stockTone },
                  ]}
                />
              );
            })}
          </MobileCardList>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
        </CardContent>
      </Card>
      <AIStockScannerModal
        open={isScanModalOpen}
        onOpenChange={setIsScanModalOpen}
        lang={lang}
      />
      {confirmDialog}
    </TooltipProvider>
  );
}
