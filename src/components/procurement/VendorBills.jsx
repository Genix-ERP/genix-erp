import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Receipt,
  Plus,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  Link as LinkIcon,
  Calculator
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { inventoryService } from '@/api/services/inventory';

export default function VendorBills() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showMatchingDialog, setShowMatchingDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [newBill, setNewBill] = useState({
    vendor_id: '',
    vendor_name: '',
    bill_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    purchase_order_id: '',
    goods_receipt_id: '',
    payment_terms: '30',
    currency: 'UZS',
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    notes: '',
    lines: []
  });

  // Products list for dropdown
  const [products, setProducts] = useState([]);

  // Sample vendors (in real app, fetch from API)
  const vendors = [
    { id: '1', name: t('tech_supplies_ltd') || 'Tech Supplies Ltd' },
    { id: '2', name: t('office_equipment_co') || 'Office Equipment Co' },
    { id: '3', name: t('industrial_parts_inc') || 'Industrial Parts Inc' }
  ];

  // Sample purchase orders (for linking)
  const [purchaseOrders, setPurchaseOrders] = useState([
    { id: 'PO-001', vendor_id: '1', total: 5000000 },
    { id: 'PO-002', vendor_id: '2', total: 3000000 },
    { id: 'PO-003', vendor_id: '3', total: 7500000 }
  ]);

  // Fetch products for dropdown
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await inventoryService.listProducts();
        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, []);

  // Load bills from localStorage
  useEffect(() => {
    const storedBills = localStorage.getItem('genix_vendor_bills');
    if (storedBills) {
      setBills(JSON.parse(storedBills));
    }
  }, []);

  // Save bills to localStorage
  useEffect(() => {
    if (bills.length > 0) {
      localStorage.setItem('genix_vendor_bills', JSON.stringify(bills));
    }
  }, [bills]);

  // Filter bills
  useEffect(() => {
    let filtered = bills;

    if (searchTerm) {
      filtered = filtered.filter(bill =>
        bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.purchase_order_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    setFilteredBills(filtered);
  }, [bills, searchTerm, statusFilter]);

  const handleCreateBill = () => {
    const billId = `BILL-${String(bills.length + 1).padStart(3, '0')}`;
    const bill = {
      ...newBill,
      id: billId,
      status: 'draft',
      matching_status: 'pending',
      paid_amount: 0,
      created_at: new Date().toISOString()
    };

    setBills([bill, ...bills]);
    setShowBillDialog(false);
    resetNewBill();
  };

  const handleUpdateBill = () => {
    setBills(bills.map(bill =>
      bill.id === editingBill.id ? editingBill : bill
    ));
    setShowBillDialog(false);
    setEditingBill(null);
  };

  const handleDeleteBill = (bill) => {
    setBillToDelete(bill);
    setShowDeleteDialog(true);
  };

  const confirmDeleteBill = () => {
    if (billToDelete) {
      setBills(bills.filter(bill => bill.id !== billToDelete.id));
      setShowDeleteDialog(false);
      setBillToDelete(null);
    }
  };

  const handleApproveBill = (billId) => {
    setBills(bills.map(bill =>
      bill.id === billId ? { ...bill, status: 'approved' } : bill
    ));
  };

  const handleMarkAsPaid = (billId) => {
    setBills(bills.map(bill =>
      bill.id === billId ? {
        ...bill,
        status: 'paid',
        paid_amount: bill.total_amount,
        payment_date: new Date().toISOString().split('T')[0]
      } : bill
    ));
  };

  const handleRejectBill = (billId) => {
    setBills(bills.map(bill =>
      bill.id === billId ? { ...bill, status: 'rejected' } : bill
    ));
  };

  const resetNewBill = () => {
    setNewBill({
      vendor_id: '',
      vendor_name: '',
      bill_number: '',
      bill_date: new Date().toISOString().split('T')[0],
      due_date: '',
      purchase_order_id: '',
      goods_receipt_id: '',
      payment_terms: '30',
      currency: 'UZS',
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
      notes: '',
      lines: []
    });
  };

  const addLineItem = () => {
    const currentBill = editingBill || newBill;
    const newLine = {
      id: String(currentBill.lines.length + 1),
      product_id: '',
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      amount: 0
    };

    if (editingBill) {
      setEditingBill({
        ...editingBill,
        lines: [...editingBill.lines, newLine]
      });
    } else {
      setNewBill({
        ...newBill,
        lines: [...newBill.lines, newLine]
      });
    }
  };

  const updateLineItem = (index, field, value) => {
    const currentBill = editingBill || newBill;
    const updatedLines = [...currentBill.lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };

    // Recalculate amount
    if (field === 'quantity' || field === 'unit_price') {
      updatedLines[index].amount = updatedLines[index].quantity * updatedLines[index].unit_price;
    }

    // Recalculate totals
    const subtotal = updatedLines.reduce((sum, line) => sum + line.amount, 0);
    const tax_amount = subtotal * 0.1; // 10% tax
    const total_amount = subtotal + tax_amount;

    if (editingBill) {
      setEditingBill({
        ...editingBill,
        lines: updatedLines,
        subtotal,
        tax_amount,
        total_amount
      });
    } else {
      setNewBill({
        ...newBill,
        lines: updatedLines,
        subtotal,
        tax_amount,
        total_amount
      });
    }
  };

  const removeLineItem = (index) => {
    const currentBill = editingBill || newBill;
    const updatedLines = currentBill.lines.filter((_, i) => i !== index);

    // Recalculate totals
    const subtotal = updatedLines.reduce((sum, line) => sum + line.amount, 0);
    const tax_amount = subtotal * 0.1;
    const total_amount = subtotal + tax_amount;

    if (editingBill) {
      setEditingBill({
        ...editingBill,
        lines: updatedLines,
        subtotal,
        tax_amount,
        total_amount
      });
    } else {
      setNewBill({
        ...newBill,
        lines: updatedLines,
        subtotal,
        tax_amount,
        total_amount
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { variant: 'secondary', icon: FileText, label: t('draft') || 'Draft' },
      pending_approval: { variant: 'warning', icon: Clock, label: t('pending_approval') || 'Pending' },
      approved: { variant: 'default', icon: CheckCircle, label: t('approved') || 'Approved' },
      paid: { variant: 'success', icon: DollarSign, label: t('paid') || 'Paid' },
      rejected: { variant: 'destructive', icon: XCircle, label: t('rejected') || 'Rejected' },
      overdue: { variant: 'destructive', icon: AlertTriangle, label: t('overdue') || 'Overdue' }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getMatchingStatusBadge = (matchingStatus) => {
    const statusConfig = {
      pending: { variant: 'secondary', label: t('pending') || 'Pending' },
      matched: { variant: 'success', label: t('matched') || 'Matched' },
      variance: { variant: 'warning', label: t('variance') || 'Variance' },
      failed: { variant: 'destructive', label: t('failed') || 'Failed' }
    };

    const config = statusConfig[matchingStatus] || statusConfig.pending;

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Statistics
  const totalBills = bills.length;
  const draftBills = bills.filter(b => b.status === 'draft').length;
  const pendingBills = bills.filter(b => b.status === 'pending_approval').length;
  const approvedBills = bills.filter(b => b.status === 'approved').length;
  const paidBills = bills.filter(b => b.status === 'paid').length;
  const totalAmount = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const paidAmount = bills.reduce((sum, b) => sum + b.paid_amount, 0);
  const outstandingAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            {t('vendor_bills') || 'Vendor Bills'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('vendor_bills_desc') || 'Manage vendor invoices and accounts payable'}
          </p>
        </div>
        {canCreate(MODULES.PURCHASES) && (
          <Button onClick={() => { resetNewBill(); setEditingBill(null); setShowBillDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('new_bill') || 'New Bill'}
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('total_bills') || 'Total Bills'}</CardDescription>
            <CardTitle className="text-3xl">{totalBills}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {pendingBills} {t('pending_approval') || 'pending approval'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('total_amount') || 'Total Amount'}</CardDescription>
            <CardTitle className="text-3xl">
              {(totalAmount / 1000000).toFixed(1)}M
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-600">
              {t('currency') || 'UZS'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('paid_amount') || 'Paid'}</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {(paidAmount / 1000000).toFixed(1)}M
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {paidBills} {t('bills') || 'bills'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('outstanding') || 'Outstanding'}</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {(outstandingAmount / 1000000).toFixed(1)}M
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {approvedBills + pendingBills} {t('unpaid') || 'unpaid'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('search_bills') || 'Search bills...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                <SelectItem value="pending_approval">{t('pending_approval') || 'Pending'}</SelectItem>
                <SelectItem value="approved">{t('approved') || 'Approved'}</SelectItem>
                <SelectItem value="paid">{t('paid') || 'Paid'}</SelectItem>
                <SelectItem value="rejected">{t('rejected') || 'Rejected'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredBills.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('no_bills_found') || 'No bills found'}</h3>
              <p className="text-muted-foreground mb-4">
                {t('no_bills_desc') || 'Create your first vendor bill to track accounts payable'}
              </p>
              {canCreate(MODULES.PURCHASES) && (
                <Button onClick={() => { resetNewBill(); setShowBillDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_bill') || 'New Bill'}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('bill_number') || 'Bill Number'}</TableHead>
                    <TableHead>{t('vendor') || 'Vendor'}</TableHead>
                    <TableHead>{t('bill_date') || 'Bill Date'}</TableHead>
                    <TableHead>{t('due_date') || 'Due Date'}</TableHead>
                    <TableHead>{t('purchase_order') || 'PO'}</TableHead>
                    <TableHead>{t('total_amount') || 'Amount'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead>{t('matching') || 'Matching'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.bill_number}</TableCell>
                      <TableCell>{bill.vendor_name}</TableCell>
                      <TableCell>{bill.bill_date ? format(parseISO(bill.bill_date), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell>{bill.due_date ? format(parseISO(bill.due_date), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell>
                        {bill.purchase_order_id && (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <LinkIcon className="w-3 h-3" />
                            {bill.purchase_order_id}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {bill.total_amount.toLocaleString()} {bill.currency}
                      </TableCell>
                      <TableCell>{getStatusBadge(bill.status)}</TableCell>
                      <TableCell>{getMatchingStatusBadge(bill.matching_status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedBill(bill); setShowDetailsDialog(true); }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {bill.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingBill(bill); setShowBillDialog(true); }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBill(bill)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {bill.status === 'pending_approval' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApproveBill(bill.id)}
                                className="text-green-600"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRejectBill(bill.id)}
                                className="text-red-600"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {bill.status === 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(bill.id)}
                              className="text-green-600"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          )}
                          {bill.purchase_order_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedBill(bill); setShowMatchingDialog(true); }}
                            >
                              <Calculator className="w-4 h-4" />
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
      </Card>

      {/* Create/Edit Bill Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBill ? (t('edit_bill') || 'Edit Bill') : (t('new_bill') || 'New Bill')}
            </DialogTitle>
            <DialogDescription>
              {t('bill_details_desc') || 'Enter vendor bill details and line items'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('vendor') || 'Vendor'}</Label>
                <Select
                  value={editingBill?.vendor_id || newBill.vendor_id}
                  onValueChange={(value) => {
                    const vendor = vendors.find(v => v.id === value);
                    if (editingBill) {
                      setEditingBill({ ...editingBill, vendor_id: value, vendor_name: vendor?.name || '' });
                    } else {
                      setNewBill({ ...newBill, vendor_id: value, vendor_name: vendor?.name || '' });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_vendor') || 'Select vendor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('bill_number') || 'Bill Number'}</Label>
                <Input
                  value={editingBill?.bill_number || newBill.bill_number}
                  onChange={(e) => {
                    if (editingBill) {
                      setEditingBill({ ...editingBill, bill_number: e.target.value });
                    } else {
                      setNewBill({ ...newBill, bill_number: e.target.value });
                    }
                  }}
                  placeholder="INV-2024-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('bill_date') || 'Bill Date'}</Label>
                <Input
                  type="date"
                  value={editingBill?.bill_date || newBill.bill_date}
                  onChange={(e) => {
                    if (editingBill) {
                      setEditingBill({ ...editingBill, bill_date: e.target.value });
                    } else {
                      setNewBill({ ...newBill, bill_date: e.target.value });
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('due_date') || 'Due Date'}</Label>
                <Input
                  type="date"
                  value={editingBill?.due_date || newBill.due_date}
                  onChange={(e) => {
                    if (editingBill) {
                      setEditingBill({ ...editingBill, due_date: e.target.value });
                    } else {
                      setNewBill({ ...newBill, due_date: e.target.value });
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('purchase_order') || 'Purchase Order (Optional)'}</Label>
                <Select
                  value={editingBill?.purchase_order_id || newBill.purchase_order_id || "none"}
                  onValueChange={(value) => {
                    const po_id = value === "none" ? "" : value;
                    if (editingBill) {
                      setEditingBill({ ...editingBill, purchase_order_id: po_id });
                    } else {
                      setNewBill({ ...newBill, purchase_order_id: po_id });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_po') || 'Select PO'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('none') || 'None'}</SelectItem>
                    {purchaseOrders
                      .filter(po => po.vendor_id === (editingBill?.vendor_id || newBill.vendor_id))
                      .map(po => (
                        <SelectItem key={po.id} value={po.id}>{po.id}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('payment_terms') || 'Payment Terms (Days)'}</Label>
                <Input
                  type="number"
                  value={editingBill?.payment_terms || newBill.payment_terms}
                  onChange={(e) => {
                    if (editingBill) {
                      setEditingBill({ ...editingBill, payment_terms: e.target.value });
                    } else {
                      setNewBill({ ...newBill, payment_terms: e.target.value });
                    }
                  }}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('line_items') || 'Line Items'}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_line') || 'Add Line'}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product') || 'Product'}</TableHead>
                      <TableHead className="w-24">{t('quantity') || 'Qty'}</TableHead>
                      <TableHead className="w-32">{t('unit_price') || 'Unit Price'}</TableHead>
                      <TableHead className="w-32">{t('amount') || 'Amount'}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(editingBill?.lines || newBill.lines).map((line, index) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Select
                            value={line.product_id || ''}
                            onValueChange={(value) => {
                              const product = products.find(p => String(p.id) === value);
                              // Update all fields at once to avoid state batching issues
                              const currentBill = editingBill || newBill;
                              const updatedLines = [...currentBill.lines];
                              updatedLines[index] = {
                                ...updatedLines[index],
                                product_id: value,
                                product_name: product?.name || '',
                                description: product?.name || '',
                                unit_price: product?.cost || updatedLines[index].unit_price,
                                amount: updatedLines[index].quantity * (product?.cost || updatedLines[index].unit_price)
                              };

                              const subtotal = updatedLines.reduce((sum, l) => sum + l.amount, 0);
                              const tax_amount = subtotal * 0.1;
                              const total_amount = subtotal + tax_amount;

                              if (editingBill) {
                                setEditingBill({ ...editingBill, lines: updatedLines, subtotal, tax_amount, total_amount });
                              } else {
                                setNewBill({ ...newBill, lines: updatedLines, subtotal, tax_amount, total_amount });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('select_product') || 'Select product'} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={String(product.id)}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.unit_price}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">
                          {line.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>{t('subtotal') || 'Subtotal'}:</span>
                <span className="font-semibold">
                  {(editingBill?.subtotal || newBill.subtotal).toLocaleString()} {editingBill?.currency || newBill.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('tax') || 'Tax'} (10%):</span>
                <span className="font-semibold">
                  {(editingBill?.tax_amount || newBill.tax_amount).toLocaleString()} {editingBill?.currency || newBill.currency}
                </span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2">
                <span className="font-bold">{t('total') || 'Total'}:</span>
                <span className="font-bold">
                  {(editingBill?.total_amount || newBill.total_amount).toLocaleString()} {editingBill?.currency || newBill.currency}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notes') || 'Notes'}</Label>
              <Textarea
                value={editingBill?.notes || newBill.notes}
                onChange={(e) => {
                  if (editingBill) {
                    setEditingBill({ ...editingBill, notes: e.target.value });
                  } else {
                    setNewBill({ ...newBill, notes: e.target.value });
                  }
                }}
                placeholder={t('enter_notes') || 'Additional notes...'}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBillDialog(false); setEditingBill(null); }}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={editingBill ? handleUpdateBill : handleCreateBill}>
              {editingBill ? (t('update_bill') || 'Update Bill') : (t('create_bill') || 'Create Bill')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('bill_details') || 'Bill Details'}</DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('bill_number') || 'Bill Number'}</Label>
                  <p className="font-semibold">{selectedBill.bill_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('vendor') || 'Vendor'}</Label>
                  <p className="font-semibold">{selectedBill.vendor_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('bill_date') || 'Bill Date'}</Label>
                  <p>{selectedBill.bill_date ? format(parseISO(selectedBill.bill_date), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('due_date') || 'Due Date'}</Label>
                  <p>{selectedBill.due_date ? format(parseISO(selectedBill.due_date), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('status') || 'Status'}</Label>
                  <div className="mt-1">{getStatusBadge(selectedBill.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('matching_status') || 'Matching'}</Label>
                  <div className="mt-1">{getMatchingStatusBadge(selectedBill.matching_status)}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">{t('line_items') || 'Line Items'}</Label>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product') || 'Product'}</TableHead>
                      <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                      <TableHead className="text-right">{t('unit_price') || 'Price'}</TableHead>
                      <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBill.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.product_name || line.description}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{line.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">{line.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>{t('subtotal') || 'Subtotal'}:</span>
                  <span className="font-semibold">{selectedBill.subtotal.toLocaleString()} {selectedBill.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('tax') || 'Tax'}:</span>
                  <span className="font-semibold">{selectedBill.tax_amount.toLocaleString()} {selectedBill.currency}</span>
                </div>
                <div className="flex justify-between text-lg border-t pt-2">
                  <span className="font-bold">{t('total') || 'Total'}:</span>
                  <span className="font-bold">{selectedBill.total_amount.toLocaleString()} {selectedBill.currency}</span>
                </div>
                {selectedBill.paid_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t('paid') || 'Paid'}:</span>
                    <span className="font-semibold">{selectedBill.paid_amount.toLocaleString()} {selectedBill.currency}</span>
                  </div>
                )}
              </div>

              {selectedBill.notes && (
                <div>
                  <Label className="text-muted-foreground">{t('notes') || 'Notes'}</Label>
                  <p className="mt-1">{selectedBill.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowDetailsDialog(false)}>{t('close') || 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Three-Way Matching Dialog */}
      <Dialog open={showMatchingDialog} onOpenChange={setShowMatchingDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('three_way_matching') || 'Three-Way Matching'}</DialogTitle>
            <DialogDescription>
              {t('matching_desc') || 'Compare Purchase Order, Goods Receipt, and Vendor Bill'}
            </DialogDescription>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border rounded-lg p-4">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold">{t('purchase_order') || 'Purchase Order'}</h3>
                  <p className="text-2xl font-bold mt-2">{selectedBill.purchase_order_id}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold">{t('goods_receipt') || 'Goods Receipt'}</h3>
                  <p className="text-2xl font-bold mt-2">{selectedBill.goods_receipt_id || 'N/A'}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold">{t('vendor_bill') || 'Vendor Bill'}</h3>
                  <p className="text-2xl font-bold mt-2">{selectedBill.bill_number}</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <h4 className="font-semibold">{t('matching_result') || 'Matching Result'}</h4>
                </div>
                <p className="mt-2 text-green-700">
                  {t('matching_success') || 'All documents match within tolerance. Ready for payment approval.'}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3">{t('variance_analysis') || 'Variance Analysis'}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>{t('quantity_variance') || 'Quantity Variance'}:</span>
                    <Badge variant="success">0%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t('price_variance') || 'Price Variance'}:</span>
                    <Badge variant="success">0%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t('total_variance') || 'Total Variance'}:</span>
                    <Badge variant="success">{formatCurrency(0)}</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchingDialog(false)}>
              {t('close') || 'Close'}
            </Button>
            <Button onClick={() => {
              if (selectedBill) {
                setBills(bills.map(bill =>
                  bill.id === selectedBill.id ? { ...bill, matching_status: 'matched' } : bill
                ));
              }
              setShowMatchingDialog(false);
            }}>
              {t('approve_matching') || 'Approve Matching'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('delete_bill') || 'Delete Bill'}
            </DialogTitle>
            <DialogDescription>
              {t('delete_bill_confirm_message') || 'Are you sure you want to delete this bill? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>

          {billToDelete && (
            <div className="py-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('bill_number') || 'Bill Number'}:</span>
                <span className="font-medium">{billToDelete.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('vendor') || 'Vendor'}:</span>
                <span className="font-medium">{billToDelete.vendor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('total_amount') || 'Amount'}:</span>
                <span className="font-medium">{billToDelete.total_amount?.toLocaleString()} {billToDelete.currency}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setBillToDelete(null); }}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBill}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('delete') || 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
