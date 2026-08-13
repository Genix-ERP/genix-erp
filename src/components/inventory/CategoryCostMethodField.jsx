import { useEffect, useState } from 'react';
import { Lock, Info } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { stockValuationService } from '@/api/services/stockValuation';

// Kategoriyaning baholash usuli — reja §2.1 va §5.
//
// Uch narsani bir joyda ko'rsatadi, chunki foydalanuvchi uchun ular bitta
// savol: "bu tovarlar qanday baholanadi va men buni o'zgartira olamanmi?"
//   1. tanlangan usul (yoki kompaniyadan meros olingani);
//   2. meros bo'lsa — qaysi usul amalda ishlayotgani;
//   3. qulflangan bo'lsa — NEGA: nechta harakat va qaysi sanadan.
//
// Qulf sababini ko'rsatish shart. Sababsiz o'chirilgan maydon foydalanuvchiga
// "buzilibdi" bo'lib ko'rinadi va u qo'llab-quvvatlashga yozadi; sabab bilan
// esa bu tushunarli qoida: usulni harakat boshlangandan keyin o'zgartirish
// eski provodkalarni yolg'on qilib qo'yardi.
//
// DIQQAT: maydonning disabled bo'lishi — qulay ko'rinish, himoya EMAS.
// Haqiqiy tekshiruv serverda (guardCategoryMethodChange), chunki API, import
// va ommaviy tahrirlash bu formadan umuman o'tmaydi.

const METHODS = [
  { value: 'inherit', uz: 'Hisob siyosatidan (meros)', en: 'From accounting policy' },
  { value: 'fifo', uz: 'FIFO — birinchi kirgan birinchi chiqadi', en: 'FIFO' },
  { value: 'avco', uz: "AVCO — o'rtacha tortilgan", en: 'AVCO — weighted average' },
  { value: 'standard', uz: 'Standart narx', en: 'Standard price' },
];

const LABEL = { fifo: 'FIFO', avco: 'AVCO', standard: 'Standart narx' };

export default function CategoryCostMethodField({ categoryId, value, onChange, language = 'uz' }) {
  const L = (uz, en) => (language === 'uz' ? uz : en);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!categoryId) { setInfo(null); return undefined; }
    let alive = true;
    stockValuationService
      .getCategoryMethodLock(categoryId)
      .then((d) => { if (alive) setInfo(d); })
      .catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [categoryId]);

  const locked = Boolean(info?.lock?.locked);
  const effective = info?.effective_method;
  const inherited = !value || value === 'inherit';

  return (
    <div>
      <label className="text-sm font-medium text-slate-700 mb-1 block">
        {L('Baholash usuli', 'Valuation method')}
      </label>
      <Select
        value={value || 'inherit'}
        onValueChange={(v) => onChange(v === 'inherit' ? '' : v)}
        disabled={locked}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METHODS.map((m) => (
            <SelectItem key={m.value} value={m.value}>{L(m.uz, m.en)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {locked ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700">
          <Lock className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            {info.lock.reason
              || L(`Usul qulflangan: ${info.lock.movement_count} ta harakat${info.lock.since ? `, ${info.lock.since} dan` : ''}`,
                `Method locked: ${info.lock.movement_count} movements${info.lock.since ? ` since ${info.lock.since}` : ''}`)}
          </span>
        </p>
      ) : (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            {inherited && effective
              ? L(`Hisob siyosatidan: ${LABEL[effective] || effective}`,
                `From accounting policy: ${LABEL[effective] || effective}`)
              : L('Birinchi kirimdan so\'ng usul qulflanadi va keyin o\'zgartirib bo\'lmaydi.',
                'After the first receipt this method locks and can no longer be changed.')}
          </span>
        </p>
      )}
    </div>
  );
}
