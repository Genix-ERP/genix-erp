import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, CheckCircle, DollarSign, Printer, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { getStatusColor, getMatchStatusColor, isOverdue, residualOf } from './billHelpers';

const getDateLocale = (lang) => {
  switch (lang) {
    case 'ru': return ru;
    case 'uz': return uz;
    default: return undefined;
  }
};

const Field = ({ label, value, className = 'bg-slate-50', valueClassName = 'text-slate-900' }) => (
  <div className={`p-3 ${className} rounded-lg`}>
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-sm font-semibold ${valueClassName}`}>{value}</p>
  </div>
);

export default function BillDetailModal({ bill, onClose, onPost, onApprove, onPay, onPrint }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const dateLocale = getDateLocale(language);

  const fmtDate = (d) => (d ? format(new Date(d), 'dd.MM.yyyy', { locale: dateLocale }) : '-');

  return (
    <Dialog open={!!bill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--genix-purple)]" />
            {bill?.invoice_type === 'debit_note'
              ? (t('debit_note_details') || 'Debit Note Details')
              : (t('bill_details') || 'Bill Details')}
          </DialogTitle>
        </DialogHeader>
        {bill && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-sm text-slate-500">{t('invoice_number')}</p>
                <p className="text-lg font-bold text-slate-900 font-mono">{bill.invoice_number}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Badge className={getStatusColor(bill.status)}>{t(bill.status) || bill.status}</Badge>
                {/* The detail sheet used to recompute overdue on its own and
                    could contradict the list it was opened from. */}
                {isOverdue(bill) && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('overdue') || "Muddati o'tgan"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('vendor')} value={bill.partner_name || bill.vendor_name || '-'} />
              <Field label={t('total')} value={formatCurrency(bill.total_amount || 0)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('invoice_date')} value={fmtDate(bill.invoice_date)} />
              <Field
                label={t('due_date')}
                value={fmtDate(bill.due_date)}
                valueClassName={isOverdue(bill) ? 'text-red-600' : 'text-slate-900'}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label={t('subtotal')} value={formatCurrency(bill.subtotal || 0)} />
              <Field label={t('tax')} value={formatCurrency(bill.tax_amount || 0)} />
              {/* The residual, not the stored amount_due column: amount_due is
                  not maintained on every write path, so it can disagree with
                  the list row that derived its own figure. */}
              <Field label={t('amount_due')} value={formatCurrency(residualOf(bill))} valueClassName="text-red-600" />
            </div>

            {(bill.purchase_order_number || bill.goods_receipt_number) && (
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('po_reference') || 'PO Reference'} value={bill.purchase_order_number || '-'}
                  className="bg-blue-50" valueClassName="text-blue-800 font-mono" />
                <Field label={t('gr_reference') || 'GR Reference'} value={bill.goods_receipt_number || '-'}
                  className="bg-purple-50" valueClassName="text-purple-800 font-mono" />
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">{t('three_way_match')}</p>
              <Badge className={getMatchStatusColor(bill.three_way_match_status || 'not_applicable')}>
                {t(bill.three_way_match_status || 'not_applicable') || 'N/A'}
              </Badge>
            </div>

            {bill.invoice_type === 'debit_note' && bill.reason && (
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">{t('reason')}</p>
                <p className="text-sm text-orange-700">{bill.reason}</p>
              </div>
            )}

            {bill.notes && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">{t('notes')}</p>
                <p className="text-sm text-slate-700">{bill.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {bill.status === 'draft' && (
                <>
                  <Button onClick={() => onPost(bill)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                    <FileText className="w-4 h-4 mr-2" />{t('post') || 'Post'}
                  </Button>
                  <Button onClick={() => onApprove(bill)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    <CheckCircle className="w-4 h-4 mr-2" />{t('confirm') || 'Confirm'}
                  </Button>
                </>
              )}
              {(bill.status === 'confirmed' || bill.status === 'posted') && residualOf(bill) > 0 && (
                <Button onClick={() => onPay(bill)} className="flex-1 bg-green-600 hover:bg-green-700">
                  <DollarSign className="w-4 h-4 mr-2" />{t('mark_as_paid') || 'Mark as Paid'}
                </Button>
              )}
              <Button variant="outline" onClick={() => onPrint(bill)} className="flex-1">
                <Printer className="w-4 h-4 mr-2" />{t('print') || 'Print'}
              </Button>
              <Button variant="outline" onClick={onClose}>{t('close')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
