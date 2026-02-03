import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  Package,
  Warehouse,
  Truck,
  CheckCircle2,
  XCircle,
  Filter,
  Play,
  Eye,
  AlertCircle,
  TrendingDown,
  Clock,
  DollarSign,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useInventory } from "@/components/contexts/InventoryContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/components/ui/use-toast";
import apiClient from "@/api/client";

const Replenishment = () => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { products, warehouses } = useInventory();
  const { canCreate, MODULES } = usePermissions();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [expandedVendors, setExpandedVendors] = useState({});

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const canRunReplenishment = canCreate(MODULES.PROCUREMENT);

  // Load replenishment preview
  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/replenishment/preview");
      setPreviewData(response.data);
      // Auto-select all items by default
      if (response.data?.items) {
        setSelectedItems(response.data.items.map(item => item.rule_id));
      }
    } catch (error) {
      console.error("Failed to load replenishment preview:", error);
      toast({
        title: "Error",
        description: "Failed to load replenishment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Filter items
  const filteredItems = previewData?.items?.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (vendorFilter !== "all" && item.vendor_id !== vendorFilter) return false;
    if (warehouseFilter !== "all" && item.warehouse_id !== warehouseFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesProduct = item.product_name?.toLowerCase().includes(search) ||
                            item.product_code?.toLowerCase().includes(search) ||
                            item.sku?.toLowerCase().includes(search);
      const matchesVendor = item.vendor_name?.toLowerCase().includes(search);
      if (!matchesProduct && !matchesVendor) return false;
    }
    return true;
  }) || [];

  // Group items by vendor
  const itemsByVendor = filteredItems.reduce((acc, item) => {
    const vendorKey = item.vendor_id || "no_vendor";
    if (!acc[vendorKey]) {
      acc[vendorKey] = {
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name || (t("no_vendor") || "No Vendor"),
        items: [],
        total: 0
      };
    }
    acc[vendorKey].items.push(item);
    acc[vendorKey].total += item.estimated_cost || 0;
    return acc;
  }, {});

  // Handle selection
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(filteredItems.map(item => item.rule_id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (ruleId, checked) => {
    if (checked) {
      setSelectedItems(prev => [...prev, ruleId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== ruleId));
    }
  };

  const handleSelectVendor = (vendorKey, checked) => {
    const vendorItems = itemsByVendor[vendorKey]?.items || [];
    const vendorRuleIds = vendorItems.map(item => item.rule_id);

    if (checked) {
      setSelectedItems(prev => [...new Set([...prev, ...vendorRuleIds])]);
    } else {
      setSelectedItems(prev => prev.filter(id => !vendorRuleIds.includes(id)));
    }
  };

  // Run replenishment
  const runReplenishment = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: t("warning") || "Warning",
        description: t("select_items_to_replenish") || "Please select items to replenish",
        variant: "warning",
      });
      return;
    }

    try {
      setRunning(true);
      setShowConfirmDialog(false);

      const response = await apiClient.post("/replenishment/run", {
        rule_ids: selectedItems
      });

      setLastResult(response.data);

      toast({
        title: t("success") || "Success",
        description: response.data?.message || `Created ${response.data?.orders_created || 0} purchase orders`,
      });

      // Reload preview to see updated data
      await loadPreview();
      setSelectedItems([]);
    } catch (error) {
      console.error("Failed to run replenishment:", error);
      toast({
        title: t("error") || "Error",
        description: error.response?.data?.message || t("failed_to_run_replenishment") || "Failed to run replenishment",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const toggleVendor = (vendorKey) => {
    setExpandedVendors(prev => ({
      ...prev,
      [vendorKey]: !prev[vendorKey]
    }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "critical":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t("critical") || "Critical"}</Badge>;
      case "low":
        return <Badge variant="outline" className="border-orange-500 text-orange-600 gap-1"><AlertTriangle className="w-3 h-3" />{t("low") || "Low"}</Badge>;
      case "reorder":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600 gap-1"><TrendingDown className="w-3 h-3" />{t("reorder") || "Reorder"}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  // Get unique vendors for filter
  const uniqueVendors = [...new Set(previewData?.items?.filter(i => i.vendor_id).map(i => ({
    id: i.vendor_id,
    name: i.vendor_name
  })) || [])];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("replenishment") || "Replenishment"}</h1>
            <p className="text-muted-foreground">
              {t("replenishment_description") || "Create purchase orders for products that need restocking"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadPreview} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t("refresh") || "Refresh"}
            </Button>
            {canRunReplenishment && selectedItems.length > 0 && (
              <Button onClick={() => setShowConfirmDialog(true)} disabled={running}>
                {running ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {t("run_replenishment") || "Run Replenishment"} ({selectedItems.length})
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("critical") || "Critical"}</p>
                  <p className="text-2xl font-bold">{previewData?.critical_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("low_stock") || "Low Stock"}</p>
                  <p className="text-2xl font-bold">{previewData?.low_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("needs_reorder") || "Needs Reorder"}</p>
                  <p className="text-2xl font-bold">{previewData?.reorder_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("no_vendor") || "No Vendor"}</p>
                  <p className="text-2xl font-bold">{previewData?.no_vendor_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("estimated_cost") || "Estimated Cost"}</p>
                  <p className="text-2xl font-bold">{formatCurrency(previewData?.total_cost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last Result */}
        {lastResult && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">{lastResult.message}</p>
                    {lastResult.skipped_items?.length > 0 && (
                      <p className="text-sm text-green-600">
                        {t("skipped_items") || "Skipped items"}: {lastResult.skipped_items.length}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLastResult(null)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t("filters") || "Filters"}:</span>
              </div>

              <Input
                placeholder={t("search") || "Search..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t("status") || "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_statuses") || "All Statuses"}</SelectItem>
                  <SelectItem value="critical">{t("critical") || "Critical"}</SelectItem>
                  <SelectItem value="low">{t("low") || "Low"}</SelectItem>
                  <SelectItem value="reorder">{t("reorder") || "Reorder"}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("vendor") || "Vendor"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_vendors") || "All Vendors"}</SelectItem>
                  {uniqueVendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products grouped by vendor */}
        <div className="space-y-4">
          {Object.keys(itemsByVendor).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">{t("all_stocked") || "All products are well stocked!"}</h3>
                <p className="text-muted-foreground">
                  {t("no_replenishment_needed") || "No products currently need replenishment based on your reorder rules."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center gap-3 px-4">
                <Checkbox
                  checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  {t("select_all") || "Select All"} ({filteredItems.length} {t("items") || "items"})
                </span>
              </div>

              {Object.entries(itemsByVendor).map(([vendorKey, vendorData]) => {
                const vendorItemIds = vendorData.items.map(i => i.rule_id);
                const allSelected = vendorItemIds.every(id => selectedItems.includes(id));
                const someSelected = vendorItemIds.some(id => selectedItems.includes(id));
                const isExpanded = expandedVendors[vendorKey] !== false; // Default to expanded

                return (
                  <Card key={vendorKey}>
                    <Collapsible open={isExpanded} onOpenChange={() => toggleVendor(vendorKey)}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(checked) => handleSelectVendor(vendorKey, checked)}
                              className={someSelected && !allSelected ? "opacity-50" : ""}
                            />
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="p-0 hover:bg-transparent">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  <span className="font-medium">{vendorData.vendor_name}</span>
                                  <Badge variant="secondary">{vendorData.items.length}</Badge>
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {t("estimated_total") || "Estimated Total"}: <strong>{formatCurrency(vendorData.total)}</strong>
                            </span>
                          </div>
                        </div>
                      </CardHeader>

                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>{t("product") || "Product"}</TableHead>
                                <TableHead>{t("warehouse") || "Warehouse"}</TableHead>
                                <TableHead className="text-center">{t("status") || "Status"}</TableHead>
                                <TableHead className="text-right">{t("current_stock") || "Current Stock"}</TableHead>
                                <TableHead className="text-right">{t("min_qty") || "Min Qty"}</TableHead>
                                <TableHead className="text-right">{t("order_qty") || "Order Qty"}</TableHead>
                                <TableHead className="text-right">{t("unit_price") || "Unit Price"}</TableHead>
                                <TableHead className="text-right">{t("estimated_cost") || "Est. Cost"}</TableHead>
                                <TableHead className="text-center">{t("lead_time") || "Lead Time"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vendorData.items.map(item => (
                                <TableRow key={item.rule_id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedItems.includes(item.rule_id)}
                                      onCheckedChange={(checked) => handleSelectItem(item.rule_id, checked)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.product_name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {item.product_code} {item.sku && `• ${item.sku}`}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {item.warehouse_name || (
                                      <span className="text-muted-foreground">{t("all_warehouses") || "All"}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getStatusBadge(item.status)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    <span className={item.current_stock <= 0 ? "text-red-600 font-bold" : ""}>
                                      {item.current_stock.toFixed(2)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {item.min_qty.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-bold text-primary">
                                    {item.suggested_qty.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(item.unit_price)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-medium">
                                    {formatCurrency(item.estimated_cost)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Clock className="w-3 h-3 text-muted-foreground" />
                                      <span>{item.lead_time_days} {t("days") || "days"}</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirm_replenishment") || "Confirm Replenishment"}</DialogTitle>
              <DialogDescription>
                {t("confirm_replenishment_description") || "This will create purchase orders for the selected products."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span>{t("selected_items") || "Selected Items"}</span>
                <Badge variant="secondary">{selectedItems.length}</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span>{t("purchase_orders_to_create") || "Purchase Orders to Create"}</span>
                <Badge variant="secondary">
                  {Object.keys(itemsByVendor).filter(k =>
                    k !== "no_vendor" &&
                    itemsByVendor[k].items.some(i => selectedItems.includes(i.rule_id))
                  ).length}
                </Badge>
              </div>

              {previewData?.vendor_summaries?.filter(v =>
                itemsByVendor[v.vendor_id]?.items.some(i => selectedItems.includes(i.rule_id))
              ).map(v => (
                <div key={v.vendor_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{v.vendor_name}</p>
                    <p className="text-sm text-muted-foreground">{v.item_count} {t("items") || "items"}</p>
                  </div>
                  <span className="font-mono">{formatCurrency(v.total_cost)}</span>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                {t("cancel") || "Cancel"}
              </Button>
              <Button onClick={runReplenishment} disabled={running}>
                {running ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                {t("create_purchase_orders") || "Create Purchase Orders"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Replenishment;
