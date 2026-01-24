import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Plus, Cog, AlertTriangle, CheckCircle, Wrench } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b'];

export default function WorkCenters() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { workCenters, loading, createWorkCenter } = useManufacturing();
  const { canCreate } = usePermissions();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newWorkCenter, setNewWorkCenter] = useState({
    work_center_code: '',
    name: '',
    work_center_type: 'machine',
    capacity_per_day: 0,
    efficiency_rate: 100,
    cost_per_hour: 0,
    location: '',
    status: 'operational'
  });

  const handleCreateWorkCenter = async () => {
    try {
      const wcData = {
        ...newWorkCenter,
        work_center_code: newWorkCenter.work_center_code || `WC-${Date.now()}`,
        capacity_per_day: parseFloat(newWorkCenter.capacity_per_day),
        efficiency_rate: parseFloat(newWorkCenter.efficiency_rate),
        cost_per_hour: parseFloat(newWorkCenter.cost_per_hour),
        utilization_rate: 0,
        oee_score: 85 // Default OEE
      };

      await createWorkCenter(wcData);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating work center:', error);
    }
  };

  const resetForm = () => {
    setNewWorkCenter({
      work_center_code: '',
      name: '',
      work_center_type: 'machine',
      capacity_per_day: 0,
      efficiency_rate: 100,
      cost_per_hour: 0,
      location: '',
      status: 'operational'
    });
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

  const utilizationData = workCenters.map(wc => ({
    name: wc.name,
    value: wc.utilization_rate || 0
  }));

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
                      <p className="text-xs text-slate-500 mt-1">{wc.work_center_code}</p>
                    </div>
                    <Badge className={getStatusColor(wc.status)}>
                      {getStatusIcon(wc.status)}
                      <span className="ml-1">{wc.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium">{t('utilization')}</p>
                      <p className="text-lg font-bold text-blue-900">{wc.utilization_rate || 0}%</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-purple-600 font-medium">{t('oee_score')}</p>
                      <p className="text-lg font-bold text-purple-900">{wc.oee_score || 0}%</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('type')}:</span>
                      <Badge variant="outline" className="text-xs">{t(wc.work_center_type) || wc.work_center_type}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('capacity_per_day')}:</span>
                      <span className="font-semibold">{wc.capacity_per_day || 0} {t('units')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('cost_per_hour')}:</span>
                      <span className="font-semibold">${wc.cost_per_hour || 0}</span>
                    </div>
                    {wc.location && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">{t('location')}:</span>
                        <span className="font-medium">{wc.location}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Utilization Chart */}
          {utilizationData.length > 0 && (
            <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle>{t('work_center_utilization_overview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={utilizationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {utilizationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Work Center Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('add_work_center')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_code" label={t('work_center_code')} helpText={t('help_workcenter_code')} />
                <Input
                  id="wc_code"
                  placeholder={t('auto_generated_if_empty')}
                  value={newWorkCenter.work_center_code}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, work_center_code: e.target.value})}
                />
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_type" label={t('type')} helpText={t('help_workcenter_type')} required />
                <Select value={newWorkCenter.work_center_type} onValueChange={(value) => setNewWorkCenter({...newWorkCenter, work_center_type: value})}>
                  <SelectTrigger id="wc_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="machine">{t('machine')}</SelectItem>
                    <SelectItem value="assembly_line">{t('assembly_line')}</SelectItem>
                    <SelectItem value="quality_station">{t('quality_station')}</SelectItem>
                    <SelectItem value="packaging">{t('packaging')}</SelectItem>
                    <SelectItem value="warehouse">{t('warehouse')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_location" label={t('location')} helpText={t('help_workcenter_location')} />
                <Input
                  id="wc_location"
                  placeholder={t('physical_location')}
                  value={newWorkCenter.location}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, location: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_capacity" label={t('capacity_per_day')} helpText={t('help_workcenter_capacity')} />
                <Input
                  id="wc_capacity"
                  type="number"
                  placeholder="0"
                  value={newWorkCenter.capacity_per_day}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, capacity_per_day: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_efficiency" label={t('efficiency_percent')} helpText={t('help_workcenter_efficiency')} />
                <Input
                  id="wc_efficiency"
                  type="number"
                  placeholder="100"
                  value={newWorkCenter.efficiency_rate}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, efficiency_rate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="wc_cost" label={t('cost_per_hour')} helpText={t('help_workcenter_cost')} />
                <Input
                  id="wc_cost"
                  type="number"
                  placeholder="0"
                  value={newWorkCenter.cost_per_hour}
                  onChange={(e) => setNewWorkCenter({...newWorkCenter, cost_per_hour: e.target.value})}
                />
              </div>
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

    </div>
  );
}