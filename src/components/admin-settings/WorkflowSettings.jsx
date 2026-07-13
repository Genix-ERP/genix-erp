import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsToggle } from './SettingsSection';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap, Plus, Edit, Trash2, Play, Pause, Clock, AlertTriangle,
  Package, FileText, Users, History, CheckCircle, XCircle, DollarSign, Flag
} from 'lucide-react';
import apiClient from '@/api/client';

const TRIGGER_EVENTS = [
  { value: 'inventory.low_stock', labelKey: 'evt_low_stock', descKey: 'evt_low_stock_desc', category: 'inventory', icon: Package },
  { value: 'inventory.adjusted', labelKey: 'evt_inventory_adjusted', descKey: 'evt_inventory_adjusted_desc', category: 'inventory', icon: Package },
  { value: 'invoice.overdue', labelKey: 'evt_invoice_overdue', descKey: 'evt_invoice_overdue_desc', category: 'sales', icon: FileText },
  { value: 'lead.created', labelKey: 'evt_lead_created', descKey: 'evt_lead_created_desc', category: 'crm', icon: Users },
  // Project automation events
  { value: 'project.task.assigned', labelKey: 'evt_proj_task_assigned', descKey: 'evt_proj_task_assigned_desc', category: 'project', icon: Users },
  { value: 'project.task.overdue', labelKey: 'evt_proj_task_overdue', descKey: 'evt_proj_task_overdue_desc', category: 'project', icon: AlertTriangle },
  { value: 'project.task.status_changed', labelKey: 'evt_proj_task_status', descKey: 'evt_proj_task_status_desc', category: 'project', icon: Clock },
  { value: 'project.milestone.completed', labelKey: 'evt_proj_milestone', descKey: 'evt_proj_milestone_desc', category: 'project', icon: Flag },
  { value: 'project.over_budget', labelKey: 'evt_proj_over_budget', descKey: 'evt_proj_over_budget_desc', category: 'project', icon: DollarSign },
];

const ACTION_TYPES = [
  { value: 'create_notification', labelKey: 'act_create_notification' },
  { value: 'update_status', labelKey: 'act_update_status' },
  { value: 'create_record', labelKey: 'act_create_record' },
  { value: 'update_task_priority', labelKey: 'act_update_task_priority' },
  { value: 'create_followup_task', labelKey: 'act_create_followup_task' },
];

const EMPTY_RULE = {
  name: '',
  description: '',
  category: 'inventory',
  trigger_type: 'event',
  trigger_event: '',
  conditions: {},
  actions: [{ type: 'create_notification', config: { message: '' } }],
  is_active: true,
  priority: 0,
};

export default function WorkflowSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState(EMPTY_RULE);
  const [activeTab, setActiveTab] = useState('rules');

  const fetchRules = useCallback(async () => {
    try {
      const res = await apiClient.get('/workflow-rules');
      setRules(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch workflow rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiClient.get('/workflow-logs?limit=50');
      setLogs(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch workflow logs:', err);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchLogs();
  }, [fetchRules, fetchLogs]);

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        conditions: formData.conditions || {},
        actions: formData.actions || [],
      };

      if (editingRule) {
        await apiClient.put(`/workflow-rules/${editingRule.id}`, payload);
      } else {
        await apiClient.post('/workflow-rules', payload);
      }
      setShowForm(false);
      setEditingRule(null);
      setFormData(EMPTY_RULE);
      fetchRules();
    } catch (err) {
      console.error('Failed to save workflow rule:', err);
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      category: rule.category,
      trigger_type: rule.trigger_type,
      trigger_event: rule.trigger_event || '',
      conditions: rule.conditions || {},
      actions: rule.actions || [],
      is_active: rule.is_active,
      priority: rule.priority,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm(t('delete_rule_confirm') || 'Are you sure you want to delete this rule?')) return;
    try {
      await apiClient.delete(`/workflow-rules/${id}`);
      fetchRules();
    } catch (err) {
      console.error('Failed to delete workflow rule:', err);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await apiClient.put(`/workflow-rules/${rule.id}`, { is_active: !rule.is_active });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle workflow rule:', err);
    }
  };

  const updateAction = (index, field, value) => {
    const newActions = [...formData.actions];
    if (field === 'type') {
      newActions[index] = { type: value, config: {} };
    } else {
      newActions[index] = {
        ...newActions[index],
        config: { ...newActions[index].config, [field]: value }
      };
    }
    setFormData({ ...formData, actions: newActions });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'create_notification', config: { message: '' } }]
    });
  };

  const removeAction = (index) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    });
  };

  const getEventLabel = (event) => {
    const found = TRIGGER_EVENTS.find(e => e.value === event);
    return found ? t(found.labelKey) : event;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'rules' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('rules')}
        >
          <Zap className="w-4 h-4 mr-2" />
          {t('automation_rules') || 'Automation Rules'}
        </Button>
        <Button
          variant={activeTab === 'logs' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('logs')}
        >
          <History className="w-4 h-4 mr-2" />
          {t('execution_logs') || 'Execution Logs'}
        </Button>
      </div>

      {activeTab === 'rules' && (
        <>
          <SettingsSection
            title={t('automation_rules') || 'Automation Rules'}
            description={t('automation_rules_desc') || 'Configure rules that automatically trigger actions based on events and conditions'}
            icon={Zap}
          >
            <div className="mb-4">
              <Button
                onClick={() => {
                  setEditingRule(null);
                  setFormData(EMPTY_RULE);
                  setShowForm(true);
                }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('add_rule') || 'Add Rule'}
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500 py-4 text-center">Loading...</p>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('no_rules_yet') || 'No automation rules configured yet'}</p>
                <p className="text-xs mt-1">{t('no_rules_desc') || 'Create rules to automate actions based on business events'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map(rule => (
                  <Card key={rule.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">{rule.name}</h4>
                            <Badge className={rule.is_active
                              ? "bg-green-100 text-green-700 text-xs"
                              : "bg-slate-100 text-slate-500 text-xs"
                            }>
                              {rule.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{t(rule.category) || rule.category}</Badge>
                          </div>
                          {rule.description && (
                            <p className="text-xs text-slate-500 mb-2 truncate">{rule.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {getEventLabel(rule.trigger_event)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {t('triggered') || 'Triggered'}: {rule.trigger_count}x
                            </span>
                            {rule.last_triggered_at && (
                              <span>
                                {t('last') || 'Last'}: {new Date(rule.last_triggered_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button variant="ghost" size="sm" onClick={() => handleToggle(rule)} title={rule.is_active ? 'Pause' : 'Activate'}>
                            {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </SettingsSection>

          {/* Available Events Reference */}
          <SettingsSection
            title={t('available_events') || 'Available Trigger Events'}
            description={t('available_events_desc') || 'Events that can trigger automation rules'}
            icon={AlertTriangle}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {TRIGGER_EVENTS.map(event => (
                <div key={event.value} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <event.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t(event.labelKey)}</p>
                    <p className="text-xs text-slate-400">{t(event.descKey)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs ml-auto">{t(event.category) || event.category}</Badge>
                </div>
              ))}
            </div>
          </SettingsSection>
        </>
      )}

      {activeTab === 'logs' && (
        <SettingsSection
          title={t('execution_logs') || 'Execution Logs'}
          description={t('execution_logs_desc') || 'History of automated workflow executions'}
          icon={History}
        >
          <div className="mb-3">
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              {t('refresh') || 'Refresh'}
            </Button>
          </div>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_logs_yet') || 'No execution logs yet'}</p>
              <p className="text-xs mt-1">{t('no_logs_desc') || 'Logs will appear here when automation rules are triggered'}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                  {log.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : log.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{log.rule_name}</span>
                      <Badge className={
                        log.status === 'success' ? 'bg-green-100 text-green-700 text-xs' :
                        log.status === 'failed' ? 'bg-red-100 text-red-700 text-xs' :
                        'bg-yellow-100 text-yellow-700 text-xs'
                      }>
                        {t(log.status) || log.status}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(log.executed_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      )}

      {/* Create/Edit Rule Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? (t('edit_rule') || 'Edit Rule') : (t('create_rule') || 'Create Automation Rule')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('rule_name') || 'Rule Name'}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('rule_name_placeholder') || 'e.g. Low Stock Alert'}
              />
            </div>

            <div>
              <Label>{t('description') || 'Description'}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('rule_desc_placeholder') || 'What does this rule do?'}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('category') || 'Category'}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inventory">{t('inventory') || 'Inventory'}</SelectItem>
                    <SelectItem value="sales">{t('sales') || 'Sales'}</SelectItem>
                    <SelectItem value="purchase">{t('purchase') || 'Purchase'}</SelectItem>
                    <SelectItem value="crm">{t('crm') || 'CRM'}</SelectItem>
                    <SelectItem value="hr">{t('hr') || 'HR'}</SelectItem>
                    <SelectItem value="finance">{t('finance') || 'Finance'}</SelectItem>
                    <SelectItem value="project">{t('project') || 'Project'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('trigger_type') || 'Trigger Type'}</Label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(val) => setFormData({ ...formData, trigger_type: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">{t('event_based') || 'Event Based'}</SelectItem>
                    <SelectItem value="threshold">{t('threshold') || 'Threshold'}</SelectItem>
                    <SelectItem value="scheduled">{t('scheduled') || 'Scheduled'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{t('trigger_event') || 'Trigger Event'}</Label>
              <Select
                value={formData.trigger_event}
                onValueChange={(val) => {
                  const event = TRIGGER_EVENTS.find(e => e.value === val);
                  setFormData({
                    ...formData,
                    trigger_event: val,
                    category: event?.category || formData.category
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder={t('select_event') || 'Select event...'} /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map(event => (
                    <SelectItem key={event.value} value={event.value}>
                      {t(event.labelKey)} ({t(event.category) || event.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('priority') || 'Priority'}</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min={0}
              />
              <p className="text-xs text-slate-400 mt-1">{t('priority_hint') || 'Higher priority rules execute first'}</p>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('actions') || 'Actions'}</Label>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="w-3 h-3 mr-1" /> {t('add_action') || 'Add Action'}
                </Button>
              </div>

              {formData.actions.map((action, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Select
                      value={action.type}
                      onValueChange={(val) => updateAction(index, 'type', val)}
                    >
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(at => (
                          <SelectItem key={at.value} value={at.value}>{t(at.labelKey)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.actions.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeAction(index)}>
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    )}
                  </div>

                  {action.type === 'create_notification' && (
                    <Input
                      value={action.config?.message || ''}
                      onChange={(e) => updateAction(index, 'message', e.target.value)}
                      placeholder={t('notification_msg_placeholder') || 'Notification message. Use {product_name}, {available} etc.'}
                      className="text-sm"
                    />
                  )}

                  {action.type === 'update_task_priority' && (
                    <Select
                      value={action.config?.priority || 'high'}
                      onValueChange={(val) => updateAction(index, 'priority', val)}
                    >
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t('low') || 'Low'}</SelectItem>
                        <SelectItem value="medium">{t('medium') || 'Medium'}</SelectItem>
                        <SelectItem value="high">{t('high') || 'High'}</SelectItem>
                        <SelectItem value="urgent">{t('urgent') || 'Urgent'}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {action.type === 'create_followup_task' && (
                    <Input
                      value={action.config?.title || ''}
                      onChange={(e) => updateAction(index, 'title', e.target.value)}
                      placeholder={t('followup_title_placeholder') || '{milestone_title} — keyingi qadamlar'}
                      className="text-sm"
                    />
                  )}

                  {action.type === 'update_status' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={action.config?.table || ''}
                        onValueChange={(val) => updateAction(index, 'table', val)}
                      >
                        <SelectTrigger><SelectValue placeholder={t('table') || 'Table'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="leads">{t('leads') || 'Leads'}</SelectItem>
                          <SelectItem value="sales_invoices">{t('sales_invoices') || 'Sales Invoices'}</SelectItem>
                          <SelectItem value="purchase_orders">{t('purchase_orders') || 'Purchase Orders'}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={action.config?.status || ''}
                        onChange={(e) => updateAction(index, 'status', e.target.value)}
                        placeholder={t('new_status') || 'New status'}
                      />
                    </div>
                  )}

                  {action.type === 'create_record' && (
                    <Select
                      value={action.config?.record_type || ''}
                      onValueChange={(val) => updateAction(index, 'record_type', val)}
                    >
                      <SelectTrigger><SelectValue placeholder={t('record_type') || 'Record type'} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase_order_draft">{t('purchase_order_draft') || 'Purchase Order (Draft)'}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.trigger_event}>
              {editingRule ? (t('update') || 'Update') : (t('create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
