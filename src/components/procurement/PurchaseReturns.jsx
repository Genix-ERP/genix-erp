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
  RotateCcw,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Truck,
  PackageCheck,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useProcurement } from '@/components/contexts/ProcurementContext';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  shipped: 'bg-blue-100 text-blue-800',
  received: 'bg-purple-100 text-purple-800',
  credited: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-800',
};

const reasonLabels = {
  defective: 'Defective',
  wrong_item: 'Wrong Item',
  damaged: 'Damaged',
  quality_issue: 'Quality Issue',
  over_delivery: 'Over Delivery',
  not_as_described: 'Not as Described',
  other: 'Other',
};

export default function PurchaseReturns() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { orders, suppliers } = useProcurement();

  const [returns, setReturns] = useState([]);
  const [filteredReturns, setFilteredReturns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);

  const [newReturn, setNewReturn] = useState({
    po_id: '',
    supplier_id: '',
    return_reason: 'defective',
    notes: '',
    lines: [],
  });

  const [shipData, setShipData] = useState({
    carrier: '',
    tracking_number: '',
    shipped_date: new Date().toISOString().split('T')[0],
  });

  const [creditData, setCreditData] = useState({
    credit_note_number: '',
    credit_amount: 0,
    credit_date: new Date().toISOString().split('T')[0],
  });

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('demo_purchase_returns');
    if (stored) {
      setReturns(JSON.parse(stored));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('demo_purchase_returns', JSON.stringify(returns));
  }, [returns]);

  // Filter returns
  useEffect(() => {
    let filtered = returns;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredReturns(filtered);
  }, [returns, searchQuery, statusFilter]);

  // Get receivable POs (completed or with goods received)
  const returnablePOs = (orders || []).filter(po => po.status === 'completed' || po.status === 'partial' || po.status === 'received');

  const handleSelectPO = (poId) => {
    if (!orders || !Array.isArray(orders)) return;
    const po = orders.find(o => o.id === poId);
    if (po) {
      const supplier = suppliers?.find(s => s.id === po.supplier_id);
      setNewReturn({
        ...newReturn,
        po_id: poId,
        po_number: po.po_number,
        supplier_id: po.supplier_id,
        supplier_name: po.vendor_name || po.supplier_name || supplier?.name,
        lines: (po.items || []).map(item => ({
          product_id: item.product_id || item.id,
          product_name: item.product_name || item.name,
          original_quantity: item.quantity,
          return_quantity: 0,
          unit_price: item.price || item.unit_price || 0,
          unit: item.unit || 'pcs',
          return_reason: 'defective',
        })),
      });
    }
  };

  const handleCreateReturn = () => {
    if (!newReturn.po_id) return;

    const validLines = newReturn.lines.filter(l => l.return_quantity > 0);
    if (validLines.length === 0) {
      alert(t('select_items_to_return') || 'Please select at least one item to return');
      return;
    }

    const totalAmount = validLines.reduce((sum, line) => sum + (line.return_quantity * line.unit_price), 0);

    const returnDoc = {
      id: Date.now().toString(),
      return_number: `RET-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(returns.length + 1).padStart(4, '0')}`,
      ...newReturn,
      lines: validLines,
      return_date: new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    setReturns(prev => [returnDoc, ...prev]);
    setShowCreateModal(false);
    setNewReturn({
      po_id: '',
      supplier_id: '',
      return_reason: 'defective',
      notes: '',
      lines: [],
    });
  };

  const handleSubmitReturn = (ret) => {
    setReturns(prev => prev.map(r =>
      r.id === ret.id ? { ...r, status: 'pending_approval', submitted_at: new Date().toISOString() } : r
    ));
  };

  const handleApproveReturn = (ret) => {
    setReturns(prev => prev.map(r =>
      r.id === ret.id ? { ...r, status: 'approved', approved_at: new Date().toISOString() } : r
    ));
  };

  const handleRejectReturn = (ret) => {
    const reason = prompt(t('enter_rejection_reason') || 'Enter rejection reason:');
    if (reason) {
      setReturns(prev => prev.map(r =>
        r.id === ret.id ? { ...r, status: 'rejected', rejection_reason: reason, rejected_at: new Date().toISOString() } : r
      ));
    }
  };

  const handleShipReturn = () => {
    if (!selectedReturn || !shipData.carrier) return;

    setReturns(prev => prev.map(r =>
      r.id === selectedReturn.id
        ? { ...r, status: 'shipped', ...shipData, shipped_at: new Date().toISOString() }
        : r
    ));

    setShowShipModal(false);
    setSelectedReturn(null);
    setShipData({
      carrier: '',
      tracking_number: '',
      shipped_date: new Date().toISOString().split('T')[0],
    });
  };

  const handleReceiveReturn = (ret) => {
    setReturns(prev => prev.map(r =>
      r.id === ret.id ? { ...r, status: 'received', received_at: new Date().toISOString() } : r
    ));
  };

  const handleApplyCredit = () => {
    if (!selectedReturn || !creditData.credit_note_number) return;

    setReturns(prev => prev.map(r =>
      r.id === selectedReturn.id
        ? {
          ...r,
          status: 'credited',
          credit_note_number: creditData.credit_note_number,
          credit_amount: creditData.credit_amount || r.total_amount,
          credit_date: creditData.credit_date,
          credited_at: new Date().toISOString(),
        }
        : r
    ));

    setShowCreditModal(false);
    setSelectedReturn(null);
    setCreditData({
      credit_note_number: '',
      credit_amount: 0,
      credit_date: new Date().toISOString().split('T')[0],
    });
  };

  const handleCancelReturn = (ret) => {
    if (confirm(t('confirm_cancel_return') || 'Are you sure you want to cancel this return?')) {
      setReturns(prev => prev.map(r =>
        r.id === ret.id ? { ...r, status: 'cancelled', cancelled_at: new Date().toISOString() } : r
      ));
    }
  };

  const handleDeleteReturn = (ret) => {
    if (confirm(t('confirm_delete_return') || 'Are you sure you want to delete this return?')) {
      setReturns(prev => prev.filter(r => r.id !== ret.id));
    }
  };

  const updateLine = (index, field, value) => {
    setNewReturn(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line),
    }));
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: t('draft') || 'Draft',
      pending_approval: t('pending_approval') || 'Pending Approval',
      approved: t('approved') || 'Approved',
      rejected: t('rejected') || 'Rejected',
      shipped: t('shipped') || 'Shipped',
      received: t('received_by_supplier') || 'Received by Supplier',
      credited: t('credited') || 'Credited',
      cancelled: t('cancelled') || 'Cancelled',
    };
    return labels[status] || status;
  };

  const getReasonLabel = (reason) => {
    const labels = {
      defective: t('defective') || 'Defective',
      wrong_item: t('wrong_item') || 'Wrong Item',
      damaged: t('damaged') || 'Damaged',
      quality_issue: t('quality_issue') || 'Quality Issue',
      over_delivery: t('over_delivery') || 'Over Delivery',
      not_as_described: t('not_as_described') || 'Not as Described',
      other: t('other') || 'Other',
    };
    return labels[reason] || reason;
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            {t('purchase_returns') || 'Purchase Returns'}
          </CardTitle>
          <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
            <Plus className="w-4 h-4 mr-2" /> {t('new_return') || 'New Return'}
          </Button>
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
              <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
              <SelectItem value="pending_approval">{t('pending') || 'Pending'}</SelectItem>
              <SelectItem value="approved">{t('approved') || 'Approved'}</SelectItem>
              <SelectItem value="shipped">{t('shipped') || 'Shipped'}</SelectItem>
              <SelectItem value="received">{t('received') || 'Received'}</SelectItem>
              <SelectItem value="credited">{t('credited') || 'Credited'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredReturns.length === 0 ? (
          <div className="text-center py-16">
            <RotateCcw className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_returns_yet') || 'No returns yet'}</p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
              {t('create_first_return') || 'Create First Return'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('return_number') || 'Return #'}</TableHead>
                  <TableHead>{t('po_number') || 'PO #'}</TableHead>
                  <TableHead>{t('supplier') || 'Supplier'}</TableHead>
                  <TableHead>{t('return_date') || 'Return Date'}</TableHead>
                  <TableHead>{t('reason') || 'Reason'}</TableHead>
                  <TableHead>{t('amount') || 'Amount'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((ret) => (
                  <TableRow key={ret.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-sm">{ret.return_number}</TableCell>
                    <TableCell className="font-mono text-sm">{ret.po_number}</TableCell>
                    <TableCell className="font-medium">{ret.supplier_name || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {ret.return_date ? format(new Date(ret.return_date), 'dd.MM.yyyy') : '-'}
                    </TableCell>
                    <TableCell>{getReasonLabel(ret.return_reason)}</TableCell>
                    <TableCell className="font-semibold">{(ret.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[ret.status]}>{getStatusLabel(ret.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedReturn(ret); setShowDetailModal(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {ret.status === 'draft' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleSubmitReturn(ret)} title={t('submit') || 'Submit'}>
                              <Send className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteReturn(ret)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {ret.status === 'pending_approval' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleApproveReturn(ret)} title={t('approve') || 'Approve'}>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRejectReturn(ret)} title={t('reject') || 'Reject'}>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {ret.status === 'approved' && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedReturn(ret); setShowShipModal(true); }} title={t('ship') || 'Ship'}>
                            <Truck className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {ret.status === 'shipped' && (
                          <Button size="sm" variant="ghost" onClick={() => handleReceiveReturn(ret)} title={t('mark_received') || 'Mark Received'}>
                            <PackageCheck className="w-4 h-4 text-purple-500" />
                          </Button>
                        )}
                        {ret.status === 'received' && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedReturn(ret); setCreditData({ ...creditData, credit_amount: ret.total_amount }); setShowCreditModal(true); }} title={t('apply_credit') || 'Apply Credit'}>
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                          </Button>
                        )}
                        {['draft', 'pending_approval', 'approved'].includes(ret.status) && (
                          <Button size="sm" variant="ghost" onClick={() => handleCancelReturn(ret)} title={t('cancel') || 'Cancel'}>
                            <XCircle className="w-4 h-4 text-slate-500" />
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

      {/* Create Return Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_purchase_return') || 'New Purchase Return'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('select_purchase_order') || 'Select Purchase Order'} *</label>
                <Select value={newReturn.po_id} onValueChange={handleSelectPO}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_po') || 'Select PO'} />
                  </SelectTrigger>
                  <SelectContent>
                    {returnablePOs.length === 0 ? (
                      <SelectItem value="-" disabled>{t('no_returnable_pos') || 'No returnable POs'}</SelectItem>
                    ) : (
                      returnablePOs.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.po_number} - {po.vendor_name || po.supplier_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('return_reason') || 'Return Reason'}</label>
                <Select value={newReturn.return_reason} onValueChange={(v) => setNewReturn({ ...newReturn, return_reason: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defective">{t('defective') || 'Defective'}</SelectItem>
                    <SelectItem value="wrong_item">{t('wrong_item') || 'Wrong Item'}</SelectItem>
                    <SelectItem value="damaged">{t('damaged') || 'Damaged'}</SelectItem>
                    <SelectItem value="quality_issue">{t('quality_issue') || 'Quality Issue'}</SelectItem>
                    <SelectItem value="over_delivery">{t('over_delivery') || 'Over Delivery'}</SelectItem>
                    <SelectItem value="not_as_described">{t('not_as_described') || 'Not as Described'}</SelectItem>
                    <SelectItem value="other">{t('other') || 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            {newReturn.lines.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('items_to_return') || 'Items to Return'}</label>
                <div className="space-y-2">
                  {newReturn.lines.map((line, index) => (
                    <div key={index} className="bg-slate-50 p-3 rounded-lg">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <span className="text-sm font-medium">{line.product_name}</span>
                          <p className="text-xs text-slate-500">{t('original') || 'Original'}: {line.original_quantity} {line.unit} @ {line.unit_price.toLocaleString()}</p>
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-slate-500">{t('return_qty') || 'Return Qty'}</label>
                          <Input
                            type="number"
                            value={line.return_quantity}
                            onChange={(e) => updateLine(index, 'return_quantity', parseFloat(e.target.value) || 0)}
                            max={line.original_quantity}
                            min={0}
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-slate-500">{t('reason') || 'Reason'}</label>
                          <Select value={line.return_reason} onValueChange={(v) => updateLine(index, 'return_reason', v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="defective">{t('defective') || 'Defective'}</SelectItem>
                              <SelectItem value="damaged">{t('damaged') || 'Damaged'}</SelectItem>
                              <SelectItem value="wrong_item">{t('wrong_item') || 'Wrong Item'}</SelectItem>
                              <SelectItem value="quality_issue">{t('quality_issue') || 'Quality Issue'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-xs text-slate-500">{t('subtotal') || 'Subtotal'}</p>
                          <p className="font-medium">{(line.return_quantity * line.unit_price).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-right">
                  <span className="text-sm text-slate-500">{t('total') || 'Total'}: </span>
                  <span className="text-lg font-bold">
                    {newReturn.lines.reduce((sum, l) => sum + (l.return_quantity * l.unit_price), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">{t('notes') || 'Notes'}</label>
              <Textarea
                value={newReturn.notes}
                onChange={(e) => setNewReturn({ ...newReturn, notes: e.target.value })}
                placeholder={t('return_notes') || 'Describe the reason for return in detail...'}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateReturn}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!newReturn.po_id || newReturn.lines.every(l => l.return_quantity === 0)}
              >
                {t('create_return') || 'Create Return'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ship Modal */}
      <Dialog open={showShipModal} onOpenChange={setShowShipModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {t('ship_return') || 'Ship Return'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>{t('return_number') || 'Return #'}:</strong> {selectedReturn?.return_number}</p>
              <p className="text-sm"><strong>{t('supplier') || 'Supplier'}:</strong> {selectedReturn?.supplier_name}</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('carrier') || 'Carrier'} *</label>
              <Input
                value={shipData.carrier}
                onChange={(e) => setShipData({ ...shipData, carrier: e.target.value })}
                placeholder={t('carrier_name') || 'e.g., DHL, FedEx, UPS'}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('tracking_number') || 'Tracking Number'}</label>
              <Input
                value={shipData.tracking_number}
                onChange={(e) => setShipData({ ...shipData, tracking_number: e.target.value })}
                placeholder={t('tracking_number') || 'Tracking number'}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('shipped_date') || 'Shipped Date'}</label>
              <Input
                type="date"
                value={shipData.shipped_date}
                onChange={(e) => setShipData({ ...shipData, shipped_date: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowShipModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleShipReturn}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!shipData.carrier}
              >
                {t('confirm_shipment') || 'Confirm Shipment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credit Note Modal */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {t('apply_credit_note') || 'Apply Credit Note'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>{t('return_number') || 'Return #'}:</strong> {selectedReturn?.return_number}</p>
              <p className="text-sm"><strong>{t('return_amount') || 'Return Amount'}:</strong> {selectedReturn?.total_amount?.toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('credit_note_number') || 'Credit Note Number'} *</label>
              <Input
                value={creditData.credit_note_number}
                onChange={(e) => setCreditData({ ...creditData, credit_note_number: e.target.value })}
                placeholder={t('credit_note_number') || 'e.g., CN-2024-001'}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('credit_amount') || 'Credit Amount'}</label>
              <Input
                type="number"
                value={creditData.credit_amount}
                onChange={(e) => setCreditData({ ...creditData, credit_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('credit_date') || 'Credit Date'}</label>
              <Input
                type="date"
                value={creditData.credit_date}
                onChange={(e) => setCreditData({ ...creditData, credit_date: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreditModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleApplyCredit}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600"
                disabled={!creditData.credit_note_number}
              >
                {t('apply_credit') || 'Apply Credit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('return_details') || 'Return Details'}</DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('return_number') || 'Return Number'}</p>
                  <p className="font-mono font-medium">{selectedReturn.return_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('po_number') || 'PO Number'}</p>
                  <p className="font-mono font-medium">{selectedReturn.po_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('supplier') || 'Supplier'}</p>
                  <p className="font-medium">{selectedReturn.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={statusColors[selectedReturn.status]}>{getStatusLabel(selectedReturn.status)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('return_reason') || 'Return Reason'}</p>
                  <p className="font-medium">{getReasonLabel(selectedReturn.return_reason)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('total_amount') || 'Total Amount'}</p>
                  <p className="font-bold text-lg">{(selectedReturn.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              {selectedReturn.lines && selectedReturn.lines.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">{t('returned_items') || 'Returned Items'}</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {selectedReturn.lines.map((line, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{line.product_name}</span>
                          <span className="text-xs text-slate-500 ml-2">({getReasonLabel(line.return_reason)})</span>
                        </div>
                        <span className="text-slate-600">{line.return_quantity} {line.unit} × {line.unit_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReturn.carrier && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">{t('shipping_info') || 'Shipping Info'}</p>
                  <p className="text-sm text-blue-600">{t('carrier') || 'Carrier'}: {selectedReturn.carrier}</p>
                  {selectedReturn.tracking_number && (
                    <p className="text-sm text-blue-600">{t('tracking') || 'Tracking'}: {selectedReturn.tracking_number}</p>
                  )}
                </div>
              )}

              {selectedReturn.credit_note_number && (
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-emerald-800">{t('credit_note') || 'Credit Note'}</p>
                  <p className="text-sm text-emerald-600">{t('number') || 'Number'}: {selectedReturn.credit_note_number}</p>
                  <p className="text-sm text-emerald-600">{t('amount') || 'Amount'}: {selectedReturn.credit_amount?.toLocaleString()}</p>
                </div>
              )}

              {selectedReturn.rejection_reason && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-red-600"><strong>{t('rejection_reason') || 'Rejection Reason'}:</strong> {selectedReturn.rejection_reason}</p>
                </div>
              )}

              {selectedReturn.notes && (
                <div>
                  <p className="text-sm text-slate-500">{t('notes') || 'Notes'}</p>
                  <p className="text-sm">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
