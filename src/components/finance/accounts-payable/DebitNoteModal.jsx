import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

// A full debit note against a vendor bill. `target` is { bill, reason }; null
// closes the dialog.
export default function DebitNoteModal({ target, onChange, onSubmit, isSaving }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-500" />
            {t('create_debit_note')}
          </DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('invoice_number')}:</span>
                <span className="font-medium">{target.bill.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('vendor')}:</span>
                <span className="font-medium">{target.bill.partner_name || target.bill.vendor_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('amount')}:</span>
                <span className="font-semibold">{formatCurrency(target.bill.total_amount || 0)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('debit_note_reason') || 'Reason'} *</Label>
              <Textarea
                rows={3}
                value={target.reason}
                onChange={(e) => onChange({ ...target, reason: e.target.value })}
                placeholder={t('debit_note_reason_placeholder') || 'Enter reason for debit note...'}
              />
            </div>
            <p className="text-xs text-slate-500">
              {t('debit_note_description') || 'A full debit note will be created for the total bill amount. Confirm it later to post GL entries and reduce vendor balance.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onChange(null)} disabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button
                onClick={onSubmit}
                disabled={!target.reason.trim() || isSaving}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isSaving ? (t('creating') || 'Creating...') : t('create_debit_note')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
