import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Plus,
  History,
  Package,
  Building2,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { useProcurement } from "@/components/contexts/ProcurementContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { MODULES } from "@/config/permissions";
import { inventoryService } from "@/api/services/inventory";

export default function PriceHistory() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    priceHistory,
    suppliers,
    addPriceRecord,
    isLoading,
  } = useProcurement();
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [formData, setFormData] = useState({
    product_id: "",
    product_name: "",
    supplier_id: "",
    price: "",
    currency: "UZS",
  });

  // Fetch products from backend
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filter price history
  const filteredHistory = useMemo(() => {
    return priceHistory.filter((item) => {
      const matchesSearch = item.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSupplier =
        supplierFilter === "all" || item.supplier_id === supplierFilter;
      return matchesSearch && matchesSupplier;
    });
  }, [priceHistory, searchQuery, supplierFilter]);

  // Get unique products for chart
  const uniqueProducts = useMemo(() => {
    const productMap = new Map();
    priceHistory.forEach((item) => {
      if (!productMap.has(item.product_name)) {
        productMap.set(item.product_name, []);
      }
      const existing = productMap.get(item.product_name);
      existing.push(item);
    });
    return productMap;
  }, [priceHistory]);

  // Prepare chart data for selected product
  const chartData = useMemo(() => {
    if (!selectedProduct) return [];

    const productData = priceHistory.filter(
      (p) => p.product_name === selectedProduct
    );

    // Get all unique dates and suppliers
    const allDates = new Set();
    const supplierPrices = {};

    productData.forEach((item) => {
      supplierPrices[item.supplier_name] = {};
      item.prices?.forEach((price) => {
        allDates.add(price.date);
        supplierPrices[item.supplier_name][price.date] = price.price;
      });
    });

    // Create chart data
    return Array.from(allDates)
      .sort()
      .map((date) => {
        const dataPoint = { date: format(new Date(date), "dd.MM") };
        Object.keys(supplierPrices).forEach((supplier) => {
          dataPoint[supplier] = supplierPrices[supplier][date] || null;
        });
        return dataPoint;
      });
  }, [selectedProduct, priceHistory]);

  const handleSubmit = async () => {
    try {
      await addPriceRecord(
        formData.product_name,
        formData.supplier_id,
        parseFloat(formData.price) || 0,
        formData.currency,
        formData.product_id
      );
      resetForm();
    } catch (error) {
      console.error('Failed to add price record:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormData({
      product_id: "",
      product_name: "",
      supplier_id: "",
      price: "",
      currency: "UZS",
    });
  };

  const getPriceTrend = (prices) => {
    if (!prices || prices.length < 2) return { trend: "stable", change: 0 };

    const sortedPrices = [...prices].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    const latest = sortedPrices[0]?.price || 0;
    const previous = sortedPrices[1]?.price || 0;

    if (previous === 0) return { trend: "stable", change: 0 };

    const change = ((latest - previous) / previous) * 100;

    if (change > 0) return { trend: "up", change };
    if (change < 0) return { trend: "down", change: Math.abs(change) };
    return { trend: "stable", change: 0 };
  };

  const getTrendIcon = (trend) => {
    if (trend === "up")
      return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (trend === "down")
      return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendBadge = (trend, change) => {
    if (trend === "up")
      return (
        <Badge className="bg-red-100 text-red-800">
          +{change.toFixed(1)}%
        </Badge>
      );
    if (trend === "down")
      return (
        <Badge className="bg-green-100 text-green-800">
          -{change.toFixed(1)}%
        </Badge>
      );
    return <Badge variant="outline">0%</Badge>;
  };

  const getLatestPrice = (prices) => {
    if (!prices || prices.length === 0) return null;
    const sorted = [...prices].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    return sorted[0];
  };

  // Chart colors
  const colors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">{t('price_history') || "Narxlar tarixi"}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('track_supplier_prices') || "Ta'minotchilar narxlarini kuzatib boring"}
          </p>
        </div>
        {canCreate(MODULES.PURCHASES) && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('add_price') || "Narx qo'shish"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('search_product') || "Mahsulot qidirish..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ta'minotchi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_suppliers') || "Barcha ta'minotchilar"}</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price List */}
        <div className="lg:col-span-2">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5" />
                {t('product_prices') || "Mahsulot narxlari"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">{t('no_price_history') || "Narxlar tarixi topilmadi"}</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('product') || "Mahsulot"}</TableHead>
                        <TableHead>{t('supplier') || "Ta'minotchi"}</TableHead>
                        <TableHead className="text-right">{t('current_price') || "Joriy narx"}</TableHead>
                        <TableHead>{t('change') || "O'zgarish"}</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((item) => {
                        const { trend, change } = getPriceTrend(item.prices);
                        const latestPrice = getLatestPrice(item.prices);
                        return (
                          <TableRow key={item.id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{item.product_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {item.supplier_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {latestPrice && (
                                <div>
                                  <div className="font-semibold">
                                    {formatCurrency(latestPrice.price, latestPrice.currency)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {format(new Date(latestPrice.date), "dd.MM.yyyy")}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getTrendIcon(trend)}
                                {getTrendBadge(trend, change)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedProduct(item.product_name)}
                              >
                                <BarChart3 className="w-4 h-4 mr-1" />
                                Grafik
                              </Button>
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
        </div>

        {/* Price Chart */}
        <div>
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg sticky top-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {t('price_chart') || "Narx grafigi"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProduct ? (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{selectedProduct}</span>
                    </div>
                  </div>
                  {chartData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          {Object.keys(chartData[0] || {})
                            .filter((key) => key !== "date")
                            .map((supplier, index) => (
                              <Line
                                key={supplier}
                                type="monotone"
                                dataKey={supplier}
                                stroke={colors[index % colors.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                              />
                            ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-slate-500 py-8">
                      {t('insufficient_data') || "Ma'lumotlar yetarli emas"}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedProduct(null)}
                  >
                    {t('clear') || "Tozalash"}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {t('select_product') || "Mahsulot tanlang"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('click_chart_to_view') || "Grafikni ko'rish uchun \"Grafik\" tugmasini bosing"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Price Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('add_new_price') || "Yangi narx qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('product') || "Mahsulot"} *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(value) => {
                  const selectedProd = products.find(p => p.id === value);
                  setFormData({
                    ...formData,
                    product_id: value,
                    product_name: selectedProd?.name || ""
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('select_product') || "Mahsulotni tanlang"} />
                </SelectTrigger>
                <SelectContent>
                  {productsLoading ? (
                    <SelectItem value="" disabled>
                      {t('loading') || "Yuklanmoqda..."}
                    </SelectItem>
                  ) : (
                    products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

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
                    .filter((s) => s.is_active !== false && s.status !== 'inactive')
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('price') || "Narx"} *</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
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
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel') || "Bekor qilish"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.product_id || !formData.supplier_id || !formData.price}
              >
                {t('save') || "Saqlash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
