import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CalendarDays,
  CheckCircle2,
  Clock,
  Package,
  TrendingUp,
  Play,
  Send,
  X,
  ShoppingCart,
  Layers,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

import { useProcurement } from "@/components/contexts/ProcurementContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { procurementService } from "@/api/services/procurement";
import { inventoryService } from "@/api/services/inventory";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { toast } from 'sonner';

export default function BlanketOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { suppliers } = useProcurement();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  // State
  const [blanketOrders, setBlanketOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialogs
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReleaseForm, setShowReleaseForm] = useState(false);

  // Selected items
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    vendor_id: "",
    vendor_name: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    agreement_type: "quantity",
    total_value: 0,
    currency: "UZS",
    payment_terms: "",
    delivery_terms: "",
    warehouse_id: "",
    release_frequency: "as_needed",
    expiry_alert_days: 30,
    notes: "",
    lines: [],
  });

  // Release form data
  const [releaseData, setReleaseData] = useState({
    release_date: format(new Date(), "yyyy-MM-dd"),
    expected_date: "",
    notes: "",
    create_po: true,
    lines: [],
  });

  // Fetch data
  useEffect(() => {
    fetchBlanketOrders();
    fetchProducts();
    fetchWarehouses();
  }, []);

  const fetchBlanketOrders = async () => {
    setIsLoading(true);
    try {
      const data = await procurementService.listBlanketOrders();
      setBlanketOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch blanket orders:", error);
      setBlanketOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await inventoryService.listProducts({ limit: 1000 });
      setProducts(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const data = await inventoryService.listWarehouses();
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    }
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return blanketOrders.filter((order) => {
      const matchesSearch =
        order.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.blanket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [blanketOrders, searchQuery, statusFilter]);

  // Status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: "bg-gray-100 text-gray-800", label: t("draft") },
      active: { color: "bg-green-100 text-green-800", label: t("active") },
      on_hold: { color: "bg-yellow-100 text-yellow-800", label: t("on_hold") },
      completed: { color: "bg-blue-100 text-blue-800", label: t("completed") },
      expired: { color: "bg-red-100 text-red-800", label: t("expired") },
      cancelled: { color: "bg-red-100 text-red-800", label: t("cancelled") },
      confirmed: { color: "bg-purple-100 text-purple-800", label: t("confirmed") },
      shipped: { color: "bg-indigo-100 text-indigo-800", label: t("shipped") },
      received: { color: "bg-teal-100 text-teal-800", label: t("received") },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      vendor_id: "",
      vendor_name: "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      agreement_type: "quantity",
      total_value: 0,
      currency: "UZS",
      payment_terms: "",
      delivery_terms: "",
      warehouse_id: "",
      release_frequency: "as_needed",
      expiry_alert_days: 30,
      notes: "",
      lines: [],
    });
    setEditingOrder(null);
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      if (editingOrder) {
        await procurementService.updateBlanketOrder(editingOrder.id, formData);
      } else {
        await procurementService.createBlanketOrder(formData);
      }
      await fetchBlanketOrders();
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save blanket order:", error);
      toast.error(t("failed_to_save") || "Failed to save blanket order");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!orderToDelete) return;
    try {
      await procurementService.deleteBlanketOrder(orderToDelete.id);
      await fetchBlanketOrders();
      setShowDeleteConfirm(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error("Failed to delete blanket order:", error);
      toast.error(t("failed_to_delete") || "Failed to delete blanket order");
    }
  };

  // Handle activate
  const handleActivate = async (order) => {
    try {
      await procurementService.activateBlanketOrder(order.id);
      await fetchBlanketOrders();
      if (showDetails && selectedOrder?.id === order.id) {
        const updated = await procurementService.getBlanketOrder(order.id);
        setSelectedOrder(updated);
      }
    } catch (error) {
      console.error("Failed to activate blanket order:", error);
      toast.error(t("failed_to_activate") || "Failed to activate blanket order");
    }
  };

  // View details
  const handleViewDetails = async (order) => {
    try {
      const fullOrder = await procurementService.getBlanketOrder(order.id);
      setSelectedOrder(fullOrder);
      setShowDetails(true);
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    }
  };

  // Edit order
  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      title: order.title || "",
      description: order.description || "",
      vendor_id: order.vendor_id || "",
      vendor_name: order.vendor_name || "",
      start_date: order.start_date || "",
      end_date: order.end_date || "",
      agreement_type: order.agreement_type || "quantity",
      total_value: order.total_value || 0,
      currency: order.currency || "UZS",
      payment_terms: order.payment_terms || "",
      delivery_terms: order.delivery_terms || "",
      warehouse_id: order.warehouse_id || "",
      release_frequency: order.release_frequency || "as_needed",
      expiry_alert_days: order.expiry_alert_days || 30,
      notes: order.notes || "",
      lines: order.lines || [],
    });
    setShowForm(true);
  };

  // Add line to form
  const addLine = () => {
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        {
          product_id: "",
          product_name: "",
          agreed_quantity: 0,
          unit_price: 0,
          discount_percent: 0,
          lead_time_days: 0,
          notes: "",
        },
      ],
    });
  };

  // Update line
  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If product selected, get name and price
    if (field === "product_id" && value) {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[index].product_name = product.name;
        newLines[index].product_code = product.code || product.sku;
        newLines[index].unit_price = product.purchase_price || product.cost_price || 0;
      }
    }

    setFormData({ ...formData, lines: newLines });
  };

  // Remove line
  const removeLine = (index) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  // Calculate total value from lines
  const calculateTotalValue = useCallback(() => {
    return formData.lines.reduce((sum, line) => {
      const lineValue = (line.agreed_quantity || 0) * (line.unit_price || 0) * (1 - (line.discount_percent || 0) / 100);
      return sum + lineValue;
    }, 0);
  }, [formData.lines]);

  // Open release form
  const openReleaseForm = (order) => {
    setSelectedOrder(order);
    setReleaseData({
      release_date: format(new Date(), "yyyy-MM-dd"),
      expected_date: "",
      notes: "",
      create_po: true,
      lines: (order.lines || [])
        .filter((line) => line.remaining_quantity > 0)
        .map((line) => ({
          blanket_line_id: line.id,
          product_name: line.product_name,
          remaining_quantity: line.remaining_quantity,
          quantity: 0,
          unit_price: line.unit_price,
        })),
    });
    setShowReleaseForm(true);
  };

  // Submit release
  const handleSubmitRelease = async () => {
    try {
      const linesToSubmit = releaseData.lines.filter((l) => l.quantity > 0);
      if (linesToSubmit.length === 0) {
        toast.error(t("select_items") || "Please select items to release");
        return;
      }

      await procurementService.createBlanketOrderRelease(selectedOrder.id, {
        ...releaseData,
        lines: linesToSubmit,
      });

      await fetchBlanketOrders();
      setShowReleaseForm(false);

      // Refresh details if open
      if (showDetails) {
        const updated = await procurementService.getBlanketOrder(selectedOrder.id);
        setSelectedOrder(updated);
      }
    } catch (error) {
      console.error("Failed to create release:", error);
      toast.error(error.response?.data?.error?.message || t("failed_to_create_release") || "Failed to create release");
    }
  };

  // Confirm release
  const handleConfirmRelease = async (release) => {
    try {
      await procurementService.confirmBlanketOrderRelease(selectedOrder.id, release.id);
      const updated = await procurementService.getBlanketOrder(selectedOrder.id);
      setSelectedOrder(updated);
      await fetchBlanketOrders();
    } catch (error) {
      console.error("Failed to confirm release:", error);
      toast.error(t("failed_to_confirm") || "Failed to confirm release");
    }
  };

  // Cancel release
  const handleCancelRelease = async (release) => {
    try {
      await procurementService.cancelBlanketOrderRelease(selectedOrder.id, release.id);
      const updated = await procurementService.getBlanketOrder(selectedOrder.id);
      setSelectedOrder(updated);
      await fetchBlanketOrders();
    } catch (error) {
      console.error("Failed to cancel release:", error);
      toast.error(t("failed_to_cancel") || "Failed to cancel release");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('blanket_orders')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('blanket_orders_description')}
          </p>
        </div>
        {canCreate("purchase", "contract") && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('new_blanket_order')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t('search_blanket_orders')}
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
                <SelectItem value="all">{t('all_statuses')}</SelectItem>
                <SelectItem value="draft">{t('draft')}</SelectItem>
                <SelectItem value="active">{t('active')}</SelectItem>
                <SelectItem value="on_hold">{t('on_hold')}</SelectItem>
                <SelectItem value="completed">{t('completed')}</SelectItem>
                <SelectItem value="expired">{t('expired')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('order_number')}</TableHead>
                <TableHead>{t('title')}</TableHead>
                <TableHead>{t('vendor')}</TableHead>
                <TableHead>{t('period')}</TableHead>
                <TableHead>{t('utilization')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('no_blanket_orders_found')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.blanket_number}</TableCell>
                    <TableCell>{order.title}</TableCell>
                    <TableCell>{order.vendor_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {order.start_date} - {order.end_date}
                        {order.days_remaining > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({order.days_remaining} {t('days_left')})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={order.utilization_percent || 0} className="w-20 h-2" />
                        <span className="text-sm">{(order.utilization_percent || 0).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.status === "draft" && canUpdate("purchase", "contract") && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(order)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivate(order)}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {order.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReleaseForm(order)}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {order.status === "draft" && canDelete("purchase", "contract") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setOrderToDelete(order); setShowDeleteConfirm(true); }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); setShowForm(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? t('edit_blanket_order') : t('new_blanket_order')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('title')} *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('enter_title')}
                />
              </div>
              <div>
                <Label>{t('vendor')} *</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(value) => {
                    const vendor = suppliers.find((s) => s.id === value);
                    setFormData({
                      ...formData,
                      vendor_id: value,
                      vendor_name: vendor?.name || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_vendor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('warehouse')}</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(value) => setFormData({ ...formData, warehouse_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_warehouse')} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('start_date')} *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('end_date')} *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('release_frequency')}</Label>
                <Select
                  value={formData.release_frequency}
                  onValueChange={(value) => setFormData({ ...formData, release_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="as_needed">{t('as_needed')}</SelectItem>
                    <SelectItem value="weekly">{t('weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('currency')}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>{t('description')}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-base font-semibold">{t('items')}</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add_item')}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product')}</TableHead>
                    <TableHead>{t('quantity')}</TableHead>
                    <TableHead>{t('unit_price')}</TableHead>
                    <TableHead>{t('discount_percent')}</TableHead>
                    <TableHead>{t('total')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.product_id}
                          onValueChange={(value) => updateLine(index, "product_id", value)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder={t('select_product')} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.agreed_quantity}
                          onChange={(e) => updateLine(index, "agreed_quantity", parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, "unit_price", parseFloat(e.target.value) || 0)}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.discount_percent}
                          onChange={(e) => updateLine(index, "discount_percent", parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(
                          (line.agreed_quantity || 0) * (line.unit_price || 0) * (1 - (line.discount_percent || 0) / 100),
                          formData.currency
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {formData.lines.length > 0 && (
                <div className="flex justify-end mt-2">
                  <span className="font-semibold">
                    {t('total')}: {formatCurrency(calculateTotalValue(), formData.currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label>{t('notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.title || !formData.vendor_id || !formData.end_date}>
              {editingOrder ? t('update') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedOrder?.blanket_number} - {selectedOrder?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                <TabsTrigger value="lines">{t('items')}</TabsTrigger>
                <TabsTrigger value="releases">{t('releases')} ({selectedOrder.release_count || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('total_value')}</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(selectedOrder.total_value, selectedOrder.currency)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('released')}</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(selectedOrder.released_value, selectedOrder.currency)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('remaining')}</div>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(selectedOrder.remaining_value, selectedOrder.currency)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">{t('utilization')}</div>
                      <div className="text-2xl font-bold">
                        {(selectedOrder.utilization_percent || 0).toFixed(1)}%
                      </div>
                      <Progress value={selectedOrder.utilization_percent || 0} className="mt-2" />
                    </CardContent>
                  </Card>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('status')}</span>
                      {getStatusBadge(selectedOrder.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('vendor')}</span>
                      <span>{selectedOrder.vendor_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('warehouse')}</span>
                      <span>{selectedOrder.warehouse_name || "-"}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('start_date')}</span>
                      <span>{selectedOrder.start_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('end_date')}</span>
                      <span>{selectedOrder.end_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('days_remaining')}</span>
                      <span>{selectedOrder.days_remaining}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {selectedOrder.status === "active" && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => openReleaseForm(selectedOrder)}>
                      <Send className="w-4 h-4 mr-2" />
                      {t('create_release')}
                    </Button>
                  </div>
                )}
                {selectedOrder.status === "draft" && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={() => handleActivate(selectedOrder)}>
                      <Play className="w-4 h-4 mr-2" />
                      {t('activate')}
                    </Button>
                    <Button variant="outline" onClick={() => handleEdit(selectedOrder)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      {t('edit')}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lines">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-right">{t('agreed')}</TableHead>
                      <TableHead className="text-right">{t('released')}</TableHead>
                      <TableHead className="text-right">{t('remaining')}</TableHead>
                      <TableHead className="text-right">{t('unit_price')}</TableHead>
                      <TableHead className="text-right">{t('line_value')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedOrder.lines || []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div>{line.product_name}</div>
                          {line.product_code && (
                            <div className="text-sm text-muted-foreground">{line.product_code}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{line.agreed_quantity}</TableCell>
                        <TableCell className="text-right">{line.released_quantity}</TableCell>
                        <TableCell className="text-right text-green-600">{line.remaining_quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.unit_price, selectedOrder.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.line_value, selectedOrder.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="releases">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('release_number')}</TableHead>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('po_number')}</TableHead>
                      <TableHead className="text-right">{t('amount')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedOrder.releases || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t('no_releases_yet')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selectedOrder.releases || []).map((release) => (
                        <TableRow key={release.id}>
                          <TableCell className="font-medium">{release.release_number}</TableCell>
                          <TableCell>{release.release_date}</TableCell>
                          <TableCell>{release.po_number || "-"}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(release.total_amount, selectedOrder.currency)}
                          </TableCell>
                          <TableCell>{getStatusBadge(release.status)}</TableCell>
                          <TableCell className="text-right">
                            {release.status === "draft" && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleConfirmRelease(release)}
                                >
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelRelease(release)}
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Release Form Dialog */}
      <Dialog open={showReleaseForm} onOpenChange={setShowReleaseForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('create_release')}</DialogTitle>
            <DialogDescription>
              {t('release_form_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('release_date')}</Label>
                <Input
                  type="date"
                  value={releaseData.release_date}
                  onChange={(e) => setReleaseData({ ...releaseData, release_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('expected_delivery_date')}</Label>
                <Input
                  type="date"
                  value={releaseData.expected_date}
                  onChange={(e) => setReleaseData({ ...releaseData, expected_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create_po"
                checked={releaseData.create_po}
                onChange={(e) => setReleaseData({ ...releaseData, create_po: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="create_po">{t('create_po_automatically')}</Label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('product')}</TableHead>
                  <TableHead className="text-right">{t('available')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('unit_price')}</TableHead>
                  <TableHead className="text-right">{t('total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releaseData.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>{line.product_name}</TableCell>
                    <TableCell className="text-right">{line.remaining_quantity}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => {
                          const newLines = [...releaseData.lines];
                          newLines[index].quantity = Math.min(
                            parseFloat(e.target.value) || 0,
                            line.remaining_quantity
                          );
                          setReleaseData({ ...releaseData, lines: newLines });
                        }}
                        className="w-24 text-right"
                        max={line.remaining_quantity}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.unit_price, selectedOrder?.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.quantity * line.unit_price, selectedOrder?.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <span className="font-semibold">
                {t('release_total')}:{" "}
                {formatCurrency(
                  releaseData.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0),
                  selectedOrder?.currency
                )}
              </span>
            </div>

            <div>
              <Label>{t('notes')}</Label>
              <Textarea
                value={releaseData.notes}
                onChange={(e) => setReleaseData({ ...releaseData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseForm(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSubmitRelease}
              disabled={releaseData.lines.every((l) => l.quantity <= 0)}
            >
              <Send className="w-4 h-4 mr-2" />
              {t('create_release')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirm_delete')}</DialogTitle>
            <DialogDescription>
              {t('confirm_delete_blanket_order')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
