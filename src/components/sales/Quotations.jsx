import React, { useState, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowRight,
  Calendar,
  User,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";
import { useCustomers } from "@/components/contexts/CustomersContext";

export default function Quotations() {
  const {
    quotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    convertQuotationToOrder,
    isLoading,
  } = useSales();

  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    contact_person: "",
    email: "",
    valid_until: "",
    items: [{ product_name: "", quantity: 1, unit_price: 0 }],
    discount_percent: 0,
    tax_percent: 12,
    notes: "",
  });

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        q.quotation_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchQuery, statusFilter]);

  const calculateTotals = (items, discountPercent, taxPercent) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const total = afterDiscount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_name: "", quantity: 1, unit_price: 0 }],
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = field === "product_name" ? value : parseFloat(value) || 0;
    setFormData({ ...formData, items: newItems });
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.name,
        contact_person: customer.contact_person || "",
        email: customer.email || "",
      });
    }
  };

  const handleSubmit = async () => {
    const { subtotal, discountAmount, taxAmount, total } = calculateTotals(
      formData.items,
      formData.discount_percent,
      formData.tax_percent
    );

    const data = {
      ...formData,
      items: formData.items.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price,
      })),
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: total,
    };

    if (editMode && selectedQuotation) {
      await updateQuotation(selectedQuotation.id, data);
    } else {
      await createQuotation(data);
    }
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditMode(false);
    setSelectedQuotation(null);
    setFormData({
      customer_id: "",
      customer_name: "",
      contact_person: "",
      email: "",
      valid_until: "",
      items: [{ product_name: "", quantity: 1, unit_price: 0 }],
      discount_percent: 0,
      tax_percent: 12,
      notes: "",
    });
  };

  const handleEdit = (quotation) => {
    setSelectedQuotation(quotation);
    setFormData({
      customer_id: quotation.customer_id || "",
      customer_name: quotation.customer_name || "",
      contact_person: quotation.contact_person || "",
      email: quotation.email || "",
      valid_until: quotation.valid_until || "",
      items: quotation.items || [{ product_name: "", quantity: 1, unit_price: 0 }],
      discount_percent: quotation.discount_percent || 0,
      tax_percent: quotation.tax_percent || 12,
      notes: quotation.notes || "",
    });
    setEditMode(true);
    setShowForm(true);
  };

  const handleView = (quotation) => {
    setSelectedQuotation(quotation);
    setShowDetails(true);
  };

  const handleSend = async (quotation) => {
    await updateQuotation(quotation.id, { status: "sent" });
  };

  const handleConvert = async (quotation) => {
    await convertQuotationToOrder(quotation.id);
  };

  const handleDelete = async (quotation) => {
    if (window.confirm("Ushbu taklifnomani o'chirmoqchimisiz?")) {
      await deleteQuotation(quotation.id);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: { color: "bg-slate-100 text-slate-800", label: "Qoralama" },
      sent: { color: "bg-blue-100 text-blue-800", label: "Yuborildi" },
      accepted: { color: "bg-green-100 text-green-800", label: "Qabul qilindi" },
      rejected: { color: "bg-red-100 text-red-800", label: "Rad etildi" },
      expired: { color: "bg-orange-100 text-orange-800", label: "Muddati tugadi" },
    };
    const variant = variants[status] || variants.draft;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} so'm`;
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals(
    formData.items,
    formData.discount_percent,
    formData.tax_percent
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">Taklifnomalar</h2>
          <p className="text-sm text-slate-500 mt-1">
            Mijozlarga narx takliflarini boshqaring
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Yangi taklifnoma
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Taklifnoma qidirish..."
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
            <SelectItem value="draft">Qoralama</SelectItem>
            <SelectItem value="sent">Yuborildi</SelectItem>
            <SelectItem value="accepted">Qabul qilindi</SelectItem>
            <SelectItem value="rejected">Rad etildi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quotations List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Taklifnomalar topilmadi</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Taklifnoma №</TableHead>
                    <TableHead>Mijoz</TableHead>
                    <TableHead>Muddat</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotations.map((quotation) => (
                    <TableRow key={quotation.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{quotation.quotation_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{quotation.customer_name}</div>
                          <div className="text-xs text-slate-500">{quotation.contact_person}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {quotation.valid_until
                            ? format(new Date(quotation.valid_until), "dd.MM.yyyy")
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(quotation.total_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(quotation)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ko'rish
                            </DropdownMenuItem>
                            {quotation.status === "draft" && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(quotation)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Tahrirlash
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSend(quotation)}>
                                  <Send className="w-4 h-4 mr-2" />
                                  Yuborish
                                </DropdownMenuItem>
                              </>
                            )}
                            {quotation.status === "sent" && (
                              <DropdownMenuItem onClick={() => handleConvert(quotation)}>
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Buyurtmaga aylantirish
                              </DropdownMenuItem>
                            )}
                            {quotation.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(quotation)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                O'chirish
                              </DropdownMenuItem>
                            )}
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

      {/* Create/Edit Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? "Taklifnomani tahrirlash" : "Yangi taklifnoma"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mijoz *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={handleCustomerSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mijozni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amal qilish muddati *</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aloqa shaxsi</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Aloqa shaxsi ismi"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Mahsulotlar</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Qo'shish
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="w-24">Miqdor</TableHead>
                      <TableHead className="w-36">Narx</TableHead>
                      <TableHead className="w-36 text-right">Jami</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={item.product_name}
                            onChange={(e) => handleItemChange(index, "product_name", e.target.value)}
                            placeholder="Mahsulot nomi"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                        <TableCell>
                          {formData.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chegirma (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Soliq (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.tax_percent}
                  onChange={(e) => setFormData({ ...formData, tax_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Oraliq summa:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-red-600">
                <span>Chegirma ({formData.discount_percent}%):</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Soliq ({formData.tax_percent}%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>Jami:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Izohlar</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Qo'shimcha ma'lumotlar..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                Bekor qilish
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.customer_id || !formData.valid_until || formData.items.length === 0}
              >
                {editMode ? "Saqlash" : "Yaratish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedQuotation?.quotation_number}
            </DialogTitle>
          </DialogHeader>
          {selectedQuotation && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{selectedQuotation.customer_name}</h3>
                  <p className="text-sm text-slate-500">{selectedQuotation.contact_person}</p>
                  <p className="text-sm text-slate-500">{selectedQuotation.email}</p>
                </div>
                {getStatusBadge(selectedQuotation.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Yaratilgan:</span>
                  <p className="font-medium">
                    {format(new Date(selectedQuotation.created_at), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Amal qilish muddati:</span>
                  <p className="font-medium">
                    {selectedQuotation.valid_until
                      ? format(new Date(selectedQuotation.valid_until), "dd.MM.yyyy")
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-center">Miqdor</TableHead>
                      <TableHead className="text-right">Narx</TableHead>
                      <TableHead className="text-right">Jami</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedQuotation.items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Oraliq summa:</span>
                  <span>{formatCurrency(selectedQuotation.subtotal)}</span>
                </div>
                {selectedQuotation.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Chegirma ({selectedQuotation.discount_percent}%):</span>
                    <span>-{formatCurrency(selectedQuotation.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Soliq ({selectedQuotation.tax_percent}%):</span>
                  <span>{formatCurrency(selectedQuotation.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Jami:</span>
                  <span>{formatCurrency(selectedQuotation.total_amount)}</span>
                </div>
              </div>

              {selectedQuotation.notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">{selectedQuotation.notes}</p>
                </div>
              )}

              {selectedQuotation.converted_to_order && (
                <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800">
                    Buyurtmaga aylantrilgan: {selectedQuotation.converted_to_order}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
