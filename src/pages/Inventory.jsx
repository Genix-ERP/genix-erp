
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
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
import { useInventory } from "@/components/contexts/InventoryContext";
import { analyzeInventory } from "@/api/services/aiAnalytics";

export default function Inventory() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    items,
    stockMovements,
    isLoading,
    createItem,
    updateItem
  } = useInventory();

  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [costingFilter, setCostingFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [insights, setInsights] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Generate AI-powered insights based on current data
  const generateInsights = useCallback(() => {
    const analysis = analyzeInventory(items, stockMovements);

    // Convert AI analytics insights to the expected format
    const aiInsights = analysis.insights.map(insight => ({
      title: insight.title,
      description: insight.description,
      recommendation: insight.items ? `Items: ${insight.items.slice(0, 3).join(', ')}${insight.items.length > 3 ? '...' : ''}` : 'Review and take action',
      financial_impact: insight.metric || 'See details',
      priority: insight.priority,
      action_required: insight.type === 'warning' || insight.type === 'negative' ? 'Immediate action required' : 'Monitor regularly'
    }));

    // Add recommendations as insights
    const recInsights = analysis.recommendations.map(rec => ({
      title: rec.action,
      description: rec.description,
      recommendation: rec.action,
      financial_impact: `Impact: ${rec.impact}`,
      priority: rec.impact === 'high' ? 'high' : 'medium',
      action_required: rec.action
    }));

    setInsights([...aiInsights, ...recInsights].slice(0, 6));
  }, [items, stockMovements]);

  // Generate static compliance check
  const checkCompliance = useCallback(() => {
    const fifoCount = items.filter(i => i.costing_method === 'fifo').length;
    const wacCount = items.filter(i => i.costing_method === 'weighted_average').length;
    const lifoCount = items.filter(i => i.costing_method === 'lifo').length;

    const hasLifo = lifoCount > 0;

    setCompliance({
      compliance_status: hasLifo ? "partially_compliant" : "compliant",
      standard_detected: hasLifo ? "US_GAAP" : "IFRS",
      issues: hasLifo ? [
        {
          issue: "LIFO costing method detected",
          severity: "warning",
          solution: "Consider switching to FIFO or Weighted Average for IFRS compliance"
        }
      ] : [],
      recommendations: [
        "Regular inventory audits recommended",
        "Maintain proper documentation for all stock movements",
        "Review costing methods annually"
      ]
    });
  }, [items]);

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
    if (items.length > 0) {
      generateInsights();
      checkCompliance();
    }
  }, [items, generateInsights, checkCompliance]);

  useEffect(() => {
    filterItems();
  }, [filterItems]);

  const handleAIQuery = () => {
    if (!aiQuery.trim()) return;

    const query = aiQuery.toLowerCase();
    const analysis = analyzeInventory(items, stockMovements);
    let response = "";

    const lowStockItems = items.filter(i => i.current_stock <= (i.reorder_level || 10));
    const deadStockItems = items.filter(i => i.status === 'dead_stock');
    const totalValue = items.reduce((sum, item) => sum + (item.current_stock * (item.unit_cost || 0)), 0);

    if (query.includes('low stock') || query.includes('reorder') || query.includes('out of stock')) {
      response = `**Low Stock Analysis**\n\nYou have **${lowStockItems.length}** items below reorder level:\n\n${lowStockItems.length > 0 ? lowStockItems.map(i => `- **${i.name}** (${i.sku})\n  Current: ${i.current_stock} units | Reorder at: ${i.reorder_level}`).join('\n\n') : 'All items are adequately stocked!'}\n\n**AI Recommendation:** ${lowStockItems.length > 0 ? 'Generate purchase orders for these items to avoid stockouts. Estimated stockout cost: $' + (lowStockItems.length * 500).toLocaleString() : 'Continue monitoring stock levels.'}`;
    } else if (query.includes('dead stock') || query.includes('not moving') || query.includes('slow')) {
      const deadValue = deadStockItems.reduce((sum, i) => sum + (i.current_stock * (i.unit_cost || 0)), 0);
      response = `**Dead Stock Analysis**\n\nYou have **${deadStockItems.length}** items classified as dead stock:\n\n${deadStockItems.length > 0 ? deadStockItems.map(i => `- **${i.name}** (${i.sku})\n  Value: $${(i.current_stock * (i.unit_cost || 0)).toLocaleString()}`).join('\n\n') : 'No dead stock detected - great inventory management!'}\n\n**Tied-up Capital:** $${deadValue.toLocaleString()}\n\n**AI Recommendation:** ${deadStockItems.length > 0 ? 'Consider liquidation sales, promotional bundles, or donation for tax benefits.' : 'Keep monitoring slow-moving items.'}`;
    } else if (query.includes('value') || query.includes('total') || query.includes('worth')) {
      const categories = [...new Set(items.map(i => i.category || 'uncategorized'))];
      response = `**Inventory Valuation Report**\n\n**Total Value:** $${totalValue.toLocaleString()}\n**Total SKUs:** ${items.length}\n**Total Units:** ${items.reduce((sum, i) => sum + i.current_stock, 0).toLocaleString()}\n\n**By Category:**\n${categories.map(cat => {
        const catItems = items.filter(i => (i.category || 'uncategorized') === cat);
        const catValue = catItems.reduce((sum, i) => sum + (i.current_stock * (i.unit_cost || 0)), 0);
        return `- **${cat}:** $${catValue.toLocaleString()} (${catItems.length} items)`;
      }).join('\n')}\n\n**AI Insight:** ${analysis.insights.length > 0 ? analysis.insights[0].description : 'Inventory levels are optimal.'}`;
    } else if (query.includes('abc') || query.includes('classification') || query.includes('priority')) {
      const aItems = items.filter(i => i.abc_classification === 'A');
      const bItems = items.filter(i => i.abc_classification === 'B');
      const cItems = items.filter(i => !i.abc_classification || i.abc_classification === 'C');
      response = `**ABC Classification Analysis**\n\n**A Items (High Priority):** ${aItems.length} items\n- High-value, fast-moving\n- Require close monitoring\n\n**B Items (Medium Priority):** ${bItems.length} items\n- Moderate value and velocity\n- Regular review needed\n\n**C Items (Low Priority):** ${cItems.length} items\n- Lower value, slower moving\n- Periodic review sufficient\n\n**AI Recommendation:** Focus reorder optimization on A-class items for maximum impact on revenue.`;
    } else if (query.includes('expir') || query.includes('expire') || query.includes('shelf life')) {
      const expiringItems = items.filter(i => i.expiration_date && new Date(i.expiration_date) < new Date(Date.now() + 30*24*60*60*1000));
      response = `**Expiration Alert**\n\n**Items expiring within 30 days:** ${expiringItems.length}\n\n${expiringItems.length > 0 ? expiringItems.map(i => `- **${i.name}** - Expires: ${new Date(i.expiration_date).toLocaleDateString()}`).join('\n') : 'No items expiring soon!'}\n\n**AI Recommendation:** ${expiringItems.length > 0 ? 'Consider promotional pricing or bundle deals to move these items before expiration.' : 'Continue regular expiration monitoring.'}`;
    } else if (query.includes('recommend') || query.includes('suggest') || query.includes('what should')) {
      response = `**AI Recommendations**\n\n${analysis.recommendations.map((rec, i) => `${i + 1}. **${rec.action}**\n   ${rec.description}\n   Impact: ${rec.impact}`).join('\n\n')}\n\n**Priority Actions:**\n${analysis.insights.filter(i => i.priority === 'high').map(i => `- ${i.title}: ${i.description}`).join('\n') || '- No critical issues detected'}`;
    } else {
      response = `**Inventory Intelligence Report**\n\n**Quick Stats:**\n- Total SKUs: ${items.length}\n- Total Value: $${totalValue.toLocaleString()}\n- Low Stock Items: ${lowStockItems.length}\n- Dead Stock Items: ${deadStockItems.length}\n\n**Key Insights:**\n${analysis.insights.slice(0, 3).map(i => `- **${i.title}:** ${i.description}`).join('\n')}\n\n**Try asking about:**\n- "Show me low stock items"\n- "What's my total inventory value?"\n- "ABC classification analysis"\n- "Items expiring soon"\n- "What do you recommend?"`;
    }

    setAiResponse(response);
  };

  const handleSave = (itemData) => {
    if (editingItem) {
      updateItem(editingItem.id, itemData);
    } else {
      createItem(itemData);
    }
    setShowForm(false);
    setEditingItem(null);
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
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-[var(--genix-purple)]" />
                  <span className="font-medium text-slate-700">AI Analysis:</span>
                </div>
                <div className="prose prose-sm max-w-none text-slate-600">
                  <ReactMarkdown>{aiResponse}</ReactMarkdown>
                </div>
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
                      <SelectItem value="office">Office</SelectItem>
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
