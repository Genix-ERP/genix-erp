import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Monitor, TrendingDown, Wrench, DollarSign, AlertTriangle, Brain } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [newAsset, setNewAsset] = useState({
    asset_name: '',
    asset_code: '',
    asset_category: 'equipment',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: 0,
    useful_life_years: 5,
    depreciation_method: 'straight_line'
  });

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    let filtered = assets;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => a.asset_category === categoryFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.asset_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.asset_code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredAssets(filtered);
  }, [assets, searchQuery, categoryFilter]);

  const loadAssets = async () => {
    try {
      const data = await base44.entities.FixedAsset.list('-created_date', 100);
      
      // Calculate depreciation
      const assetsWithDepreciation = data.map(asset => {
        const purchaseDate = new Date(asset.purchase_date);
        const yearsElapsed = (new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 365);
        const annualDepreciation = (asset.purchase_cost - (asset.salvage_value || 0)) / asset.useful_life_years;
        const accumulated = Math.min(annualDepreciation * yearsElapsed, asset.purchase_cost - (asset.salvage_value || 0));
        const currentValue = asset.purchase_cost - accumulated;
        
        return {
          ...asset,
          accumulated_depreciation: accumulated,
          current_value: currentValue
        };
      });
      
      setAssets(assetsWithDepreciation);
      setFilteredAssets(assetsWithDepreciation);
    } catch (error) {
      console.error('Error loading assets:', error);
    }
    setIsLoading(false);
  };

  const handleCreateAsset = async () => {
    try {
      const assetData = {
        ...newAsset,
        asset_code: newAsset.asset_code || `AST-${Date.now()}`,
        purchase_cost: parseFloat(newAsset.purchase_cost),
        useful_life_years: parseInt(newAsset.useful_life_years),
        current_value: parseFloat(newAsset.purchase_cost),
        accumulated_depreciation: 0,
        status: 'active'
      };
      
      await base44.entities.FixedAsset.create(assetData);
      setShowCreateModal(false);
      loadAssets();
      
      setNewAsset({
        asset_name: '',
        asset_code: '',
        asset_category: 'equipment',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_cost: 0,
        useful_life_years: 5,
        depreciation_method: 'straight_line'
      });
    } catch (error) {
      console.error('Error creating asset:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      disposed: 'bg-gray-100 text-gray-800',
      under_maintenance: 'bg-yellow-100 text-yellow-800',
      retired: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.active;
  };

  const metrics = {
    totalAssets: assets.length,
    totalValue: assets.reduce((sum, a) => sum + (a.purchase_cost || 0), 0),
    currentValue: assets.reduce((sum, a) => sum + (a.current_value || 0), 0),
    totalDepreciation: assets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0)
  };

  const categoryData = {};
  assets.forEach(a => {
    categoryData[a.asset_category] = (categoryData[a.asset_category] || 0) + (a.current_value || 0);
  });
  const chartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Fixed Assets</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Track, manage, and optimize your fixed assets with automated depreciation</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalAssets}</p>
              <p className="text-sm text-slate-600">Total Assets</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalValue.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Purchase Value</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.currentValue.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Current Value</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalDepreciation.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Depreciation</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Category Distribution */}
          {chartData.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Assets by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.name}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Assets List */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Fixed Assets</CardTitle>
                <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-orange-600 to-amber-600">
                  <Plus className="w-4 h-4 mr-2" /> New Asset
                </Button>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search assets..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="machinery">Machinery</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="vehicles">Vehicles</SelectItem>
                    <SelectItem value="buildings">Buildings</SelectItem>
                    <SelectItem value="computers">Computers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-16">
                  <Monitor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No assets yet</p>
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">Add First Asset</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssets.map((asset) => (
                    <Card key={asset.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-lg">{asset.asset_name}</h3>
                              <Badge className={getStatusColor(asset.status)}>{asset.status}</Badge>
                              <Badge variant="outline">{asset.asset_category}</Badge>
                            </div>
                            <p className="text-sm text-slate-500 mb-3">{asset.asset_code}</p>
                            
                            <div className="grid grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500">Purchase Cost</p>
                                <p className="font-semibold">${(asset.purchase_cost || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Current Value</p>
                                <p className="font-semibold text-green-600">${(asset.current_value || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Depreciation</p>
                                <p className="font-semibold text-orange-600">${(asset.accumulated_depreciation || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Method</p>
                                <p className="font-medium">{asset.depreciation_method}</p>
                              </div>
                            </div>

                            {asset.next_maintenance_date && (
                              <div className="mt-3 flex items-center gap-2 text-sm">
                                <Wrench className="w-4 h-4 text-yellow-600" />
                                <span className="text-slate-600">Next maintenance: {asset.next_maintenance_date}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Asset Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Fixed Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Asset Name *</label>
                  <Input
                    placeholder="Asset name"
                    value={newAsset.asset_name}
                    onChange={(e) => setNewAsset({...newAsset, asset_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Asset Code</label>
                  <Input
                    placeholder="Auto-generated"
                    value={newAsset.asset_code}
                    onChange={(e) => setNewAsset({...newAsset, asset_code: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Category *</label>
                  <Select value={newAsset.asset_category} onValueChange={(value) => setNewAsset({...newAsset, asset_category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="machinery">Machinery</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="vehicles">Vehicles</SelectItem>
                      <SelectItem value="buildings">Buildings</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="computers">Computers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Purchase Date *</label>
                  <Input
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({...newAsset, purchase_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Purchase Cost *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newAsset.purchase_cost}
                    onChange={(e) => setNewAsset({...newAsset, purchase_cost: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Useful Life (years) *</label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={newAsset.useful_life_years}
                    onChange={(e) => setNewAsset({...newAsset, useful_life_years: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Depreciation Method</label>
                  <Select value={newAsset.depreciation_method} onValueChange={(value) => setNewAsset({...newAsset, depreciation_method: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">Straight Line</SelectItem>
                      <SelectItem value="declining_balance">Declining Balance</SelectItem>
                      <SelectItem value="units_of_production">Units of Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateAsset} 
                  className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600"
                  disabled={!newAsset.asset_name || !newAsset.purchase_cost}
                >
                  Add Asset
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}