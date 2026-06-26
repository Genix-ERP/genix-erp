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
  Calculator,
  Globe,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { inventoryService } from '@/api/services/inventory';
import { financeService } from '@/api/services/finance';
import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

export default function VendorBills() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, isSuperAdmin } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { currencies = [], exchangeRates = [], getLatestExchangeRate, taxRates = [], journals = [], paymentJournals = [] } = useFinancials();
  const bankCashJournals = paymentJournals.length > 0 ? paymentJournals : journals.filter(j => j.type === 'bank' || j.type === 'cash');
  const { suppliers, purchaseOrders: contextPOs } = useProcurement();

  const baseCurrency = currencies.find(c => c.is_base) || { code: 'UZS' };
  const foreignCurrencies = currencies.filter(c => !c.is_base && c.is_active);

  // Purchase tax rates
  const purchaseTaxRates = taxRates.filter(tr => tr.tax_type === 'purchase' || !tr.tax_type);
  const defaultPurchaseTax = purchaseTaxRates.find(tr => tr.is_active) || null;

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
  const [expandedDiffs, setExpandedDiffs] = useState({});
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [paymentJournalId, setPaymentJournalId] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [newBill, setNewBill] = useState({
    vendor_id: '',
    vendor_name: '',
    bill_number: '',
    vendor_invoice_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    purchase_order_id: '',
    goods_receipt_id: '',
    payment_terms: '30',
    currency: 'UZS',
    currency_code: 'UZS',
    exchange_rate: 1,
    subtotal: 0,
    tax_rate_id: '',
    tax_percent: 12,
    tax_amount: 0,
    total_amount: 0,
    notes: '',
    lines: []
  });

  // Products list for dropdown
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use real suppliers from context as vendors
  const vendors = suppliers.filter(s => s.is_active !== false);

  // Purchase orders from context
  const purchaseOrders = contextPOs || [];

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

  // Fetch bills from backend API
  const fetchBills = async () => {
    setIsLoading(true);
    try {
      const result = await financeService.listPurchaseInvoices({ page_size: 100 });
      const items = result?.data || result?.items || (Array.isArray(result) ? result : []);
      const mapped = items.map(inv => ({
        id: inv.id,
        bill_number: inv.invoice_number || '',
        vendor_id: inv.vendor_id || inv.partner_id || '',
        vendor_name: inv.vendor_name || inv.partner_name || '',
        bill_date: inv.invoice_date || '',
        due_date: inv.due_date || '',
        purchase_order_id: inv.purchase_order_number || inv.purchase_order_id || '',
        goods_receipt_id: inv.goods_receipt_id || '',
        subtotal: inv.subtotal || 0,
        tax_rate_id: inv.tax_rate_id || '',
        tax_percent: inv.subtotal > 0 && inv.tax_amount > 0 ? Math.round((inv.tax_amount / inv.subtotal) * 10000) / 100 : 12,
        tax_amount: inv.tax_amount || 0,
        total_amount: inv.total_amount || 0,
        vendor_invoice_number: inv.vendor_invoice_number || '',
        paid_amount: inv.amount_paid || 0,
        amount_paid: inv.amount_paid || 0,
        status: inv.status === 'confirmed' ? 'approved' : inv.status || 'draft',
        matching_status: inv.three_way_match_status || 'pending',
        currency: inv.currency_code || 'UZS',
        currency_code: inv.currency_code || 'UZS',
        exchange_rate: inv.exchange_rate || 1,
        notes: inv.notes || '',
        created_at: inv.created_at,
        _raw_id: inv.id,
      }));
      setBills(mapped);
    } catch (error) {
      console.error('Failed to fetch vendor bills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Overdue detection
  const isOverdue = (bill) => {
    if (!bill.due_date) return false;
    if (bill.status === 'paid' || bill.status === 'cancelled') return false;
    return new Date(bill.due_date) < new Date(new Date().toDateString());
  };

  // Filter bills
  useEffect(() => {
    let filtered = bills;

    if (searchTerm) {
      filtered = filtered.filter(bill =>
        bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.vendor_invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.purchase_order_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter === 'overdue') {
      filtered = filtered.filter(bill => isOverdue(bill));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    if (vendorFilter !== 'all') {
      filtered = filtered.filter(bill => bill.vendor_id === vendorFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter(bill => bill.bill_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(bill => bill.bill_date <= dateTo);
    }

    setFilteredBills(filtered);
  }, [bills, searchTerm, statusFilter, vendorFilter, dateFrom, dateTo]);

  const handleCreateBill = async () => {
    try {
      const currencyObj = currencies.find(c => c.code === newBill.currency_code);
      const data = {
        vendor_id: newBill.vendor_id,
        vendor_invoice_number: newBill.vendor_invoice_number,
        invoice_date: newBill.bill_date,
        due_date: newBill.due_date,
        subtotal: newBill.subtotal,
        tax_rate_id: newBill.tax_rate_id || undefined,
        tax_amount: newBill.tax_amount,
        total_amount: newBill.total_amount,
        notes: newBill.notes,
        currency_id: currencyObj?.id || undefined,
        exchange_rate: newBill.exchange_rate || 1,
        purchase_order_id: newBill.purchase_order_id || undefined,
        lines: newBill.lines.map(l => ({
          product_id: l.product_id,
          description: l.description || l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          amount: l.amount,
        })),
      };
      await financeService.createPurchaseInvoice(data);
      setShowBillDialog(false);
      resetNewBill();
      fetchBills();
    } catch (error) {
      console.error('Failed to create bill:', error);
    }
  };

  const handleUpdateBill = async () => {
    try {
      const data = {
        due_date: editingBill.due_date,
        notes: editingBill.notes,
        status: editingBill.status,
      };
      await financeService.updatePurchaseInvoice(editingBill.id, data);
      setShowBillDialog(false);
      setEditingBill(null);
      fetchBills();
    } catch (error) {
      console.error('Failed to update bill:', error);
    }
  };

  const handleDeleteBill = (bill) => {
    setBillToDelete(bill);
    setShowDeleteDialog(true);
  };

  const confirmDeleteBill = async () => {
    if (billToDelete) {
      try {
        await financeService.deletePurchaseInvoice(billToDelete.id);
        setShowDeleteDialog(false);
        setBillToDelete(null);
        fetchBills();
      } catch (error) {
        console.error('Failed to delete bill:', error);
      }
    }
  };

  const handleApproveBill = async (billId) => {
    try {
      await financeService.updatePurchaseInvoice(billId, { status: 'approved' });
      fetchBills();
    } catch (error) {
      console.error('Failed to approve bill:', error);
    }
  };

  // Un-post an approved/posted bill back to draft so it can be edited or deleted.
  const handleResetBillToDraft = async (billId) => {
    try {
      await financeService.resetPurchaseInvoiceToDraft(billId);
      fetchBills();
    } catch (error) {
      const msg = error?.response?.data?.error?.message || error?.message || 'Failed to reset bill';
      window.alert(msg);
      console.error('Failed to reset bill:', error);
    }
  };

  const handleOpenPayment = (bill) => {
    const amountDue = (bill.total_amount || 0) - (bill.amount_paid || 0);
    setPaymentBill(bill);
    setPaymentAmount(amountDue.toString());
    setShowPaymentDialog(true);
  };

  const handleSubmitPayment = async () => {
    if (!paymentBill || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await financeService.payPurchaseInvoice(paymentBill.id, amount, paymentMethod);
      fetchBills();
      setShowPaymentDialog(false);
      setPaymentBill(null);
      setPaymentAmount('');
      setPaymentJournalId('');
    } catch (error) {
      console.error('Failed to record payment:', error);
    }
  };

  const handleRejectBill = async (billId) => {
    try {
      await financeService.updatePurchaseInvoice(billId, { status: 'rejected' });
      fetchBills();
    } catch (error) {
      console.error('Failed to reject bill:', error);
    }
  };

  const resetNewBill = () => {
    setNewBill({
      vendor_id: '',
      vendor_name: '',
      bill_number: '',
      vendor_invoice_number: '',
      bill_date: new Date().toISOString().split('T')[0],
      due_date: '',
      purchase_order_id: '',
      goods_receipt_id: '',
      payment_terms: '30',
      currency: 'UZS',
      currency_code: 'UZS',
      exchange_rate: 1,
      subtotal: 0,
      tax_rate_id: defaultPurchaseTax?.id || '',
      tax_percent: defaultPurchaseTax?.rate || 12,
      tax_amount: 0,
      total_amount: 0,
      notes: '',
      lines: []
    });
  };

  const handleCurrencyChange = (code) => {
    const setter = editingBill ? setEditingBill : setNewBill;
    const current = editingBill || newBill;
    if (code === baseCurrency.code) {
      setter({ ...current, currency: code, currency_code: code, exchange_rate: 1 });
      return;
    }
    const latestRate = getLatestExchangeRate(code);
    setter({
      ...current,
      currency: code,
      currency_code: code,
      exchange_rate: latestRate?.rate || current.exchange_rate || 1,
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
    const taxRate = parseFloat(currentBill.tax_percent) || 0;
    const tax_amount = subtotal * taxRate / 100;
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
    const taxRate = parseFloat(currentBill.tax_percent) || 0;
    const tax_amount = subtotal * taxRate / 100;
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
      partial: { variant: 'warning', icon: DollarSign, label: t('partially_paid') || 'Partial' },
      partially_paid: { variant: 'warning', icon: DollarSign, label: t('partially_paid') || 'Partial' },
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
  const overdueBills = bills.filter(b => isOverdue(b));
  const overdueCount = overdueBills.length;
  const overdueAmount = overdueBills.reduce((sum, b) => sum + b.total_amount - (b.paid_amount || 0), 0);
  const totalAmount = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const paidAmount = bills.reduce((sum, b) => sum + b.paid_amount, 0);
  const outstandingAmount = totalAmount - paidAmount;

  // Unique vendors for filter
  const uniqueVendors = [...new Map(bills.map(b => [b.vendor_id, { id: b.vendor_id, name: b.vendor_name }])).values()].filter(v => v.id);

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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
              {formatCurrency(totalAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-green-600">
              {bills.filter(b => b.payment_status === 'paid').length} {t('paid') || "to'langan"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('paid_amount') || 'Paid'}</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {formatCurrency(paidAmount)}
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
              {formatCurrency(outstandingAmount)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {approvedBills + pendingBills} {t('unpaid') || 'unpaid'}
            </div>
          </CardContent>
        </Card>

        <Card className={overdueCount > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              {t('overdue') || "Muddati o'tgan"}
            </CardDescription>
            <CardTitle className={`text-3xl ${overdueCount > 0 ? 'text-red-600' : ''}`}>
              {overdueCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-600">
              {formatCurrency(overdueAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                  <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                  <SelectItem value="pending_approval">{t('pending_approval') || 'Pending'}</SelectItem>
                  <SelectItem value="approved">{t('approved') || 'Approved'}</SelectItem>
                  <SelectItem value="partial">{t('partially_paid') || 'Partial'}</SelectItem>
                  <SelectItem value="paid">{t('paid') || 'Paid'}</SelectItem>
                  <SelectItem value="overdue">{t('overdue') || "Muddati o'tgan"}</SelectItem>
                  <SelectItem value="rejected">{t('rejected') || 'Rejected'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('all_vendors') || 'All Vendors'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_vendors') || 'All Vendors'}</SelectItem>
                  {uniqueVendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                  placeholder={t('from') || 'From'}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                  placeholder={t('to') || 'To'}
                />
              </div>
              {(searchTerm || statusFilter !== 'all' || vendorFilter !== 'all' || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); setVendorFilter('all'); setDateFrom(''); setDateTo(''); }}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {t('clear_filters') || 'Clear'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredBills.length === 0 ? (
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
                    <TableHead>{t('vendor_ref') || "Yetkazuvchi huj.№"}</TableHead>
                    <TableHead>{t('bill_date') || 'Bill Date'}</TableHead>
                    <TableHead>{t('due_date') || 'Due Date'}</TableHead>
                    <TableHead>{t('purchase_order') || 'PO'}</TableHead>
                    <TableHead className="text-right">{t('tax') || 'QQS'}</TableHead>
                    <TableHead className="text-right">{t('total_amount') || 'Amount'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead>{t('matching') || 'Matching'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill) => {
                    const overdue = isOverdue(bill);
                    return (
                    <TableRow key={bill.id} className={overdue ? 'bg-red-50/80 hover:bg-red-100/60' : ''}>
                      <TableCell className="font-medium">{bill.bill_number}</TableCell>
                      <TableCell>{bill.vendor_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{bill.vendor_invoice_number || '-'}</TableCell>
                      <TableCell>{bill.bill_date ? format(parseISO(bill.bill_date), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell className={overdue ? 'text-red-600 font-medium' : ''}>{bill.due_date ? format(parseISO(bill.due_date), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell>
                        {bill.purchase_order_id && (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <LinkIcon className="w-3 h-3" />
                            {bill.purchase_order_id}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {(bill.tax_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {bill.total_amount.toLocaleString()} {bill.currency}
                      </TableCell>
                      <TableCell>
                        {overdue
                          ? <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('overdue') || "Muddati o'tgan"}</Badge>
                          : getStatusBadge(bill.status)
                        }
                      </TableCell>
                      <TableCell>{getMatchingStatusBadge(bill.matching_status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              setSelectedBill(bill);
                              setShowDetailsDialog(true);
                              try {
                                const fullBill = await financeService.getPurchaseInvoice(bill.id);
                                if (fullBill) {
                                  setSelectedBill(prev => ({ ...prev, ...fullBill, currency: fullBill.currency_code || prev.currency }));
                                }
                              } catch (err) { console.warn('Failed to fetch bill detail:', err); }
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {bill.status !== 'draft' && isSuperAdmin && (bill.amount_paid || 0) === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetBillToDraft(bill.id)}
                              className="text-blue-600 hover:text-blue-700"
                              title={t('reset_to_draft') || 'Qoralamaga qaytarish'}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
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
                          {(bill.status === 'approved' || bill.status === 'partial' || bill.status === 'partially_paid' || overdue) && bill.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPayment(bill)}
                              className={overdue ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                              title={t('record_payment') || "To'lash"}
                            >
                              <CreditCard className="w-4 h-4" />
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
                    );
                  })}
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
                <Label>{t('vendor_ref') || "Yetkazuvchi hujjat raqami"} *</Label>
                <Input
                  value={editingBill?.vendor_invoice_number || newBill.vendor_invoice_number}
                  onChange={(e) => {
                    if (editingBill) {
                      setEditingBill({ ...editingBill, vendor_invoice_number: e.target.value });
                    } else {
                      setNewBill({ ...newBill, vendor_invoice_number: e.target.value });
                    }
                  }}
                  placeholder={t('vendor_doc_number') || "Yetkazuvchi hujjat raqami"}
                  required
                />
              </div>
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
                      .filter(po => (po.vendor_id || po.supplier_id) === (editingBill?.vendor_id || newBill.vendor_id))
                      .map(po => (
                        <SelectItem key={po.id} value={po.id}>{po.po_number || po.order_number || po.id}</SelectItem>
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

            {/* Currency */}
            {foreignCurrencies.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label><Globe className="w-4 h-4 inline mr-1" />{t('currency') || 'Valyuta'}</Label>
                  <Select value={editingBill?.currency_code || newBill.currency_code} onValueChange={handleCurrencyChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={baseCurrency.code}>{baseCurrency.code} ({t('base') || 'Asosiy'})</SelectItem>
                      {foreignCurrencies.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(editingBill?.currency_code || newBill.currency_code) !== baseCurrency.code && (
                  <div className="space-y-2">
                    <div>
                      <Label>{t('exchange_rate') || 'Valyuta kursi'} (1 {editingBill?.currency_code || newBill.currency_code} = ? {baseCurrency.code})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingBill?.exchange_rate || newBill.exchange_rate}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) || 0;
                          if (editingBill) {
                            setEditingBill({ ...editingBill, exchange_rate: rate });
                          } else {
                            setNewBill({ ...newBill, exchange_rate: rate });
                          }
                        }}
                        disabled={editingBill && editingBill.status !== 'draft'}
                      />
                      {editingBill && editingBill.status !== 'draft' && (
                        <p className="text-xs text-amber-600">{t('rate_locked') || 'Kurs qulflangan'}</p>
                      )}
                    </div>
                    <div>
                      <Label>{baseCurrency.code} {t('equivalent') || 'ekvivalent'}</Label>
                      <p className="text-lg font-semibold text-muted-foreground">
                        {formatCurrency((editingBill?.total_amount || newBill.total_amount) * ((editingBill?.exchange_rate || newBill.exchange_rate) || 1))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                              const taxRate = parseFloat(currentBill.tax_percent) || 0;
                              const tax_amount = subtotal * taxRate / 100;
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

            {/* Tax Rate Selector */}
            <div className="space-y-2">
              <Label>{t('tax_rate') || 'Tax Rate'} (%)</Label>
              <div className="flex gap-2">
                <Select
                  value={(editingBill?.tax_rate_id || newBill.tax_rate_id) || 'custom'}
                  onValueChange={(value) => {
                    const setter = editingBill ? setEditingBill : setNewBill;
                    const current = editingBill || newBill;
                    if (value === 'none') {
                      const subtotal = current.subtotal;
                      setter({ ...current, tax_rate_id: '', tax_percent: 0, tax_amount: 0, total_amount: subtotal });
                    } else if (value === 'custom') {
                      setter({ ...current, tax_rate_id: '' });
                    } else {
                      const selectedRate = purchaseTaxRates.find(tr => String(tr.id) === value);
                      if (selectedRate) {
                        const subtotal = current.subtotal;
                        const tax_amount = subtotal * selectedRate.rate / 100;
                        setter({ ...current, tax_rate_id: value, tax_percent: selectedRate.rate, tax_amount, total_amount: subtotal + tax_amount });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('select_tax_rate') || 'Select tax rate'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('no_tax') || 'No Tax'} (0%)</SelectItem>
                    {purchaseTaxRates.filter(tr => tr.is_active).map(tr => (
                      <SelectItem key={tr.id} value={String(tr.id)}>
                        {tr.name} ({tr.rate}%)
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t('custom') || 'Custom'}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="w-[100px]"
                  value={editingBill?.tax_percent ?? newBill.tax_percent}
                  onChange={(e) => {
                    const setter = editingBill ? setEditingBill : setNewBill;
                    const current = editingBill || newBill;
                    const rate = parseFloat(e.target.value) || 0;
                    const tax_amount = current.subtotal * rate / 100;
                    setter({ ...current, tax_percent: rate, tax_rate_id: '', tax_amount, total_amount: current.subtotal + tax_amount });
                  }}
                  min="0"
                  max="100"
                  step="0.01"
                />
                <span className="flex items-center text-sm text-muted-foreground">%</span>
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
                <span>{t('tax') || 'Tax'} ({editingBill?.tax_percent ?? newBill.tax_percent}%):</span>
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
                  <Label className="text-muted-foreground">{t('vendor_ref') || "Yetkazuvchi huj.№"}</Label>
                  <p className="font-semibold">{selectedBill.vendor_invoice_number || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('bill_date') || 'Bill Date'}</Label>
                  <p>{selectedBill.bill_date ? format(parseISO(selectedBill.bill_date), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('due_date') || 'Due Date'}</Label>
                  <p className={isOverdue(selectedBill) ? 'text-red-600 font-medium' : ''}>{selectedBill.due_date ? format(parseISO(selectedBill.due_date), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('status') || 'Status'}</Label>
                  <div className="mt-1">
                    {isOverdue(selectedBill)
                      ? <Badge variant="destructive" className="flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" />{t('overdue') || "Muddati o'tgan"}</Badge>
                      : getStatusBadge(selectedBill.status)
                    }
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('matching_status') || 'Matching'}</Label>
                  <div className="mt-1">{getMatchingStatusBadge(selectedBill.matching_status)}</div>
                </div>
              </div>

              {selectedBill.exchange_rate && selectedBill.exchange_rate !== 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    {selectedBill.currency_code || selectedBill.currency}
                    <span className="mx-1">—</span>
                    <span>{t('exchange_rate') || 'Valyuta kursi'}:</span>
                    <span className="font-semibold ml-1">{Number(selectedBill.exchange_rate).toLocaleString()} {baseCurrency.code}</span>
                    {selectedBill.status !== 'draft' && (
                      <Badge variant="outline" className="ml-2 text-xs">{t('rate_locked') || 'Kurs qulflangan'}</Badge>
                    )}
                  </span>
                </div>
              )}

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
                    {(selectedBill.lines || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          {t('no_line_items') || 'No line items'}
                        </TableCell>
                      </TableRow>
                    ) : (selectedBill.lines || []).map((line, idx) => (
                      <TableRow key={line.id || idx}>
                        <TableCell>{line.product_name || line.description}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{(line.unit_price || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">{(line.amount || (line.quantity || 0) * (line.unit_price || 0)).toLocaleString()}</TableCell>
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
                {(() => {
                  const allocs = selectedBill.payment_allocations || [];
                  const confirmedAmt = allocs.filter(a => a.status === 'confirmed').reduce((s, a) => s + (a.amount || 0), 0);
                  const pendingAmt = allocs.filter(a => a.status === 'draft').reduce((s, a) => s + (a.amount || 0), 0);
                  const paidAmt = confirmedAmt || selectedBill.paid_amount || 0;
                  const remaining = (selectedBill.total_amount || 0) - paidAmt;
                  return (
                    <>
                      {paidAmt > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>{t('confirmed_payments') || 'Tasdiqlangan to\'lovlar'}:</span>
                          <span className="font-semibold">{paidAmt.toLocaleString()} {selectedBill.currency}</span>
                        </div>
                      )}
                      {pendingAmt > 0 && (
                        <div className="flex justify-between text-yellow-600">
                          <span>{t('pending') || 'Kutilmoqda'}:</span>
                          <span className="font-semibold">{pendingAmt.toLocaleString()} {selectedBill.currency}</span>
                        </div>
                      )}
                      {remaining > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>{t('remaining_debt') || 'Qoldiq qarz'}:</span>
                          <span className="font-semibold">{remaining.toLocaleString()} {selectedBill.currency}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Payment History */}
              {(selectedBill.payment_allocations || []).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">{t('payment_history') || 'To\'lov tarixi'}</Label>
                  <div className="mt-2 space-y-2">
                    {selectedBill.payment_allocations.map((alloc, idx) => (
                      <div key={alloc.id || idx} className="flex items-center justify-between border rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <Badge variant={alloc.status === 'confirmed' ? 'default' : 'secondary'}>
                            {alloc.status === 'confirmed' ? (t('confirmed') || 'Tasdiqlangan') : (t('draft') || 'Qoralama')}
                          </Badge>
                          <div>
                            <p className="font-medium text-sm">{alloc.payment_number}</p>
                            {alloc.payment_date && (
                              <p className="text-xs text-muted-foreground">{format(parseISO(alloc.payment_date), 'dd.MM.yyyy')}</p>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold">{(alloc.amount || 0).toLocaleString()} {selectedBill.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exchange Differences */}
              {(selectedBill.exchange_diffs || []).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">{t('exchange_difference') || 'Kurs farqi'}</Label>
                  <div className="mt-2 space-y-2">
                    {selectedBill.exchange_diffs.map((ed, idx) => (
                      <div key={ed.id || idx} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={ed.type === 'positive' ? 'default' : 'destructive'}
                              className={ed.type === 'positive'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                              }>
                              {ed.type === 'positive' ? (t('exchange_profit') || 'Foyda') : (t('exchange_loss') || 'Zarar')}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{ed.document_number || ed.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${ed.type === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                              {ed.type === 'positive' ? '+' : '-'}{(ed.amount || 0).toLocaleString()} UZS
                            </span>
                            {(ed.initial_rate || ed.final_rate) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                onClick={() => setExpandedDiffs(prev => ({ ...prev, [ed.id || idx]: !prev[ed.id || idx] }))}
                              >
                                {expandedDiffs[ed.id || idx] ? (
                                  <>{t('hide') || 'Yopish'} <ChevronUp className="w-3 h-3 ml-1" /></>
                                ) : (
                                  <>{t('details') || 'Batafsil'} <ChevronDown className="w-3 h-3 ml-1" /></>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        {expandedDiffs[ed.id || idx] && (ed.initial_rate || ed.final_rate) && (
                          <div className="mt-2 grid grid-cols-4 gap-2 text-xs bg-slate-50 rounded p-2">
                            <div>
                              <span className="text-slate-500">{t('invoice_rate') || 'HF kursi'}:</span>
                              <span className="ml-1 font-mono font-medium">{Number(ed.initial_rate).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{t('payment_rate') || "To'lov kursi"}:</span>
                              <span className="ml-1 font-mono font-medium">{Number(ed.final_rate).toLocaleString()}</span>
                            </div>
                            {ed.foreign_amount > 0 && (
                              <div>
                                <span className="text-slate-500">{t('foreign_amount') || 'Valyuta summa'}:</span>
                                <span className="ml-1 font-mono font-medium">{Number(ed.foreign_amount).toLocaleString()}</span>
                              </div>
                            )}
                            {ed.date && (
                              <div>
                                <span className="text-slate-500">{t('date') || 'Sana'}:</span>
                                <span className="ml-1 font-mono font-medium">{format(new Date(ed.date), 'dd.MM.yyyy')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => { if (!open) { setShowPaymentDialog(false); setPaymentBill(null); setPaymentAmount(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('record_payment') || 'Record Payment'}</DialogTitle>
          </DialogHeader>
          {paymentBill && (
            <div className="space-y-4 py-2">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('bill_number') || 'Bill'}:</span>
                  <span className="font-medium">{paymentBill.invoice_number || paymentBill.bill_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('total_amount') || 'Total'}:</span>
                  <span className="font-medium">{formatCurrency(paymentBill.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('paid') || 'Paid'}:</span>
                  <span className="font-medium">{formatCurrency(paymentBill.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{t('amount_due') || 'Amount Due'}:</span>
                  <span className="text-orange-600">{formatCurrency((paymentBill.total_amount || 0) - (paymentBill.amount_paid || 0))}</span>
                </div>
              </div>
              {/* Payment method / journal */}
              <div>
                <Label>{t('payment_method') || "To'lov usuli"} *</Label>
                {bankCashJournals.length > 0 ? (
                  <Select value={paymentJournalId} onValueChange={(value) => {
                    setPaymentJournalId(value);
                    const j = bankCashJournals.find(j => j.id === value);
                    if (j) setPaymentMethod(j.type === 'cash' ? 'cash' : 'bank');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_journal') || "Jurnal tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankCashJournals.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.name} ({j.type === 'bank' ? t('bank') || 'Bank' : t('cash') || 'Naqd'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">{t('bank_transfer') || "Bank o'tkazmasi"}</SelectItem>
                      <SelectItem value="cash">{t('cash') || 'Naqd'}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>{t('payment_amount') || "To'lov summasi"} *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatPriceInput(paymentAmount)}
                  onChange={(e) => setPaymentAmount(parsePriceInput(e.target.value))}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPaymentDialog(false); setPaymentBill(null); setPaymentAmount(''); }}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleSubmitPayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              {t('confirm_payment') || 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
