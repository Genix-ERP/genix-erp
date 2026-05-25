import React, { useState, useMemo, useEffect } from "react";
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
  RotateCcw,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Package,
  AlertTriangle,
  FileText,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { useCompany } from "@/components/contexts/CompanyContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import ProductCombobox from "@/components/shared/ProductCombobox";
import CustomerCombobox from "@/components/shared/CustomerCombobox";
import inventoryService from "@/api/services/inventory";
import salesService from "@/api/services/sales";

export default function Returns() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const {
    returns,
    salesOrders,
    getOrder,
    createReturn,
    updateReturn,
    approveReturn,
    processRefund,
    isLoading,
  } = useSales();

  const { customers } = useCustomers();
  const { canCreate } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);

  const [products, setProducts] = useState([]);
  // Orders list for the selected customer (left column of the new modal).
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    sales_order_id: "",
    return_date: new Date().toISOString().split("T")[0],
    reason: "defective",
    items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
    notes: "",
  });

  // Fetch sellable products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        const all = Array.isArray(data) ? data : data?.items || [];
        setProducts(all.filter(p => p.can_be_sold !== false && p.is_sellable !== false));
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);

  // Fetch the selected customer's sales orders whenever customer changes.
  // User then picks an order; its lines pre-fill the return and — critically —
  // the return's amount gets applied to THAT order's invoice on approval.
  useEffect(() => {
    const fetchCustomerOrders = async () => {
      if (!formData.customer_id) {
        setCustomerOrders([]);
        setSelectedOrderId("");
        return;
      }
      setLoadingOrders(true);
      try {
        const res = await salesService.listOrders({
          customer_id: formData.customer_id,
          page_size: 100,
        });
        const all = Array.isArray(res) ? res : res?.items || res?.data || [];
        // Returns only make sense against orders that have been confirmed or
        // beyond — draft/cancelled aren't returnable.
        const returnable = all
          .filter((o) => !["draft", "cancelled", "quotation"].includes(o.status))
          .sort((a, b) => new Date(b.order_date || b.created_at) - new Date(a.order_date || a.created_at));
        setCustomerOrders(returnable);
      } catch (error) {
        console.error("Failed to fetch customer orders:", error);
        setCustomerOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchCustomerOrders();
  }, [formData.customer_id]);

  // When the user picks an order, fetch its full details (with lines) and
  // populate the return items. The user can still edit qty/price/condition.
  const handleOrderSelect = async (orderId) => {
    if (!orderId || orderId === selectedOrderId) return;
    setSelectedOrderId(orderId);
    setLoadingOrderDetails(true);
    try {
      const order = await getOrder(orderId);
      const lines = order?.lines || [];
      const items = lines.length
        ? lines.map((l) => ({
            product_id: l.product_id || "",
            product_name: l.product_name || l.description || "",
            quantity: Number(l.quantity) || 1,
            unit_price: Number(l.unit_price) || 0,
            condition: "damaged",
          }))
        : [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }];
      setFormData((prev) => ({
        ...prev,
        sales_order_id: orderId,
        items,
      }));
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const filteredReturns = useMemo(() => {
    if (!returns || !Array.isArray(returns)) return [];
    return returns.filter((r) => {
      const matchesSearch =
        r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [returns, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    if (!returns || !Array.isArray(returns)) {
      return { total: 0, pending: 0, approved: 0, totalAmount: 0, refundedAmount: 0 };
    }
    const total = returns.length;
    const pending = returns.filter((r) => r.status === "pending").length;
    const approved = returns.filter((r) => r.status === "approved").length;
    const totalAmount = returns.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const refundedAmount = returns
      .filter((r) => r.status === "approved" || r.refund_status === "processed")
      .reduce((sum, r) => sum + (r.total_amount || 0), 0);
    return { total, pending, approved, totalAmount, refundedAmount };
  }, [returns]);

  const handleCustomerSelect = (customerId) => {
    const customer = customers?.find(c => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.name || customer.company_name || '',
      });
    }
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...formData.items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        unit_price: product.selling_price || product.sale_price || product.price || 0,
      };
      setFormData({ ...formData, items: newItems });
    }
  };

  const addItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
    });
  };

  const removeItemRow = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    if (field === "quantity") {
      // Keep the raw string while the user is typing — coercing to a
      // number here breaks partial inputs like "0." or "0.5". The
      // previous version did `Math.max(1, parseInt(value) || 1)`
      // which (a) parseInt-truncated decimals to 0, then (b) bumped
      // every <1 value back to 1, making it impossible to type
      // fractional quantities like 0.525 (kg / m / etc.).
      // The submit handler does parseFloat on the way out, so the
      // payload sent to the backend is always numeric.
      newItems[index][field] = value;
    } else if (field === "unit_price") {
      // Same logic — keep raw input. Don't coerce intermediate
      // states like "" or "0." back to 0.
      newItems[index][field] = value;
    } else {
      newItems[index][field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async () => {
    // Coerce raw input strings (which may include partial states like
    // "0." while the user was typing) into numbers exactly once,
    // here at submission time. Empty / non-numeric → 0 so the
    // backend never sees a string.
    const num = (v) => {
      const f = parseFloat(v);
      return Number.isFinite(f) ? f : 0;
    };
    const normalizedItems = formData.items.map((item) => ({
      ...item,
      quantity: num(item.quantity),
      unit_price: num(item.unit_price),
    }));
    const totalAmount = normalizedItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    const data = {
      ...formData,
      organization_id: activeCompany?.id,
      items: normalizedItems.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price,
      })),
      total_amount: totalAmount,
    };

    await createReturn(data);
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedReturn(null);
    setFormData({
      customer_id: "",
      customer_name: "",
      sales_order_id: "",
      return_date: new Date().toISOString().split("T")[0],
      reason: "defective",
      items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
      notes: "",
    });
    setCustomerOrders([]);
    setSelectedOrderId("");
  };

  const handleView = (returnItem) => {
    setSelectedReturn(returnItem);
    setShowDetails(true);
  };

  const handleApprove = async (returnItem) => {
    await approveReturn(returnItem.id);
  };

  const handleReject = async (returnItem) => {
    await updateReturn(returnItem.id, { status: "rejected" });
  };

  const handleProcessRefund = async (returnItem, method) => {
    await processRefund(returnItem.id, { refund_method: method });
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: t('pending') },
      approved: { color: "bg-green-100 text-green-800", label: t('approved') },
      rejected: { color: "bg-red-100 text-red-800", label: t('rejected') },
      completed: { color: "bg-blue-100 text-blue-800", label: t('completed') },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getRefundStatusBadge = (status) => {
    const variants = {
      pending: { color: "bg-slate-100 text-slate-800", label: t('pending') },
      processed: { color: "bg-green-100 text-green-800", label: t('refunded') },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getReasonLabel = (reason) => {
    const reasons = {
      defective: t('defective_product'),
      wrong_item: t('wrong_item'),
      damaged: t('damaged'),
      not_as_described: t('not_as_described'),
      changed_mind: t('changed_mind'),
      other: t('other'),
    };
    return reasons[reason] || reason;
  };

  const getConditionLabel = (condition) => {
    const conditions = {
      damaged: t('damaged'),
      opened: t('opened'),
      sealed: t('sealed'),
      used: t('used'),
    };
    return conditions[condition] || condition;
  };

  // Live total for the "Jami qaytarish summasi" preview. parseFloat
  // each field so a partial string input ("0.") doesn't NaN the sum
  // — empty inputs contribute 0, valid decimals contribute fully.
  const totalAmount = formData.items.reduce(
    (sum, item) => {
      const q = parseFloat(item.quantity);
      const p = parseFloat(item.unit_price);
      return sum + (Number.isFinite(q) ? q : 0) * (Number.isFinite(p) ? p : 0);
    },
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500 rounded-lg">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">{t('total_returns')}</p>
                <p className="text-lg font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-yellow-600 font-medium">{t('pending')}</p>
                <p className="text-lg font-bold text-yellow-900">{stats.pending}</p>
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
                <p className="text-xs text-green-600 font-medium">{t('approved')}</p>
                <p className="text-lg font-bold text-green-900">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('refunded_amount')}</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrencyCompact(stats.refundedAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">{t('returns')}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('manage_returns_desc')}
          </p>
        </div>
        {canCreate(MODULES.SALES) && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('new_return')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('search_return') + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="approved">{t('approved')}</SelectItem>
            <SelectItem value="rejected">{t('rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Returns List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_returns_found')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('return_number')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('refund')}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((returnItem) => (
                    <TableRow key={returnItem.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{returnItem.return_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{returnItem.customer_name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getReasonLabel(returnItem.reason)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {format(new Date(returnItem.return_date), "dd.MM.yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(returnItem.total_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                      <TableCell>{getRefundStatusBadge(returnItem.refund_status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(returnItem)}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('view')}
                            </DropdownMenuItem>
                            {returnItem.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(returnItem)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  {t('approve')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleReject(returnItem)}
                                  className="text-red-600"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  {t('reject')}
                                </DropdownMenuItem>
                              </>
                            )}
                            {returnItem.status === "approved" &&
                              returnItem.refund_status === "pending" && (
                                <DropdownMenuItem
                                  onClick={() => handleProcessRefund(returnItem, "credit_note")}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  {t('issue_credit_note')}
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Form Modal — two-column layout.
          Left: customer's sales orders list (click to load lines).
          Right: return detail form (products auto-filled from selected order). */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_return')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Customer Selection — full width at top */}
            <div className="space-y-2">
              <Label>{t('customer')} *</Label>
              <CustomerCombobox
                customers={customers || []}
                value={formData.customer_id}
                onValueChange={(value, customer) => {
                  if (!customer) customer = customers?.find(c => c.id === value);
                  setFormData({
                    ...formData,
                    customer_id: value,
                    customer_name: customer?.name || customer?.company_name || '',
                    // Reset order-specific fields when customer changes.
                    sales_order_id: "",
                    items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
                  });
                  setSelectedOrderId("");
                }}
                placeholder={t('select_customer') || 'Mijozni tanlang'}
                t={t}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
              {/* LEFT COLUMN: Customer orders */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  {t('customer_orders') || 'Mijoz buyurtmalari'}
                </Label>
                {!formData.customer_id ? (
                  <div className="border rounded-lg p-6 text-center text-sm text-slate-500 bg-slate-50">
                    {t('select_customer_first') || 'Avval mijozni tanlang'}
                  </div>
                ) : loadingOrders ? (
                  <div className="border rounded-lg p-6 text-center text-sm text-slate-500">
                    {t('loading') || 'Yuklanmoqda...'}
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="border rounded-lg p-6 text-center text-sm text-slate-500 bg-slate-50">
                    {t('no_orders_for_customer') || "Bu mijozning buyurtmalari yo'q"}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-white max-h-[480px] overflow-y-auto">
                    {customerOrders.map((order) => {
                      const active = selectedOrderId === order.id;
                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => handleOrderSelect(order.id)}
                          className={
                            'w-full text-left p-3 border-b last:border-b-0 transition-colors ' +
                            (active
                              ? 'bg-blue-50 border-l-4 border-l-blue-600'
                              : 'hover:bg-slate-50')
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">
                              {order.order_number}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {t(order.status) || order.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1 text-xs text-slate-500">
                            <span>
                              {order.order_date
                                ? format(new Date(order.order_date), 'dd.MM.yyyy')
                                : ''}
                            </span>
                            <span className="font-medium text-slate-700">
                              {formatCurrency(order.total_amount || 0)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Return details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('return_date')} *</Label>
                    <Input
                      type="date"
                      value={formData.return_date}
                      onChange={(e) =>
                        setFormData({ ...formData, return_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('reason')} *</Label>
                    <Select
                      value={formData.reason}
                      onValueChange={(value) =>
                        setFormData({ ...formData, reason: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="defective">{t('defective_product')}</SelectItem>
                        <SelectItem value="wrong_item">{t('wrong_item')}</SelectItem>
                        <SelectItem value="damaged">{t('damaged')}</SelectItem>
                        <SelectItem value="not_as_described">{t('not_as_described')}</SelectItem>
                        <SelectItem value="changed_mind">{t('changed_mind')}</SelectItem>
                        <SelectItem value="other">{t('other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Product Line Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      {t('return_products') || 'Qaytarilayotgan mahsulotlar'}
                    </Label>
                    <Button variant="outline" size="sm" onClick={addItemRow}>
                      <Plus className="w-4 h-4 mr-1" />
                      {t('add') || "Qo'shish"}
                    </Button>
                  </div>
                  {loadingOrderDetails ? (
                    <div className="text-sm text-slate-500 py-4 text-center">
                      {t('loading') || 'Yuklanmoqda...'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.items.map((item, index) => (
                        <div key={index} className="bg-slate-50 p-3 rounded-lg">
                          <div className="flex gap-2 items-end">
                            <div className="flex-[3] min-w-0">
                              {index === 0 && (
                                <Label className="text-xs text-slate-500 mb-1">
                                  {t('product')}
                                </Label>
                              )}
                              <ProductCombobox
                                products={products}
                                value={item.product_id || ''}
                                onValueChange={(value) => handleProductSelect(index, value)}
                                placeholder={t('select_product') || 'Mahsulotni tanlang'}
                                t={t}
                              />
                            </div>
                            <div className="w-20">
                              {index === 0 && (
                                <Label className="text-xs text-slate-500 mb-1">
                                  {t('quantity')}
                                </Label>
                              )}
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              />
                            </div>
                            <div className="w-32">
                              {index === 0 && (
                                <Label className="text-xs text-slate-500 mb-1">
                                  {t('price')}
                                </Label>
                              )}
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unit_price}
                                onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                              />
                            </div>
                            <div className="w-32">
                              {index === 0 && (
                                <Label className="text-xs text-slate-500 mb-1">
                                  {t('condition')}
                                </Label>
                              )}
                              <Select
                                value={item.condition}
                                onValueChange={(value) => handleItemChange(index, "condition", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="damaged">{t('damaged')}</SelectItem>
                                  <SelectItem value="opened">{t('opened')}</SelectItem>
                                  <SelectItem value="sealed">{t('sealed')}</SelectItem>
                                  <SelectItem value="used">{t('used')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-32 h-10 flex items-center justify-end font-medium text-sm whitespace-nowrap">
                              {formatCurrency(
                                (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-red-500 hover:text-red-700"
                              onClick={() => removeItemRow(index)}
                              disabled={formData.items.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>{t('total_return_amount') || 'Jami qaytarish summasi'}:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  {formData.sales_order_id && (
                    <p className="text-xs text-slate-500 mt-2">
                      {t('return_will_deduct_from_order_invoice') ||
                        "Qaytarish summasi tanlangan buyurtmaning hisob-fakturasidan ayiriladi"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('notes')}</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('additional_info') + '...'}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.customer_id || totalAmount === 0}
              >
                {t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              {selectedReturn?.return_number}
            </DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{selectedReturn.customer_name}</h3>
                  <p className="text-sm text-slate-500">
                    {t('order')}: {selectedReturn.so_number || selectedReturn.sales_order_id}
                  </p>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(selectedReturn.status)}
                  {getRefundStatusBadge(selectedReturn.refund_status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('return_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedReturn.return_date), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t('reason')}:</span>
                  <p className="font-medium">{getReasonLabel(selectedReturn.reason)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-center">{t('quantity')}</TableHead>
                      <TableHead>{t('condition')}</TableHead>
                      <TableHead className="text-right">{t('amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReturn.items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getConditionLabel(item.condition)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex justify-between font-semibold text-lg">
                  <span>{t('total')}:</span>
                  <span>{formatCurrency(selectedReturn.total_amount)}</span>
                </div>
                {selectedReturn.refund_status === "processed" && (
                  <div className="flex justify-between text-sm text-green-600 mt-2">
                    <span>{t('refund_method')}:</span>
                    <span>
                      {selectedReturn.refund_method === "cash"
                        ? t('cash')
                        : t('credit_note')}
                    </span>
                  </div>
                )}
              </div>

              {selectedReturn.notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
