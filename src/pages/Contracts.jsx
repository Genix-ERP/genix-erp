import React, { useState, useEffect, useMemo } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, AlertTriangle, CheckCircle, Clock, Brain, Bell, Target, Lightbulb, Eye, Edit2, Trash2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { analyzeContracts } from '@/api/services/aiAnalytics';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function Contracts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { contracts, createContract, updateContract, deleteContract, isLoading } = useModules();

  // AI Analysis
  const contractAnalysis = useMemo(() => analyzeContracts(contracts, language), [contracts, language]);
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenewalConfirmModal, setShowRenewalConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNoExpiringModal, setShowNoExpiringModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [editContract, setEditContract] = useState(null);
  const [contractToDelete, setContractToDelete] = useState(null);
  const [renewalData, setRenewalData] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    let filtered = contracts.map(contract => {
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

  const handleCreateContract = async () => {
    setIsSubmitting(true);
    try {
      const contractData = {
        ...newContract,
        contract_number: newContract.contract_number || `CNT-${Date.now()}`,
        contract_value: parseFloat(newContract.contract_value),
        status: 'active'
      };

      await createContract(contractData);
      setShowCreateModal(false);

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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewContract = (contract) => {
    setSelectedContract(contract);
    setShowViewModal(true);
  };

  const handleEditContract = (contract) => {
    setEditContract({
      ...contract,
      contract_value: contract.contract_value || 0,
      start_date: contract.start_date?.split('T')[0] || '',
      end_date: contract.end_date?.split('T')[0] || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateContract = async () => {
    if (!editContract) return;

    setIsSubmitting(true);
    try {
      updateContract(editContract.id, {
        contract_number: editContract.contract_number,
        contract_name: editContract.contract_name,
        contract_type: editContract.contract_type,
        party_name: editContract.party_name,
        start_date: editContract.start_date,
        end_date: editContract.end_date,
        contract_value: parseFloat(editContract.contract_value) || 0,
        billing_cycle: editContract.billing_cycle,
        auto_renew: editContract.auto_renew,
        status: editContract.status
      });
      setShowEditModal(false);
      setEditContract(null);
    } catch (error) {
      console.error('Error updating contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContract = (contract) => {
    setContractToDelete(contract);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (contractToDelete) {
      deleteContract(contractToDelete.id);
      setShowDeleteModal(false);
      setContractToDelete(null);
    }
  };

  const updateContractStatus = (contractId, newStatus) => {
    updateContract(contractId, { status: newStatus });
  };

  // Handle renewal action
  const handleInitiateRenewals = () => {
    // Find expiring contracts from ALL contracts (not just filtered ones)
    const allContractsWithExpiry = contracts.map(contract => {
      if (!contract.end_date) return contract;

      const today = new Date();
      const endDate = new Date(contract.end_date);
      const daysUntilExpiry = differenceInDays(endDate, today);

      return { ...contract, daysUntilExpiry };
    });

    const expiringContracts = allContractsWithExpiry.filter(c =>
      c.status === 'active' && c.daysUntilExpiry >= 0 && c.daysUntilExpiry <= 30
    );

    if (expiringContracts.length === 0) {
      setShowNoExpiringModal(true);
      return;
    }

    setRenewalData(expiringContracts);
    setShowRenewalConfirmModal(true);
  };

  const confirmRenewal = () => {
    if (renewalData) {
      // Bulk renew expiring contracts
      renewalData.forEach(contract => {
        updateContractStatus(contract.id, 'renewed');
      });

      const successMsg = language === 'uz'
        ? `${renewalData.length} ta shartnoma muvaffaqiyatli yangilandi`
        : `${renewalData.length} contracts successfully renewed`;

      setSuccessMessage(successMsg);
      setShowRenewalConfirmModal(false);
      setRenewalData(null);
      setShowSuccessModal(true);
    }
  };

  // Handle contract review action - Trigger AI chatbox
  const handleContractReview = () => {
    // Reset filters to show all contracts
    setStatusFilter('all');
    setSearchQuery('');

    // Prepare contract data summary
    const activeCount = contracts.filter(c => c.status === 'active').length;
    const expiringCount = contracts.filter(c => {
      if (!c.end_date || c.status !== 'active') return false;
      const daysUntil = differenceInDays(new Date(c.end_date), new Date());
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
    const totalValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);

    // Get detailed contract information for expiring contracts
    const expiringDetails = contracts
      .filter(c => {
        if (!c.end_date || c.status !== 'active') return false;
        const daysUntil = differenceInDays(new Date(c.end_date), new Date());
        return daysUntil >= 0 && daysUntil <= 30;
      })
      .map(c => {
        const daysUntil = differenceInDays(new Date(c.end_date), new Date());
        const formattedValue = (c.contract_value || 0).toLocaleString();
        return language === 'uz'
          ? `  - ${c.contract_number}: "${c.contract_name}" (${daysUntil} kun qoldi, qiymat: $${formattedValue})`
          : `  - ${c.contract_number}: "${c.contract_name}" (${daysUntil} days left, value: $${formattedValue})`;
      })
      .join('\n');

    // Create AI prompt with more explicit instructions
    const prompt = language === 'uz'
      ? `Siz biznes tahlilchisi sifatida ishlayapsiz. Quyidagi shartnoma ma'lumotlarini tahlil qiling va aniq tavsiyalar bering:

UMUMIY MA'LUMOTLAR:
- Jami shartnomalar: ${contracts.length} ta
- Faol shartnomalar: ${activeCount} ta
- Tez orada tugaydi: ${expiringCount} ta
- Jami qiymat: $${totalValue.toLocaleString()}

${expiringCount > 0 ? `TUGAYOTGAN SHARTNOMALAR:\n${expiringDetails}\n` : ''}

Iltimos, quyidagilarni tahlil qiling:
1. Tugayotgan shartnomalar xavfi va ta'siri
2. Shartnoma portfelining umumiy salomatligi
3. Aniq harakatlar va tavsiyalar
4. Oldini olish choralari

Faqat tahlil natijalarini bering, umumiy ma'lumot emas. Raqamlar va aniq shartnoma ma'lumotlariga asoslaning.`
      : `You are acting as a business analyst. Analyze the following contract data and provide specific recommendations:

SUMMARY:
- Total contracts: ${contracts.length}
- Active contracts: ${activeCount}
- Expiring soon: ${expiringCount}
- Total value: $${totalValue.toLocaleString()}

${expiringCount > 0 ? `EXPIRING CONTRACTS:\n${expiringDetails}\n` : ''}

Please analyze:
1. Risk and impact of expiring contracts
2. Overall contract portfolio health
3. Specific actions and recommendations
4. Preventive measures

Provide only analysis results based on the numbers and specific contract data, not general information.`;

    // Open AI chatbox with the prompt
    if (window.openAIChat) {
      window.openAIChat(prompt);
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
    activeContracts: filteredContracts.filter(c => c.status === 'active').length,
    totalValue: filteredContracts.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.contract_value || 0), 0),
    expiringSoon: filteredContracts.filter(c => c.daysUntilExpiry >= 0 && c.daysUntilExpiry <= 30).length
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_contracts')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.totalContracts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('active_contracts')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.activeContracts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('total_value')}</p>
                  <p className="text-2xl font-bold text-slate-900">${metrics.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-600">{t('expiring_soon')}</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.expiringSoon}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Panel */}
        {(contractAnalysis.insights.length > 0 || contractAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-rose-600" />
                {t('ai_contract_insights')}
                <Badge className="bg-rose-100 text-rose-700 text-xs">{t('live')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {contractAnalysis.insights.slice(0, 3).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-rose-100">
                    <div className="flex items-start gap-3">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : insight.type === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-rose-600 mt-1">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {contractAnalysis.recommendations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {contractAnalysis.recommendations.map((rec, index) => {
                    // Map recommendation actions to handlers
                    const getActionHandler = (action) => {
                      const actionKey = action.toLowerCase();
                      if (actionKey.includes('renewal') || actionKey.includes('yangilash')) {
                        return handleInitiateRenewals;
                      }
                      if (actionKey.includes('review') || actionKey.includes('ko\'rib chiqish')) {
                        return handleContractReview;
                      }
                      return null;
                    };

                    const handler = getActionHandler(rec.action);

                    return (
                      <button
                        key={index}
                        onClick={handler}
                        disabled={!handler}
                        className={`flex items-center gap-2 text-xs bg-white rounded-full px-3 py-1.5 border border-rose-100 transition-all ${
                          handler ? 'hover:bg-rose-50 hover:border-rose-300 cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <Lightbulb className="w-3 h-3 text-yellow-500" />
                        <span className="text-slate-700">{rec.action}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contracts List */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>{t('contracts')}</CardTitle>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-rose-600 to-pink-600">
                <Plus className="w-4 h-4 mr-2" /> {t('new_contract')}
              </Button>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_contracts')}
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
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  <SelectItem value="draft">{t('draft')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="expired">{t('expired')}</SelectItem>
                  <SelectItem value="renewed">{t('renewed')}</SelectItem>
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
                <p className="text-slate-500">{t('no_contracts_yet')}</p>
                <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_contract')}</Button>
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
                            <Badge className={getStatusColor(contract.status)}>{t(contract.status)}</Badge>
                            <Badge className={getTypeColor(contract.contract_type)} variant="outline">
                              {t(contract.contract_type)}
                            </Badge>
                            {contract.auto_renew && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {t('auto_renew')}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                            <div>
                              <p className="text-slate-500">{t('contract_number')}</p>
                              <p className="font-mono font-semibold">{contract.contract_number}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">{t('party')}</p>
                              <p className="font-medium">{contract.party_name}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">{t('value')}</p>
                              <p className="font-semibold">${(contract.contract_value || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">{t('billing')}</p>
                              <p className="font-medium">{t(contract.billing_cycle) || contract.billing_cycle}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 mt-4 text-sm">
                            <div>
                              <span className="text-slate-500">{t('start')}: </span>
                              <span className="font-medium">
                                {contract.start_date ? format(new Date(contract.start_date), 'MMM dd, yyyy') : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">{t('end')}: </span>
                              <span className="font-medium">
                                {contract.end_date ? format(new Date(contract.end_date), 'MMM dd, yyyy') : '-'}
                              </span>
                            </div>
                            {contract.daysUntilExpiry !== undefined && contract.daysUntilExpiry >= 0 && contract.daysUntilExpiry <= 30 && (
                              <div className="flex items-center gap-2 text-orange-600">
                                <Bell className="w-4 h-4" />
                                <span className="font-medium">{t('expires_in_days').replace('{days}', contract.daysUntilExpiry)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button size="sm" variant="ghost" onClick={() => handleViewContract(contract)} title={t('view_contract')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEditContract(contract)} title={t('edit_contract')}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteContract(contract)} title={t('delete_contract')} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {contract.status === 'active' && contract.daysUntilExpiry <= 30 && (
                            <Button size="sm" variant="outline" onClick={() => updateContractStatus(contract.id, 'renewed')}>
                              {t('renew')}
                            </Button>
                          )}
                          {contract.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => updateContractStatus(contract.id, 'terminated')}>
                              {t('terminate')}
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
              <DialogTitle>{t('create_contract')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('contract_number_label')}</label>
                  <Input
                    placeholder={t('auto_generated')}
                    value={newContract.contract_number}
                    onChange={(e) => setNewContract({...newContract, contract_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('contract_type')} *</label>
                  <Select value={newContract.contract_type} onValueChange={(value) => setNewContract({...newContract, contract_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{t('customer')}</SelectItem>
                      <SelectItem value="vendor">{t('vendor')}</SelectItem>
                      <SelectItem value="employee">{t('employee')}</SelectItem>
                      <SelectItem value="partner">{t('partner')}</SelectItem>
                      <SelectItem value="lease">{t('lease')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('contract_name')} *</label>
                <Input
                  placeholder={t('contract_name_placeholder')}
                  value={newContract.contract_name}
                  onChange={(e) => setNewContract({...newContract, contract_name: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('party_name')} *</label>
                <Input
                  placeholder={t('party_name_placeholder')}
                  value={newContract.party_name}
                  onChange={(e) => setNewContract({...newContract, party_name: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('start_date')} *</label>
                  <Input
                    type="date"
                    value={newContract.start_date}
                    onChange={(e) => setNewContract({...newContract, start_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('end_date')} *</label>
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
                  <label className="text-sm font-medium mb-1 block">{t('contract_value')} *</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newContract.contract_value}
                    onChange={(e) => setNewContract({...newContract, contract_value: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('billing_cycle')}</label>
                  <Select value={newContract.billing_cycle} onValueChange={(value) => setNewContract({...newContract, billing_cycle: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                      <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                      <SelectItem value="annually">{t('annually')}</SelectItem>
                      <SelectItem value="one_time">{t('one_time')}</SelectItem>
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
                  {t('enable_auto_renewal')}
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateContract}
                  className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600"
                  disabled={!newContract.contract_name || !newContract.party_name || isSubmitting}
                >
                  {isSubmitting ? t('creating') : t('create_contract')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Contract Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('contract_details')}</DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">{selectedContract.contract_name}</h3>
                  <Badge className={getStatusColor(selectedContract.status)}>{selectedContract.status}</Badge>
                  <Badge className={getTypeColor(selectedContract.contract_type)} variant="outline">
                    {selectedContract.contract_type}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500">{t('contract_number_label')}</p>
                      <p className="font-mono font-semibold">{selectedContract.contract_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t('party_name')}</p>
                      <p className="font-medium">{selectedContract.party_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t('contract_value')}</p>
                      <p className="text-xl font-bold text-rose-600">${(selectedContract.contract_value || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t('billing_cycle')}</p>
                      <p className="font-medium capitalize">{t(selectedContract.billing_cycle) || selectedContract.billing_cycle}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500">{t('start_date')}</p>
                      <p className="font-medium">
                        {selectedContract.start_date ? format(new Date(selectedContract.start_date), 'MMM dd, yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t('end_date')}</p>
                      <p className="font-medium">
                        {selectedContract.end_date ? format(new Date(selectedContract.end_date), 'MMM dd, yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t('auto_renewal')}</p>
                      <p className="font-medium">{selectedContract.auto_renew ? t('enabled') : t('disabled')}</p>
                    </div>
                    {selectedContract.daysUntilExpiry !== undefined && selectedContract.daysUntilExpiry >= 0 && (
                      <div>
                        <p className="text-sm text-slate-500">{t('days_until_expiry')}</p>
                        <p className={`font-bold ${selectedContract.daysUntilExpiry <= 30 ? 'text-orange-600' : 'text-green-600'}`}>
                          {selectedContract.daysUntilExpiry} {t('days') || 'days'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowViewModal(false)} className="flex-1">
                    {t('close')}
                  </Button>
                  <Button
                    onClick={() => { setShowViewModal(false); handleEditContract(selectedContract); }}
                    className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600"
                  >
                    {t('edit_contract')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Contract Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('edit_contract')}</DialogTitle>
            </DialogHeader>
            {editContract && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('contract_number_label')}</label>
                    <Input
                      value={editContract.contract_number}
                      onChange={(e) => setEditContract({...editContract, contract_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('contract_type')} *</label>
                    <Select value={editContract.contract_type} onValueChange={(value) => setEditContract({...editContract, contract_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">{t('customer')}</SelectItem>
                        <SelectItem value="vendor">{t('vendor')}</SelectItem>
                        <SelectItem value="employee">{t('employee')}</SelectItem>
                        <SelectItem value="partner">{t('partner')}</SelectItem>
                        <SelectItem value="lease">{t('lease')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('contract_name')} *</label>
                  <Input
                    value={editContract.contract_name}
                    onChange={(e) => setEditContract({...editContract, contract_name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('party_name')} *</label>
                  <Input
                    value={editContract.party_name}
                    onChange={(e) => setEditContract({...editContract, party_name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('start_date')}</label>
                    <Input
                      type="date"
                      value={editContract.start_date}
                      onChange={(e) => setEditContract({...editContract, start_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('end_date')}</label>
                    <Input
                      type="date"
                      value={editContract.end_date}
                      onChange={(e) => setEditContract({...editContract, end_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('contract_value')}</label>
                    <Input
                      type="number"
                      value={editContract.contract_value}
                      onChange={(e) => setEditContract({...editContract, contract_value: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('billing_cycle')}</label>
                    <Select value={editContract.billing_cycle} onValueChange={(value) => setEditContract({...editContract, billing_cycle: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{t('monthly')}</SelectItem>
                        <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                        <SelectItem value="annually">{t('annually')}</SelectItem>
                        <SelectItem value="one_time">{t('one_time')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">{t('status')}</label>
                  <Select value={editContract.status || 'active'} onValueChange={(value) => setEditContract({...editContract, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="active">{t('active')}</SelectItem>
                      <SelectItem value="expired">{t('expired')}</SelectItem>
                      <SelectItem value="terminated">{t('terminated')}</SelectItem>
                      <SelectItem value="renewed">{t('renewed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_auto_renew"
                    checked={editContract.auto_renew}
                    onChange={(e) => setEditContract({...editContract, auto_renew: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="edit_auto_renew" className="text-sm font-medium">
                    {t('enable_auto_renewal')}
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditContract(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateContract}
                    className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600"
                    disabled={!editContract.contract_name || !editContract.party_name || isSubmitting}
                  >
                    {isSubmitting ? t('saving') : t('save_changes')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                {language === 'uz' ? 'Shartnomani o\'chirish' : 'Delete Contract'}
              </DialogTitle>
            </DialogHeader>
            {contractToDelete && (
              <div className="space-y-4 py-4">
                <p className="text-slate-600">
                  {language === 'uz'
                    ? `"${contractToDelete.contract_name}" shartnomani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`
                    : `Are you sure you want to delete "${contractToDelete.contract_name}"? This action cannot be undone.`}
                </p>
                <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                  <p><strong>{language === 'uz' ? 'Shartnoma №' : 'Contract Number'}:</strong> {contractToDelete.contract_number}</p>
                  <p><strong>{language === 'uz' ? 'Tomon' : 'Party'}:</strong> {contractToDelete.party_name}</p>
                  <p><strong>{language === 'uz' ? 'Qiymat' : 'Value'}:</strong> ${(contractToDelete.contract_value || 0).toLocaleString()}</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setContractToDelete(null);
                    }}
                    className="flex-1"
                  >
                    {language === 'uz' ? 'Bekor qilish' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={confirmDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {language === 'uz' ? 'O\'chirish' : 'Delete'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Renewal Confirmation Modal */}
        <Dialog open={showRenewalConfirmModal} onOpenChange={setShowRenewalConfirmModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-600">
                <CheckCircle className="w-5 h-5" />
                {language === 'uz' ? 'Shartnomalarni yangilash' : 'Renew Contracts'}
              </DialogTitle>
            </DialogHeader>
            {renewalData && (
              <div className="space-y-4 py-4">
                <p className="text-slate-600">
                  {language === 'uz'
                    ? `${renewalData.length} ta muddati tugayotgan shartnomani yangilamoqchimisiz?`
                    : `Do you want to renew ${renewalData.length} expiring contracts?`}
                </p>
                <div className="bg-blue-50 p-3 rounded-lg text-sm max-h-48 overflow-y-auto">
                  {renewalData.map((contract, idx) => (
                    <div key={idx} className="py-1 border-b border-blue-100 last:border-0">
                      <p className="font-medium">{contract.contract_name}</p>
                      <p className="text-xs text-slate-600">
                        {contract.contract_number} • {contract.daysUntilExpiry} {language === 'uz' ? 'kun qoldi' : 'days left'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRenewalConfirmModal(false);
                      setRenewalData(null);
                    }}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={confirmRenewal}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                  >
                    {language === 'uz' ? 'Yangilash' : 'Renew'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                {language === 'uz' ? 'Muvaffaqiyatli' : 'Success'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-600 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                {successMessage}
              </p>
              <Button
                onClick={() => setShowSuccessModal(false)}
                className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600"
              >
                {t('close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* No Expiring Contracts Modal */}
        <Dialog open={showNoExpiringModal} onOpenChange={setShowNoExpiringModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-600">
                <CheckCircle className="w-5 h-5 text-green-500" />
                {language === 'uz' ? 'Hech qanday shartnoma tugamaydi' : 'No Expiring Contracts'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-600">
                {t('no_expiring_contracts')}
              </p>
              <Button
                onClick={() => setShowNoExpiringModal(false)}
                className="w-full mt-4"
                variant="outline"
              >
                {t('close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
