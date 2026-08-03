import { useState, useEffect, useCallback } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { useSales } from '@/components/contexts/SalesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, ShoppingBag, Truck,
  CheckCircle, FileText, Receipt, RotateCcw, Eye, Printer, X,
  ClipboardList, MessageSquareWarning, ChevronLeft, ChevronRight, Edit, SlidersHorizontal,
  PackageCheck
} from 'lucide-react';
import apiClient from '@/api/client';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import Returns from './Returns';
import Quotations from './Quotations';
import DeliveryOrders from './DeliveryOrders';
import { orderStatusClass } from './orderStatus';
import { ImportExportButtons } from '@/components/shared';

export default function Orders({
  initialSubtab = 'list',
  onCreateOrder,
  onEditOrder,
  onViewOrder,
  onPrintOrder,
  onUpdateStatus,
  onCreateInvoice,
  onCreateInvoiceDelivered,
  onDeleteOrder,
  showImportModal,
  setShowImportModal,
  showExportModal,
  setShowExportModal,
  showBatchPrint,
  setShowBatchPrint,
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const { canCreate, canUpdate, isSuperAdmin } = usePermissions();
  const { isLoading: ordersLoading } = useModules();
  const {
    invoices = [],
    returns = [],
  } = useSales();

  const [activeTab, setActiveTab] = useState(initialSubtab);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Toggleable list columns (persisted per browser).
  const SO_COLS = [
    { key: 'order_number', label: t('order_number') || 'Order #' },
    { key: 'customer', label: t('customer') || 'Customer' },
    { key: 'date', label: t('date') || 'Date' },
    { key: 'quantity', label: t('quantity') || 'Quantity' },
    { key: 'amount', label: t('amount') || 'Amount' },
    { key: 'payment_status', label: t('payment_status') || 'Payment' },
    { key: 'status', label: t('status') || 'Status' },
  ];
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('so_visible_cols')); if (s && typeof s === 'object') return s; } catch { /* ignore */ }
    return { order_number: true, customer: true, date: true, quantity: true, amount: true, payment_status: true, status: true };
  });
  useEffect(() => { try { localStorage.setItem('so_visible_cols', JSON.stringify(visibleCols)); } catch { /* ignore */ } }, [visibleCols]);
  const colOn = (k) => visibleCols[k] !== false;
  const toggleCol = (k) => setVisibleCols(prev => ({ ...prev, [k]: !colOn(k) }));
  const paymentStatusColor = (s) => ({
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
    pending: 'bg-slate-100 text-slate-600',
  }[s] || 'bg-slate-100 text-slate-600');
  const paymentStatusLabel = (s) => (s === 'partial' ? (t('partially_paid') || 'Partially paid') : (t(s) || s || '-'));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedOrders, setPaginatedOrders] = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const pageSize = 20;

  // Check if an order has returns
  const orderHasReturns = useCallback((orderId) => {
    return returns.some(r => r.sales_order_id === orderId);
  }, [returns]);

  // Check if an order already has an invoice (uses backend-provided flag)
  const orderHasInvoice = useCallback((order) => {
    // Primary: use backend has_invoice flag (reliable, no cross-context dependency)
    if (order.has_invoice !== undefined) return order.has_invoice;
    // Fallback: check invoices from context
    return invoices.some(inv => inv.sales_order_id === order.id && inv.status !== 'cancelled');
  }, [invoices]);

  // Server-side fetch for orders
  const fetchOrders = useCallback(async () => {
    setPoLoading(true);
    try {
      const params = { page: currentPage, page_size: pageSize };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await apiClient.get('/sales-orders', { params });
      const data = response.data?.data || [];
      const meta = response.data?.meta || {};
      setPaginatedOrders(data);
      setTotalOrders(meta.total || data.length);
      setTotalPages(meta.total_pages || Math.ceil((meta.total || data.length) / pageSize));
    } catch (e) {
      console.error('Failed to load sales orders', e);
      setPaginatedOrders([]);
    } finally {
      setPoLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  // Sync filteredOrders from paginated data
  useEffect(() => {
    setFilteredOrders(paginatedOrders);
  }, [paginatedOrders]);

  const handleDeleteConfirm = async () => {
    if (orderToDelete && onDeleteOrder) {
      await onDeleteOrder(orderToDelete.id);
      fetchOrders();
    }
    setShowDeleteDialog(false);
    setOrderToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Buyurtmalar · Takliflar · Yetkazib berishlar · Qaytarishlar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('orders') || 'Buyurtmalar'}
          </TabsTrigger>
          <TabsTrigger value="quotations" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 mr-2" />
            {t('sales_subtab_quotations') || 'Takliflar'}
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="data-[state=active]:bg-white">
            <Truck className="w-4 h-4 mr-2" />
            {t('deliveries') || 'Yetkazib berishlar'}
          </TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-white">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('returns') || 'Qaytarishlar'}
          </TabsTrigger>
        </TabsList>

        {/* Orders List Tab */}
        <TabsContent value="list" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">{t('orders') || 'Orders'}</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  {setShowImportModal && setShowExportModal && (
                    <ImportExportButtons
                      onImport={() => setShowImportModal(true)}
                      onExport={() => setShowExportModal(true)}
                    />
                  )}
                  {setShowBatchPrint && (
                    <Button variant="outline" size="sm" onClick={() => setShowBatchPrint(true)} disabled={filteredOrders.length === 0}>
                      <Printer className="w-4 h-4 mr-1" />
                      {t('print') || 'Print'}
                    </Button>
                  )}
                  {canCreate(MODULES.SALES) && onCreateOrder && (
                    <Button onClick={onCreateOrder} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                      <Plus className="w-4 h-4 mr-2" /> {t('new_order') || 'New Order'}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={`${t('search') || 'Search'}...`}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                    <SelectItem value="quotation">{t('quotation') || 'Quotation'}</SelectItem>
                    <SelectItem value="confirmed">{t('confirmed') || 'Confirmed'}</SelectItem>
                    <SelectItem value="processing">{t('processing') || 'Processing'}</SelectItem>
                    <SelectItem value="shipped">{t('shipped') || 'Shipped'}</SelectItem>
                    <SelectItem value="delivered">{t('delivered') || 'Delivered'}</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 whitespace-nowrap">
                      <SlidersHorizontal className="w-4 h-4" />
                      {t('columns') || 'Columns'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56">
                    <p className="text-xs font-semibold text-slate-500 mb-2">{t('visible_columns') || 'Visible columns'}</p>
                    <div className="space-y-2">
                      {SO_COLS.map(c => (
                        <label key={c.key} className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                          <span>{c.label}</span>
                          <Switch checked={colOn(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(ordersLoading || poLoading) ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_orders_found') || 'No orders found'}</p>
                  {canCreate(MODULES.SALES) && onCreateOrder && (
                    <Button onClick={onCreateOrder} className="mt-4">{t('create_first_order') || 'Create First Order'}</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {colOn('order_number') && <TableHead>{t('order_number') || 'Order #'}</TableHead>}
                        {colOn('customer') && <TableHead>{t('customer') || 'Customer'}</TableHead>}
                        {colOn('date') && <TableHead>{t('date') || 'Date'}</TableHead>}
                        {colOn('quantity') && <TableHead className="text-right">{t('quantity') || 'Quantity'}</TableHead>}
                        {colOn('amount') && <TableHead>{t('amount') || 'Amount'}</TableHead>}
                        {colOn('payment_status') && <TableHead>{t('payment_status') || 'Payment'}</TableHead>}
                        {colOn('status') && <TableHead>{t('status') || 'Status'}</TableHead>}
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-slate-50">
                          {colOn('order_number') && (
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                {order.order_number}
                                {orderHasReturns(order.id) && (
                                  <MessageSquareWarning className="w-4 h-4 text-red-500" title={t('has_returns') || 'Has Returns'} />
                                )}
                              </div>
                            </TableCell>
                          )}
                          {colOn('customer') && <TableCell className="font-medium">{order.customer_name}</TableCell>}
                          {colOn('date') && (
                            <TableCell className="text-sm">
                              {order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                          )}
                          {colOn('quantity') && (
                            <TableCell className="text-right text-sm">
                              {order.total_quantity != null ? Number(order.total_quantity).toLocaleString() : '-'}
                            </TableCell>
                          )}
                          {colOn('amount') && <TableCell className="font-semibold">{formatCurrency(order.total_amount)}</TableCell>}
                          {colOn('payment_status') && (
                            <TableCell>
                              <Badge className={`${paymentStatusColor(order.payment_status)} capitalize`}>{paymentStatusLabel(order.payment_status)}</Badge>
                            </TableCell>
                          )}
                          {colOn('status') && (
                            <TableCell>
                              <Badge className={orderStatusClass(order.status)}>{t(order.status) || order.status}</Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {/* Status lifecycle: confirm via POST /confirm, cancel via
                                  POST /cancel; shipped/delivered are driven by delivery
                                  validation — the backend rejects direct PUT status writes. */}
                              {canUpdate(MODULES.SALES) && (order.status === 'draft' || order.status === 'quotation') && onUpdateStatus && (
                                <Button size="sm" variant="ghost" onClick={() => onUpdateStatus(order.id, 'confirmed')} title={t('confirm') || 'Tasdiqlash'}>
                                  <CheckCircle className="w-4 h-4 text-purple-600" />
                                </Button>
                              )}
                              {canCreate(MODULES.SALES) && ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) && !orderHasInvoice(order) && onCreateInvoice && (
                                <Button size="sm" variant="ghost" onClick={() => onCreateInvoice(order.id)} title={t('create_invoice') || 'Create Invoice'}>
                                  <Receipt className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                              {/* Delivered-basis partial invoice (?basis=delivered) —
                                  multiple per order allowed, so no has_invoice gate. */}
                              {canCreate(MODULES.SALES) && ['processing', 'shipped', 'delivered'].includes(order.status) && onCreateInvoiceDelivered && (
                                <Button size="sm" variant="ghost" onClick={() => onCreateInvoiceDelivered(order.id)} title={t('invoice_bill_delivered') || 'Yetkazilganini fakturalash'}>
                                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                                </Button>
                              )}
                              {onViewOrder && (
                                <Button size="sm" variant="ghost" onClick={() => onViewOrder(order)} title={t('view') || 'View'}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              {onPrintOrder && (
                                <Button size="sm" variant="ghost" onClick={() => onPrintOrder(order)} title={t('print') || 'Print'}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                              )}
                              {canUpdate(MODULES.SALES) && (order.status === 'draft' || order.status === 'quotation') && onEditOrder && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onEditOrder(order)}
                                  title={t('edit') || 'Edit'}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {isSuperAdmin && !['cancelled', 'shipped', 'delivered'].includes(order.status) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => { setOrderToDelete(order); setShowDeleteDialog(true); }}
                                  title={t('cancel_order_title') || 'Buyurtmani bekor qilish'}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <span className="text-sm text-slate-600">
                        {t('showing') || 'Showing'} {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalOrders)} {t('of') || 'of'} {totalOrders}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quotations Tab */}
        <TabsContent value="quotations" className="mt-4">
          <Quotations />
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="mt-4">
          <DeliveryOrders />
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="mt-4">
          <Returns />
        </TabsContent>
      </Tabs>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('cancel_order_title') || 'Buyurtmani bekor qilish'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancel_order_confirm') || 'Haqiqatan ham bu buyurtmani bekor qilmoqchimisiz?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {orderToDelete && (
            <div className="py-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('order_number') || 'Order #'}:</span>
                <span className="font-medium">{orderToDelete.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('customer') || 'Customer'}:</span>
                <span className="font-medium">{orderToDelete.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('amount') || 'Amount'}:</span>
                <span className="font-medium">{formatCurrency(orderToDelete.total_amount)}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('back') || 'Orqaga'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              <X className="w-4 h-4 mr-2" />
              {t('cancel_order_action') || 'Bekor qilish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
