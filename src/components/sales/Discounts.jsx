import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";

export default function Discounts() {
  const {
    discounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    applyDiscount,
    isLoading,
  } = useSales();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "percentage",
    value: 0,
    min_order_amount: 0,
    max_discount: 0,
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
      type: "percentage",
      value: 0,
      min_order_amount: 0,
      max_discount: 0,
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
      type: discount.type || "percentage",
      value: discount.value || 0,
      min_order_amount: discount.min_order_amount || 0,
      max_discount: discount.max_discount || 0,
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

  const handleDelete = async (discount) => {
    if (window.confirm("Ushbu chegirmani o'chirmoqchimisiz?")) {
      await deleteDiscount(discount.id);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTestDiscount = () => {
    const result = applyDiscount(testData.code, testData.amount, testData.isNewCustomer);
    setTestData({ ...testData, result });
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: { color: "bg-green-100 text-green-800", label: "Faol" },
      inactive: { color: "bg-slate-100 text-slate-800", label: "Nofaol" },
      expired: { color: "bg-red-100 text-red-800", label: "Muddati tugagan" },
    };
    const variant = variants[status] || variants.inactive;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getTypeBadge = (type) => {
    if (type === "percentage") {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          <Percent className="w-3 h-3 mr-1" />
          Foiz
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-100 text-purple-800">
        <Tag className="w-3 h-3 mr-1" />
        Qat'iy summa
      </Badge>
    );
  };

  const getAppliesTo = (appliesTo) => {
    const labels = {
      all: "Barcha mijozlar",
      new_customers: "Yangi mijozlar",
      vip: "VIP mijozlar",
    };
    return labels[appliesTo] || appliesTo;
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} so'm`;
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
    if (days < 0) return { text: "Muddati tugagan", expired: true };
    if (days === 0) return { text: "Bugun tugaydi", expired: false };
    return { text: `${days} kun qoldi`, expired: false };
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
                <p className="text-xs text-green-600 font-medium">Faol chegirmalar</p>
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
                <p className="text-xs text-blue-600 font-medium">Jami foydalanish</p>
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
                <p className="text-xs text-yellow-600 font-medium">Tez tugaydiganlar</p>
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
                <p className="text-xs text-purple-600 font-medium">Jami chegirmalar</p>
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
            Chegirmalar va aksiyalar
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Chegirma kodlari va kampaniyalarni boshqaring
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTestModal(true)}>
            <Tag className="w-4 h-4 mr-2" />
            Kodni tekshirish
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Yangi chegirma
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Chegirma qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Holat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barchasi</SelectItem>
            <SelectItem value="active">Faol</SelectItem>
            <SelectItem value="inactive">Nofaol</SelectItem>
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
              <p className="text-slate-500">Chegirmalar topilmadi</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Kod</TableHead>
                    <TableHead>Nomi</TableHead>
                    <TableHead>Turi</TableHead>
                    <TableHead>Qiymati</TableHead>
                    <TableHead>Muddat</TableHead>
                    <TableHead>Foydalanish</TableHead>
                    <TableHead>Holat</TableHead>
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
                        <TableCell>{getTypeBadge(discount.type)}</TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {discount.type === "percentage"
                              ? `${discount.value}%`
                              : formatCurrency(discount.value)}
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
                              {discount.used_count} marta
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
                                Ko'rish
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(discount)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(discount)}>
                                {discount.status === "active" ? (
                                  <>
                                    <Tag className="w-4 h-4 mr-2" />
                                    Nofaol qilish
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Faollashtirish
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(discount)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                O'chirish
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
              {editMode ? "Chegirmani tahrirlash" : "Yangi chegirma"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chegirma kodi *</Label>
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
                  Generatsiya
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nomi *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Yozgi chegirma"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turi</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Foiz (%)</SelectItem>
                    <SelectItem value="fixed">Qat'iy summa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qiymati *</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min. buyurtma summasi</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.min_order_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_order_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max. chegirma summasi</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.max_discount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_discount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Boshlanish sanasi *</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) =>
                    setFormData({ ...formData, valid_from: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tugash sanasi *</Label>
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
                <Label>Foydalanish limiti</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Cheksiz"
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
                <Label>Kimlar uchun</Label>
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
                    <SelectItem value="all">Barcha mijozlar</SelectItem>
                    <SelectItem value="new_customers">Yangi mijozlar</SelectItem>
                    <SelectItem value="vip">VIP mijozlar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                Bekor qilish
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.code || !formData.name || !formData.valid_until}
              >
                {editMode ? "Saqlash" : "Yaratish"}
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
              Chegirma kodini tekshirish
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chegirma kodi</Label>
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
              <Label>Buyurtma summasi</Label>
              <Input
                type="number"
                min="0"
                value={testData.amount}
                onChange={(e) =>
                  setTestData({
                    ...testData,
                    amount: parseFloat(e.target.value) || 0,
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
              <Label>Yangi mijoz</Label>
            </div>

            <Button className="w-full" onClick={handleTestDiscount}>
              Tekshirish
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
                      Chegirma yaroqli!
                    </div>
                    <p className="text-green-600 mt-2">{testData.result.message}</p>
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-sm text-green-700">
                        Chegirma summasi:{" "}
                        <span className="font-semibold">
                          {formatCurrency(testData.result.discountAmount)}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-700">
                    <p className="font-medium">Chegirma qo'llanilmadi</p>
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
              Chegirma tafsilotlari
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
                  <span className="text-slate-500">Turi:</span>
                  <p className="font-medium mt-1">
                    {getTypeBadge(selectedDiscount.type)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Qiymati:</span>
                  <p className="font-semibold text-lg mt-1">
                    {selectedDiscount.type === "percentage"
                      ? `${selectedDiscount.value}%`
                      : formatCurrency(selectedDiscount.value)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Min. buyurtma:</span>
                  <p className="font-medium">
                    {formatCurrency(selectedDiscount.min_order_amount)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Max. chegirma:</span>
                  <p className="font-medium">
                    {selectedDiscount.max_discount > 0
                      ? formatCurrency(selectedDiscount.max_discount)
                      : "Cheksiz"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Boshlanish:</span>
                  <p className="font-medium">
                    {format(new Date(selectedDiscount.valid_from), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Tugash:</span>
                  <p className="font-medium">
                    {format(new Date(selectedDiscount.valid_until), "dd.MM.yyyy")}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Foydalanish:</span>
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
    </div>
  );
}
