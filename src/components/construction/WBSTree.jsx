import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  FolderTree,
  GripVertical
} from 'lucide-react';

// WBS Tree Node component
const WBSTreeNode = ({ node, level = 0, onEdit, onDelete, onAddChild, t, formatCurrency, expandedNodes, toggleExpand }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 24 + 8;

  const getProgressColor = (progress) => {
    if (progress >= 70) return 'bg-green-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (progress) => {
    if (progress >= 100) return <Badge className="bg-green-500 text-white text-xs">{t('completed') || 'Tugallangan'}</Badge>;
    if (progress > 0) return <Badge className="bg-blue-500 text-white text-xs">{t('in_progress') || 'Jarayonda'}</Badge>;
    return <Badge className="bg-gray-400 text-white text-xs">{t('not_started') || 'Boshlanmagan'}</Badge>;
  };

  return (
    <>
      <div
        className="flex items-center gap-2 py-2 px-2 hover:bg-slate-50 border-b border-slate-100 group"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={() => hasChildren && toggleExpand(node.id)}
          className={`w-5 h-5 flex items-center justify-center rounded ${hasChildren ? 'hover:bg-slate-200 cursor-pointer' : ''}`}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <span className="w-4 h-4" />
          )}
        </button>

        {/* Code */}
        <span className="text-sm font-mono text-slate-500 min-w-[60px]">{node.code}</span>

        {/* Name */}
        <span className={`text-sm flex-1 ${hasChildren ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
          {node.name}
        </span>

        {/* Progress */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${getProgressColor(node.progress)}`}
              style={{ width: `${Math.min(100, node.progress)}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 min-w-[35px] text-right">{node.progress?.toFixed(1) || '0.0'}%</span>
        </div>

        {/* Budget */}
        {node.budget_amount > 0 && (
          <span className="text-xs text-slate-500 min-w-[100px] text-right">
            {formatCurrency ? formatCurrency(node.budget_amount) : node.budget_amount.toLocaleString()}
          </span>
        )}

        {/* Status */}
        <div className="min-w-[90px]">
          {getStatusBadge(node.progress)}
        </div>

        {/* Dates */}
        {node.date_start_plan && (
          <span className="text-xs text-slate-400 min-w-[80px]">
            {new Date(node.date_start_plan).toLocaleDateString('uz-UZ')}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onAddChild(node)}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(node)}>
            <Edit className="w-3 h-3" />
          </Button>
          {!hasChildren && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => onDelete(node)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        node.children.map(child => (
          <WBSTreeNode
            key={child.id}
            node={child}
            level={level + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            t={t}
            formatCurrency={formatCurrency}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
          />
        ))
      )}
    </>
  );
};

// Main WBSTree component
export const WBSTree = ({ items = [], onCreateItem, onUpdateItem, onDeleteItem, projectId, buildingId, t, formatCurrency }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [parentItem, setParentItem] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [form, setForm] = useState({
    name: '',
    description: '',
    budget_amount: '',
    date_start_plan: '',
    date_end_plan: '',
  });

  const toggleExpand = useCallback((id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set();
    const collectIds = (nodes) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allIds.add(n.id);
          collectIds(n.children);
        }
      });
    };
    collectIds(items);
    setExpandedNodes(allIds);
  }, [items]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', budget_amount: '', date_start_plan: '', date_end_plan: '' });
    setEditingItem(null);
    setParentItem(null);
  };

  const handleAddRoot = () => {
    resetForm();
    setShowModal(true);
  };

  const handleAddChild = (parent) => {
    resetForm();
    setParentItem(parent);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setParentItem(null);
    setForm({
      name: item.name || '',
      description: item.description || '',
      budget_amount: item.budget_amount || '',
      date_start_plan: item.date_start_plan ? new Date(item.date_start_plan).toISOString().split('T')[0] : '',
      date_end_plan: item.date_end_plan ? new Date(item.date_end_plan).toISOString().split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: `${item.code} - ${item.name} ${t('confirm_delete_item') || "ni o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi."}`,
      onConfirm: async () => {
        await onDeleteItem(item.id);
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      budget_amount: form.budget_amount ? parseFloat(form.budget_amount) : 0,
      building_id: buildingId || 0,
    };

    if (editingItem) {
      await onUpdateItem(editingItem.id, data);
    } else {
      data.parent_id = parentItem ? parentItem.id : 0;
      await onCreateItem(projectId, data);
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">
            WBS ({t('work_breakdown_structure') || 'Ishlar tuzilmasi'})
          </span>
          <Badge variant="outline" className="text-xs">{items.length} {t('items') || 'band'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
            {t('expand_all') || 'Hammasini ochish'}
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
            {t('collapse_all') || 'Hammasini yopish'}
          </Button>
          <Button size="sm" onClick={handleAddRoot} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
            <Plus className="w-3 h-3 mr-1" />
            {t('add_wbs') || 'WBS qo\'shish'}
          </Button>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center gap-2 py-2 px-2 bg-slate-100 rounded-t-lg text-xs font-medium text-slate-500">
        <span className="w-5" />
        <span className="min-w-[60px]">{t('code') || 'Kod'}</span>
        <span className="flex-1">{t('work_name') || 'Ish nomi'}</span>
        <span className="min-w-[140px] text-center">{t('progress') || 'Progress'}</span>
        <span className="min-w-[100px] text-right">{t('budget') || 'Byudjet'}</span>
        <span className="min-w-[90px]">{t('status') || 'Holat'}</span>
        <span className="min-w-[80px]">{t('start_date') || 'Boshlanish'}</span>
        <span className="min-w-[52px]" />
      </div>

      {/* Tree */}
      <div className="border rounded-b-lg bg-white">
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('no_wbs_items') || 'WBS bandlari yo\'q'}</p>
            <p className="text-xs mt-1">{t('add_wbs_hint') || 'Yuqoridagi tugma orqali qo\'shing'}</p>
          </div>
        ) : (
          items.map(item => (
            <WBSTreeNode
              key={item.id}
              node={item}
              level={0}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
              t={t}
              formatCurrency={formatCurrency}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? (t('edit_wbs') || 'WBS tahrirlash')
                : parentItem
                  ? `${parentItem.code} ga bola qo'shish`
                  : (t('add_wbs') || 'Yangi WBS band')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('work_name') || 'Ish nomi'} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder={t('work_name_placeholder') || 'Poydevor qazish'}
              />
            </div>

            <div>
              <Label>{t('description') || 'Tavsif'}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label>{t('budget_amount') || 'Byudjet summasi'}</Label>
              <NumberInput
                value={form.budget_amount}
                onChange={(raw) => setForm({ ...form, budget_amount: raw })}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('start_date') || 'Boshlanish sanasi'}</Label>
                <Input
                  type="date"
                  value={form.date_start_plan}
                  onChange={(e) => setForm({ ...form, date_start_plan: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('end_date') || 'Tugash sanasi'}</Label>
                <Input
                  type="date"
                  value={form.date_end_plan}
                  onChange={(e) => setForm({ ...form, date_end_plan: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white">
                {editingItem ? (t('update') || 'Yangilash') : (t('create') || 'Yaratish')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {t('delete') || "O'chirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WBSTree;
