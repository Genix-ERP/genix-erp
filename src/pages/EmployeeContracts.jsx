import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  Users,
  FileSignature,
  CalendarClock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useHR } from '@/components/contexts/HRContext';
import { EmployeeContract } from '@/api/entities';
import { format, parseISO, differenceInDays, addMonths, isBefore, isAfter } from 'date-fns';

const CONTRACT_TYPES = {
  permanent: { label: 'permanent_contract', color: 'bg-green-100 text-green-700 border-green-200' },
  fixed_term: { label: 'fixed_term_contract', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  probation: { label: 'probation_contract', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  part_time: { label: 'part_time_contract', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  temporary: { label: 'temporary_contract', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  internship: { label: 'internship_contract', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
};

const CONTRACT_STATUS = {
  active: { label: 'active', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  expiring_soon: { label: 'expiring_soon', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  expired: { label: 'expired', color: 'bg-red-100 text-red-700 border-red-200', icon: Clock },
  terminated: { label: 'terminated', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  draft: { label: 'draft', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
};

export default function EmployeeContracts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { employees } = useHR();

  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newContract, setNewContract] = useState({
    employee_id: '',
    contract_type: 'permanent',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    salary: '',
    currency: 'UZS',
    working_hours: 40,
    probation_period: 0,
    notice_period: 30,
    benefits: '',
    terms: '',
    status: 'active',
  });

  // Load contracts from database
  useEffect(() => {
    loadContracts();
  }, [employees]);

  const loadContracts = async () => {
    try {
      const data = await EmployeeContract.list();
      setContracts(data);
    } catch (error) {
      console.error('Error loading contracts:', error);
      setContracts([]);
    }
  };

  // Generate sample contracts
  const generateSampleContracts = () => {
    if (employees.length === 0) return [];

    const types = ['permanent', 'fixed_term', 'probation'];
    return employees.slice(0, Math.min(5, employees.length)).map((emp, index) => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 24));
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1 + Math.floor(Math.random() * 2));

      return {
        id: `CON-${Date.now()}-${index}`,
        employee_id: emp.id,
        employee_name: emp.full_name,
        job_title: emp.job_title,
        department: emp.department,
        contract_type: types[Math.floor(Math.random() * types.length)],
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        salary: emp.salary || (5000000 + Math.floor(Math.random() * 10000000)),
        currency: 'UZS',
        working_hours: 40,
        probation_period: 3,
        notice_period: 30,
        benefits: 'Health insurance, Paid leave, Performance bonus',
        terms: 'Standard employment terms and conditions',
        status: 'active',
        created_at: new Date().toISOString(),
      };
    });
  };

  // Removed localStorage persistence - using database instead

  // Calculate contract status based on dates
  const getContractStatus = (contract) => {
    if (contract.status === 'terminated' || contract.status === 'draft') {
      return contract.status;
    }

    const today = new Date();
    const endDate = parseISO(contract.end_date);
    const daysUntilExpiry = differenceInDays(endDate, today);

    if (isBefore(endDate, today)) {
      return 'expired';
    } else if (daysUntilExpiry <= 30) {
      return 'expiring_soon';
    }
    return 'active';
  };

  // Filter contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const status = getContractStatus(contract);
      const matchesSearch = !searchQuery ||
        contract.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || contract.contract_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [contracts, searchQuery, typeFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const active = contracts.filter(c => getContractStatus(c) === 'active').length;
    const expiringSoon = contracts.filter(c => getContractStatus(c) === 'expiring_soon').length;
    const expired = contracts.filter(c => getContractStatus(c) === 'expired').length;
    const totalValue = contracts.reduce((sum, c) => sum + (c.salary || 0), 0);

    return { active, expiringSoon, expired, total: contracts.length, totalValue };
  }, [contracts]);

  // Handle create contract
  const handleCreateContract = async () => {
    const employee = employees.find(e => e.id === newContract.employee_id);
    if (!employee) return;

    setIsSubmitting(true);

    const contract = {
      ...newContract,
      employee_name: employee.full_name,
      job_title: employee.job_title,
      department: employee.department,
      salary: parseFloat(newContract.salary) || 0,
    };

    try {
      await EmployeeContract.create(contract);
      await loadContracts();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle update contract
  const handleUpdateContract = async () => {
    if (!selectedContract) return;

    setIsSubmitting(true);

    try {
      await EmployeeContract.update(selectedContract.id, {
        ...selectedContract,
        salary: parseFloat(selectedContract.salary) || 0
      });
      await loadContracts();
      setShowEditModal(false);
      setSelectedContract(null);
    } catch (error) {
      console.error('Error updating contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete contract
  const handleDeleteContract = async () => {
    if (!selectedContract) return;

    try {
      await EmployeeContract.delete(selectedContract.id);
      await loadContracts();
      setShowDeleteDialog(false);
      setSelectedContract(null);
    } catch (error) {
      console.error('Error deleting contract:', error);
    }
  };

  // Handle renew contract
  const handleRenewContract = async () => {
    if (!selectedContract) return;
    setIsSubmitting(true);

    const oldEndDate = parseISO(selectedContract.end_date);
    const newEndDate = addMonths(oldEndDate, 12);

    const renewedContract = {
      employee_id: selectedContract.employee_id,
      employee_name: selectedContract.employee_name,
      job_title: selectedContract.job_title,
      department: selectedContract.department,
      contract_type: selectedContract.contract_type,
      start_date: selectedContract.end_date,
      end_date: newEndDate.toISOString().split('T')[0],
      salary: selectedContract.salary,
      status: 'active',
      renewed_from: selectedContract.id,
    };

    try {
      // Create the renewed contract
      await EmployeeContract.create(renewedContract);

      // Mark old contract as terminated
      await EmployeeContract.update(selectedContract.id, {
        ...selectedContract,
        status: 'terminated'
      });

      await loadContracts();
      setShowRenewModal(false);
      setSelectedContract(null);
    } catch (error) {
      console.error('Error renewing contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewContract({
      employee_id: '',
      contract_type: 'permanent',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      salary: '',
      currency: 'UZS',
      working_hours: 40,
      probation_period: 0,
      notice_period: 30,
      benefits: '',
      terms: '',
      status: 'active',
    });
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('new_contract') || "Yangi shartnoma"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                  <p className="text-sm text-slate-500">{t('total_contracts') || "Jami shartnomalar"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.active}</p>
                  <p className="text-sm text-slate-500">{t('active_contracts') || "Faol"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.expiringSoon}</p>
                  <p className="text-sm text-slate-500">{t('expiring_soon') || "Tugayapti"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.expired}</p>
                  <p className="text-sm text-slate-500">{t('expired') || "Muddati o'tgan"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contracts Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search_contracts') || "Shartnoma qidirish..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('all_types') || "Barcha turlar"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_types') || "Barchasi"}</SelectItem>
                    {Object.entries(CONTRACT_TYPES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{t(label) || label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('all_statuses') || "Barcha holatlar"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_statuses') || "Barchasi"}</SelectItem>
                    <SelectItem value="active">{t('active') || "Faol"}</SelectItem>
                    <SelectItem value="expiring_soon">{t('expiring_soon') || "Tugayapti"}</SelectItem>
                    <SelectItem value="expired">{t('expired') || "Muddati o'tgan"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('contract_id') || "Shartnoma"}</TableHead>
                  <TableHead>{t('employee') || "Xodim"}</TableHead>
                  <TableHead>{t('type') || "Turi"}</TableHead>
                  <TableHead>{t('period') || "Davr"}</TableHead>
                  <TableHead>{t('salary') || "Maosh"}</TableHead>
                  <TableHead>{t('status') || "Holat"}</TableHead>
                  <TableHead className="text-right">{t('actions') || "Amallar"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      {t('no_contracts_found') || "Shartnomalar topilmadi"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map(contract => {
                    const status = getContractStatus(contract);
                    const StatusIcon = CONTRACT_STATUS[status]?.icon || FileText;
                    const daysUntilExpiry = differenceInDays(parseISO(contract.end_date), new Date());

                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileSignature className="w-4 h-4 text-slate-400" />
                            <span className="font-mono text-sm">{contract.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{contract.employee_name}</p>
                            <p className="text-sm text-slate-500">{contract.job_title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CONTRACT_TYPES[contract.contract_type]?.color}>
                            {t(CONTRACT_TYPES[contract.contract_type]?.label) || contract.contract_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(parseISO(contract.start_date), 'dd MMM yyyy')}</p>
                            <p className="text-slate-500">→ {format(parseISO(contract.end_date), 'dd MMM yyyy')}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {contract.salary?.toLocaleString()} {contract.currency}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CONTRACT_STATUS[status]?.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {t(CONTRACT_STATUS[status]?.label) || status}
                            {status === 'expiring_soon' && (
                              <span className="ml-1">({daysUntilExpiry}d)</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedContract(contract); setShowViewModal(true); }}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view') || "Ko'rish"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedContract(contract); setShowEditModal(true); }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                {t('edit') || "Tahrirlash"}
                              </DropdownMenuItem>
                              {(status === 'expiring_soon' || status === 'expired') && (
                                <DropdownMenuItem
                                  onClick={() => { setSelectedContract(contract); setShowRenewModal(true); }}
                                  className="text-green-600"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  {t('renew') || "Yangilash"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => { setSelectedContract(contract); setShowDeleteDialog(true); }}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || "O'chirish"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Contract Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('new_contract') || "Yangi shartnoma"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="contract_employee" label={t('employee') || "Xodim"} helpText={t('help_contract_employee')} required />
                <Select
                  value={newContract.employee_id}
                  onValueChange={value => setNewContract({ ...newContract, employee_id: value })}
                >
                  <SelectTrigger id="contract_employee">
                    <SelectValue placeholder={t('select_employee') || "Xodimni tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name} - {emp.job_title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <LabelWithHelp htmlFor="contract_type" label={t('contract_type') || "Shartnoma turi"} helpText={t('help_contract_type')} required />
                <Select
                  value={newContract.contract_type}
                  onValueChange={value => setNewContract({ ...newContract, contract_type: value })}
                >
                  <SelectTrigger id="contract_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_TYPES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{t(label) || label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="start_date" label={t('start_date') || "Boshlanish sanasi"} helpText={t('help_contract_start_date')} required />
                  <Input
                    id="start_date"
                    type="date"
                    value={newContract.start_date}
                    onChange={e => setNewContract({ ...newContract, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="end_date" label={t('end_date') || "Tugash sanasi"} helpText={t('help_contract_end_date')} required />
                  <Input
                    id="end_date"
                    type="date"
                    value={newContract.end_date}
                    onChange={e => setNewContract({ ...newContract, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="salary" label={t('salary') || "Maosh"} helpText={t('help_contract_salary')} required />
                  <Input
                    id="salary"
                    type="number"
                    value={newContract.salary}
                    onChange={e => setNewContract({ ...newContract, salary: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="currency" label={t('currency') || "Valyuta"} helpText={t('help_contract_currency')} />
                  <Select
                    value={newContract.currency}
                    onValueChange={value => setNewContract({ ...newContract, currency: value })}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS">UZS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="working_hours" label={t('working_hours') || "Haftalik soat"} helpText={t('help_contract_working_hours')} />
                  <Input
                    id="working_hours"
                    type="number"
                    value={newContract.working_hours}
                    onChange={e => setNewContract({ ...newContract, working_hours: parseInt(e.target.value) || 40 })}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="probation_period" label={t('probation_period') || "Sinov muddati (oy)"} helpText={t('help_contract_probation')} />
                  <Input
                    id="probation_period"
                    type="number"
                    value={newContract.probation_period}
                    onChange={e => setNewContract({ ...newContract, probation_period: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <LabelWithHelp htmlFor="benefits" label={t('benefits') || "Imtiyozlar"} helpText={t('help_contract_benefits')} />
                <Textarea
                  id="benefits"
                  value={newContract.benefits}
                  onChange={e => setNewContract({ ...newContract, benefits: e.target.value })}
                  placeholder={t('enter_benefits') || "Tibbiy sug'urta, ta'til, bonus..."}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <LabelWithHelp htmlFor="terms" label={t('terms') || "Shartlar"} helpText={t('help_contract_terms')} />
                <Textarea
                  id="terms"
                  value={newContract.terms}
                  onChange={e => setNewContract({ ...newContract, terms: e.target.value })}
                  placeholder={t('enter_terms') || "Qo'shimcha shartlar..."}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                  {t('cancel') || "Bekor qilish"}
                </Button>
                <Button
                  onClick={handleCreateContract}
                  disabled={isSubmitting || !newContract.employee_id || !newContract.start_date || !newContract.end_date || !newContract.salary}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {t('create_contract') || "Shartnoma yaratish"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Contract Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('contract_details') || "Shartnoma tafsilotlari"}</DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t('contract_id') || "Shartnoma ID"}</p>
                    <p className="font-mono font-medium">{selectedContract.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('status') || "Holat"}</p>
                    <Badge variant="outline" className={CONTRACT_STATUS[getContractStatus(selectedContract)]?.color}>
                      {t(CONTRACT_STATUS[getContractStatus(selectedContract)]?.label)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('employee') || "Xodim"}</p>
                    <p className="font-medium">{selectedContract.employee_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('job_title') || "Lavozim"}</p>
                    <p className="font-medium">{selectedContract.job_title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('contract_type') || "Turi"}</p>
                    <Badge variant="outline" className={CONTRACT_TYPES[selectedContract.contract_type]?.color}>
                      {t(CONTRACT_TYPES[selectedContract.contract_type]?.label)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('salary') || "Maosh"}</p>
                    <p className="font-medium">{selectedContract.salary?.toLocaleString()} {selectedContract.currency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('start_date') || "Boshlanish"}</p>
                    <p className="font-medium">{format(parseISO(selectedContract.start_date), 'dd MMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('end_date') || "Tugash"}</p>
                    <p className="font-medium">{format(parseISO(selectedContract.end_date), 'dd MMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('working_hours') || "Haftalik soat"}</p>
                    <p className="font-medium">{selectedContract.working_hours}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('probation_period') || "Sinov muddati"}</p>
                    <p className="font-medium">{selectedContract.probation_period} {t('months') || "oy"}</p>
                  </div>
                </div>
                {selectedContract.benefits && (
                  <div>
                    <p className="text-sm text-slate-500">{t('benefits') || "Imtiyozlar"}</p>
                    <p className="font-medium">{selectedContract.benefits}</p>
                  </div>
                )}
                {selectedContract.terms && (
                  <div>
                    <p className="text-sm text-slate-500">{t('terms') || "Shartlar"}</p>
                    <p className="font-medium">{selectedContract.terms}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Contract Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('edit_contract') || "Shartnomani tahrirlash"}</DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_contract_type" label={t('contract_type') || "Shartnoma turi"} helpText={t('help_contract_type')} />
                  <Select
                    value={selectedContract.contract_type}
                    onValueChange={value => setSelectedContract({ ...selectedContract, contract_type: value })}
                  >
                    <SelectTrigger id="edit_contract_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{t(label) || label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="edit_end_date" label={t('end_date') || "Tugash sanasi"} helpText={t('help_contract_end_date')} />
                    <Input
                      id="edit_end_date"
                      type="date"
                      value={selectedContract.end_date}
                      onChange={e => setSelectedContract({ ...selectedContract, end_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <LabelWithHelp htmlFor="edit_salary" label={t('salary') || "Maosh"} helpText={t('help_contract_salary')} />
                    <Input
                      id="edit_salary"
                      type="number"
                      value={selectedContract.salary}
                      onChange={e => setSelectedContract({ ...selectedContract, salary: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_benefits" label={t('benefits') || "Imtiyozlar"} helpText={t('help_contract_benefits')} />
                  <Textarea
                    id="edit_benefits"
                    value={selectedContract.benefits || ''}
                    onChange={e => setSelectedContract({ ...selectedContract, benefits: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowEditModal(false)}>
                    {t('cancel') || "Bekor qilish"}
                  </Button>
                  <Button
                    onClick={handleUpdateContract}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    {t('save_changes') || "Saqlash"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Renew Contract Modal */}
        <AlertDialog open={showRenewModal} onOpenChange={setShowRenewModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('renew_contract') || "Shartnomani yangilash"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('renew_contract_confirm') || `${selectedContract?.employee_name} uchun shartnomani 12 oyga uzaytirasizmi?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleRenewContract} className="bg-green-600 hover:bg-green-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('renew') || "Yangilash"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('delete_contract') || "Shartnomani o'chirish"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('delete_contract_confirm') || "Bu amalni qaytarib bo'lmaydi. Davom etasizmi?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContract} className="bg-red-600 hover:bg-red-700">
                {t('delete') || "O'chirish"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
