import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Lock, ShieldCheck, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { taxService } from '@/api/services/tax';
import { toast } from 'sonner';

// "Soliqlar sozlamalari" — the universal tax constructor (genix_soliq_spec §2).
// Each tax/payment is a toggle. Mandatory taxes are locked while there are
// active employees; regime taxes (VAT/turnover/profit) are locked because they
// follow the regime document; optional taxes toggle freely.
export default function TaxSettings() {
  const { language } = useLanguage();
  const tr = useCallback((uz, ru, en) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

  const [taxes, setTaxes] = useState([]);
  const [regime, setRegime] = useState(null);   // from /taxes/regime (monitor)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);    // tax_code currently saving

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([taxService.getSettings(), taxService.getRegime().catch(() => null)]);
      setTaxes(Array.isArray(s?.taxes) ? s.taxes : []);
      setRegime(r);
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || tr('Yuklab bo\'lmadi', 'Не удалось загрузить', 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (tax, next) => {
    setSaving(tax.code);
    // optimistic
    setTaxes((list) => list.map((x) => (x.code === tax.code ? { ...x, enabled: next } : x)));
    try {
      await taxService.updateSetting({ tax_code: tax.code, enabled: next });
      toast.success(next
        ? tr('Yoqildi', 'Включено', 'Enabled')
        : tr('O\'chirildi', 'Выключено', 'Disabled'));
      load();
    } catch (e) {
      // revert + show the structured message (MANDATORY_TAX / REGIME_TAX_LOCKED)
      setTaxes((list) => list.map((x) => (x.code === tax.code ? { ...x, enabled: !next } : x)));
      const d = e?.response?.data;
      const msg = (language === 'ru' ? d?.message_ru : d?.message_uz) || d?.message
        || tr('Amalga oshmadi', 'Не выполнено', 'Failed');
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

  const catBadge = (cat) => {
    const map = {
      mandatory: ['bg-red-100 text-red-700', tr('majburiy', 'обязательный', 'mandatory')],
      regime: ['bg-blue-100 text-blue-700', tr('rejim', 'режим', 'regime')],
      optional: ['bg-slate-100 text-slate-600', tr('ixtiyoriy', 'опциональный', 'optional')],
    };
    const [cls, label] = map[cat] || map.optional;
    return <Badge className={`${cls} text-[10px]`}>{label}</Badge>;
  };

  const lockText = (reason) => reason === 'mandatory'
    ? tr('Faol xodimlar bor — o\'chirib bo\'lmaydi', 'Есть активные сотрудники — выключить нельзя', 'Active employees — cannot disable')
    : tr('Rejim hujjati orqali boshqariladi', 'Управляется документом смены режима', 'Managed by the regime document');

  const monitor = () => {
    if (!regime) return null;
    const lvl = regime.alert_level;
    if (!lvl || lvl === 'none') return null;
    const cls = lvl === 'yellow' ? 'bg-amber-50 border-amber-300 text-amber-800'
      : 'bg-red-50 border-red-300 text-red-800';
    const pct = Math.round(regime.percent || 0);
    return (
      <div className={`rounded-lg border px-4 py-3 flex items-center gap-2 text-sm ${cls}`}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          {tr(
            `Yillik daromad chegaraga yaqin: ${pct}% (1 mlrd so'm). QQS rejimiga o'tish talab qilinishi mumkin.`,
            `Годовой доход близок к порогу: ${pct}% (1 млрд сум). Возможен обязательный переход на НДС.`,
            `Yearly income near the threshold: ${pct}% (1 bn so'm). Mandatory VAT switch may apply.`
          )}
        </span>
      </div>
    );
  };

  return (
    <Card className="border-slate-200/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          {tr('Soliqlar sozlamalari', 'Настройки налогов', 'Tax settings')}
          {regime?.regime && (
            <Badge className="bg-indigo-100 text-indigo-700 text-[10px] ml-1">
              {regime.regime === 'vat_profit'
                ? tr('QQS + foyda', 'НДС + прибыль', 'VAT + profit')
                : tr('Aylanma', 'Оборот', 'Turnover')}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {tr('Kerakli soliqlarni yoqing yoki o\'chiring. O\'chirilgan soliq hisoblanmaydi va hisobotlarda ko\'rinmaydi.',
              'Включайте или выключайте нужные налоги. Выключенный налог не начисляется и не показывается в отчётах.',
              'Enable or disable the taxes you need. A disabled tax is not accrued and not shown in reports.')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {monitor()}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> {tr('Yuklanmoqda…', 'Загрузка…', 'Loading…')}
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="divide-y divide-slate-100">
              {taxes.map((tax) => (
                <div key={tax.code} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {language === 'ru' ? tax.name_ru : tax.name_uz}
                      </span>
                      {catBadge(tax.category)}
                      {tax.kind === 'deduction' && (
                        <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                          {tr('ushlab qolish', 'удержание', 'deduction')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {tax.rate > 0
                        ? `${tr('Stavka', 'Ставка', 'Rate')}: ${tax.rate}%`
                        : tr('Stavka hujjatda kiritiladi', 'Ставка вводится в документе', 'Rate entered on the document')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {saving === tax.code && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                    {!tax.can_toggle ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            {tax.enabled
                              ? <ShieldCheck className="w-4 h-4 text-green-500" />
                              : <span className="text-xs">{tr('o\'chiq', 'выкл', 'off')}</span>}
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{lockText(tax.lock_reason)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Switch
                        checked={!!tax.enabled}
                        disabled={saving === tax.code}
                        onCheckedChange={(v) => toggle(tax, v)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
