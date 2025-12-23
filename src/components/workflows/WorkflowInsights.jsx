import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Zap, TrendingUp, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200"
};

export default function WorkflowInsights({ insights }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const icons = [Zap, TrendingUp, Target, Brain];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[var(--genix-purple)] flex-shrink-0" />
          <h3 className="text-lg sm:text-xl font-bold text-[var(--genix-navy)]">Automation Intelligence</h3>
        </div>
        <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)] border-[var(--genix-purple)]/20">
          AI Insights
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {insights.map((insight, index) => {
          const Icon = icons[index] || Brain;
          return (
            <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon className="w-5 h-5 text-[var(--genix-purple)] flex-shrink-0" />
                    <CardTitle className="text-base sm:text-lg break-words">{insight.title}</CardTitle>
                  </div>
                  <Badge className={`${priorityColors[insight.priority]} flex-shrink-0`}>
                    {insight.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">{insight.description}</p>
                <div className="p-3 bg-[var(--genix-light-blue)]/30 rounded-lg">
                  <p className="text-xs sm:text-sm font-medium text-[var(--genix-blue)] break-words">
                    🚀 {insight.recommendation}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}