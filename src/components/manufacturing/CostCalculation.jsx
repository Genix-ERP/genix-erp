import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Download, Edit, Calculator, FileText, Search } from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { inventoryService, costCalculationsService } from '@/api/services';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/utils/formatDate';

const DEFAULT_PROFIT = 45;

const T = {
  en: {
    title: 'Cost Calculation',
    new_calc: 'New Calculation',
    name: 'Calculation Name',
    product_name: 'Product Being Manufactured',
    quantity: 'Qty',
    profit_pct: 'Profit %',
    material_cost: 'Material Cost',
    total_cost: 'Total Cost',
    total_with_profit: 'Total with Profit',
    notes: 'Notes',
    components: 'Components',
    add_component: 'Add Component',
    product: 'Product / Material',
    unit_cost: 'Unit Cost',
    unit: 'Unit',
    save: 'Save',
    cancel: 'Cancel',
    download_pdf: 'Download PDF',
    no_calcs: 'No calculations yet',
    no_calcs_sub: 'Create your first cost estimation to get started',
    search: 'Search calculations...',
    delete_confirm: 'Delete this calculation?',
    edit: 'Edit',
    date: 'Date',
    actions: 'Actions',
  },
  uz: {
    title: 'Narx hisoblash',
    new_calc: 'Yangi hisoblash',
    name: 'Hisoblash nomi',
    product_name: 'Ishlab chiqariladigan mahsulot',
    quantity: 'Miqdor',
    profit_pct: 'Foyda %',
    material_cost: 'Material xarajat',
    total_cost: 'Jami xarajat',
    total_with_profit: 'Foydali narx',
    notes: 'Izoh',
    components: 'Komponentlar',
    add_component: 'Komponent qo\'shish',
    product: 'Mahsulot / Material',
    unit_cost: 'Birlik narxi',
    unit: 'Birlik',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    download_pdf: 'PDF yuklash',
    no_calcs: 'Hisoblashlar yo\'q',
    no_calcs_sub: 'Birinchi narx hisoblashni yarating',
    search: 'Hisoblashlarni qidirish...',
    delete_confirm: 'Bu hisoblashni o\'chirish?',
    edit: 'Tahrirlash',
    date: 'Sana',
    actions: 'Amallar',
  },
  ru: {
    title: 'Калькуляция стоимости',
    new_calc: 'Новая калькуляция',
    name: 'Название калькуляции',
    product_name: 'Производимый продукт',
    quantity: 'Кол-во',
    profit_pct: 'Прибыль %',
    material_cost: 'Стоимость материалов',
    total_cost: 'Итоговая стоимость',
    total_with_profit: 'Цена с прибылью',
    notes: 'Примечания',
    components: 'Компоненты',
    add_component: 'Добавить компонент',
    product: 'Продукт / Материал',
    unit_cost: 'Стоимость за ед.',
    unit: 'Ед.',
    save: 'Сохранить',
    cancel: 'Отмена',
    download_pdf: 'Скачать PDF',
    no_calcs: 'Калькуляций нет',
    no_calcs_sub: 'Создайте первую калькуляцию стоимости',
    search: 'Поиск калькуляций...',
    delete_confirm: 'Удалить эту калькуляцию?',
    edit: 'Редактировать',
    date: 'Дата',
    actions: 'Действия',
  }
};

function fmtMoney(val) {
  if (!val && val !== 0) return '0';
  return Number(val).toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function emptyForm() {
  return {
    name: '',
    product_name: '',
    quantity: 1,
    profit_percent: DEFAULT_PROFIT,
    notes: '',
    lines: []
  };
}

export default function CostCalculation() {
  const { language } = useLanguage();
  const tx = T[language] || T.en;

  const [calcs, setCalcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Product search for adding components — search-as-you-type
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productFocused, setProductFocused] = useState(false);
  const [newLine, setNewLine] = useState({ product_id: '', product_name: '', quantity: 1, unit: 'pcs', unit_cost: 0 });
  const productSearchTimer = React.useRef(null);

  useEffect(() => {
    loadCalcs();
  }, []);

  // Debounced product search
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setProducts([]);
      return;
    }
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    productSearchTimer.current = setTimeout(async () => {
      try {
        const data = await inventoryService.listProducts({ search: productSearch, limit: 20 });
        setProducts(data || []);
      } catch (e) { /* silent */ }
    }, 300);
    return () => { if (productSearchTimer.current) clearTimeout(productSearchTimer.current); };
  }, [productSearch]);

  async function loadCalcs() {
    try {
      const data = await costCalculationsService.list();
      setCalcs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Computed totals
  const materialCost = form.lines.reduce((s, l) => s + (l.quantity * l.unit_cost), 0);
  const totalCost = materialCost;
  const totalWithProfit = totalCost * (1 + (Number(form.profit_percent) || 0) / 100);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setNewLine({ product_id: '', product_name: '', quantity: 1, unit: 'pcs', unit_cost: 0 });
    setProductSearch('');
    setShowModal(true);
  }

  async function openEdit(id) {
    try {
      const data = await costCalculationsService.get(id);
      setForm({
        name: data.name,
        product_name: data.product_name,
        quantity: data.quantity,
        profit_percent: data.profit_percent,
        notes: data.notes || '',
        lines: (data.lines || []).map(l => ({
          product_id: l.product_id || '',
          product_name: l.product_name,
          quantity: Number(l.quantity),
          unit: l.unit || 'pcs',
          unit_cost: Number(l.unit_cost),
        }))
      });
      setEditingId(id);
      setNewLine({ product_id: '', product_name: '', quantity: 1, unit: 'pcs', unit_cost: 0 });
      setProductSearch('');
      setShowModal(true);
    } catch (e) {
      toast.error('Failed to load calculation');
    }
  }

  function addLine() {
    if (!newLine.product_name) return;
    setForm(f => ({ ...f, lines: [...f.lines, { ...newLine }] }));
    setNewLine({ product_id: '', product_name: '', quantity: 1, unit: 'pcs', unit_cost: 0 });
    setProductSearch('');
  }

  function removeLine(idx) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  }

  function updateLine(idx, field, value) {
    setForm(f => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [field]: field === 'quantity' || field === 'unit_cost' ? Number(value) : value };
      return { ...f, lines };
    });
  }

  function selectProduct(p) {
    setNewLine(l => ({
      ...l,
      product_id: p.id,
      product_name: p.name,
      unit_cost: p.cost_price || p.sale_price || 0,
      unit: p.uom || 'pcs'
    }));
    setProductSearch(p.name);
    setProductFocused(false);
  }

  async function handleSave() {
    if (!form.name || !form.product_name) {
      toast.error('Fill in the required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        profit_percent: Number(form.profit_percent),
        lines: form.lines.map(l => ({
          ...l,
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost),
          total_cost: Number(l.quantity) * Number(l.unit_cost)
        }))
      };
      if (editingId) {
        await costCalculationsService.update(editingId, payload);
        toast.success('Updated');
      } else {
        await costCalculationsService.create(payload);
        toast.success('Saved');
      }
      setShowModal(false);
      loadCalcs();
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm(tx.delete_confirm)) return;
    try {
      await costCalculationsService.delete(id);
      toast.success('Deleted');
      loadCalcs();
    } catch (e) {
      toast.error('Failed to delete');
    }
  }

  async function downloadPDF(calc) {
    const { ensurePdfFonts, registerPdfFontsSync } = await import("../shared/pdfFonts");
    await ensurePdfFonts().catch(() => {});

    const doc = new jsPDF();
    const hasUnicodeFont = registerPdfFontsSync(doc);
    const fontFamily = hasUnicodeFont ? "Roboto" : undefined;
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(calc.product_name, pageW / 2, 22, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(calc.name, pageW / 2, 30, { align: 'center' });

    const dateStr = formatDate(calc.created_at);
    doc.setFontSize(10);
    doc.text(dateStr, pageW / 2, 37, { align: 'center' });

    // Summary box
    const summaryY = 48;
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(14, summaryY, pageW - 28, 32, 3, 3, 'F');

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('Miqdor / Quantity:', 20, summaryY + 9);
    doc.setTextColor(40, 40, 40);
    doc.text(String(calc.quantity), 80, summaryY + 9);

    doc.setTextColor(80, 80, 80);
    doc.text('Material xarajat:', 20, summaryY + 17);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoney(calc.material_cost) + ' so\'m', 80, summaryY + 17);

    doc.setTextColor(80, 80, 80);
    doc.text('Foyda ulushi:', 20, summaryY + 25);
    doc.setTextColor(40, 40, 40);
    doc.text(calc.profit_percent + '%', 80, summaryY + 25);

    // Total with profit — big
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(14, summaryY + 38, pageW - 28, 18, 3, 3, 'F');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('Jami narx:', 20, summaryY + 50);
    doc.setFontSize(14);
    doc.setFont(fontFamily, 'bold');
    doc.text(fmtMoney(calc.total_with_profit) + ' so\'m', pageW - 18, summaryY + 50, { align: 'right' });

    if (calc.notes) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('* ' + calc.notes, 14, summaryY + 64);
    }

    doc.save(`${calc.product_name}_kalkulyatsiya.pdf`);
  }

  const filteredCalcs = calcs.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products;

  const TAB_STYLE = "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200";

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={tx.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white gap-2">
          <Plus className="w-4 h-4" />
          {tx.new_calc}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
      ) : filteredCalcs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Calculator className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">{tx.no_calcs}</p>
            <p className="text-slate-400 text-sm">{tx.no_calcs_sub}</p>
            <Button onClick={openCreate} variant="outline" className="mt-2 gap-2">
              <Plus className="w-4 h-4" />
              {tx.new_calc}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredCalcs.map(calc => (
            <Card key={calc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800 truncate">{calc.name}</h3>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                        {calc.product_name}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 flex-wrap text-sm text-slate-500">
                      <span>{tx.material_cost}: <b className="text-slate-700">{fmtMoney(calc.material_cost)}</b></span>
                      <span>{tx.profit_pct}: <b className="text-slate-700">{calc.profit_percent}%</b></span>
                      <span className="text-xs text-slate-400">
                        {formatDate(calc.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{tx.total_with_profit}</p>
                      <p className="text-xl font-bold text-blue-600">
                        {fmtMoney(calc.total_with_profit)} <span className="text-sm font-normal">so'm</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        size="sm" variant="outline"
                        className="gap-1 h-7 text-xs"
                        onClick={() => openEdit(calc.id)}
                      >
                        <Edit className="w-3 h-3" />
                        {tx.edit}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="gap-1 h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => downloadPDF(calc)}
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="gap-1 h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => handleDelete(calc.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-500" />
              {editingId ? tx.edit : tx.new_calc}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">{tx.name} *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={language === 'uz' ? 'Stul kalkulyatsiyasi' : 'e.g. Chair cost estimate'}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">{tx.product_name} *</Label>
                <Input
                  value={form.product_name}
                  onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
                  placeholder={language === 'uz' ? 'Stul' : 'e.g. Chair'}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">{tx.quantity}</Label>
                <Input
                  type="number" min="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">{tx.profit_pct} (default {DEFAULT_PROFIT}%)</Label>
                <Input
                  type="number" min="0" max="1000"
                  value={form.profit_percent}
                  onChange={e => setForm(f => ({ ...f, profit_percent: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500">{tx.notes}</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Components */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{tx.components}</Label>

              {form.lines.length > 0 && (
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">{tx.product}</TableHead>
                        <TableHead className="text-xs w-20">{tx.quantity}</TableHead>
                        <TableHead className="text-xs w-20">{tx.unit}</TableHead>
                        <TableHead className="text-xs w-28">{tx.unit_cost}</TableHead>
                        <TableHead className="text-xs w-28 text-right">= {tx.total_cost}</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.lines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm py-2">{line.product_name}</TableCell>
                          <TableCell className="py-2">
                            <Input
                              type="number" min="0" className="h-7 text-xs w-20"
                              value={line.quantity}
                              onChange={e => updateLine(idx, 'quantity', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="py-2 text-xs text-slate-500">{line.unit}</TableCell>
                          <TableCell className="py-2">
                            <Input
                              type="number" min="0" className="h-7 text-xs w-28"
                              value={line.unit_cost}
                              onChange={e => updateLine(idx, 'unit_cost', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="py-2 text-right text-sm font-medium">
                            {fmtMoney(line.quantity * line.unit_cost)}
                          </TableCell>
                          <TableCell className="py-2">
                            <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Add line row */}
              <div className="mt-2 flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[180px] relative">
                  <Label className="text-xs text-slate-400">{tx.product}</Label>
                  <Input
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setNewLine(l => ({ ...l, product_name: e.target.value, product_id: '' })); }}
                    onFocus={() => setProductFocused(true)}
                    onBlur={() => setTimeout(() => setProductFocused(false), 180)}
                    placeholder={language === 'uz' ? 'Mahsulot qidirish...' : 'Search product...'}
                    className="h-8 text-sm"
                  />
                  {productFocused && filteredProducts.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                          onMouseDown={() => selectProduct(p)}
                        >
                          <span>{p.name}</span>
                          {(p.cost_price || p.sale_price) && (
                            <span className="text-xs text-slate-400">{fmtMoney(p.cost_price || p.sale_price)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-20">
                  <Label className="text-xs text-slate-400">{tx.quantity}</Label>
                  <Input
                    type="number" min="0" className="h-8 text-sm"
                    value={newLine.quantity}
                    onChange={e => setNewLine(l => ({ ...l, quantity: Number(e.target.value) }))}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs text-slate-400">{tx.unit}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={newLine.unit}
                    onChange={e => setNewLine(l => ({ ...l, unit: e.target.value }))}
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-slate-400">{tx.unit_cost}</Label>
                  <Input
                    type="number" min="0" className="h-8 text-sm"
                    value={newLine.unit_cost}
                    onChange={e => setNewLine(l => ({ ...l, unit_cost: Number(e.target.value) }))}
                  />
                </div>
                <Button
                  type="button" size="sm" variant="outline"
                  className="h-8 gap-1 text-xs shrink-0 self-end"
                  onClick={addLine}
                  disabled={!newLine.product_name}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {tx.add_component}
                </Button>
              </div>
            </div>

            {/* Totals summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{tx.material_cost}</span>
                <span className="font-medium">{fmtMoney(materialCost)} so'm</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{tx.profit_pct}: {form.profit_percent}%</span>
                <span className="font-medium text-green-600">+ {fmtMoney(totalWithProfit - totalCost)} so'm</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                <span className="font-semibold text-slate-700">{tx.total_with_profit}</span>
                <span className="text-xl font-bold text-blue-600">{fmtMoney(totalWithProfit)} so'm</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>{tx.cancel}</Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white"
              >
                {saving ? '...' : tx.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
