import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Tag } from 'lucide-react';
import { useManufacturing } from '@/components/contexts/ManufacturingContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

export default function ManufacturingCategories() {
  const { language } = useLanguage();
  const {
    manufacturingCategories,
    createManufacturingCategory,
    updateManufacturingCategory,
    deleteManufacturingCategory
  } = useManufacturing();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');

  const l = {
    en: { title: 'Manufacturing Categories', subtitle: 'Manage categories for production orders and shop floor filtering', add: 'Add Category', name: 'Name', actions: 'Actions', create: 'Create Category', update: 'Update Category', cancel: 'Cancel', no_categories: 'No categories yet. Add your first category to organize production orders.', delete_confirm: 'Are you sure you want to delete this category?', placeholder: 'e.g. Block Production' },
    uz: { title: 'Ishlab chiqarish kategoriyalari', subtitle: 'Ishlab chiqarish buyurtmalari va sex boshqaruvi uchun kategoriyalarni boshqaring', add: 'Kategoriya qo\'shish', name: 'Nomi', actions: 'Amallar', create: 'Kategoriya yaratish', update: 'Kategoriyani yangilash', cancel: 'Bekor qilish', no_categories: 'Hali kategoriya yo\'q. Birinchi kategoriyani qo\'shing.', delete_confirm: 'Bu kategoriyani o\'chirishni xohlaysizmi?', placeholder: 'masalan, Blok ishlab chiqarish' },
    ru: { title: 'Категории производства', subtitle: 'Управление категориями для производственных заказов', add: 'Добавить категорию', name: 'Название', actions: 'Действия', create: 'Создать категорию', update: 'Обновить категорию', cancel: 'Отмена', no_categories: 'Категорий пока нет. Добавьте первую категорию.', delete_confirm: 'Вы уверены, что хотите удалить эту категорию?', placeholder: 'напр. Производство блоков' },
  }[language] || { title: 'Manufacturing Categories', subtitle: 'Manage categories for production orders and shop floor filtering', add: 'Add Category', name: 'Name', actions: 'Actions', create: 'Create Category', update: 'Update Category', cancel: 'Cancel', no_categories: 'No categories yet. Add your first category to organize production orders.', delete_confirm: 'Are you sure you want to delete this category?', placeholder: 'e.g. Block Production' };

  const openCreate = () => {
    setEditingCategory(null);
    setCategoryName('');
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!categoryName.trim()) return;
    try {
      if (editingCategory) {
        await updateManufacturingCategory(editingCategory.id, { name: categoryName.trim() });
      } else {
        await createManufacturingCategory({ name: categoryName.trim() });
      }
      setShowModal(false);
    } catch (err) {
      // data.error is an OBJECT on most endpoints — never toast it raw.
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(l.delete_confirm)) return;
    try {
      await deleteManufacturingCategory(cat.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
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
                  <TableHead>{l.name}</TableHead>
                  <TableHead className="text-right w-32">{l.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manufacturingCategories.map(cat => (
                  <TableRow key={cat.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(cat)}>
                          <Edit className="w-4 h-4 text-slate-500" />
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? l.update : l.create}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{l.name} *</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={l.placeholder}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                {l.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!categoryName.trim()}
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
