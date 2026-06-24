import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Plus,
  Settings,
  ArrowRight,
  Trash2,
  Edit,
  Building2,
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  History,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { intercompanyService } from '@/api/services';
import { organizationsService, warehouseService } from '@/api/services';
import { toast } from 'sonner';

const RULE_TYPES = [
  { value: 'sale_to_purchase', label: 'Sale Order → Purchase Order', description: 'When Company A sells to Company B, auto-create PO in Company B' },
  { value: 'purchase_to_sale', label: 'Purchase Order → Sale Order', description: 'When Company A buys from Company B, auto-create SO in Company B' },
  { value: 'invoice_to_bill', label: 'Invoice → Vendor Bill', description: 'When Company A invoices Company B, auto-create bill in Company B' },
  { value: 'bill_to_invoice', label: 'Vendor Bill → Invoice', description: 'When Company A receives bill from Company B, auto-create invoice in Company B' },
  { value: 'transfer', label: 'Inventory Transfer', description: 'Auto-process inventory transfers between company warehouses' },
];

const PRICING_METHODS = [
  { value: 'source_price', label: 'Source Document Price', description: 'Use the same prices from source document' },
  { value: 'cost_plus_markup', label: 'Cost + Markup', description: 'Apply markup percentage on cost' },
  { value: 'pricelist', label: 'Pricelist', description: 'Use target company pricelist' },
];

export default function IntercompanyRulesSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [activeTab, setActiveTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newRule, setNewRule] = useState({
    source_organization_id: '',
    target_organization_id: '',
    rule_type: '',
    is_active: true,
    auto_validate: false,
    sync_prices: true,
    default_warehouse_id: '',
    pricing_method: 'source_price',
    markup_percent: 0,
    notes: '',
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, orgsData, warehousesData] = await Promise.all([
        intercompanyService.listRules(),
        organizationsService.list(),
        warehouseService.list(),
      ]);
      setRules(rulesData?.data || []);
      setOrganizations(orgsData || []);
      setWarehouses(warehousesData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error(t('failed_to_load_data') || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const logsData = await intercompanyService.listLogs({ limit: 100 });
      setLogs(logsData?.data || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.source_organization_id || !newRule.target_organization_id || !newRule.rule_type) {
      toast.error(t('fill_required_fields') || 'Please fill all required fields');
      return;
    }

    if (newRule.source_organization_id === newRule.target_organization_id) {
      toast.error(t('source_target_different') || 'Source and target companies must be different');
      return;
    }

    setIsSubmitting(true);
    try {
      await intercompanyService.createRule(newRule);
      toast.success(t('rule_created') || 'Inter-company rule created successfully');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to create rule:', error);
      toast.error(error.response?.data?.message || t('failed_to_create_rule') || 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRule = async () => {
    if (!selectedRule) return;

    setIsSubmitting(true);
    try {
      await intercompanyService.updateRule(selectedRule.id, {
        is_active: selectedRule.is_active,
        auto_validate: selectedRule.auto_validate,
        sync_prices: selectedRule.sync_prices,
        default_warehouse_id: selectedRule.default_warehouse_id || '',
        pricing_method: selectedRule.pricing_method,
        markup_percent: selectedRule.markup_percent,
        notes: selectedRule.notes,
      });
      toast.success(t('rule_updated') || 'Rule updated successfully');
      setShowEditModal(false);
      setSelectedRule(null);
      loadData();
    } catch (error) {
      console.error('Failed to update rule:', error);
      toast.error(t('failed_to_update_rule') || 'Failed to update rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedRule) return;

    try {
      await intercompanyService.deleteRule(selectedRule.id);
      toast.success(t('rule_deleted') || 'Rule deleted successfully');
      setShowDeleteDialog(false);
      setSelectedRule(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error(t('failed_to_delete_rule') || 'Failed to delete rule');
    }
  };

  const toggleRuleActive = async (rule) => {
    try {
      await intercompanyService.updateRule(rule.id, { is_active: !rule.is_active });
      loadData();
      toast.success(rule.is_active ? t('rule_disabled') || 'Rule disabled' : t('rule_enabled') || 'Rule enabled');
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const resetForm = () => {
    setNewRule({
      source_organization_id: '',
      target_organization_id: '',
      rule_type: '',
      is_active: true,
      auto_validate: false,
      sync_prices: true,
      default_warehouse_id: '',
      pricing_method: 'source_price',
      markup_percent: 0,
      notes: '',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'created':
      case 'validated':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'cancelled':
        return <Badge className="bg-slate-100 text-slate-700"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRuleTypeIcon = (ruleType) => {
    switch (ruleType) {
      case 'sale_to_purchase':
      case 'purchase_to_sale':
        return <FileText className="w-4 h-4" />;
      case 'invoice_to_bill':
      case 'bill_to_invoice':
        return <FileText className="w-4 h-4" />;
      case 'transfer':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {t('intercompany_rules') || 'Inter-Company Rules'}
          </h2>
          <p className="text-slate-600 mt-1">
            {t('intercompany_rules_desc') || 'Configure automatic document synchronization between companies (Odoo-like)'}
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('new_rule') || 'New Rule'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t('rules') || 'Rules'} ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            {t('transaction_logs') || 'Transaction Logs'}
          </TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                <p className="mt-4 text-slate-500">{t('loading') || 'Loading...'}</p>
              </CardContent>
            </Card>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  {t('no_rules_configured') || 'No inter-company rules configured'}
                </h3>
                <p className="text-slate-500 mb-4">
                  {t('no_rules_desc') || 'Create rules to automatically sync documents between companies'}
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('create_first_rule') || 'Create First Rule'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id} className={`${!rule.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                          {getRuleTypeIcon(rule.rule_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{rule.source_organization_name}</span>
                            <ArrowRight className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{rule.target_organization_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{rule.rule_type_label}</Badge>
                            {rule.auto_validate && (
                              <Badge className="bg-green-100 text-green-700 text-xs">Auto-validate</Badge>
                            )}
                            {rule.pricing_method !== 'source_price' && (
                              <Badge variant="outline" className="text-xs">
                                {rule.pricing_method === 'cost_plus_markup'
                                  ? `+${rule.markup_percent}% markup`
                                  : 'Pricelist'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => toggleRuleActive(rule)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedRule(rule); setShowEditModal(true); }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedRule(rule); setShowDeleteDialog(true); }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('transaction_history') || 'Transaction History'}</CardTitle>
              <CardDescription>
                {t('transaction_history_desc') || 'Audit trail of automatic inter-company transactions'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t('no_transaction_logs') || 'No transaction logs yet'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date') || 'Date'}</TableHead>
                      <TableHead>{t('source') || 'Source'}</TableHead>
                      <TableHead>{t('target') || 'Target'}</TableHead>
                      <TableHead>{t('document') || 'Document'}</TableHead>
                      <TableHead>{t('status') || 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{log.source_organization_name}</div>
                            <div className="text-slate-500">
                              {log.source_document_type}: {log.source_document_number || log.source_document_id?.slice(0, 8)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{log.target_organization_name}</div>
                            <div className="text-slate-500">
                              {log.target_document_type}: {log.target_document_number || log.target_document_id?.slice(0, 8) || '-'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.source_amount && (
                            <span className="font-medium">
                              {log.source_amount.toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('create_ic_rule') || 'Create Inter-Company Rule'}</DialogTitle>
            <DialogDescription>
              {t('create_ic_rule_desc') || 'Configure automatic document sync between two companies'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Companies */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('source_company') || 'Source Company'} *</Label>
                <Select
                  value={newRule.source_organization_id}
                  onValueChange={(value) => setNewRule({ ...newRule, source_organization_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_company') || 'Select company'} />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('target_company') || 'Target Company'} *</Label>
                <Select
                  value={newRule.target_organization_id}
                  onValueChange={(value) => setNewRule({ ...newRule, target_organization_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_company') || 'Select company'} />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.filter(o => o.id !== newRule.source_organization_id).map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rule Type */}
            <div className="space-y-2">
              <Label>{t('rule_type') || 'Rule Type'} *</Label>
              <Select
                value={newRule.rule_type}
                onValueChange={(value) => setNewRule({ ...newRule, rule_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_rule_type') || 'Select rule type'} />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-slate-500">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium">{t('options') || 'Options'}</h4>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('auto_validate') || 'Auto-validate'}</Label>
                  <p className="text-xs text-slate-500">{t('auto_validate_desc') || 'Automatically validate created documents'}</p>
                </div>
                <Switch
                  checked={newRule.auto_validate}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, auto_validate: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('sync_prices') || 'Sync Prices'}</Label>
                  <p className="text-xs text-slate-500">{t('sync_prices_desc') || 'Copy prices from source document'}</p>
                </div>
                <Switch
                  checked={newRule.sync_prices}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, sync_prices: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('pricing_method') || 'Pricing Method'}</Label>
                <Select
                  value={newRule.pricing_method}
                  onValueChange={(value) => setNewRule({ ...newRule, pricing_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newRule.pricing_method === 'cost_plus_markup' && (
                <div className="space-y-2">
                  <Label>{t('markup_percent') || 'Markup %'}</Label>
                  <Input
                    type="number"
                    value={newRule.markup_percent}
                    onChange={(e) => setNewRule({ ...newRule, markup_percent: parseFloat(e.target.value) || 0 })}
                    placeholder="10"
                  />
                </div>
              )}

              {(newRule.rule_type === 'transfer' || newRule.rule_type === 'sale_to_purchase') && (
                <div className="space-y-2">
                  <Label>{t('default_warehouse') || 'Default Warehouse (for receipts)'}</Label>
                  <Select
                    value={newRule.default_warehouse_id}
                    onValueChange={(value) => setNewRule({ ...newRule, default_warehouse_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('notes') || 'Notes'}</Label>
              <Textarea
                value={newRule.notes}
                onChange={(e) => setNewRule({ ...newRule, notes: e.target.value })}
                placeholder={t('notes_placeholder') || 'Optional notes about this rule'}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateRule}
                disabled={isSubmitting || !newRule.source_organization_id || !newRule.target_organization_id || !newRule.rule_type}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isSubmitting ? t('creating') || 'Creating...' : t('create_rule') || 'Create Rule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('edit_ic_rule') || 'Edit Inter-Company Rule'}</DialogTitle>
          </DialogHeader>
          {selectedRule && (
            <div className="space-y-6 py-4">
              {/* Companies (read-only) */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-lg font-medium">
                  <span>{selectedRule.source_organization_name}</span>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                  <span>{selectedRule.target_organization_name}</span>
                </div>
                <Badge variant="outline" className="mt-2">{selectedRule.rule_type_label}</Badge>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('active') || 'Active'}</Label>
                    <p className="text-xs text-slate-500">{t('active_desc') || 'Enable or disable this rule'}</p>
                  </div>
                  <Switch
                    checked={selectedRule.is_active}
                    onCheckedChange={(checked) => setSelectedRule({ ...selectedRule, is_active: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('auto_validate') || 'Auto-validate'}</Label>
                    <p className="text-xs text-slate-500">{t('auto_validate_desc') || 'Automatically validate created documents'}</p>
                  </div>
                  <Switch
                    checked={selectedRule.auto_validate}
                    onCheckedChange={(checked) => setSelectedRule({ ...selectedRule, auto_validate: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('sync_prices') || 'Sync Prices'}</Label>
                    <p className="text-xs text-slate-500">{t('sync_prices_desc') || 'Copy prices from source document'}</p>
                  </div>
                  <Switch
                    checked={selectedRule.sync_prices}
                    onCheckedChange={(checked) => setSelectedRule({ ...selectedRule, sync_prices: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('pricing_method') || 'Pricing Method'}</Label>
                  <Select
                    value={selectedRule.pricing_method}
                    onValueChange={(value) => setSelectedRule({ ...selectedRule, pricing_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRule.pricing_method === 'cost_plus_markup' && (
                  <div className="space-y-2">
                    <Label>{t('markup_percent') || 'Markup %'}</Label>
                    <Input
                      type="number"
                      value={selectedRule.markup_percent}
                      onChange={(e) => setSelectedRule({ ...selectedRule, markup_percent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('notes') || 'Notes'}</Label>
                  <Textarea
                    value={selectedRule.notes || ''}
                    onChange={(e) => setSelectedRule({ ...selectedRule, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedRule(null); }}>
                  {t('cancel') || 'Cancel'}
                </Button>
                <Button
                  onClick={handleUpdateRule}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {isSubmitting ? t('saving') || 'Saving...' : t('save_changes') || 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_rule') || 'Delete Rule'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_rule_confirm') || 'Are you sure you want to delete this inter-company rule? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-red-600 hover:bg-red-700">
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
