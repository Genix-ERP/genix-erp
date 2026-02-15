import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus, RefreshCw, Edit2, Trash2, Play, Calendar, Clock,
  CheckCircle2, XCircle, AlertTriangle, Eye, Search
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCompany } from "@/components/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { financeService } from "@/api/services";
import { format, parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { useAlertModal } from "@/hooks/useAlertModal";
import AlertModal from "@/components/shared/AlertModal";

const FREQUENCIES = [
  { value: 'daily', labelKey: 'daily' },
  { value: 'weekly', labelKey: 'weekly' },
  { value: 'monthly', labelKey: 'monthly' },
  { value: 'quarterly', labelKey: 'quarterly' },
  { value: 'yearly', labelKey: 'yearly' },
];

const DAYS_OF_WEEK = [
  { value: 0, labelKey: 'sunday' },
  { value: 1, labelKey: 'monday' },
  { value: 2, labelKey: 'tuesday' },
  { value: 3, labelKey: 'wednesday' },
  { value: 4, labelKey: 'thursday' },
  { value: 5, labelKey: 'friday' },
  { value: 6, labelKey: 'saturday' },
];

export default function RecurringJournalEntries() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { journals = [], accounts = [] } = useFinancials();
  const { activeCompany } = useCompany();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { modal, showAlert, showError, showSuccess, close } = useAlertModal();

  const [templates, setTemplates] = useState([]);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reference: '',
    journal_id: '',
    frequency: 'monthly',
    interval_count: 1,
    day_of_month: 1,
    day_of_week: 1,
    month_of_year: 1,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    auto_post: false,
    lines: [
      { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
      { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
    ]
  });

  // Fetch templates and pending entries
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, pendingData] = await Promise.all([
        financeService.listRecurringJournals(),
        financeService.getPendingRecurringEntries()
      ]);
      setTemplates(templatesData || []);
      setPendingEntries(pendingData || []);
    } catch (error) {
      console.error('Error fetching recurring journals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (frequencyFilter !== 'all') {
      filtered = filtered.filter(t => t.frequency === frequencyFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => statusFilter === 'active' ? t.is_active : !t.is_active);
    }

    return filtered;
  }, [templates, searchQuery, frequencyFilter, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const active = templates.filter(t => t.is_active).length;
    const paused = templates.filter(t => !t.is_active).length;
    const dueSoon = pendingEntries.length;
    const totalMonthly = templates
      .filter(t => t.is_active && t.frequency === 'monthly')
      .reduce((sum, t) => sum + (t.total_debit || 0), 0);

    return { active, paused, dueSoon, totalMonthly };
  }, [templates, pendingEntries]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      reference: '',
      journal_id: '',
      frequency: 'monthly',
      interval_count: 1,
      day_of_month: 1,
      day_of_week: 1,
      month_of_year: 1,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      auto_post: false,
      lines: [
        { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
        { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
      ]
    });
  };

  const handleCreateTemplate = async () => {
    // Validate balanced entries
    const totalDebit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0);
    const totalCredit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      showError(t('debits_credits_must_equal'));
      return;
    }

    if (!formData.name || !formData.journal_id) {
      showError(t('required_fields_missing'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        organization_id: activeCompany?.id,
        interval_count: parseInt(formData.interval_count) || 1,
        day_of_month: parseInt(formData.day_of_month) || null,
        day_of_week: parseInt(formData.day_of_week) || null,
        month_of_year: parseInt(formData.month_of_year) || null,
        lines: formData.lines.filter(l => l.account_id).map(l => ({
          ...l,
          debit_amount: parseFloat(l.debit_amount) || 0,
          credit_amount: parseFloat(l.credit_amount) || 0,
        }))
      };

      await financeService.createRecurringJournal(payload);
      await fetchData();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating template:', error);
      showError('Failed to create template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;

    const totalDebit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0);
    const totalCredit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      showError(t('debits_credits_must_equal'));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        frequency: formData.frequency,
        interval_count: parseInt(formData.interval_count) || 1,
        is_active: formData.is_active,
        auto_post: formData.auto_post,
        lines: formData.lines.filter(l => l.account_id).map(l => ({
          ...l,
          debit_amount: parseFloat(l.debit_amount) || 0,
          credit_amount: parseFloat(l.credit_amount) || 0,
        }))
      };

      await financeService.updateRecurringJournal(selectedTemplate.id, payload);
      await fetchData();
      setShowEditModal(false);
      setSelectedTemplate(null);
      resetForm();
    } catch (error) {
      console.error('Error updating template:', error);
      showError('Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setIsSaving(true);
    try {
      await financeService.deleteRecurringJournal(templateToDelete.id);
      await fetchData();
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Failed to delete template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateEntry = async (template) => {
    try {
      await financeService.generateRecurringEntry(template.id);
      await fetchData();
      showSuccess('Journal entry generated successfully');
    } catch (error) {
      console.error('Error generating entry:', error);
      showError('Failed to generate entry');
    }
  };

  const openEditModal = async (template) => {
    try {
      // Fetch full template details including lines
      const response = await financeService.getRecurringJournal(template.id);
      // Response structure: { template: {...}, lines: [...] }
      const templateData = response.template || response;
      const linesData = response.lines || [];

      const fullTemplate = { ...templateData, lines: linesData };
      setSelectedTemplate(fullTemplate);
      setFormData({
        name: templateData.name || '',
        description: templateData.description || '',
        reference: templateData.reference || '',
        journal_id: templateData.journal_id || '',
        frequency: templateData.frequency || 'monthly',
        interval_count: templateData.interval_count || 1,
        day_of_month: templateData.day_of_month || 1,
        day_of_week: templateData.day_of_week || 1,
        month_of_year: templateData.month_of_year || 1,
        start_date: templateData.start_date || '',
        end_date: templateData.end_date || '',
        auto_post: templateData.auto_post || false,
        is_active: templateData.is_active,
        lines: linesData.length > 0 ? linesData.map(l => ({
          account_id: l.account_id,
          description: l.description || '',
          debit_amount: l.debit_amount || 0,
          credit_amount: l.credit_amount || 0,
        })) : [
          { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
          { account_id: '', description: '', debit_amount: 0, credit_amount: 0 },
        ]
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error fetching template details:', error);
      showError('Failed to load template details');
    }
  };

  const openViewModal = async (template) => {
    try {
      // Fetch full template details including lines
      const response = await financeService.getRecurringJournal(template.id);
      // Response structure: { template: {...}, lines: [...] }
      const templateData = response.template || response;
      const linesData = response.lines || [];

      const fullTemplate = { ...templateData, lines: linesData };
      setSelectedTemplate(fullTemplate);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error fetching template details:', error);
      showError('Failed to load template details');
    }
  };

  const openDeleteModal = (template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { account_id: '', description: '', debit_amount: 0, credit_amount: 0 }]
    }));
  };

  const removeLine = (index) => {
    if (formData.lines.length <= 2) return;
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateLine = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line)
    }));
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const getJournalName = (journalId) => {
    const journal = journals.find(j => j.id === journalId);
    return journal ? journal.name : journalId;
  };

  const formatFrequency = (template) => {
    const freq = template?.frequency;
    if (!freq) return '-';
    const interval = template.interval_count || 1;
    if (interval === 1) {
      return freq.charAt(0).toUpperCase() + freq.slice(1);
    }
    return `Every ${interval} ${freq.replace('ly', 's')}`;
  };

  // Calculate totals for form
  const formTotals = useMemo(() => {
    const totalDebit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0);
    const totalCredit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0);
    return { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [formData.lines]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('active_templates')}</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('paused_templates')}</p>
                <p className="text-2xl font-bold text-gray-600">{stats.paused}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('due_soon')}</p>
                <p className="text-2xl font-bold text-amber-600">{stats.dueSoon}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('monthly_total')}</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalMonthly)}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Entries Alert */}
      {pendingEntries.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">
                  {pendingEntries.length} {t('recurring_entries_due')}
                </p>
                <p className="text-sm text-amber-600">
                  {t('click_generate_to_create')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('recurring_journal_templates')}
          </CardTitle>
          {canCreate(MODULES.FINANCE, 'journal_entry') && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('create_template')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_templates')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('frequency')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_frequencies')}</SelectItem>
                {FREQUENCIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{t(f.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses')}</SelectItem>
                <SelectItem value="active">{t('active')}</SelectItem>
                <SelectItem value="paused">{t('paused')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('journal')}</TableHead>
                <TableHead>{t('frequency')}</TableHead>
                <TableHead>{t('next_run')}</TableHead>
                <TableHead className="text-right">{t('amount')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t('loading')}...
                  </TableCell>
                </TableRow>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('no_recurring_templates')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getJournalName(template.journal_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatFrequency(template)}</Badge>
                    </TableCell>
                    <TableCell>
                      {template.next_run_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(template.next_run_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(template.total_debit || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? t('active') : t('paused')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewModal(template)}
                          title={t('view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canUpdate(MODULES.FINANCE, 'journal_entry') && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGenerateEntry(template)}
                              title={t('generate_entry')}
                              disabled={!template.is_active}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(template)}
                              title={t('edit')}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canDelete(MODULES.FINANCE, 'journal_entry') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(template)}
                            title={t('delete')}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedTemplate(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditModal ? t('edit_recurring_template') : t('create_recurring_template')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('template_name')} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('enter_template_name')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('journal')} *</Label>
                <Select
                  value={formData.journal_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, journal_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_journal')} />
                  </SelectTrigger>
                  <SelectContent>
                    {journals.map(j => (
                      <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('reference')}</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder={t('optional_reference')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('description')}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('optional_description')}
                />
              </div>
            </div>

            {/* Schedule Settings */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('schedule_settings')}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('frequency')}</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{t(f.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('interval')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.interval_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, interval_count: e.target.value }))}
                  />
                </div>
                {formData.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>{t('day_of_week')}</Label>
                    <Select
                      value={String(formData.day_of_week)}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_week: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(d => (
                          <SelectItem key={d.value} value={String(d.value)}>{t(d.labelKey)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'yearly') && (
                  <div className="space-y-2">
                    <Label>{t('day_of_month')}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.day_of_month}
                      onChange={(e) => setFormData(prev => ({ ...prev, day_of_month: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('start_date')}</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('end_date')} ({t('optional')})</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.auto_post}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_post: checked }))}
                  />
                  <Label>{t('auto_post_entries')}</Label>
                </div>
              </div>
            </div>

            {/* Journal Entry Lines */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t('journal_entry_lines')}</h3>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('add_line')}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">{t('account')}</TableHead>
                    <TableHead className="w-[25%]">{t('description')}</TableHead>
                    <TableHead className="w-[15%] text-right">{t('debit')}</TableHead>
                    <TableHead className="w-[15%] text-right">{t('credit')}</TableHead>
                    <TableHead className="w-[10%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.account_id}
                          onValueChange={(value) => updateLine(index, 'account_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('select_account')} />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder={t('line_description')}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit_amount}
                          onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit_amount}
                          onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={formData.lines.length <= 2}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-medium text-right">
                      {t('totals')}:
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(formTotals.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(formTotals.totalCredit)}
                    </TableCell>
                    <TableCell>
                      {formTotals.isBalanced ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {!formTotals.isBalanced && (
                <p className="text-sm text-red-500">
                  {t('debits_credits_must_equal')} ({t('difference')}: {formatCurrency(Math.abs(formTotals.totalDebit - formTotals.totalCredit))})
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetForm();
            }}>
              {t('cancel')}
            </Button>
            <Button
              onClick={showEditModal ? handleUpdateTemplate : handleCreateTemplate}
              disabled={isSaving || !formTotals.isBalanced}
            >
              {isSaving ? t('saving') : (showEditModal ? t('update') : t('create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('journal')}</p>
                  <p className="font-medium">{getJournalName(selectedTemplate.journal_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('frequency')}</p>
                  <p className="font-medium">{formatFrequency(selectedTemplate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('next_run')}</p>
                  <p className="font-medium">
                    {selectedTemplate.next_run_date ? format(parseISO(selectedTemplate.next_run_date), 'MMMM d, yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('last_run')}</p>
                  <p className="font-medium">
                    {selectedTemplate.last_run_date ? format(parseISO(selectedTemplate.last_run_date), 'MMMM d, yyyy') : t('never')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('status')}</p>
                  <Badge variant={selectedTemplate.is_active ? "default" : "secondary"}>
                    {selectedTemplate.is_active ? t('active') : t('paused')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('auto_post')}</p>
                  <p className="font-medium">{selectedTemplate.auto_post ? t('yes') : t('no')}</p>
                </div>
              </div>

              {selectedTemplate.description && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('description')}</p>
                  <p>{selectedTemplate.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('entry_lines')}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('account')}</TableHead>
                      <TableHead className="text-right">{t('debit')}</TableHead>
                      <TableHead className="text-right">{t('credit')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTemplate.lines?.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>{getAccountName(line.account_id)}</TableCell>
                        <TableCell className="text-right">
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              {t('close')}
            </Button>
            {canUpdate(MODULES.FINANCE, 'journal_entry') && (
              <Button onClick={() => {
                setShowViewModal(false);
                openEditModal(selectedTemplate);
              }}>
                <Edit2 className="h-4 w-4 mr-2" />
                {t('edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_template')}</DialogTitle>
            <DialogDescription>
              {t('delete_recurring_template_confirm')} "{templateToDelete?.name}"?
              {t('this_action_cannot_be_undone')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={isSaving}>
              {isSaving ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertModal modal={modal} close={close} />
    </div>
  );
}
