"use client";

import { useState } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { invalidateProducts } from "@/lib/data/revalidate";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import * as XLSX from "xlsx";
import React from "react";

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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

  return (
    <>
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
              <Button
                onClick={() => setIsScanModalOpen(true)}
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70 hover:text-indigo-800 transition-colors font-medium text-xs rounded-lg"
              >
                <Sparkles className="h-4 w-4 text-indigo-600" />
                {t("inventory.importAI")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {filtered.length} {t("common.rows")}
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
                filtered.map((product, index) => (
                  <React.Fragment key={product.id}>
                    <TableRow
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedRow === product.id ? 'bg-slate-50/80' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}
                    >
                      <TableCell className="text-center font-medium text-slate-500 text-xs">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expandedRow === product.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          <div>
                            <p className="font-medium text-slate-800">
                              {product.name}
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
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {product.categories?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-slate-600">
                          {formatCurrency(product.cost_price)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-slate-600">
                          {formatCurrency(product.incoming_cost || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(product.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-sm font-semibold ${
                            product.stock === 0
                              ? "text-red-600"
                              : product.stock <= product.min_stock
                                ? "text-orange-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {formatNumber(product.stock)} {product.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={product.is_active ? "default" : "secondary"}
                          className={
                            product.is_active
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : ""
                          }
                        >
                          {product.is_active ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
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
                    {expandedRow === product.id && (
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableCell colSpan={10} className="p-0 border-b-2 border-indigo-100">
                          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800">{t("inventory.productName")}</h4>
                              <p className="text-sm text-slate-600">{product.name}</p>
                              
                              <h4 className="text-sm font-semibold text-slate-800 mt-4">{t("inventory.sku")}</h4>
                              <p className="text-sm text-slate-600 font-mono bg-white inline-block px-2 py-1 rounded border">{product.sku}</p>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800">{t("inventory.costPrice")}</h4>
                              <p className="text-sm text-slate-600">{formatCurrency(product.cost_price)}</p>
                              
                              <h4 className="text-sm font-semibold text-slate-800 mt-4">{t("inventory.price")}</h4>
                              <p className="text-sm text-slate-600 font-bold text-indigo-600">{formatCurrency(product.price)}</p>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800">{t("inventory.stock")}</h4>
                              <p className="text-sm text-slate-600">{formatNumber(product.stock)} {product.unit}</p>
                              
                              <h4 className="text-sm font-semibold text-slate-800 mt-4">{t("inventory.minStock", { fallback: 'Minimal zaxira' })}</h4>
                              <p className="text-sm text-slate-600">{formatNumber(product.min_stock)} {product.unit}</p>
                            </div>
                            
                            {product.description && (
                              <div className="col-span-1 md:col-span-3 mt-2 pt-4 border-t border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-800 mb-1">{t("common.description")}</h4>
                                <p className="text-sm text-slate-600">{product.description}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AIStockScannerModal
        open={isScanModalOpen}
        onOpenChange={setIsScanModalOpen}
      />
    </>
  );
}
