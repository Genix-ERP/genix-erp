import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, RefreshCw } from 'lucide-react';
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import ReorderRules from "./ReorderRules";
import Replenishment from "./Replenishment";

export default function Planning() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [activeSubTab, setActiveSubTab] = useState('reorder-rules');

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg">
          <TabsTrigger value="reorder-rules" className="data-[state=active]:bg-white">
            <Bell className="w-4 h-4 mr-2" />
            {t('reorder_rules') || 'Reorder Rules'}
          </TabsTrigger>
          <TabsTrigger value="replenishment" className="data-[state=active]:bg-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('replenishment') || 'Replenishment'}
          </TabsTrigger>
        </TabsList>

        {/* Reorder Rules Tab */}
        <TabsContent value="reorder-rules" className="mt-4">
          <ReorderRules />
        </TabsContent>

        {/* Replenishment Tab */}
        <TabsContent value="replenishment" className="mt-4">
          <Replenishment />
        </TabsContent>
      </Tabs>
    </div>
  );
}
