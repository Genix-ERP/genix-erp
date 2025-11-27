import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, AlertTriangle, Target, ArrowRight } from "lucide-react";

const urgencyColors = {
  high: "bg-red-500/10 text-red-600 border-red-200",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  low: "bg-blue-500/10 text-blue-600 border-blue-200"
};

export default function CRMInsights({ insights }) {
  if (!insights || !insights.insights) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
        <h3 className="text-xl font-bold text-[var(--genix-navy)]">AI Sales Intelligence</h3>
        <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">Live Analysis</Badge>
      </div>

      {/* Revenue Forecast */}
      {insights.revenue_forecast && (
        <Card className="bg-gradient-to-r from-[var(--genix-blue)]/5 to-[var(--genix-purple)]/5 border-[var(--genix-blue)]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[var(--genix-blue)]" />
              <span className="font-semibold text-[var(--genix-navy)]">Revenue Forecast</span>
            </div>
            <p className="text-slate-700">{insights.revenue_forecast}</p>
          </CardContent>
        </Card>
      )}

      {/* Top Priorities */}
      {insights.top_priorities && insights.top_priorities.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-orange-600" />
              Priority Actions Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.top_priorities.map((priority, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <span className="font-medium">{priority}</span>
                  <Button size="sm" variant="outline">
                    Take Action
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights.insights.map((insight, index) => {
          const icons = [TrendingUp, Target, AlertTriangle, Brain];
          const Icon = icons[index] || Brain;
          
          return (
            <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-[var(--genix-purple)]" />
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                  </div>
                  <Badge className={urgencyColors[insight.urgency || 'medium']}>
                    {insight.urgency || 'medium'}
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
                    <strong>Expected Impact:</strong> {insight.impact}
                  </p>
                )}
                <Button size="sm" className="w-full mt-3 group">
                  Implement Now
                  <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}