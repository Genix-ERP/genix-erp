
import React, { useState, useEffect, useCallback } from "react";
import { InventoryItem, StockMovement } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  TrendingUp,
  Filter,
  Download,
  Brain,
  BarChart3,
  MessageSquare,
  Calculator,
  Clock,
  Target,
  Zap
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import InventoryForm from "@/components/inventory/InventoryForm";
import InventoryInsights from "@/components/inventory/InventoryInsights";
import COGSCalculator from "@/components/inventory/COGSCalculator";
import StockMovementTracker from "@/components/inventory/StockMovementTracker";
import CompliancePanel from "@/components/inventory/CompliancePanel";
import ReorderOptimizer from "@/components/inventory/ReorderOptimizer";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Inventory() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [items, setItems] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [costingFilter, setCostingFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [insights, setInsights] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await InventoryItem.list("-last_movement_date");
      setItems(data);
    } catch (error) {
      console.error("Error loading inventory:", error);
    }
    setIsLoading(false);
  }, []);

  const loadStockMovements = useCallback(async () => {
    try {
      const data = await StockMovement.list("-movement_date", 100);
      setStockMovements(data);
    } catch (error) {
      console.error("Error loading stock movements:", error);
    }
  }, []);

  const calculateInventoryTurnover = useCallback((inventory, movements) => {
    const totalCOGS = movements
      .filter(m => m.movement_type === 'outbound' && m.cogs_calculated)
      .reduce((sum, m) => sum + (m.cogs_calculated || 0), 0);
    
    const avgInventoryValue = inventory.reduce((sum, item) => sum + (item.current_stock * item.unit_cost), 0) / inventory.length;
    
    return avgInventoryValue > 0 ? (totalCOGS / avgInventoryValue).toFixed(1) : 0;
  }, []);

  const generateInsights = useCallback(async () => {
    try {
      const inventoryData = await InventoryItem.list();
      const movementData = await StockMovement.list("-movement_date", 50);
      
      const lowStockCount = inventoryData.filter(item => item.current_stock <= item.reorder_level).length;
      const deadStockCount = inventoryData.filter(item => item.status === "dead_stock").length;
      const totalValue = inventoryData.reduce((sum, item) => sum + (item.current_stock * item.unit_cost), 0);
      const avgTurnover = calculateInventoryTurnover(inventoryData, movementData);

      const insightsResult = await InvokeLLM({
        prompt: `You are the Inventory & Supply Chain AI of Genix. Analyze this advanced inventory data and provide actionable FIFO-compliant insights:

        Inventory Overview:
        - Total items: ${inventoryData.length}
        - Low stock items: ${lowStockCount} (need reordering)
        - Dead stock items: ${deadStockCount} (not moving)
        - Total inventory value: $${totalValue.toLocaleString()}
        - Average inventory turnover: ${avgTurnover}x per year
        
        Costing Methods in Use:
        - FIFO items: ${inventoryData.filter(i => i.costing_method === 'fifo').length}
        - Weighted Average items: ${inventoryData.filter(i => i.costing_method === 'weighted_average').length}
        - LIFO items: ${inventoryData.filter(i => i.costing_method === 'lifo').length}

        Provide 4 strategic insights focusing on:
        1. FIFO optimization and COGS accuracy
        2. Reorder timing and safety stock levels based on sales velocity and lead times.
        3. Dead stock elimination strategies and financial impact.
        4. Compliance risks (e.g., LIFO under IFRS).
        
        Each insight must be actionable and include estimated financial impact.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                  financial_impact: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  action_required: { type: "string" }
                }
              }
            }
          }
        }
      });
      setInsights(insightsResult.insights);
    } catch (error) {
      console.error("Error generating insights:", error);
    }
  }, [calculateInventoryTurnover]);

  const checkCompliance = useCallback(async () => {
    try {
      const inventoryData = await InventoryItem.list();
      const movementData = await StockMovement.list("-movement_date", 100);

      const complianceCheckResult = await InvokeLLM({
        prompt: `Analyze inventory compliance status:

        Current Setup:
        - Total inventory items: ${inventoryData.length}
        - FIFO items: ${inventoryData.filter(i => i.costing_method === 'fifo').length}
        - WAC items: ${inventoryData.filter(i => i.costing_method === 'weighted_average').length}
        - LIFO items: ${inventoryData.filter(i => i.costing_method === 'lifo').length}
        
        Check for:
        1. IFRS compliance (FIFO/WAC only, no LIFO)
        2. US GAAP compliance (all methods allowed)
        3. Proper cost flow assumptions
        4. Audit trail completeness
        5. Expiry tracking for perishables

        Provide compliance status and recommendations.`,
        response_json_schema: {
          type: "object",
          properties: {
            compliance_status: { type: "string", enum: ["compliant", "partially_compliant", "non_compliant"] },
            standard_detected: { type: "string", enum: ["IFRS", "US_GAAP", "MIXED"] },
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issue: { type: "string" },
                  severity: { type: "string", enum: ["critical", "warning", "info"] },
                  solution: { type: "string" }
                }
              }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });
      setCompliance(complianceCheckResult);
    } catch (error) {
      console.error("Error checking compliance:", error);
    }
  }, []);

  const filterItems = useCallback(() => {
    let filtered = items;

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (costingFilter !== "all") {
      filtered = filtered.filter(item => item.costing_method === costingFilter);
    }

    setFilteredItems(filtered);
  }, [items, searchQuery, categoryFilter, statusFilter, costingFilter]);

  useEffect(() => {
    loadInventory();
    loadStockMovements();
    generateInsights();
    checkCompliance();
  }, [loadInventory, loadStockMovements, generateInsights, checkCompliance]);

  useEffect(() => {
    filterItems();
  }, [filterItems]);

  const handleAIQuery = async () => {
    if (!aiQuery.trim()) return;

    try {
      const response = await InvokeLLM({
        prompt: `You are the Inventory & Supply Chain AI of Genix. A user is asking a question about inventory.
        User Query: "${aiQuery}"
        
        Your Mission: Answer the query by analyzing real-time data, forecasting demand, and optimizing replenishment. Adhere to costing rules (default FIFO). Explain any recommendations in simple business terms with financial impact.
        
        Current Inventory Context:
        - Total SKUs: ${items.length}
        - Items needing reorder (below reorder level): ${items.filter(i => i.current_stock <= i.reorder_level).length}
        - Items expiring in 90 days: ${items.filter(i => i.expiration_date && new Date(i.expiration_date) < new Date(Date.now() + 90*24*60*60*1000)).length}
        - Potential dead stock (no movement in 180 days): ${items.filter(i => i.status === 'dead_stock').length}
        
        Provide a structured, actionable response.`,
        add_context_from_internet: false
      });

      setAiResponse(response);
    } catch (error) {
      console.error("Error processing AI query:", error);
      setAiResponse("Sorry, I encountered an error processing your request. Please try again.");
    }
  };

  const handleSave = async (itemData) => {
    try {
      if (editingItem) {
        await InventoryItem.update(editingItem.id, itemData);
      } else {
        await InventoryItem.create(itemData);
      }
      loadInventory();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving item:", error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      low_stock: "bg-yellow-100 text-yellow-800",
      backordered: "bg-red-100 text-red-800",
      discontinued: "bg-gray-100 text-gray-800",
      overstock: "bg-blue-100 text-blue-800",
      dead_stock: "bg-purple-100 text-purple-800"
    };
    return colors[status] || colors.active;
  };

  const getCostingMethodColor = (method) => {
    const colors = {
      fifo: "bg-green-100 text-green-800",
      weighted_average: "bg-blue-100 text-blue-800",
      lifo: "bg-orange-100 text-orange-800"
    };
    return colors[method] || colors.fifo;
  };

  const calculateMetrics = () => {
    const totalValue = items.reduce((sum, item) => sum + (item.current_stock * item.unit_cost), 0);
    const lowStockItems = items.filter(item => item.current_stock <= item.reorder_level);
    const deadStockItems = items.filter(item => item.status === 'dead_stock');
    const expiringItems = items.filter(item => 
      item.expiration_date && new Date(item.expiration_date) < new Date(Date.now() + 30*24*60*60*1000)
    );
    
    return {
      totalValue,
      lowStockCount: lowStockItems.length,
      deadStockCount: deadStockItems.length,
      expiringCount: expiringItems.length,
      totalItems: items.reduce((sum, item) => sum + item.current_stock, 0),
      totalSKUs: items.length,
      fifoItems: items.filter(item => item.costing_method === 'fifo').length,
      wacItems: items.filter(item => item.costing_method === 'weighted_average').length,
      lifoItems: items.filter(item => item.costing_method === 'lifo').length
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--genix-navy)]">{t('inventory_title')}</h1>
            <p className="text-slate-600 mt-2">{t('inventory_subtitle')}</p>
            {compliance && (
              <Badge className={`mt-2 ${compliance.compliance_status === 'compliant' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {compliance.standard_detected} {compliance.compliance_status}
              </Badge>
            )}
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('add_item')}
          </Button>
        </div>

        {/* AI Query Interface */}
        <Card className="bg-gradient-to-r from-[var(--genix-blue)]/5 to-[var(--genix-purple)]/5 border-[var(--genix-blue)]/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-[var(--genix-purple)]" />
              <h3 className="font-semibold text-[var(--genix-navy)]">{t('inventory_ai_assistant')}</h3>
            </div>
            <div className="flex gap-3">
              <Textarea
                placeholder="Ask me anything about your inventory... e.g., 'Show me products expiring in 30 days' or 'Optimize safety stock for high-demand SKUs'"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button onClick={handleAIQuery} className="px-6">
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask AI
              </Button>
            </div>
            {aiResponse && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-[var(--genix-purple)]" />
                  <span className="font-medium text-slate-700">AI Analysis:</span>
                </div>
                <p className="text-slate-600 whitespace-pre-wrap">{aiResponse}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('total_value')}</p>
                  <p className="text-lg font-bold text-slate-900">${metrics.totalValue.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('low_stock')}</p>
                  <p className="text-lg font-bold text-orange-600">{metrics.lowStockCount}</p>
                </div>
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('dead_stock')}</p>
                  <p className="text-lg font-bold text-purple-600">{metrics.deadStockCount}</p>
                </div>
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('expiring_soon')}</p>
                  <p className="text-lg font-bold text-red-600">{metrics.expiringCount}</p>
                </div>
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('fifo_items')}</p>
                  <p className="text-lg font-bold text-green-600">{metrics.fifoItems}</p>
                </div>
                <Target className="w-6 h-6 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{t('wac_items')}</p>
                  <p className="text-lg font-bold text-blue-600">{metrics.wacItems}</p>
                </div>
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Panel */}
        {compliance && <CompliancePanel compliance={compliance} />}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="cogs">COGS Calculator</TabsTrigger>
            <TabsTrigger value="reorder">Reorder Optimizer</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Filters */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search inventory..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="apparel">Apparel</SelectItem>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="pharmaceutical">Pharmaceutical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                      <SelectItem value="dead_stock">Dead Stock</SelectItem>
                      <SelectItem value="overstock">Overstock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={costingFilter} onValueChange={setCostingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Costing Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="fifo">FIFO</SelectItem>
                      <SelectItem value="weighted_average">Weighted Average</SelectItem>
                      <SelectItem value="lifo">LIFO</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Table */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle>Inventory Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Costing</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Velocity</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80">
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-900">{item.name}</p>
                              <p className="text-sm text-slate-500">{item.sku}</p>
                              {item.expiration_date && new Date(item.expiration_date) < new Date(Date.now() + 30*24*60*60*1000) && (
                                <Badge className="bg-red-100 text-red-800 text-xs mt-1">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Expires Soon
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{item.current_stock}</span>
                              {item.current_stock <= item.reorder_level && (
                                <div className="flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                                  <span className="text-xs text-orange-600">Reorder at {item.reorder_level}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getCostingMethodColor(item.costing_method)}>
                              {item.costing_method?.toUpperCase() || 'FIFO'}
                            </Badge>
                          </TableCell>
                          <TableCell>${(item.current_stock * item.unit_cost).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{item.sales_velocity || 0} units/day</div>
                              <div className="text-slate-500">ABC: ${item.abc_classification || 'C'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item);
                                setShowForm(true);
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movements">
            <StockMovementTracker movements={stockMovements} items={items} />
          </TabsContent>

          <TabsContent value="cogs">
            <COGSCalculator items={items} movements={stockMovements} />
          </TabsContent>

          <TabsContent value="reorder">
            <ReorderOptimizer items={items} movements={stockMovements} />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>Inventory Turnover Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-600">Advanced analytics coming soon</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>ABC Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {items.filter(i => i.abc_classification === 'A').length}
                        </div>
                        <div className="text-sm text-slate-600">A Items</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {items.filter(i => i.abc_classification === 'B').length}
                        </div>
                        <div className="text-sm text-slate-600">B Items</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-lg">
                        <div className="text-2xl font-bold text-slate-600">
                          {items.filter(i => i.abc_classification === 'C' || !i.abc_classification).length}
                        </div>
                        <div className="text-sm text-slate-600">C Items</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Form Modal */}
        {showForm && (
          <InventoryForm
            item={editingItem}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingItem(null);
            }}
          />
        )}
        
        {/* AI Insights - Moved to bottom */}
        {insights && <InventoryInsights insights={insights} />}
      </div>
    </div>
  );
}
