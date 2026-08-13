import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Coins, History, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { stockValuationService } from '@/api/services/stockValuation';
import { getApiErrorMessage } from '@/utils/apiError';

// Mahsulot kartochkasidagi "Tannarx" bloki — reja §5.
//
// Reja §0 da qat'iy aytilgan: mahsulot kartochkasida usul TANLANMAYDI, faqat
// hisoblangan "amaldagi usul" ko'rsatiladi (read-only). Usul kategoriya yoki
// hisob siyosati darajasida beriladi — aks holda bitta kategoriya ichida har
// xil baholangan tovarlar paydo bo'lib, kategoriya bo'yicha hisobot ma'nosini
// yo'qotardi.
//
// Standart narx esa aynan shu yerda o'zgaradi, LEKIN oddiy maydon sifatida
// emas: qoldiq nol bo'lmasa, narxni o'zgartirish QAYTA BAHOLASH hujjati
// (§3.3) — pul harakati, provodkasi bilan. Shuning uchun alohida dialog va
// alohida tasdiqlash; foydalanuvchi nima bo'layotganini oldindan ko'radi.

const METHOD_LABEL = {
  fifo: 'FIFO',
  avco: "AVCO — o'rtacha tortilgan",
  standard: 'Standart narx',
};

const num = (v) => (Number(v) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProductCostBlock({ productId, language = 'uz' }) {
  const L = (uz, en) => (language === 'uz' ? uz : en);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [newCost, setNewCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    if (!productId) return;
    try {
      setData(await stockValuationService.getStandardCost(productId));
    } catch {
      setData(null);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  if (!data) return null;

  const method = data.effective_method || data.method;
  // Backend'ning o'zi aytadi: standard_cost faqat standart usulda ma'noga ega.
  const isStandard = data.is_standard_method ?? method === 'standard';
  const onHand = Number(data.quantity_on_hand) || 0;
  const current = Number(data.standard_cost) || 0;
  const proposed = Number(String(newCost).replace(',', '.')) || 0;
  // §3.3: Δ = qoldiq × (yangi − eski). Qoldiq nol bo'lsa provodka ham yo'q.
  const delta = onHand * (proposed - current);

  const submit = async () => {
    setSaving(true);
    try {
      await stockValuationService.updateStandardCost(productId, {
        new_cost: proposed,
        notes: L('Kartochkadan qayta baholash', 'Revalued from the product card'),
      });
      toast.success(L('Standart narx yangilandi', 'Standard cost updated'));
      setOpen(false);
      setNewCost('');
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, L('Saqlab bo\'lmadi', 'Failed to save')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Coins className="w-4 h-4 text-slate-400" />
        {L('Tannarx', 'Cost')}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-500">{L('Amaldagi usul', 'Effective method')}</p>
          {/* read-only — §0: kartochkada usul tanlanmaydi */}
          <p className="font-medium text-slate-900">{METHOD_LABEL[method] || method || '—'}</p>
        </div>
        <div>
          <p className="text-slate-500">{L('Qoldiq', 'On hand')}</p>
          <p className="font-medium text-slate-900 tabular-nums">{onHand.toLocaleString('ru-RU')}</p>
        </div>
      </div>

      {/* FIFO/AVCO da bitta "joriy tannarx" raqami yo'q: §3.4 — FIFO da qoldiq
          birligining tannarxi bir xil emas, har qatlamning o'z narxi bor.
          Shuning uchun bu yerda son o'ylab topilmaydi, foydalanuvchi qatlamlar
          ko'rinadigan joyga yo'naltiriladi. */}
      {!isStandard && (
        <p className="text-[11px] text-slate-500 border-t pt-2">
          {L('Bu usulda qoldiqning birlik tannarxi yagona son emas — qiymat qatlamlar bo\'yicha yuritiladi. To\'liq qiymatni Ombor → Hisobotlar → Zaxiralar bahosi da ko\'ring.',
            'Under this method the remaining stock has no single unit cost — value is carried per layer. See Inventory → Reports → Valuation for the full figure.')}
        </p>
      )}

      {isStandard && (
        <div className="border-t pt-2 flex items-center justify-between gap-2">
          <div className="text-xs">
            <p className="text-slate-500">{L('Standart narx', 'Standard price')}</p>
            <p className="font-medium text-slate-900 tabular-nums">{num(current)}</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => { setNewCost(String(current)); setOpen(true); }}>
            {L("O'zgartirish", 'Change')}
          </Button>
        </div>
      )}

      {Array.isArray(data.history) && data.history.length > 0 && (
        <>
          <button type="button" onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700">
            <History className="w-3 h-3" />
            {L('Narx tarixi', 'Price history')} ({data.history.length})
          </button>
          {showHistory && (
            <div className="rounded border border-slate-100 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-1.5 text-left">{L('Sana', 'Date')}</th>
                    <th className="p-1.5 text-right">{L('Eski', 'Old')}</th>
                    <th className="p-1.5 text-right">{L('Yangi', 'New')}</th>
                    <th className="p-1.5 text-right">{L('Qayta baholash', 'Revaluation')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-1.5">{h.effective_date}</td>
                      <td className="p-1.5 text-right tabular-nums">{num(h.old_cost)}</td>
                      <td className="p-1.5 text-right tabular-nums">{num(h.new_cost)}</td>
                      <td className="p-1.5 text-right tabular-nums">{num(h.revaluation_delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Qayta baholash — maydon tahriri emas, hujjat (§3.3). */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{L('Qiymatni qayta baholash', 'Revalue stock')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">{L('Yangi standart narx', 'New standard price')}</label>
              <Input value={newCost} onChange={(e) => setNewCost(e.target.value)} inputMode="decimal" />
            </div>
            <div className="rounded-md bg-slate-50 p-2 text-xs space-y-1">
              <Row k={L('Qoldiq', 'On hand')} v={onHand.toLocaleString('ru-RU')} />
              <Row k={L('Eski narx', 'Old price')} v={num(current)} />
              <Row k={L('Yangi narx', 'New price')} v={num(proposed)} />
              <Row k={L('Qayta baholash (Δ)', 'Revaluation (Δ)')} v={num(delta)} strong />
            </div>
            {onHand > 0 ? (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                {L('Qoldiq nol emas — bu provodka yaratadi: 2910 ↔ chetlanishlar schyoti.',
                  'Stock is not zero — this posts an entry: 2910 ↔ variance account.')}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                {L('Qoldiq nol — provodkasiz, faqat narx yangilanadi.',
                  'Zero stock — no posting, only the price changes.')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{L('Bekor qilish', 'Cancel')}</Button>
            <Button onClick={submit} disabled={saving || proposed < 0}>
              {saving ? L('Saqlanmoqda…', 'Saving…') : L('Qayta baholash', 'Revalue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{v}</span>
    </div>
  );
}
