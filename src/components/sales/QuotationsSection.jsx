import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Tag, Layers } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import Quotations from './Quotations';
import Pricelists from './Pricelists';
import QuotationTemplates from './QuotationTemplates';

export default function QuotationsSection() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [activeSubTab, setActiveSubTab] = useState('quotations');

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-slate-100/80 p-1 rounded-lg">
          <TabsTrigger
            value="quotations"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileText className="w-4 h-4" />
            {t('quotations') || 'Quotations'}
          </TabsTrigger>
          <TabsTrigger
            value="pricelists"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Tag className="w-4 h-4" />
            {t('pricelists') || 'Pricelists'}
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Layers className="w-4 h-4" />
            {t('templates') || 'Templates'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="mt-4">
          <Quotations />
        </TabsContent>

        <TabsContent value="pricelists" className="mt-4">
          <Pricelists />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <QuotationTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}
