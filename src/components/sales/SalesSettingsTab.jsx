import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tag, Building2, ListChecks, CreditCard, Layers, Package } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import Discounts from './Discounts';
import Carriers from './Carriers';
import Pricelists from './Pricelists';
import PaymentTerms from './PaymentTerms';
import QuotationTemplates from './QuotationTemplates';
import Dropshipping from './Dropshipping';

const SUB_STYLE =
  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ' +
  'data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600';

/**
 * Savdo → Sozlamalar — the reference-data surfaces that used to be
 * scattered across top-level tabs (Chegirmalar, Tashuvchilar,
 * Dropshipping) or buried in unrelated tabs (Narx ro'yxatlari and
 * Shablonlar inside Takliflar, To'lov shartlari inside Buyurtmalar).
 */
export default function SalesSettingsTab({ initialSubtab = 'discounts' }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { getSetting } = useAdminSettings();
  const dropshippingEnabled = getSetting('sales.dropshipping.enabled');

  return (
    <Tabs defaultValue={initialSubtab} className="w-full">
      <TabsList className="bg-slate-100 p-1 rounded-lg inline-flex gap-1 h-auto mb-4 flex-wrap">
        <TabsTrigger value="discounts" className={SUB_STYLE}>
          <Tag className="w-4 h-4" />
          {t('discounts') || 'Chegirmalar'}
        </TabsTrigger>
        <TabsTrigger value="carriers" className={SUB_STYLE}>
          <Building2 className="w-4 h-4" />
          {t('carriers') || 'Tashuvchilar'}
        </TabsTrigger>
        <TabsTrigger value="pricelists" className={SUB_STYLE}>
          <ListChecks className="w-4 h-4" />
          {t('pricelists') || "Narx ro'yxatlari"}
        </TabsTrigger>
        <TabsTrigger value="payment-terms" className={SUB_STYLE}>
          <CreditCard className="w-4 h-4" />
          {t('paymentTerms') || "To'lov shartlari"}
        </TabsTrigger>
        <TabsTrigger value="templates" className={SUB_STYLE}>
          <Layers className="w-4 h-4" />
          {t('templates') || 'Shablonlar'}
        </TabsTrigger>
        {dropshippingEnabled && (
          <TabsTrigger value="dropshipping" className={SUB_STYLE}>
            <Package className="w-4 h-4" />
            {t('dropshipping') || 'Dropshipping'}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="discounts" className="mt-0">
        <Discounts />
      </TabsContent>
      <TabsContent value="carriers" className="mt-0">
        <Carriers />
      </TabsContent>
      <TabsContent value="pricelists" className="mt-0">
        <Pricelists />
      </TabsContent>
      <TabsContent value="payment-terms" className="mt-0">
        <PaymentTerms />
      </TabsContent>
      <TabsContent value="templates" className="mt-0">
        <QuotationTemplates />
      </TabsContent>
      {dropshippingEnabled && (
        <TabsContent value="dropshipping" className="mt-0">
          <Dropshipping />
        </TabsContent>
      )}
    </Tabs>
  );
}
