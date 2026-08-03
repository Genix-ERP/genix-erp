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
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileQuestion,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Trash2,
  Award,
  CalendarDays,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

import { useProcurement } from "@/components/contexts/ProcurementContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService } from "@/api/services/inventory";
import { procurementService } from "@/api/services/procurement";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { toast } from 'sonner';

export default function RFQManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    rfqs,
    suppliers,
    createRFQ,
    updateRFQ,
    deleteRFQ,
    selectRFQWinner,
    isLoading,
  } = useProcurement();
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline: "",
    items: [{ name: "", quantity: 1, unit: "dona", product_id: "" }],
    suppliers_invited: [],
  });

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Loading state for RFQ details
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Loading state for converting RFQ to PO
  const [convertingToPO, setConvertingToPO] = useState(false);

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        setProducts(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Only real RFQs. The old version synthesized pseudo-RFQ rows from every
  // draft purchase order and merged them in, so the list and its stat
  // counters mixed two entity types (docs/xarid-audit.md §5).
  const allRFQs = rfqs;

  // Filter RFQs
  const filteredRFQs = useMemo(() => {
    return allRFQs.filter((rfq) => {
      const matchesSearch =
        rfq.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rfq.rfq_number?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || rfq.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allRFQs, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: allRFQs.length,
      open: allRFQs.filter((r) => r.status === "open" || r.status === "draft").length,
      closed: allRFQs.filter((r) => r.status === "closed").length,
      responses: allRFQs.reduce((sum, r) => sum + (r.responses?.length || 0), 0),
    };
  }, [allRFQs]);

  const handleSubmit = async () => {
    const rfqData = {
      ...formData,
      items: formData.items.filter((item) => item.name.trim()),
    };
    await createRFQ(rfqData);
    resetForm();
  };

  const handleSendRFQ = async (rfq) => {
    await updateRFQ(rfq.id, { status: "open" });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Haqiqatan ham bu taklifni o'chirmoqchimisiz?")) {
      await deleteRFQ(id);
    }
  };

  const handleSelectWinner = async (rfqId, supplierId) => {
    await selectRFQWinner(rfqId, supplierId);
    setShowDetails(false);
  };

  const handleConvertToPO = async (rfqId) => {
    if (!window.confirm(t('confirm_convert_to_po') || "Bu RFQni buyurtmaga aylantirishni xohlaysizmi?")) {
      return;
    }

    setConvertingToPO(true);
    try {
      const result = await procurementService.convertRFQToPO(rfqId);
      toast.success(
        (t('po_created_success') || "Buyurtma muvaffaqiyatli yaratildi!") +
        ` ${t('order_number') || "Buyurtma raqami"}: ${result.order_number}, ` +
        `${t('vendor') || "Ta'minotchi"}: ${result.vendor_name}, ` +
        `${t('total') || "Jami"}: ${formatCurrency(result.total_amount || 0)}`
      );
      setShowDetails(false);
    } catch (error) {
      console.error('Failed to convert RFQ to PO:', error);
      toast.error(
        (t('po_creation_failed') || "Buyurtma yaratishda xatolik yuz berdi") +
        (error.response?.data?.error ? `: ${error.response.data.error}` : '')
      );
    } finally {
      setConvertingToPO(false);
    }
  };

  const handleViewDetails = async (rfq) => {
    setSelectedRFQ(rfq); // Show basic data immediately
    setShowDetails(true);
    setDetailsLoading(true);
    try {
      const fullRFQ = await procurementService.getRFQ(rfq.id);
      setSelectedRFQ(fullRFQ);
    } catch (error) {
      console.error('Failed to fetch RFQ details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: "", quantity: 1, unit: "dona", product_id: "" }],
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const updateItemMultiple = (index, updates) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
    }));
  };

  const toggleSupplier = (supplierId) => {
    setFormData({
      ...formData,
      suppliers_invited: formData.suppliers_invited.includes(supplierId)
        ? formData.suppliers_invited.filter((id) => id !== supplierId)
        : [...formData.suppliers_invited, supplierId],
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setFormData({
      title: "",
      description: "",
      deadline: "",
      items: [{ name: "", quantity: 1, unit: "dona", product_id: "" }],
      suppliers_invited: [],
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: "bg-gray-100 text-gray-800",
      open: "bg-blue-100 text-blue-800",
      closed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    const labels = {
      draft: t('draft') || "Qoralama",
      open: t('open') || "Ochiq",
      closed: t('closed') || "Yopilgan",
      cancelled: t('cancelled') || "Bekor qilingan",
    };
    return (
      <Badge className={styles[status] || styles.draft}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getSupplierName = (id) => {
    const supplier = suppliers.find((s) => s.id === id);
    return supplier?.name || (t('unknown') || "Noma'lum");
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_rfqs') || "Jami takliflar"}</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileQuestion className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('open_rfqs') || "Ochiq takliflar"}</p>
                <p className="text-2xl font-bold text-green-600">{stats.open}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('closed') || "Yopilgan"}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.closed}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('responses') || "Javoblar"}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.responses}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RFQ Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">{t('rfq_requests') || "Taklif so'rovlari (RFQ)"}</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t('search') || "Qidirish..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all') || "Hammasi"}</SelectItem>
                  <SelectItem value="draft">{t('draft') || "Qoralama"}</SelectItem>
                  <SelectItem value="open">{t('open') || "Ochiq"}</SelectItem>
                  <SelectItem value="closed">{t('closed') || "Yopilgan"}</SelectItem>
                </SelectContent>
              </Select>
              {canCreate(MODULES.PURCHASES) && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_rfq') || "Yangi RFQ"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredRFQs.length === 0 ? (
            <div className="text-center py-12">
              <FileQuestion className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_rfqs_found') || "Takliflar topilmadi"}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('rfq_number') || "RFQ raqami"}</TableHead>
                    <TableHead>{t('title') || "Sarlavha"}</TableHead>
                    <TableHead>{t('deadline') || "Muddat"}</TableHead>
                    <TableHead>{t('suppliers') || "Ta'minotchilar"}</TableHead>
                    <TableHead>{t('responses') || "Javoblar"}</TableHead>
                    <TableHead>{t('status') || "Status"}</TableHead>
                    <TableHead className="w-32">{t('actions') || "Amallar"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRFQs.map((rfq) => (
                    <TableRow key={rfq.id} className="hover:bg-slate-50">
                      <TableCell>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {rfq.rfq_number}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rfq.title}</div>
                          <div className="text-xs text-slate-500 truncate max-w-48">
                            {rfq.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarDays className="w-3 h-3 text-slate-400" />
                          {rfq.deadline
                            ? format(new Date(rfq.deadline), "dd.MM.yyyy")
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {rfq.invitation_count || rfq.suppliers_invited?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {rfq.response_count || rfq.responses?.length || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(rfq.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleViewDetails(rfq)}
                            title={t('view') || 'View'}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {rfq.status === "draft" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleSendRFQ(rfq)}
                              title={t('send') || "Yuborish"}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {rfq.status === "closed" && (rfq.winner_id || rfq.winner_supplier_id) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleConvertToPO(rfq.id)}
                              title={t('convert_to_po') || "Buyurtmaga aylantirish"}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          )}
                          {(rfq.status === "draft" || rfq.status === "open") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(rfq.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Create RFQ Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_rfq_request') || "Yangi taklif so'rovi (RFQ)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('title') || "Sarlavha"} *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('rfq_title_placeholder') || "RFQ sarlavhasi"}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('deadline') || "Muddat"} *</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('description') || "Tavsif"}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('rfq_description_placeholder') || "Taklif haqida qisqacha ma'lumot"}
                rows={3}
              />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>{t('items_list') || "Mahsulotlar ro'yxati"}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add') || "Qo'shish"}
                </Button>
              </div>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Select
                      value={item.product_id || ""}
                      onValueChange={(value) => {
                        const selectedProduct = products.find(p => p.id === value);
                        const updates = {
                          product_id: value,
                          name: selectedProduct?.name || "",
                        };
                        if (selectedProduct?.unit) {
                          updates.unit = selectedProduct.unit;
                        }
                        updateItemMultiple(index, updates);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('select_product') || "Mahsulotni tanlang"} />
                      </SelectTrigger>
                      <SelectContent>
                        {productsLoading ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {t('loading') || "Yuklanmoqda..."}
                          </div>
                        ) : products.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {t('no_products') || "Mahsulotlar topilmadi"}
                          </div>
                        ) : (
                          products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} {product.sku ? `(${product.sku})` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-24"
                      min={1}
                    />
                    <Select
                      value={item.unit}
                      onValueChange={(value) => updateItem(index, "unit", value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dona">{t('unit_pcs') || "dona"}</SelectItem>
                        <SelectItem value="kg">{t('unit_kg') || "kg"}</SelectItem>
                        <SelectItem value="litr">{t('unit_liter') || "litr"}</SelectItem>
                        <SelectItem value="metr">{t('unit_meter') || "metr"}</SelectItem>
                        <SelectItem value="komplekt">{t('unit_set') || "komplekt"}</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Suppliers Selection */}
            <div className="space-y-3">
              <Label>{t('select_suppliers') || "Ta'minotchilarni tanlang"}</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {suppliers.filter((s) => s.is_active !== false && s.status !== 'inactive').map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    <Checkbox
                      checked={formData.suppliers_invited.includes(supplier.id)}
                      onCheckedChange={() => toggleSupplier(supplier.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{supplier.name}</div>
                      <div className="text-xs text-slate-500">
                        {supplier.categories?.join(", ")}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {supplier.rating} ★
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {t('selected') || "Tanlangan"}: {formData.suppliers_invited.length}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.title || !formData.deadline || formData.suppliers_invited.length === 0}
              >
                {t('create') || "Yaratish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RFQ Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('rfq_details') || "RFQ tafsilotlari"}</DialogTitle>
          </DialogHeader>
          {selectedRFQ && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                    {selectedRFQ.rfq_number}
                  </code>
                  <h3 className="text-lg font-semibold mt-2">{selectedRFQ.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{selectedRFQ.description}</p>
                </div>
                {getStatusBadge(selectedRFQ.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('created') || "Yaratilgan"}:</span>{" "}
                  {selectedRFQ.created_at
                    ? format(new Date(selectedRFQ.created_at), "dd.MM.yyyy")
                    : "-"}
                </div>
                <div>
                  <span className="text-slate-500">{t('deadline') || "Muddat"}:</span>{" "}
                  {selectedRFQ.deadline
                    ? format(new Date(selectedRFQ.deadline), "dd.MM.yyyy")
                    : "-"}
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-medium mb-2">{t('products') || "Mahsulotlar"}</h4>
                <div className="border rounded-lg overflow-hidden">
                  {detailsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : selectedRFQ.items?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('product') || "Mahsulot"}</TableHead>
                          <TableHead className="text-right">{t('quantity') || "Miqdori"}</TableHead>
                          <TableHead>{t('unit') || "O'lchov"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRFQ.items?.map((item, index) => (
                          <TableRow key={item.id || index}>
                            <TableCell>{item.product_name || item.description || item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell>{item.unit_name || item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-slate-500 py-4 text-center">
                      {t('no_items') || "Mahsulotlar yo'q"}
                    </p>
                  )}
                </div>
              </div>

              {/* Responses */}
              <div>
                <h4 className="font-medium mb-2">{t('responses') || "Javoblar"}</h4>
                {selectedRFQ.responses?.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    {t('no_responses_yet') || "Hali javoblar yo'q"}
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('supplier') || "Ta'minotchi"}</TableHead>
                          <TableHead className="text-right">{t('price') || "Narx"}</TableHead>
                          <TableHead>{t('submitted') || "Yuborilgan"}</TableHead>
                          <TableHead>{t('status') || "Status"}</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRFQ.responses?.map((response, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {getSupplierName(response.supplier_id)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(response.total_amount || 0)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {response.submitted_at
                                ? format(new Date(response.submitted_at), "dd.MM.yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {response.status === "accepted" ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <Award className="w-3 h-3 mr-1" />
                                  {t('selected') || "Tanlangan"}
                                </Badge>
                              ) : response.status === "rejected" ? (
                                <Badge className="bg-red-100 text-red-800">
                                  {t('rejected') || "Rad etilgan"}
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-800">
                                  {t('under_review') || "Ko'rib chiqilmoqda"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {selectedRFQ.status === "open" && response.status === "submitted" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleSelectWinner(selectedRFQ.id, response.supplier_id)
                                  }
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {t('select') || "Tanlash"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Winner info and Convert to PO */}
              {selectedRFQ.winner_supplier_id && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        {t('winner') || "G'olib"}: {getSupplierName(selectedRFQ.winner_supplier_id)}
                      </span>
                    </div>
                    {selectedRFQ.status === 'closed' && (
                      <Button
                        onClick={() => handleConvertToPO(selectedRFQ.id)}
                        disabled={convertingToPO}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        {convertingToPO ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('creating') || "Yaratilmoqda..."}
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {t('convert_to_po') || "Buyurtmaga aylantirish"}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    {t('rfq_closed_convert_hint') || "Bu RFQ yopilgan. Tanlangan ta'minotchi bilan buyurtma yaratishingiz mumkin."}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
