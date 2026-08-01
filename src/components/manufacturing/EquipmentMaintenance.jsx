import React, { useState, useEffect, useMemo } from 'react';
import { equipmentService } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Wrench,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Settings as SettingsIcon,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Activity,
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
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { format, parseISO, differenceInDays, addDays, addMonths, isBefore } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

const MAINTENANCE_TYPE = {
  preventive: { label: 'preventive', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  corrective: { label: 'corrective', color: 'bg-red-100 text-red-700 border-red-200' },
  predictive: { label: 'predictive', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  calibration: { label: 'calibration', color: 'bg-green-100 text-green-700 border-green-200' },
};

const MAINTENANCE_STATUS = {
  scheduled: { label: 'scheduled', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Calendar },
  due: { label: 'due', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  overdue: { label: 'overdue', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  in_progress: { label: 'in_progress', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  completed: { label: 'completed', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
};

export default function EquipmentMaintenance() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { workCenters } = useManufacturing();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  // Get date-fns locale based on language
  const getDateLocale = () => {
    switch (language) {
      case 'ru': return ru;
      case 'uz': return enUS;
      default: return enUS;
    }
  };

  const [activeTab, setActiveTab] = useState('equipment');
  const [equipment, setEquipment] = useState([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateEquipmentModal, setShowCreateEquipmentModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newEquipment, setNewEquipment] = useState({
    name: '',
    type: 'machine',
    work_center_id: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    warranty_expiry: '',
    maintenance_interval_days: 30,
    last_maintenance: '',
    status: 'operational',
  });

  const [newTask, setNewTask] = useState({
    equipment_id: '',
    type: 'preventive',
    description: '',
    scheduled_date: '',
    estimated_duration: 60,
    assigned_to: '',
    priority: 'medium',
  });

  const [completionData, setCompletionData] = useState({
    actual_date: new Date().toISOString().split('T')[0],
    actual_duration: 0,
    cost: 0,
    notes: '',
    next_maintenance_date: '',
  });

  // Populate completion data when task is selected
  useEffect(() => {
    if (selectedItem && showCompleteModal) {
      const eq = equipment.find(e => e.id === selectedItem.equipment_id);
      const nextMaintenanceDate = eq?.maintenance_interval_days
        ? addDays(new Date(), eq.maintenance_interval_days).toISOString().split('T')[0]
        : '';

      setCompletionData({
        actual_date: new Date().toISOString().split('T')[0],
        actual_duration: selectedItem.estimated_duration || 0,
        cost: 0,
        notes: '',
        next_maintenance_date: nextMaintenanceDate,
      });
    }
  }, [selectedItem, showCompleteModal, equipment]);

  // Normalize API response to match expected field names in JSX
  const normalizeEquipment = (eq) => ({
    ...eq,
    type: eq.equipment_type,
    last_maintenance: eq.last_maintenance_date,
    warranty_expiry: eq.warranty_expiry,
  });

  const normalizeTask = (task) => ({
    ...task,
    type: task.maintenance_type,
    estimated_duration: Math.round((task.duration_hours || 0) * 60),
  });

  // Load equipment and their maintenance tasks from API
  const reloadData = async () => {
    try {
      const equipList = (await equipmentService.list()).map(normalizeEquipment);
      setEquipment(equipList);
      if (equipList.length > 0) {
        const taskArrays = await Promise.all(
          equipList.map(eq => equipmentService.listMaintenance(eq.id).then(t => t.map(normalizeTask)).catch(() => []))
        );
        setMaintenanceTasks(taskArrays.flat());
      } else {
        setMaintenanceTasks([]);
      }
    } catch (error) {
      console.error('Failed to load equipment data:', error);
    }
  };

  useEffect(() => { reloadData(); }, []);

  // Calculate task status based on date
  const getTaskStatus = (task) => {
    if (task.status === 'completed' || task.status === 'in_progress') {
      return task.status;
    }

    const today = new Date();
    const scheduledDate = parseISO(task.scheduled_date);
    const daysUntil = differenceInDays(scheduledDate, today);

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 7) return 'due';
    return 'scheduled';
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return maintenanceTasks.filter(task => {
      const status = getTaskStatus(task);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesSearch = !searchQuery ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        equipment.find(e => e.id === task.equipment_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [maintenanceTasks, statusFilter, searchQuery, equipment]);

  // Statistics
  const stats = useMemo(() => {
    const totalEquipment = equipment.length;
    const operational = equipment.filter(e => e.status === 'operational').length;
    const underMaintenance = equipment.filter(e => e.status === 'under_maintenance').length;
    const dueTasks = maintenanceTasks.filter(t => getTaskStatus(t) === 'due' || getTaskStatus(t) === 'overdue').length;

    return { totalEquipment, operational, underMaintenance, dueTasks };
  }, [equipment, maintenanceTasks]);

  // Handle create equipment
  const handleCreateEquipment = async () => {
    setIsSubmitting(true);
    try {
      await equipmentService.create({
        name: newEquipment.name,
        equipment_type: newEquipment.type,
        work_center_id: newEquipment.work_center_id || undefined,
        manufacturer: newEquipment.manufacturer || undefined,
        model: newEquipment.model || undefined,
        serial_number: newEquipment.serial_number || undefined,
        purchase_date: newEquipment.purchase_date || undefined,
        warranty_expiry: newEquipment.warranty_expiry || undefined,
        maintenance_interval_days: newEquipment.maintenance_interval_days,
        status: newEquipment.status,
      });
      await reloadData();
      setShowCreateEquipmentModal(false);
      resetEquipmentForm();
    } catch (error) {
      console.error('Failed to create equipment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle create task
  const handleCreateTask = async () => {
    setIsSubmitting(true);
    try {
      await equipmentService.createMaintenance(newTask.equipment_id, {
        maintenance_type: newTask.type,
        scheduled_date: newTask.scheduled_date,
        duration_hours: (newTask.estimated_duration || 60) / 60,
        description: newTask.description || undefined,
      });
      await reloadData();
      setShowCreateTaskModal(false);
      resetTaskForm();
    } catch (error) {
      console.error('Failed to create maintenance task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit task
  const handleEditTask = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await equipmentService.updateMaintenance(selectedItem.equipment_id, selectedItem.id, {
        maintenance_type: newTask.type,
        scheduled_date: newTask.scheduled_date,
        duration_hours: (newTask.estimated_duration || 60) / 60,
        description: newTask.description || undefined,
      });
      await reloadData();
      setShowEditTaskModal(false);
      setSelectedItem(null);
      resetTaskForm();
    } catch (error) {
      console.error('Failed to update maintenance task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle complete task
  const handleCompleteTask = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await equipmentService.completeMaintenance(
        selectedItem.equipment_id,
        selectedItem.id,
        {
          work_performed: completionData.notes || undefined,
          duration_hours: (completionData.actual_duration || 0) / 60,
          labor_cost: completionData.cost || 0,
          parts_cost: 0,
        }
      );
      // Create next scheduled task if preventive
      if (selectedItem.type === 'preventive' && completionData.next_maintenance_date) {
        await equipmentService.createMaintenance(selectedItem.equipment_id, {
          maintenance_type: 'preventive',
          scheduled_date: completionData.next_maintenance_date,
          duration_hours: (selectedItem.estimated_duration || 60) / 60,
          description: selectedItem.description || undefined,
        });
      }
      await reloadData();
      setShowCompleteModal(false);
      setCompletionData({
        actual_date: new Date().toISOString().split('T')[0],
        actual_duration: 0,
        cost: 0,
        notes: '',
        next_maintenance_date: '',
      });
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to complete maintenance task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      if (activeTab === 'equipment') {
        await equipmentService.delete(selectedItem.id);
      }
      await reloadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setShowDeleteDialog(false);
      setSelectedItem(null);
    }
  };

  const resetEquipmentForm = () => {
    setNewEquipment({
      name: '',
      type: 'machine',
      work_center_id: '',
      manufacturer: '',
      model: '',
      serial_number: '',
      purchase_date: '',
      warranty_expiry: '',
      maintenance_interval_days: 30,
      last_maintenance: '',
      status: 'operational',
    });
  };

  const resetTaskForm = () => {
    setNewTask({
      equipment_id: '',
      type: 'preventive',
      description: '',
      scheduled_date: '',
      estimated_duration: 60,
      assigned_to: '',
      priority: 'medium',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('equipment_maintenance') || "Jihozlar ta'mirlash"}</h2>
          <p className="text-slate-600 mt-1">{t('equipment_maintenance_desc') || "Jihozlarni va ta'mirlashni boshqaring"}</p>
        </div>
        {canCreate(MODULES.MANUFACTURING) && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreateEquipmentModal(true)}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('new_equipment') || "Yangi jihoz"}
            </Button>
            <Button
              onClick={() => setShowCreateTaskModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('new_task') || "Yangi vazifa"}
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEquipment}</p>
                <p className="text-sm text-slate-500">{t('total_equipment') || "Jami jihozlar"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.operational}</p>
                <p className="text-sm text-slate-500">{t('operational') || "Ishlayapti"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.underMaintenance}</p>
                <p className="text-sm text-slate-500">{t('under_maintenance') || "Ta'mirda"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.dueTasks}</p>
                <p className="text-sm text-slate-500">{t('due_tasks') || "Muddati yetdi"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="equipment">{t('equipment') || "Jihozlar"}</TabsTrigger>
          <TabsTrigger value="maintenance">{t('maintenance_tasks') || "Ta'mirlash vazifalari"}</TabsTrigger>
          <TabsTrigger value="history">{t('history') || "Tarix"}</TabsTrigger>
        </TabsList>

        {/* Equipment Tab */}
        <TabsContent value="equipment" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search_equipment') || "Jihozlarni qidirish..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('equipment') || "Jihoz"}</TableHead>
                    <TableHead>{t('type') || "Turi"}</TableHead>
                    <TableHead>{t('work_center') || "Ish markazi"}</TableHead>
                    <TableHead>{t('last_maintenance') || "Oxirgi ta'mir"}</TableHead>
                    <TableHead>{t('next_due') || "Keyingi ta'mir"}</TableHead>
                    <TableHead>{t('status') || "Holat"}</TableHead>
                    <TableHead className="text-right">{t('actions') || "Amallar"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        {t('no_equipment_found') || "Jihozlar topilmadi"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    equipment.map(eq => {
                      const nextDue = eq.last_maintenance
                        ? addDays(parseISO(eq.last_maintenance), eq.maintenance_interval_days)
                        : null;
                      const isDue = nextDue && isBefore(nextDue, new Date());

                      return (
                        <TableRow key={eq.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{eq.name}</p>
                              <p className="text-sm text-slate-500">{eq.code}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t(eq.type) || eq.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {workCenters.find(wc => wc.id === eq.work_center_id)?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {eq.last_maintenance ? format(parseISO(eq.last_maintenance), 'dd.MM.yyyy', { locale: getDateLocale() }) : '-'}
                          </TableCell>
                          <TableCell>
                            {nextDue && (
                              <span className={isDue ? 'text-red-600 font-medium' : ''}>
                                {format(nextDue, 'dd.MM.yyyy', { locale: getDateLocale() })}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              eq.status === 'operational' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }>
                              {t(eq.status) || eq.status}
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
                                <DropdownMenuItem onClick={() => { setSelectedItem(eq); setShowViewModal(true); }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  {t('view') || "Ko'rish"}
                                </DropdownMenuItem>
                                {canDelete(MODULES.MANUFACTURING) && (
                                  <DropdownMenuItem
                                    onClick={() => { setSelectedItem(eq); setShowDeleteDialog(true); }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {t('delete') || "O'chirish"}
                                  </DropdownMenuItem>
                                )}
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
        </TabsContent>

        {/* Maintenance Tasks Tab */}
        <TabsContent value="maintenance" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={t('search_tasks') || "Vazifalarni qidirish..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('all_statuses') || "Barcha holatlar"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || "Barchasi"}</SelectItem>
                    <SelectItem value="scheduled">{t('scheduled') || "Rejalashtirilgan"}</SelectItem>
                    <SelectItem value="due">{t('due') || "Muddati yetdi"}</SelectItem>
                    <SelectItem value="overdue">{t('overdue') || "Kechikkan"}</SelectItem>
                    <SelectItem value="in_progress">{t('in_progress') || "Jarayonda"}</SelectItem>
                    <SelectItem value="completed">{t('completed') || "Tugallandi"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('task') || "Vazifa"}</TableHead>
                    <TableHead>{t('equipment') || "Jihoz"}</TableHead>
                    <TableHead>{t('type') || "Turi"}</TableHead>
                    <TableHead>{t('scheduled_date') || "Sana"}</TableHead>
                    <TableHead>{t('assigned_to') || "Javobgar"}</TableHead>
                    <TableHead>{t('status') || "Holat"}</TableHead>
                    <TableHead className="text-right">{t('actions') || "Amallar"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        {t('no_tasks_found') || "Vazifalar topilmadi"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map(task => {
                      const status = getTaskStatus(task);
                      const StatusIcon = MAINTENANCE_STATUS[status]?.icon || Clock;
                      const eq = equipment.find(e => e.id === task.equipment_id);

                      return (
                        <TableRow key={task.id}>
                          <TableCell>
                            <p className="font-medium">{task.description}</p>
                            <p className="text-sm text-slate-500">{task.id}</p>
                          </TableCell>
                          <TableCell>{eq?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={MAINTENANCE_TYPE[task.type]?.color}>
                              {t(MAINTENANCE_TYPE[task.type]?.label) || task.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(parseISO(task.scheduled_date), 'dd.MM.yyyy', { locale: getDateLocale() })}</TableCell>
                          <TableCell>{task.assigned_to || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={MAINTENANCE_STATUS[status]?.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {t(MAINTENANCE_STATUS[status]?.label) || status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canUpdate(MODULES.MANUFACTURING) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedItem(task);
                                    setNewTask({
                                      equipment_id: task.equipment_id,
                                      type: task.type,
                                      priority: task.priority,
                                      description: task.description,
                                      scheduled_date: task.scheduled_date,
                                      estimated_duration: task.estimated_duration,
                                      assigned_to: task.assigned_to || '',
                                    });
                                    setShowEditTaskModal(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {status !== 'completed' && canUpdate(MODULES.MANUFACTURING) && (
                                <Button
                                  size="sm"
                                  onClick={() => { setSelectedItem(task); setShowCompleteModal(true); }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {t('complete') || "Tugat"}
                                </Button>
                              )}
                              {canDelete(MODULES.MANUFACTURING) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedItem(task); setShowDeleteDialog(true); }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t('maintenance_history') || "Ta'mirlash tarixi"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>{t('history_coming_soon') || "Tarix ko'rinishi tez orada qo'shiladi"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Equipment Modal */}
      <Dialog open={showCreateEquipmentModal} onOpenChange={setShowCreateEquipmentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_equipment') || "Yangi jihoz"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('equipment_name') || "Jihoz nomi"} *</Label>
              <Input
                value={newEquipment.name}
                onChange={e => setNewEquipment({ ...newEquipment, name: e.target.value })}
                placeholder={t('enter_equipment_name') || "Jihoz nomini kiriting"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('equipment_type') || "Jihoz turi"}</Label>
                <Select
                  value={newEquipment.type}
                  onValueChange={value => setNewEquipment({ ...newEquipment, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="machine">{t('machine') || "Mashina"}</SelectItem>
                    <SelectItem value="robot">{t('robot') || "Robot"}</SelectItem>
                    <SelectItem value="tool">{t('tool') || "Asbob"}</SelectItem>
                    <SelectItem value="vehicle">{t('vehicle') || "Transport"}</SelectItem>
                    <SelectItem value="other">{t('other') || "Boshqa"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('work_center') || "Ish markazi"}</Label>
                <Select
                  value={newEquipment.work_center_id}
                  onValueChange={value => setNewEquipment({ ...newEquipment, work_center_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_work_center') || "Tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {workCenters.filter(wc => wc.id).map(wc => (
                      <SelectItem key={wc.id} value={wc.id}>{wc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('manufacturer') || "Ishlab chiqaruvchi"}</Label>
                <Input
                  value={newEquipment.manufacturer}
                  onChange={e => setNewEquipment({ ...newEquipment, manufacturer: e.target.value })}
                  placeholder="Haas, FANUC..."
                />
              </div>
              <div className="space-y-2">
                <Label>{t('model') || "Model"}</Label>
                <Input
                  value={newEquipment.model}
                  onChange={e => setNewEquipment({ ...newEquipment, model: e.target.value })}
                  placeholder="VF-2, M-20iA..."
                />
              </div>
              <div className="space-y-2">
                <Label>{t('serial_number') || "Seriya raqami"}</Label>
                <Input
                  value={newEquipment.serial_number}
                  onChange={e => setNewEquipment({ ...newEquipment, serial_number: e.target.value })}
                  placeholder="SN-12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('purchase_date') || "Xarid sanasi"}</Label>
                <Input
                  type="date"
                  value={newEquipment.purchase_date}
                  onChange={e => setNewEquipment({ ...newEquipment, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('warranty_expiry') || "Kafolat muddati"}</Label>
                <Input
                  type="date"
                  value={newEquipment.warranty_expiry}
                  onChange={e => setNewEquipment({ ...newEquipment, warranty_expiry: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('maintenance_interval_days') || "Ta'mir oralig'i (kun)"}</Label>
              <Input
                type="number"
                value={newEquipment.maintenance_interval_days}
                onChange={e => setNewEquipment({ ...newEquipment, maintenance_interval_days: parseInt(e.target.value) || 30 })}
                placeholder="30"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowCreateEquipmentModal(false); resetEquipmentForm(); }}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleCreateEquipment}
                disabled={isSubmitting || !newEquipment.name}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {t('create_equipment') || "Jihozni qo'shish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal */}
      <Dialog open={showCreateTaskModal} onOpenChange={setShowCreateTaskModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('new_maintenance_task') || "Yangi ta'mirlash vazifasi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('equipment') || "Jihoz"} *</Label>
              <Select
                value={newTask.equipment_id}
                onValueChange={value => setNewTask({ ...newTask, equipment_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_equipment') || "Jihozni tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {equipment.filter(eq => eq.id).map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('maintenance_type') || "Ta'mir turi"} *</Label>
                <Select
                  value={newTask.type}
                  onValueChange={value => setNewTask({ ...newTask, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINTENANCE_TYPE).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{t(label) || label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('priority') || "Muhimlik"}</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={value => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('low') || "Past"}</SelectItem>
                    <SelectItem value="medium">{t('medium') || "O'rta"}</SelectItem>
                    <SelectItem value="high">{t('high') || "Yuqori"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('description') || "Tavsif"} *</Label>
              <Textarea
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                placeholder={t('enter_task_description') || "Vazifa tavsifini kiriting..."}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('scheduled_date') || "Rejalashtirilgan sana"} *</Label>
                <Input
                  type="date"
                  value={newTask.scheduled_date}
                  onChange={e => setNewTask({ ...newTask, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('estimated_duration_min') || "Taxminiy vaqt (daq)"}</Label>
                <Input
                  type="number"
                  value={newTask.estimated_duration}
                  onChange={e => setNewTask({ ...newTask, estimated_duration: parseInt(e.target.value) || 60 })}
                  placeholder="60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('assigned_to') || "Javobgar"}</Label>
              <Input
                value={newTask.assigned_to}
                onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })}
                placeholder={t('enter_assignee') || "Javobgar nomini kiriting"}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowCreateTaskModal(false); resetTaskForm(); }}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={isSubmitting || !newTask.equipment_id || !newTask.description || !newTask.scheduled_date}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {t('create_task') || "Vazifa yaratish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={showEditTaskModal} onOpenChange={setShowEditTaskModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('edit_maintenance_task') || "Ta'mirlash vazifasini tahrirlash"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('equipment') || "Jihoz"} *</Label>
              <Select
                value={newTask.equipment_id}
                onValueChange={value => setNewTask({ ...newTask, equipment_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_equipment') || "Jihozni tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {equipment.filter(eq => eq.id).map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('maintenance_type') || "Ta'mir turi"} *</Label>
                <Select
                  value={newTask.type}
                  onValueChange={value => setNewTask({ ...newTask, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAINTENANCE_TYPE).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{t(label) || label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('priority') || "Muhimlik"}</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={value => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('low') || "Past"}</SelectItem>
                    <SelectItem value="medium">{t('medium') || "O'rta"}</SelectItem>
                    <SelectItem value="high">{t('high') || "Yuqori"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('description') || "Tavsif"} *</Label>
              <Textarea
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                placeholder={t('enter_task_description') || "Vazifa tavsifini kiriting..."}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('scheduled_date') || "Rejalashtirilgan sana"} *</Label>
                <Input
                  type="date"
                  value={newTask.scheduled_date}
                  onChange={e => setNewTask({ ...newTask, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('estimated_duration_min') || "Taxminiy vaqt (daq)"}</Label>
                <Input
                  type="number"
                  value={newTask.estimated_duration}
                  onChange={e => setNewTask({ ...newTask, estimated_duration: parseInt(e.target.value) || 60 })}
                  placeholder="60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('assigned_to') || "Javobgar"}</Label>
              <Input
                value={newTask.assigned_to}
                onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })}
                placeholder={t('enter_assignee') || "Javobgar nomini kiriting"}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowEditTaskModal(false); setSelectedItem(null); resetTaskForm(); }}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleEditTask}
                disabled={isSubmitting || !newTask.equipment_id || !newTask.description || !newTask.scheduled_date}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {t('save_changes') || "O'zgarishlarni saqlash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Task Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('complete_maintenance_task') || "Vazifani tugatish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('actual_date') || "Haqiqiy sana"} *</Label>
                <Input
                  type="date"
                  value={completionData.actual_date}
                  onChange={e => setCompletionData({ ...completionData, actual_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('actual_duration_min') || "Haqiqiy vaqt (daq)"}</Label>
                <Input
                  type="number"
                  value={completionData.actual_duration}
                  onChange={e => setCompletionData({ ...completionData, actual_duration: parseInt(e.target.value) || 0 })}
                  placeholder="60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('cost') || "Xarajat"}</Label>
              <Input
                type="number"
                value={completionData.cost}
                onChange={e => setCompletionData({ ...completionData, cost: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            {selectedItem?.type === 'preventive' && (
              <div className="space-y-2">
                <Label>{t('next_maintenance_date') || "Keyingi ta'mir sanasi"}</Label>
                <Input
                  type="date"
                  value={completionData.next_maintenance_date}
                  onChange={e => setCompletionData({ ...completionData, next_maintenance_date: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('notes') || "Izohlar"}</Label>
              <Textarea
                value={completionData.notes}
                onChange={e => setCompletionData({ ...completionData, notes: e.target.value })}
                placeholder={t('enter_completion_notes') || "Tugash haqida izoh..."}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleCompleteTask}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('complete_task') || "Tugat"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Equipment Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('equipment_details') || "Jihoz tafsilotlari"}</DialogTitle>
          </DialogHeader>
          {selectedItem && activeTab === 'equipment' && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('equipment_name') || "Nomi"}</p>
                  <p className="font-medium">{selectedItem.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('code') || "Kod"}</p>
                  <p className="font-medium">{selectedItem.code}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('manufacturer') || "Ishlab chiqaruvchi"}</p>
                  <p className="font-medium">{selectedItem.manufacturer || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('model') || "Model"}</p>
                  <p className="font-medium">{selectedItem.model || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('serial_number') || "Seriya raqami"}</p>
                  <p className="font-medium">{selectedItem.serial_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('status') || "Holat"}</p>
                  <Badge variant="outline" className={
                    selectedItem.status === 'operational' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }>
                    {t(selectedItem.status) || selectedItem.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activeTab === 'equipment'
                ? (t('delete_equipment') || "Jihozni o'chirish")
                : (t('delete_task') || "Vazifani o'chirish")
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_confirm') || "Bu amalni qaytarib bo'lmaydi. Davom etasizmi?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
