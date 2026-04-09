import { useMemo } from "react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react";

const STATUS_MAP = {
  paid: { label: "To'langan", color: "bg-emerald-100 text-emerald-700" },
  completed: { label: "To'langan", color: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Kutilmoqda", color: "bg-amber-100 text-amber-700" },
  draft: { label: "Kutilmoqda", color: "bg-amber-100 text-amber-700" },
  overdue: { label: "Muddati o'tgan", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Bekor qilingan", color: "bg-slate-100 text-slate-500" },
};

export default function RecentTransactions({ financialTransactions, customerInvoices }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const transactions = useMemo(() => {
    const all = [
      ...(financialTransactions || []).map((tx) => ({
        id: tx.id,
        name: tx.description || tx.category || "Tranzaksiya",
        type: tx.transaction_type,
        amount: tx.amount || 0,
        status: tx.status || (tx.transaction_type === "income" ? "paid" : "completed"),
        date: tx.date,
      })),
      ...(customerInvoices || []).map((inv) => ({
        id: inv.id,
        name: inv.customer_name || inv.description || "Hisob-faktura",
        type: "income",
        amount: inv.total_amount || inv.amount || 0,
        status: inv.status || "pending",
        date: inv.date || inv.invoice_date,
      })),
    ];

    // Check for overdue
    const now = new Date();
    return all
      .map((tx) => {
        if (
          tx.status === "pending" &&
          tx.date &&
          new Date(tx.date) < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        ) {
          return { ...tx, status: "overdue" };
        }
        return tx;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 8);
  }, [financialTransactions, customerInvoices]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          So'nggi tranzaksiyalar
        </h3>
      </div>

      {transactions.length > 0 ? (
        <div className="space-y-1.5">
          {transactions.map((tx, i) => {
            const statusInfo = STATUS_MAP[tx.status] || STATUS_MAP.pending;
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
                  className={`text-sm font-semibold ${
                    isIncome ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusInfo.color}`}
                >
                  {statusInfo.label}
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
