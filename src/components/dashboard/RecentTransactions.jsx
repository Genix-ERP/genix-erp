import { useMemo } from "react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react";

const STATUS_COLORS = {
  paid: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  confirmed: "bg-blue-100 text-blue-700",
  partial: "bg-violet-100 text-violet-700",
  pending: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-500",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default function RecentTransactions({ financialTransactions, customerInvoices, vendorBills }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const transactions = useMemo(() => {
    const now = new Date();
    const all = [];

    // Customer invoices — income
    (customerInvoices || []).forEach((inv) => {
      const dueDate = new Date(inv.due_date);
      let status = inv.status || "pending";
      if (status === "pending" && dueDate < now) status = "overdue";

      all.push({
        id: inv.id,
        name: inv.customer_name || inv.partner_name || `Hisob-faktura #${inv.invoice_number || inv.id?.toString().slice(-6)}`,
        type: "income",
        amount: inv.total_amount || inv.amount || 0,
        status,
        date: inv.invoice_date || inv.date || inv.created_date,
      });
    });

    // Vendor bills — expense
    (vendorBills || []).forEach((bill) => {
      const dueDate = new Date(bill.due_date);
      let status = bill.status || "pending";
      if (status === "pending" && dueDate < now) status = "overdue";

      all.push({
        id: bill.id,
        name: bill.vendor_name || bill.partner_name || `${t("expense") || "Expense"} #${bill.invoice_number || bill.id?.toString().slice(-6)}`,
        type: "expense",
        amount: bill.total_amount || bill.amount || 0,
        status,
        date: bill.invoice_date || bill.date || bill.created_date,
      });
    });

    // Financial transactions
    (financialTransactions || []).forEach((tx) => {
      // Skip if already covered by invoices/bills
      if (all.some((a) => a.id === tx.id)) return;

      all.push({
        id: tx.id,
        name: tx.description || tx.category || (tx.transaction_type === "income" ? "Kirim" : "Chiqim"),
        type: tx.transaction_type,
        amount: tx.amount || 0,
        status: tx.status || (tx.transaction_type === "income" ? "paid" : "completed"),
        date: tx.date,
      });
    });

    return all
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 8);
  }, [financialTransactions, customerInvoices, vendorBills]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("recent_transactions") || "Recent Transactions"}
        </h3>
      </div>

      {transactions.length > 0 ? (
        <div className="space-y-1.5">
          {transactions.map((tx, i) => {
            const statusColor = STATUS_COLORS[tx.status] || STATUS_COLORS.pending;
            const isIncome = tx.type === "income";
            return (
              <div
                key={tx.id || i}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isIncome ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                  }`}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {tx.name}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    isIncome ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}
                >
                  {t(tx.status) || tx.status}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[200px] flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
            <Receipt className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">
            Tranzaksiyalar yo'q
          </p>
        </div>
      )}
    </div>
  );
}
