import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Repeat,
  Play,
  Pause,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  History,
  Settings,
} from "lucide-react";
import { format, addDays, addWeeks, addMonths, addYears, isPast, isFuture } from "date-fns";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

// Recurrence patterns
export const RECURRENCE_PATTERNS = {
  daily: { label: "Kunlik", icon: Calendar, interval: "day" },
  weekly: { label: "Haftalik", icon: Calendar, interval: "week" },
  biweekly: { label: "Ikki haftalik", icon: Calendar, interval: "biweek" },
  monthly: { label: "Oylik", icon: Calendar, interval: "month" },
  quarterly: { label: "Choraklik", icon: Calendar, interval: "quarter" },
  yearly: { label: "Yillik", icon: Calendar, interval: "year" },
};

// Days of week
const DAYS_OF_WEEK = [
  { value: 0, label: "Yakshanba" },
  { value: 1, label: "Dushanba" },
  { value: 2, label: "Seshanba" },
  { value: 3, label: "Chorshanba" },
  { value: 4, label: "Payshanba" },
  { value: 5, label: "Juma" },
  { value: 6, label: "Shanba" },
];

// Calculate next occurrence
export const calculateNextOccurrence = (pattern, lastOccurrence, dayOfWeek = null, dayOfMonth = null) => {
  const baseDate = lastOccurrence ? new Date(lastOccurrence) : new Date();

  switch (pattern) {
    case "daily":
      return addDays(baseDate, 1);
    case "weekly":
      if (dayOfWeek !== null) {
        let next = addWeeks(baseDate, 1);
        while (next.getDay() !== dayOfWeek) {
          next = addDays(next, 1);
        }
        return next;
      }
      return addWeeks(baseDate, 1);
    case "biweekly":
      return addWeeks(baseDate, 2);
    case "monthly":
      if (dayOfMonth) {
        const next = addMonths(baseDate, 1);
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        return next;
      }
      return addMonths(baseDate, 1);
    case "quarterly":
      return addMonths(baseDate, 3);
    case "yearly":
      return addYears(baseDate, 1);
    default:
      return addMonths(baseDate, 1);
  }
};

// Local storage hook for recurring transactions
export function useRecurringTransactions(entityType) {
  const [templates, setTemplates] = useState([]);
  const [executions, setExecutions] = useState([]);
  const storageKey = `recurring_${entityType}`;
  const executionsKey = `recurring_executions_${entityType}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const storedExecutions = localStorage.getItem(executionsKey);
    if (stored) {
      setTemplates(JSON.parse(stored));
    }
    if (storedExecutions) {
      setExecutions(JSON.parse(storedExecutions));
    }
  }, [storageKey, executionsKey]);

  const saveTemplates = (newTemplates) => {
    setTemplates(newTemplates);
    localStorage.setItem(storageKey, JSON.stringify(newTemplates));
  };

  const addTemplate = (template) => {
    const newTemplate = {
      id: `rec_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isActive: true,
      lastExecution: null,
      nextExecution: calculateNextOccurrence(template.pattern, null, template.dayOfWeek, template.dayOfMonth).toISOString(),
      executionCount: 0,
      ...template,
    };
    saveTemplates([...templates, newTemplate]);
    return newTemplate;
  };

  const updateTemplate = (id, updates) => {
    const updated = templates.map((t) =>
      t.id === id
        ? {
            ...t,
            ...updates,
            nextExecution: updates.pattern
              ? calculateNextOccurrence(updates.pattern, t.lastExecution, updates.dayOfWeek, updates.dayOfMonth).toISOString()
              : t.nextExecution,
          }
        : t
    );
    saveTemplates(updated);
  };

  const deleteTemplate = (id) => {
    saveTemplates(templates.filter((t) => t.id !== id));
  };

  const toggleActive = (id) => {
    const updated = templates.map((t) =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    );
    saveTemplates(updated);
  };

  const recordExecution = (templateId, result) => {
    const execution = {
      id: `exec_${Date.now()}`,
      templateId,
      executedAt: new Date().toISOString(),
      result,
      success: result.success,
    };
    const newExecutions = [...executions, execution].slice(-100);
    setExecutions(newExecutions);
    localStorage.setItem(executionsKey, JSON.stringify(newExecutions));

    // Update template with execution info
    const updated = templates.map((t) =>
      t.id === templateId
        ? {
            ...t,
            lastExecution: new Date().toISOString(),
            nextExecution: calculateNextOccurrence(t.pattern, new Date().toISOString(), t.dayOfWeek, t.dayOfMonth).toISOString(),
            executionCount: t.executionCount + 1,
          }
        : t
    );
    saveTemplates(updated);
  };

  const getDueTemplates = () => {
    const now = new Date();
    return templates.filter(
      (t) => t.isActive && t.nextExecution && isPast(new Date(t.nextExecution))
    );
  };

  const getTemplateExecutions = (templateId) => {
    return executions.filter((e) => e.templateId === templateId);
  };

  return {
    templates,
    executions,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    toggleActive,
    recordExecution,
    getDueTemplates,
    getTemplateExecutions,
  };
}

// Recurring Template Form
export function RecurringTemplateForm({
  open,
  onClose,
  onSave,
  template = null,
  fields = [],
  entityName = "Transaction",
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    pattern: "monthly",
    dayOfWeek: null,
    dayOfMonth: 1,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    maxExecutions: null,
    data: {},
    ...template,
  });

  useEffect(() => {
    if (template) {
      setFormData({ ...formData, ...template });
    }
  }, [template]);

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  // Get translated recurrence patterns
  const getRecurrencePatterns = () => ({
    daily: { label: t('daily') || 'Daily', icon: Calendar, interval: "day" },
    weekly: { label: t('weekly') || 'Weekly', icon: Calendar, interval: "week" },
    biweekly: { label: t('biweekly') || 'Bi-weekly', icon: Calendar, interval: "biweek" },
    monthly: { label: t('monthly') || 'Monthly', icon: Calendar, interval: "month" },
    quarterly: { label: t('quarterly') || 'Quarterly', icon: Calendar, interval: "quarter" },
    yearly: { label: t('yearly') || 'Yearly', icon: Calendar, interval: "year" },
  });

  // Get translated days of week
  const getDaysOfWeek = () => [
    { value: 0, label: t('sunday') || 'Sunday' },
    { value: 1, label: t('monday') || 'Monday' },
    { value: 2, label: t('tuesday') || 'Tuesday' },
    { value: 3, label: t('wednesday') || 'Wednesday' },
    { value: 4, label: t('thursday') || 'Thursday' },
    { value: 5, label: t('friday') || 'Friday' },
    { value: 6, label: t('saturday') || 'Saturday' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" />
            {template ? t('edit_recurring_template') || 'Edit Recurring Template' : t('new_recurring_template') || 'New Recurring Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>{t('name')} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('recurring_template_name_placeholder') || 'Recurring template name'}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>{t('description')}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('optional_description') || 'Optional description'}
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t('schedule_settings') || 'Schedule Settings'}
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('recurrence_pattern') || 'Recurrence Pattern'}</Label>
                <Select
                  value={formData.pattern}
                  onValueChange={(value) => setFormData({ ...formData, pattern: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_pattern') || 'Select pattern'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(getRecurrencePatterns()).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.pattern === "weekly" && (
                <div className="space-y-2">
                  <Label>{t('day_of_week') || 'Day of Week'}</Label>
                  <Select
                    value={formData.dayOfWeek?.toString()}
                    onValueChange={(value) => setFormData({ ...formData, dayOfWeek: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_day') || 'Select day'} />
                    </SelectTrigger>
                    <SelectContent>
                      {getDaysOfWeek().map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {["monthly", "quarterly", "yearly"].includes(formData.pattern) && (
                <div className="space-y-2">
                  <Label>{t('day_of_month') || 'Day of Month'}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.dayOfMonth || ""}
                    onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('start_date') || 'Start Date'}</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('end_date_optional') || 'End Date (Optional)'}</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('max_executions_optional') || 'Max Executions (Optional)'}</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.maxExecutions || ""}
                  onChange={(e) => setFormData({ ...formData, maxExecutions: parseInt(e.target.value) || null })}
                  placeholder={t('unlimited') || 'Unlimited'}
                />
              </div>
            </div>
          </div>

          {/* Entity-specific fields */}
          {fields.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">{entityName} {t('details') || 'Details'}</h4>
              <div className="grid grid-cols-2 gap-4">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required && " *"}
                    </Label>
                    {field.type === "select" ? (
                      <Select
                        value={formData.data?.[field.key] || ""}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            data: { ...formData.data, [field.key]: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`${t('select')} ${field.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type || "text"}
                        value={formData.data?.[field.key] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            data: { ...formData.data, [field.key]: e.target.value },
                          })
                        }
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {template ? t('save') || 'Save' : t('create') || 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Recurring Templates List
export function RecurringTemplatesList({
  templates,
  onEdit,
  onDelete,
  onToggle,
  onExecute,
  entityName = "Transaction",
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Get translated recurrence patterns
  const getPatternLabel = (pattern) => {
    const labels = {
      daily: t('daily') || 'Daily',
      weekly: t('weekly') || 'Weekly',
      biweekly: t('biweekly') || 'Bi-weekly',
      monthly: t('monthly') || 'Monthly',
      quarterly: t('quarterly') || 'Quarterly',
      yearly: t('yearly') || 'Yearly',
    };
    return labels[pattern] || pattern;
  };

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Repeat className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{t('no_recurring_templates') || `No recurring ${entityName.toLowerCase()}s yet`}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>{t('name') || 'Name'}</TableHead>
            <TableHead>{t('period') || 'Period'}</TableHead>
            <TableHead>{t('next_execution') || 'Next Execution'}</TableHead>
            <TableHead>{t('executions') || 'Executions'}</TableHead>
            <TableHead>{t('status') || 'Status'}</TableHead>
            <TableHead className="w-32">{t('actions') || 'Actions'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => {
            const isDue = template.nextExecution && isPast(new Date(template.nextExecution));

            return (
              <TableRow key={template.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-slate-500">{template.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getPatternLabel(template.pattern)}</Badge>
                </TableCell>
                <TableCell>
                  {template.nextExecution ? (
                    <div className={`flex items-center gap-1 ${isDue ? "text-orange-600" : ""}`}>
                      {isDue && <AlertCircle className="w-4 h-4" />}
                      {format(new Date(template.nextExecution), "dd.MM.yyyy")}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {template.executionCount || 0}
                    {template.maxExecutions && ` / ${template.maxExecutions}`}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={() => onToggle(template.id)}
                    />
                    <span className="text-sm">
                      {template.isActive ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isDue && onExecute && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExecute(template)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(template)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(template.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Execution History
export function ExecutionHistory({ executions = [], onClose }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {t('execution_history') || 'Execution History'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {executions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('no_execution_history') || 'No execution history'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions
                .slice()
                .reverse()
                .map((exec) => (
                  <div
                    key={exec.id}
                    className={`p-3 rounded-lg border ${
                      exec.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {exec.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {exec.success ? (t('successful') || 'Successful') : (t('error') || 'Error')}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {format(new Date(exec.executedAt), "dd.MM.yyyy HH:mm")}
                      </span>
                    </div>
                    {exec.result?.message && (
                      <p className="text-sm mt-2">{exec.result.message}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Recurring Panel Card
export function RecurringPanel({
  entityType,
  entityName,
  fields = [],
  onCreateTransaction,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    toggleActive,
    recordExecution,
    getDueTemplates,
  } = useRecurringTransactions(entityType);

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const dueTemplates = getDueTemplates();

  const handleSave = (data) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data);
    } else {
      addTemplate(data);
    }
    setEditingTemplate(null);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleExecute = async (template) => {
    if (onCreateTransaction) {
      try {
        await onCreateTransaction(template.data);
        recordExecution(template.id, { success: true, message: t('transaction_created') || "Transaction created" });
      } catch (error) {
        recordExecution(template.id, { success: false, message: error.message });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" />
            {t('recurring')} {entityName}
            {dueTemplates.length > 0 && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                {dueTemplates.length} {t('pending') || 'pending'}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('new_template') || 'New Template'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <RecurringTemplatesList
          templates={templates}
          onEdit={handleEdit}
          onDelete={deleteTemplate}
          onToggle={toggleActive}
          onExecute={onCreateTransaction ? handleExecute : null}
          entityName={entityName}
        />

        <RecurringTemplateForm
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingTemplate(null);
          }}
          onSave={handleSave}
          template={editingTemplate}
          fields={fields}
          entityName={entityName}
        />
      </CardContent>
    </Card>
  );
}

export default {
  RECURRENCE_PATTERNS,
  calculateNextOccurrence,
  useRecurringTransactions,
  RecurringTemplateForm,
  RecurringTemplatesList,
  ExecutionHistory,
  RecurringPanel,
};
