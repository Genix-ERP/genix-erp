import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kanban, DollarSign, Calendar } from "lucide-react";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const stages = [
  { id: 'qualification', name: 'Qualification', color: 'bg-blue-100 text-blue-800' },
  { id: 'needs_analysis', name: 'Needs Analysis', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'proposal', name: 'Proposal', color: 'bg-purple-100 text-purple-800' },
  { id: 'negotiation', name: 'Negotiation', color: 'bg-orange-100 text-orange-800' },
  { id: 'closed_won', name: 'Closed Won', color: 'bg-green-100 text-green-800' },
  { id: 'closed_lost', name: 'Closed Lost', color: 'bg-red-100 text-red-800' }
];

export default function PipelineKanban({ opportunities, leads }) {
  const { formatCurrency } = useCurrencyFormatter();
  const getOpportunitiesByStage = (stageId) => {
    return opportunities.filter(opp => opp.stage === stageId);
  };

  const getTotalValueByStage = (stageId) => {
    return getOpportunitiesByStage(stageId).reduce((sum, opp) => sum + (opp.expected_value || 0), 0);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Kanban className="w-5 h-5 text-[var(--genix-blue)]" />
            Sales Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            {stages.map((stage) => {
              const stageOpportunities = getOpportunitiesByStage(stage.id);
              const stageValue = getTotalValueByStage(stage.id);
              
              return (
                <div key={stage.id} className="bg-slate-50/80 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">{stage.name}</h3>
                    <Badge className={stage.color}>
                      {stageOpportunities.length}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      <span>{formatCurrency(stageValue)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stageOpportunities.map((opp) => (
                      <Card key={opp.id} className="bg-white border border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm text-slate-900 mb-1">{opp.name}</h4>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Value</span>
                              <span className="text-xs font-medium text-green-600">
                                {formatCurrency(opp.expected_value || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Probability</span>
                              <span className="text-xs font-medium">
                                {opp.probability || 0}%
                              </span>
                            </div>
                            {opp.expected_close_date && (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(opp.expected_close_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lead Summary */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle>Lead Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{leads.length}</div>
              <div className="text-sm text-slate-600">Total Leads</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {leads.filter(l => l.status === 'qualified').length}
              </div>
              <div className="text-sm text-slate-600">Qualified</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {opportunities.filter(o => !['closed_won', 'closed_lost'].includes(o.stage)).length}
              </div>
              <div className="text-sm text-slate-600">Active Opportunities</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {leads.length > 0 ? Math.round(opportunities.filter(o => o.stage === 'closed_won').length / leads.length * 100) : 0}%
              </div>
              <div className="text-sm text-slate-600">Conversion Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}