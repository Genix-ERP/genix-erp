import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c'
];

export default function ManufacturingCategories() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    manufacturingCategories,
    createManufacturingCategory,
    updateManufacturingCategory,
    deleteManufacturingCategory
  } = useManufacturing();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#6366f1' });

  const labels = {
    en: {
      title: 'Manufacturing Categories',
      subtitle: 'Manage categories for production orders and shop floor filtering',
      add: 'Add Category',
      name: 'Name',
      description: 'Description',
      color: 'Color',
      status: 'Status',
      actions: 'Actions',
      active: 'Active',
      create: 'Create Category',
      update: 'Update Category',
      cancel: 'Cancel',
      no_categories: 'No categories yet. Add your first category to organize production orders.',
      delete_confirm: 'Are you sure you want to delete this category?',
      name_placeholder: 'e.g. Block Production',
      desc_placeholder: 'Optional description',
    },
    uz: {
      title: 'Ishlab chiqarish kategoriyalari',
      subtitle: 'Ishlab chiqarish buyurtmalari va sex boshqaruvi uchun kategoriyalarni boshqaring',
      add: 'Kategoriya qo\'shish',
      name: 'Nomi',
      description: 'Tavsif',
      color: 'Rang',
      status: 'Holat',
      actions: 'Amallar',
      active: 'Faol',
      create: 'Kategoriya yaratish',
      update: 'Kategoriyani yangilash',
      cancel: 'Bekor qilish',
      no_categories: 'Hali kategoriya yo\'q. Birinchi kategoriyani qo\'shing.',
      delete_confirm: 'Bu kategoriyani o\'chirishni xohlaysizmi?',
      name_placeholder: 'masalan, Blok ishlab chiqarish',
      desc_placeholder: 'Ixtiyoriy tavsif',
    },
    ru: {
      title: 'Категории производства',
      subtitle: 'Управление категориями для производственных заказов',
      add: 'Добавить категорию',
      name: 'Название',
      description: 'Описание',
      color: 'Цвет',
      status: 'Статус',
      actions: 'Действия',
      active: 'Активная',
      create: 'Создать категорию',
      update: 'Обновить категорию',
      cancel: 'Отмена',
      no_categories: 'Категорий пока нет. Добавьте первую категорию.',
      delete_confirm: 'Вы уверены, что хотите удалить эту категорию?',
      name_placeholder: 'напр. Производство блоков',
      desc_placeholder: 'Необязательное описание',
    }
  };
  const l = labels[language] || labels.en;

  const openCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', color: '#6366f1' });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, description: cat.description || '', color: cat.color || '#6366f1' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    try {
      if (editingCategory) {
        await updateManufacturingCategory(editingCategory.id, formData);
      } else {
        await createManufacturingCategory(formData);
      }
      setShowModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save category');
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(l.delete_confirm)) return;
    try {
      await deleteManufacturingCategory(cat.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{l.title}</h2>
          <p className="text-slate-600 mt-1">{l.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-slate-700 to-slate-800">
          <Plus className="w-4 h-4 mr-2" />
          {l.add}
        </Button>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {(!manufacturingCategories || manufacturingCategories.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Tag className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 max-w-sm">{l.no_categories}</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                {l.add}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-12">{l.color}</TableHead>
                  <TableHead>{l.name}</TableHead>
                  <TableHead>{l.description}</TableHead>
                  <TableHead>{l.status}</TableHead>
                  <TableHead className="text-right">{l.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manufacturingCategories.map(cat => (
                  <TableRow key={cat.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <span
                        className="w-6 h-6 rounded-full inline-block border border-slate-200"
                        style={{ backgroundColor: cat.color || '#ccc' }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-slate-500">{cat.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={cat.is_active ? 'default' : 'secondary'} className={cat.is_active ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                        {cat.is_active ? l.active : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(cat)}>
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(cat)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? l.update : l.create}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{l.name} *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={l.name_placeholder}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{l.description}</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={l.desc_placeholder}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{l.color}</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent hover:border-slate-300'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 rounded-full border cursor-pointer"
                  title="Custom color"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                {l.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name.trim()}
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800"
              >
                {editingCategory ? l.update : l.create}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
