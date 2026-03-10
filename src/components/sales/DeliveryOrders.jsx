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
  Truck,
  CheckCircle,
  XCircle,
  Eye,
  Package,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useSales } from '@/components/contexts/SalesContext';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { salesService } from "@/api/services/sales";
import { inventoryService } from "@/api/services/inventory";
import { toast } from 'sonner';

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  ready: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function DeliveryOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { salesOrders = [] } = useSales();
  const { canCreate } = usePermissions();

  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [filteredDOs, setFilteredDOs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showStockWarningModal, setShowStockWarningModal] = useState(false);
  const [stockWarningItems, setStockWarningItems] = useState([]);
  const [selectedDO, setSelectedDO] = useState(null);
  const [loading, setLoading] = useState(false);
  const [carriers, setCarriers] = useState([]);

  const [newDO, setNewDO] = useState({
    sales_order_id: '',
    shipping_method: '',
    carrier: '',
    notes: '',
    lines: [],
  });

  const [validateData, setValidateData] = useState({
    lines: [],
  });

  // Fetch delivery orders from API
  const fetchDeliveryOrders = async () => {
    setLoading(true);
    try {
      const response = await salesService.listDeliveryOrders();
      // API returns { data: [...], meta: {...} } structure
      const orders = Array.isArray(response) ? response : (response?.data || []);
      setDeliveryOrders(orders);
    } catch (error) {
      console.error('Failed to fetch delivery orders:', error);
      setDeliveryOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch carriers
  const fetchCarriers = async () => {
    try {
      const data = await inventoryService.listCarriers({ active: 'true' });
      setCarriers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch carriers:', error);
      setCarriers([]);
    }
  };

  useEffect(() => {
    fetchDeliveryOrders();
    fetchCarriers();
  }, []);

  // Filter delivery orders
  useEffect(() => {
    // Ensure deliveryOrders is always an array
    let filtered = Array.isArray(deliveryOrders) ? deliveryOrders : [];
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(d =>
        d.delivery_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.so_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredDOs(filtered);
  }, [deliveryOrders, searchQuery, statusFilter]);

  // Get confirmed sales orders that can have DOs created
  const confirmedSOs = salesOrders.filter(so =>
    so.status === 'confirmed' || so.status === 'processing'
  );

  const handleSelectSO = async (soId) => {
    const soFromList = salesOrders.find(o => o.id === soId);
    if (!soFromList) return;

    try {
      // Fetch full SO details including lines from API
      const so = await salesService.getOrder(soId);
      const soLines = so.lines || so.items || [];

      setNewDO({
        ...newDO,
        sales_order_id: soId,
        so_number: so.order_number,
        customer_id: so.customer_id,
        customer_name: so.customer_name,
        warehouse_id: so.warehouse_id,
        lines: soLines.map(item => ({
          so_line_id: item.id,
          product_id: item.product_id,
          product_name: item.description || item.product_name || 'Product',
          quantity_ordered: item.quantity,
          quantity_to_deliver: item.quantity - (item.quantity_delivered || 0),
          unit_price: item.unit_price || 0,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch SO details:', error);
      // Fallback to list data
      setNewDO({
        ...newDO,
        sales_order_id: soId,
        so_number: soFromList.order_number,
        customer_id: soFromList.customer_id,
        customer_name: soFromList.customer_name,
        warehouse_id: soFromList.warehouse_id,
        lines: [],
      });
    }
  };

  const handleCreateDO = async () => {
    if (!newDO.sales_order_id) return;

    // Filter lines with quantity to deliver > 0
    const validLines = newDO.lines
      .filter(line => line.quantity_to_deliver > 0)
      .map(line => ({
        so_line_id: line.so_line_id,
        product_id: line.product_id,
        product_name: line.product_name,
        quantity_ordered: line.quantity_ordered,
        quantity_to_deliver: line.quantity_to_deliver,
        unit_price: line.unit_price,
      }));

    if (validLines.length === 0) {
      toast.error(t('no_items_to_deliver') || 'Please enter quantities for at least one item');
      return;
    }

    try {
      const payload = {
        sales_order_id: newDO.sales_order_id,
        shipping_method: newDO.shipping_method || '',
        carrier: newDO.carrier || '',
        notes: newDO.notes || '',
        lines: validLines,
      };
      await salesService.createDeliveryOrder(payload);

      // Refresh the list
      await fetchDeliveryOrders();
      setShowCreateModal(false);
      setNewDO({
        sales_order_id: '',
        shipping_method: '',
        carrier: '',
        notes: '',
        lines: [],
      });
    } catch (error) {
      console.error('Failed to create delivery order:', error);
      toast.error(t('error_creating_delivery') || 'Failed to create delivery order');
    }
  };

  const handleStartValidate = async (doItem) => {
    try {
      // Fetch full DO details including lines
      const fullDO = await salesService.getDeliveryOrder(doItem.id);
      const doLines = fullDO.lines || [];

      setSelectedDO(fullDO);
      setValidateData({
        lines: doLines.map(line => ({
          ...line,
          quantity_to_ship: line.quantity_to_deliver || 0,
        })),
      });
      setShowValidateModal(true);
    } catch (error) {
      console.error('Failed to fetch DO details:', error);
      toast.error(t('error_fetching_details') || 'Failed to fetch delivery order details');
    }
  };

  const handleValidateDO = async () => {
    if (!selectedDO) return;

    try {
      await salesService.validateDeliveryOrder(selectedDO.id);
      // Refresh the list
      await fetchDeliveryOrders();
      setShowValidateModal(false);
      setSelectedDO(null);
    } catch (error) {
      console.error('Failed to validate delivery order:', error);
      if (error.response?.status === 422 && error.response?.data?.errors) {
        const items = error.response.data.errors;
        setStockWarningItems(items);
        setShowValidateModal(false);
        setShowStockWarningModal(true);
      } else {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
        toast.error((t('error_validating_delivery') || 'Failed to validate delivery order') + ': ' + errorMsg);
      }
    }
  };

  const handleForceValidateDO = async () => {
    if (!selectedDO) return;
    try {
      await salesService.validateDeliveryOrder(selectedDO.id, { force: true });
      await fetchDeliveryOrders();
      setShowStockWarningModal(false);
      setStockWarningItems([]);
      setSelectedDO(null);
    } catch (error) {
      console.error('Failed to force validate delivery order:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';
      toast.error((t('error_validating_delivery') || 'Failed to validate delivery order') + ': ' + errorMsg);
    }
  };

  const handleCancelDO = (doItem) => {
    setSelectedDO(doItem);
    setShowCancelModal(true);
  };

  const confirmCancelDO = async () => {
    if (!selectedDO) return;
    try {
      await salesService.cancelDeliveryOrder(selectedDO.id);
      await fetchDeliveryOrders();
      setShowCancelModal(false);
      setSelectedDO(null);
    } catch (error) {
      console.error('Failed to cancel delivery order:', error);
      toast.error(t('error_cancelling_delivery') || 'Failed to cancel delivery order');
    }
  };

  const updateLine = (index, field, value) => {
    setNewDO(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line),
    }));
  };

  const updateValidateLine = (index, field, value) => {
    setValidateData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line),
    }));
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: t('draft') || 'Draft',
      ready: t('ready') || 'Ready',
      shipped: t('shipped') || 'Shipped',
      delivered: t('delivered') || 'Delivered',
      cancelled: t('cancelled') || 'Cancelled',
    };
    return labels[status] || status;
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            {t('delivery_orders') || 'Delivery Orders'}
          </CardTitle>
          {canCreate(MODULES.SALES) && (
            <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Plus className="w-4 h-4 mr-2" /> {t('new_delivery') || 'New Delivery'}
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
              <SelectItem value="ready">{t('ready') || 'Ready'}</SelectItem>
              <SelectItem value="shipped">{t('shipped') || 'Shipped'}</SelectItem>
              <SelectItem value="delivered">{t('delivered') || 'Delivered'}</SelectItem>
              <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-16">
            <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-500">{t('loading') || 'Loading...'}</p>
          </div>
        ) : filteredDOs.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t('no_deliveries_yet') || 'No delivery orders yet'}</p>
            <p className="text-slate-400 text-sm mt-2">
              {t('deliveries_auto_created') || 'Delivery orders are auto-created when sales orders are confirmed'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('do_number') || 'DO #'}</TableHead>
                  <TableHead>{t('so_number') || 'SO #'}</TableHead>
                  <TableHead>{t('customer') || 'Customer'}</TableHead>
                  <TableHead>{t('delivery_date') || 'Delivery Date'}</TableHead>
                  <TableHead>{t('carrier') || 'Carrier'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDOs.map((doItem) => (
                  <TableRow key={doItem.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-sm">{doItem.delivery_number}</TableCell>
                    <TableCell className="font-mono text-sm">{doItem.so_number}</TableCell>
                    <TableCell className="font-medium">{doItem.customer_name || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {doItem.delivery_date ? format(new Date(doItem.delivery_date), 'dd.MM.yyyy') : '-'}
                    </TableCell>
                    <TableCell>{doItem.carrier || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[doItem.status]}>{getStatusLabel(doItem.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedDO(doItem); setShowDetailModal(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(doItem.status === 'draft' || doItem.status === 'ready') && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleStartValidate(doItem)} title={t('validate_ship') || 'Validate & Ship'}>
                              <Send className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCancelDO(doItem)} title={t('cancel') || 'Cancel'}>
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
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

      {/* Create DO Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_delivery_order') || 'New Delivery Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('select_sales_order') || 'Select Sales Order'} *</label>
                <Select value={newDO.sales_order_id} onValueChange={handleSelectSO}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_so') || 'Select SO'} />
                  </SelectTrigger>
                  <SelectContent>
                    {confirmedSOs.length === 0 ? (
                      <SelectItem value="-" disabled>{t('no_confirmed_sos') || 'No confirmed SOs'}</SelectItem>
                    ) : (
                      confirmedSOs.map((so) => (
                        <SelectItem key={so.id} value={so.id}>
                          {so.order_number} - {so.customer_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('shipping_method') || 'Shipping Method'}</label>
                <Input
                  value={newDO.shipping_method}
                  onChange={(e) => setNewDO({ ...newDO, shipping_method: e.target.value })}
                  placeholder={t('shipping_method_placeholder') || 'e.g., Express, Standard'}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t('carrier') || 'Carrier'}</label>
              <Select value={newDO.carrier} onValueChange={(value) => setNewDO({ ...newDO, carrier: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_carrier') || 'Select carrier'} />
                </SelectTrigger>
                <SelectContent>
                  {carriers.length === 0 ? (
                    <SelectItem value="-" disabled>{t('no_carriers_found') || 'No carriers found'}</SelectItem>
                  ) : (
                    carriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.name}>
                        {carrier.name} ({carrier.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Line Items */}
            {newDO.lines.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('items_to_deliver') || 'Items to Deliver'}</label>
                <div className="space-y-2">
                  {newDO.lines.map((line, index) => (
                    <div key={index} className="bg-slate-50 p-3 rounded-lg">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <span className="text-sm font-medium">{line.product_name}</span>
                          <p className="text-xs text-slate-500">{t('ordered') || 'Ordered'}: {line.quantity_ordered}</p>
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-slate-500">{t('qty_to_deliver') || 'Qty to Deliver'}</label>
                          <Input
                            type="number"
                            value={line.quantity_to_deliver}
                            onChange={(e) => updateLine(index, 'quantity_to_deliver', parseFloat(e.target.value) || 0)}
                            max={line.quantity_ordered}
                          />
                        </div>
                        <div className="col-span-4 text-right">
                          <span className="text-sm text-slate-500">
                            {t('remaining') || 'Remaining'}: {line.quantity_ordered - (line.quantity_delivered || 0)}
                          </span>
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
                value={newDO.notes}
                onChange={(e) => setNewDO({ ...newDO, notes: e.target.value })}
                placeholder={t('delivery_notes') || 'Any notes about this delivery...'}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateDO}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!newDO.sales_order_id}
              >
                {t('create_delivery') || 'Create Delivery'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validate & Ship Modal */}
      <Dialog open={showValidateModal} onOpenChange={setShowValidateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              {t('validate_ship') || 'Validate & Ship'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm"><strong>{t('do_number') || 'DO #'}:</strong> {selectedDO?.delivery_number}</p>
              <p className="text-sm"><strong>{t('so_number') || 'SO #'}:</strong> {selectedDO?.so_number}</p>
              <p className="text-sm"><strong>{t('customer') || 'Customer'}:</strong> {selectedDO?.customer_name}</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">{t('inventory_warning') || 'Inventory will be updated'}</p>
                <p className="text-xs text-yellow-600">
                  {t('inventory_warning_desc') || 'Validating this delivery will decrease inventory for all items below.'}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t('items_to_ship') || 'Items to Ship'}</label>
              <div className="space-y-2">
                {validateData.lines.map((line, index) => (
                  <div key={index} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{line.product_name}</span>
                        <p className="text-xs text-slate-500">
                          {t('qty_to_deliver') || 'Qty to deliver'}: {line.quantity_to_deliver}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{line.quantity_to_deliver}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowValidateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleValidateDO}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('validate_ship') || 'Validate & Ship'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('delivery_details') || 'Delivery Details'}</DialogTitle>
          </DialogHeader>
          {selectedDO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('do_number') || 'DO Number'}</p>
                  <p className="font-mono font-medium">{selectedDO.delivery_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('so_number') || 'SO Number'}</p>
                  <p className="font-mono font-medium">{selectedDO.so_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('customer') || 'Customer'}</p>
                  <p className="font-medium">{selectedDO.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={statusColors[selectedDO.status]}>{getStatusLabel(selectedDO.status)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('delivery_date') || 'Delivery Date'}</p>
                  <p className="font-medium">
                    {selectedDO.delivery_date ? format(new Date(selectedDO.delivery_date), 'dd.MM.yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('carrier') || 'Carrier'}</p>
                  <p className="font-medium">{selectedDO.carrier || '-'}</p>
                </div>
              </div>

              {selectedDO.tracking_number && (
                <div>
                  <p className="text-sm text-slate-500">{t('tracking_number') || 'Tracking Number'}</p>
                  <p className="font-mono font-medium">{selectedDO.tracking_number}</p>
                </div>
              )}

              {selectedDO.lines && selectedDO.lines.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">{t('items') || 'Items'}</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {selectedDO.lines.map((line, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="font-medium">{line.product_name}</span>
                        <div className="text-right">
                          <span className="text-slate-600">
                            {line.quantity_delivered || 0}/{line.quantity_to_deliver}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">{t('delivered') || 'delivered'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDO.notes && (
                <div>
                  <p className="text-sm text-slate-500">{t('notes') || 'Notes'}</p>
                  <p className="text-sm">{selectedDO.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Warning Modal */}
      <Dialog open={showStockWarningModal} onOpenChange={setShowStockWarningModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              {t('insufficient_stock') || "Zaxira yetarli emas"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              {t('stock_warning_delivery_desc') || "Quyidagi mahsulotlar uchun skladda yetarli zaxira mavjud emas:"}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg divide-y divide-red-200">
              {stockWarningItems.map((item, i) => (
                <div key={i} className="p-3 flex items-center justify-between">
                  <span className="font-medium text-sm">{item.product_name}</span>
                  <div className="text-sm text-right">
                    <span className="text-red-600 font-medium">{t('available') || 'Mavjud'}: {item.available}</span>
                    <span className="mx-2 text-slate-400">|</span>
                    <span className="text-slate-600">{t('requested') || "So'ralgan"}: {item.requested}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowStockWarningModal(false); setStockWarningItems([]); }}
                className="flex-1"
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleForceValidateDO}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {t('proceed_anyway') || "Baribir davom etish"}
              </Button>
            </div>
          </div>
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
              {t('confirm_cancel_delivery_message') || 'Are you sure you want to cancel this delivery order?'}
            </p>
            {selectedDO && (
              <p className="mt-2 font-mono text-sm text-slate-500">
                {selectedDO.delivery_number}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(false)} className="flex-1">
              {t('no') || 'No'}
            </Button>
            <Button
              onClick={confirmCancelDO}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {t('yes_cancel') || 'Yes, Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
