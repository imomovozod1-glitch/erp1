"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useConfirmDelete } from "@/components/shared/confirm-dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, Power, Download, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { invalidateProducts } from "@/lib/data/revalidate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { formatCurrency } from "@/lib/utils";
import { exportRowsToExcel } from "@/lib/excel-io";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { TableSearch, TablePagination, TableFilterChips } from "@/components/shared/table-pagination";

interface ServicesTableProps {
  /** Only the current page's rows — the server already applied search/filter/paging. */
  services: any[];
  lang: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status: 'all' | 'active' | 'inactive';
}

/**
 * Ombor > Xizmatlar. The products table without the columns and tools a
 * service has no use for: stock, minimum stock, incoming cost, the product
 * image, the Excel import and the AI stock scanner — all of which are about
 * counting things on a shelf. What is left is the same catalogue row: name,
 * code, category, cost, price, margin, who is responsible, and the status.
 *
 * Deleting is simpler than for a product too: there is no stock to block it,
 * only the foreign key from any sale the service already appears on.
 */
export function ServicesTable({
  services,
  lang,
  page,
  pageSize,
  total,
  totalPages,
  status,
}: ServicesTableProps) {
  const t = useTranslations();
  const [confirmDelete, confirmDialog] = useConfirmDelete();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const handleExport = async () => {
    const rows = services.map((s: any) => ({
      ...s,
      categoryName: s.categories?.name || '',
      statusLabel: s.is_active
        ? (lang === 'uz' ? 'Faol' : lang === 'ru' ? 'Активен' : 'Active')
        : (lang === 'uz' ? 'Nofaol' : lang === 'ru' ? 'Неактивен' : 'Inactive'),
    }));
    await exportRowsToExcel(rows, [
      { header: 'Nomi', key: 'name' },
      { header: 'Kodi', key: 'sku' },
      { header: 'Kategoriya', key: 'categoryName' },
      { header: 'Tannarx', key: 'cost_price' },
      { header: 'Narxi', key: 'price' },
      { header: "O'lchov birligi", key: 'unit' },
      { header: 'Holat', key: 'statusLabel' },
    ], 'xizmatlar.xlsx');
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
    }
    setIsUpdatingStatus(null);
  };

  const handleDelete = async (id: string) => {
    const service = services.find((s) => s.id === id);
    if (!(await confirmDelete({ name: service?.name }))) return;

    setIsDeleting(id);
    const supabase = createClient() as any;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        // Already sold at least once — the sale must keep pointing at it, so
        // the row is archived instead of removed.
        const { error: updateError } = await supabase
          .from("products")
          .update({ is_active: false })
          .eq("id", id);
        if (updateError) {
          toast.error(t("common.error"));
        } else {
          toast.success(t("inventory.serviceDeactivatedInsteadOfDeleted"));
          await invalidateProducts();
        }
      } else {
        toast.error(error.message || t("common.error"));
      }
    } else {
      toast.success(t("common.success"));
      await invalidateProducts();
    }
    setIsDeleting(null);
  };

  // No client-side filtering or slicing: `services` IS the current page.
  const paginated = services;

  return (
    <TooltipProvider>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
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
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={services.length === 0}
                className="h-9 gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-xs rounded-lg"
              >
                <Download className="h-4 w-4" />
                {t("common.export")}
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableHead className="w-10 font-semibold text-center">#</TableHead>
                <TableHead className="font-semibold">{t("inventory.serviceName")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("inventory.serviceCode")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("inventory.category")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("inventory.unit")}</TableHead>
                <TableHead className="text-right tabular-nums">{t("inventory.costPrice")}</TableHead>
                <TableHead className="text-right tabular-nums">{t("inventory.price")}</TableHead>
                <TableHead className="hidden lg:table-cell text-right tabular-nums">{t("inventory.margin")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("common.assignedTo")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Wrench className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{t("common.noData")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((service, index) => {
                  const price = Number(service.price) || 0;
                  const cost = Number(service.cost_price) || 0;
                  const margin = price > 0 ? ((price - cost) / price) * 100 : null;
                  const editHref = `/${lang}/inventory/services/${service.id}/edit`;
                  return (
                    <TableRow
                      key={service.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                      // A service has no stock history, cost layers or movements,
                      // so there is no detail page worth opening — the row goes
                      // straight to the card itself.
                      onClick={() => router.push(editHref)}
                    >
                      <TableCell className="text-center font-medium text-slate-500 dark:text-slate-400 text-xs">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                     
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              <Link
                                href={editHref}
                                className="text-slate-800 transition-colors hover:text-violet-600 dark:text-slate-200 dark:hover:text-violet-400"
                              >
                                {service.name}
                              </Link>
                            </p>
                            {service.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-50">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                          {service.sku}
                        </code>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{service.categories?.name ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{service.unit}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(cost)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                        {formatCurrency(price)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {margin === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              margin >= 0
                                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                : "text-rose-600 dark:text-rose-400 font-semibold"
                            }
                          >
                            {margin.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {service.assignee?.full_name || t("common.unassigned")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={service.is_active ? "emerald" : "slate"}
                          label={service.is_active ? t("common.active") : t("common.inactive")}
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
                            <DropdownMenuItem render={<Link href={editHref} prefetch={true} />}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(service.id, service.is_active)}
                              disabled={isUpdatingStatus === service.id}
                            >
                              <Power className="mr-2 h-3.5 w-3.5" />{" "}
                              {service.is_active ? t("common.inactive") : t("common.active")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(service.id)}
                              disabled={isDeleting === service.id}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
        </CardContent>
      </Card>
      {confirmDialog}
    </TooltipProvider>
  );
}
