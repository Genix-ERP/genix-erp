import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Plus, Cog, AlertTriangle, CheckCircle, Wrench, Eye, Edit, Trash2, Settings, Check, Users } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useHR } from '@/components/contexts/HRContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { equipmentService } from '@/api/services/manufacturing';
import { toast } from 'sonner';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b'];

export default function WorkCenters() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const { workCenters, workOrders, loading, createWorkCenter, updateWorkCenter, deleteWorkCenter } = useManufacturing();
  const { activeCompany } = useCompany();
  const { employees: allEmployees = [] } = useHR();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState(null);
  const [equipment, setEquipment] = useState([]);

  // Load equipment from real API
  useEffect(() => {
    equipmentService.list().then(data => setEquipment(data)).catch(() => {});
  }, []);

  // Get equipment for a specific work center
  const getEquipmentForWorkCenter = (workCenterId) => {
    return equipment.filter(eq => eq.work_center_id === workCenterId);
  };

  // Count equipment per work center
  const equipmentCountByWorkCenter = useMemo(() => {
    const counts = {};
    equipment.forEach(eq => {
      if (eq.work_center_id) {
        counts[eq.work_center_id] = (counts[eq.work_center_id] || 0) + 1;
      }
    });
    return counts;
  }, [equipment]);

  const [newWorkCenter, setNewWorkCenter] = useState({
    name: '',
    description: '',
    department: '',
    capacity_per_hour: 1,
    efficiency_factor: 100,
    working_hours_per_day: 8,
    hourly_cost: 0,
    overhead_cost: 0,
    currency: 'USD',
    status: 'active',
    is_available: true,
    notes: '',
    asset_value: '',
    useful_life_years: '10',
    power_kw: '',
    electricity_rate: '',
    annual_maintenance: '',
    operator_monthly_salary: '',
    labor_rate_type: 'monthly',
    cost_method: 'capacity',
    require_operator: false,
  });
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Format a numeric string with spaces as thousand separators for display
  // in text inputs (e.g. 240000000 -> "240 000 000"). Preserves trailing
  // decimal points and digits so the user can keep typing "12.5" etc.
  const formatThousands = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    const raw = String(val).replace(/[^\d.]/g, '');
    if (!raw) return '';
    const [intPart, ...decParts] = raw.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // Keep the user's decimal part verbatim (incl. a trailing ".")
    return decParts.length > 0 ? `${formattedInt}.${decParts.join('')}` : formattedInt;
  };
  // Strip display separators before storing so the stored value is a
  // valid numeric string that parseFloat/backend can consume.
  const stripThousands = (val) => String(val ?? '').replace(/\s/g, '');

  // Compute the effective hourly cost for a work center. If the stored
  // hourly_cost is 0 but breakdown components are populated, return the sum
  // of those components. This protects against records where hourly_cost
  // was never persisted (e.g. older WCs edited to add breakdown fields
  // before the backend was fixed to auto-overwrite on update).
  const getEffectiveHourlyCost = (wc) => {
    if (!wc) return 0;
    const stored = parseFloat(wc.hourly_cost) || 0;
    if (stored > 0) return stored;
    const workingHours = parseFloat(wc.working_hours_per_day) || 8;
    const annualHours = workingHours * 365;
    const monthlyHours = workingHours * 27;
    const assetValue = parseFloat(wc.asset_value) || 0;
    const usefulLife = parseFloat(wc.useful_life_years) || 10;
    const powerKw = parseFloat(wc.power_kw) || 0;
    const elecRate = parseFloat(wc.electricity_rate) || 0;
    const annualMaint = parseFloat(wc.annual_maintenance) || 0;
    const monthlySalary = parseFloat(wc.operator_monthly_salary) || 0;
    const overhead = parseFloat(wc.overhead_cost) || 0;
    const isDaily = wc.labor_rate_type === 'daily';
    const salaryHours = isDaily ? workingHours : workingHours * 27;
    const depreciation = assetValue > 0 && usefulLife > 0 ? assetValue / usefulLife / annualHours : 0;
    const electricity = powerKw * elecRate;
    const maintenance = annualMaint > 0 ? annualMaint / annualHours : 0;
    const labor = monthlySalary > 0 && salaryHours > 0 ? monthlySalary / salaryHours : 0;
    return depreciation + electricity + maintenance + labor + overhead;
  };

  // Auto-calculate cost breakdown from detailed inputs
  const calculatedCosts = useMemo(() => {
    const workingHours = parseFloat(newWorkCenter.working_hours_per_day) || 8;
    const annualHours = workingHours * 365;
    const assetValue = parseFloat(newWorkCenter.asset_value) || 0;
    const usefulLife = parseFloat(newWorkCenter.useful_life_years) || 10;
    const powerKw = parseFloat(newWorkCenter.power_kw) || 0;
    const elecRate = parseFloat(newWorkCenter.electricity_rate) || 0;
    const annualMaint = parseFloat(newWorkCenter.annual_maintenance) || 0;
    const monthlySalary = parseFloat(newWorkCenter.operator_monthly_salary) || 0;
    const overhead = parseFloat(newWorkCenter.overhead_cost) || 0;

    // Salary → hourly. Monthly: divide by 27 working days × hours/day.
    // Daily: divide by hours/day only.
    const isDaily = newWorkCenter.labor_rate_type === 'daily';
    const salaryHours = isDaily ? workingHours : workingHours * 27;
    const depreciation = assetValue > 0 && usefulLife > 0 ? assetValue / usefulLife / annualHours : 0;
    const electricity = powerKw * elecRate;
    const maintenance = annualMaint > 0 ? annualMaint / annualHours : 0;
    const labor = monthlySalary > 0 && salaryHours > 0 ? monthlySalary / salaryHours : 0;
    const total = depreciation + electricity + maintenance + labor + overhead;

    return { depreciation, electricity, maintenance, labor, overhead, total };
  }, [newWorkCenter]);

  // Get equipment not assigned to any work center (available for assignment)
  const getUnassignedEquipment = () => {
    return equipment.filter(eq => !eq.work_center_id);
  };

  // Get equipment assigned to a specific work center (for editing)
  const getEquipmentForWorkCenterEdit = (workCenterId) => {
    return equipment.filter(eq => eq.work_center_id === workCenterId);
  };

  // Save equipment assignments via API
  const saveEmployeeAssignments = async (workCenterId, employeeIds) => {
    try {
      // First remove all existing employees for this work center
      const existing = await apiClient.get(`/work-centers/${workCenterId}/employees`).then(r => r.data?.data?.employees || r.data?.data || []).catch(() => []);
      const existingIds = (Array.isArray(existing) ? existing : []).map(e => e.employee_id || e.id);
      // Remove employees no longer selected
      for (const eid of existingIds) {
        if (!employeeIds.includes(eid)) {
          await apiClient.delete(`/work-centers/${workCenterId}/employees/${eid}`).catch(() => {});
        }
      }
      // Add newly selected employees
      const newIds = employeeIds.filter(eid => !existingIds.includes(eid));
      if (newIds.length > 0) {
        await apiClient.post(`/work-centers/${workCenterId}/employees`, { employee_ids: newIds, role: 'operator' }).catch(() => {});
      }
    } catch (e) { console.error('Failed to save employee assignments:', e); }
  };

  const saveEquipmentAssignments = async (workCenterId, equipmentIds) => {
    const promises = equipment
      .filter(eq => equipmentIds.includes(eq.id) || eq.work_center_id === workCenterId)
      .map(eq => {
        const newWcId = equipmentIds.includes(eq.id) ? workCenterId : '';
        const currentWcId = eq.work_center_id || '';
        if (currentWcId === newWcId) return Promise.resolve();
        return equipmentService.update(eq.id, { work_center_id: newWcId }).catch(() => {});
      });
    await Promise.all(promises);
    // Refresh equipment list
    const refreshed = await equipmentService.list().catch(() => equipment);
    setEquipment(refreshed);
  };

  const handleCreateWorkCenter = async () => {
    try {
      const wcData = {
        code: newWorkCenter.code || `WC-${Date.now()}`,
        name: newWorkCenter.name,
        description: newWorkCenter.description || null,
        department: newWorkCenter.department || null,
        capacity_per_hour: parseFloat(newWorkCenter.capacity_per_hour) || 1,
        efficiency_factor: parseFloat(newWorkCenter.efficiency_factor) || 100,
        working_hours_per_day: parseFloat(newWorkCenter.working_hours_per_day) || 8,
        // hourly_cost is no longer editable in the form — always derive it
        // from the breakdown so the stored value matches what's displayed.
        hourly_cost: calculatedCosts.total || 0,
        overhead_cost: parseFloat(newWorkCenter.overhead_cost) || 0,
        currency: newWorkCenter.currency || 'USD',
        status: newWorkCenter.status || 'active',
        is_available: newWorkCenter.is_available !== false,
        notes: newWorkCenter.notes || null,
        asset_value: parseFloat(newWorkCenter.asset_value) || 0,
        useful_life_years: parseFloat(newWorkCenter.useful_life_years) || 10,
        power_kw: parseFloat(newWorkCenter.power_kw) || 0,
        electricity_rate: parseFloat(newWorkCenter.electricity_rate) || 0,
        annual_maintenance: parseFloat(newWorkCenter.annual_maintenance) || 0,
        operator_monthly_salary: parseFloat(newWorkCenter.operator_monthly_salary) || 0,
        labor_rate_type: newWorkCenter.labor_rate_type || 'monthly',
        cost_method: newWorkCenter.cost_method || 'capacity',
        require_operator: newWorkCenter.require_operator || false,
      };

      const createdWC = await createWorkCenter(wcData);

      // Save equipment and employee assignments
      if (selectedEquipmentIds.length > 0 && createdWC?.id) {
        await saveEquipmentAssignments(createdWC.id, selectedEquipmentIds);
      }
      if (selectedEmployeeIds.length > 0 && createdWC?.id) {
        await saveEmployeeAssignments(createdWC.id, selectedEmployeeIds);
      }

      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating work center:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Failed to create work center: ${errorMsg}`);
    }
  };

  const resetForm = () => {
    setNewWorkCenter({
      name: '',
      description: '',
      department: '',
      capacity_per_hour: 1,
      efficiency_factor: 100,
      working_hours_per_day: 8,
      hourly_cost: 0,
      overhead_cost: 0,
      currency: 'USD',
      status: 'active',
      is_available: true,
      notes: '',
      asset_value: '',
      useful_life_years: '10',
      power_kw: '',
      electricity_rate: '',
      annual_maintenance: '',
      operator_monthly_salary: '',
    });
    setSelectedEquipmentIds([]);
  };

  const [viewEmployees, setViewEmployees] = useState([]);
  const handleViewWorkCenter = (wc) => {
    setSelectedWorkCenter(wc);
    apiClient.get(`/work-centers/${wc.id}/employees`).then(r => {
      const emps = r.data?.data?.employees || r.data?.data || [];
      setViewEmployees(Array.isArray(emps) ? emps : []);
    }).catch(() => setViewEmployees([]));
    setShowViewModal(true);
  };

  const handleEditWorkCenter = (wc) => {
    setSelectedWorkCenter(wc);
    setNewWorkCenter({
      name: wc.name || '',
      description: wc.description || '',
      department: wc.department || '',
      capacity_per_hour: wc.capacity_per_hour || 1,
      efficiency_factor: wc.efficiency_factor || 100,
      working_hours_per_day: wc.working_hours_per_day || 8,
      hourly_cost: wc.hourly_cost || 0,
      overhead_cost: wc.overhead_cost || 0,
      currency: wc.currency || 'USD',
      status: wc.status || 'active',
      is_available: wc.is_available !== false,
      notes: wc.notes || '',
      asset_value: wc.asset_value || '',
      useful_life_years: wc.useful_life_years || '10',
      power_kw: wc.power_kw || '',
      electricity_rate: wc.electricity_rate || '',
      annual_maintenance: wc.annual_maintenance || '',
      operator_monthly_salary: wc.operator_monthly_salary || '',
      labor_rate_type: wc.labor_rate_type || 'monthly',
      cost_method: wc.cost_method || 'capacity',
      require_operator: wc.require_operator || false,
    });
    // Load currently assigned equipment IDs
    const assignedIds = getEquipmentForWorkCenter(wc.id).map(eq => eq.id);
    setSelectedEquipmentIds(assignedIds);
    // Load currently assigned employee IDs
    apiClient.get(`/work-centers/${wc.id}/employees`).then(r => {
      const emps = r.data?.data?.employees || r.data?.data || [];
      setSelectedEmployeeIds((Array.isArray(emps) ? emps : []).map(e => e.employee_id || e.id));
    }).catch(() => setSelectedEmployeeIds([]));
    setShowEditModal(true);
  };

  const handleUpdateWorkCenter = async () => {
    if (!selectedWorkCenter) return;
    try {
      const wcData = {
        code: newWorkCenter.code || `WC-${Date.now()}`,
        name: newWorkCenter.name,
        description: newWorkCenter.description || null,
        department: newWorkCenter.department || null,
        capacity_per_hour: parseFloat(newWorkCenter.capacity_per_hour) || 1,
        efficiency_factor: parseFloat(newWorkCenter.efficiency_factor) || 100,
        working_hours_per_day: parseFloat(newWorkCenter.working_hours_per_day) || 8,
        // hourly_cost is no longer editable in the form — always derive it
        // from the breakdown so the stored value matches what's displayed.
        hourly_cost: calculatedCosts.total || 0,
        overhead_cost: parseFloat(newWorkCenter.overhead_cost) || 0,
        currency: newWorkCenter.currency || 'USD',
        status: newWorkCenter.status || 'active',
        is_available: newWorkCenter.is_available !== false,
        notes: newWorkCenter.notes || null,
        asset_value: parseFloat(newWorkCenter.asset_value) || 0,
        useful_life_years: parseFloat(newWorkCenter.useful_life_years) || 10,
        power_kw: parseFloat(newWorkCenter.power_kw) || 0,
        electricity_rate: parseFloat(newWorkCenter.electricity_rate) || 0,
        annual_maintenance: parseFloat(newWorkCenter.annual_maintenance) || 0,
        operator_monthly_salary: parseFloat(newWorkCenter.operator_monthly_salary) || 0,
        labor_rate_type: newWorkCenter.labor_rate_type || 'monthly',
        cost_method: newWorkCenter.cost_method || 'capacity',
        require_operator: newWorkCenter.require_operator || false,
      };

      await updateWorkCenter(selectedWorkCenter.id, wcData);

      // Update equipment and employee assignments
      await saveEquipmentAssignments(selectedWorkCenter.id, selectedEquipmentIds);
      await saveEmployeeAssignments(selectedWorkCenter.id, selectedEmployeeIds);

      setShowEditModal(false);
      setSelectedWorkCenter(null);
      resetForm();
    } catch (error) {
      console.error('Error updating work center:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Failed to update work center: ${errorMsg}`);
    }
  };

  const handleDeleteWorkCenter = async (wc) => {
    if (!window.confirm(`${t('confirm_delete_work_center')} "${wc.name}"?`)) {
      return;
    }
    try {
      await deleteWorkCenter(wc.id);
    } catch (error) {
      console.error('Error deleting work center:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Failed to delete work center: ${errorMsg}`);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      operational: 'bg-green-100 text-green-800 border-green-200',
      maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      down: 'bg-red-100 text-red-800 border-red-200',
      idle: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || colors.idle;
  };

  const getStatusIcon = (status) => {
    if (status === 'operational') return <CheckCircle className="w-4 h-4" />;
    if (status === 'maintenance') return <Wrench className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  // Compute utilization from real work order minutes per work center
  const utilizationData = useMemo(() => {
    const minutesByWC = {};
    (workOrders || []).forEach(wo => {
      if (wo.work_center_id) {
        const mins = wo.actual_duration_minutes || wo.expected_duration_minutes || 0;
        minutesByWC[wo.work_center_id] = (minutesByWC[wo.work_center_id] || 0) + mins;
      }
    });
    return workCenters
      .map(wc => ({
        name: wc.name,
        value: Math.round((minutesByWC[wc.id] || 0) / 60 * 10) / 10
      }))
      .filter(entry => entry.value > 0);
  }, [workCenters, workOrders]);

  return (
    <div className="space-y-6">
      
      {/* Header Card */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Cog className="w-6 h-6 text-slate-700" />
              {t('work_centers')}
            </CardTitle>
            {canCreate(MODULES.MANUFACTURING) && (
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> {t('add_work_center')}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">{t('loading_work_centers')}</p>
          </div>
        </div>
      ) : workCenters.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Cog className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('no_work_centers_configured')}</h3>
            <p className="text-sm text-slate-500 mb-6">{t('add_work_centers_description')}</p>
            {canCreate(MODULES.MANUFACTURING) && (
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-slate-700 to-slate-800">
                <Plus className="w-4 h-4 mr-2" /> {t('add_first_work_center')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Work Centers Grid */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workCenters.map((wc) => (
              <Card key={wc.id} className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-bold">{wc.name}</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">{wc.code}</p>
                    </div>
                    <Badge className={getStatusColor(wc.status)}>
                      {getStatusIcon(wc.status)}
                      <span className="ml-1">{t(wc.status) || wc.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">{t('utilization')}</p>
                    <p className="text-lg font-bold text-blue-900">{Math.round(wc.current_utilization || 0)}%</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    {wc.department && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">{t('department')}:</span>
                        <span className="font-medium">{wc.department}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('capacity_per_hour')}:</span>
                      <span className="font-semibold">{wc.capacity_per_hour || 0} {t('units')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('hourly_cost')}:</span>
                      <span className="font-semibold">{formatCurrency(getEffectiveHourlyCost(wc))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('working_hours_per_day')}:</span>
                      <span className="font-semibold">{wc.working_hours_per_day || 0} {t('hours')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('equipment')}:</span>
                      <span className="font-semibold flex items-center gap-1">
                        <Settings className="w-3 h-3" />
                        {equipmentCountByWorkCenter[wc.id] || 0} {t('items') || 'items'}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-center gap-2 pt-3 border-t border-slate-100">
                    <Button variant="outline" size="sm" onClick={() => handleViewWorkCenter(wc)} title={t('view')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canUpdate(MODULES.MANUFACTURING) && (
                      <Button variant="outline" size="sm" onClick={() => handleEditWorkCenter(wc)} title={t('edit')}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canDelete(MODULES.MANUFACTURING) && (
                      <Button variant="outline" size="sm" onClick={() => handleDeleteWorkCenter(wc)} title={t('delete')} className="text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Utilization Chart */}
          <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle>{t('work_center_utilization_overview')}</CardTitle>
            </CardHeader>
            <CardContent>
              {utilizationData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={utilizationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}h`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {utilizationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}h`, t('hours_worked') || 'Hours']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
                  <Cog className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">{t('no_work_order_data') || 'No work order data yet'}</p>
                  <p className="text-xs mt-1">{t('start_production_to_see_utilization') || 'Start production orders to see utilization'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Work Center Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('add_work_center')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <LabelWithHelp htmlFor="wc_name" label={t('name')} helpText={t('help_workcenter_name')} required />
              <Input
                id="wc_name"
                placeholder={t('work_center_name')}
                value={newWorkCenter.name}
                onChange={(e) => setNewWorkCenter({...newWorkCenter, name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_department" label={t('department')} helpText={t('help_workcenter_department')} />
                <Input
                  id="wc_department"
                  placeholder={t('department')}
                  value={newWorkCenter.department}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, department: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_description" label={t('description')} helpText={t('help_workcenter_description')} />
                <Input
                  id="wc_description"
                  placeholder={t('description')}
                  value={newWorkCenter.description}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, description: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 py-1">
              <span className="text-sm font-medium">{language === 'uz' ? 'Xarajat usuli' : language === 'ru' ? 'Метод расчёта' : 'Cost Method'}:</span>
              <div className="flex bg-slate-100 rounded-md p-0.5 text-xs">
                <button type="button" className={`px-3 py-1 rounded ${newWorkCenter.cost_method !== 'time' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, cost_method: 'capacity'})}>{language === 'uz' ? 'Quvvat bo\'yicha' : language === 'ru' ? 'По мощности' : 'By Capacity'}</button>
                <button type="button" className={`px-3 py-1 rounded ${newWorkCenter.cost_method === 'time' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, cost_method: 'time'})}>{language === 'uz' ? 'Vaqt bo\'yicha' : language === 'ru' ? 'По времени' : 'By Time'}</button>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <input type="checkbox" id="wc_require_operator" checked={newWorkCenter.require_operator || false} onChange={(e) => setNewWorkCenter({...newWorkCenter, require_operator: e.target.checked})} className="w-4 h-4 accent-slate-700 cursor-pointer" />
                <label htmlFor="wc_require_operator" className="text-sm font-medium cursor-pointer select-none">{language === 'uz' ? "Operatorni tanlash majburiy" : language === 'ru' ? "Требовать оператора" : "Require Operator"}</label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_capacity" label={t('capacity_per_hour')} helpText={newWorkCenter.cost_method === 'time' ? (language === 'uz' ? 'Vaqt usulida ishlatilmaydi — xarajat haqiqiy vaqtga asoslanadi' : 'Not used in time mode — cost based on actual hours') : t('help_workcenter_capacity')} />
                <Input
                  id="wc_capacity"
                  type="number"
                  placeholder="1"
                  value={newWorkCenter.capacity_per_hour || ''}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, capacity_per_hour: e.target.value})}
                  disabled={newWorkCenter.cost_method === 'time'}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_efficiency" label={t('efficiency_percent')} helpText={t('help_workcenter_efficiency')} />
                <Input
                  id="wc_efficiency"
                  type="number"
                  placeholder="100"
                  value={newWorkCenter.efficiency_factor || ''}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, efficiency_factor: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_hours" label={t('working_hours_per_day')} helpText={t('help_workcenter_hours')} />
                <Input
                  id="wc_hours"
                  type="number"
                  placeholder="8"
                  value={newWorkCenter.working_hours_per_day || ''}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, working_hours_per_day: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_hourly_cost" label={t('hourly_cost')} helpText="Avtomatik hisoblanadi — quyidagi komponentlar asosida." />
                <Input
                  id="wc_hourly_cost"
                  type="text"
                  readOnly
                  disabled
                  className="bg-slate-50 text-slate-700 cursor-not-allowed font-semibold"
                  value={calculatedCosts.total > 0
                    ? `${calculatedCosts.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat`
                    : '0 so\'m/soat'}
                />
                <p className="text-[10px] text-slate-500">Quyidagi komponentlardan avtomatik hisoblanadi.</p>
              </div>
            </div>

            {/* Soatlik tarif hisoblash - Cost Breakdown Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Soatlik tarif hisoblash</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="wc_asset_value" label="Stanok narxi" helpText="Uskunaning umumiy narxi (sotib olish qiymati)" />
                  <Input
                    id="wc_asset_value"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.asset_value)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, asset_value: stripThousands(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="wc_useful_life" label="Foydali muddat (yil)" helpText="Uskunaning foydali xizmat muddati yillarda" />
                  <Input
                    id="wc_useful_life"
                    type="number"
                    placeholder="10"
                    value={newWorkCenter.useful_life_years}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, useful_life_years: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="wc_power_kw" label="Quvvat (kVt)" helpText="Uskunaning soatlik elektr quvvati kVt da" />
                  <Input
                    id="wc_power_kw"
                    type="number"
                    placeholder="0"
                    value={newWorkCenter.power_kw}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, power_kw: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="wc_elec_rate" label="Elektr narxi (so'm/kVt)" helpText="1 kVt soat elektr energiyasi narxi" />
                  <Input
                    id="wc_elec_rate"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.electricity_rate)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, electricity_rate: stripThousands(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="wc_annual_maint" label="Yillik ta'mirlash" helpText="Yillik ta'mirlash va texnik xizmat xarajatlari" />
                  <Input
                    id="wc_annual_maint"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.annual_maintenance)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, annual_maintenance: stripThousands(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <LabelWithHelp htmlFor="wc_operator_salary" label={`Operator ish haqi (so'm/${newWorkCenter.labor_rate_type === 'daily' ? 'kun' : 'oy'})`} helpText={newWorkCenter.labor_rate_type === 'daily' ? "Operator kunlik ish haqi. Soatlik tarifga kunlik ish soatlari orqali aylantiriladi." : "Operator oylik ish haqi. Soatlik tarifga oyiga 27 ish kuni × kunlik ish soatlari orqali aylantiriladi."} />
                    <div className="flex bg-slate-100 rounded-md p-0.5 text-xs">
                      <button type="button" className={`px-2 py-1 rounded ${newWorkCenter.labor_rate_type === 'monthly' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, labor_rate_type: 'monthly'})}>Oylik</button>
                      <button type="button" className={`px-2 py-1 rounded ${newWorkCenter.labor_rate_type === 'daily' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, labor_rate_type: 'daily'})}>Kunlik</button>
                    </div>
                  </div>
                  <Input
                    id="wc_operator_salary"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.operator_monthly_salary)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, operator_monthly_salary: stripThousands(e.target.value)})}
                  />
                </div>
              </div>

              {/* Cost Breakdown Card */}
              {calculatedCosts.total > 0 && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Tarif tarkibi (so'm/soat)</p>
                  <div className="space-y-1 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Amortizatsiya:</span>
                      <span className="font-medium">{calculatedCosts.depreciation.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Elektr:</span>
                      <span className="font-medium">{calculatedCosts.electricity.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ta'mirlash:</span>
                      <span className="font-medium">{calculatedCosts.maintenance.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Operator:</span>
                      <span className="font-medium">{calculatedCosts.labor.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Boshqa:</span>
                      <span className="font-medium">{calculatedCosts.overhead.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="border-t border-slate-300 my-1"></div>
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>JAMI TARIF:</span>
                      <span>{calculatedCosts.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Equipment Selection */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <LabelWithHelp
                label={t('assign_equipment') || 'Assign Equipment'}
                helpText={t('help_assign_equipment') || 'Select equipment to assign to this work center'}
              />
              {getUnassignedEquipment().length > 0 ? (
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {getUnassignedEquipment().map((eq) => (
                    <div
                      key={eq.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        setSelectedEquipmentIds(prev =>
                          prev.includes(eq.id)
                            ? prev.filter(id => id !== eq.id)
                            : [...prev, eq.id]
                        );
                      }}
                    >
                      <Checkbox
                        id={`eq-${eq.id}`}
                        checked={selectedEquipmentIds.includes(eq.id)}
                        onCheckedChange={(checked) => {
                          setSelectedEquipmentIds(prev =>
                            checked
                              ? [...prev, eq.id]
                              : prev.filter(id => id !== eq.id)
                          );
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{eq.name}</p>
                        <p className="text-xs text-slate-500">{eq.code} • {t(eq.equipment_type) || eq.equipment_type}</p>
                      </div>
                      <Badge variant="outline" className={eq.status === 'operational' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                        {t(eq.status) || eq.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-4 text-center bg-slate-50">
                  <Settings className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">{t('no_unassigned_equipment') || 'No unassigned equipment available'}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('create_equipment_first') || 'Create equipment in the Equipment tab first'}</p>
                </div>
              )}
              {selectedEquipmentIds.length > 0 && (
                <p className="text-xs text-slate-500">
                  {selectedEquipmentIds.length} {t('equipment_selected') || 'equipment selected'}
                </p>
              )}
            </div>

            {/* Employee Assignment */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <LabelWithHelp
                label={language === 'uz' ? 'Xodimlarni tayinlash' : language === 'ru' ? 'Назначить сотрудников' : 'Assign Employees'}
                helpText={t('help_assign_employees') || 'Select employees to assign to this work center'}
              />
              <Input
                placeholder={language === 'uz' ? 'Xodimlarni qidirish...' : language === 'ru' ? 'Поиск сотрудников...' : 'Search employees...'}
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="mb-2"
              />
              {allEmployees.length > 0 ? (
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {allEmployees
                    .filter(emp => {
                      const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                      return name.includes(employeeSearch.toLowerCase()) || (emp.employee_number || '').toLowerCase().includes(employeeSearch.toLowerCase());
                    })
                    .map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        setSelectedEmployeeIds(prev =>
                          prev.includes(emp.id)
                            ? prev.filter(id => id !== emp.id)
                            : [...prev, emp.id]
                        );
                      }}
                    >
                      <Checkbox
                        id={`emp-create-${emp.id}`}
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => {
                          setSelectedEmployeeIds(prev =>
                            prev.includes(emp.id)
                              ? prev.filter(id => id !== emp.id)
                              : [...prev, emp.id]
                          );
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-slate-500">{emp.employee_number} {emp.job_title ? `• ${emp.job_title}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-4 text-center bg-slate-50">
                  <Users className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">{language === 'uz' ? 'Xodimlar mavjud emas' : language === 'ru' ? 'Нет доступных сотрудников' : 'No employees available'}</p>
                </div>
              )}
              {selectedEmployeeIds.length > 0 && (
                <p className="text-xs text-slate-500">
                  {selectedEmployeeIds.length} {language === 'uz' ? 'xodim tanlangan' : language === 'ru' ? 'сотрудников выбрано' : 'employees selected'}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }} className="flex-1">
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateWorkCenter}
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                disabled={!newWorkCenter.name}
              >
                {t('add_work_center')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Work Center Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) { setSelectedWorkCenter(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_work_center')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <LabelWithHelp htmlFor="edit_wc_name" label={t('name')} helpText={t('help_workcenter_name')} required />
              <Input
                id="edit_wc_name"
                placeholder={t('work_center_name')}
                value={newWorkCenter.name}
                onChange={(e) => setNewWorkCenter({...newWorkCenter, name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="edit_wc_department" label={t('department')} helpText={t('help_workcenter_department')} />
                <Input
                  id="edit_wc_department"
                  placeholder={t('department')}
                  value={newWorkCenter.department}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, department: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="edit_wc_description" label={t('description')} helpText={t('help_workcenter_description')} />
                <Input
                  id="edit_wc_description"
                  placeholder={t('description')}
                  value={newWorkCenter.description}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, description: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 py-1">
              <span className="text-sm font-medium">{language === 'uz' ? 'Xarajat usuli' : language === 'ru' ? 'Метод расчёта' : 'Cost Method'}:</span>
              <div className="flex bg-slate-100 rounded-md p-0.5 text-xs">
                <button type="button" className={`px-3 py-1 rounded ${newWorkCenter.cost_method !== 'time' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, cost_method: 'capacity'})}>{language === 'uz' ? 'Quvvat bo\'yicha' : language === 'ru' ? 'По мощности' : 'By Capacity'}</button>
                <button type="button" className={`px-3 py-1 rounded ${newWorkCenter.cost_method === 'time' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, cost_method: 'time'})}>{language === 'uz' ? 'Vaqt bo\'yicha' : language === 'ru' ? 'По времени' : 'By Time'}</button>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <input type="checkbox" id="edit_wc_require_operator" checked={newWorkCenter.require_operator || false} onChange={(e) => setNewWorkCenter({...newWorkCenter, require_operator: e.target.checked})} className="w-4 h-4 accent-slate-700 cursor-pointer" />
                <label htmlFor="edit_wc_require_operator" className="text-sm font-medium cursor-pointer select-none">{language === 'uz' ? "Operatorni tanlash majburiy" : language === 'ru' ? "Требовать оператора" : "Require Operator"}</label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="edit_wc_capacity" label={t('capacity_per_hour')} helpText={newWorkCenter.cost_method === 'time' ? (language === 'uz' ? 'Vaqt usulida ishlatilmaydi — xarajat haqiqiy vaqtga asoslanadi' : 'Not used in time mode — cost based on actual hours') : t('help_workcenter_capacity')} />
                <Input
                  id="edit_wc_capacity"
                  type="number"
                  placeholder="1"
                  value={newWorkCenter.capacity_per_hour || ''}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, capacity_per_hour: e.target.value})}
                  disabled={newWorkCenter.cost_method === 'time'}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="edit_wc_efficiency" label={t('efficiency_percent')} helpText={t('help_workcenter_efficiency')} />
                <Input
                  id="edit_wc_efficiency"
                  type="number"
                  placeholder="100"
                  value={newWorkCenter.efficiency_factor || ''}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, efficiency_factor: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="edit_wc_hours" label={t('working_hours_per_day')} helpText={t('help_workcenter_hours')} />
                <Input
                  id="edit_wc_hours"
                  type="number"
                  placeholder="8"
                  value={newWorkCenter.working_hours_per_day || ''}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, working_hours_per_day: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="edit_wc_hourly_cost" label={t('hourly_cost')} helpText="Avtomatik hisoblanadi — quyidagi komponentlar asosida." />
                <Input
                  id="edit_wc_hourly_cost"
                  type="text"
                  readOnly
                  disabled
                  className="bg-slate-50 text-slate-700 cursor-not-allowed font-semibold"
                  value={calculatedCosts.total > 0
                    ? `${calculatedCosts.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat`
                    : '0 so\'m/soat'}
                />
                <p className="text-[10px] text-slate-500">Quyidagi komponentlardan avtomatik hisoblanadi.</p>
              </div>
            </div>

            {/* Soatlik tarif hisoblash - Cost Breakdown Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Soatlik tarif hisoblash</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_wc_asset_value" label="Stanok narxi" helpText="Uskunaning umumiy narxi (sotib olish qiymati)" />
                  <Input
                    id="edit_wc_asset_value"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.asset_value)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, asset_value: stripThousands(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_wc_useful_life" label="Foydali muddat (yil)" helpText="Uskunaning foydali xizmat muddati yillarda" />
                  <Input
                    id="edit_wc_useful_life"
                    type="number"
                    placeholder="10"
                    value={newWorkCenter.useful_life_years}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, useful_life_years: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_wc_power_kw" label="Quvvat (kVt)" helpText="Uskunaning soatlik elektr quvvati kVt da" />
                  <Input
                    id="edit_wc_power_kw"
                    type="number"
                    placeholder="0"
                    value={newWorkCenter.power_kw}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, power_kw: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_wc_elec_rate" label="Elektr narxi (so'm/kVt)" helpText="1 kVt soat elektr energiyasi narxi" />
                  <Input
                    id="edit_wc_elec_rate"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.electricity_rate)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, electricity_rate: stripThousands(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="edit_wc_annual_maint" label="Yillik ta'mirlash" helpText="Yillik ta'mirlash va texnik xizmat xarajatlari" />
                  <Input
                    id="edit_wc_annual_maint"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.annual_maintenance)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, annual_maintenance: stripThousands(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <LabelWithHelp htmlFor="edit_wc_operator_salary" label={`Operator ish haqi (so'm/${newWorkCenter.labor_rate_type === 'daily' ? 'kun' : 'oy'})`} helpText={newWorkCenter.labor_rate_type === 'daily' ? "Operator kunlik ish haqi. Soatlik tarifga kunlik ish soatlari orqali aylantiriladi." : "Operator oylik ish haqi. Soatlik tarifga oyiga 27 ish kuni × kunlik ish soatlari orqali aylantiriladi."} />
                    <div className="flex bg-slate-100 rounded-md p-0.5 text-xs">
                      <button type="button" className={`px-2 py-1 rounded ${newWorkCenter.labor_rate_type === 'monthly' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, labor_rate_type: 'monthly'})}>Oylik</button>
                      <button type="button" className={`px-2 py-1 rounded ${newWorkCenter.labor_rate_type === 'daily' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-500'}`} onClick={() => setNewWorkCenter({...newWorkCenter, labor_rate_type: 'daily'})}>Kunlik</button>
                    </div>
                  </div>
                  <Input
                    id="edit_wc_operator_salary"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatThousands(newWorkCenter.operator_monthly_salary)}
                    onChange={(e) => setNewWorkCenter({...newWorkCenter, operator_monthly_salary: stripThousands(e.target.value)})}
                  />
                </div>
              </div>

              {/* Cost Breakdown Card */}
              {calculatedCosts.total > 0 && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Tarif tarkibi (so'm/soat)</p>
                  <div className="space-y-1 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Amortizatsiya:</span>
                      <span className="font-medium">{calculatedCosts.depreciation.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Elektr:</span>
                      <span className="font-medium">{calculatedCosts.electricity.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Ta'mirlash:</span>
                      <span className="font-medium">{calculatedCosts.maintenance.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Operator:</span>
                      <span className="font-medium">{calculatedCosts.labor.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Boshqa:</span>
                      <span className="font-medium">{calculatedCosts.overhead.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                    <div className="border-t border-slate-300 my-1"></div>
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>JAMI TARIF:</span>
                      <span>{calculatedCosts.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Equipment Selection for Edit */}
            {selectedWorkCenter && (
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <LabelWithHelp
                  label={t('assign_equipment') || 'Assign Equipment'}
                  helpText={t('help_assign_equipment') || 'Select equipment to assign to this work center'}
                />
                {(() => {
                  // Get equipment assigned to this work center OR unassigned
                  const availableEquipment = equipment.filter(
                    eq => !eq.work_center_id || eq.work_center_id === selectedWorkCenter.id
                  );

                  if (availableEquipment.length > 0) {
                    return (
                      <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                        {availableEquipment.map((eq) => (
                          <div
                            key={eq.id}
                            className="flex items-center space-x-3 p-2 rounded hover:bg-slate-50 cursor-pointer"
                            onClick={() => {
                              setSelectedEquipmentIds(prev =>
                                prev.includes(eq.id)
                                  ? prev.filter(id => id !== eq.id)
                                  : [...prev, eq.id]
                              );
                            }}
                          >
                            <Checkbox
                              id={`edit-eq-${eq.id}`}
                              checked={selectedEquipmentIds.includes(eq.id)}
                              onCheckedChange={(checked) => {
                                setSelectedEquipmentIds(prev =>
                                  checked
                                    ? [...prev, eq.id]
                                    : prev.filter(id => id !== eq.id)
                                );
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{eq.name}</p>
                              <p className="text-xs text-slate-500">{eq.code} • {t(eq.equipment_type) || eq.equipment_type}</p>
                            </div>
                            <Badge variant="outline" className={eq.status === 'operational' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                              {t(eq.status) || eq.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded-lg p-4 text-center bg-slate-50">
                      <Settings className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-500">{t('no_equipment_available') || 'No equipment available'}</p>
                    </div>
                  );
                })()}
                {selectedEquipmentIds.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {selectedEquipmentIds.length} {t('equipment_selected') || 'equipment selected'}
                  </p>
                )}
              </div>
            )}

            {/* Employee Assignment for Edit */}
            {selectedWorkCenter && (
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <LabelWithHelp
                  label={language === 'uz' ? 'Xodimlarni tayinlash' : language === 'ru' ? 'Назначить сотрудников' : 'Assign Employees'}
                  helpText={t('help_assign_employees') || 'Select employees to assign to this work center'}
                />
                <Input
                  placeholder={language === 'uz' ? 'Xodimlarni qidirish...' : language === 'ru' ? 'Поиск сотрудников...' : 'Search employees...'}
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="mb-2"
                />
                {allEmployees.length > 0 ? (
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {allEmployees
                      .filter(emp => {
                        const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                        return name.includes(employeeSearch.toLowerCase()) || (emp.employee_number || '').toLowerCase().includes(employeeSearch.toLowerCase());
                      })
                      .map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center space-x-3 p-2 rounded hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setSelectedEmployeeIds(prev =>
                            prev.includes(emp.id)
                              ? prev.filter(id => id !== emp.id)
                              : [...prev, emp.id]
                          );
                        }}
                      >
                        <Checkbox
                          id={`emp-edit-${emp.id}`}
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => {
                            setSelectedEmployeeIds(prev =>
                              prev.includes(emp.id)
                                ? prev.filter(id => id !== emp.id)
                                : [...prev, emp.id]
                            );
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-slate-500">{emp.employee_number} {emp.job_title ? `• ${emp.job_title}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 text-center bg-slate-50">
                    <Users className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">{language === 'uz' ? 'Xodimlar mavjud emas' : language === 'ru' ? 'Нет доступных сотрудников' : 'No employees available'}</p>
                  </div>
                )}
                {selectedEmployeeIds.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {selectedEmployeeIds.length} {language === 'uz' ? 'xodim tanlangan' : language === 'ru' ? 'сотрудников выбрано' : 'employees selected'}
                  </p>
                )}
              </div>
            )}


            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedWorkCenter(null); resetForm(); }} className="flex-1">
                {t('cancel')}
              </Button>
              <Button
                onClick={handleUpdateWorkCenter}
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                disabled={!newWorkCenter.name}
              >
                {t('save_changes')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Work Center Modal */}
      <Dialog open={showViewModal} onOpenChange={(open) => { setShowViewModal(open); if (!open) setSelectedWorkCenter(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('view_work_center')}</DialogTitle>
          </DialogHeader>
          {selectedWorkCenter && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('work_center_code')}</p>
                  <p className="font-medium">{selectedWorkCenter.code || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('name')}</p>
                  <p className="font-medium">{selectedWorkCenter.name || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('department')}</p>
                  <p className="font-medium">{selectedWorkCenter.department || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('description')}</p>
                  <p className="font-medium">{selectedWorkCenter.description || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('status')}</p>
                  <Badge className={getStatusColor(selectedWorkCenter.status)}>
                    {getStatusIcon(selectedWorkCenter.status)}
                    <span className="ml-1">{t(selectedWorkCenter.status) || selectedWorkCenter.status}</span>
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">{t('availability')}</p>
                  <Badge className={selectedWorkCenter.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {selectedWorkCenter.is_available ? t('available') : t('unavailable')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-blue-600 font-medium">{t('capacity_per_hour')}</p>
                  <p className="text-lg font-bold text-blue-900">{selectedWorkCenter.capacity_per_hour || 0}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <p className="text-xs text-purple-600 font-medium">{t('efficiency_percent')}</p>
                  <p className="text-lg font-bold text-purple-900">{selectedWorkCenter.efficiency_factor || 0}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-xs text-amber-600 font-medium">{t('hourly_cost')}</p>
                  <p className="text-lg font-bold text-amber-900">{formatCurrency(getEffectiveHourlyCost(selectedWorkCenter))}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-xs text-slate-600 font-medium">{t('working_hours_per_day')}</p>
                  <p className="text-lg font-bold text-slate-900">{selectedWorkCenter.working_hours_per_day || 0}h</p>
                </div>
              </div>

              {/* Cost Breakdown in View Modal */}
              {(() => {
                const wc = selectedWorkCenter;
                const workingHours = parseFloat(wc.working_hours_per_day) || 8;
                const annualHours = workingHours * 365;
                const assetValue = parseFloat(wc.asset_value) || 0;
                const usefulLife = parseFloat(wc.useful_life_years) || 10;
                const powerKw = parseFloat(wc.power_kw) || 0;
                const elecRate = parseFloat(wc.electricity_rate) || 0;
                const annualMaint = parseFloat(wc.annual_maintenance) || 0;
                const monthlySalary = parseFloat(wc.operator_monthly_salary) || 0;
                const overhead = parseFloat(wc.overhead_cost) || 0;

                const isDaily = wc.labor_rate_type === 'daily';
                const salaryHours = isDaily ? workingHours : workingHours * 27;
                const depreciation = assetValue > 0 && usefulLife > 0 ? assetValue / usefulLife / annualHours : 0;
                const electricity = powerKw * elecRate;
                const maintenance = annualMaint > 0 ? annualMaint / annualHours : 0;
                const labor = monthlySalary > 0 && salaryHours > 0 ? monthlySalary / salaryHours : 0;
                const total = depreciation + electricity + maintenance + labor + overhead;

                if (total <= 0) return null;

                return (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <p className="text-sm font-semibold text-slate-700">Soatlik tarif tarkibi</p>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="space-y-1 text-sm font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Amortizatsiya:</span>
                          <span className="font-medium">{depreciation.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Elektr:</span>
                          <span className="font-medium">{electricity.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Ta'mirlash:</span>
                          <span className="font-medium">{maintenance.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Operator:</span>
                          <span className="font-medium">{labor.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Boshqa:</span>
                          <span className="font-medium">{overhead.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                        </div>
                        <div className="border-t border-slate-300 my-1"></div>
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>JAMI TARIF:</span>
                          <span>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })} so'm/soat</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {selectedWorkCenter.notes && (
                <div className="space-y-1 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">{t('notes')}</p>
                  <p className="text-sm">{selectedWorkCenter.notes}</p>
                </div>
              )}

              {/* Equipment Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    {t('assigned_equipment') || 'Assigned Equipment'}
                  </p>
                  <Badge variant="outline">
                    {getEquipmentForWorkCenter(selectedWorkCenter.id).length} {t('items') || 'items'}
                  </Badge>
                </div>

                {getEquipmentForWorkCenter(selectedWorkCenter.id).length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs">{t('equipment') || 'Equipment'}</TableHead>
                          <TableHead className="text-xs">{t('type') || 'Type'}</TableHead>
                          <TableHead className="text-xs">{t('status') || 'Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getEquipmentForWorkCenter(selectedWorkCenter.id).map((eq) => (
                          <TableRow key={eq.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{eq.name}</p>
                                <p className="text-xs text-slate-500">{eq.code}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {t(eq.equipment_type) || eq.equipment_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={eq.status === 'operational' ? 'bg-green-100 text-green-700 text-xs' : 'bg-amber-100 text-amber-700 text-xs'}
                              >
                                {t(eq.status) || eq.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-lg">
                    <Settings className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">{t('no_equipment_assigned') || 'No equipment assigned to this work center'}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('assign_equipment_hint') || 'Go to Equipment tab to assign equipment'}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
              {/* Assigned Employees */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {language === 'uz' ? 'Tayinlangan xodimlar' : language === 'ru' ? 'Назначенные сотрудники' : 'Assigned Employees'}
                  </p>
                  <Badge variant="outline">{viewEmployees.length}</Badge>
                </div>
                {viewEmployees.length > 0 ? (
                  <div className="space-y-2">
                    {viewEmployees.map(emp => (
                      <div key={emp.employee_id || emp.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{emp.employee_name || emp.name}</span>
                        <span className="text-xs text-slate-400">{emp.employee_number || emp.employee_id}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-3">{language === 'uz' ? 'Xodimlar tayinlanmagan' : 'No employees assigned'}</p>
                )}
              </div>

                <Button variant="outline" onClick={() => { setShowViewModal(false); setSelectedWorkCenter(null); }} className="flex-1">
                  {t('close')}
                </Button>
                {canUpdate(MODULES.MANUFACTURING) && (
                  <Button
                    onClick={() => {
                      setShowViewModal(false);
                      handleEditWorkCenter(selectedWorkCenter);
                    }}
                    className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
                  >
                    <Edit className="w-4 h-4 mr-2" /> {t('edit')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}