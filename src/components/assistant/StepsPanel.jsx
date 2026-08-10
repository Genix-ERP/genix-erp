import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, ShieldAlert, Zap, CheckCircle2, XCircle } from 'lucide-react';

// Jarayon paneli — the trust surface. Shows which tools the agent called, in
// plain language, each step expandable to its arguments. Silence is forbidden:
// every tool round-trip surfaces here.

const TOOL_LABELS = {
  find_contacts: { uz: 'Kontragentlarni qidiryapman', ru: 'Ищу контрагентов', en: 'Searching contacts' },
  find_products: { uz: 'Mahsulotlarni qidiryapman', ru: 'Ищу товары', en: 'Searching products' },
  check_stock: { uz: "Ombor qoldiqlarini o'qiyapman", ru: 'Читаю остатки', en: 'Checking stock' },
  low_stock_products: { uz: 'Kam zaxirani tekshiryapman', ru: 'Проверяю низкие остатки', en: 'Checking low stock' },
  inventory_valuation: { uz: 'Zaxira qiymatini hisoblayapman', ru: 'Оцениваю запасы', en: 'Valuing inventory' },
  stock_movements: { uz: "Ombor harakatlarini ko'ryapman", ru: 'Смотрю движения', en: 'Reading stock moves' },
  list_sales_orders: { uz: "Savdo buyurtmalarini o'qiyapman", ru: 'Читаю заказы', en: 'Reading sales orders' },
  list_sales_invoices: { uz: "Hisob-fakturalarni o'qiyapman", ru: 'Читаю счета', en: 'Reading invoices' },
  sales_summary: { uz: 'Savdo yig‘indisini hisoblayapman', ru: 'Считаю продажи', en: 'Summarising sales' },
  financial_summary: { uz: 'Moliyaviy holatni hisoblayapman', ru: 'Считаю финансы', en: 'Summarising finances' },
  business_overview: { uz: 'Umumiy holatni yig‘yapman', ru: 'Собираю обзор', en: 'Building overview' },
  list_bank_accounts: { uz: "Bank hisoblarini o'qiyapman", ru: 'Читаю счета банка', en: 'Reading bank accounts' },
  aged_receivables: { uz: 'Debitorlikni tekshiryapman', ru: 'Проверяю дебиторку', en: 'Checking receivables' },
  aged_payables: { uz: 'Kreditorlikni tekshiryapman', ru: 'Проверяю кредиторку', en: 'Checking payables' },
  tax_summary: { uz: 'Soliqlarni hisoblayapman', ru: 'Считаю налоги', en: 'Summarising taxes' },
  list_expenses: { uz: "Xarajatlarni o'qiyapman", ru: 'Читаю расходы', en: 'Reading expenses' },
  list_payments: { uz: "To'lovlarni o'qiyapman", ru: 'Читаю платежи', en: 'Reading payments' },
  list_journal_entries: { uz: "Jurnal yozuvlarini o'qiyapman", ru: 'Читаю проводки', en: 'Reading journal entries' },
  list_purchase_orders: { uz: "Xarid buyurtmalarini o'qiyapman", ru: 'Читаю закупки', en: 'Reading purchase orders' },
  list_purchase_requisitions: { uz: "Zayavkalarni o'qiyapman", ru: 'Читаю заявки', en: 'Reading requisitions' },
  supplier_prices: { uz: 'Yetkazuvchi narxlarini solishtiryapman', ru: 'Сравниваю цены', en: 'Comparing supplier prices' },
  list_leads: { uz: "Lidlarni o'qiyapman", ru: 'Читаю лиды', en: 'Reading leads' },
  crm_summary: { uz: 'Voronkani tahlil qilyapman', ru: 'Анализирую воронку', en: 'Analysing pipeline' },
  find_employees: { uz: 'Xodimlarni qidiryapman', ru: 'Ищу сотрудников', en: 'Searching employees' },
  hr_stats: { uz: 'HR statistikasini yig‘yapman', ru: 'Собираю HR-статистику', en: 'Gathering HR stats' },
  list_projects: { uz: "Obyektlarni o'qiyapman", ru: 'Читаю объекты', en: 'Reading projects' },
  construction_stats: { uz: 'Qurilish holatini yig‘yapman', ru: 'Собираю стройку', en: 'Gathering construction stats' },
  manufacturing_stats: { uz: 'Ishlab chiqarishni tekshiryapman', ru: 'Проверяю производство', en: 'Checking manufacturing' },
  render_blocks: { uz: 'Natijani jadval/grafikka joylayapman', ru: 'Формирую таблицу/график', en: 'Rendering blocks' },
};

const label = (tool, lang) => {
  const e = TOOL_LABELS[tool];
  if (e) return e[lang] || e.uz;
  return tool.replace(/_/g, ' ');
};

export function StepChips({ steps, lang = 'uz' }) {
  if (!Array.isArray(steps) || !steps.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-1.5">
      {steps.map((s, i) => (
        <span key={i}
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border ${
            s.denied ? 'bg-red-50 text-red-700 border-red-200'
            : s.auto ? 'bg-amber-50 text-amber-700 border-amber-200'
            : s.ok === false ? 'bg-orange-50 text-orange-700 border-orange-200'
            : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          {s.denied ? <ShieldAlert className="w-2.5 h-2.5" /> : s.auto ? <Zap className="w-2.5 h-2.5" /> : <Wrench className="w-2.5 h-2.5" />}
          {label(s.tool, lang)}
        </span>
      ))}
    </div>
  );
}

export default function StepsPanel({ steps, lang = 'uz', title }) {
  const [open, setOpen] = useState({});
  if (!Array.isArray(steps) || !steps.length) {
    return (
      <div className="text-xs text-slate-400 px-3 py-6 text-center">
        {lang === 'ru' ? 'Шаги агента появятся здесь' : lang === 'en' ? 'Agent steps will appear here' : 'Agent qadamlari shu yerda ko‘rinadi'}
      </div>
    );
  }
  return (
    <div className="px-2 py-2 space-y-1">
      {title && <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1 pb-1">{title}</p>}
      {steps.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-100 bg-white">
          <button onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left">
            {s.denied ? <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
              : s.ok === false ? <XCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            <span className="flex-1 text-xs text-slate-700 truncate">
              {label(s.tool, lang)}
              {s.auto && <span className="ml-1 text-[9px] text-amber-600 font-semibold">AVTO</span>}
              {s.executed && !s.auto && <span className="ml-1 text-[9px] text-blue-600 font-semibold">BAJARILDI</span>}
            </span>
            {open[i] ? <ChevronDown className="w-3 h-3 text-slate-300" /> : <ChevronRight className="w-3 h-3 text-slate-300" />}
          </button>
          {open[i] && s.args && Object.keys(s.args).length > 0 && (
            <pre className="text-[10px] text-slate-500 bg-slate-50 rounded-b-lg px-2 py-1.5 overflow-x-auto">
              {JSON.stringify(s.args, null, 1)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
