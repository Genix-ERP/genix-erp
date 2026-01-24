import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Percent, Pencil, Trash2, CheckCircle, XCircle,
  Calculator, ShoppingCart, Package, AlertCircle
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";

export default function TaxRates() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    taxRates,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
    isLoading
  } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [filteredTaxRates, setFilteredTaxRates] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTaxRate, setSelectedTaxRate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    rate: '',
    tax_type: 'sales',
    description: '',
    is_compound: false,
    is_active: true
  });

  // Summary calculations
  const summaryStats = {
    totalActive: taxRates.filter(t => t.is_active).length,
    salesTaxes: taxRates.filter(t => t.tax_type === 'sales').length,
    purchaseTaxes: taxRates.filter(t => t.tax_type === 'purchase').length,
    avgRate: taxRates.length > 0
      ? (taxRates.reduce((sum, t) => sum + (t.rate || 0), 0) / taxRates.length).toFixed(2)
      : 0
  };

  useEffect(() => {
    setFilteredTaxRates(taxRates);
  }, [taxRates]);

  useEffect(() => {
    let filtered = taxRates;

    if (searchQuery) {
      filtered = filtered.filter(tax =>
        tax.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tax.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(tax => tax.tax_type === typeFilter);
    }

    setFilteredTaxRates(filtered);
  }, [searchQuery, typeFilter, taxRates]);

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      rate: '',
      tax_type: 'sales',
      description: '',
      is_compound: false,
      is_active: true
    });
  };

  const handleCreate = () => {
    setIsSaving(true);
    try {
      const taxData = {
        ...formData,
        rate: parseFloat(formData.rate) || 0
      };

      createTaxRate(taxData);
      resetForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating tax rate:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (taxRate) => {
    setSelectedTaxRate(taxRate);
    setFormData({
      name: taxRate.name || '',
      code: taxRate.code || '',
      rate: taxRate.rate?.toString() || '',
      tax_type: taxRate.tax_type || 'sales',
      description: taxRate.description || '',
      is_compound: taxRate.is_compound || false,
      is_active: taxRate.is_active !== false
    });
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    setIsSaving(true);
    try {
      const taxData = {
        ...formData,
        rate: parseFloat(formData.rate) || 0
      };

      updateTaxRate(selectedTaxRate.id, taxData);
      resetForm();
      setSelectedTaxRate(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating tax rate:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (taxRate) => {
    setSelectedTaxRate(taxRate);
    setShowDeleteModal(true);
  };

  const handleDelete = () => {
    try {
      deleteTaxRate(selectedTaxRate.id);
      setSelectedTaxRate(null);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting tax rate:', error);
    }
  };

  const getTaxTypeIcon = (type) => {
    return type === 'sales' ? ShoppingCart : Package;
  };

  const getTaxTypeColor = (type) => {
    return type === 'sales'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('active_rates')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summaryStats.totalActive}
                </p>
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
                <p className="text-sm text-slate-500">{t('sales_taxes')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summaryStats.salesTaxes}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('purchase_taxes')}</p>
                <p className="text-2xl font-bold text-purple-600">
                  {summaryStats.purchaseTaxes}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('average_rate')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summaryStats.avgRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <Calculator className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Rates Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                <Percent className="w-5 h-5 text-[var(--genix-blue)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('tax_rates')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {filteredTaxRates.length} {t('tax_rates_configured')}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_tax_rates')}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] bg-slate-50">
                  <SelectValue placeholder={t('tax_type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_types')}</SelectItem>
                  <SelectItem value="sales">{t('sales_tax')}</SelectItem>
                  <SelectItem value="purchase">{t('purchase_tax')}</SelectItem>
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
                  <Plus className="w-4 h-4 mr-2" /> {t('new_tax_rate')}
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
          ) : filteredTaxRates.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Percent className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? t('no_tax_rates_found') : t('no_tax_rates_configured')}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? t('try_adjusting_search') || 'Try adjusting your search or filters'
                  : t('setup_tax_rates')}
              </p>
              {!searchQuery && canCreate(MODULES.FINANCIALS) && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('create_first_tax_rate')}
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
                    <TableHead className="font-semibold text-slate-700 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Percent className="w-4 h-4" />
                        {t('rate') || 'Rate'}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('compound') || 'Compound'}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTaxRates.map(taxRate => {
                    const TypeIcon = getTaxTypeIcon(taxRate.tax_type);
                    return (
                      <TableRow
                        key={taxRate.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <TableCell className="font-mono text-sm font-medium text-slate-700">
                          {taxRate.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{taxRate.name}</p>
                            {taxRate.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{taxRate.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getTaxTypeColor(taxRate.tax_type)} flex items-center gap-1 w-fit`}>
                            <TypeIcon className="w-3 h-3" />
                            {taxRate.tax_type === 'sales' ? (t('sales') || 'Sales') : (t('purchase') || 'Purchase')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg text-slate-900 tabular-nums">
                          {taxRate.rate}%
                        </TableCell>
                        <TableCell>
                          {taxRate.is_compound ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-slate-300" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={taxRate.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }>
                            {taxRate.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {canUpdate(MODULES.FINANCIALS) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(taxRate)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4 text-slate-500" />
                              </Button>
                            )}
                            {canDelete(MODULES.FINANCIALS) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(taxRate)}
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

      {/* Create Tax Rate Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Percent className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('new_tax_rate') || 'New Tax Rate'}
            </DialogTitle>
            <DialogDescription>
              {t('create_new_tax_rate_for_sales') || 'Create a new tax rate for sales or purchases'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('code') || 'Code'} *
                </label>
                <Input
                  placeholder="e.g., VAT20"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('rate_percent') || 'Rate (%)'} *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.rate}
                    onChange={(e) => setFormData({...formData, rate: e.target.value})}
                    required
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('name')} *
              </label>
              <Input
                placeholder="e.g., VAT 20%"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('tax_type') || 'Tax Type'} *
              </label>
              <Select
                value={formData.tax_type}
                onValueChange={(value) => setFormData({...formData, tax_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      {t('sales_tax') || 'Sales Tax'}
                    </div>
                  </SelectItem>
                  <SelectItem value="purchase">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-600" />
                      {t('purchase_tax') || 'Purchase Tax'}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('compound_tax') || 'Compound Tax'}</p>
                <p className="text-xs text-slate-500">{t('apply_on_top') || 'Apply on top of other taxes'}</p>
              </div>
              <Switch
                checked={formData.is_compound}
                onCheckedChange={(checked) => setFormData({...formData, is_compound: checked})}
              />
            </div>

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

            <div className="flex gap-3 pt-4">
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
                disabled={isSaving || !formData.name || !formData.code || !formData.rate}
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('create_tax_rate') || 'Create Tax Rate')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Tax Rate Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_tax_rate') || 'Edit Tax Rate'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('code') || 'Code'} *
                </label>
                <Input
                  placeholder="e.g., VAT20"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  {t('rate_percent') || 'Rate (%)'} *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.rate}
                    onChange={(e) => setFormData({...formData, rate: e.target.value})}
                    required
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('name')} *
              </label>
              <Input
                placeholder="e.g., VAT 20%"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('tax_type') || 'Tax Type'} *
              </label>
              <Select
                value={formData.tax_type}
                onValueChange={(value) => setFormData({...formData, tax_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">{t('sales_tax') || 'Sales Tax'}</SelectItem>
                  <SelectItem value="purchase">{t('purchase_tax') || 'Purchase Tax'}</SelectItem>
                </SelectContent>
              </Select>
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

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('compound_tax') || 'Compound Tax'}</p>
                <p className="text-xs text-slate-500">{t('apply_on_top') || 'Apply on top of other taxes'}</p>
              </div>
              <Switch
                checked={formData.is_compound}
                onCheckedChange={(checked) => setFormData({...formData, is_compound: checked})}
              />
            </div>

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

            <div className="flex gap-3 pt-4">
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
                disabled={isSaving || !formData.name || !formData.code || !formData.rate}
              >
                {isSaving ? (t('saving') || 'Saving...') : (t('update_tax_rate') || 'Update Tax Rate')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_tax_rate') || 'Delete Tax Rate'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('confirm_delete_tax_rate') || 'Are you sure you want to delete the tax rate'}{' '}
              <span className="font-semibold text-slate-900">"{selectedTaxRate?.name}"</span>?
              {' '}{t('this_action_cannot_be_undone') || 'This action cannot be undone.'}
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  {t('delete_tax_warning') || 'Deleting this tax rate may affect existing transactions that use it.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
