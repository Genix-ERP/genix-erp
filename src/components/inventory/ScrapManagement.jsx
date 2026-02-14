import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Package,
  Warehouse,
  DollarSign,
  CheckCircle2,
  XCircle,
  Filter,
  FileText,
  Eye,
  Ban,
  Check,
  HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

// Field Help Component - Odoo-style tooltip for field explanations
const FieldHelp = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-lg shadow-lg">
      <p>{text}</p>
    </TooltipContent>
  </Tooltip>
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required, className = "" }) => (
  <Label className={`flex items-center ${className}`}>
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </Label>
);

export default function ScrapManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    products = [],
    warehouses = [],
    inventory = [],
    scrapOrders = [],
    createScrapOrder,
    updateScrapOrder,
    confirmScrapOrder,
    cancelScrapOrder,
    getScrapSummary,
    isLoading
  } = useInventory();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [showForm, setShowForm] = useState(false);
  const [viewingScrap, setViewingScrap] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTab, setSelectedTab] = useState("orders");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scrapToConfirm, setScrapToConfirm] = useState(null);
  const [scrapToCancel, setScrapToCancel] = useState(null);

  // Cleanup modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowForm(false);
      setViewingScrap(null);
      setShowConfirmModal(false);
      setShowCancelModal(false);
    };
  }, []);

  const [formData, setFormData] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: 1,
    reason: "damaged",
    reason_notes: "",
    scrap_date: new Date().toISOString().split('T')[0],
    scrapped_by: ""
  });

  // Scrap reasons
  const scrapReasons = [
    { value: 'damaged', label: t('damaged') || 'Damaged' },
    { value: 'expired', label: t('expired') || 'Expired' },
    { value: 'defective', label: t('defective') || 'Defective' },
    { value: 'obsolete', label: t('obsolete') || 'Obsolete' },
    { value: 'quality_issue', label: t('quality_issue') || 'Quality Issue' },
    { value: 'other', label: t('other') || 'Other' }
  ];

  // Get summary
  const summary = useMemo(() => {
    return getScrapSummary ? getScrapSummary() : {
      totalOrders: 0,
      totalCost: 0,
      totalQuantity: 0,
      byReason: {},
      pendingOrders: 0
    };
  }, [getScrapSummary, scrapOrders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = scrapOrders;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const product = products.find(p => p.id === order.product_id);
        return order.scrap_number.toLowerCase().includes(query) ||
               product?.name.toLowerCase().includes(query);
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [scrapOrders, searchQuery, statusFilter, products]);

  const resetForm = () => {
    setFormData({
      product_id: "",
      warehouse_id: "",
      quantity: 1,
      reason: "damaged",
      reason_notes: "",
      scrap_date: new Date().toISOString().split('T')[0],
      scrapped_by: ""
    });
  };

  const handleOpenForm = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.product_id || !formData.warehouse_id) {
      alert(t('select_product_warehouse') || 'Please select product and warehouse');
      return;
    }

    if (formData.quantity <= 0) {
      alert(t('invalid_quantity') || 'Quantity must be greater than 0');
      return;
    }

    // Check available stock
    const availableStock = getAvailableStock(formData.product_id, formData.warehouse_id);
    if (formData.quantity > availableStock) {
      alert(t('insufficient_stock') || `Insufficient stock. Available: ${availableStock}`);
      return;
    }

    await createScrapOrder(formData);
    setShowForm(false);
    resetForm();
  };

  const handleConfirmClick = (scrap) => {
    setScrapToConfirm(scrap);
    setShowConfirmModal(true);
  };

  const handleConfirmScrap = async () => {
    if (scrapToConfirm) {
      await confirmScrapOrder(scrapToConfirm.id, 'Current User');
      setShowConfirmModal(false);
      setScrapToConfirm(null);
    }
  };

  const handleCancelClick = (scrap) => {
    setScrapToCancel(scrap);
    setShowCancelModal(true);
  };

  const handleCancelScrap = async () => {
    if (scrapToCancel) {
      await cancelScrapOrder(scrapToCancel.id);
      setShowCancelModal(false);
      setScrapToCancel(null);
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown';
  };

  const getWarehouseName = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'Unknown';
  };

  const getAvailableStock = (productId, warehouseId) => {
    const inv = inventory.find(i =>
      i.product_id === productId && i.warehouse_id === warehouseId
    );
    return inv?.quantity_on_hand ?? inv?.quantity ?? 0;
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-slate-100 text-slate-800'
    };
    const labels = {
      draft: t('draft') || 'Draft',
      completed: t('completed') || 'Completed',
      cancelled: t('cancelled') || 'Cancelled'
    };
    return (
      <Badge className={styles[status] || styles.draft}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getReasonLabel = (reason) => {
    const found = scrapReasons.find(r => r.value === reason);
    return found?.label || reason;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t('scrap_management') || 'Scrap Management'}
          </h2>
          <p className="text-sm text-slate-500">
            {t('scrap_management_description') || 'Record and track scrapped inventory items'}
          </p>
        </div>
        {canCreate(MODULES.INVENTORY) && (
          <Button
            onClick={handleOpenForm}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('create_scrap_order') || 'Create Scrap Order'}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_scrapped') || 'Total Scrapped'}</p>
                <p className="text-2xl font-bold text-slate-900">{summary.totalQuantity}</p>
              </div>
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('cost_impact') || 'Cost Impact'}</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalCost)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('scrap_orders') || 'Scrap Orders'}</p>
                <p className="text-2xl font-bold text-slate-900">{summary.totalOrders}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('pending_orders') || 'Pending Orders'}</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.pendingOrders}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="bg-white/80 p-1 rounded-lg border border-slate-200/60">
          <TabsTrigger value="orders" className="data-[state=active]:bg-blue-100">
            <FileText className="w-4 h-4 mr-2" />
            {t('scrap_orders') || 'Scrap Orders'}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:bg-purple-100">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {t('scrap_analysis') || 'Scrap Analysis'}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('search_scrap_orders') || 'Search by number or product...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                <SelectItem value="completed">{t('completed') || 'Completed'}</SelectItem>
                <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders Table */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('scrap_number') || 'Scrap #'}</TableHead>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead>{t('warehouse') || 'Warehouse'}</TableHead>
                    <TableHead className="text-right">{t('quantity') || 'Qty'}</TableHead>
                    <TableHead>{t('reason') || 'Reason'}</TableHead>
                    <TableHead className="text-right">{t('cost_impact') || 'Cost Impact'}</TableHead>
                    <TableHead>{t('date') || 'Date'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        {t('no_scrap_orders') || 'No scrap orders found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">
                          {order.scrap_number}
                        </TableCell>
                        <TableCell>{getProductName(order.product_id)}</TableCell>
                        <TableCell>{getWarehouseName(order.warehouse_id)}</TableCell>
                        <TableCell className="text-right">{order.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getReasonLabel(order.reason)}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(order.cost_impact || 0)}
                        </TableCell>
                        <TableCell>{order.scrap_date}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingScrap(order)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {order.status === 'draft' && (
                              <>
                                {canUpdate(MODULES.INVENTORY) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleConfirmClick(order)}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                )}
                                {canDelete(MODULES.INVENTORY) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleCancelClick(order)}
                                  >
                                    <Ban className="w-4 h-4" />
                                  </Button>
                                )}
                              </>
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

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Reason */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle>{t('scrap_by_reason') || 'Scrap by Reason'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(summary.byReason).length === 0 ? (
                    <p className="text-center text-slate-500 py-4">
                      {t('no_scrap_data') || 'No scrap data available'}
                    </p>
                  ) : (
                    Object.entries(summary.byReason).map(([reason, qty]) => (
                      <div key={reason} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="font-medium">{getReasonLabel(reason)}</span>
                        </div>
                        <Badge className="bg-red-100 text-red-800">
                          {qty} {t('units') || 'units'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle>{t('scrap_summary') || 'Scrap Summary'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700">{t('total_financial_loss') || 'Total Financial Loss'}</span>
                      <span className="text-2xl font-bold text-red-700">
                        {formatCurrency(summary.totalCost)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{t('total_units_scrapped') || 'Total Units Scrapped'}</span>
                      <span className="text-2xl font-bold text-slate-900">
                        {summary.totalQuantity}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700">{t('avg_per_order') || 'Avg per Order'}</span>
                      <span className="text-2xl font-bold text-blue-700">
                        {formatCurrency(summary.totalOrders > 0 ? Math.round(summary.totalCost / summary.totalOrders) : 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('create_scrap_order') || 'Create Scrap Order'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product */}
            <div className="space-y-2">
              <LabelWithHelp
                label={t('product') || 'Product'}
                required
                helpText={t('help_scrap_product') || "Chiqindiga chiqariladigan mahsulot. Faqat zaxira qilinadigan mahsulotlar ko'rsatiladi."}
              />
              <Select
                value={formData.product_id}
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product') || 'Select product'} />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_stockable !== false).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse */}
            <div className="space-y-2">
              <LabelWithHelp
                label={t('warehouse') || 'Warehouse'}
                required
                helpText={t('help_scrap_warehouse') || "Chiqindi mahsulot olinadigan ombor. Mavjud zaxira miqdori ko'rsatiladi."}
              />
              <Select
                value={formData.warehouse_id}
                onValueChange={(value) => setFormData({ ...formData, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.product_id && formData.warehouse_id && (
                <p className="text-xs text-slate-500">
                  {t('available_stock') || 'Available'}: {getAvailableStock(formData.product_id, formData.warehouse_id)}
                </p>
              )}
            </div>

            {/* Quantity & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp
                  label={t('quantity') || 'Quantity'}
                  required
                  helpText={t('help_scrap_quantity') || "Chiqindiga chiqariladigan miqdor. Mavjud zaxiradan oshmasligi kerak."}
                />
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp
                  label={t('scrap_date') || 'Scrap Date'}
                  helpText={t('help_scrap_date') || "Chiqindiga chiqarilgan sana. Hisobotlarda va tarixda ko'rsatiladi."}
                />
                <Input
                  type="date"
                  value={formData.scrap_date}
                  onChange={(e) => setFormData({ ...formData, scrap_date: e.target.value })}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <LabelWithHelp
                label={t('reason') || 'Reason'}
                required
                helpText={t('help_scrap_reason') || "Chiqindi sababi: shikastlangan, muddati o'tgan, nuqsonli, eskirgan yoki sifat muammosi."}
              />
              <Select
                value={formData.reason}
                onValueChange={(value) => setFormData({ ...formData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scrapReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason Notes */}
            <div className="space-y-2">
              <LabelWithHelp
                label={t('additional_notes') || "Qo'shimcha izohlar"}
                helpText={t('help_scrap_notes') || "Chiqindi haqida qo'shimcha tafsilotlar. Sababni aniqroq tushuntirish uchun."}
              />
              <Textarea
                value={formData.reason_notes}
                onChange={(e) => setFormData({ ...formData, reason_notes: e.target.value })}
                placeholder={t('enter_notes') || 'Enter additional details...'}
                rows={3}
              />
            </div>

            {/* Scrapped By */}
            <div className="space-y-2">
              <LabelWithHelp
                label={t('scrapped_by') || 'Scrapped By'}
                helpText={t('help_scrapped_by') || "Chiqindiga chiqargan shaxs ismi. Mas'uliyat va audit uchun muhim."}
              />
              <Input
                value={formData.scrapped_by}
                onChange={(e) => setFormData({ ...formData, scrapped_by: e.target.value })}
                placeholder={t('enter_name') || 'Enter name'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              {t('create_order') || 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewingScrap} onOpenChange={() => setViewingScrap(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('scrap_order_details') || 'Scrap Order Details'}
            </DialogTitle>
          </DialogHeader>

          {viewingScrap && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">{t('scrap_number') || 'Scrap Number'}</Label>
                  <p className="font-mono font-medium">{viewingScrap.scrap_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t('status') || 'Status'}</Label>
                  <div className="mt-1">{getStatusBadge(viewingScrap.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">{t('product') || 'Product'}</Label>
                  <p className="font-medium">{getProductName(viewingScrap.product_id)}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t('warehouse') || 'Warehouse'}</Label>
                  <p className="font-medium">{getWarehouseName(viewingScrap.warehouse_id)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">{t('quantity') || 'Quantity'}</Label>
                  <p className="font-medium">{viewingScrap.quantity}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t('cost_impact') || 'Cost Impact'}</Label>
                  <p className="font-medium text-red-600">{formatCurrency(viewingScrap.cost_impact || 0)}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-500">{t('reason') || 'Reason'}</Label>
                <p className="font-medium">{getReasonLabel(viewingScrap.reason)}</p>
                {viewingScrap.reason_notes && (
                  <p className="text-sm text-slate-500 mt-1">{viewingScrap.reason_notes}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">{t('scrap_date') || 'Scrap Date'}</Label>
                  <p className="font-medium">{viewingScrap.scrap_date}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t('scrapped_by') || 'Scrapped By'}</Label>
                  <p className="font-medium">{viewingScrap.scrapped_by || '-'}</p>
                </div>
              </div>

              {viewingScrap.approved_by && (
                <div>
                  <Label className="text-xs text-slate-500">{t('approved_by') || 'Approved By'}</Label>
                  <p className="font-medium">{viewingScrap.approved_by}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingScrap(null)}>
              {t('close') || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Scrap Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              {t('confirm_scrap_order') || 'Yaroqsiz buyurtmani tasdiqlash'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('confirm_scrap_message') || 'Haqiqatan ham bu yaroqsiz buyurtmani tasdiqlaysizmi? Bu zaxirani kamaytiradi.'}
            </p>
            {scrapToConfirm && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="font-medium">{scrapToConfirm.scrap_number}</p>
                <p className="text-sm text-slate-500">
                  {t('product')}: {getProductName(scrapToConfirm.product_id)}
                </p>
                <p className="text-sm text-slate-500">
                  {t('quantity')}: {scrapToConfirm.quantity}
                </p>
              </div>
            )}
            <p className="mt-3 text-sm text-orange-600">
              {t('inventory_will_be_reduced') || 'Zaxira miqdori kamaytiriladi.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmScrap}>
              {t('confirm') || 'Tasdiqlash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Scrap Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('cancel_scrap_order') || 'Yaroqsiz buyurtmani bekor qilish'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('cancel_scrap_message') || 'Haqiqatan ham bu yaroqsiz buyurtmani bekor qilmoqchimisiz?'}
            </p>
            {scrapToCancel && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="font-medium">{scrapToCancel.scrap_number}</p>
                <p className="text-sm text-slate-500">
                  {t('product')}: {getProductName(scrapToCancel.product_id)}
                </p>
                <p className="text-sm text-slate-500">
                  {t('quantity')}: {scrapToCancel.quantity}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              {t('no') || "Yo'q"}
            </Button>
            <Button variant="destructive" onClick={handleCancelScrap}>
              {t('yes_cancel') || 'Ha, bekor qilish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
