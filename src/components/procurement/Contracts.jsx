import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCw,
  Building2,
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

import { useProcurement } from "@/components/contexts/ProcurementContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Contracts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    contracts,
    suppliers,
    createContract,
    updateContract,
    deleteContract,
    isLoading,
  } = useProcurement();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [editingContract, setEditingContract] = useState(null);

  const [formData, setFormData] = useState({
    supplier_id: "",
    title: "",
    type: "fixed",
    start_date: "",
    end_date: "",
    value: "",
    currency: "UZS",
    terms: "",
    auto_renew: false,
  });

  // Filter contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch =
        contract.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const activeContracts = contracts.filter((c) => c.status === "active");
    const expiringContracts = activeContracts.filter((c) => {
      const endDate = new Date(c.end_date);
      const daysUntilExpiry = differenceInDays(endDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });
    const totalValue = activeContracts.reduce((sum, c) => sum + (c.value || 0), 0);

    return {
      total: contracts.length,
      active: activeContracts.length,
      expiring: expiringContracts.length,
      totalValue,
    };
  }, [contracts]);

  const handleSubmit = async () => {
    const contractData = {
      ...formData,
      value: parseFloat(formData.value) || 0,
    };

    if (editingContract) {
      await updateContract(editingContract.id, contractData);
    } else {
      await createContract(contractData);
    }

    resetForm();
  };

  const handleEdit = (contract) => {
    setEditingContract(contract);
    setFormData({
      supplier_id: contract.supplier_id || "",
      title: contract.title || "",
      type: contract.type || "fixed",
      start_date: contract.start_date || "",
      end_date: contract.end_date || "",
      value: contract.value?.toString() || "",
      currency: contract.currency || "UZS",
      terms: contract.terms || "",
      auto_renew: contract.auto_renew || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Haqiqatan ham bu shartnomani o'chirmoqchimisiz?")) {
      await deleteContract(id);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    await updateContract(id, { status: newStatus });
    setShowDetails(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingContract(null);
    setFormData({
      supplier_id: "",
      title: "",
      type: "fixed",
      start_date: "",
      end_date: "",
      value: "",
      currency: "UZS",
      terms: "",
      auto_renew: false,
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: "bg-gray-100 text-gray-800",
      active: "bg-green-100 text-green-800",
      expired: "bg-red-100 text-red-800",
      terminated: "bg-orange-100 text-orange-800",
    };
    const labels = {
      draft: t('draft') || "Qoralama",
      active: t('active') || "Faol",
      expired: t('expired') || "Muddati o'tgan",
      terminated: t('terminated') || "Bekor qilingan",
    };
    return (
      <Badge className={styles[status] || styles.draft}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getTypeBadge = (type) => {
    const styles = {
      fixed: "bg-blue-100 text-blue-800",
      annual: "bg-purple-100 text-purple-800",
      monthly: "bg-cyan-100 text-cyan-800",
      project: "bg-pink-100 text-pink-800",
    };
    const labels = {
      fixed: t('fixed') || "Belgilangan",
      annual: t('annual') || "Yillik",
      monthly: t('monthly') || "Oylik",
      project: t('project') || "Loyiha",
    };
    return (
      <Badge variant="outline" className={styles[type] || styles.fixed}>
        {labels[type] || type}
      </Badge>
    );
  };

  const getExpiryInfo = (endDate) => {
    if (!endDate) return null;
    const today = new Date();
    const end = new Date(endDate);
    const daysLeft = differenceInDays(end, today);

    if (daysLeft < 0) {
      return {
        text: `${Math.abs(daysLeft)} ${t('days_ago_expired') || "kun oldin tugagan"}`,
        color: "text-red-600",
        icon: AlertTriangle,
      };
    } else if (daysLeft <= 30) {
      return {
        text: `${daysLeft} ${t('days_left') || "kun qoldi"}`,
        color: "text-orange-600",
        icon: Clock,
      };
    } else {
      return {
        text: `${daysLeft} ${t('days_left') || "kun qoldi"}`,
        color: "text-green-600",
        icon: CheckCircle2,
      };
    }
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
                <p className="text-xs text-slate-500">{t('total_contracts') || "Jami shartnomalar"}</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('active_contracts') || "Faol shartnomalar"}</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('expiring_soon') || "Muddati tugayotgan"}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.expiring}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('total_value') || "Jami qiymat"}</p>
                <p className="text-lg font-bold text-purple-600">
                  {stats.totalValue > 1000000000
                    ? `${(stats.totalValue / 1000000000).toFixed(1)} mlrd`
                    : stats.totalValue > 1000000
                    ? `${(stats.totalValue / 1000000).toFixed(1)} mln`
                    : stats.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contracts Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">{t('contracts_list') || "Shartnomalar ro'yxati"}</CardTitle>
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
                  <SelectItem value="active">{t('active') || "Faol"}</SelectItem>
                  <SelectItem value="expired">{t('expired') || "Muddati o'tgan"}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('new_contract') || "Yangi shartnoma"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_contracts_found') || "Shartnomalar topilmadi"}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('number') || "Raqam"}</TableHead>
                    <TableHead>{t('supplier') || "Ta'minotchi"}</TableHead>
                    <TableHead>{t('title') || "Sarlavha"}</TableHead>
                    <TableHead>{t('type') || "Turi"}</TableHead>
                    <TableHead>{t('period') || "Muddat"}</TableHead>
                    <TableHead className="text-right">{t('value') || "Qiymat"}</TableHead>
                    <TableHead>{t('status') || "Status"}</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => {
                    const expiryInfo = getExpiryInfo(contract.end_date);
                    return (
                      <TableRow key={contract.id} className="hover:bg-slate-50">
                        <TableCell>
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                            {contract.contract_number}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {contract.supplier_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-48 truncate" title={contract.title}>
                            {contract.title}
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(contract.type)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs">
                              {contract.start_date && contract.end_date
                                ? `${format(new Date(contract.start_date), "dd.MM.yy")} - ${format(
                                    new Date(contract.end_date),
                                    "dd.MM.yy"
                                  )}`
                                : "-"}
                            </div>
                            {expiryInfo && contract.status === "active" && (
                              <div className={`text-xs flex items-center gap-1 ${expiryInfo.color}`}>
                                <expiryInfo.icon className="w-3 h-3" />
                                {expiryInfo.text}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(contract.value, contract.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(contract.status)}
                            {contract.auto_renew && (
                              <RefreshCw className="w-3 h-3 text-blue-500" title="Avto-uzaytirish" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedContract(contract);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(contract)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {contract.status === "draft" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(contract.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContract ? (t('edit_contract') || "Shartnomani tahrirlash") : (t('new_contract') || "Yangi shartnoma")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplier') || "Ta'minotchi"} *</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_supplier') || "Ta'minotchini tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers
                      .filter((s) => s.status === "active")
                      .map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('contract_type') || "Shartnoma turi"}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t('fixed_term') || "Belgilangan muddatli"}</SelectItem>
                    <SelectItem value="annual">{t('annual') || "Yillik"}</SelectItem>
                    <SelectItem value="monthly">{t('monthly') || "Oylik"}</SelectItem>
                    <SelectItem value="project">{t('project_based') || "Loyiha asosida"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('contract_title') || "Shartnoma sarlavhasi"} *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('contract_name') || "Shartnoma nomi"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('start_date') || "Boshlanish sanasi"} *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('end_date') || "Tugash sanasi"} *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('contract_value') || "Shartnoma qiymati"} *</Label>
                <Input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('currency') || "Valyuta"}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS (So'm)</SelectItem>
                    <SelectItem value="USD">USD (Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Yevro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('contract_terms') || "Shartnoma shartlari"}</Label>
              <Textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                placeholder={t('terms_placeholder') || "Asosiy shartlar va majburiyatlar..."}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto_renew"
                checked={formData.auto_renew}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_renew: checked })}
              />
              <Label htmlFor="auto_renew" className="cursor-pointer">
                {t('auto_renew') || "Avtomatik uzaytirish"}
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !formData.supplier_id ||
                  !formData.title ||
                  !formData.start_date ||
                  !formData.end_date ||
                  !formData.value
                }
              >
                {editingContract ? (t('save') || "Saqlash") : (t('create') || "Yaratish")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contract Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('contract_details') || "Shartnoma tafsilotlari"}</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                    {selectedContract.contract_number}
                  </code>
                  <h3 className="text-lg font-semibold mt-2">{selectedContract.title}</h3>
                  <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                    <Building2 className="w-4 h-4" />
                    {selectedContract.supplier_name}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(selectedContract.status)}
                  {getTypeBadge(selectedContract.type)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Boshlanish sanasi</p>
                  <p className="font-medium">
                    {selectedContract.start_date
                      ? format(new Date(selectedContract.start_date), "dd MMMM yyyy")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tugash sanasi</p>
                  <p className="font-medium">
                    {selectedContract.end_date
                      ? format(new Date(selectedContract.end_date), "dd MMMM yyyy")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Shartnoma qiymati</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedContract.value, selectedContract.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avto-uzaytirish</p>
                  <p className="font-medium flex items-center gap-1">
                    {selectedContract.auto_renew ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Ha
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-slate-400" />
                        Yo'q
                      </>
                    )}
                  </p>
                </div>
              </div>

              {selectedContract.terms && (
                <div>
                  <h4 className="font-medium mb-2">Shartnoma shartlari</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap p-3 bg-slate-50 rounded-lg">
                    {selectedContract.terms}
                  </p>
                </div>
              )}

              {/* Actions */}
              {selectedContract.status === "draft" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedContract.id, "active")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Faollashtirish
                  </Button>
                </div>
              )}
              {selectedContract.status === "active" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleStatusChange(selectedContract.id, "terminated")}
                  >
                    Bekor qilish
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
