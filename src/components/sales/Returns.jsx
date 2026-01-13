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
  RotateCcw,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Package,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";
import { useCustomers } from "@/components/contexts/CustomersContext";

export default function Returns() {
  const {
    returns,
    invoices,
    createReturn,
    updateReturn,
    approveReturn,
    processRefund,
    isLoading,
  } = useSales();

  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);

  const [formData, setFormData] = useState({
    invoice_id: "",
    customer_id: "",
    customer_name: "",
    return_date: new Date().toISOString().split("T")[0],
    reason: "defective",
    items: [{ product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
    notes: "",
  });

  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      const matchesSearch =
        r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [returns, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = returns.length;
    const pending = returns.filter((r) => r.status === "pending").length;
    const approved = returns.filter((r) => r.status === "approved").length;
    const totalAmount = returns.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const refundedAmount = returns
      .filter((r) => r.refund_status === "processed")
      .reduce((sum, r) => sum + (r.total_amount || 0), 0);
    return { total, pending, approved, totalAmount, refundedAmount };
  }, [returns]);

  const handleInvoiceSelect = (invoiceId) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      setFormData({
        ...formData,
        invoice_id: invoiceId,
        sales_order_id: invoice.sales_order_id,
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        items: invoice.items?.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: 1,
          max_quantity: item.quantity,
          unit_price: item.unit_price,
          condition: "damaged",
        })) || [{ product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    if (field === "quantity") {
      const maxQty = newItems[index].max_quantity || 99;
      newItems[index][field] = Math.min(parseInt(value) || 1, maxQty);
    } else {
      newItems[index][field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async () => {
    const totalAmount = formData.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    const data = {
      ...formData,
      items: formData.items.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price,
      })),
      total_amount: totalAmount,
    };

    await createReturn(data);
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedReturn(null);
    setFormData({
      invoice_id: "",
      customer_id: "",
      customer_name: "",
      return_date: new Date().toISOString().split("T")[0],
      reason: "defective",
      items: [{ product_name: "", quantity: 1, unit_price: 0, condition: "damaged" }],
      notes: "",
    });
  };

  const handleView = (returnItem) => {
    setSelectedReturn(returnItem);
    setShowDetails(true);
  };

  const handleApprove = async (returnItem) => {
    await approveReturn(returnItem.id);
  };

  const handleReject = async (returnItem) => {
    await updateReturn(returnItem.id, { status: "rejected" });
  };

  const handleProcessRefund = async (returnItem, method) => {
    await processRefund(returnItem.id, method);
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Kutilmoqda" },
      approved: { color: "bg-green-100 text-green-800", label: "Tasdiqlangan" },
      rejected: { color: "bg-red-100 text-red-800", label: "Rad etilgan" },
      completed: { color: "bg-blue-100 text-blue-800", label: "Yakunlangan" },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getRefundStatusBadge = (status) => {
    const variants = {
      pending: { color: "bg-slate-100 text-slate-800", label: "Kutilmoqda" },
      processed: { color: "bg-green-100 text-green-800", label: "Qaytarildi" },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getReasonLabel = (reason) => {
    const reasons = {
      defective: "Nosoz mahsulot",
      wrong_item: "Noto'g'ri mahsulot",
      damaged: "Shikastlangan",
      not_as_described: "Tavsifga mos emas",
      changed_mind: "Fikr o'zgardi",
      other: "Boshqa",
    };
    return reasons[reason] || reason;
  };

  const getConditionLabel = (condition) => {
    const conditions = {
      damaged: "Shikastlangan",
      opened: "Ochilgan",
      sealed: "Muhrli",
      used: "Ishlatilgan",
    };
    return conditions[condition] || condition;
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString()} so'm`;
  };

  const totalAmount = formData.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500 rounded-lg">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Jami qaytarishlar</p>
                <p className="text-lg font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-yellow-600 font-medium">Kutilmoqda</p>
                <p className="text-lg font-bold text-yellow-900">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">Tasdiqlangan</p>
                <p className="text-lg font-bold text-green-900">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">Qaytarilgan summa</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(stats.refundedAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">Qaytarishlar</h2>
          <p className="text-sm text-slate-500 mt-1">
            Mahsulot qaytarishlarini boshqaring
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Yangi qaytarish
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Qaytarish qidirish..."
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
            <SelectItem value="pending">Kutilmoqda</SelectItem>
            <SelectItem value="approved">Tasdiqlangan</SelectItem>
            <SelectItem value="rejected">Rad etilgan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Returns List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Qaytarishlar topilmadi</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Qaytarish №</TableHead>
                    <TableHead>Mijoz</TableHead>
                    <TableHead>Sabab</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Qaytarish</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((returnItem) => (
                    <TableRow key={returnItem.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{returnItem.return_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{returnItem.customer_name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getReasonLabel(returnItem.reason)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {format(new Date(returnItem.return_date), "dd.MM.yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(returnItem.total_amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                      <TableCell>{getRefundStatusBadge(returnItem.refund_status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(returnItem)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ko'rish
                            </DropdownMenuItem>
                            {returnItem.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(returnItem)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Tasdiqlash
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleReject(returnItem)}
                                  className="text-red-600"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Rad etish
                                </DropdownMenuItem>
                              </>
                            )}
                            {returnItem.status === "approved" &&
                              returnItem.refund_status === "pending" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleProcessRefund(returnItem, "cash")}
                                  >
                                    <DollarSign className="w-4 h-4 mr-2" />
                                    Naqd qaytarish
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleProcessRefund(returnItem, "credit_note")}
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Kredit nota berish
                                  </DropdownMenuItem>
                                </>
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

      {/* Create Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi qaytarish</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Invoice Selection */}
            <div className="space-y-2">
              <Label>Faktura *</Label>
              <Select
                value={formData.invoice_id}
                onValueChange={handleInvoiceSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fakturani tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {invoices
                    .filter((inv) => inv.payment_status === "paid")
                    .map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.customer_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {formData.customer_name && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Mijoz:</p>
                <p className="font-medium">{formData.customer_name}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qaytarish sanasi *</Label>
                <Input
                  type="date"
                  value={formData.return_date}
                  onChange={(e) =>
                    setFormData({ ...formData, return_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sabab *</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) =>
                    setFormData({ ...formData, reason: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defective">Nosoz mahsulot</SelectItem>
                    <SelectItem value="wrong_item">Noto'g'ri mahsulot</SelectItem>
                    <SelectItem value="damaged">Shikastlangan</SelectItem>
                    <SelectItem value="not_as_described">Tavsifga mos emas</SelectItem>
                    <SelectItem value="changed_mind">Fikr o'zgardi</SelectItem>
                    <SelectItem value="other">Boshqa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            {formData.items.length > 0 && formData.items[0].product_name && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Qaytariladigan mahsulotlar</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Mahsulot</TableHead>
                        <TableHead className="w-24">Miqdor</TableHead>
                        <TableHead className="w-36">Holati</TableHead>
                        <TableHead className="w-32 text-right">Summa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span>{item.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              max={item.max_quantity}
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(index, "quantity", e.target.value)
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.condition}
                              onValueChange={(value) =>
                                handleItemChange(index, "condition", value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="damaged">Shikastlangan</SelectItem>
                                <SelectItem value="opened">Ochilgan</SelectItem>
                                <SelectItem value="sealed">Muhrli</SelectItem>
                                <SelectItem value="used">Ishlatilgan</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between font-semibold text-lg">
                <span>Jami qaytarish summasi:</span>
                <span>{formatCurrency(totalAmount)}</span>
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
                disabled={!formData.invoice_id || totalAmount === 0}
              >
                Yaratish
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
              <RotateCcw className="w-5 h-5" />
              {selectedReturn?.return_number}
            </DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{selectedReturn.customer_name}</h3>
                  <p className="text-sm text-slate-500">
                    Faktura: {selectedReturn.invoice_id}
                  </p>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(selectedReturn.status)}
                  {getRefundStatusBadge(selectedReturn.refund_status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Qaytarish sanasi:</span>
                  <p className="font-medium">
                    {format(new Date(selectedReturn.return_date), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Sabab:</span>
                  <p className="font-medium">{getReasonLabel(selectedReturn.reason)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Mahsulot</TableHead>
                      <TableHead className="text-center">Miqdor</TableHead>
                      <TableHead>Holati</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReturn.items?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getConditionLabel(item.condition)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Jami:</span>
                  <span>{formatCurrency(selectedReturn.total_amount)}</span>
                </div>
                {selectedReturn.refund_status === "processed" && (
                  <div className="flex justify-between text-sm text-green-600 mt-2">
                    <span>Qaytarish usuli:</span>
                    <span>
                      {selectedReturn.refund_method === "cash"
                        ? "Naqd pul"
                        : "Kredit nota"}
                    </span>
                  </div>
                )}
              </div>

              {selectedReturn.notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
