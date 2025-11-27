
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvokeLLM } from "@/api/integrations";
import { Target, TrendingUp, Clock, AlertTriangle, Zap, Brain } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ReorderOptimizer({ items, movements }) {
  const [reorderRecommendations, setReorderRecommendations] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationInsights, setOptimizationInsights] = useState(null);

  const generateReorderRecommendations = useCallback(async () => {
    setIsOptimizing(true);
    
    try {
      // Calculate basic metrics for each item
      const itemsWithMetrics = items.map(item => {
        const itemMovements = movements.filter(m => m.inventory_item_id === item.id);
        const outboundMovements = itemMovements.filter(m => m.movement_type === 'outbound');
        
        // Calculate sales velocity (units per day)
        const salesVelocity = outboundMovements.length > 0 
          ? outboundMovements.reduce((sum, m) => sum + (m.quantity || 0), 0) / 30 
          : item.sales_velocity || 1;

        // Calculate days of stock remaining
        const daysOfStock = salesVelocity > 0 ? item.current_stock / salesVelocity : 999;
        
        // Determine if reorder is needed
        const needsReorder = item.current_stock <= item.reorder_level;
        
        // Calculate optimal order quantity (Wilson EOQ approximation)
        const optimalOrderQty = Math.max(
          item.reorder_quantity || 50,
          Math.ceil(salesVelocity * (item.lead_time_days || 14) * 1.5) // Lead time + safety
        );

        return {
          ...item,
          calculatedVelocity: salesVelocity,
          daysOfStock,
          needsReorder,
          optimalOrderQty,
          riskLevel: daysOfStock < 7 ? 'high' : daysOfStock < 14 ? 'medium' : 'low'
        };
      });

      // Get AI optimization insights
      const lowStockItems = itemsWithMetrics.filter(item => item.needsReorder);
      const highRiskItems = itemsWithMetrics.filter(item => item.riskLevel === 'high');

      if (lowStockItems.length > 0) {
        const insights = await InvokeLLM({
          prompt: `Analyze these inventory items and provide reorder optimization insights:

          Items needing reorder: ${lowStockItems.length}
          High-risk items (< 7 days stock): ${highRiskItems.length}
          Total items analyzed: ${itemsWithMetrics.length}

          Sample items needing attention:
          ${lowStockItems.slice(0, 5).map(item => 
            `- ${item.name} (${item.sku}): ${item.current_stock} units, ${item.daysOfStock.toFixed(1)} days stock, velocity: ${item.calculatedVelocity.toFixed(1)}/day`
          ).join('\n')}

          Consider:
          - Seasonal factors and demand patterns
          - Supplier lead times and reliability  
          - Storage costs and cash flow impact
          - ABC classification priorities
          - Bulk discount opportunities

          Provide specific recommendations for inventory optimization.`,
          response_json_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              priority_actions: {
                type: "array",
                items: {
                  type: "object", 
                  properties: {
                    action: { type: "string" },
                    impact: { type: "string" },
                    priority: { type: "string", enum: ["urgent", "high", "medium", "low"] }
                  }
                }
              },
              cost_savings_potential: { type: "string" },
              recommendations: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });
        
        setOptimizationInsights(insights);
      }

      setReorderRecommendations(itemsWithMetrics.filter(item => item.needsReorder || item.riskLevel !== 'low'));
      
    } catch (error) {
      console.error("Error generating reorder recommendations:", error);
    }
    
    setIsOptimizing(false);
  }, [items, movements]); // Dependencies for useCallback: items and movements

  useEffect(() => {
    generateReorderRecommendations();
  }, [generateReorderRecommendations]); // Dependency for useEffect: memoized generateReorderRecommendations

  const getRiskColor = (riskLevel) => {
    const colors = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-green-100 text-green-800"
    };
    return colors[riskLevel] || colors.low;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: "bg-red-500 text-white",
      high: "bg-orange-500 text-white", 
      medium: "bg-yellow-500 text-white",
      low: "bg-blue-500 text-white"
    };
    return colors[priority] || colors.medium;
  };

  return (
    <div className="space-y-6">
      {/* AI Optimization Insights */}
      {optimizationInsights && (
        <Card className="bg-gradient-to-r from-[var(--genix-blue)]/5 to-[var(--genix-purple)]/5 border-[var(--genix-blue)]/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
              <CardTitle>AI Reorder Optimization</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700">{optimizationInsights.summary}</p>
            
            {optimizationInsights.priority_actions && (
              <div>
                <h4 className="font-semibold mb-2">Priority Actions</h4>
                <div className="space-y-2">
                  {optimizationInsights.priority_actions.map((action, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                      <Badge className={getPriorityColor(action.priority)}>
                        {action.priority}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{action.action}</p>
                        <p className="text-sm text-slate-600">{action.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {optimizationInsights.cost_savings_potential && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-800">Cost Savings Potential</span>
                </div>
                <p className="text-sm text-green-700">{optimizationInsights.cost_savings_potential}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reorder Recommendations */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[var(--genix-blue)]" />
              <CardTitle>Reorder Recommendations</CardTitle>
            </div>
            <Button 
              onClick={generateReorderRecommendations} 
              disabled={isOptimizing}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {isOptimizing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Refresh Analysis
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reorderRecommendations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Velocity</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Recommended Order</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reorderRecommendations.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-slate-500">{item.sku}</p>
                          {item.abc_classification && (
                            <Badge variant="outline" className="text-xs mt-1">
                              ABC: {item.abc_classification}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.current_stock}</span>
                          {item.needsReorder && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                              <span className="text-xs text-orange-600">
                                Below {item.reorder_level}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-medium ${item.daysOfStock < 7 ? 'text-red-600' : item.daysOfStock < 14 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {item.daysOfStock < 999 ? `${item.daysOfStock.toFixed(1)} days` : '999+ days'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{item.calculatedVelocity.toFixed(1)}/day</div>
                          <div className="text-slate-500">
                            {(item.calculatedVelocity * 30).toFixed(0)}/month
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRiskColor(item.riskLevel)}>
                          {item.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.optimalOrderQty} units</div>
                          <div className="text-sm text-slate-500">
                            ${(item.optimalOrderQty * item.unit_cost).toLocaleString()} value
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm"
                          variant={item.riskLevel === 'high' ? 'default' : 'outline'}
                          className={item.riskLevel === 'high' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                          {item.riskLevel === 'high' ? 'Order Now' : 'Schedule Order'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">All Stock Levels Optimal</h3>
              <p className="text-slate-500">
                No immediate reorder recommendations. Your inventory levels look healthy!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
