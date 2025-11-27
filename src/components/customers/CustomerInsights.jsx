
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, Target, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/utils/translations";

export default function CustomerInsights({ insights, language = 'en' }) {
  const { t } = useTranslation(language);
  const icons = [Users, Target, DollarSign, Brain];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
        <h3 className="text-xl font-bold text-[var(--genix-navy)]">{t('crm_intelligence')}</h3>
        <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">{t('ai_powered')}</Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights.map((insight, index) => {
          const Icon = icons[index] || Brain;
          return (
            <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-[var(--genix-purple)]" />
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                  </div>
                  <Badge className={`text-xs ${
                    insight.priority === 'high' ? 'bg-red-100 text-red-800' :
                    insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {insight.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600 leading-relaxed">{insight.description}</p>
                <div className="p-3 bg-[var(--genix-light-blue)]/30 rounded-lg">
                  <p className="text-sm font-medium text-[var(--genix-blue)]">
                    💡 {insight.recommendation}
                  </p>
                </div>
                {insight.impact && (
                  <p className="text-xs text-slate-500">
                    <strong>{t('expected_impact')}:</strong> {insight.impact}
                  </p>
                )}
                <Button variant="outline" size="sm" className="w-full mt-3">
                  {t('take_action')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
