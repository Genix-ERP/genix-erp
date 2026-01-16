import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Receipt,
  Send,
  CheckCircle,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  CreditCard,
  Banknote,
  AlertTriangle,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Invoices() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const {
    invoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    isLoading,
  } = useSales();

  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    items: [{ product_name: "", quantity: 1, unit_price: 0 }],
    discount_amount: 0,
    tax_percent: 12,
    notes: "",
  });

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: "cash",
    date: new Date().toISOString().split("T")[0],
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || inv.payment_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const paid = invoices
      .filter((inv) => inv.payment_status === "paid")
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const outstanding = invoices
      .filter((inv) => inv.payment_status !== "paid")
      .reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const overdue = invoices
      .filter((inv) => inv.payment_status !== "paid" && new Date(inv.due_date) < new Date())
      .reduce((sum, inv) => sum + (inv.balance || 0), 0);
    return { total, paid, outstanding, overdue };
  }, [invoices]);

  const calculateTotals = (items, discountAmount, taxPercent) => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const total = afterDiscount + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_name: "", quantity: 1, unit_price: 0 }],
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = field === "product_name" ? value : parseFloat(value) || 0;
    setFormData({ ...formData, items: newItems });
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.company_name,
      });
    }
  };

  const handleSubmit = async () => {
    const { subtotal, taxAmount, total } = calculateTotals(
      formData.items,
      formData.discount_amount,
      formData.tax_percent
    );

    const data = {
      ...formData,
      items: formData.items.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price,
      })),
      subtotal,
      tax_amount: taxAmount,
      total_amount: total,
    };

    if (editMode && selectedInvoice) {
      await updateInvoice(selectedInvoice.id, data);
    } else {
      await createInvoice(data);
    }
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditMode(false);
    setSelectedInvoice(null);
    setFormData({
      customer_id: "",
      customer_name: "",
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      items: [{ product_name: "", quantity: 1, unit_price: 0 }],
      discount_amount: 0,
      tax_percent: 12,
      notes: "",
    });
  };

  const handleEdit = (invoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      customer_id: invoice.customer_id || "",
      customer_name: invoice.customer_name || "",
      invoice_date: invoice.invoice_date || "",
      due_date: invoice.due_date || "",
      items: invoice.items || [{ product_name: "", quantity: 1, unit_price: 0 }],
      discount_amount: invoice.discount_amount || 0,
      tax_percent: invoice.tax_percent || 12,
      notes: invoice.notes || "",
    });
    setEditMode(true);
    setShowForm(true);
  };

  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetails(true);
  };

  const handleSend = async (invoice) => {
    await updateInvoice(invoice.id, { status: "sent" });
  };

  const handlePayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.balance || 0,
      method: "cash",
      date: new Date().toISOString().split("T")[0],
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    if (selectedInvoice && paymentData.amount > 0) {
      await recordPayment(
        selectedInvoice.id,
        paymentData.amount,
        paymentData.method,
        paymentData.date
      );
      setShowPaymentModal(false);
      setSelectedInvoice(null);
    }
  };

  const handleDelete = (invoice) => {
    setInvoiceToDelete(invoice);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (invoiceToDelete) {
      await deleteInvoice(invoiceToDelete.id);
      setShowDeleteConfirm(false);
      setInvoiceToDelete(null);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: { color: "bg-slate-100 text-slate-800", label: t("draft") },
      sent: { color: "bg-blue-100 text-blue-800", label: t("sent") },
      paid: { color: "bg-green-100 text-green-800", label: t("paid") },
      partial: { color: "bg-yellow-100 text-yellow-800", label: t("partial_paid") },
      unpaid: { color: "bg-red-100 text-red-800", label: t("unpaid") },
      overdue: { color: "bg-red-100 text-red-800", label: t("overdue") },
    };
    const variant = variants[status] || variants.unpaid;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getPaymentStatusBadge = (invoice) => {
    if (invoice.payment_status === "paid") {
      return getStatusBadge("paid");
    }
    if (new Date(invoice.due_date) < new Date()) {
      return getStatusBadge("overdue");
    }
    return getStatusBadge(invoice.payment_status);
  };

  const formatCurrency = (amount) => {
    // Use locale-aware currency formatting
    const currencySymbol = language === 'en' ? 'UZS' : language === 'ru' ? 'сум' : "so'm";
    return `${(amount || 0).toLocaleString()} ${currencySymbol}`;
  };

  const getDaysUntilDue = (dueDate) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return { text: `${Math.abs(days)} ${t("days_ago")}`, isOverdue: true };
    if (days === 0) return { text: t("today"), isOverdue: false };
    return { text: `${days} ${t("days_left")}`, isOverdue: false };
  };

  const { subtotal, taxAmount, total } = calculateTotals(
    formData.items,
    formData.discount_amount,
    formData.tax_percent
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t("total")}</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(stats.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">{t("paid")}</p>
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(stats.paid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-yellow-600 font-medium">{t("pending")}</p>
                <p className="text-lg font-bold text-yellow-900">
                  {formatCurrency(stats.outstanding)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-red-600 font-medium">{t("overdue")}</p>
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(stats.overdue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">{t("invoices")}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t("customer_invoices")}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("new_invoice")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t("search_invoices")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
            <SelectItem value="partial">{t("partial_paid")}</SelectItem>
            <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_invoices_found')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('invoice_number')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    <TableHead>{t('due_date')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                    <TableHead className="text-right">{t('balance')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const dueInfo = getDaysUntilDue(invoice.due_date);
                    return (
                      <TableRow key={invoice.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{invoice.invoice_number}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{invoice.customer_name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <div>
                              <div className="text-sm">
                                {format(new Date(invoice.due_date), "dd.MM.yyyy")}
                              </div>
                              <div
                                className={`text-xs ${
                                  dueInfo.isOverdue ? "text-red-500" : "text-slate-500"
                                }`}
                              >
                                {dueInfo.text}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-medium ${
                              invoice.balance > 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {formatCurrency(invoice.balance)}
                          </span>
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(invoice)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(invoice)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view')}
                              </DropdownMenuItem>
                              {invoice.payment_status !== "paid" && (
                                <DropdownMenuItem onClick={() => handlePayment(invoice)}>
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  {t('make_payment')}
                                </DropdownMenuItem>
                              )}
                              {invoice.status === "draft" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    {t('edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSend(invoice)}>
                                    <Send className="w-4 h-4 mr-2" />
                                    {t('send')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(invoice)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {t('delete')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Create/Edit Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? t('edit_invoice') : t('new_invoice')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Customer & Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('customer')} *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={handleCustomerSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_customer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('invoice_date')} *</Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('due_date')} *</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">{t('products')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add')}
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="w-24">{t('quantity')}</TableHead>
                      <TableHead className="w-36">{t('price')}</TableHead>
                      <TableHead className="w-36 text-right">{t('total')}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={item.product_name}
                            onChange={(e) =>
                              handleItemChange(index, "product_name", e.target.value)
                            }
                            placeholder={t('product_name')}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, "quantity", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) =>
                              handleItemChange(index, "unit_price", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                        <TableCell>
                          {formData.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('discount_amount')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.discount_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('tax')} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.tax_percent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tax_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('subtotal')}:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {formData.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t('discount')}:</span>
                  <span>-{formatCurrency(formData.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>{t('tax')} ({formData.tax_percent}%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>{t('total')}:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('additional_info')}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !formData.customer_id ||
                  !formData.due_date ||
                  formData.items.length === 0
                }
              >
                {editMode ? t('save') : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {t('make_payment')}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">{t('invoice')}:</span>
                  <span className="font-medium">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">{t('total_amount')}:</span>
                  <span className="font-medium">
                    {formatCurrency(selectedInvoice.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('balance')}:</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(selectedInvoice.balance)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('payment_amount')} *</Label>
                <Input
                  type="number"
                  min="0"
                  max={selectedInvoice.balance}
                  value={paymentData.amount}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t('payment_method')}</Label>
                <Select
                  value={paymentData.method}
                  onValueChange={(value) =>
                    setPaymentData({ ...paymentData, method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4" />
                        {t('cash')}
                      </div>
                    </SelectItem>
                    <SelectItem value="bank_transfer">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        {t('bank_transfer')}
                      </div>
                    </SelectItem>
                    <SelectItem value="card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        {t('card')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('payment_date')}</Label>
                <Input
                  type="date"
                  value={paymentData.date}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, date: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handlePaymentSubmit}
                  disabled={paymentData.amount <= 0}
                >
                  {t('record_payment')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedInvoice.customer_name}
                  </h3>
                </div>
                {getPaymentStatusBadge(selectedInvoice)}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('invoice_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.invoice_date), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t('due_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.due_date), "dd.MM.yyyy")}
                  </p>
                </div>
                {selectedInvoice.payment_date && (
                  <div>
                    <span className="text-slate-500">{t('payment_date')}:</span>
                    <p className="font-medium">
                      {format(new Date(selectedInvoice.payment_date), "dd.MM.yyyy")}
                    </p>
                  </div>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-center">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('price')}</TableHead>
                      <TableHead className="text-right">{t('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('subtotal')}:</span>
                  <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>{t('discount')}:</span>
                    <span>-{formatCurrency(selectedInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>{t('tax')}:</span>
                  <span>{formatCurrency(selectedInvoice.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>{t('total')}:</span>
                  <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>{t('paid')}:</span>
                  <span className="text-green-600">
                    {formatCurrency(selectedInvoice.paid_amount)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{t('balance')}:</span>
                  <span
                    className={
                      selectedInvoice.balance > 0 ? "text-red-600" : "text-green-600"
                    }
                  >
                    {formatCurrency(selectedInvoice.balance)}
                  </span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('confirm_deletion')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('delete_invoice_confirm')}
            </p>
            {invoiceToDelete && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="font-semibold">{invoiceToDelete.invoice_number}</p>
                <p className="text-sm text-slate-500">{invoiceToDelete.customer_name}</p>
                <p className="text-sm font-medium mt-1">
                  {formatCurrency(invoiceToDelete.total_amount)}
                </p>
              </div>
            )}
            <p className="text-sm text-red-500 mt-3">
              {t('this_action_cannot_be_undone')}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
