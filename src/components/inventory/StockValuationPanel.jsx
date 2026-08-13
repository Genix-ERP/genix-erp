import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Scale, TrendingDown, RefreshCw, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { stockValuationService } from '@/api/services/stockValuation';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatCompactNumber } from '@/utils/formatCurrency';

// Zaxiralarni baholash — reja §5 ekranlari.
//
// Uch ko'rinish bitta panelda, chunki ular bitta savolning uch tomoni:
//   Baholash    — §3.4: qatlamlar bo'yicha qoldiq qiymati (nima bor)
//   Solishtirish— §1.3: o'sha qiymat 2910 bilan tengmi (ishonsa bo'ladimi)
//   Marja       — §5:  davr ichida qancha tannarx chiqdi (qanchaga ketdi)
//
// Panel qatlamlar hali yo'q holatni ham to'g'ri ko'rsatishi kerak: baholash
// jonli bazaga yoqildi, shuning uchun "hali start qatlami yo'q" — bu xato
// emas, kutilgan boshlang'ich holat. Shu sababli bo'sh natija xato sifatida
// emas, "Qoldiqlarni kiritish" taklifi bilan ko'rsatiladi (§6).

const VIEWS = [
  { id: 'valuation', icon: Layers, uz: 'Zaxiralar bahosi', en: 'Stock valuation' },
  { id: 'reconcile', icon: Scale, uz: 'Buxgalteriya bilan solishtirish', en: 'Reconcile with GL' },
  { id: 'margin', icon: TrendingDown, uz: 'Sotuv tannarxi', en: 'Cost of sales' },
];

const money = (v) => formatCompactNumber(Number(v) || 0);
const exact = (v) => (Number(v) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v) => (Number(v) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 4 });

export default function StockValuationPanel({ language = 'uz', dateFrom, dateTo, warehouseId }) {
  const L = (uz, en) => (language === 'uz' ? uz : en);

  const [view, setView] = useState('valuation');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [valuation, setValuation] = useState(null);
  const [reconcile, setReconcile] = useState(null);
  const [margin, setMargin] = useState(null);
  const [opening, setOpening] = useState(null);
  const [posting, setPosting] = useState(false);

  const asOf = dateTo || new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const wh = warehouseId && warehouseId !== 'all' ? warehouseId : undefined;
      if (view === 'valuation') {
        setValuation(await stockValuationService.getValuationReport({ as_of_date: asOf, warehouse_id: wh }));
      } else if (view === 'reconcile') {
        setReconcile(await stockValuationService.getReconciliation({ as_of_date: asOf }));
      } else {
        setMargin(await stockValuationService.getMarginReport({
          date_from: dateFrom || undefined, date_to: asOf, warehouse_id: wh,
        }));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, L('Ma\'lumotni yuklab bo\'lmadi', 'Failed to load')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, asOf, dateFrom, warehouseId]);

  useEffect(() => { load(); }, [load]);

  // Qatlamsiz tovarlar — §6 dagi "Qoldiqlarni kiritish" uchun nomzodlar.
  const loadOpening = useCallback(async () => {
    try {
      setOpening(await stockValuationService.getOpeningPreview({}));
    } catch {
      setOpening(null);
    }
  }, []);

  const rows = valuation?.products || [];
  const empty = view === 'valuation' && !loading && !error && rows.length === 0;
  useEffect(() => { if (empty) loadOpening(); }, [empty, loadOpening]);

  const postOpening = async () => {
    setPosting(true);
    try {
      const res = await stockValuationService.postOpeningBalance({
        as_of_date: asOf,
        notes: L('Baholash yoqilganda kiritilgan boshlang\'ich qoldiqlar',
          'Opening balances captured when valuation was switched on'),
      });
      toast.success(L(`${res?.created ?? 0} ta tovarga start qatlam yaratildi`,
        `${res?.created ?? 0} opening layers created`));
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, L('Kiritib bo\'lmadi', 'Failed to post')));
    } finally {
      setPosting(false);
    }
  };

  const recTotals = useMemo(() => ({
    layers: Number(reconcile?.total_layer_value) || 0,
    gl: Number(reconcile?.total_gl_balance) || 0,
    diff: Number(reconcile?.total_difference) || 0,
    balanced: Boolean(reconcile?.balanced),
  }), [reconcile]);

  return (
    <div className="space-y-4">
      {/* View switch + refresh */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const on = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {L(v.uz, v.en)}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {L('Yangilash', 'Refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* §6 — hali qatlam yo'q: xato emas, boshlang'ich holat. */}
      {empty && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">{L('Baholash qatlamlari hali yo\'q', 'No valuation layers yet')}</p>
                <p className="text-xs mt-1 text-amber-800">
                  {L(`Baholash mavjud bazaga yoqilgan, shuning uchun eski qoldiqlarning qatlami yo'q. "Qoldiqlarni kiritish" har bir qoldiqqa joriy hisob qiymatida bitta start qatlam beradi va shu paytdan kategoriya usuli qulflanadi.`,
                    'Valuation was switched on over existing data, so old balances have no layers. "Enter opening balances" gives each balance one start layer at its current book value and locks the category method from that point.')}
                </p>
                {opening?.products?.length > 0 && (
                  <p className="text-xs mt-1.5 font-medium">
                    {L(`${opening.products.length} ta tovar, jami ${money(opening.total_value)}`,
                      `${opening.products.length} products, total ${money(opening.total_value)}`)}
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={postOpening} disabled={posting}>
              <PlayCircle className="w-3.5 h-3.5" />
              {posting ? L('Kiritilmoqda…', 'Posting…') : L('Qoldiqlarni kiritish', 'Enter opening balances')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* === ZAXIRALAR BAHOSI (§3.4) === */}
      {view === 'valuation' && rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label={L('Jami qiymat', 'Total value')} value={money(valuation?.total_value)}
              hint={`${exact(valuation?.total_value)} so'm`} tone="sky" />
            <Stat label={L('Tovarlar', 'Products')} value={String(rows.length)} />
            <Stat label={L('Sana', 'As of')} value={valuation?.as_of_date || asOf} />
          </div>
          <Table
            head={[L('Tovar', 'Product'), L('Kategoriya', 'Category'), L('Miqdor', 'Qty'),
              L('Birlik qiymati', 'Unit value'), L('Qiymat', 'Value'), L('Qatlam', 'Layers'), L('Eng eski', 'Oldest')]}
            rows={rows.map((r) => [
              r.product_name, r.category_name, qty(r.quantity),
              exact(r.unit_value), exact(r.value), r.layer_count, r.oldest_layer || '—',
            ])}
            alignRight={[2, 3, 4, 5]}
          />
          <p className="text-[11px] text-slate-500">
            {L('FIFO da qoldiq birligining tannarxi bir xil emas — har qatlamning o\'z narxi bor. "Birlik qiymati" ma\'lumot uchun: qiymat ÷ miqdor.',
              'Under FIFO the unit cost of the remaining stock is not uniform — each layer has its own. "Unit value" is informational: value ÷ quantity.')}
          </p>
        </>
      )}

      {/* === SOLISHTIRISH (§1.3) === */}
      {view === 'reconcile' && reconcile && (
        <>
          <div className={`rounded-lg border p-4 ${recTotals.balanced ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {recTotals.balanced
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              <span className={`text-sm font-medium ${recTotals.balanced ? 'text-emerald-900' : 'text-amber-900'}`}>
                {recTotals.balanced
                  ? L('Ombor va buxgalteriya teng', 'Stock and ledger agree')
                  : L('Farq bor', 'They differ')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <KV k={L('Qatlamlar yig\'indisi', 'Sum of layers')} v={exact(recTotals.layers)} />
              <KV k={L('Buxgalteriya (2910)', 'Ledger (2910)')} v={exact(recTotals.gl)} />
              <KV k={L('Farq', 'Difference')} v={exact(recTotals.diff)} strong={!recTotals.balanced} />
            </div>
            {!recTotals.balanced && (
              <p className="text-[11px] text-amber-800 mt-2">
                {L('Farq kutilgan holat: qatlamlar hozircha kuzatuv qatlami, provodkalarni esa hujjat yo\'llarining o\'zi yozadi (reja §6, 2-bosqich). Bu raqam o\'sha bosqichga o\'tish uchun o\'lchov.',
                  'A difference is expected for now: layers track reality while the document paths still write the postings themselves (plan §6, phase 2). This number is the gauge for that cutover.')}
              </p>
            )}
          </div>
          <Table
            head={[L('Schyot', 'Account'), L('Nomi', 'Name'), L('Qatlamlar', 'Layers'),
              L('Miqdor', 'Qty'), L('Buxgalteriya', 'Ledger'), L('Farq', 'Difference')]}
            rows={(reconcile.accounts || []).map((a) => [
              a.account_code, a.account_name, exact(a.layer_value),
              qty(a.layer_qty), exact(a.gl_balance), exact(a.difference),
            ])}
            alignRight={[2, 3, 4, 5]}
          />
        </>
      )}

      {/* === SOTUV TANNARXI (§5) === */}
      {view === 'margin' && margin && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label={L('Jami tannarx', 'Total cost')} value={money(margin.total_cost)}
              hint={`${exact(margin.total_cost)} so'm`} tone="rose" />
            <Stat label={L('Tovarlar', 'Products')} value={String((margin.products || []).length)} />
            <Stat label={L('Davr', 'Period')} value={`${margin.date_from || '—'} → ${margin.date_to || asOf}`} />
          </div>
          <Table
            head={[L('Tovar', 'Product'), L('Miqdor', 'Qty'), L('Tannarx', 'Cost')]}
            rows={(margin.products || []).map((p) => [p.product_name, qty(p.quantity), exact(p.cost)])}
            alignRight={[1, 2]}
          />
          <p className="text-[11px] text-slate-500">
            {L('Tushum savdo hisobotidan olinadi; bu yerda faqat chiqim tannarxi — ya\'ni marjaning tannarx tomoni.',
              'Revenue comes from the sales report; this is the cost side of the margin only.')}
          </p>
        </>
      )}

      {loading && <p className="text-sm text-slate-500">{L('Yuklanmoqda…', 'Loading…')}</p>}
    </div>
  );
}

function Stat({ label, value, hint, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white',
    sky: 'border-sky-200 bg-sky-50',
    rose: 'border-rose-200 bg-rose-50',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 tabular-nums">{hint}</p>}
    </div>
  );
}

function KV({ k, v, strong }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{k}</p>
      <p className={`tabular-nums ${strong ? 'font-semibold text-amber-900' : 'text-slate-800'}`}>{v}</p>
    </div>
  );
}

function Table({ head, rows, alignRight = [] }) {
  if (!rows?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-500">
            {head.map((h, i) => (
              <th key={h} className={`p-2 font-medium ${alignRight.includes(i) ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-slate-100">
              {r.map((cell, ci) => (
                <td key={ci} className={`p-2 tabular-nums ${alignRight.includes(ci) ? 'text-right' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
