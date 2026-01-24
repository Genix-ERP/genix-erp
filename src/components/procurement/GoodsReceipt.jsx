import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Package,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  ClipboardCheck,
  Truck,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useProcurement } from '@/components/contexts/ProcurementContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  inspecting: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const qualityColors = {
  pending: 'bg-gray-100 text-gray-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  partial: 'bg-orange-100 text-orange-800',
};

export default function GoodsReceipt() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { purchaseOrders = [] } = useProcurement();
  const { canCreate } = usePermissions();

  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedGR, setSelectedGR] = useState(null);

  const [newGR, setNewGR] = useState({
    po_id: '',
    received_by: '',
    warehouse_location: '',
    notes: '',
    lines: [],
  });

  const [inspectionData, setInspectionData] = useState({
    quality_status: 'passed',
    quality_notes: '',
    lines: [],
  });

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('demo_goods_receipts');
    if (stored) {
      setReceipts(JSON.parse(stored));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('demo_goods_receipts', JSON.stringify(receipts));
  }, [receipts]);

  // Filter receipts
  useEffect(() => {
    let filtered = receipts;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(gr => gr.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(gr =>
        gr.gr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gr.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gr.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredReceipts(filtered);
  }, [receipts, searchQuery, statusFilter]);

  // Get open POs for dropdown
  const openPOs = purchaseOrders.filter(po => po.status === 'approved' || po.status === 'partial');

  const handleSelectPO = (poId) => {
    const po = purchaseOrders.find(o => o.id === poId);
    if (po) {
      setNewGR({
        ...newGR,
        po_id: poId,
        po_number: po.po_number,
        supplier_name: po.vendor_name || po.supplier_name,
        lines: (po.items || []).map(item => ({
          product_id: item.product_id || item.id,
          product_name: item.product_name || item.name,
          ordered_quantity: item.quantity,
          received_quantity: item.quantity,
          unit: item.unit || 'pcs',
          batch_number: '',
          expiry_date: '',
          storage_location: '',
        })),
      });
    }
  };

  const handleCreateGR = () => {
    if (!newGR.po_id || !newGR.received_by) return;

    const totalReceived = newGR.lines.reduce((sum, line) => sum + (line.received_quantity || 0), 0);

    const gr = {
      id: Date.now().toString(),
      gr_number: `GR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(receipts.length + 1).padStart(4, '0')}`,
      ...newGR,
      receipt_date: new Date().toISOString().split('T')[0],
      total_received: totalReceived,
      status: 'pending',
      quality_status: 'pending',
      created_at: new Date().toISOString(),
    };

    setReceipts(prev => [gr, ...prev]);
    setShowCreateModal(false);
    setNewGR({
      po_id: '',
      received_by: '',
      warehouse_location: '',
      notes: '',
      lines: [],
    });
  };

  const handleStartInspection = (gr) => {
    setSelectedGR(gr);
    setInspectionData({
      quality_status: 'passed',
      quality_notes: '',
      lines: gr.lines.map(line => ({
        ...line,
        accepted_quantity: line.received_quantity,
        rejected_quantity: 0,
        quality_status: 'passed',
        defect_notes: '',
      })),
    });
    setShowInspectModal(true);
  };

  const handleSaveInspection = () => {
    if (!selectedGR) return;

    const totalAccepted = inspectionData.lines.reduce((sum, line) => sum + (line.accepted_quantity || 0), 0);
    const totalRejected = inspectionData.lines.reduce((sum, line) => sum + (line.rejected_quantity || 0), 0);

    setReceipts(prev => prev.map(gr =>
      gr.id === selectedGR.id
        ? {
          ...gr,
          status: 'inspecting',
          quality_status: inspectionData.quality_status,
          quality_notes: inspectionData.quality_notes,
          total_accepted: totalAccepted,
          total_rejected: totalRejected,
          lines: inspectionData.lines,
          inspected_at: new Date().toISOString(),
        }
        : gr
    ));

    setShowInspectModal(false);
    setSelectedGR(null);
  };

  const handleCompleteGR = (gr) => {
    setReceipts(prev => prev.map(g =>
      g.id === gr.id
        ? { ...g, status: 'completed', completed_at: new Date().toISOString() }
        : g
    ));
  };

  const handleCancelGR = (gr) => {
    if (confirm(t('confirm_cancel_receipt') || 'Are you sure you want to cancel this receipt?')) {
      setReceipts(prev => prev.map(g =>
        g.id === gr.id
          ? { ...g, status: 'cancelled', cancelled_at: new Date().toISOString() }
          : g
      ));
    }
  };

  const handleDeleteGR = (gr) => {
    if (confirm(t('confirm_delete_receipt') || 'Are you sure you want to delete this receipt?')) {
      setReceipts(prev => prev.filter(g => g.id !== gr.id));
    }
  };

  const updateLine = (index, field, value) => {
    setNewGR(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line),
    }));
  };

  const updateInspectionLine = (index, field, value) => {
    setInspectionData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => {
        if (i === index) {
          const updated = { ...line, [field]: value };
          if (field === 'accepted_quantity' || field === 'rejected_quantity') {
            const accepted = field === 'accepted_quantity' ? value : line.accepted_quantity;
            const rejected = field === 'rejected_quantity' ? value : line.rejected_quantity;
            updated.quality_status = rejected > 0 ? (accepted > 0 ? 'partial' : 'failed') : 'passed';
          }
          return updated;
        }
        return line;
      }),
    }));
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: t('draft') || 'Draft',
      pending: t('pending') || 'Pending',
      inspecting: t('inspecting') || 'Inspecting',
      completed: t('completed') || 'Completed',
      cancelled: t('cancelled') || 'Cancelled',
    };
    return labels[status] || status;
  };

  const getQualityLabel = (status) => {
    const labels = {
      pending: t('pending') || 'Pending',
      passed: t('passed') || 'Passed',
      failed: t('failed') || 'Failed',
      partial: t('partial') || 'Partial',
    };
    return labels[status] || status;
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t('goods_receipt') || 'Goods Receipt'}
          </CardTitle>
          {canCreate(MODULES.PURCHASES) && (
            <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> {t('new_receipt') || 'New Receipt'}
            </Button>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('search') || 'Search...'}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all') || 'All'}</SelectItem>
              <SelectItem value="pending">{t('pending') || 'Pending'}</SelectItem>
              <SelectItem value="inspecting">{t('inspecting') || 'Inspecting'}</SelectItem>
              <SelectItem value="completed">{t('completed') || 'Completed'}</SelectItem>
              <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredReceipts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_receipts_yet') || 'No receipts yet'}</p>
            {canCreate(MODULES.PURCHASES) && (
              <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                {t('create_first_receipt') || 'Create First Receipt'}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('gr_number') || 'GR #'}</TableHead>
                  <TableHead>{t('po_number') || 'PO #'}</TableHead>
                  <TableHead>{t('supplier') || 'Supplier'}</TableHead>
                  <TableHead>{t('receipt_date') || 'Receipt Date'}</TableHead>
                  <TableHead>{t('received_by') || 'Received By'}</TableHead>
                  <TableHead>{t('quality') || 'Quality'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((gr) => (
                  <TableRow key={gr.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-sm">{gr.gr_number}</TableCell>
                    <TableCell className="font-mono text-sm">{gr.po_number}</TableCell>
                    <TableCell className="font-medium">{gr.supplier_name || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {gr.receipt_date ? format(new Date(gr.receipt_date), 'dd.MM.yyyy') : '-'}
                    </TableCell>
                    <TableCell>{gr.received_by}</TableCell>
                    <TableCell>
                      <Badge className={qualityColors[gr.quality_status]}>{getQualityLabel(gr.quality_status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[gr.status]}>{getStatusLabel(gr.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedGR(gr); setShowDetailModal(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {gr.status === 'pending' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleStartInspection(gr)} title={t('inspect') || 'Inspect'}>
                              <ClipboardCheck className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCancelGR(gr)} title={t('cancel') || 'Cancel'}>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {gr.status === 'inspecting' && (
                          <Button size="sm" variant="ghost" onClick={() => handleCompleteGR(gr)} title={t('complete') || 'Complete'}>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        {gr.status === 'draft' && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteGR(gr)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create GR Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_goods_receipt') || 'New Goods Receipt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('select_purchase_order') || 'Select Purchase Order'} *</label>
                <Select value={newGR.po_id} onValueChange={handleSelectPO}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_po') || 'Select PO'} />
                  </SelectTrigger>
                  <SelectContent>
                    {openPOs.length === 0 ? (
                      <SelectItem value="-" disabled>{t('no_open_pos') || 'No open POs'}</SelectItem>
                    ) : (
                      openPOs.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.po_number} - {po.vendor_name || po.supplier_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('received_by') || 'Received By'} *</label>
                <Input
                  value={newGR.received_by}
                  onChange={(e) => setNewGR({ ...newGR, received_by: e.target.value })}
                  placeholder={t('your_name') || 'Your name'}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('warehouse_location') || 'Warehouse Location'}</label>
              <Input
                value={newGR.warehouse_location}
                onChange={(e) => setNewGR({ ...newGR, warehouse_location: e.target.value })}
                placeholder={t('warehouse_location') || 'Warehouse location'}
              />
            </div>

            {/* Line Items */}
            {newGR.lines.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('items_to_receive') || 'Items to Receive'}</label>
                <div className="space-y-2">
                  {newGR.lines.map((line, index) => (
                    <div key={index} className="bg-slate-50 p-3 rounded-lg">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <span className="text-sm font-medium">{line.product_name}</span>
                          <p className="text-xs text-slate-500">{t('ordered') || 'Ordered'}: {line.ordered_quantity} {line.unit}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">{t('received_qty') || 'Received Qty'}</label>
                          <Input
                            type="number"
                            value={line.received_quantity}
                            onChange={(e) => updateLine(index, 'received_quantity', parseFloat(e.target.value) || 0)}
                            max={line.ordered_quantity}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">{t('batch_number') || 'Batch #'}</label>
                          <Input
                            value={line.batch_number}
                            onChange={(e) => updateLine(index, 'batch_number', e.target.value)}
                            placeholder="LOT-XXX"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">{t('expiry_date') || 'Expiry'}</label>
                          <Input
                            type="date"
                            value={line.expiry_date}
                            onChange={(e) => updateLine(index, 'expiry_date', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">{t('storage_location') || 'Storage'}</label>
                          <Input
                            value={line.storage_location}
                            onChange={(e) => updateLine(index, 'storage_location', e.target.value)}
                            placeholder="A-01-01"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">{t('notes') || 'Notes'}</label>
              <Textarea
                value={newGR.notes}
                onChange={(e) => setNewGR({ ...newGR, notes: e.target.value })}
                placeholder={t('receipt_notes') || 'Any notes about this receipt...'}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateGR}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!newGR.po_id || !newGR.received_by}
              >
                {t('create_receipt') || 'Create Receipt'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inspection Modal */}
      <Dialog open={showInspectModal} onOpenChange={setShowInspectModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              {t('quality_inspection') || 'Quality Inspection'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>{t('gr_number') || 'GR #'}:</strong> {selectedGR?.gr_number}</p>
              <p className="text-sm"><strong>{t('po_number') || 'PO #'}:</strong> {selectedGR?.po_number}</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('inspect_items') || 'Inspect Items'}</label>
              <div className="space-y-3">
                {inspectionData.lines.map((line, index) => (
                  <div key={index} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{line.product_name}</span>
                      <Badge className={qualityColors[line.quality_status]}>{getQualityLabel(line.quality_status)}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-500">{t('received') || 'Received'}</label>
                        <p className="font-medium">{line.received_quantity} {line.unit}</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">{t('accepted_qty') || 'Accepted Qty'}</label>
                        <Input
                          type="number"
                          value={line.accepted_quantity}
                          onChange={(e) => updateInspectionLine(index, 'accepted_quantity', parseFloat(e.target.value) || 0)}
                          max={line.received_quantity}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">{t('rejected_qty') || 'Rejected Qty'}</label>
                        <Input
                          type="number"
                          value={line.rejected_quantity}
                          onChange={(e) => updateInspectionLine(index, 'rejected_quantity', parseFloat(e.target.value) || 0)}
                          max={line.received_quantity}
                        />
                      </div>
                    </div>
                    {line.rejected_quantity > 0 && (
                      <div className="mt-2">
                        <Input
                          placeholder={t('defect_notes') || 'Describe defects...'}
                          value={line.defect_notes}
                          onChange={(e) => updateInspectionLine(index, 'defect_notes', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('overall_quality') || 'Overall Quality'}</label>
                <Select value={inspectionData.quality_status} onValueChange={(v) => setInspectionData({ ...inspectionData, quality_status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">{t('passed') || 'Passed'}</SelectItem>
                    <SelectItem value="partial">{t('partial') || 'Partial'}</SelectItem>
                    <SelectItem value="failed">{t('failed') || 'Failed'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('quality_notes') || 'Quality Notes'}</label>
                <Input
                  value={inspectionData.quality_notes}
                  onChange={(e) => setInspectionData({ ...inspectionData, quality_notes: e.target.value })}
                  placeholder={t('inspection_notes') || 'Inspection notes...'}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowInspectModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleSaveInspection}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
              >
                {t('save_inspection') || 'Save Inspection'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('receipt_details') || 'Receipt Details'}</DialogTitle>
          </DialogHeader>
          {selectedGR && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('gr_number') || 'GR Number'}</p>
                  <p className="font-mono font-medium">{selectedGR.gr_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('po_number') || 'PO Number'}</p>
                  <p className="font-mono font-medium">{selectedGR.po_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('supplier') || 'Supplier'}</p>
                  <p className="font-medium">{selectedGR.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={statusColors[selectedGR.status]}>{getStatusLabel(selectedGR.status)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('received_by') || 'Received By'}</p>
                  <p className="font-medium">{selectedGR.received_by}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('quality_status') || 'Quality Status'}</p>
                  <Badge className={qualityColors[selectedGR.quality_status]}>{getQualityLabel(selectedGR.quality_status)}</Badge>
                </div>
              </div>

              {selectedGR.warehouse_location && (
                <div>
                  <p className="text-sm text-slate-500">{t('warehouse_location') || 'Warehouse Location'}</p>
                  <p className="font-medium">{selectedGR.warehouse_location}</p>
                </div>
              )}

              {selectedGR.lines && selectedGR.lines.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">{t('received_items') || 'Received Items'}</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {selectedGR.lines.map((line, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{line.product_name}</span>
                          {line.batch_number && <span className="text-xs text-slate-500 ml-2">Batch: {line.batch_number}</span>}
                        </div>
                        <div className="text-right">
                          <span className="text-slate-600">
                            {line.accepted_quantity !== undefined ? `${line.accepted_quantity}/${line.received_quantity}` : line.received_quantity} {line.unit}
                          </span>
                          {line.rejected_quantity > 0 && (
                            <span className="text-red-500 text-xs ml-2">({line.rejected_quantity} {t('rejected') || 'rejected'})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedGR.quality_notes && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-600"><strong>{t('quality_notes') || 'Quality Notes'}:</strong> {selectedGR.quality_notes}</p>
                </div>
              )}

              {selectedGR.notes && (
                <div>
                  <p className="text-sm text-slate-500">{t('notes') || 'Notes'}</p>
                  <p className="text-sm">{selectedGR.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
