import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  FileText,
  Minus,
} from "lucide-react";
import { format } from "date-fns";
import { useInventory } from "@/components/contexts/InventoryContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";

export default function StockReport() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { stockMovements, products, warehouses, inventory, stockCounts } = useInventory();

  const [activeTab, setActiveTab] = useState("movements");
  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  // === MOVEMENTS TAB ===
  const filteredMovements = useMemo(() => {
    return (stockMovements || [])
      .filter((m) => {
        const date = m.created_at || m.transaction_date;
        const dateStr = date ? new Date(date).toISOString().split("T")[0] : "";
        const inDateRange = (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);

        const matchesWarehouse =
          warehouseFilter === "all" ||
          m.warehouse_id === warehouseFilter ||
          m.to_warehouse_id === warehouseFilter ||
          m.from_warehouse_id === warehouseFilter;

        const matchesType = typeFilter === "all" || m.movement_type === typeFilter || m.transaction_type === typeFilter;

        const productName = m.product_name || products.find((p) => p.id === m.product_id)?.name || "";
        const productCode = m.product_code || products.find((p) => p.id === m.product_id)?.code || "";
        const matchesSearch =
          !searchQuery ||
          productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.reference || "").toLowerCase().includes(searchQuery.toLowerCase());

        return inDateRange && matchesWarehouse && matchesType && matchesSearch;
      })
      .sort((a, b) => new Date(b.created_at || b.transaction_date) - new Date(a.created_at || a.transaction_date));
  }, [stockMovements, products, searchQuery, warehouseFilter, typeFilter, dateFrom, dateTo]);

  // Movement summary stats
  const movementStats = useMemo(() => {
    let totalIn = 0,
      totalOut = 0,
      totalInValue = 0,
      totalOutValue = 0;
    filteredMovements.forEach((m) => {
      const type = m.movement_type || m.transaction_type;
      const qty = Math.abs(m.quantity || 0);
      const value = Math.abs(m.total_value || m.total_cost || qty * (m.unit_cost || 0));
      if (type === "receipt" || type === "purchase" || type === "stock_in" || (type === "adjustment" && m.quantity > 0)) {
        totalIn += qty;
        totalInValue += value;
      } else {
        totalOut += qty;
        totalOutValue += value;
      }
    });
    return { totalIn, totalOut, totalInValue, totalOutValue };
  }, [filteredMovements]);

  const getMovementIcon = (type) => {
    switch (type) {
      case "receipt":
      case "purchase":
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case "shipment":
      case "sale":
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case "transfer":
        return <ArrowLeftRight className="w-4 h-4 text-blue-600" />;
      case "adjustment":
        return <FileText className="w-4 h-4 text-orange-600" />;
      case "stock_in":
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case "stock_out":
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case "scrap":
        return <Minus className="w-4 h-4 text-red-600" />;
      default:
        return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  const getMovementBadge = (type) => {
    const labels = {
      receipt: { label: language === "uz" ? "Kirim" : "Receipt", color: "bg-green-100 text-green-700" },
      purchase: { label: language === "uz" ? "Xarid" : "Purchase", color: "bg-green-100 text-green-700" },
      shipment: { label: language === "uz" ? "Chiqim" : "Shipment", color: "bg-red-100 text-red-700" },
      sale: { label: language === "uz" ? "Sotuv" : "Sale", color: "bg-red-100 text-red-700" },
      transfer: { label: language === "uz" ? "O'tkazma" : "Transfer", color: "bg-blue-100 text-blue-700" },
      adjustment: { label: language === "uz" ? "Tuzatish" : "Adjustment", color: "bg-orange-100 text-orange-700" },
      stock_in: { label: language === "uz" ? "Kirim" : "Stock In", color: "bg-green-100 text-green-700" },
      stock_out: { label: language === "uz" ? "Chiqim" : "Stock Out", color: "bg-red-100 text-red-700" },
      scrap: { label: language === "uz" ? "Yaroqsiz" : "Scrap", color: "bg-red-100 text-red-700" },
    };
    const info = labels[type] || { label: type || "-", color: "bg-slate-100 text-slate-700" };
    return <Badge className={info.color}>{info.label}</Badge>;
  };

  // === STOCK CHANGES (ostatka) TAB ===
  const stockChangeData = useMemo(() => {
    const productMap = {};

    (stockMovements || []).forEach((m) => {
      const date = m.created_at || m.transaction_date;
      const dateStr = date ? new Date(date).toISOString().split("T")[0] : "";
      if (dateFrom && dateStr < dateFrom) return;
      if (dateTo && dateStr > dateTo) return;
      if (warehouseFilter !== "all" && m.warehouse_id !== warehouseFilter && m.to_warehouse_id !== warehouseFilter) return;

      const pid = m.product_id;
      if (!productMap[pid]) {
        const prod = products.find((p) => p.id === pid);
        const inv = inventory.find((i) => i.product_id === pid && (warehouseFilter === "all" || i.warehouse_id === warehouseFilter));
        productMap[pid] = {
          product_id: pid,
          product_name: m.product_name || prod?.name || "-",
          product_code: m.product_code || prod?.code || "-",
          current_qty: inv?.quantity || 0,
          total_in: 0,
          total_out: 0,
          total_in_value: 0,
          total_out_value: 0,
        };
      }

      const type = m.movement_type || m.transaction_type;
      const qty = Math.abs(m.quantity || 0);
      const value = Math.abs(m.total_value || m.total_cost || qty * (m.unit_cost || 0));

      if (type === "receipt" || type === "purchase" || type === "stock_in" || (type === "adjustment" && m.quantity > 0)) {
        productMap[pid].total_in += qty;
        productMap[pid].total_in_value += value;
      } else {
        productMap[pid].total_out += qty;
        productMap[pid].total_out_value += value;
      }
    });

    let data = Object.values(productMap);
    if (searchQuery) {
      data = data.filter(
        (d) =>
          d.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.product_code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return data.sort((a, b) => b.total_in + b.total_out - (a.total_in + a.total_out));
  }, [stockMovements, products, inventory, searchQuery, warehouseFilter, dateFrom, dateTo]);

  // === ADJUSTMENTS P&L (inventarizatsiya) TAB ===
  const adjustmentPnL = useMemo(() => {
    const items = [];
    let totalProfit = 0;
    let totalLoss = 0;

    // From stock movements (adjustments, stock_in, stock_out)
    const pnlTypes = new Set(["adjustment", "stock_in", "stock_out"]);
    (stockMovements || []).forEach((m) => {
      const type = m.movement_type || m.transaction_type;
      if (!pnlTypes.has(type)) return;

      const date = m.created_at || m.transaction_date;
      const dateStr = date ? new Date(date).toISOString().split("T")[0] : "";
      if (dateFrom && dateStr < dateFrom) return;
      if (dateTo && dateStr > dateTo) return;

      const prod = products.find((p) => p.id === m.product_id);
      const qty = m.quantity || 0;
      const unitCost = m.unit_cost || prod?.cost_price || 0;
      const value = Math.abs(qty) * unitCost;

      if (qty > 0) {
        totalProfit += value;
        items.push({
          date: date,
          product_name: m.product_name || prod?.name || "-",
          product_code: m.product_code || prod?.code || "-",
          quantity: qty,
          unit_cost: unitCost,
          value: value,
          type: "profit",
          reference: m.reference || "-",
          notes: m.notes || m.reason || "",
        });
      } else if (qty < 0) {
        totalLoss += value;
        items.push({
          date: date,
          product_name: m.product_name || prod?.name || "-",
          product_code: m.product_code || prod?.code || "-",
          quantity: qty,
          unit_cost: unitCost,
          value: value,
          type: "loss",
          reference: m.reference || "-",
          notes: m.notes || m.reason || "",
        });
      }
    });

    // From stock counts (inventarizatsiya)
    (stockCounts || []).forEach((sc) => {
      if (sc.status !== "completed") return;
      const date = sc.completed_at || sc.updated_at || sc.created_at;
      const dateStr = date ? new Date(date).toISOString().split("T")[0] : "";
      if (dateFrom && dateStr < dateFrom) return;
      if (dateTo && dateStr > dateTo) return;

      (sc.lines || []).forEach((line) => {
        const diff = (line.actual_quantity || 0) - (line.expected_quantity || line.system_quantity || 0);
        if (diff === 0) return;

        const prod = products.find((p) => p.id === line.product_id);
        const unitCost = line.unit_cost || prod?.cost_price || 0;
        const value = Math.abs(diff) * unitCost;

        if (diff > 0) {
          totalProfit += value;
          items.push({
            date: date,
            product_name: prod?.name || line.product_name || "-",
            product_code: prod?.code || line.product_code || "-",
            quantity: diff,
            unit_cost: unitCost,
            value: value,
            type: "profit",
            reference: sc.count_number || sc.reference || `SC-${sc.id?.slice(0, 6)}`,
            notes: language === "uz" ? "Inventarizatsiya natijasi" : "Stock count result",
          });
        } else {
          totalLoss += value;
          items.push({
            date: date,
            product_name: prod?.name || line.product_name || "-",
            product_code: prod?.code || line.product_code || "-",
            quantity: diff,
            unit_cost: unitCost,
            value: value,
            type: "loss",
            reference: sc.count_number || sc.reference || `SC-${sc.id?.slice(0, 6)}`,
            notes: language === "uz" ? "Inventarizatsiya natijasi" : "Stock count result",
          });
        }
      });
    });

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { items, totalProfit, totalLoss, netResult: totalProfit - totalLoss };
  }, [stockMovements, stockCounts, products, dateFrom, dateTo, language]);

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd.MM.yyyy");
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {language === "uz" ? "Qidirish" : "Search"}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={language === "uz" ? "Maxsulot nomi yoki kodi..." : "Product name or code..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {language === "uz" ? "Ombor" : "Warehouse"}
              </label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "uz" ? "Barchasi" : "All"}</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeTab === "movements" && (
              <div className="w-[180px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  {language === "uz" ? "Turi" : "Type"}
                </label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "uz" ? "Barchasi" : "All"}</SelectItem>
                    <SelectItem value="receipt">{language === "uz" ? "Kirim" : "Receipt"}</SelectItem>
                    <SelectItem value="shipment">{language === "uz" ? "Chiqim" : "Shipment"}</SelectItem>
                    <SelectItem value="transfer">{language === "uz" ? "O'tkazma" : "Transfer"}</SelectItem>
                    <SelectItem value="adjustment">{language === "uz" ? "Tuzatish" : "Adjustment"}</SelectItem>
                    <SelectItem value="scrap">{language === "uz" ? "Yaroqsiz" : "Scrap"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-[150px]">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {language === "uz" ? "Dan" : "From"}
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="w-[150px]">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {language === "uz" ? "Gacha" : "To"}
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/60 p-1 rounded-lg border border-slate-200/60 shadow-sm">
          <TabsTrigger value="movements" className="flex items-center gap-1.5">
            <ArrowLeftRight className="w-4 h-4" />
            {language === "uz" ? "Harakatlar" : "Movements"}
          </TabsTrigger>
          <TabsTrigger value="stock-changes" className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            {language === "uz" ? "Ostatka o'zgarishi" : "Stock Changes"}
          </TabsTrigger>
          <TabsTrigger value="adjustment-pnl" className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {language === "uz" ? "Foyda / Zarar" : "Adjustment P&L"}
          </TabsTrigger>
        </TabsList>

        {/* === MOVEMENTS TAB === */}
        <TabsContent value="movements" className="mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="text-xs text-green-600 font-medium">{language === "uz" ? "Jami kirim" : "Total In"}</div>
                <div className="text-xl font-bold text-green-700">{movementStats.totalIn.toLocaleString()}</div>
                <div className="text-xs text-green-500">{formatCurrencyCompact(movementStats.totalInValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="text-xs text-red-600 font-medium">{language === "uz" ? "Jami chiqim" : "Total Out"}</div>
                <div className="text-xl font-bold text-red-700">{movementStats.totalOut.toLocaleString()}</div>
                <div className="text-xs text-red-500">{formatCurrencyCompact(movementStats.totalOutValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-xs text-blue-600 font-medium">{language === "uz" ? "Farq" : "Net Change"}</div>
                <div className="text-xl font-bold text-blue-700">
                  {(movementStats.totalIn - movementStats.totalOut).toLocaleString()}
                </div>
                <div className="text-xs text-blue-500">
                  {formatCurrencyCompact(movementStats.totalInValue - movementStats.totalOutValue)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 font-medium">
                  {language === "uz" ? "Harakatlar soni" : "Total Movements"}
                </div>
                <div className="text-xl font-bold text-slate-700">{filteredMovements.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Movements Table */}
          <Card className="bg-white/80">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{language === "uz" ? "Sana" : "Date"}</TableHead>
                      <TableHead>{language === "uz" ? "Maxsulot" : "Product"}</TableHead>
                      <TableHead>{language === "uz" ? "Turi" : "Type"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Miqdor" : "Qty"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Qiymat" : "Value"}</TableHead>
                      <TableHead>{language === "uz" ? "Havola" : "Reference"}</TableHead>
                      <TableHead>{language === "uz" ? "Ombor" : "Warehouse"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                          {language === "uz" ? "Harakatlar topilmadi" : "No movements found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovements.slice(0, 200).map((m, idx) => {
                        const type = m.movement_type || m.transaction_type;
                        const prod = products.find((p) => p.id === m.product_id);
                        const wh = warehouses.find((w) => w.id === m.warehouse_id);
                        const qty = m.quantity || 0;
                        const value = Math.abs(m.total_value || m.total_cost || Math.abs(qty) * (m.unit_cost || 0));
                        return (
                          <TableRow key={m.id || idx} className="hover:bg-slate-50">
                            <TableCell className="text-sm">{formatDate(m.created_at || m.transaction_date)}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm">{m.product_name || prod?.name || "-"}</div>
                                <div className="text-xs text-slate-400">{m.product_code || prod?.code}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {getMovementIcon(type)}
                                {getMovementBadge(type)}
                              </div>
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono font-semibold ${qty > 0 ? "text-green-600" : qty < 0 ? "text-red-600" : ""}`}
                            >
                              {qty > 0 ? "+" : ""}
                              {qty.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrency(value)}</TableCell>
                            <TableCell className="text-sm text-slate-600">{m.reference || "-"}</TableCell>
                            <TableCell className="text-sm">{m.warehouse_name || wh?.name || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === STOCK CHANGES TAB === */}
        <TabsContent value="stock-changes" className="mt-4">
          <Card className="bg-white/80">
            <CardHeader>
              <CardTitle className="text-base">
                {language === "uz" ? "Maxsulot bo'yicha ostatka o'zgarishi" : "Stock Changes by Product"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{language === "uz" ? "Kod" : "Code"}</TableHead>
                      <TableHead>{language === "uz" ? "Maxsulot" : "Product"}</TableHead>
                      <TableHead className="text-right text-green-600">{language === "uz" ? "Kirim" : "In"}</TableHead>
                      <TableHead className="text-right text-red-600">{language === "uz" ? "Chiqim" : "Out"}</TableHead>
                      <TableHead className="text-right text-blue-600">{language === "uz" ? "Farq" : "Net"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Joriy ostatka" : "Current Stock"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Kirim qiymati" : "In Value"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Chiqim qiymati" : "Out Value"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockChangeData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                          {language === "uz" ? "Ma'lumot topilmadi" : "No data found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockChangeData.map((item) => (
                        <TableRow key={item.product_id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-xs">{item.product_code}</TableCell>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right font-mono text-green-600 font-semibold">
                            +{item.total_in.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600 font-semibold">
                            -{item.total_out.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-bold ${item.total_in - item.total_out >= 0 ? "text-blue-600" : "text-orange-600"}`}
                          >
                            {item.total_in - item.total_out >= 0 ? "+" : ""}
                            {(item.total_in - item.total_out).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{item.current_qty.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(item.total_in_value)}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(item.total_out_value)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ADJUSTMENT P&L TAB === */}
        <TabsContent value="adjustment-pnl" className="mt-4">
          {/* P&L Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {language === "uz" ? "Foyda (ortiqcha)" : "Profit (surplus)"}
                </div>
                <div className="text-xl font-bold text-green-700">{formatCurrencyCompact(adjustmentPnL.totalProfit)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mb-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {language === "uz" ? "Zarar (kamomad)" : "Loss (shortage)"}
                </div>
                <div className="text-xl font-bold text-red-700">{formatCurrencyCompact(adjustmentPnL.totalLoss)}</div>
              </CardContent>
            </Card>
            <Card className={adjustmentPnL.netResult >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <CardContent className="p-4">
                <div className="text-xs font-medium mb-1" style={{ color: adjustmentPnL.netResult >= 0 ? "#15803d" : "#b91c1c" }}>
                  {language === "uz" ? "Sof natija" : "Net Result"}
                </div>
                <div className="text-xl font-bold" style={{ color: adjustmentPnL.netResult >= 0 ? "#15803d" : "#b91c1c" }}>
                  {adjustmentPnL.netResult >= 0 ? "+" : ""}
                  {formatCurrencyCompact(adjustmentPnL.netResult)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 font-medium mb-1">
                  {language === "uz" ? "Tuzatishlar soni" : "Adjustments"}
                </div>
                <div className="text-xl font-bold text-slate-700">{adjustmentPnL.items.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Adjustments Table */}
          <Card className="bg-white/80">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{language === "uz" ? "Sana" : "Date"}</TableHead>
                      <TableHead>{language === "uz" ? "Maxsulot" : "Product"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Miqdor" : "Qty"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Narx" : "Unit Cost"}</TableHead>
                      <TableHead className="text-right">{language === "uz" ? "Qiymat" : "Value"}</TableHead>
                      <TableHead>{language === "uz" ? "Natija" : "Result"}</TableHead>
                      <TableHead>{language === "uz" ? "Havola" : "Reference"}</TableHead>
                      <TableHead>{language === "uz" ? "Izoh" : "Notes"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustmentPnL.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                          {language === "uz" ? "Tuzatishlar topilmadi" : "No adjustments found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      adjustmentPnL.items.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50">
                          <TableCell className="text-sm">{formatDate(item.date)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{item.product_name}</div>
                              <div className="text-xs text-slate-400">{item.product_code}</div>
                            </div>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-semibold ${item.quantity > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {item.quantity > 0 ? "+" : ""}
                            {item.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_cost)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(item.value)}</TableCell>
                          <TableCell>
                            {item.type === "profit" ? (
                              <Badge className="bg-green-100 text-green-700">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                {language === "uz" ? "Foyda" : "Profit"}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700">
                                <TrendingDown className="w-3 h-3 mr-1" />
                                {language === "uz" ? "Zarar" : "Loss"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{item.reference}</TableCell>
                          <TableCell className="text-sm text-slate-500 max-w-[150px] truncate">{item.notes}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
