import { useState, useMemo, useEffect } from "react";
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
  CalendarDays,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useInventory } from "@/components/contexts/InventoryContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { inventoryService } from "@/api/services/inventory";

// Transaction types that decrease stock (chiqim). Mirrors the backend
// classification in /inventory/turnover so the single-product detail
// breakdown agrees with the period totals shown in the cards.
const OUTGOING_TYPES = new Set([
  "issue", "sale", "ship", "delivery", "adjustment_out", "transfer_out",
  "consume", "production_out", "write_off", "scrap",
]);

export default function StockReport() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { stockMovements, products, warehouses, inventory, reloadMovements } = useInventory();

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

  // === STOCK STATUS / TURNOVER (Ombor holati) TAB ===
  // This view was moved out of the Products tab. Instead of replaying the
  // ledger to a single snapshot, the backend now returns a per-(product,
  // warehouse) turnover for the [dateFrom, dateTo] window: opening balance,
  // kirim/chiqim inside the period, and closing balance + weighted-average
  // cost. We only hit the endpoint when this tab is active so the other tabs
  // stay lean.
  const [turnoverRows, setTurnoverRows] = useState([]);
  const [turnoverLoading, setTurnoverLoading] = useState(false);
  const [turnoverError, setTurnoverError] = useState("");

  // Re-fetch transactions from the backend when date range, warehouse, or
  // type filter changes. The global InventoryContext load only pulls the top
  // 1000 most-recent rows across the entire system, so products whose
  // chiqim happened earlier (or got pushed out by busy days on other
  // products) silently lose their outgoing rows in the Hisobotlar tab.
  // Hitting /inventory/movements with the active filters guarantees we see
  // every row that matches the user's date window, up to the backend cap.
  useEffect(() => {
    if (!reloadMovements) return;
    reloadMovements({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      warehouse_id: warehouseFilter,
      type: typeFilter,
    });
    // IMPORTANT: do NOT add `reloadMovements` to the deps. It's a useCallback
    // that depends on `stockMovements`, and it calls setStockMovements — so it
    // gets a new identity after every fetch. Listing it here created an
    // infinite refetch loop that fired 1000+ /inventory/movements requests and
    // tripped the backend rate limiter (429). We only want to re-fetch when a
    // filter actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, warehouseFilter, typeFilter]);

  // Fetch the turnover sheet for the active window. include_deleted keeps
  // SKUs that existed during the period but have since been removed — same
  // rationale as the original stock-at-date report.
  useEffect(() => {
    if (activeTab !== "stock-status" || !dateFrom || !dateTo) return;
    // Validate the range locally so the user gets a localized message instead
    // of the raw backend 400 ("date_to must not be earlier than date_from").
    // dateFrom/dateTo are ISO YYYY-MM-DD strings, so a string compare is safe.
    if (dateFrom > dateTo) {
      setTurnoverRows([]);
      setTurnoverLoading(false);
      setTurnoverError(
        language === "uz"
          ? "«Gacha» sanasi «Dan» sanasidan oldin bo'lmasligi kerak"
          : "«To» date must not be earlier than «From» date",
      );
      return;
    }
    let cancelled = false;
    setTurnoverLoading(true);
    setTurnoverError("");
    inventoryService
      .getInventoryTurnover({
        date_from: dateFrom,
        date_to: dateTo,
        warehouse_id: warehouseFilter !== "all" ? warehouseFilter : undefined,
        include_deleted: true,
      })
      .then((data) => {
        if (cancelled) return;
        setTurnoverRows(Array.isArray(data?.rows) ? data.rows : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setTurnoverRows([]);
        setTurnoverError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load turnover",
        );
      })
      .finally(() => {
        if (!cancelled) setTurnoverLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, dateFrom, dateTo, warehouseFilter, language]);

  // Client-side search + period totals over the fetched turnover rows. Search
  // is cheap so we filter here rather than re-querying the backend.
  const turnoverData = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    const rows = q
      ? turnoverRows.filter(
          (r) =>
            String(r.product_name || "").toLowerCase().includes(q) ||
            String(r.product_code || "").toLowerCase().includes(q),
        )
      : turnoverRows;
    let inQty = 0,
      inValue = 0,
      outQty = 0,
      outValue = 0,
      closingValue = 0;
    rows.forEach((r) => {
      inQty += Number(r.in_qty || 0);
      inValue += Number(r.in_value || 0);
      outQty += Number(r.out_qty || 0);
      outValue += Number(r.out_value || 0);
      closingValue += Number(r.closing_value || 0);
    });
    return { rows, inQty, inValue, outQty, outValue, closingValue };
  }, [turnoverRows, searchQuery]);

  // When the turnover view has narrowed to a SINGLE product, surface that
  // product's individual kirim/chiqim transactions for the period so the user
  // can see exactly what moved. Movements come from stockMovements, which the
  // reloadMovements effect already scopes to the active date range + warehouse.
  const singleProductDetail = useMemo(() => {
    const ids = new Set(turnoverData.rows.map((r) => r.product_id));
    if (ids.size !== 1) return null; // 0 rows, or 2+ distinct products → no detail
    const first = turnoverData.rows[0];
    const movements = (stockMovements || [])
      .filter((m) => m.product_id === first.product_id)
      .filter((m) => {
        const date = m.created_at || m.transaction_date;
        const dateStr = date ? new Date(date).toISOString().split("T")[0] : "";
        const inRange = (!dateFrom || dateStr >= dateFrom) && (!dateTo || dateStr <= dateTo);
        const matchesWh =
          warehouseFilter === "all" ||
          m.warehouse_id === warehouseFilter ||
          m.to_warehouse_id === warehouseFilter ||
          m.from_warehouse_id === warehouseFilter;
        return inRange && matchesWh;
      })
      .sort((a, b) => new Date(b.created_at || b.transaction_date) - new Date(a.created_at || a.transaction_date));
    return { product_name: first.product_name, product_code: first.product_code, movements };
  }, [turnoverData.rows, stockMovements, dateFrom, dateTo, warehouseFilter]);

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
      issue: { label: language === "uz" ? "Chiqim" : "Issue", color: "bg-red-100 text-red-700" },
      shipment: { label: language === "uz" ? "Chiqim" : "Shipment", color: "bg-red-100 text-red-700" },
      sale: { label: language === "uz" ? "Sotuv" : "Sale", color: "bg-red-100 text-red-700" },
      transfer: { label: language === "uz" ? "O'tkazma" : "Transfer", color: "bg-blue-100 text-blue-700" },
      adjustment: { label: language === "uz" ? "Tuzatish" : "Adjustment", color: "bg-orange-100 text-orange-700" },
      stock_in: { label: language === "uz" ? "Kirim" : "Stock In", color: "bg-green-100 text-green-700" },
      stock_out: { label: language === "uz" ? "Chiqim" : "Stock Out", color: "bg-red-100 text-red-700" },
      return: { label: language === "uz" ? "Qaytarish" : "Return", color: "bg-yellow-100 text-yellow-700" },
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

    // From inventory transactions (adjustments from stock counts, manual adjustments, etc.)
    const pnlTypes = new Set(["adjustment", "count", "stock_in", "stock_out"]);
    (stockMovements || []).forEach((m) => {
      const type = m.movement_type || m.transaction_type;
      if (!pnlTypes.has(type)) return;

      const date = m.transaction_date || m.created_at;
      const dateStr = date ? new Date(date).toISOString().split("T")[0] : "";
      if (dateFrom && dateStr < dateFrom) return;
      if (dateTo && dateStr > dateTo) return;

      // Filter by warehouse if not "all"
      if (warehouseFilter && warehouseFilter !== "all") {
        const whMatch = m.from_warehouse_id === warehouseFilter || m.to_warehouse_id === warehouseFilter;
        if (!whMatch) return;
      }

      const prod = products.find((p) => p.id === m.product_id);
      const qty = m.quantity || 0;
      const unitCost = m.unit_cost || m.total_cost ? Math.abs((m.total_cost || 0) / (qty || 1)) : (prod?.cost_price || 0);
      const value = Math.abs(qty) * unitCost;

      if (value === 0) return; // Skip zero-value entries

      const entry = {
        date: date,
        product_name: m.product_name || prod?.name || "-",
        product_code: m.product_code || prod?.code || "-",
        quantity: qty,
        unit_cost: unitCost,
        value: value,
        reference: m.reason || m.reference_type || "-",
        notes: m.notes || "",
      };

      if (qty > 0) {
        totalProfit += value;
        items.push({ ...entry, type: "profit" });
      } else if (qty < 0) {
        totalLoss += value;
        items.push({ ...entry, type: "loss" });
      }
    });

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { items, totalProfit, totalLoss, netResult: totalProfit - totalLoss };
  }, [stockMovements, products, dateFrom, dateTo, warehouseFilter]);

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd.MM.yyyy");
    } catch {
      return "-";
    }
  };

  // Quantities can be fractional (kg, m³, …); keep up to 3 decimals.
  const fmtQty = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

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
                    <SelectItem value="issue">{language === "uz" ? "Chiqim" : "Issue"}</SelectItem>
                    <SelectItem value="shipment">{language === "uz" ? "Jo'natma" : "Shipment"}</SelectItem>
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
          <TabsTrigger value="stock-status" className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            {language === "uz" ? "Ombor holati" : "Stock Status"}
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

        {/* === STOCK STATUS / TURNOVER (Ombor holati) TAB === */}
        <TabsContent value="stock-status" className="mt-4">
          {/* Summary Cards — period totals (kirim / chiqim / net / closing value) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mb-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  {language === "uz" ? "Jami kirim" : "Total In"}
                </div>
                <div className="text-xl font-bold text-green-700">+{fmtQty(turnoverData.inQty)}</div>
                <div className="text-xs text-green-500">{formatCurrencyCompact(turnoverData.inValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {language === "uz" ? "Jami chiqim" : "Total Out"}
                </div>
                <div className="text-xl font-bold text-red-700">-{fmtQty(turnoverData.outQty)}</div>
                <div className="text-xs text-red-500">{formatCurrencyCompact(turnoverData.outValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-xs text-blue-600 font-medium mb-1">{language === "uz" ? "Sof farq" : "Net Change"}</div>
                <div className="text-xl font-bold text-blue-700">
                  {turnoverData.inQty - turnoverData.outQty >= 0 ? "+" : ""}
                  {fmtQty(turnoverData.inQty - turnoverData.outQty)}
                </div>
                <div className="text-xs text-blue-500">
                  {formatCurrencyCompact(turnoverData.inValue - turnoverData.outValue)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 font-medium mb-1">
                  {language === "uz" ? "Yakuniy qiymat" : "Closing Value"}
                </div>
                <div className="text-xl font-bold text-slate-700">{formatCurrencyCompact(turnoverData.closingValue)}</div>
                <div className="text-xs text-slate-500">
                  {turnoverData.rows.length} {language === "uz" ? "qator" : "rows"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Turnover Table */}
          <Card className="bg-white/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                {language === "uz" ? "Ombor holati — davr bo'yicha aylanma" : "Stock Status — period turnover"}
                <span className="text-xs font-normal text-slate-400">
                  {formatDate(dateFrom)} — {formatDate(dateTo)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {turnoverLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : turnoverError ? (
                <div className="text-center py-12 text-red-600 text-sm">{turnoverError}</div>
              ) : turnoverData.rows.length === 0 ? (
                <div className="text-center py-16 px-6 text-slate-500 text-sm">
                  {language === "uz" ? "Tanlangan davrda ombor ma'lumotlari yo'q" : "No stock data for the selected period"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{language === "uz" ? "Maxsulot" : "Product"}</TableHead>
                        <TableHead>{language === "uz" ? "Ombor" : "Warehouse"}</TableHead>
                        <TableHead className="text-right">{language === "uz" ? "Boshlang'ich" : "Opening"}</TableHead>
                        <TableHead className="text-right text-green-600">{language === "uz" ? "Kirim" : "In"}</TableHead>
                        <TableHead className="text-right text-red-600">{language === "uz" ? "Chiqim" : "Out"}</TableHead>
                        <TableHead className="text-right">{language === "uz" ? "Yakuniy" : "Closing"}</TableHead>
                        <TableHead className="text-right">{language === "uz" ? "O'rt. tannarx" : "Avg Cost"}</TableHead>
                        <TableHead className="text-right">{language === "uz" ? "Qiymat" : "Value"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {turnoverData.rows.map((r, idx) => {
                        const closing = Number(r.closing_qty || 0);
                        return (
                          <TableRow key={`${r.product_id}-${r.warehouse_id}-${idx}`} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{r.product_name}</span>
                                  {r.is_deleted && (
                                    <Badge variant="outline" className="border-red-300 text-red-700 text-[10px] uppercase">
                                      {language === "uz" ? "O'chirilgan" : "Deleted"}
                                    </Badge>
                                  )}
                                </div>
                                {r.product_code && <span className="text-xs text-slate-400 font-mono">{r.product_code}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-700">{r.warehouse_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-slate-600">{fmtQty(r.opening_qty)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-green-600">
                              +{fmtQty(r.in_qty)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-red-600">
                              -{fmtQty(r.out_qty)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono font-bold ${closing > 0 ? "text-slate-900" : closing < 0 ? "text-red-700" : "text-slate-500"}`}
                            >
                              {fmtQty(closing)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrency(Number(r.unit_cost || 0))}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-sm">
                              {formatCurrency(Number(r.closing_value || 0))}
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

          {/* Single-product drill-down — individual kirim/chiqim transactions
              for the period. Shown only when the search has narrowed the
              turnover to exactly one product. */}
          {singleProductDetail && (
            <Card className="bg-white/80 mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                  {language === "uz" ? "Kirim va chiqim harakatlari" : "Incomes & expenses"}
                  <span className="text-xs font-normal text-slate-400">{singleProductDetail.product_name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {singleProductDetail.movements.length === 0 ? (
                  <div className="text-center py-10 px-6 text-slate-500 text-sm">
                    {language === "uz" ? "Tanlangan davrda harakatlar yo'q" : "No movements in the selected period"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{language === "uz" ? "Sana" : "Date"}</TableHead>
                          <TableHead>{language === "uz" ? "Turi" : "Type"}</TableHead>
                          <TableHead className="text-right">{language === "uz" ? "Miqdor" : "Qty"}</TableHead>
                          <TableHead className="text-right">{language === "uz" ? "Narx" : "Unit Cost"}</TableHead>
                          <TableHead className="text-right">{language === "uz" ? "Qiymat" : "Value"}</TableHead>
                          <TableHead>{language === "uz" ? "Havola" : "Reference"}</TableHead>
                          <TableHead>{language === "uz" ? "Ombor" : "Warehouse"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {singleProductDetail.movements.map((m, idx) => {
                          const type = m.movement_type || m.transaction_type;
                          const isOut = OUTGOING_TYPES.has(type);
                          const qty = Math.abs(m.quantity || 0);
                          const value = Math.abs(m.total_value || m.total_cost || qty * (m.unit_cost || 0));
                          const unitCost = m.unit_cost || (qty ? value / qty : 0);
                          return (
                            <TableRow key={m.id || idx} className="hover:bg-slate-50">
                              <TableCell className="text-sm">{formatDate(m.created_at || m.transaction_date)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  {getMovementIcon(type)}
                                  {getMovementBadge(type)}
                                </div>
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono font-semibold ${isOut ? "text-red-600" : "text-green-600"}`}
                              >
                                {isOut ? "-" : "+"}
                                {fmtQty(qty)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCurrency(unitCost)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCurrency(value)}</TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {m.reference || m.reason || m.reference_type || "-"}
                              </TableCell>
                              <TableCell className="text-sm">{m.warehouse_name || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
