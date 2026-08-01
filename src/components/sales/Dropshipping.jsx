import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Search,
  Truck,
  Package,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  TrendingUp,
  Building2,
  ShoppingBag,
  DollarSign,
  Clock,
  AlertCircle,
  RefreshCw,
  Settings,
  Link2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { dropshippingService } from '@/api/services/dropshipping';
import { contactsService } from '@/api/services/contacts';
import { inventoryService } from '@/api/services/inventory';
import { toast } from 'sonner';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  po_created: 'bg-blue-100 text-blue-800',
  sent_to_vendor: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels = {
  pending: 'Pending',
  po_created: 'PO Created',
  sent_to_vendor: 'Sent to Vendor',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function Dropshipping() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();

  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [productVendors, setProductVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [allVendorsList, setAllVendorsList] = useState([]);
  const [allProductsList, setAllProductsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showProductVendorModal, setShowProductVendorModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [shipData, setShipData] = useState({
    tracking_number: '',
    carrier: '',
    estimated_delivery: '',
    notes: '',
  });
  const [vendorSettings, setVendorSettings] = useState({
    vendor_id: '',
    is_dropship_enabled: true,
    auto_send_orders: false,
    notification_email: '',
    default_lead_time_days: 3,
    markup_type: 'percentage',
    default_markup: 20,
    notes: '',
  });
  const [productVendorData, setProductVendorData] = useState({
    product_id: '',
    vendor_id: '',
    vendor_price: '',
    lead_time_days: 3,
    vendor_sku: '',
    priority: 100,
  });

  // Fetch data
  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchAllVendors();
    fetchAllProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'vendors') {
      fetchVendors();
    } else if (activeTab === 'products') {
      fetchProducts();
      fetchProductVendors();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await dropshippingService.listOrders();
      setOrders(data?.items || data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error(t('failed_fetch_orders'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await dropshippingService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const data = await dropshippingService.listVendors();
      setVendors(data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await dropshippingService.getDropshippableProducts();
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchProductVendors = async () => {
    try {
      const data = await dropshippingService.listProductVendors();
      setProductVendors(data || []);
    } catch (error) {
      console.error('Failed to fetch product vendors:', error);
    }
  };

  const fetchAllVendors = async () => {
    try {
      const data = await contactsService.list({ contact_type: 'vendor' });
      setAllVendorsList(data?.items || data || []);
    } catch (error) {
      console.error('Failed to fetch vendors list:', error);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const data = await inventoryService.listProducts();
      setAllProductsList(data?.items || data || []);
    } catch (error) {
      console.error('Failed to fetch products list:', error);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.sales_order_number?.toLowerCase().includes(query) ||
        o.purchase_order_number?.toLowerCase().includes(query) ||
        o.vendor_name?.toLowerCase().includes(query) ||
        o.customer_name?.toLowerCase().includes(query) ||
        o.tracking_number?.toLowerCase().includes(query)
      );
    }
    return result;
  }, [orders, statusFilter, searchQuery]);

  // View order details
  const handleViewOrder = async (order) => {
    try {
      const data = await dropshippingService.getOrder(order.id);
      setSelectedOrder(data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error(t('failed_load_order'));
    }
  };

  // Mark as shipped
  const handleMarkShipped = async () => {
    if (!selectedOrder) return;
    try {
      await dropshippingService.markShipped(selectedOrder.id, shipData);
      toast.success(t('order_marked_shipped'));
      setShowShipModal(false);
      fetchOrders();
      // Refresh details
      const updated = await dropshippingService.getOrder(selectedOrder.id);
      setSelectedOrder(updated);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark as shipped');
    }
  };

  // Mark as delivered
  const handleMarkDelivered = async (id) => {
    try {
      await dropshippingService.markDelivered(id);
      toast.success(t('order_marked_delivered'));
      fetchOrders();
      if (selectedOrder?.id === id) {
        const updated = await dropshippingService.getOrder(id);
        setSelectedOrder(updated);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark as delivered');
    }
  };

  // Cancel order
  const handleCancelOrder = async (id) => {
    if (!confirm(t('confirm_cancel_dropship'))) return;
    try {
      await dropshippingService.cancelOrder(id);
      toast.success(t('order_cancelled'));
      fetchOrders();
      setShowDetailModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    }
  };

  // Save vendor settings
  const handleSaveVendorSettings = async () => {
    try {
      await dropshippingService.createVendorSettings(vendorSettings);
      toast.success(t('vendor_settings_saved'));
      setShowVendorModal(false);
      fetchVendors();
      setVendorSettings({
        vendor_id: '',
        is_dropship_enabled: true,
        auto_send_orders: false,
        notification_email: '',
        default_lead_time_days: 3,
        markup_type: 'percentage',
        default_markup: 20,
        notes: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    }
  };

  // Save product-vendor link
  const handleSaveProductVendor = async () => {
    try {
      const payload = {
        product_id: productVendorData.product_id,
        vendor_id: productVendorData.vendor_id,
        vendor_sku: productVendorData.vendor_sku || undefined,
        lead_time_days: productVendorData.lead_time_days || undefined,
        priority: productVendorData.priority || undefined,
      };
      if (productVendorData.vendor_price !== '' && productVendorData.vendor_price != null) {
        payload.vendor_price = parseFloat(productVendorData.vendor_price);
      }
      await dropshippingService.createProductVendor(payload);
      toast.success(t('product_vendor_linked'));
      setShowProductVendorModal(false);
      fetchProducts();
      fetchProductVendors();
      setProductVendorData({
        product_id: '',
        vendor_id: '',
        vendor_price: '',
        lead_time_days: 3,
        vendor_sku: '',
        priority: 100,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to link product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6" />
            {t('dropshipping') || 'Dropshipping'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('dropshipping_desc') || 'Manage supplier-direct-to-customer fulfillment'}
          </p>
        </div>
        <Button onClick={() => fetchOrders()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('refresh') || 'Refresh'}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('total_orders') || 'Total Orders'}</p>
                  <p className="text-2xl font-bold">{stats.total_orders}</p>
                </div>
                <ShoppingBag className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('pending') || 'Pending'}</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending_orders}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('total_margin') || 'Total Margin'}</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrencyCompact(stats.total_margin)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('avg_margin') || 'Avg Margin %'}</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avg_margin_pct?.toFixed(1)}%</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            {t('orders') || 'Orders'}
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {t('vendors') || 'Vendors'}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            {t('product_mapping') || 'Product Mapping'}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={t('search_orders') || 'Search orders...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t('filter_by_status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                    <SelectItem value="pending">{t('pending') || 'Pending'}</SelectItem>
                    <SelectItem value="po_created">{t('po_created') || 'PO Created'}</SelectItem>
                    <SelectItem value="sent_to_vendor">{t('sent_to_vendor') || 'Sent to Vendor'}</SelectItem>
                    <SelectItem value="shipped">{t('shipped') || 'Shipped'}</SelectItem>
                    <SelectItem value="delivered">{t('delivered') || 'Delivered'}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('sales_order') || 'Sales Order'}</TableHead>
                    <TableHead>{t('po_number') || 'PO Number'}</TableHead>
                    <TableHead>{t('vendor') || 'Vendor'}</TableHead>
                    <TableHead>{t('customer') || 'Customer'}</TableHead>
                    <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                    <TableHead className="text-right">{t('margin') || 'Margin'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead>{t('tracking') || 'Tracking'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        {t('loading')}...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {t('no_dropship_orders') || 'No dropship orders found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.sales_order_number}</TableCell>
                        <TableCell>{order.purchase_order_number || '-'}</TableCell>
                        <TableCell>{order.vendor_name}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                        <TableCell className="text-right">
                          <span className={order.margin > 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(order.margin)} ({order.margin_percent?.toFixed(1)}%)
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.status]}>
                            {t(order.status) || statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.tracking_number ? (
                            <span className="text-sm text-blue-600">{order.tracking_number}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewOrder(order)}
                              title={t('view')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {order.status === 'sent_to_vendor' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowShipModal(true);
                                }}
                                title={t('mark_shipped')}
                                className="text-indigo-600"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            {order.status === 'shipped' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMarkDelivered(order.id)}
                                title={t('mark_delivered')}
                                className="text-green-600"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowVendorModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('add_dropship_vendor') || 'Add Dropship Vendor'}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('vendor') || 'Vendor'}</TableHead>
                    <TableHead>{t('email') || 'Email'}</TableHead>
                    <TableHead>{t('lead_time') || 'Lead Time'}</TableHead>
                    <TableHead>{t('markup') || 'Markup'}</TableHead>
                    <TableHead>{t('auto_send') || 'Auto Send'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t('no_dropship_vendors') || 'No dropship vendors configured'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
                        <TableCell>{vendor.notification_email || '-'}</TableCell>
                        <TableCell>{vendor.default_lead_time_days} {t('days')}</TableCell>
                        <TableCell>
                          {vendor.markup_type === 'percentage'
                            ? `${vendor.default_markup}%`
                            : formatCurrency(vendor.default_markup)}
                        </TableCell>
                        <TableCell>
                          {vendor.auto_send_orders ? (
                            <Badge className="bg-green-100 text-green-800">{t('yes')}</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">{t('no')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {vendor.is_active ? (
                            <Badge className="bg-green-100 text-green-800">{t('active')}</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">{t('inactive')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowProductVendorModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('link_product_vendor') || 'Link Product to Vendor'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('dropshippable_products') || 'Dropshippable Products'}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead>{t('sku') || 'SKU'}</TableHead>
                    <TableHead>{t('default_vendor') || 'Default Vendor'}</TableHead>
                    <TableHead>{t('available_vendors') || 'Available Vendors'}</TableHead>
                    <TableHead className="text-right">{t('lowest_price') || 'Lowest Price'}</TableHead>
                    <TableHead>{t('fastest_lead_time') || 'Fastest Lead Time'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('no_dropship_products') || 'No dropshippable products found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product.product_id}>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell>{product.sku || '-'}</TableCell>
                        <TableCell>{product.default_vendor_name || '-'}</TableCell>
                        <TableCell>
                          <Badge>{product.available_vendors}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {product.lowest_vendor_price ? formatCurrency(product.lowest_vendor_price) : '-'}
                        </TableCell>
                        <TableCell>
                          {product.fastest_lead_time_days ? `${product.fastest_lead_time_days} ${t('days')}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {t('dropship_order')} - {selectedOrder?.sales_order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">{t('revenue')}</div>
                    <div className="text-xl font-bold">{formatCurrency(selectedOrder.subtotal)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">{t('cost')}</div>
                    <div className="text-xl font-bold">{formatCurrency(selectedOrder.total_cost)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">{t('margin')}</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(selectedOrder.margin)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">{t('margin_pct')}</div>
                    <div className="text-xl font-bold">{selectedOrder.margin_percent?.toFixed(1)}%</div>
                  </CardContent>
                </Card>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('status')}</span>
                    <Badge className={statusColors[selectedOrder.status]}>
                      {t(selectedOrder.status) || statusLabels[selectedOrder.status]}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('vendor')}</span>
                    <span>{selectedOrder.vendor_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('customer')}</span>
                    <span>{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('po_number')}</span>
                    <span>{selectedOrder.purchase_order_number || '-'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedOrder.tracking_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('tracking')}</span>
                      <span className="text-blue-600">{selectedOrder.tracking_number}</span>
                    </div>
                  )}
                  {selectedOrder.carrier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('carrier')}</span>
                      <span>{selectedOrder.carrier}</span>
                    </div>
                  )}
                  {selectedOrder.shipped_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('shipped_date')}</span>
                      <span>{format(new Date(selectedOrder.shipped_date), 'dd.MM.yyyy HH:mm')}</span>
                    </div>
                  )}
                  {selectedOrder.delivered_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('delivered_date')}</span>
                      <span>{format(new Date(selectedOrder.delivered_date), 'dd.MM.yyyy HH:mm')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lines */}
              {selectedOrder.lines?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">{t('items')}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('product')}</TableHead>
                        <TableHead className="text-right">{t('qty')}</TableHead>
                        <TableHead className="text-right">{t('vendor_price')}</TableHead>
                        <TableHead className="text-right">{t('sale_price')}</TableHead>
                        <TableHead className="text-right">{t('margin')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.product_name}</TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.vendor_price)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.sale_price)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(line.line_margin)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[line.status] || 'bg-gray-100'}>
                              {t(line.status) || line.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {['pending', 'po_created', 'sent_to_vendor'].includes(selectedOrder.status) && (
                  <Button
                    onClick={() => setShowShipModal(true)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {t('mark_shipped')}
                  </Button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <Button
                    onClick={() => handleMarkDelivered(selectedOrder.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('mark_delivered')}
                  </Button>
                )}
                {!['delivered', 'cancelled'].includes(selectedOrder.status) && (
                  <Button
                    variant="outline"
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="text-red-600"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {t('cancel')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ship Modal */}
      <Dialog open={showShipModal} onOpenChange={setShowShipModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mark_as_shipped') || 'Mark as Shipped'}</DialogTitle>
            <DialogDescription>
              {t('enter_shipping_details') || 'Enter shipping details for this dropship order'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('tracking_number')}</Label>
              <Input
                value={shipData.tracking_number}
                onChange={(e) => setShipData({ ...shipData, tracking_number: e.target.value })}
                placeholder={t('enter_tracking')}
              />
            </div>
            <div>
              <Label>{t('carrier')}</Label>
              <Input
                value={shipData.carrier}
                onChange={(e) => setShipData({ ...shipData, carrier: e.target.value })}
                placeholder={t('enter_carrier')}
              />
            </div>
            <div>
              <Label>{t('estimated_delivery')}</Label>
              <Input
                type="date"
                value={shipData.estimated_delivery}
                onChange={(e) => setShipData({ ...shipData, estimated_delivery: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('notes')}</Label>
              <Textarea
                value={shipData.notes}
                onChange={(e) => setShipData({ ...shipData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShipModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleMarkShipped}>
              <Send className="w-4 h-4 mr-2" />
              {t('confirm_shipped')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Settings Modal */}
      <Dialog open={showVendorModal} onOpenChange={setShowVendorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dropship_vendor_settings') || 'Dropship Vendor Settings'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('vendor')} *</Label>
              <Select
                value={vendorSettings.vendor_id}
                onValueChange={(value) => setVendorSettings({ ...vendorSettings, vendor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_vendor')} />
                </SelectTrigger>
                <SelectContent>
                  {allVendorsList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('notification_email')}</Label>
              <Input
                type="email"
                value={vendorSettings.notification_email}
                onChange={(e) => setVendorSettings({ ...vendorSettings, notification_email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('lead_time_days')}</Label>
                <Input
                  type="number"
                  value={vendorSettings.default_lead_time_days}
                  onChange={(e) => setVendorSettings({ ...vendorSettings, default_lead_time_days: parseInt(e.target.value) || 3 })}
                />
              </div>
              <div>
                <Label>{t('default_markup')}</Label>
                <Input
                  type="number"
                  value={vendorSettings.default_markup}
                  onChange={(e) => setVendorSettings({ ...vendorSettings, default_markup: parseFloat(e.target.value) || 20 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('auto_send_orders')}</Label>
              <Switch
                checked={vendorSettings.auto_send_orders}
                onCheckedChange={(checked) => setVendorSettings({ ...vendorSettings, auto_send_orders: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVendorModal(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveVendorSettings} disabled={!vendorSettings.vendor_id}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product-Vendor Link Modal */}
      <Dialog open={showProductVendorModal} onOpenChange={setShowProductVendorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('link_product_to_vendor') || 'Link Product to Dropship Vendor'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('product')} *</Label>
              <Select
                value={productVendorData.product_id}
                onValueChange={(value) => setProductVendorData({ ...productVendorData, product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product')} />
                </SelectTrigger>
                <SelectContent>
                  {allProductsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('vendor')} *</Label>
              <Select
                value={productVendorData.vendor_id}
                onValueChange={(value) => setProductVendorData({ ...productVendorData, vendor_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_vendor')} />
                </SelectTrigger>
                <SelectContent>
                  {allVendorsList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('vendor_price')}</Label>
                <Input
                  type="number"
                  value={productVendorData.vendor_price}
                  onChange={(e) => setProductVendorData({ ...productVendorData, vendor_price: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('lead_time_days')}</Label>
                <Input
                  type="number"
                  value={productVendorData.lead_time_days}
                  onChange={(e) => setProductVendorData({ ...productVendorData, lead_time_days: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>
            <div>
              <Label>{t('vendor_sku')}</Label>
              <Input
                value={productVendorData.vendor_sku}
                onChange={(e) => setProductVendorData({ ...productVendorData, vendor_sku: e.target.value })}
                placeholder={t('vendor_product_code')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductVendorModal(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveProductVendor}
              disabled={!productVendorData.product_id || !productVendorData.vendor_id}
            >
              {t('link_product')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
