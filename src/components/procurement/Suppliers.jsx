import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/components/utils/translations";
import { useLanguage } from "@/components/contexts/LanguageContext";
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
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  Star,
  Phone,
  Mail,
  MapPin,
  MoreHorizontal,
  TrendingUp,
  Users,
  DollarSign,
  Award,
  Upload,
  Download,
  BarChart3,
  Tag,
  Receipt,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSearchParams } from "react-router-dom";
import { useProcurement } from "@/components/contexts/ProcurementContext";
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  useAuditTrail,
} from "@/components/shared";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import SupplierPerformance from "./SupplierPerformance";
import VendorPricelist from "./VendorPricelist";
import VendorBills from "./VendorBills";

export default function Suppliers() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    suppliers,
    purchaseOrders,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    updateSupplierRating,
    getSupplierStats,
    isLoading,
  } = useProcurement();
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("subtab") || "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [ratingSupplier, setRatingSupplier] = useState(null);
  const [newRating, setNewRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const { addAuditLog } = useAuditTrail("suppliers");

  // Export columns configuration
  const exportColumns = [
    { key: "code", label: "Kod" },
    { key: "name", label: "Nomi" },
    { key: "contact_person", label: "Kontakt shaxs" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefon" },
    { key: "address", label: "Manzil" },
    { key: "tax_id", label: "INN" },
    { key: "payment_terms", label: "To'lov shartlari" },
    { key: "status", label: "Holat" },
    { key: "rating", label: "Reyting" },
  ];

  // Import columns configuration
  const importColumns = [
    { key: "name", label: "Nomi", required: true },
    { key: "contact_person", label: "Kontakt shaxs" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefon" },
    { key: "address", label: "Manzil" },
    { key: "tax_id", label: "INN" },
  ];

  const handleImport = async (data) => {
    for (const row of data) {
      const supplierData = {
        name: row.name,
        contact_person: row.contact_person || "",
        email: row.email || "",
        phone: row.phone || "",
        address: row.address || "",
        tax_id: row.tax_id || "",
        payment_terms: "net_30",
        currency: "UZS",
        status: "active",
      };
      createSupplier(supplierData);
    }
    addAuditLog("create", "batch", `${data.length} suppliers imported`);
  };

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "+998",
    address: "",
    tax_id: "",
    payment_terms: "net_30",
    currency: "UZS",
    categories: "",
    status: "active",
  });

  const stats = getSupplierStats();

  // Calculate order count and total spent per supplier from purchase orders
  const supplierOrderStats = useMemo(() => {
    const statsMap = {};
    (purchaseOrders || []).forEach(po => {
      const supplierId = po.vendor_id || po.supplier_id;
      if (!supplierId) return;

      if (!statsMap[supplierId]) {
        statsMap[supplierId] = { orderCount: 0, totalSpent: 0 };
      }
      statsMap[supplierId].orderCount++;
      // Only count spent for received/completed orders
      if (['received', 'completed', 'partial', 'approved', 'ordered'].includes(po.status)) {
        statsMap[supplierId].totalSpent += (po.total_amount || po.total || 0);
      }
    });
    return statsMap;
  }, [purchaseOrders]);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch =
        supplier.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || supplier.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchQuery, statusFilter]);

  const handleSubmit = async () => {
    const supplierData = {
      ...formData,
      categories: formData.categories.split(",").map((c) => c.trim()).filter(Boolean),
    };

    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, supplierData);
    } else {
      await createSupplier(supplierData);
    }

    resetForm();
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      tax_id: supplier.tax_id || "",
      payment_terms: supplier.payment_terms || "net_30",
      currency: supplier.currency || "UZS",
      categories: (supplier.categories || []).join(", "),
      status: supplier.status || "active",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirm_delete_supplier') || "Haqiqatan ham bu ta'minotchini o'chirmoqchimisiz?")) {
      await deleteSupplier(id);
    }
  };

  const handleRating = (supplier) => {
    setRatingSupplier(supplier);
    setNewRating(supplier.rating || 5);
    setRatingComment("");
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (ratingSupplier) {
      await updateSupplierRating(ratingSupplier.id, newRating, ratingComment);
      setShowRatingModal(false);
      setRatingSupplier(null);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "+998",
      address: "",
      tax_id: "",
      payment_terms: "net_30",
      currency: "UZS",
      categories: "",
      status: "active",
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      pending: "bg-yellow-100 text-yellow-800",
      blocked: "bg-red-100 text-red-800",
    };
    const labels = {
      active: t('active') || "Faol",
      inactive: t('inactive') || "Nofaol",
      pending: t('pending') || "Kutilmoqda",
      blocked: t('blocked') || "Bloklangan",
    };
    return (
      <Badge className={styles[status] || styles.inactive}>
        {labels[status] || status}
      </Badge>
    );
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    const hasHalf = (rating || 0) % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        );
      } else if (i === fullStars && hasHalf) {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />
        );
      } else {
        stars.push(
          <Star key={i} className="w-4 h-4 text-gray-300" />
        );
      }
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  };

  return (
    <div className="space-y-6">
      {/* Tabs for List, Performance, Pricelist, and Bills */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg flex-wrap">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Building2 className="w-4 h-4 mr-2" />
            {t('list') || 'List'}
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            {t('performance') || 'Performance'}
          </TabsTrigger>
          <TabsTrigger value="pricelist" className="data-[state=active]:bg-white">
            <Tag className="w-4 h-4 mr-2" />
            {t('pricelist') || 'Pricelist'}
          </TabsTrigger>
          <TabsTrigger value="bills" className="data-[state=active]:bg-white">
            <Receipt className="w-4 h-4 mr-2" />
            {t('bills') || 'Bills'}
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_suppliers') || "Jami ta'minotchilar"}</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalSuppliers}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('active_suppliers') || "Faol ta'minotchilar"}</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeSuppliers}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('average_rating') || "O'rtacha reyting"}</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.avgRating}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_purchases') || "Jami xaridlar"}</p>
                <p className="text-lg font-bold text-purple-600">
                  ${stats.totalSpent > 1000000
                    ? `${(stats.totalSpent / 1000000).toFixed(1)}M`
                    : stats.totalSpent.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">{stats.totalOrders || 0} {t('orders') || 'orders'}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">{t('suppliers_list') || "Ta'minotchilar ro'yxati"}</CardTitle>
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
                  <SelectItem value="active">{t('active') || "Faol"}</SelectItem>
                  <SelectItem value="inactive">{t('inactive') || "Nofaol"}</SelectItem>
                  <SelectItem value="blocked">{t('blocked') || "Bloklangan"}</SelectItem>
                </SelectContent>
              </Select>
              <ImportExportButtons
                onImport={() => setShowImportModal(true)}
                onExport={() => setShowExportModal(true)}
              />
              {canCreate(MODULES.PURCHASES) && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add') || "Qo'shish"}
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
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_suppliers_found') || "Ta'minotchilar topilmadi"}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('supplier') || "Ta'minotchi"}</TableHead>
                    <TableHead>{t('contact') || "Aloqa"}</TableHead>
                    <TableHead>{t('rating') || "Reyting"}</TableHead>
                    <TableHead className="text-right">{t('orders') || "Buyurtmalar"}</TableHead>
                    <TableHead className="text-right">{t('total_purchase') || "Jami xarid"}</TableHead>
                    <TableHead>{t('status') || "Status"}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div>
                          <div className="font-medium">{supplier.name}</div>
                          <div className="text-xs text-slate-500">
                            {supplier.contact_person}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Phone className="w-3 h-3" />
                            {supplier.phone}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Mail className="w-3 h-3" />
                            {supplier.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleRating(supplier)}
                          className="hover:opacity-80"
                        >
                          {renderStars(supplier.rating)}
                          <span className="text-xs text-slate-500 ml-1">
                            ({supplier.rating_count || 0})
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        {supplierOrderStats[supplier.id]?.orderCount || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(supplierOrderStats[supplier.id]?.totalSpent || 0, supplier.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              {t('edit') || "Tahrirlash"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRating(supplier)}>
                              <Star className="w-4 h-4 mr-2" />
                              {t('rate') || "Baholash"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(supplier.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete') || "O'chirish"}
                            </DropdownMenuItem>
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
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-4">
          <SupplierPerformance />
        </TabsContent>

        {/* Pricelist Tab */}
        <TabsContent value="pricelist" className="mt-4">
          <VendorPricelist />
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills" className="mt-4">
          <VendorBills />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? (t('edit_supplier') || "Ta'minotchini tahrirlash") : (t('add_new_supplier') || "Yangi ta'minotchi qo'shish")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="supplier_name" label={t('company_name')} helpText={t('help_supplier_name')} required />
                <Input
                  id="supplier_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('company_name')}
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="contact_person" label={t('contact_name')} helpText={t('help_supplier_contact')} />
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder={t('enter_name')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="supplier_email" label={t('email')} helpText={t('help_supplier_email')} />
                <Input
                  id="supplier_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="supplier_phone" label={t('phone')} helpText={t('help_supplier_phone')} />
                <Input
                  id="supplier_phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+998 XX XXX XX XX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <LabelWithHelp htmlFor="supplier_address" label={t('address')} helpText={t('help_supplier_address')} />
              <Textarea
                id="supplier_address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('address')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <LabelWithHelp htmlFor="tax_id" label={t('tax_id') || 'INN (STIR)'} helpText={t('help_supplier_tax_id')} />
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="payment_terms" label={t('payment_terms')} helpText={t('help_supplier_payment_terms')} />
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                >
                  <SelectTrigger id="payment_terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">{t('prepaid') || 'Oldindan to\'lov'}</SelectItem>
                    <SelectItem value="net_15">Net 15</SelectItem>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_60">Net 60</SelectItem>
                    <SelectItem value="net_90">Net 90</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="currency" label={t('currency')} helpText={t('help_supplier_currency')} />
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS (So'm)</SelectItem>
                    <SelectItem value="USD">USD (Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Yevro)</SelectItem>
                    <SelectItem value="RUB">RUB (Rubl)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="status" label={t('status') || 'Status'} helpText={t('help_supplier_status') || 'Supplier status'} />
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('active') || 'Active'}</SelectItem>
                    <SelectItem value="inactive">{t('inactive') || 'Inactive'}</SelectItem>
                    <SelectItem value="pending">{t('pending') || 'Pending'}</SelectItem>
                    <SelectItem value="blocked">{t('blocked') || 'Blocked'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <LabelWithHelp htmlFor="categories" label={t('categories')} helpText={t('help_supplier_categories')} />
              <Input
                id="categories"
                value={formData.categories}
                onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                placeholder={t('categories_placeholder') || 'Elektronika, Ofis jihozlari, ...'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {editingSupplier ? (t('save') || "Saqlash") : (t('add') || "Qo'shish")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rate_supplier') || "Ta'minotchini baholash"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {ratingSupplier && (
              <div className="text-center">
                <p className="font-medium mb-4">{ratingSupplier.name}</p>

                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= newRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300 hover:text-yellow-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <Textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder={t('comment_optional') || "Izoh (ixtiyoriy)"}
                  rows={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowRatingModal(false)}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button onClick={submitRating}>
                {t('rate') || "Baholash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        columns={importColumns}
        entityName={t('suppliers') || "Ta'minotchilar"}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={filteredSuppliers}
        columns={exportColumns}
        entityName={t('suppliers') || "Taminotchilar"}
        title={t('suppliers_list') || "Ta'minotchilar ro'yxati"}
      />
    </div>
  );
}
