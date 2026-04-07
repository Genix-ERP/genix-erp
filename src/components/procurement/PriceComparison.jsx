import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
  Award,
  Building2,
  Package,
  BarChart3,
  Star,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { useProcurement } from "@/components/contexts/ProcurementContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

export default function PriceComparison() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const { purchaseOrders, suppliers } = useProcurement();

  const [productSearch, setProductSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  // quality % is local-only, keyed by "productName__supplierId"
  const [qualityMap, setQualityMap] = useState({});

  const getSupplierName = (id) => {
    const s = suppliers.find((s) => s.id === id);
    return s?.name || id || "—";
  };

  // Build comparison data from purchase order history
  const comparisonData = useMemo(() => {
    // Map: productName -> { supplierId -> { prices[], supplierName } }
    const map = {};

    purchaseOrders.forEach((po) => {
      const supplierId = po.vendor_id || po.supplier_id;
      const supplierName = getSupplierName(supplierId);
      const lines = po.lines || [];

      lines.forEach((line) => {
        const productName =
          line.product_name || line.description || line.name || "";
        if (!productName) return;
        const price = parseFloat(line.unit_price) || 0;
        if (price === 0) return;

        if (!map[productName]) map[productName] = {};
        if (!map[productName][supplierId]) {
          map[productName][supplierId] = {
            supplierName,
            supplierId,
            prices: [],
          };
        }
        map[productName][supplierId].prices.push({
          price,
          date: po.order_date || po.created_at || "",
        });
      });
    });

    // Convert to array
    return Object.entries(map).map(([productName, supplierMap]) => {
      const supplierRows = Object.values(supplierMap).map((s) => {
        const sorted = [...s.prices].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        const latestPrice = sorted[0]?.price ?? 0;
        const prevPrice = sorted[1]?.price ?? null;
        const trend =
          prevPrice === null
            ? "neutral"
            : latestPrice < prevPrice
            ? "down"
            : latestPrice > prevPrice
            ? "up"
            : "neutral";
        return {
          ...s,
          latestPrice,
          prevPrice,
          trend,
          orderCount: s.prices.length,
        };
      });

      const prices = supplierRows.map((s) => s.latestPrice);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      return { productName, supplierRows, minPrice, maxPrice, avgPrice };
    });
  }, [purchaseOrders, suppliers]);

  const filtered = useMemo(() => {
    return comparisonData
      .filter((item) =>
        item.productName.toLowerCase().includes(productSearch.toLowerCase())
      )
      .map((item) => ({
        ...item,
        supplierRows: item.supplierRows.filter((s) =>
          s.supplierName.toLowerCase().includes(supplierSearch.toLowerCase())
        ),
      }))
      .filter((item) => item.supplierRows.length > 0);
  }, [comparisonData, productSearch, supplierSearch]);

  const qualityKey = (productName, supplierId) =>
    `${productName}__${supplierId}`;

  const handleQuality = (productName, supplierId, value) => {
    const v = Math.min(100, Math.max(0, parseInt(value) || 0));
    setQualityMap((prev) => ({
      ...prev,
      [qualityKey(productName, supplierId)]: v,
    }));
  };

  const getQuality = (productName, supplierId) =>
    qualityMap[qualityKey(productName, supplierId)] ?? "";

  const triggerClass =
    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {t("price_comparison") || "Narx solishtirish"}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("price_comparison_desc") ||
              "Postavchilar bo'yicha mahsulot narxlari taqqoslanishi"}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t("search_product") || "Mahsulot qidirish..."}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t("search_supplier") || "Postavchik qidirish..."}
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t("products") || "Mahsulotlar"}
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {comparisonData.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t("suppliers") || "Postavchilar"}
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {suppliers.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t("best_prices") || "Eng arzon"}
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {
                    comparisonData.filter(
                      (d) => d.supplierRows.length > 1
                    ).length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t("compared") || "Taqqosl. mahsulotlar"}
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {filtered.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {purchaseOrders.length === 0
                ? t("no_purchase_orders_for_comparison") ||
                  "Taqqoslash uchun buyurtma tarixi yo'q"
                : t("no_results") || "Natija topilmadi"}
            </p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((item) => (
          <Card
            key={item.productName}
            className="bg-white/80 backdrop-blur-sm overflow-hidden"
          >
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" />
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {item.productName}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {item.supplierRows.length}{" "}
                    {t("suppliers") || "postavchi"}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600 font-medium">
                    ↓ {formatCurrency(item.minPrice)}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    ∅ {formatCurrency(Math.round(item.avgPrice))}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-red-500 font-medium">
                    ↑ {formatCurrency(item.maxPrice)}
                  </span>
                </div>
              </div>
            </CardHeader>

            <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead className="text-xs">
                        {t("supplier") || "Postavchik"}
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        {t("price") || "Narx"}
                      </TableHead>
                      <TableHead className="text-xs text-center">
                        {t("trend") || "Trend"}
                      </TableHead>
                      <TableHead className="text-xs text-center w-24">
                        {t("quality_pct") || "Sifat %"}
                      </TableHead>
                      <TableHead className="text-xs text-center">
                        {t("orders") || "Buyurtmalar"}
                      </TableHead>
                      <TableHead className="text-xs text-center">
                        {t("status") || "Holat"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.supplierRows
                      .sort((a, b) => a.latestPrice - b.latestPrice)
                      .map((row, idx) => {
                        const isCheapest =
                          row.latestPrice === item.minPrice &&
                          item.supplierRows.length > 1;
                        const quality = getQuality(
                          item.productName,
                          row.supplierId
                        );
                        const priceDiff =
                          item.minPrice > 0
                            ? (
                                ((row.latestPrice - item.minPrice) /
                                  item.minPrice) *
                                100
                              ).toFixed(1)
                            : 0;

                        return (
                          <TableRow
                            key={row.supplierId}
                            className={
                              isCheapest ? "bg-green-50/50" : ""
                            }
                          >
                            <TableCell className="font-medium text-sm py-2">
                              <div className="flex items-center gap-1.5">
                                {isCheapest && (
                                  <Award className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                )}
                                <span className="truncate max-w-[130px]">
                                  {row.supplierName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 font-semibold tabular-nums">
                              <span
                                className={
                                  isCheapest
                                    ? "text-green-600"
                                    : "text-slate-800"
                                }
                              >
                                {formatCurrency(row.latestPrice)}
                              </span>
                              {!isCheapest && item.supplierRows.length > 1 && (
                                <div className="text-xs text-red-400 font-normal">
                                  +{priceDiff}%
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              {row.trend === "down" ? (
                                <TrendingDown className="w-4 h-4 text-green-500 mx-auto" />
                              ) : row.trend === "up" ? (
                                <TrendingUp className="w-4 h-4 text-red-500 mx-auto" />
                              ) : (
                                <Minus className="w-4 h-4 text-slate-400 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <div className="flex items-center gap-1 justify-center">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="—"
                                  value={quality}
                                  onChange={(e) =>
                                    handleQuality(
                                      item.productName,
                                      row.supplierId,
                                      e.target.value
                                    )
                                  }
                                  className="w-16 h-7 text-center text-xs px-1"
                                />
                                {quality !== "" && (
                                  <span className="text-xs text-slate-500">
                                    %
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm py-2 text-slate-500">
                              {row.orderCount}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              {isCheapest ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-1.5">
                                  {t("best") || "Eng yaxshi"}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-1.5 text-slate-500"
                                >
                                  {t("alternative") || "Muqobil"}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Bar chart */}
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500 mb-3">
                  {t("price_by_supplier") || "Postavchilar bo'yicha narx"}
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={item.supplierRows
                      .sort((a, b) => a.latestPrice - b.latestPrice)
                      .map((row) => ({
                        name:
                          row.supplierName.length > 14
                            ? row.supplierName.slice(0, 14) + "…"
                            : row.supplierName,
                        price: row.latestPrice,
                        isBest: row.latestPrice === item.minPrice,
                      }))}
                    margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        v >= 1000000
                          ? `${(v / 1000000).toFixed(1)}m`
                          : v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : v
                      }
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), t("price") || "Narx"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />
                    <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                      {item.supplierRows
                        .sort((a, b) => a.latestPrice - b.latestPrice)
                        .map((row, index) => (
                          <Cell
                            key={index}
                            fill={
                              row.latestPrice === item.minPrice
                                ? "#22c55e"
                                : "#818cf8"
                            }
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
