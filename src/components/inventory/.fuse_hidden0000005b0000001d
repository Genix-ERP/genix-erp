import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, Pencil, Trash2, Scale, RefreshCw
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { inventoryService } from "@/api/services/inventory";

const CATEGORIES = ['quantity', 'weight', 'volume', 'length', 'time', 'other'];

export default function UnitsOfMeasure() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const [units, setUnits] = useState([]);
  const [filteredUnits, setFilteredUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'quantity',
    conversion_factor: '1',
    is_active: true,
  });

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.listUnitsOfMeasure();
      setUnits(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch units:', error);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    let filtered = [...units];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.code?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(u => u.category === categoryFilter);
    }
    setFilteredUnits(filtered);
  }, [units, searchQuery, categoryFilter]);

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: 'quantity',
      conversion_factor: '1',
      is_active: true,
    });
    setEditingUnit(null);
    setError('');
  };

  const handleCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code || '',
      name: unit.name || '',
      category: unit.category || 'quantity',
      conversion_factor: String(unit.conversion_factor || 1),
      is_active: unit.is_active !== false,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError(t('fill_required_fields') || 'Please fill in required fields');
      return;
    }

    try {
      setError('');
      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        category: formData.category,
        conversion_factor: parseFloat(formData.conversion_factor) || 1,
        is_active: formData.is_active,
      };

      if (editingUnit) {
        await inventoryService.updateUnitOfMeasure(editingUnit.id, payload);
      } else {
        await inventoryService.createUnitOfMeasure(payload);
      }
      setShowModal(false);
      resetForm();
      fetchUnits();
    } catch (err) {
      console.error('Failed to save unit:', err);
      const apiErr = err.response?.data?.error;
      setError(typeof apiErr === 'string' ? apiErr : apiErr?.message || t('save_failed') || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;
    try {
      await inventoryService.deleteUnitOfMeasure(selectedUnit.id);
      setShowDeleteModal(false);
      setSelectedUnit(null);
      fetchUnits();
    } catch (err) {
      console.error('Failed to delete unit:', err);
      const apiErr = err.response?.data?.error;
      setError(typeof apiErr === 'string' ? apiErr : apiErr?.message || t('delete_failed') || 'Failed to delete');
    }
  };

  const getCategoryLabel = (cat) => {
    const key = `uom_category_${cat}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    // Fallback
    const labels = {
      quantity: language === 'uz' ? 'Miqdor' : language === 'ru' ? 'Количество' : 'Quantity',
      weight: language === 'uz' ? 'Og\'irlik' : language === 'ru' ? 'Вес' : 'Weight',
      volume: language === 'uz' ? 'Hajm' : language === 'ru' ? 'Объём' : 'Volume',
      length: language === 'uz' ? 'Uzunlik' : language === 'ru' ? 'Длина' : 'Length',
      time: language === 'uz' ? 'Vaqt' : language === 'ru' ? 'Время' : 'Time',
      other: language === 'uz' ? 'Boshqa' : language === 'ru' ? 'Другое' : 'Other',
    };
    return labels[cat] || cat;
  };

  const getCategoryColor = (cat) => {
    const colors = {
      quantity: 'bg-blue-100 text-blue-800',
      weight: 'bg-orange-100 text-orange-800',
      volume: 'bg-cyan-100 text-cyan-800',
      length: 'bg-green-100 text-green-800',
      time: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[cat] || 'bg-gray-100 text-gray-800';
  };

  // Group units by category for display
  const groupedUnits = filteredUnits.reduce((acc, unit) => {
    const cat = unit.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(unit);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('units_of_measure')}</h3>
          <p className="text-sm text-slate-500">{filteredUnits.length} {t('items') || 'items'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUnits} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh') || 'Refresh'}
          </Button>
          {canCreate(MODULES.INVENTORY) && (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />
              {t('new') || 'New'}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('search') || 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('all_categories') || 'All Categories'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_categories') || 'All Categories'}</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[140px]">{t('code') || 'Code'}</TableHead>
              <TableHead>{t('name') || 'Name'}</TableHead>
              <TableHead className="w-[140px]">{t('category') || 'Category'}</TableHead>
              <TableHead className="w-[140px] text-right">{t('uom_conversion') || 'Conversion'}</TableHead>
              <TableHead className="w-[80px] text-center">{t('status') || 'Status'}</TableHead>
              <TableHead className="w-[100px] text-right">{t('actions') || 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  {t('loading') || 'Loading...'}
                </TableCell>
              </TableRow>
            ) : filteredUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  {t('no_data') || 'No units found'}
                </TableCell>
              </TableRow>
            ) : (
              Object.entries(groupedUnits).map(([cat, catUnits]) => (
                <React.Fragment key={cat}>
                  {/* Category header row */}
                  {categoryFilter === 'all' && (
                    <TableRow className="bg-slate-50/50">
                      <TableCell colSpan={6} className="py-2">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-sm text-slate-600">{getCategoryLabel(cat)}</span>
                          <Badge variant="secondary" className="text-xs">{catUnits.length}</Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {catUnits.map((unit) => (
                    <TableRow key={unit.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">{unit.code}</TableCell>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>
                        <Badge className={`${getCategoryColor(unit.category)} text-xs`}>
                          {getCategoryLabel(unit.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{unit.conversion_factor}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={unit.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {unit.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canUpdate(MODULES.INVENTORY) && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(unit)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete(MODULES.INVENTORY) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => { setSelectedUnit(unit); setShowDeleteModal(true); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? (t('edit') || 'Edit') : (t('create') || 'Create')} {t('unit_of_measure')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('code') || 'Code'} *
              </label>
              <Input
                placeholder="kg, m, pcs..."
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('name') || 'Name'} *
              </label>
              <Input
                placeholder={t('uom_name_placeholder') || 'Kilogram, Meter, Piece...'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('category') || 'Category'}
              </label>
              <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('uom_conversion') || 'Conversion Factor'}
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="1"
                value={formData.conversion_factor}
                onChange={(e) => setFormData({ ...formData, conversion_factor: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('uom_conversion_help') || 'Ratio to the base unit in this category (e.g. 0.001 for g when kg is base)'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('active') || 'Active'}
              </label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowModal(false); resetForm(); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                {editingUnit ? (t('save') || 'Save') : (t('create') || 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('confirm_delete') || 'Confirm Delete'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              {t('delete_uom_confirm') || 'Are you sure you want to delete this unit of measure?'}
              {selectedUnit && (
                <span className="block mt-2 font-medium text-slate-800">
                  {selectedUnit.name} ({selectedUnit.code})
                </span>
              )}
            </p>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDeleteModal(false); setSelectedUnit(null); setError(''); }}>
                {t('cancel') || 'Cancel'}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>
                {t('delete') || 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
