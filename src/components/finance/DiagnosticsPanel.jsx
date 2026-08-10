import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, Loader2, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from '@/api/services/finance';
import { toast } from 'sonner';

// Accounting diagnostics (genix_diagnostika §2.4). Scans the trial balance for a
// period and surfaces anomalies so a wrong проводка is spotted at a glance and
// drilled into (click → account card → line → document).
const firstOfMonthISO = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0];
};
const todayISO = () => new Date().toISOString().split('T')[0];

export default function DiagnosticsPanel() {
  const { language } = useLanguage();
  const tr = useCallback((uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);
  const { formatCurrency } = useCurrencyFormatter();
  const [, setSearchParams] = useSearchParams();

  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.getTrialBalanceAnomalies({ period_from: from, period_to: to });
      setData(res);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || tr('Tekshirib bo\'lmadi', 'Не удалось проверить', 'Scan failed'));
    } finally {
      setLoading(false);
    }
  }, [from, to, tr]);

  useEffect(() => { scan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drill-down: open the account card for this account over the same period.
  const openAccount = (a) => {
    setSearchParams({ tab: 'account-card', account_id: a.account_id, from, to });
  };

  const ruleLabel = (rule) => ({
    NEG_ACTIVE_BALANCE: tr('Aktivda kredit qoldiq', 'Кредит на активном', 'Credit on active'),
    DEBIT_PASSIVE_BALANCE: tr('Passivda debet qoldiq', 'Дебет на пассивном', 'Debit on passive'),
    TRANSIT_NOT_CLOSED: tr('Tranzit yopilmagan', 'Транзит не закрыт', 'Transit not closed'),
    CAPEX_STUCK: tr('0820 yopilmagan', '0820 не закрыт', '0820 stuck'),
    GROUP_NODE_POSTING: tr('Guruh hisobiga provodka', 'Проводка на группу', 'Posting on group node'),
    ORPHAN_SOURCE: tr('Manba hujjat topilmadi', 'Документ-источник не найден', 'Source doc missing'),
    DUPLICATE_SOURCE: tr('Takroriy provodka (bitta hujjat)', 'Дубль проводки (один документ)', 'Duplicate posting (same source)'),
    ZERO_LINE_ENTRY: tr('Qatorsiz provodka', 'Проводка без строк', 'Entry with no lines'),
    UNBALANCED_ENTRY: tr('Balanslashmagan provodka', 'Несбалансированная проводка', 'Unbalanced entry'),
    PERIOD_GAP: tr('Davr uzilishi', 'Разрыв периодов', 'Period gap'),
  }[rule] || rule);

  const anomalies = data?.anomalies || [];
  const counts = data?.counts || { critical: 0, warning: 0, total: 0 };

  return (
    <div className="space-y-4">
      {/* Period + rescan */}
      <Card className="border-slate-200/60">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">{tr('Davr boshi', 'Начало периода', 'From')}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">{tr('Davr oxiri', 'Конец периода', 'To')}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={scan} disabled={loading} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            {tr('Tekshirish', 'Проверить', 'Scan')}
          </Button>
        </CardContent>
      </Card>

      {/* Balance-broken banner (§2.1) — Dt total must equal Kt total */}
      {data?.balance_broken && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 flex items-center gap-2 text-red-800">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold">{tr('Balans buzilgan!', 'Баланс нарушен!', 'Balance broken!')}</div>
            <div className="text-xs">
              {tr('Debet aylanma ≠ Kredit aylanma', 'Оборот Дт ≠ обороту Кт', 'Turnover Dt ≠ Kt')}: {formatCurrency(data?.totals?.turnover_debit || 0)} vs {formatCurrency(data?.totals?.turnover_credit || 0)}
              {' '}({tr('farq', 'разница', 'diff')} {formatCurrency(Math.abs(data?.totals?.diff || 0))})
            </div>
          </div>
        </div>
      )}

      {/* Summary counts */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800 font-medium">{counts.critical}</span>
          <span className="text-xs text-red-600">{tr('jiddiy', 'критичных', 'critical')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">{counts.warning}</span>
          <span className="text-xs text-amber-600">{tr('ogohlantirish', 'предупреждений', 'warnings')}</span>
        </div>
      </div>

      {/* Anomaly list */}
      <Card className="border-slate-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-slate-900">
            {tr('Topilgan anomaliyalar', 'Найденные аномалии', 'Anomalies found')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> {tr('Tekshirilmoqda…', 'Проверка…', 'Scanning…')}
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-slate-400 py-10">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
              <p className="text-sm">{tr('Anomaliya topilmadi — hisob toza', 'Аномалий не найдено — учёт чистый', 'No anomalies — books look clean')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  {a.severity === 'critical'
                    ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    : a.severity === 'info'
                      ? <Info className="w-4 h-4 text-blue-500 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold text-slate-800">{a.code}</span>
                      <span className="text-sm text-slate-600 truncate">{language === 'ru' ? a.name_ru : a.name_uz}</span>
                      <Badge className={`text-[10px] ${a.severity === 'critical' ? 'bg-red-100 text-red-700' : a.severity === 'info' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ruleLabel(a.rule)}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {language === 'ru' ? a.message_ru : a.message_uz}
                      {(a.closing_debit > 0 || a.closing_credit > 0) && (
                        <span className="ml-1 text-slate-400">
                          · {tr('qoldiq', 'сальдо', 'balance')} {a.closing_debit > 0
                            ? `${tr('Dt', 'Дт', 'Dr')} ${formatCurrency(a.closing_debit)}`
                            : `${tr('Kt', 'Кт', 'Cr')} ${formatCurrency(a.closing_credit)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Entry-level findings (ORPHAN_SOURCE, PERIOD_GAP, …) carry no
                      account — nothing to drill into. */}
                  {a.account_id && (
                    <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-800 shrink-0" onClick={() => openAccount(a)}>
                      {tr('Hisob kartasi', 'Карточка счёта', 'Account card')} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
