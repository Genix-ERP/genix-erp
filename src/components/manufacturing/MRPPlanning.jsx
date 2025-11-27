import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

export default function MRPPlanning() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [mrpResults, setMrpResults] = useState(null);

  const generateMRPPlan = async () => {
    setIsGenerating(true);
    try {
      // Get inventory and production data
      const [inventory, orders, boms] = await Promise.all([
        base44.entities.InventoryItem.list(),
        base44.entities.ProductionOrder.list(),
        base44.entities.BillOfMaterials.list()
      ]);

      // Use AI to generate MRP recommendations
      const plan = await base44.integrations.Core.InvokeLLM({
        prompt: `As a manufacturing planning AI, analyze this data and create an MRP (Material Requirements Planning) plan:

Inventory Items: ${inventory.length} items with varying stock levels
Active Production Orders: ${orders.filter(o => o.status === 'in_progress').length}
Available BOMs: ${boms.length}

Provide:
1. Materials to procure (what, when, how much)
2. Production schedule recommendations
3. Bottleneck identification
4. Lead time optimization suggestions
5. Risk assessment and mitigation

Format as actionable recommendations with priorities.`,
        response_json_schema: {
          type: "object",
          properties: {
            procurement_needs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  material: { type: "string" },
                  quantity: { type: "number" },
                  priority: { type: "string" },
                  lead_time_days: { type: "number" },
                  estimated_cost: { type: "number" }
                }
              }
            },
            production_schedule: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string" },
                  recommended_start: { type: "string" },
                  estimated_completion: { type: "string" },
                  priority: { type: "string" }
                }
              }
            },
            bottlenecks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  location: { type: "string" },
                  severity: { type: "string" },
                  mitigation: { type: "string" }
                }
              }
            },
            optimization_tips: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tip: { type: "string" },
                  impact: { type: "string" },
                  implementation_effort: { type: "string" }
                }
              }
            }
          }
        }
      });

      setMrpResults(plan);
    } catch (error) {
      console.error('Error generating MRP plan:', error);
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <Card className="bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl">AI-Powered MRP Planning</CardTitle>
                <p className="text-sm text-white/80 mt-1">Material Requirements Planning with Genix AI</p>
              </div>
            </div>
            <Button 
              onClick={generateMRPPlan} 
              disabled={isGenerating}
              className="bg-white text-slate-800 hover:bg-white/90"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-800 border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate MRP Plan
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {!mrpResults ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No MRP Plan Generated Yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Click "Generate MRP Plan" to get AI-powered recommendations for material procurement, 
              production scheduling, and optimization opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Procurement Needs */}
          {mrpResults.procurement_needs && mrpResults.procurement_needs.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Procurement Needs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mrpResults.procurement_needs.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{item.material}</h4>
                      <Badge className={
                        item.priority === 'high' ? 'bg-red-100 text-red-800' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }>
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Quantity: <span className="font-semibold">{item.quantity} units</span></p>
                      <p>Lead Time: <span className="font-semibold">{item.lead_time_days} days</span></p>
                      <p>Est. Cost: <span className="font-semibold">${item.estimated_cost?.toFixed(2) || 0}</span></p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Production Schedule */}
          {mrpResults.production_schedule && mrpResults.production_schedule.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Recommended Production Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mrpResults.production_schedule.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{item.product}</h4>
                      <Badge variant="outline">{item.priority}</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Start: <span className="font-medium">{item.recommended_start}</span></p>
                      <p>Complete: <span className="font-medium">{item.estimated_completion}</span></p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Bottlenecks */}
          {mrpResults.bottlenecks && mrpResults.bottlenecks.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Identified Bottlenecks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mrpResults.bottlenecks.map((item, index) => (
                  <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{item.location}</h4>
                      <Badge className={
                        item.severity === 'high' ? 'bg-red-100 text-red-800' :
                        item.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }>
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700"><strong>Mitigation:</strong> {item.mitigation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Optimization Tips */}
          {mrpResults.optimization_tips && mrpResults.optimization_tips.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Optimization Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mrpResults.optimization_tips.map((item, index) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-slate-900 mb-2">{item.tip}</p>
                    <div className="flex gap-2 text-xs">
                      <Badge className="bg-purple-100 text-purple-800">
                        Impact: {item.impact}
                      </Badge>
                      <Badge variant="outline">
                        Effort: {item.implementation_effort}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </div>
      )}

    </div>
  );
}