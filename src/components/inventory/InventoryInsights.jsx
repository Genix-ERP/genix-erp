import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, Target, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function InventoryInsights({ insights }) {
  const icons = [Brain, TrendingUp, Target, DollarSign];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
        <h3 className="text-xl font-bold text-[var(--genix-navy)]">AI Inventory Insights</h3>
        <Badge className="bg-[var(--genix-purple)]/10 text-[var(--genix-purple)]">Live Analysis</Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights.map((insight, index) => {
          const Icon = icons[index] || Brain;
          return (
            <Card key={index} className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-[var(--genix-purple)]" />
                  <CardTitle className="text-lg">{insight.title}</CardTitle>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}