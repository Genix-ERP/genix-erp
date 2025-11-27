import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, AlertTriangle, CheckCircle, Clock, Brain, Bell } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [newContract, setNewContract] = useState({
    contract_number: '',
    contract_name: '',
    contract_type: 'customer',
    party_name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    contract_value: 0,
    billing_cycle: 'monthly',
    auto_renew: false
  });

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    let filtered = contracts;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contract_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.party_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredContracts(filtered);
  }, [contracts, searchQuery, statusFilter]);

  const loadContracts = async () => {
    try {
      const data = await base44.entities.Contract.list('-created_date', 100);
      
      // Update contract status based on dates
      const updatedContracts = data.map(contract => {
        if (!contract.end_date) return contract;
        
        const today = new Date();
        const endDate = new Date(contract.end_date);
        const daysUntilExpiry = differenceInDays(endDate, today);
        
        let status = contract.status;
        if (daysUntilExpiry < 0 && status === 'active') {
          status = 'expired';
        }
        
        return { ...contract, status, daysUntilExpiry };
      });
      
      setContracts(updatedContracts);
      setFilteredContracts(updatedContracts);
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
    setIsLoading(false);
  };

  const handleCreateContract = async () => {
    try {
      const contractData = {
        ...newContract,
        contract_number: newContract.contract_number || `CNT-${Date.now()}`,
        contract_value: parseFloat(newContract.contract_value),
        status: 'active'
      };
      
      await base44.entities.Contract.create(contractData);
      setShowCreateModal(false);
      loadContracts();
      
      setNewContract({
        contract_number: '',
        contract_name: '',
        contract_type: 'customer',
        party_name: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        contract_value: 0,
        billing_cycle: 'monthly',
        auto_renew: false
      });
    } catch (error) {
      console.error('Error creating contract:', error);
    }
  };

  const updateContractStatus = async (contractId, newStatus) => {
    try {
      await base44.entities.Contract.update(contractId, { status: newStatus });
      loadContracts();
    } catch (error) {
      console.error('Error updating contract:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      terminated: 'bg-orange-100 text-orange-800',
      renewed: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || colors.draft;
  };

  const getTypeColor = (type) => {
    const colors = {
      customer: 'bg-blue-100 text-blue-800',
      vendor: 'bg-purple-100 text-purple-800',
      employee: 'bg-green-100 text-green-800',
      partner: 'bg-orange-100 text-orange-800',
      lease: 'bg-pink-100 text-pink-800'
    };
    return colors[type] || colors.customer;
  };

  const metrics = {
    totalContracts: contracts.length,
    activeContracts: contracts.filter(c => c.status === 'active').length,
    totalValue: contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.contract_value || 0), 0),
    expiringSoon: contracts.filter(c => c.daysUntilExpiry >= 0 && c.daysUntilExpiry <= 30).length
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-pink-600 p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Contract Management</h1>
            <Badge className="bg-white/20 text-white border-white/30">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <p className="text-white/90">Manage contracts lifecycle with automated renewals and compliance tracking</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalContracts}</p>
              <p className="text-sm text-slate-600">Total Contracts</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.activeContracts}</p>
              <p className="text-sm text-slate-600">Active Contracts</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">${metrics.totalValue.toLocaleString()}</p>
              <p className="text-sm text-slate-600">Total Value</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metrics.expiringSoon}</p>
              <p className="text-sm text-slate-600">Expiring Soon</p>
            </CardContent>
          </Card>
        </div>

        {/* Contracts List */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>Contracts</CardTitle>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-rose-600 to-pink-600">
                <Plus className="w-4 h-4 mr-2" /> New Contract
              </Button>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search contracts..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="renewed">Renewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No contracts yet</p>
                <Button onClick={() => setShowCreateModal(true)} className="mt-4">Create First Contract</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredContracts.map((contract) => (
                  <Card key={contract.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-lg">{contract.contract_name}</h3>
                            <Badge className={getStatusColor(contract.status)}>{contract.status}</Badge>
                            <Badge className={getTypeColor(contract.contract_type)} variant="outline">
                              {contract.contract_type}
                            </Badge>
                            {contract.auto_renew && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Auto-Renew
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                            <div>
                              <p className="text-slate-500">Contract #</p>
                              <p className="font-mono font-semibold">{contract.contract_number}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Party</p>
                              <p className="font-medium">{contract.party_name}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Value</p>
                              <p className="font-semibold">${(contract.contract_value || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Billing</p>
                              <p className="font-medium">{contract.billing_cycle}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 mt-4 text-sm">
                            <div>
                              <span className="text-slate-500">Start: </span>
                              <span className="font-medium">
                                {contract.start_date ? format(new Date(contract.start_date), 'MMM dd, yyyy') : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">End: </span>
                              <span className="font-medium">
                                {contract.end_date ? format(new Date(contract.end_date), 'MMM dd, yyyy') : '-'}
                              </span>
                            </div>
                            {contract.daysUntilExpiry !== undefined && contract.daysUntilExpiry >= 0 && contract.daysUntilExpiry <= 30 && (
                              <div className="flex items-center gap-2 text-orange-600">
                                <Bell className="w-4 h-4" />
                                <span className="font-medium">Expires in {contract.daysUntilExpiry} days</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          {contract.status === 'active' && contract.daysUntilExpiry <= 30 && (
                            <Button size="sm" variant="outline" onClick={() => updateContractStatus(contract.id, 'renewed')}>
                              Renew
                            </Button>
                          )}
                          {contract.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => updateContractStatus(contract.id, 'terminated')}>
                              Terminate
                            </Button>
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

        {/* Create Contract Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Contract</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Contract Number</label>
                  <Input
                    placeholder="Auto-generated"
                    value={newContract.contract_number}
                    onChange={(e) => setNewContract({...newContract, contract_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Contract Type *</label>
                  <Select value={newContract.contract_type} onValueChange={(value) => setNewContract({...newContract, contract_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Contract Name *</label>
                <Input
                  placeholder="Contract name"
                  value={newContract.contract_name}
                  onChange={(e) => setNewContract({...newContract, contract_name: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Party Name *</label>
                <Input
                  placeholder="Company or person name"
                  value={newContract.party_name}
                  onChange={(e) => setNewContract({...newContract, party_name: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Date *</label>
                  <Input
                    type="date"
                    value={newContract.start_date}
                    onChange={(e) => setNewContract({...newContract, start_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Date *</label>
                  <Input
                    type="date"
                    value={newContract.end_date}
                    onChange={(e) => setNewContract({...newContract, end_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Contract Value *</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newContract.contract_value}
                    onChange={(e) => setNewContract({...newContract, contract_value: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Billing Cycle</label>
                  <Select value={newContract.billing_cycle} onValueChange={(value) => setNewContract({...newContract, billing_cycle: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                      <SelectItem value="one_time">One Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_renew"
                  checked={newContract.auto_renew}
                  onChange={(e) => setNewContract({...newContract, auto_renew: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="auto_renew" className="text-sm font-medium">
                  Enable auto-renewal
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateContract} 
                  className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600"
                  disabled={!newContract.contract_name || !newContract.party_name}
                >
                  Create Contract
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}