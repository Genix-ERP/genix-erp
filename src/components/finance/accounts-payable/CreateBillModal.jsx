import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { contactsService } from '@/api/services';

const emptyBill = () => ({
  partner_id: '',
  vendor_invoice_number: '',
  invoice_date: new Date().toISOString().split('T')[0],
  due_date: '',
  tax_rate_id: '',
  subtotal: 0,
  tax_amount: 0,
  total_amount: 0,
});

// Create a vendor bill by hand (as opposed to one arriving from a purchase
// order). `initial` pre-fills the form from the scan dialog.
//
// Two things this dialog used to get wrong:
//
// 1. It never sent vendor_invoice_number, which POST /purchase-invoices marks
//    binding:"required" — so every submission 400'd and the only trace was a
//    console.error. The button appeared to do nothing. The field is now on the
//    form, which is right anyway: it is the supplier's own document number and
//    the AP clerk is holding the paper.
//
// 2. It applied a hardcoded 10% tax. Unlike sales invoices — where the backend
//    resolves each line's tax_id against tax_rates — this endpoint stores the
//    subtotal, tax and total it is given, so the rate genuinely is chosen here.
//    It now comes from the configured purchase tax rather than a number nobody
//    picked, and tax_rate_id goes with it so the stored bill records which rate
//    produced the amount.
export default function CreateBillModal({ open, onOpenChange, initial, onSubmit, isSaving, error }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { taxRates = [] } = useFinancials();
  const { getSetting } = useAdminSettings();

  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [bill, setBill] = useState(emptyBill);

  const purchaseTaxRates = taxRates.filter(tr => tr.tax_type === 'purchase' || !tr.tax_type);
  const defaultPurchaseTaxId = getSetting('purchase.tax.default_tax_id', '');

  // Vendors are fetched when the dialog first opens, not on mount: the list is
  // only ever read here.
  useEffect(() => {
    if (!open || vendors.length > 0) return;
    setVendorsLoading(true);
    contactsService.list({ contact_type: 'vendor' })
      .then(data => setVendors(data?.data || data || []))
      .catch(err => console.error('Failed to load vendors:', err))
      .finally(() => setVendorsLoading(false));
  }, [open, vendors.length]);

  useEffect(() => {
    if (!open) return;
    const base = { ...emptyBill(), ...(initial || {}) };
    if (!base.tax_rate_id) {
      const fallback = defaultPurchaseTaxId
        ? taxRates.find(tr => String(tr.id) === String(defaultPurchaseTaxId))
        : purchaseTaxRates.find(tr => tr.is_active !== false);
      base.tax_rate_id = fallback ? String(fallback.id) : '';
    }
    setBill(base);
    // Recomputing on every taxRates identity change would stomp the user's
    // edits mid-typing; the form is seeded once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const rate = parseFloat(taxRates.find(tr => String(tr.id) === String(bill.tax_rate_id))?.rate) || 0;

  const setSubtotal = (raw) => {
    const subtotal = parseFloat(raw) || 0;
    const tax = subtotal * rate / 100;
    setBill(prev => ({ ...prev, subtotal, tax_amount: tax, total_amount: subtotal + tax }));
  };

  const setTaxRate = (value) => {
    const id = value === 'none' ? '' : value;
    const newRate = parseFloat(taxRates.find(tr => String(tr.id) === String(id))?.rate) || 0;
    const subtotal = parseFloat(bill.subtotal) || 0;
    const tax = subtotal * newRate / 100;
    setBill(prev => ({ ...prev, tax_rate_id: id, tax_amount: tax, total_amount: subtotal + tax }));
  };

  const canSubmit = bill.partner_id && bill.vendor_invoice_number.trim()
    && bill.invoice_date && bill.due_date && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('create_vendor_bill') || 'Create Vendor Bill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('vendor')} *</label>
              <Select value={bill.partner_id} onValueChange={(value) => setBill(prev => ({ ...prev, partner_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={vendorsLoading ? t('loading') : (t('select_vendor') || 'Select vendor')} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-orange-500" />
                        {vendor.company_name || vendor.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('vendor_ref') || "Yetkazuvchi hujjat №"} *</label>
              <Input
                value={bill.vendor_invoice_number}
                onChange={(e) => setBill(prev => ({ ...prev, vendor_invoice_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('invoice_date')} *</label>
              <Input type="date" value={bill.invoice_date}
                onChange={(e) => setBill(prev => ({ ...prev, invoice_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('due_date')} *</label>
              <Input type="date" value={bill.due_date}
                onChange={(e) => setBill(prev => ({ ...prev, due_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t('tax') || 'Tax'}</label>
            <Select value={bill.tax_rate_id || 'none'} onValueChange={setTaxRate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('no_tax') || 'Soliqsiz'}</SelectItem>
                {purchaseTaxRates.map(tr => (
                  <SelectItem key={tr.id} value={String(tr.id)}>{tr.name} ({tr.rate}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('subtotal')} *</label>
              <NumberInput placeholder="0" value={bill.subtotal} onChange={setSubtotal} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('tax') || 'Tax'} ({rate}%)</label>
              <NumberInput placeholder="0" value={bill.tax_amount} disabled />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t('total')}</label>
              <NumberInput placeholder="0" value={bill.total_amount} disabled className="font-bold" />
            </div>
          </div>

          {/* A failed create used to leave only a console message, so the
              button looked broken. */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />{error}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button
              onClick={() => onSubmit(bill)}
              className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={!canSubmit}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('create_bill') || 'Create Bill')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
