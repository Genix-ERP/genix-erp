import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Pencil, Trash2, CheckCircle, XCircle,
  BookOpen, AlertCircle, ShoppingCart, Package, Landmark, Banknote, FileText, MoreHorizontal
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useCompany } from "@/components/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";

const JOURNAL_TYPES = [
  { value: 'general', labelKey: 'general', icon: BookOpen, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { value: 'sales', labelKey: 'sales', icon: ShoppingCart, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'purchase', labelKey: 'purchase', icon: Package, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'cash', labelKey: 'cash', icon: Banknote, color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'bank', labelKey: 'bank', icon: Landmark, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'miscellaneous', labelKey: 'miscellaneous', icon: MoreHorizontal, color: 'bg-teal-100 text-teal-800 border-teal-200' },
];

const getJournalType = (type) => JOURNAL_TYPES.find(jt => jt.value === type) || JOURNAL_TYPES[0];

export default function JournalManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    journals,
    createJournal,
    updateJournal,
    deleteJournal,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { activeCompany } = useCompany();

  const [filteredJournals, setFilteredJournals] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'miscellaneous',
    description: '',
    auto_sequence: true,
    number_prefix: '',
  });

  useEffect(() => {
    setFilteredJournals(journals);
  }, [journals]);

  useEffect(() => {
    let filtered = journals;

    if (searchQuery) {
      filtered = filtered.filter(j =>
        j.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(j => j.type === typeFilter);
    }

    setFilteredJournals(filtered);
  }, [searchQuery, typeFilter, journals]);

  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  const generateCodeFromName = (name) => {
    return name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 20);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'miscellaneous',
      description: '',
      auto_sequence: true,
      number_prefix: '',
    });
    setCodeManuallyEdited(false);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      await createJournal({ ...formData, organization_id: activeCompany?.id });
      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating journal:', error);
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to create journal';
      alert(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (journal) => {
    setSelectedJournal(journal);
    setCodeManuallyEdited(true);
    setFormData({
      code: journal.code || '',
      name: journal.name || '',
      type: journal.type || 'general',
      description: journal.description || '',
      auto_sequence: journal.auto_sequence !== false,
      number_prefix: journal.number_prefix || '',
      is_active: journal.is_active !== false,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await updateJournal(selectedJournal.id, {
        name: formData.name,
        description: formData.description,
        auto_sequence: formData.auto_sequence,
        number_prefix: formData.number_prefix,
        is_active: formData.is_active,
      });
      resetForm();
      setSelectedJournal(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating journal:', error);
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to update journal';
      alert(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (journal) => {
    setSelectedJournal(journal);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await deleteJournal(selectedJournal.id);
      setSelectedJournal(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting journal:', error);
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to delete journal';
      alert(`Error: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const summaryStats = {
    total: journals.length,
    active: journals.filter(j => j.is_active).length,
    types: [...new Set(journals.map(j => j.type))].length,
  };

  const typeHints = {
    general: { name: 'General Journal', code: 'GENERAL' },
    sales: { name: 'Sales Journal', code: 'SALES' },
    purchase: { name: 'Purchase Journal', code: 'PURCHASE' },
    cash: { name: 'Cash Journal', code: 'CASH' },
    bank: { name: 'Bank Journal', code: 'BANK' },
    miscellaneous: { name: 'Miscellaneous Journal', code: 'MISC' },
  };

  const renderFormFields = (isEdit = false) => {
    const hint = typeHints[formData.type] || typeHints.miscellaneous;
    return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            {t('code') || 'Code'} *
          </label>
          <Input
            placeholder={t('auto_generated') || 'Auto-generated from name'}
            value={formData.code}
            onChange={(e) => {
              setCodeManuallyEdited(true);
              setFormData({...formData, code: e.target.value.toUpperCase()});
            }}
            disabled={isEdit}
            maxLength={20}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">
            {t('journal_type') || 'Type'} *
          </label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({...formData, type: value})}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOURNAL_TYPES.map(jt => {
                const Icon = jt.icon;
                return (
                  <SelectItem key={jt.value} value={jt.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {t(jt.labelKey) || jt.value}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          {t('name')} *
        </label>
        <Input
          placeholder={`e.g., ${hint.name}`}
          value={formData.name}
          onChange={(e) => {
            const name = e.target.value;
            const updates = { name };
            if (!codeManuallyEdited && !isEdit) {
              updates.code = generateCodeFromName(name);
            }
            setFormData(prev => ({...prev, ...updates}));
          }}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          {t('description')}
        </label>
        <Input
          placeholder={t('optional') || 'Optional description'}
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1 block">
          {t('number_prefix') || 'Number Prefix'}
        </label>
        <Input
          placeholder={`e.g., ${hint.code}-`}
          value={formData.number_prefix}
          onChange={(e) => setFormData({...formData, number_prefix: e.target.value})}
          maxLength={10}
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-slate-700">{t('auto_sequence') || 'Auto Sequence'}</p>
          <p className="text-xs text-slate-500">{t('auto_number_entries') || 'Automatically number entries'}</p>
        </div>
        <Switch
          checked={formData.auto_sequence}
          onCheckedChange={(checked) => setFormData({...formData, auto_sequence: checked})}
        />
      </div>

      {isEdit && (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-slate-700">{t('active') || 'Active'}</p>
            <p className="text-xs text-slate-500">{t('can_be_used_in_transactions') || 'Can be used in transactions'}</p>
          </div>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
          />
        </div>
      )}
    </div>
  );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_journals') || 'Total Journals'}</p>
                <p className="text-2xl font-bold text-slate-900">{summaryStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('active') || 'Active'}</p>
                <p className="text-2xl font-bold text-green-600">{summaryStats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('journal_types') || 'Journal Types'}</p>
                <p className="text-2xl font-bold text-purple-600">{summaryStats.types}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Journals Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[var(--genix-blue)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('journals') || 'Journals'}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredJournals.length} {t('journals_configured') || 'journals configured'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_journals') || 'Search journals...'}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50">
                  <SelectValue placeholder={t('journal_type') || 'Type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types') || 'All Types'}</SelectItem>
                  {JOURNAL_TYPES.map(jt => (
                    <SelectItem key={jt.value} value={jt.value}>
                      {t(jt.labelKey) || jt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_journal') || 'New Journal'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">{t('loading')}</p>
              </div>
            </div>
          ) : filteredJournals.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? (t('no_journals_found') || 'No journals found') : (t('no_journals_configured') || 'No journals configured')}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? (t('try_adjusting_search') || 'Try adjusting your search or filters')
                  : (t('setup_journals') || 'Create journals to organize your accounting entries')}
              </p>
              {!searchQuery && canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_journal') || 'Create Journal'}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700">{t('code') || 'Code'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('name')}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('type') || 'Type'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('auto_sequence') || 'Auto Seq.'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJournals.map(journal => {
                    const jt = getJournalType(journal.type);
                    const TypeIcon = jt.icon;
                    return (
                      <TableRow
                        key={journal.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <TableCell className="font-mono text-sm font-medium text-slate-700">
                          {journal.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{journal.name}</p>
                            {journal.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{journal.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${jt.color} flex items-center gap-1 w-fit`}>
                            <TypeIcon className="w-3 h-3" />
                            {t(jt.labelKey) || journal.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {journal.auto_sequence ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={journal.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }>
                            {journal.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {canUpdate(MODULES.FINANCIALS) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(journal)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4 text-slate-500" />
                              </Button>
                            )}
                            {canDelete(MODULES.FINANCIALS) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(journal)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Journal Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('create_journal') || 'New Journal'}
            </DialogTitle>
            <DialogDescription>
              {t('create_journal_desc') || 'Create a new accounting journal'}
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="flex-1"
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.name || !formData.code}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('create_journal') || 'Create Journal')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Journal Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_journal') || 'Edit Journal'}
            </DialogTitle>
          </DialogHeader>
          {renderFormFields(true)}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="flex-1"
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleUpdate}
              className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              disabled={isSaving || !formData.name}
            >
              {isSaving ? (t('saving') || 'Saving...') : (t('edit_journal') || 'Update Journal')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_journal') || 'Delete Journal'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('confirm_delete_journal') || 'Are you sure you want to delete the journal'}{' '}
              <span className="font-semibold text-slate-900">"{selectedJournal?.name}"</span>?
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  {t('journal_has_entries_warning') || 'Journals with existing entries cannot be deleted.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={isSaving}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isSaving ? (t('deleting') || 'Deleting...') : t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
