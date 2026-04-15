import { useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Package,
  Users,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

const TASK_ICONS = {
  sales: DollarSign,
  inventory: Package,
  hr: Users,
  finance: FileText,
  default: CheckCircle2,
};

export default function TodaysTasks({ salesOrders, inventory, employees, customerInvoices }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const tasks = useMemo(() => {
    const result = [];
    const now = new Date();

    // Pending orders to process
    const pendingOrders = (salesOrders || []).filter(
      (o) => o.status === "draft" || o.status === "pending"
    );
    if (pendingOrders.length > 0) {
      result.push({
        icon: "sales",
        title: `${pendingOrders.length} ${t("orders_need_approval") || "orders need approval"}`,
        time: t("today") || "Today",
        overdue: false,
        assignee: null,
      });
    }

    // Low stock items to reorder
    const lowStock = (inventory || []).filter(
      (item) => item.current_stock <= (item.reorder_level || 10)
    );
    if (lowStock.length > 0) {
      result.push({
        icon: "inventory",
        title: `${lowStock.length} ${t("products_need_reorder") || "products need reorder"}`,
        time: t("urgent") || "Urgent",
        overdue: true,
        assignee: null,
      });
    }

    // Overdue invoices
    const overdue = (customerInvoices || []).filter((inv) => {
      const due = new Date(inv.due_date);
      return due < now && inv.status !== "paid";
    });
    if (overdue.length > 0) {
      result.push({
        icon: "finance",
        title: `${overdue.length} ${t("unpaid_invoices") || "unpaid invoices"}`,
        time: t("overdue") || "Overdue",
        overdue: true,
        assignee: null,
      });
    }

    // Employee reviews / contracts expiring
    const expiringContracts = (employees || []).filter((emp) => {
      const end = new Date(emp.contract_end || emp.end_date || 0);
      const daysLeft = (end - now) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft < 30;
    });
    if (expiringContracts.length > 0) {
      result.push({
        icon: "hr",
        title: `${expiringContracts.length} ${t("contracts_expiring") || "contracts expiring"}`,
        time: t("within_30_days") || "Within 30 days",
        overdue: false,
        assignee: null,
      });
    }

    if (result.length === 0) {
      result.push({
        icon: "default",
        title: t("all_tasks_done") || "All tasks completed",
        time: t("today") || "Today",
        overdue: false,
        assignee: null,
      });
    }

    return result.slice(0, 5);
  }, [salesOrders, inventory, employees, customerInvoices, t]);

  return (
    <div className="glass-card rounded-2xl p-5 h-full transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {t("todays_tasks") || "Today's Tasks"}
        </h3>
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
          {tasks.length} ta
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task, i) => {
          const IconComp = TASK_ICONS[task.icon] || TASK_ICONS.default;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                task.overdue
                  ? "bg-red-50/60 border-red-100/60"
                  : "bg-slate-50/60 border-slate-100/50 hover:bg-slate-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  task.overdue ? "bg-red-100 text-red-600" : "bg-violet-50 text-violet-600"
                }`}
              >
                <IconComp className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${task.overdue ? "text-red-800" : "text-slate-800"}`}>
                  {task.title}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.overdue && <AlertCircle className="w-3 h-3 text-red-500" />}
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    task.overdue
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {task.time}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
