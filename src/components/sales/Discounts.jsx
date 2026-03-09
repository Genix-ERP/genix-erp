import React, { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Percent,
  Tag,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Users,
  TrendingUp,
  Gift,
  Copy,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

export default function Discounts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const {
    discounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    applyDiscount,
    isLoading,
  } = useSales();
  const { canCreate } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState(null);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    discount_type: "percentage",
    discount_value: 0,
    min_order_amount: 0,
    max_discount_amount: null,
    valid_from: new Date().toISOString().split("T")[0],
    valid_until: "",
    usage_limit: null,
    applies_to: "all",
  });

  const [testData, setTestData] = useState({
    code: "",
    amount: 0,
    isNewCustomer: false,
    result: null,
  });

  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      const matchesSearch =
        d.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [discounts, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const active = discounts.filter((d) => d.status === "active").length;
    const totalUsage = discounts.reduce((sum, d) => sum + (d.used_count || 0), 0);
    const expiringSoon = discounts.filter((d) => {
      const daysLeft = Math.ceil(
        (new Date(d.valid_until) - new Date()) / (1000 * 60 * 60 * 24)
      );
      return daysLeft > 0 && daysLeft <= 7 && d.status === "active";
    }).length;
    return { active, totalUsage, expiringSoon, total: discounts.length };
  }, [discounts]);

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleSubmit = async () => {
    const data = {
      ...formData,
      usage_limit: formData.usage_limit || null,
    };

    if (editMode && selectedDiscount) {
      await updateDiscount(selectedDiscount.id, data);
    } else {
      await createDiscount(data);
    }
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditMode(false);
    setSelectedDiscount(null);
    setFormData({
      code: "",
      name: "",
      discount_type: "percentage",
      discount_value: 0,
      min_order_amount: 0,
      max_discount_amount: null,
      valid_from: new Date().toISOString().split("T")[0],
      valid_until: "",
      usage_limit: null,
      applies_to: "all",
    });
  };

  const handleEdit = (discount) => {
    setSelectedDiscount(discount);
    setFormData({
      code: discount.code || "",
      name: discount.name || "",
      discount_type: discount.discount_type || "percentage",
      discount_value: discount.discount_value || 0,
      min_order_amount: discount.min_order_amount || 0,
      max_discount_amount: discount.max_discount_amount || null,
      valid_from: discount.valid_from || "",
      valid_until: discount.valid_until || "",
      usage_limit: discount.usage_limit || null,
      applies_to: discount.applies_to || "all",
    });
    setEditMode(true);
    setShowForm(true);
  };

  const handleView = (discount) => {
    setSelectedDiscount(discount);
    setShowDetails(true);
  };

  const handleToggleStatus = async (discount) => {
    const newStatus = discount.status === "active" ? "inactive" : "active";
    await updateDiscount(discount.id, { status: newStatus });
  };

  const handleDelete = (discount) => {
    setDiscountToDelete(discount);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (discountToDelete) {
      await deleteDiscount(discountToDelete.id);
      setShowDeleteConfirm(false);
      setDiscountToDelete(null);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTestDiscount = () => {
    const result = applyDiscount(testData.code, testData.amount, testData.isNewCustomer);
    // Convert messageKey to message for display
    if (result && result.messageKey) {
      result.message = t(result.messageKey);
      if (result.minAmount) {
        result.message = `${t('min_order_amount')}: ${formatCurrency(result.minAmount)}`;
      }
    }
    setTestData({ ...testData, result });
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: { color: "bg-green-100 text-green-800", label: t('active') },
      inactive: { color: "bg-slate-100 text-slate-800", label: t('inactive') },
      expired: { color: "bg-red-100 text-red-800", label: t('expired') },
    };
    const variant = variants[status] || variants.inactive;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getTypeBadge = (type) => {
    if (type === "percentage") {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          <Percent className="w-3 h-3 mr-1" />
          {t('percentage')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-100 text-purple-800">
        <Tag className="w-3 h-3 mr-1" />
        {t('fixed_amount')}
      </Badge>
    );
  };

  const getAppliesTo = (appliesTo) => {
    const labels = {
      all: t('all_customers'),
      new_customers: t('new_customers'),
      vip: t('vip_customers'),
    };
    return labels[appliesTo] || appliesTo;
  };

  const getUsageProgress = (discount) => {
    if (!discount.usage_limit) return null;
    const percentage = (discount.used_count / discount.usage_limit) * 100;
    return { percentage, remaining: discount.usage_limit - discount.used_count };
  };

  const getDaysRemaining = (validUntil) => {
    const days = Math.ceil(
      (new Date(validUntil) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (days < 0) return { text: t('expired'), expired: true };
    if (days === 0) return { text: t('expires_today'), expired: false };
    return { text: `${days} ${t('days_left')}`, expired: false };
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">{t('active_discounts')}</p>
                <p className="text-lg font-bold text-green-900">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('total_usage')}</p>
                <p className="text-lg font-bold text-blue-900">{stats.totalUsage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-yellow-600 font-medium">{t('expiring_soon_label')}</p>
                <p className="text-lg font-bold text-yellow-900">{stats.expiringSoon}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium">{t('total_discounts')}</p>
                <p className="text-lg font-bold text-purple-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">
            {t('discounts_and_promotions')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('manage_discounts_desc')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTestModal(true)}>
            <Tag className="w-4 h-4 mr-2" />
            {t('test_code')}
          </Button>
          {canCreate(MODULES.SALES) && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('new_discount')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('search_discount') + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="active">{t('active')}</SelectItem>
            <SelectItem value="inactive">{t('inactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Discounts List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_discounts_found')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('code')}</TableHead>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('value')}</TableHead>
                    <TableHead>{t('valid_until')}</TableHead>
                    <TableHead>{t('usage')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiscounts.map((discount) => {
                    const usage = getUsageProgress(discount);
                    const daysInfo = getDaysRemaining(discount.valid_until);
                    return (
                      <TableRow key={discount.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-slate-100 rounded font-mono text-sm">
                              {discount.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyCode(discount.code)}
                            >
                              {copiedCode === discount.code ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{discount.name}</span>
                        </TableCell>
                        <TableCell>{getTypeBadge(discount.discount_type)}</TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {discount.discount_type === "percentage"
                              ? `${discount.discount_value}%`
                              : formatCurrency(discount.discount_value)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">
                              {format(new Date(discount.valid_until), "dd.MM.yyyy")}
                            </div>
                            <div
                              className={`text-xs ${
                                daysInfo.expired ? "text-red-500" : "text-slate-500"
                              }`}
                            >
                              {daysInfo.text}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {usage ? (
                            <div>
                              <div className="text-sm">
                                {discount.used_count}/{discount.usage_limit}
                              </div>
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">
                              {discount.used_count} {t('times')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(discount.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(discount)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(discount)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                {t('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(discount)}>
                                {discount.status === "active" ? (
                                  <>
                                    <Tag className="w-4 h-4 mr-2" />
                                    {t('deactivate')}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    {t('activate')}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(discount)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editMode ? t('edit_discount') : t('new_discount')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('discount_code')} *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="SUMMER2024"
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  {t('generate')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('name')} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('summer_discount')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('type')}</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t('percentage')} (%)</SelectItem>
                    <SelectItem value="fixed_amount">{t('fixed_amount')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('value')} *</Label>
                <Input
                  type={formData.discount_type === "fixed_amount" ? "text" : "number"}
                  inputMode={formData.discount_type === "fixed_amount" ? "decimal" : undefined}
                  min={formData.discount_type === "fixed_amount" ? undefined : "0"}
                  value={formData.discount_type === "fixed_amount" ? formatPriceInput(formData.discount_value) : formData.discount_value}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_value: formData.discount_type === "fixed_amount"
                        ? parsePriceInput(e.target.value)
                        : (parseFloat(e.target.value) || 0),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('min_order_amount')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatPriceInput(formData.min_order_amount)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_order_amount: parsePriceInput(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('max_discount_amount')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.max_discount_amount ? formatPriceInput(formData.max_discount_amount) : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_discount_amount: e.target.value ? parsePriceInput(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('start_date')} *</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) =>
                    setFormData({ ...formData, valid_from: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('end_date')} *</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) =>
                    setFormData({ ...formData, valid_until: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('usage_limit')}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={t('unlimited')}
                  value={formData.usage_limit || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      usage_limit: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('applies_to')}</Label>
                <Select
                  value={formData.applies_to}
                  onValueChange={(value) =>
                    setFormData({ ...formData, applies_to: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_customers')}</SelectItem>
                    <SelectItem value="new_customers">{t('new_customers')}</SelectItem>
                    <SelectItem value="vip">{t('vip_customers')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.code || !formData.name || !formData.valid_until}
              >
                {editMode ? t('save') : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Discount Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {t('test_discount_code')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('discount_code')}</Label>
              <Input
                value={testData.code}
                onChange={(e) =>
                  setTestData({ ...testData, code: e.target.value.toUpperCase() })
                }
                placeholder="SALE10"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('order_amount')}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formatPriceInput(testData.amount)}
                onChange={(e) =>
                  setTestData({
                    ...testData,
                    amount: parsePriceInput(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={testData.isNewCustomer}
                onCheckedChange={(checked) =>
                  setTestData({ ...testData, isNewCustomer: checked })
                }
              />
              <Label>{t('new_customer')}</Label>
            </div>

            <Button className="w-full" onClick={handleTestDiscount}>
              {t('test')}
            </Button>

            {testData.result && (
              <div
                className={`p-4 rounded-lg ${
                  testData.result.valid
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                {testData.result.valid ? (
                  <div>
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      {t('discount_valid')}
                    </div>
                    <p className="text-green-600 mt-2">{testData.result.message}</p>
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-sm text-green-700">
                        {t('discount_amount')}:{" "}
                        <span className="font-semibold">
                          {formatCurrency(testData.result.discountAmount)}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-700">
                    <p className="font-medium">{t('discount_not_applied')}</p>
                    <p className="text-sm mt-1">{testData.result.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {t('discount_details')}
            </DialogTitle>
          </DialogHeader>
          {selectedDiscount && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <code className="px-3 py-1 bg-slate-100 rounded font-mono text-lg">
                    {selectedDiscount.code}
                  </code>
                  <h3 className="font-semibold text-lg mt-2">
                    {selectedDiscount.name}
                  </h3>
                </div>
                {getStatusBadge(selectedDiscount.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('type')}:</span>
                  <p className="font-medium mt-1">
                    {getTypeBadge(selectedDiscount.discount_type)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t('value')}:</span>
                  <p className="font-semibold text-lg mt-1">
                    {selectedDiscount.discount_type === "percentage"
                      ? `${selectedDiscount.discount_value}%`
                      : formatCurrency(selectedDiscount.discount_value)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('min_order')}:</span>
                  <p className="font-medium">
                    {formatCurrency(selectedDiscount.min_order_amount)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t('max_discount')}:</span>
                  <p className="font-medium">
                    {selectedDiscount.max_discount_amount > 0
                      ? formatCurrency(selectedDiscount.max_discount_amount)
                      : t('unlimited')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('start_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedDiscount.valid_from), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t('end_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedDiscount.valid_until), "dd.MM.yyyy")}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('usage')}:</span>
                  <span className="font-medium">
                    {selectedDiscount.used_count} /{" "}
                    {selectedDiscount.usage_limit || "∞"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">
                    {getAppliesTo(selectedDiscount.applies_to)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('confirm_deletion')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('delete_discount_confirm')}
            </p>
            {discountToDelete && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <code className="px-2 py-1 bg-slate-200 rounded font-mono">
                  {discountToDelete.code}
                </code>
                <p className="text-sm text-slate-500 mt-2">{discountToDelete.name}</p>
                <p className="text-sm font-medium mt-1">
                  {discountToDelete.type === "percentage"
                    ? `${discountToDelete.value}%`
                    : formatCurrency(discountToDelete.value)}
                </p>
              </div>
            )}
            <p className="text-sm text-red-500 mt-3">
              {t('this_action_cannot_be_undone')}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
