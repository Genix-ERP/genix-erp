import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/components/utils/translations";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useProcurement } from "@/components/contexts/ProcurementContext";
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  useAuditTrail,
} from "@/components/shared";

export default function Suppliers({ language = 'en' }) {
  const { t } = useTranslation(language);
  const {
    suppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    updateSupplierRating,
    getSupplierStats,
    isLoading,
  } = useProcurement();

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
    phone: "",
    address: "",
    tax_id: "",
    payment_terms: "net_30",
    currency: "UZS",
    categories: "",
  });

  const stats = getSupplierStats();

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
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Haqiqatan ham bu ta'minotchini o'chirmoqchimisiz?")) {
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
      phone: "",
      address: "",
      tax_id: "",
      payment_terms: "net_30",
      currency: "UZS",
      categories: "",
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      blocked: "bg-red-100 text-red-800",
    };
    const labels = {
      active: "Faol",
      inactive: "Nofaol",
      blocked: "Bloklangan",
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

  const formatCurrency = (amount, currency) => {
    if (currency === "UZS") {
      return `${(amount || 0).toLocaleString()} so'm`;
    }
    return `$${(amount || 0).toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Jami ta'minotchilar</p>
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
                <p className="text-xs text-slate-500">Faol ta'minotchilar</p>
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
                <p className="text-xs text-slate-500">O'rtacha reyting</p>
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
                <p className="text-xs text-slate-500">Jami xaridlar</p>
                <p className="text-lg font-bold text-purple-600">
                  {stats.totalSpent > 1000000
                    ? `${(stats.totalSpent / 1000000).toFixed(1)}M`
                    : stats.totalSpent.toLocaleString()}
                </p>
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
            <CardTitle className="text-lg">Ta'minotchilar ro'yxati</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Qidirish..."
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
                  <SelectItem value="all">Hammasi</SelectItem>
                  <SelectItem value="active">Faol</SelectItem>
                  <SelectItem value="inactive">Nofaol</SelectItem>
                  <SelectItem value="blocked">Bloklangan</SelectItem>
                </SelectContent>
              </Select>
              <ImportExportButtons
                onImport={() => setShowImportModal(true)}
                onExport={() => setShowExportModal(true)}
              />
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Qo'shish
              </Button>
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
              <p className="text-slate-500">Ta'minotchilar topilmadi</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Kod</TableHead>
                    <TableHead>Ta'minotchi</TableHead>
                    <TableHead>Aloqa</TableHead>
                    <TableHead>Reyting</TableHead>
                    <TableHead className="text-right">Buyurtmalar</TableHead>
                    <TableHead className="text-right">Jami xarid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-slate-50">
                      <TableCell>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {supplier.code}
                        </code>
                      </TableCell>
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
                            ({supplier.rating || 0})
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        {supplier.total_orders || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(supplier.total_spent, supplier.currency)}
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
                              Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRating(supplier)}>
                              <Star className="w-4 h-4 mr-2" />
                              Baholash
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(supplier.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              O'chirish
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

      {/* Add/Edit Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Ta'minotchini tahrirlash" : "Yangi ta'minotchi qo'shish"}
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

            <div className="grid grid-cols-3 gap-4">
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
                Bekor qilish
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {editingSupplier ? "Saqlash" : "Qo'shish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta'minotchini baholash</DialogTitle>
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
                  placeholder="Izoh (ixtiyoriy)"
                  rows={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowRatingModal(false)}>
                Bekor qilish
              </Button>
              <Button onClick={submitRating}>
                Baholash
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
        entityName="Ta'minotchilar"
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={filteredSuppliers}
        columns={exportColumns}
        entityName="Taminotchilar"
        title="Ta'minotchilar ro'yxati"
      />
    </div>
  );
}
