import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, ShieldAlert } from 'lucide-react';

// Tasdiqlash kartasi — the human-in-the-loop gate. The agent NEVER commits a
// write itself: it proposes; the user approves; the write executes through the
// module's normal API under the user's own permissions.

const FIELD_LABELS = {
  customer: 'Mijoz', vendor: 'Yetkazib beruvchi', contact: 'Kontragent', name: 'Nomi',
  amount: 'Summa', total_amount: 'Jami summa', quantity: 'Miqdor', product: 'Mahsulot',
  warehouse: 'Ombor', from_warehouse: 'Qaysi ombordan', to_warehouse: 'Qaysi omborga',
  new_quantity: 'Yangi miqdor', direction: "Yo'nalish", phone: 'Telefon', type: 'Turi',
  title: 'Sarlavha', status: 'Holat', category: 'Kategoriya', due_date: 'Muddat',
};

const fmtVal = (v) => {
  if (typeof v === 'number') return v.toLocaleString('uz-UZ');
  if (Array.isArray(v)) return `${v.length} ta pozitsiya`;
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v ?? '');
};

export default function ApprovalCard({ pending, approving, onApprove, onReject, lang = 'uz' }) {
  if (!pending) return null;
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : lang === 'en' ? en : uz);
  const args = pending.args || {};
  const fields = Object.entries(args).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const immediate = pending.tool === 'stock_adjust' || pending.tool === 'stock_transfer';

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 my-2">
      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1.5">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        {tr('Tasdiqlash kerak', 'Требуется подтверждение', 'Confirmation required')}
      </div>
      <p className="text-sm text-slate-700 mb-2">{pending.summary}</p>

      {fields.length > 0 && (
        <div className="rounded-lg bg-white/70 border border-amber-100 divide-y divide-amber-50 mb-2">
          {fields.slice(0, 8).map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
              <span className="text-[11px] text-slate-500">{FIELD_LABELS[k] || k.replace(/_/g, ' ')}</span>
              <span className="text-[11px] font-medium text-slate-800 text-right break-all">{fmtVal(v)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-amber-700 mb-2">
        {immediate
          ? tr('Diqqat: bu amal tasdiqlangan zahoti REAL ombor qoldig‘iga yoziladi.',
               'Внимание: действие сразу изменит реальные остатки.',
               'Warning: this posts to the real stock ledger immediately.')
          : tr('Tasdiqlasangiz QORALAMA sifatida modulning oddiy API orqali, sizning huquqlaringiz bilan yaratiladi.',
               'После подтверждения создастся ЧЕРНОВИК через обычный API модуля с вашими правами.',
               'On approval a DRAFT is created through the module API under your permissions.')}
      </p>

      <div className="flex gap-2">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={approving} onClick={onApprove}>
          {approving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          {tr('Tasdiqlash', 'Подтвердить', 'Approve')}
        </Button>
        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={approving} onClick={onReject}>
          <X className="w-4 h-4 mr-1" />{tr('Bekor qilish', 'Отменить', 'Cancel')}
        </Button>
      </div>
    </div>
  );
}
