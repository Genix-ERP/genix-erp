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
import { inventoryService } from "@/api/services/inventory";
import { procurementService } from "@/api/services/procurement";
import { useInventory } from "@/components/contexts/InventoryContext";
import { toast } from 'sonner';

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
  const { isLotTrackingEnabled } = useInventory();
  const lotTrackingOn = isLotTrackingEnabled();

  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  // Warehouses state
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // Fetch warehouses from backend
  useEffect(() => {
    const fetchWarehouses = async () => {
      setWarehousesLoading(true);
      try {
        const data = await inventoryService.listWarehouses();
        setWarehouses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch warehouses:", error);
        setWarehouses([]);
      } finally {
        setWarehousesLoading(false);
      }
    };
    fetchWarehouses();
  }, []);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Fetch goods receipts from API
  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const response = await procurementService.listGoodsReceipts();
      setReceipts(response.data || response || []);
    } catch (error) {
      console.error('Failed to fetch goods receipts:', error);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

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

  // Get open POs for dropdown (approved, ordered, or partial POs)
  const openPOs = purchaseOrders.filter(po =>
    po.status === 'approved' || po.status === 'ordered' || po.status === 'partial' ||
    po.status === 'sent' || po.status === 'confirmed'
  );

  const handleSelectPO = async (poId) => {
    const poFromList = purchaseOrders.find(o => o.id === poId);
    if (!poFromList) return;

    try {
      // Fetch full PO details including lines from API
      const po = await procurementService.getOrder(poId);
      const poLines = po.lines || po.items || [];

      setNewGR({
        ...newGR,
        po_id: poId,
        po_number: po.order_number || po.po_number,
        supplier_id: po.vendor_id || po.supplier_id,
        supplier_name: po.vendor_name || po.supplier_name,
        lines: poLines.map(item => ({
          po_line_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.description || item.name || 'Product',
          ordered_quantity: item.quantity,
          received_quantity: item.quantity - (item.quantity_received || 0), // Only unreceived quantity
          unit: item.unit_name || item.unit || 'pcs',
          unit_price: item.unit_price || item.price || 0,
          batch_number: '',
          expiry_date: '',
          storage_location: '',
        })),
      });
    } catch (error) {
      console.error('Failed to fetch PO details:', error);
      // Fallback to list data
      const poLines = poFromList.lines || poFromList.items || [];
      setNewGR({
        ...newGR,
        po_id: poId,
        po_number: poFromList.order_number || poFromList.po_number,
        supplier_id: poFromList.vendor_id || poFromList.supplier_id,
        supplier_name: poFromList.vendor_name || poFromList.supplier_name,
        lines: poLines.map(item => ({
          po_line_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || item.description || item.name || 'Product',
          ordered_quantity: item.quantity,
          received_quantity: item.quantity,
          unit: item.unit_name || item.unit || 'pcs',
          unit_price: item.unit_price || item.price || 0,
          batch_number: '',
          expiry_date: '',
          storage_location: '',
        })),
      });
    }
  };

  const handleCreateGR = async () => {
    if (!newGR.po_id || !newGR.received_by) return;

    const selectedWarehouse = warehouses.find(w => w.id === newGR.warehouse_location);

    // Filter lines with received quantity > 0 and ensure product_name is set
    const validLines = newGR.lines
      .filter(line => line.received_quantity > 0)
      .map(line => ({
        po_line_id: line.po_line_id,
        product_id: line.product_id,
        product_name: line.product_name || 'Product',
        product_code: line.product_code || '',
        ordered_quantity: line.ordered_quantity,
        received_quantity: line.received_quantity,
        unit: line.unit || 'pcs',
        unit_price: line.unit_price || 0,
        batch_number: line.batch_number || '',
        expiry_date: line.expiry_date || '',
        storage_location: line.storage_location || '',
      }));

    if (validLines.length === 0) {
      toast.error(t('no_items_to_receive') || 'Please enter received quantities for at least one item');
      return;
    }

    // Validate lot numbers are provided when lot tracking is enabled
    if (lotTrackingOn) {
      const missingLotLines = validLines.filter(line => !line.batch_number);
      if (missingLotLines.length > 0) {
        toast.error(t('lot_number_required') || 'Partiya raqamini kiritish majburiy. Har bir mahsulot uchun partiya raqamini kiriting.');
        return;
      }
    }

    try {
      const payload = {
        purchase_order_id: newGR.po_id,
        received_by: newGR.received_by || 'User',
        warehouse_id: newGR.warehouse_location || undefined,
        warehouse_name: selectedWarehouse?.name || '',
        notes: newGR.notes || '',
        lines: validLines,
      };
      await procurementService.createGoodsReceipt(payload);

      // Refresh the list
      await fetchReceipts();
      setShowCreateModal(false);
      setNewGR({
        po_id: '',
        received_by: '',
        warehouse_location: '',
        notes: '',
        lines: [],
      });
    } catch (error) {
      console.error('Failed to create goods receipt:', error);
      toast.error(t('error_creating_receipt') || 'Failed to create goods receipt');
    }
  };

  const handleStartInspection = async (gr) => {
    try {
      // Fetch full GR details including lines
      const fullGR = await procurementService.getGoodsReceipt(gr.id);
      const grLines = fullGR.lines || [];

      setSelectedGR(fullGR);
      setInspectionData({
        quality_status: 'passed',
        quality_notes: '',
        lines: grLines.map(line => ({
          ...line,
          accepted_quantity: line.received_quantity || 0,
          rejected_quantity: 0,
          quality_status: 'passed',
          defect_notes: '',
        })),
      });
      setShowInspectModal(true);
    } catch (error) {
      console.error('Failed to fetch GR details:', error);
      toast.error(t('error_fetching_details') || 'Failed to fetch goods receipt details');
    }
  };

  const handleSaveInspection = async () => {
    if (!selectedGR) return;

    try {
      await procurementService.inspectGoodsReceipt(selectedGR.id, {
        inspected_by: newGR.received_by || 'Inspector',
        inspection_notes: inspectionData.quality_notes,
        lines: inspectionData.lines.map(line => ({
          line_id: line.id,
          accepted_quantity: line.accepted_quantity || 0,
          rejected_quantity: line.rejected_quantity || 0,
          rejection_reason: line.defect_notes || '',
        })),
      });

      // Refresh the list
      await fetchReceipts();
      setShowInspectModal(false);
      setSelectedGR(null);
    } catch (error) {
      console.error('Failed to save inspection:', error);
      toast.error(t('error_saving_inspection') || 'Failed to save inspection');
    }
  };

  const handleCompleteGR = async (gr) => {
    try {
      await procurementService.completeGoodsReceipt(gr.id);
      // Refresh the list - inventory is now updated on the backend!
      await fetchReceipts();
    } catch (error) {
      console.error('Failed to complete goods receipt:', error);
      toast.error(t('error_completing_receipt') || 'Failed to complete goods receipt. Make sure inspection is done first.');
    }
  };

  const handleCancelGR = (gr) => {
    setSelectedGR(gr);
    setShowCancelModal(true);
  };

  const confirmCancelGR = async () => {
    if (!selectedGR) return;
    try {
      await procurementService.cancelGoodsReceipt(selectedGR.id);
      await fetchReceipts();
      setShowCancelModal(false);
      setSelectedGR(null);
    } catch (error) {
      console.error('Failed to cancel goods receipt:', error);
      toast.error(t('error_cancelling_receipt') || 'Failed to cancel goods receipt');
    }
  };

  const handleDeleteGR = (gr) => {
    setSelectedGR(gr);
    setShowDeleteModal(true);
  };

  const confirmDeleteGR = async () => {
    if (!selectedGR) return;
    try {
      await procurementService.deleteGoodsReceipt(selectedGR.id);
      await fetchReceipts();
      setShowDeleteModal(false);
      setSelectedGR(null);
    } catch (error) {
      console.error('Failed to delete goods receipt:', error);
      toast.error(t('error_deleting_receipt') || 'Failed to delete goods receipt. Only draft receipts can be deleted.');
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
        {loading ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500">{t('loading') || 'Loading...'}</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
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
              <Select
                value={newGR.warehouse_location}
                onValueChange={(value) => setNewGR({ ...newGR, warehouse_location: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                </SelectTrigger>
                <SelectContent>
                  {warehousesLoading ? (
                    <SelectItem value="__loading__" disabled>
                      {t('loading') || 'Loading...'}
                    </SelectItem>
                  ) : warehouses.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      {t('no_warehouses') || 'No warehouses found'}
                    </SelectItem>
                  ) : (
                    warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
                          <label className="text-xs text-slate-500">
                            {t('lot_number') || 'Partiya №'}
                            {lotTrackingOn && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <Input
                            value={line.batch_number}
                            onChange={(e) => updateLine(index, 'batch_number', e.target.value)}
                            placeholder="LOT-2026-001"
                            className={lotTrackingOn && !line.batch_number ? 'border-red-300' : ''}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500">
                            {t('expiry_date') || 'Srok'}
                          </label>
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
                  <p className="font-medium">
                    {selectedGR.warehouse_name || warehouses.find(w => w.id === selectedGR.warehouse_location)?.name || selectedGR.warehouse_location}
                  </p>
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

      {/* Cancel Confirmation Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirm_cancel') || 'Confirm Cancel'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('confirm_cancel_receipt_message') || 'Are you sure you want to cancel this goods receipt?'}
            </p>
            {selectedGR && (
              <p className="mt-2 font-mono text-sm text-slate-500">
                {selectedGR.gr_number}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(false)} className="flex-1">
              {t('no') || 'No'}
            </Button>
            <Button
              onClick={confirmCancelGR}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {t('yes_cancel') || 'Yes, Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirm_delete') || 'Confirm Delete'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('confirm_delete_receipt_message') || 'Are you sure you want to delete this goods receipt? This action cannot be undone.'}
            </p>
            {selectedGR && (
              <p className="mt-2 font-mono text-sm text-slate-500">
                {selectedGR.gr_number}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">
              {t('no') || 'No'}
            </Button>
            <Button
              onClick={confirmDeleteGR}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {t('yes_delete') || 'Yes, Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
