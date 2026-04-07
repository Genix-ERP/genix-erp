import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, Plus, Trash2, BarChart3, Package } from "lucide-react";
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
import { useInventory } from "@/components/contexts/InventoryContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

export default function PriceComparison() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();
  const { suppliers } = useProcurement();
  const { products } = useInventory();

  const [selectedProduct, setSelectedProduct] = useState("");
  const [rows, setRows] = useState([]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: Date.now(), supplier_id: "", supplier_name: "", price: "", quality: "" },
    ]);
  };

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "supplier_id") {
          const s = suppliers.find((s) => s.id === value);
          return { ...r, supplier_id: value, supplier_name: s?.name || "" };
        }
        return { ...r, [field]: value };
      })
    );
  };

  const enrichedRows = useMemo(() => {
    const prices = rows.map((r) => parseFloat(r.price)).filter((p) => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const hasMultiple = prices.length > 1;

    return rows.map((r) => {
      const price = parseFloat(r.price) || 0;
      const isBest = hasMultiple && minPrice !== null && price === minPrice;
      const priceDiff =
        minPrice && price > 0 && !isBest
          ? (((price - minPrice) / minPrice) * 100).toFixed(1)
          : null;
      return { ...r, price, isBest, priceDiff };
    });
  }, [rows]);

  const chartData = enrichedRows
    .filter((r) => r.price > 0 && (r.supplier_name || r.supplier_id))
    .sort((a, b) => a.price - b.price)
    .map((r) => ({
      name:
        (r.supplier_name || "—").length > 14
          ? (r.supplier_name).slice(0, 14) + "…"
          : r.supplier_name || "—",
      price: r.price,
      isBest: r.isBest,
    }));

  const selectedProductName = products?.find((p) => p.id === selectedProduct)?.name || "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t("price_comparison")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t("price_comparison_desc")}</p>
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-5 space-y-5">
          {/* Product selector */}
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-indigo-500 shrink-0" />
            <select
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="">{t("select_product")}</option>
              {(products || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProductName && (
              <Badge variant="outline" className="text-indigo-600 border-indigo-200 shrink-0">
                {selectedProductName}
              </Badge>
            )}
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold">{t("supplier")}</TableHead>
                  <TableHead className="text-xs font-semibold text-right w-40">{t("price")}</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-28">{t("quality_pct")}</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-32">{t("status")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      {t("no_comparison_rows")}
                    </TableCell>
                  </TableRow>
                ) : (
                  [...enrichedRows]
                    .sort((a, b) => {
                      if (a.price > 0 && b.price > 0) return a.price - b.price;
                      if (a.price > 0) return -1;
                      if (b.price > 0) return 1;
                      return 0;
                    })
                    .map((row) => (
                      <TableRow key={row.id} className={row.isBest ? "bg-green-50/60" : ""}>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            {row.isBest && (
                              <Award className="w-4 h-4 text-green-600 shrink-0" />
                            )}
                            <select
                              className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white w-44"
                              value={row.supplier_id}
                              onChange={(e) => updateRow(row.id, "supplier_id", e.target.value)}
                            >
                              <option value="">{t("select_supplier")}</option>
                              {(suppliers || []).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={row.price === 0 ? "" : row.price}
                              onChange={(e) => updateRow(row.id, "price", e.target.value)}
                              className={`w-36 text-right text-sm font-semibold ${row.isBest ? "border-green-300 text-green-700" : ""}`}
                            />
                            {row.priceDiff && (
                              <span className="text-xs text-red-400">+{row.priceDiff}%</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="—"
                              value={row.quality}
                              onChange={(e) => updateRow(row.id, "quality", e.target.value)}
                              className="w-16 text-center text-sm"
                            />
                            {row.quality !== "" && (
                              <span className="text-xs text-slate-500">%</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 text-center">
                          {row.isBest ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              {t("best_price")}
                            </Badge>
                          ) : row.price > 0 ? (
                            <Badge variant="outline" className="text-slate-500 text-xs">
                              {t("alternative")}
                            </Badge>
                          ) : null}
                        </TableCell>

                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(row.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 h-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full border-dashed border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("add_comparison_row")}
          </Button>

          {/* Bar chart — only when 2+ rows have prices */}
          {chartData.length >= 2 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                {t("price_by_supplier")}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000000 ? `${(v / 1000000).toFixed(1)}m`
                        : v >= 1000 ? `${(v / 1000).toFixed(0)}k`
                        : v
                    }
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), t("price")]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.isBest ? "#22c55e" : "#818cf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
