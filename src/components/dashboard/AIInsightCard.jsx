import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, ArrowRight } from "lucide-react";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const priorityColors = {
  high: "bg-red-500/10 text-red-600 border-red-200",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  low: "bg-blue-500/10 text-blue-600 border-blue-200"
};

export default function AIInsightCard({ insight }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <Card className="bg-gradient-to-br from-white via-white to-slate-50/50 border-slate-200/60 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
            <Badge className={priorityColors[insight.priority]}>
              {t(`priority_${insight.priority}`) || `${insight.priority} priority`}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {Math.round(insight.confidence * 100)}% {t("confidence")}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">{insight.title}</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{insight.description}</p>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <p className="text-sm text-slate-700 mb-3">
            <strong>{t("recommended_action")}:</strong> {insight.action}
          </p>
          <Button size="sm" variant="outline" className="w-full group">
            {t("take_action")}
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}