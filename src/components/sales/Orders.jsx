import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useModules } from '@/components/contexts/ModulesContext';
import { useCustomers } from '@/components/contexts/CustomersContext';
import { useSales } from '@/components/contexts/SalesContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Plus, Search, ShoppingBag, Package, Truck,
  CheckCircle, FileText, Receipt, RotateCcw, Upload, Download, Eye, Printer, X,
  ClipboardList, MessageSquareWarning, CreditCard, ChevronLeft, ChevronRight, Edit
} from 'lucide-react';
import apiClient from '@/api/client';
import { format } from 'date-fns';
import { salesService } from '@/api/services/sales';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";

import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import Returns from './Returns';
import PaymentTerms from './PaymentTerms';
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  PrintPreviewModal,
  BatchPrintModal,
} from '@/components/shared';

export default function Orders({
  onCreateOrder,
  onEditOrder,
  onViewOrder,
  onPrintOrder,
  onUpdateStatus,
  onCreateInvoice,
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
  const { canCreate, canUpdate, canDelete, isSuperAdmin } = usePermissions();
  const { salesOrders = [], isLoading: ordersLoading } = useModules();
  const {
    invoices = [],
    returns = [],
  } = useSales();

  const [activeTab, setActiveTab] = useState('list');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const getStatusColor = (status) => {
    const statusColors = {
      draft: 'bg-slate-100 text-slate-800',
      quotation: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-purple-100 text-purple-800',
      processing: 'bg-yellow-100 text-yellow-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-slate-100 text-slate-800';
  };

  const handleDeleteConfirm = async () => {
    if (orderToDelete && onDeleteOrder) {
      await onDeleteOrder(orderToDelete.id);
      fetchOrders();
    }
    setShowDeleteDialog(false);
    setOrderToDelete(null);
  };

  // Export columns configuration
  const exportColumns = [
    { key: 'order_number', label: t('order_number') || 'Order #' },
    { key: 'customer_name', label: t('customer') || 'Customer' },
    { key: 'order_date', label: t('date') || 'Date' },
    { key: 'total_amount', label: t('amount') || 'Amount' },
    { key: 'status', label: t('status') || 'Status' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Orders List and Returns */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('list') || 'List'}
          </TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-white">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('returns') || 'Returns'}
          </TabsTrigger>
          <TabsTrigger value="payment-terms" className="data-[state=active]:bg-white">
            <CreditCard className="w-4 h-4 mr-2" />
            {t('paymentTerms') || 'Payment Terms'}
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
                        <TableHead>{t('order_number') || 'Order #'}</TableHead>
                        <TableHead>{t('customer') || 'Customer'}</TableHead>
                        <TableHead>{t('date') || 'Date'}</TableHead>
                        <TableHead>{t('amount') || 'Amount'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              {order.order_number}
                              {orderHasReturns(order.id) && (
                                <MessageSquareWarning className="w-4 h-4 text-red-500" title={t('has_returns') || 'Has Returns'} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{order.customer_name}</TableCell>
                          <TableCell className="text-sm">
                            {order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>{t(order.status) || order.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {canUpdate(MODULES.SALES) && (order.status === 'draft' || order.status === 'quotation') && onUpdateStatus && (
                                <Button size="sm" variant="ghost" onClick={() => onUpdateStatus(order.id, 'confirmed')} title={t('confirm') || 'Tasdiqlash'}>
                                  <CheckCircle className="w-4 h-4 text-purple-600" />
                                </Button>
                              )}
                              {canUpdate(MODULES.SALES) && order.status === 'confirmed' && onUpdateStatus && (
                                <Button size="sm" variant="ghost" onClick={() => onUpdateStatus(order.id, 'processing')} title={t('start_processing') || 'Ishlov berishni boshlash'}>
                                  <Package className="w-4 h-4 text-yellow-600" />
                                </Button>
                              )}
                              {canUpdate(MODULES.SALES) && order.status === 'processing' && onUpdateStatus && (
                                <Button size="sm" variant="ghost" onClick={() => onUpdateStatus(order.id, 'shipped')} title={t('mark_shipped') || 'Jo\'natildi'}>
                                  <Truck className="w-4 h-4 text-indigo-600" />
                                </Button>
                              )}
                              {canUpdate(MODULES.SALES) && order.status === 'shipped' && onUpdateStatus && (
                                <Button size="sm" variant="ghost" onClick={() => onUpdateStatus(order.id, 'delivered')} title={t('mark_delivered') || 'Yetkazildi'}>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                              {canCreate(MODULES.SALES) && ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) && !orderHasInvoice(order) && onCreateInvoice && (
                                <Button size="sm" variant="ghost" onClick={() => onCreateInvoice(order.id)} title={t('create_invoice') || 'Create Invoice'}>
                                  <Receipt className="w-4 h-4 text-green-600" />
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
                                  title={language === 'uz' ? 'Bekor qilish' : 'Cancel Order'}
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

        {/* Returns Tab */}
        <TabsContent value="returns" className="mt-4">
          <Returns />
        </TabsContent>

        {/* Payment Terms Tab */}
        <TabsContent value="payment-terms" className="mt-4">
          <PaymentTerms />
        </TabsContent>
      </Tabs>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'uz' ? 'Buyurtmani bekor qilish' : 'Cancel Order'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'uz'
                ? 'Haqiqatan ham bu buyurtmani bekor qilmoqchimisiz?'
                : 'Are you sure you want to cancel this order?'}
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
            <AlertDialogCancel>{language === 'uz' ? 'Ortga' : 'Back'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              <X className="w-4 h-4 mr-2" />
              {language === 'uz' ? 'Bekor qilish' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
