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
  FileText,
  CheckCircle,
  XCircle,
  Send,
  ArrowRight,
  Trash2,
  Eye,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useProcurement } from '@/components/contexts/ProcurementContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService } from "@/api/services/inventory";

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  converted: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-slate-100 text-slate-800',
};

export default function PurchaseRequisitions() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { suppliers } = useProcurement();
  const { canCreate } = usePermissions();

  const [requisitions, setRequisitions] = useState([]);
  const [filteredRequisitions, setFilteredRequisitions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newPR, setNewPR] = useState({
    requested_by: '',
    department: '',
    required_date: '',
    priority: 'medium',
    purpose: '',
    notes: '',
    lines: [{ product_id: '', product_name: '', quantity: 1, unit: 'dona', estimated_price: 0 }],
  });

  const [convertData, setConvertData] = useState({
    supplier_id: '',
    payment_terms: 'net_30',
  });

  // Products state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Fetch products from backend
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('demo_purchase_requisitions');
    if (stored) {
      setRequisitions(JSON.parse(stored));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('demo_purchase_requisitions', JSON.stringify(requisitions));
  }, [requisitions]);

  // Filter requisitions
  useEffect(() => {
    let filtered = requisitions;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(pr => pr.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(pr =>
        pr.pr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.requested_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.department?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredRequisitions(filtered);
  }, [requisitions, searchQuery, statusFilter]);

  const handleCreatePR = () => {
    if (!newPR.requested_by) return;

    const totalAmount = newPR.lines.reduce((sum, line) => sum + (line.quantity * line.estimated_price), 0);

    const pr = {
      id: Date.now().toString(),
      pr_number: `PR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(requisitions.length + 1).padStart(4, '0')}`,
      ...newPR,
      request_date: new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    setRequisitions(prev => [pr, ...prev]);
    setShowCreateModal(false);
    setNewPR({
      requested_by: '',
      department: '',
      required_date: '',
      priority: 'medium',
      purpose: '',
      notes: '',
      lines: [{ product_id: '', product_name: '', quantity: 1, unit: 'dona', estimated_price: 0 }],
    });
  };

  const handleSubmitPR = (pr) => {
    setRequisitions(prev => prev.map(p =>
      p.id === pr.id ? { ...p, status: 'pending_approval' } : p
    ));
  };

  const handleApprovePR = (pr) => {
    setRequisitions(prev => prev.map(p =>
      p.id === pr.id ? { ...p, status: 'approved', approved_at: new Date().toISOString() } : p
    ));
  };

  const handleRejectPR = (pr) => {
    const reason = prompt(t('enter_rejection_reason') || 'Enter rejection reason:');
    if (reason) {
      setRequisitions(prev => prev.map(p =>
        p.id === pr.id ? { ...p, status: 'rejected', rejection_reason: reason } : p
      ));
    }
  };

  const handleConvertToPO = () => {
    if (!convertData.supplier_id || !selectedPR) return;

    const supplier = suppliers.find(s => s.id === convertData.supplier_id);

    // Create PO from PR
    const poNumber = '';

    const newPO = {
      id: Date.now().toString(),
      po_number: poNumber,
      supplier_id: convertData.supplier_id,
      vendor_name: supplier?.name || '',
      supplier_name: supplier?.name || '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: selectedPR.required_date,
      total_amount: selectedPR.total_amount,
      payment_terms: convertData.payment_terms,
      status: 'draft',
      created_at: new Date().toISOString(),
      from_pr: selectedPR.pr_number,
    };

    // Save to PO localStorage
    const existingPOs = JSON.parse(localStorage.getItem('demo_purchase_orders') || '[]');
    localStorage.setItem('demo_purchase_orders', JSON.stringify([newPO, ...existingPOs]));

    // Update PR status
    setRequisitions(prev => prev.map(p =>
      p.id === selectedPR.id ? { ...p, status: 'converted', converted_to_po: poNumber } : p
    ));

    setShowConvertModal(false);
    setConvertData({ supplier_id: '', payment_terms: 'net_30' });
    setSelectedPR(null);
  };

  const handleDeletePR = (pr) => {
    if (confirm(t('confirm_delete_requisition') || 'Are you sure you want to delete this requisition?')) {
      setRequisitions(prev => prev.filter(p => p.id !== pr.id));
    }
  };

  const addLine = () => {
    setNewPR(prev => ({
      ...prev,
      lines: [...prev.lines, { product_id: '', product_name: '', quantity: 1, unit: 'dona', estimated_price: 0 }],
    }));
  };

  const removeLine = (index) => {
    if (newPR.lines.length > 1) {
      setNewPR(prev => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index),
      }));
    }
  };

  const updateLine = (index, field, value) => {
    setNewPR(prev => ({
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
      converted: t('converted_to_po') || 'Converted to PO',
      cancelled: t('cancelled') || 'Cancelled',
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      low: t('low') || 'Low',
      medium: t('medium') || 'Medium',
      high: t('high') || 'High',
      urgent: t('urgent') || 'Urgent',
    };
    return labels[priority] || priority;
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('purchase_requisitions') || 'Purchase Requisitions'}
          </CardTitle>
          {canCreate(MODULES.PURCHASES) && (
            <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> {t('new_requisition') || 'New Requisition'}
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
              <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
              <SelectItem value="pending_approval">{t('pending_approval') || 'Pending'}</SelectItem>
              <SelectItem value="approved">{t('approved') || 'Approved'}</SelectItem>
              <SelectItem value="rejected">{t('rejected') || 'Rejected'}</SelectItem>
              <SelectItem value="converted">{t('converted') || 'Converted'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredRequisitions.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_requisitions_yet') || 'No requisitions yet'}</p>
            {canCreate(MODULES.PURCHASES) && (
              <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                {t('create_first_requisition') || 'Create First Requisition'}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('pr_number') || 'PR #'}</TableHead>
                  <TableHead>{t('requested_by') || 'Requested By'}</TableHead>
                  <TableHead>{t('department') || 'Department'}</TableHead>
                  <TableHead>{t('request_date') || 'Request Date'}</TableHead>
                  <TableHead>{t('required_date') || 'Required Date'}</TableHead>
                  <TableHead>{t('priority') || 'Priority'}</TableHead>
                  <TableHead>{t('amount') || 'Amount'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequisitions.map((pr) => (
                  <TableRow key={pr.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-sm">{pr.pr_number}</TableCell>
                    <TableCell className="font-medium">{pr.requested_by}</TableCell>
                    <TableCell>{pr.department || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {pr.request_date ? format(new Date(pr.request_date), 'dd.MM.yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pr.required_date ? format(new Date(pr.required_date), 'dd.MM.yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[pr.priority]}>{getPriorityLabel(pr.priority)}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{(pr.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[pr.status]}>{getStatusLabel(pr.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedPR(pr); setShowDetailModal(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {pr.status === 'draft' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleSubmitPR(pr)} title={t('submit') || 'Submit'}>
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeletePR(pr)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {pr.status === 'pending_approval' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleApprovePR(pr)} title={t('approve') || 'Approve'}>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRejectPR(pr)} title={t('reject') || 'Reject'}>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {pr.status === 'approved' && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedPR(pr); setShowConvertModal(true); }} title={t('convert_to_po') || 'Convert to PO'}>
                            <ArrowRight className="w-4 h-4 text-purple-500" />
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

      {/* Create PR Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_purchase_requisition') || 'New Purchase Requisition'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('requested_by') || 'Requested By'} *</label>
                <Input
                  value={newPR.requested_by}
                  onChange={(e) => setNewPR({ ...newPR, requested_by: e.target.value })}
                  placeholder={t('your_name') || 'Your name'}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('department') || 'Department'}</label>
                <Input
                  value={newPR.department}
                  onChange={(e) => setNewPR({ ...newPR, department: e.target.value })}
                  placeholder={t('department_name') || 'Department name'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('required_date') || 'Required Date'}</label>
                <Input
                  type="date"
                  value={newPR.required_date}
                  onChange={(e) => setNewPR({ ...newPR, required_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('priority') || 'Priority'}</label>
                <Select value={newPR.priority} onValueChange={(v) => setNewPR({ ...newPR, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('low') || 'Low'}</SelectItem>
                    <SelectItem value="medium">{t('medium') || 'Medium'}</SelectItem>
                    <SelectItem value="high">{t('high') || 'High'}</SelectItem>
                    <SelectItem value="urgent">{t('urgent') || 'Urgent'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('purpose') || 'Purpose'}</label>
              <Textarea
                value={newPR.purpose}
                onChange={(e) => setNewPR({ ...newPR, purpose: e.target.value })}
                placeholder={t('describe_purpose') || 'Describe the purpose of this requisition...'}
                rows={2}
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">{t('items') || 'Items'}</label>
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" /> {t('add_item') || 'Add Item'}
                </Button>
              </div>
              <div className="space-y-2">
                {newPR.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded">
                    <div className="col-span-4">
                      <Select
                        value={line.product_id}
                        onValueChange={(value) => {
                          const selectedProd = products.find(p => p.id === value);
                          updateLine(index, 'product_id', value);
                          updateLine(index, 'product_name', selectedProd?.name || '');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_product') || 'Mahsulotni tanlang'} />
                        </SelectTrigger>
                        <SelectContent>
                          {productsLoading ? (
                            <SelectItem value="__loading__" disabled>
                              {t('loading') || 'Yuklanmoqda...'}
                            </SelectItem>
                          ) : (
                            products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder={t('qty') || 'Qty'}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Select value={line.unit} onValueChange={(v) => updateLine(index, 'unit', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dona">{t('pieces') || 'dona'}</SelectItem>
                          <SelectItem value="kg">{t('kg') || 'kg'}</SelectItem>
                          <SelectItem value="litr">{t('liters') || 'litr'}</SelectItem>
                          <SelectItem value="metr">{t('meters') || 'metr'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder={t('est_price') || 'Est. price'}
                        value={line.estimated_price}
                        onChange={(e) => updateLine(index, 'estimated_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button size="sm" variant="ghost" onClick={() => removeLine(index)} disabled={newPR.lines.length === 1}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreatePR}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!newPR.requested_by || newPR.lines.every(l => !l.product_id)}
              >
                {t('create') || 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('requisition_details') || 'Requisition Details'}</DialogTitle>
          </DialogHeader>
          {selectedPR && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('pr_number') || 'PR Number'}</p>
                  <p className="font-mono font-medium">{selectedPR.pr_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={statusColors[selectedPR.status]}>{getStatusLabel(selectedPR.status)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('requested_by') || 'Requested By'}</p>
                  <p className="font-medium">{selectedPR.requested_by}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('department') || 'Department'}</p>
                  <p className="font-medium">{selectedPR.department || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('priority') || 'Priority'}</p>
                  <Badge className={priorityColors[selectedPR.priority]}>{getPriorityLabel(selectedPR.priority)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('total_amount') || 'Total Amount'}</p>
                  <p className="font-bold text-lg">{(selectedPR.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              {selectedPR.purpose && (
                <div>
                  <p className="text-sm text-slate-500">{t('purpose') || 'Purpose'}</p>
                  <p className="text-sm">{selectedPR.purpose}</p>
                </div>
              )}

              {selectedPR.lines && selectedPR.lines.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">{t('items') || 'Items'}</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {selectedPR.lines.map((line, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>{line.product_name}</span>
                        <span className="text-slate-600">{line.quantity} {line.unit} × {line.estimated_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPR.converted_to_po && (
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-sm text-purple-600">{t('converted_to') || 'Converted to'}: <span className="font-mono font-medium">{selectedPR.converted_to_po}</span></p>
                </div>
              )}

              {selectedPR.rejection_reason && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-red-600">{t('rejection_reason') || 'Rejection reason'}: {selectedPR.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to PO Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('convert_to_purchase_order') || 'Convert to Purchase Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t('select_supplier') || 'Select Supplier'} *</label>
              <Select value={convertData.supplier_id} onValueChange={(v) => setConvertData({ ...convertData, supplier_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_supplier') || 'Select supplier'} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.filter(s => s.is_active !== false && s.status !== 'inactive').map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('payment_terms') || 'Payment Terms'}</label>
              <Select value={convertData.payment_terms} onValueChange={(v) => setConvertData({ ...convertData, payment_terms: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepaid">{t('prepaid') || 'Prepaid'}</SelectItem>
                  <SelectItem value="net_30">Net 30</SelectItem>
                  <SelectItem value="net_60">Net 60</SelectItem>
                  <SelectItem value="net_90">Net 90</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowConvertModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleConvertToPO}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!convertData.supplier_id}
              >
                {t('convert') || 'Convert'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
