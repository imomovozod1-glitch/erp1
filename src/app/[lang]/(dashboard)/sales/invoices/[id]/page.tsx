"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { PageClock } from "@/components/shared/page-clock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  User,
  Calendar,
  ArrowLeft,
  Pencil,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200/50",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  overdue: "bg-amber-50 text-amber-700 border-amber-200/50",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200/50",
};

export default function InvoiceDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const lang = params.lang;
  const id = params.id;

  const t = useTranslations("sales");
  const tCommon = useTranslations("common");

  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fetchInvoiceDetails = async () => {
    try {
      const supabase = createClient() as any;
      const { data: invoiceData, error: invoiceErr } = await supabase
        .from("invoices")
        .select("*, customers(name), sales_orders(order_number)")
        .eq("id", id)
        .single();

      if (invoiceErr) throw invoiceErr;

      setInvoice(invoiceData);

      if (invoiceData.order_id) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from("sales_order_items")
          .select("*, products(name)")
          .eq("order_id", invoiceData.order_id);

        if (!itemsErr) {
          setItems(itemsData || []);
        }
      }
    } catch (err: any) {
      toast.error(err.message || tCommon("error"));
      router.push(`/${lang}/sales/invoices`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoiceDetails();
    }
  }, [id, lang, router]);

  const handleAcceptPayment = async () => {
    if (!invoice) return;
    setIsProcessingPayment(true);
    try {
      const supabase = createClient() as any;
      const { error } = await supabase
        .from("invoices")
        .update({
          paid_amount: invoice.total_amount,
          status: "paid",
          paid_at: new Date().toISOString().split("T")[0],
        })
        .eq("id", invoice.id);

      if (error) throw error;

      // Also record an income transaction in finance logs
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        const amountToPay =
          Number(invoice.total_amount) - Number(invoice.paid_amount);
        if (amountToPay > 0) {
          await supabase.from("transactions").insert([
            {
              type: "income",
              amount: amountToPay,
              category: "sales",
              description: `INV-${invoice.invoice_number} uchun tezkor to'lov`,
              reference_type: "invoice",
              reference_id: invoice.id,
              created_by: userId,
            },
          ]);
        }
      }

      toast.success(tCommon("success"));
      await fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || tCommon("error"));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!invoice) return null;

  const isUnpaid = invoice.status !== "paid" && invoice.status !== "cancelled";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
      <PageHeader
        title={`${t("invoices")}: ${invoice.invoice_number}`}
        breadcrumbs={[
          { label: "ERP", href: `/${lang}/dashboard` },
          { label: t("invoices"), href: `/${lang}/sales/invoices` },
          { label: invoice.invoice_number },
        ]}
      >
        <PageClock lang={lang} />
      </PageHeader>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => router.push(`/${lang}/sales/invoices`)}
            className="w-full md:w-auto h-9 gap-2 text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            {tCommon("back")}
          </Button>
          <Button
            onClick={() =>
              router.push(`/${lang}/sales/invoices/${invoice.id}/edit`)
            }
            className="w-full md:w-auto h-9 gap-2 text-xs text-indigo-700 bg-indigo-50 border-indigo-100 hover:bg-indigo-100"
          >
            <Pencil className="h-4 w-4" />
            {tCommon("edit")}
          </Button>
        </div>

        {isUnpaid && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              onClick={() =>
                router.push(
                  `/${lang}/finance/cashbox?action=kirim&type=debt_collection&customerId=${invoice.customer_id}`,
                )
              }
              className="w-full md:w-auto h-9 text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70"
            >
              {lang === "uz" ? "Kassa orqali to'lash" : "Оплатить через кассу"}
            </Button>
            <Button
              disabled={isProcessingPayment}
              onClick={handleAcceptPayment}
              className="w-full md:w-auto h-9 gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {isProcessingPayment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {lang === "uz"
                ? "To'lovni qabul qilish (Tezkor)"
                : "Принять оплату (Быстро)"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column - Info card */}
        <Card className="md:col-span-1 border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center gap-3 bg-slate-50/50">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">
                {lang === "uz" ? "Faktura ma'lumotlari" : "Информация о счете"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {t("customer")}
              </span>
              <p className="font-semibold text-slate-850">
                {invoice.customers?.name ?? "—"}
              </p>
            </div>
            {invoice.sales_orders?.order_number && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {lang === "uz" ? "Bog'langan buyurtma" : "Связанный заказ"}
                </span>
                <p
                  className="font-semibold text-indigo-650 hover:underline cursor-pointer"
                  onClick={() =>
                    router.push(`/${lang}/sales/orders/${invoice.order_id}`)
                  }
                >
                  {invoice.sales_orders.order_number}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === "uz" ? "Yaratilgan sana" : "Дата выставления"}
              </span>
              <p className="font-semibold text-slate-850">
                {formatDate(invoice.issued_at)}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === "uz" ? "To'lov muddati" : "Срок оплаты"}
              </span>
              <p className="font-semibold text-slate-850">
                {formatDate(invoice.due_at)}
              </p>
            </div>
            {invoice.paid_at && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {lang === "uz" ? "To'langan sana" : "Дата оплаты"}
                </span>
                <p className="font-semibold text-emerald-705">
                  {formatDate(invoice.paid_at)}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tCommon("status")}
              </span>
              <div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[invoice.status] ?? "bg-slate-50 text-slate-600"}`}
                >
                  {t(`status.${invoice.status}`)}
                </span>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-655">
                <span>{lang === "uz" ? "Jami summa:" : "Итоговая сумма:"}</span>
                <span className="font-bold text-slate-850">
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-655">
                <span>
                  {lang === "uz" ? "To'langan summa:" : "Оплаченная сумма:"}
                </span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(invoice.paid_amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-655 border-t pt-1">
                <span>{lang === "uz" ? "Qoldiq:" : "Остаток:"}</span>
                <span
                  className={`font-black ${isUnpaid ? "text-rose-600" : "text-slate-850"}`}
                >
                  {formatCurrency(
                    Number(invoice.total_amount) - Number(invoice.paid_amount),
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column - Items list */}
        <Card className="md:col-span-2 border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800">
              {t("items")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                {lang === "uz"
                  ? "Ushbu fakturaga bog'liq mahsulotlar topilmadi"
                  : "Товары для этого счета не найдены"}
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="font-bold text-slate-400 h-10">
                        {t("productName")}
                      </TableHead>
                      <TableHead className="font-bold text-slate-400 h-10 text-right">
                        {t("quantity")}
                      </TableHead>
                      <TableHead className="font-bold text-slate-400 h-10 text-right">
                        {t("unitPrice")}
                      </TableHead>
                      <TableHead className="font-bold text-slate-400 h-10 text-right">
                        {t("totalPrice")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/40">
                        <TableCell className="font-medium text-slate-800">
                          {item.products?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-slate-700">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right text-slate-700">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatCurrency(item.total_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
