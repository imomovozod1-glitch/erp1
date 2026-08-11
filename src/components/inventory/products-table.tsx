"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Package,
  Sparkles,
  Upload,
  Power,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { invalidateProducts } from "@/lib/data/revalidate";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import * as XLSX from "xlsx";
import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface ProductsTableProps {
  products: any[];
  lang: string;
}

export function ProductsTable({ products, lang }: ProductsTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [search, statusFilter]);

 
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        "Nomi": "Mahsulot A",
        "SKU": "SKU-000001",
        "Sotuv narxi": 15000,
        "Tannarx": 10000,
        "Kirim narxi": 9500,
        "Zaxira": 100,
        "Minimal zaxira": 10,
        "O'lchov birligi": "dona",
        "Tavsif": "Namuna mahsulot tavsifi"
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, "mahsulotlar_shablon.xlsx");
  };

  const handleExportProducts = () => {
    const rows = products.map((p: any) => ({
      ...p,
      categoryName: p.categories?.name || '',
      statusLabel: p.is_active
        ? (lang === 'uz' ? 'Faol' : lang === 'ru' ? 'Активен' : 'Active')
        : (lang === 'uz' ? 'Nofaol' : lang === 'ru' ? 'Неактивен' : 'Inactive'),
    }));
    exportRowsToExcel(rows, [
      { header: 'Nomi', key: 'name' },
      { header: 'SKU', key: 'sku' },
      { header: 'Kategoriya', key: 'categoryName' },
      { header: 'Sotuv narxi', key: 'price' },
      { header: 'Tannarx', key: 'cost_price' },
      { header: 'Zaxira', key: 'stock' },
      { header: 'Minimal zaxira', key: 'min_stock' },
      { header: "O'lchov birligi", key: 'unit' },
      { header: 'Holat', key: 'statusLabel' },
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
      toast.error(error.message || t("common.error"));
    } else {
      toast.success(t("common.success"));
      await invalidateProducts();
      router.refresh();
    }
    setIsUpdatingStatus(null);
  };

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? p.is_active : !p.is_active;
    return matchesSearch && matchesStatus;
  });
 const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (product && product.stock > 0) {
      toast.error(lang === 'uz' ? 'Zahirasi mavjud mahsulotlarni o\'chirib bo\'lmaydi' : 'Cannot delete products with stock');
      return;
    }
    
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
          router.refresh();
        }
      } else {
        toast.error(error.message || t("common.error"));
      }
    } else {
      toast.success(t("common.success"));
      await invalidateProducts();
      router.refresh();
    }
    setIsDeleting(null);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
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
        const newProducts = data
          .map((row: any) => {
            const name =
              row.Nomi || row.name || row.Name || row["Наименование"] || "";
            
            const lowerName = String(name).toLowerCase().trim();
            if (!name || lowerName === "jami" || lowerName === "jami:" || lowerName === "total" || lowerName === "итого" || lowerName === "итого:") {
              return null;
            }

            const sku =
              row.SKU ||
              row.sku ||
              row.Artikul ||
              row["Артикул"] ||
              `SKU-${Math.random().toString().slice(-6)}`;
            const price = parseNumber(
              row["Sotuv narxi"] ||
                row["Chiqim"] ||
                row.price ||
                row.Price ||
                row["Цена продажи"] ||
                0,
            );
            const cost_price = parseNumber(
              row["Tannarx"] ||
                row["Cost"] ||
                row.cost_price ||
                row.cost ||
                row["Себестоимость"] ||
                0,
            );
            const incoming_cost = parseNumber(
              row["Kirim narxi"] ||
                row["Kirim cost"] ||
                row.incoming_cost ||
                row["Входящая цена"] ||
                cost_price,
            );
            const stock = parseNumber(
              row["Zaxira"] || row.stock || row.Stock || row["Запас"] || 0,
            );
            const min_stock = parseNumber(
              row["Minimal zaxira"] || row.min_stock || row["Мин. запас"] || 0,
            );
            const unit =
              row["O'lchov birligi"] ||
              row.unit ||
              row.Unit ||
              row["Ед. изм."] ||
              "dona";
            const description =
              row.Tavsif ||
              row.description ||
              row.Description ||
              row["Описание"] ||
              "";

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

        if (newProducts.length === 0) {
          toast.error(t("inventory.noValidProducts"));
          return;
        }

        toast.loading(t("inventory.importingData"));
        const { error } = await supabase
          .from("products")
          .upsert(newProducts as any, { onConflict: 'sku' });

        toast.dismiss();
        if (error) {
          toast.error(`${t("common.error")}: ${error.message}`);
        } else {
          toast.success(t("inventory.productsImported", { count: newProducts.length }));
          await invalidateProducts();
          router.refresh();
        }
      } catch (err: any) {
        toast.dismiss();
        toast.error(`${t("inventory.excelReadError")}: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const startItem = filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, filtered.length);

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t("common.search")}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border shadow-inner">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t("common.all", { fallback: "Barchasi" })}
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t("common.active", { fallback: "Faol" })}
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === 'inactive' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t("common.inactive", { fallback: "Nofaol" })}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportProducts}
                disabled={products.length === 0}
                className="h-9 gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-lg"
              >
                <Download className="h-4 w-4" />
                {t("common.export", { fallback: "Eksport" })}
              </Button>
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
                      className="h-9 gap-2 border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 hover:text-emerald-800 transition-colors font-medium text-xs rounded-lg animate-pulse"
                    />
                  }
                >
                  <Upload className="h-4 w-4 text-emerald-600" />
                  {t("inventory.importExcel")}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white rounded-lg shadow-md border p-1">
                  <DropdownMenuItem
                    onClick={() => document.getElementById("excel-upload-input")?.click()}
                    className="cursor-pointer flex items-center gap-2 text-slate-700 hover:bg-slate-50 focus:bg-slate-50 rounded"
                  >
                    <Upload className="h-4 w-4 text-slate-500" />
                    Faylni tanlash (Yuklash)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={downloadExcelTemplate}
                    className="cursor-pointer flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50 focus:text-emerald-800 rounded font-medium"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    Shablonni yuklab olish
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => setIsScanModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70 hover:text-indigo-800 transition-colors font-medium text-xs rounded-lg cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      {t("inventory.importAI")}
                    </Button>
                  }
                />
                <TooltipContent>
                  <p>{lang === 'uz' ? 'AI orqali chek/fakturani skanerlash' : lang === 'ru' ? 'Сканировать чек/фактуру с помощью ИИ' : 'Scan receipt/invoice using AI'}</p>
                </TooltipContent>
              </Tooltip>
              <span className="text-xs text-muted-foreground font-medium">
                {lang === 'uz' ? `${filtered.length} tadan ${startItem}-${endItem} ko'rsatilmoqda` : lang === 'ru' ? `Показано ${startItem}-${endItem} из ${filtered.length}` : `Showing ${startItem}-${endItem} of ${filtered.length}`}
              </span>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-10 font-semibold text-center">#</TableHead>
                <TableHead className="font-semibold">
                  {t("inventory.productName")}
                </TableHead>
                <TableHead>{t("inventory.sku")}</TableHead>
                <TableHead>{t("inventory.category")}</TableHead>
                <TableHead className="text-right">{t("inventory.costPrice")}</TableHead>
                <TableHead className="text-right">
                  {t("inventory.incomingCost")}
                </TableHead>
                <TableHead className="text-right">{t("inventory.price")}</TableHead>
                <TableHead className="text-right">{t("inventory.stock")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
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
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => router.push(`/${lang}/inventory/products/${product.id}`)}
                  >
                    <TableCell className="text-center font-medium text-slate-500 text-xs">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">
                            <Link
                              href={`/${lang}/inventory/products/${product.id}`}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-colors"
                            >
                              {product.name}
                            </Link>
                          </p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        {product.sku}
                      </code>
                    </TableCell>
                    <TableCell>{product.categories?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.cost_price)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-600">
                      {formatCurrency(product.incoming_cost || 0)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-indigo-600">
                      {formatCurrency(product.price)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span
                        className={
                          product.stock <= product.min_stock
                            ? "text-rose-600 font-bold"
                            : "text-slate-700"
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
                            <p>{lang === 'uz' ? 'Harakatlar' : lang === 'ru' ? 'Действия' : 'Actions'}</p>
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-40">
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
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(product.id, product.is_active)}
                            disabled={isUpdatingStatus === product.id}
                          >
                            <Power className="mr-2 h-3.5 w-3.5" />{" "}
                            {product.is_active ? t("common.inactive") : t("common.active")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="cursor-pointer"
              >
                {lang === 'uz' ? 'Orqaga' : lang === 'ru' ? 'Назад' : 'Previous'}
              </Button>
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="cursor-pointer"
              >
                {lang === 'uz' ? 'Oldinga' : lang === 'ru' ? 'Вперед' : 'Next'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <AIStockScannerModal
        open={isScanModalOpen}
        onOpenChange={setIsScanModalOpen}
        lang={lang}
      />
    </TooltipProvider>
  );
}
