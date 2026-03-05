import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { inventoryService } from '@/api/services/inventory';
import apiClient from '@/api/client';
import {
  Plus,
  Search,
  ShoppingCart,
  Truck,
  Edit2,
  X,
  Eye,
  MessageSquareWarning,
  RotateCcw,
  ClipboardList,
  Layers,
  DollarSign,
  Trash2,
  Receipt,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

import { useProcurement } from '@/components/contexts/ProcurementContext';
import { useInventory } from '@/components/contexts/InventoryContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { procurementService } from '@/api/services/procurement';
import { financeService } from '@/api/services/finance';
import { useToast } from "@/components/ui/use-toast";
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import PurchaseReturns from './PurchaseReturns';
import BlanketOrders from './BlanketOrders';
import LandedCosts from './LandedCosts';

export default function PurchaseOrders() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate, canUpdate, MODULES } = usePermissions();
  const { getSetting } = useAdminSettings();
  const { taxRates = [] } = useFinancials();
  const { formatCurrency } = useCurrencyFormatter();
  const { toast } = useToast();
  const [, setSearchParams] = useSearchParams();

  // Get default tax from settings
  const defaultPurchaseTaxId = getSetting('purchase.tax.default_tax_id', '');
  const purchaseTaxRates = taxRates.filter(tr => tr.tax_type === 'purchase' || !tr.tax_type);
  // Prefer the explicitly configured default, fall back to first active purchase tax
  const defaultPurchaseTax = defaultPurchaseTaxId
    ? taxRates.find(tr => String(tr.id) === String(defaultPurchaseTaxId))
    : purchaseTaxRates.find(tr => tr.is_active !== false) || null;
  const defaultTaxPercent = defaultPurchaseTax?.rate || 0;

  const {
    suppliers,
    purchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    getSupplierById,
    isLoading,
  } = useProcurement();
  const { refreshData: refreshInventory } = useInventory();

  const [activeTab, setActiveTab] = useState('orders');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editPO, setEditPO] = useState(null);
  const [detailPO, setDetailPO] = useState(null);
  const [detailPOLines, setDetailPOLines] = useState([]);
  const [orderReturns, setOrderReturns] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Warehouses for selection
  const [warehouses, setWarehouses] = useState([]);

  // Product variants
  const [productVariants, setProductVariants] = useState({});

  // Product packagings
  const [productPackagings, setProductPackagings] = useState({});

  // Track if delivery date was manually set
  const [isDeliveryDateManual, setIsDeliveryDateManual] = useState(false);

  // Track which POs already have vendor bills
  const [poBillMap, setPoBillMap] = useState({});

  const [newPO, setNewPO] = useState({
    po_number: '',
    supplier_id: '',
    vendor_name: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    tax_percent: 0,
    tax_rate_id: '',
    payment_terms: 'net_30',
    lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
  });

  // Pre-fill default tax from settings
  useEffect(() => {
    if (defaultTaxPercent > 0 && newPO.tax_percent === 0) {
      setNewPO(prev => ({ ...prev, tax_percent: defaultTaxPercent, tax_rate_id: defaultPurchaseTax?.id || '' }));
    }
  }, [defaultTaxPercent]);

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        setProducts(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();

    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.listWarehouses();
        const list = Array.isArray(data) ? data : data?.items || [];
        setWarehouses(list);
        if (list.length === 1) {
          setNewPO(prev => ({ ...prev, warehouse_id: list[0].id }));
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  // Fetch purchase returns
  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const returns = await procurementService.listReturns();
        setPurchaseReturns(Array.isArray(returns) ? returns : []);
      } catch (error) {
        console.error('Failed to fetch purchase returns:', error);
      }
    };
    fetchReturns();
  }, []);

  // Fetch purchase invoices (vendor bills) to check which POs have bills
  useEffect(() => {
    const fetchBills = async () => {
      try {
        const bills = await financeService.listPurchaseInvoices({ page_size: 100 });
        const billList = Array.isArray(bills) ? bills : bills?.data || bills?.items || [];
        const map = {};
        billList.forEach(bill => {
          if (bill.purchase_order_id && bill.status !== 'cancelled') {
            map[bill.purchase_order_id] = true;
          }
        });
        setPoBillMap(map);
      } catch (error) {
        console.error('Failed to fetch purchase invoices:', error);
      }
    };
    fetchBills();
  }, []);

  // Check if an order already has a vendor bill
  const poHasBill = useCallback((poId) => {
    return !!poBillMap[poId];
  }, [poBillMap]);

  // Check if an order has returns
  const orderHasReturns = useCallback((poId) => {
    return purchaseReturns.some(r => r.purchase_order_id === poId);
  }, [purchaseReturns]);

  // Get returns for a specific order
  const getOrderReturns = useCallback((poId) => {
    return purchaseReturns.filter(r => r.purchase_order_id === poId);
  }, [purchaseReturns]);

  // Calculate delivery date based on product lead times
  const calculateDeliveryDate = useCallback((orderLines, orderDate) => {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const maxLeadTime = orderLines.reduce((max, line) => {
      const leadTime = line.product?.lead_time_days || line.lead_time_days || 0;
      return Math.max(max, leadTime);
    }, 0);

    if (maxLeadTime === 0) {
      return new Date().toISOString().split('T')[0];
    }

    const deliveryDate = new Date(baseDate);
    deliveryDate.setDate(deliveryDate.getDate() + maxLeadTime);
    return deliveryDate.toISOString().split('T')[0];
  }, []);

  // Filter purchase orders
  useEffect(() => {
    let filtered = purchaseOrders;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(po => po.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(po =>
        po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [purchaseOrders, searchQuery, statusFilter]);

  // Calculate order total from line items
  const calculateOrderTotal = (lines) => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)), 0);
  };

  // Calculate tax considering price_include flag
  const calculateTaxFromRate = (rawSubtotal, taxPercent, taxRateObj) => {
    const rate = parseFloat(taxPercent) || 0;
    if (rate <= 0) return { subtotal: rawSubtotal, taxAmount: 0, isInclusive: false };
    if (taxRateObj?.price_include) {
      const taxAmount = rawSubtotal * rate / (100 + rate);
      return { subtotal: rawSubtotal - taxAmount, taxAmount, isInclusive: true };
    }
    const taxAmount = rawSubtotal * rate / 100;
    return { subtotal: rawSubtotal, taxAmount, isInclusive: false };
  };

  // Handle line item changes
  const handleAddLine = () => {
    const newLines = [...newPO.lines, { product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }];
    setNewPO({ ...newPO, lines: newLines });
  };

  const handleRemoveLine = (index) => {
    const newLines = newPO.lines.filter((_, i) => i !== index);
    const updatedLines = newLines.length > 0 ? newLines : [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }];

    if (!isDeliveryDateManual) {
      const newDeliveryDate = calculateDeliveryDate(updatedLines, newPO.order_date);
      setNewPO({ ...newPO, lines: updatedLines, expected_delivery_date: newDeliveryDate, total_amount: calculateOrderTotal(updatedLines) });
    } else {
      setNewPO({ ...newPO, lines: updatedLines, total_amount: calculateOrderTotal(updatedLines) });
    }
  };

  // Fetch variants for a product
  const fetchProductVariants = useCallback(async (productId) => {
    if (!productId || productVariants[productId]) return;
    try {
      const response = await apiClient.get('/product-variants', { params: { product_id: productId } });
      setProductVariants(prev => ({ ...prev, [productId]: response.data?.data || [] }));
    } catch (error) {
      console.error('Failed to fetch variants:', error);
    }
  }, [productVariants]);

  // Fetch packagings for a product
  const fetchProductPackagings = useCallback(async (productId) => {
    if (!productId || productPackagings[productId]) return;
    try {
      const response = await apiClient.get(`/products/${productId}/packagings`);
      const packagings = (response.data?.data || []).filter(p => p.purchase !== false);
      setProductPackagings(prev => ({ ...prev, [productId]: packagings }));
    } catch (error) {
      console.error('Failed to fetch packagings:', error);
    }
  }, [productPackagings]);

  // Lookup vendor price for a product
  const lookupVendorPriceForProduct = useCallback(async (vendorId, productId) => {
    if (!vendorId || !productId) return null;
    try {
      const vendorPrice = await procurementService.lookupVendorPrice(vendorId, productId);
      return vendorPrice;
    } catch (error) {
      console.error('Failed to lookup vendor price:', error);
      return null;
    }
  }, []);

  const handleLineChange = async (index, field, value) => {
    const newLines = [...newPO.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        // Default to product's purchase price
        let unitPrice = selectedProduct.purchase_price || selectedProduct.cost_price || selectedProduct.price || 0;
        let leadTimeDays = selectedProduct.lead_time_days || 0;

        // Try to lookup vendor price if supplier is selected
        if (newPO.supplier_id) {
          const vendorPrice = await lookupVendorPriceForProduct(newPO.supplier_id, value);
          if (vendorPrice) {
            unitPrice = vendorPrice.price;
            leadTimeDays = vendorPrice.lead_time_days || leadTimeDays;
          }
        }

        // Auto-set UOM: prefer purchase_unit, fallback to default unit
        const unitId = selectedProduct.purchase_unit_id || selectedProduct.unit_id || null;
        const unitName = selectedProduct.purchase_unit_name || selectedProduct.unit_name || '';

        newLines[index] = {
          ...newLines[index],
          product_name: selectedProduct.name,
          product_id: selectedProduct.id,
          unit_price: unitPrice,
          lead_time_days: leadTimeDays,
          unit_id: unitId,
          unit_name: unitName,
          product: selectedProduct,
          variant_id: null,
          variant_name: null,
          packaging_id: null,
          packaging_qty: null,
          packaging_name: null,
          packaging_unit_qty: null
        };

        if (selectedProduct.has_variants) {
          fetchProductVariants(selectedProduct.id);
        }
        fetchProductPackagings(selectedProduct.id);

        if (!isDeliveryDateManual) {
          const newDeliveryDate = calculateDeliveryDate(newLines, newPO.order_date);
          setNewPO({ ...newPO, lines: newLines, expected_delivery_date: newDeliveryDate, total_amount: calculateOrderTotal(newLines) });
          return;
        }
      }
    }

    if (field === 'variant_id' && value) {
      const productId = newLines[index].product_id;
      const variants = productVariants[productId] || [];
      const selectedVariant = variants.find(v => v.id === value);
      if (selectedVariant) {
        newLines[index] = {
          ...newLines[index],
          variant_id: selectedVariant.id,
          variant_name: selectedVariant.variant_name,
          unit_price: selectedVariant.cost_price || newLines[index].unit_price
        };
      }
    }

    if (field === 'packaging_id') {
      const productId = newLines[index].product_id;
      if (value && value !== 'none') {
        const packagings = productPackagings[productId] || [];
        const selectedPackaging = packagings.find(p => p.id === value);
        if (selectedPackaging) {
          const packagingQty = newLines[index].packaging_qty || 1;
          newLines[index] = {
            ...newLines[index],
            packaging_id: selectedPackaging.id,
            packaging_name: selectedPackaging.name,
            packaging_unit_qty: selectedPackaging.qty,
            packaging_qty: packagingQty,
            quantity: packagingQty * selectedPackaging.qty
          };
        }
      } else {
        newLines[index] = {
          ...newLines[index],
          packaging_id: null,
          packaging_name: null,
          packaging_unit_qty: null,
          packaging_qty: null
        };
      }
    }

    if (field === 'packaging_qty' && newLines[index].packaging_id) {
      const packagingQty = parseFloat(value) || 1;
      const packagingUnitQty = newLines[index].packaging_unit_qty || 1;
      newLines[index] = {
        ...newLines[index],
        packaging_qty: packagingQty,
        quantity: packagingQty * packagingUnitQty
      };
    }

    setNewPO({ ...newPO, lines: newLines, total_amount: calculateOrderTotal(newLines) });
  };

  const handleCreatePO = async () => {
    if (!newPO.supplier_id && !newPO.vendor_name) return;

    setIsSubmitting(true);
    try {
      const supplier = getSupplierById(newPO.supplier_id);
      const rawSubtotal = calculateOrderTotal(newPO.lines);
      const taxPercent = parseFloat(newPO.tax_percent) || 0;
      const selectedTax = newPO.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newPO.tax_rate_id)) : defaultPurchaseTax;
      const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
      const subtotal = taxCalc.subtotal;
      const taxAmount = taxCalc.taxAmount;
      const totalAmount = subtotal + taxAmount;
      const poData = {
        ...newPO,
        po_number: newPO.po_number || `PO-${Date.now()}`,
        vendor_name: supplier?.name || newPO.vendor_name,
        subtotal: subtotal,
        total_amount: totalAmount,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        status: 'draft',
        ai_price_validation: true
      };

      await createPurchaseOrder(poData);
      setShowCreateModal(false);

      setNewPO({
        po_number: '',
        supplier_id: '',
        vendor_name: '',
        warehouse_id: warehouses.length === 1 ? warehouses[0].id : '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        tax_percent: defaultTaxPercent,
        payment_terms: 'net_30',
        lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
      });
      setIsDeliveryDateManual(false);
    } catch (error) {
      console.error('Error creating PO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPO = async (po, e) => {
    e.stopPropagation();
    setIsLoadingDetails(true);
    setDetailPO(po);
    setShowDetailModal(true);

    try {
      const fullOrder = await procurementService.getOrder(po.id);
      setDetailPO(fullOrder);
      setDetailPOLines(fullOrder.lines || []);

      const basicReturns = getOrderReturns(po.id);
      if (basicReturns.length > 0) {
        const detailedReturns = await Promise.all(
          basicReturns.map(async (ret) => {
            try {
              const fullReturn = await procurementService.getReturn(ret.id);
              return fullReturn;
            } catch {
              return ret;
            }
          })
        );
        setOrderReturns(detailedReturns);
      } else {
        setOrderReturns([]);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      setDetailPOLines([]);
      setOrderReturns([]);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEditPO = (po, e) => {
    e.stopPropagation();
    setEditPO({
      ...po,
      po_number: po.po_number || po.order_number,
      supplier_name: po.supplier_name || po.vendor_name,
      total_amount: po.total_amount || 0,
      expected_delivery_date: po.expected_delivery_date || po.expected_date || '',
      order_date: po.order_date ? (typeof po.order_date === 'string' ? po.order_date.split('T')[0] : po.order_date) : '',
    });
    setShowEditModal(true);
  };

  const handleUpdatePO = async () => {
    if (!editPO) return;

    setIsSubmitting(true);
    try {
      const updates = {};

      if (editPO.expected_delivery_date) {
        updates.expected_date = editPO.expected_delivery_date;
      }
      if (editPO.payment_terms) {
        updates.payment_terms = editPO.payment_terms;
      }
      if (editPO.status) {
        updates.status = editPO.status;
      }
      if (editPO.notes !== undefined) {
        updates.notes = editPO.notes;
      }
      if (editPO.vendor_reference !== undefined) {
        updates.vendor_reference = editPO.vendor_reference;
      }

      if (Object.keys(updates).length > 0) {
        await updatePurchaseOrder(editPO.id, updates);
      }
      if (editPO.status === 'cancelled') {
        await deletePurchaseOrder(editPO.id);
      }
      setShowEditModal(false);
      setEditPO(null);
    } catch (error) {
      console.error('Error updating PO:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePOStatus = async (poId, newStatus) => {
    const updates = { status: newStatus };
    await updatePurchaseOrder(poId, updates);
    if (newStatus === 'cancelled') {
      await deletePurchaseOrder(poId);
    }
  };

  const handleCreateBill = async (poId) => {
    try {
      const result = await procurementService.createBillFromPO(poId);
      setPoBillMap(prev => ({ ...prev, [poId]: true }));
      toast({
        title: t('bill_created_successfully') || 'Vendor bill created successfully',
        description: result?.invoice_number ? `#${result.invoice_number}` : undefined,
      });
      setSearchParams({ tab: 'suppliers', subtab: 'bills' }, { replace: true });
    } catch (error) {
      console.error('Failed to create bill:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to create vendor bill';
      toast({
        title: msg,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-purple-100 text-purple-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Orders and Returns */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-fit bg-slate-100/80 p-1 rounded-lg">
          <TabsTrigger value="orders" className="data-[state=active]:bg-white">
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('orders') || 'Orders'}
          </TabsTrigger>
          <TabsTrigger value="blanket-orders" className="data-[state=active]:bg-white">
            <Layers className="w-4 h-4 mr-2" />
            {t('blanket_orders') || 'Blanket Orders'}
          </TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-white">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('returns') || 'Returns'}
          </TabsTrigger>
          <TabsTrigger value="landed-costs" className="data-[state=active]:bg-white">
            <DollarSign className="w-4 h-4 mr-2" />
            {t('landed_costs') || 'Landed Costs'}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{t('purchase_orders') || 'Purchase Orders'}</CardTitle>
                {canCreate(MODULES.PURCHASES) && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" /> {t('new_po') || 'New PO'}
                  </Button>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search') || 'Search...'}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'All'}</SelectItem>
                    <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                    <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
                    <SelectItem value="confirmed">{t('confirmed') || 'Confirmed'}</SelectItem>
                    <SelectItem value="received">{t('received') || 'Received'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('orders_not_found') || 'Orders not found'}</p>
                  {canCreate(MODULES.PURCHASES) && (
                    <Button onClick={() => setShowCreateModal(true)} className="mt-4">{t('create_first_po') || 'Create First PO'}</Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('po_number') || 'PO #'}</TableHead>
                        <TableHead>{t('supplier') || 'Supplier'}</TableHead>
                        <TableHead>{t('order_date') || 'Order Date'}</TableHead>
                        <TableHead>{t('delivery_date') || 'Delivery Date'}</TableHead>
                        <TableHead>{t('amount') || 'Amount'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((po) => (
                        <TableRow key={po.id} className="hover:bg-slate-50">
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              {po.po_number}
                              {orderHasReturns(po.id) && (
                                <MessageSquareWarning className="w-4 h-4 text-red-500" title={t('has_returns') || 'Has Returns'} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{po.supplier_name || po.vendor_name}</TableCell>
                          <TableCell className="text-sm">
                            {po.order_date ? format(new Date(po.order_date), 'dd.MM.yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {(po.expected_delivery_date || po.expected_date) ? format(new Date(po.expected_delivery_date || po.expected_date), 'dd.MM.yyyy') : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">{(po.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(po.status)}>{t(po.status) || po.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={(e) => handleViewPO(po, e)} title={t('view_details') || 'View Details'}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canUpdate(MODULES.PURCHASES) && (
                                <Button size="sm" variant="ghost" onClick={(e) => handleEditPO(po, e)} title={t('edit') || 'Edit'}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && po.status === 'draft' && (
                                <Button size="sm" variant="ghost" onClick={() => updatePOStatus(po.id, 'sent')}>
                                  {t('send') || 'Send'}
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && po.status === 'sent' && (
                                <Button size="sm" variant="ghost" onClick={() => approvePurchaseOrder(po.id)}>
                                  {t('confirm') || 'Confirm'}
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && po.status === 'confirmed' && (
                                <Button size="sm" variant="ghost" onClick={() => receivePurchaseOrder(po.id, {}).then(() => refreshInventory())}>
                                  <Truck className="w-4 h-4" />
                                </Button>
                              )}
                              {['confirmed', 'received', 'partial'].includes(po.status) && !poHasBill(po.id) && (
                                <Button size="sm" variant="ghost" onClick={() => handleCreateBill(po.id)} title={t('create_bill') || 'Create Bill'}>
                                  <Receipt className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                              {canUpdate(MODULES.PURCHASES) && (po.status === 'draft' || po.status === 'cancelled') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteConfirm(po)}
                                  title={t('delete') || 'Delete'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blanket Orders Tab */}
        <TabsContent value="blanket-orders" className="mt-4">
          <BlanketOrders />
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="mt-4">
          <PurchaseReturns />
        </TabsContent>

        {/* Landed Costs Tab */}
        <TabsContent value="landed-costs" className="mt-4">
          <LandedCosts />
        </TabsContent>
      </Tabs>

      {/* Create PO Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) {
          setIsDeliveryDateManual(false);
          setNewPO({
            po_number: '',
            supplier_id: '',
            vendor_name: '',
            warehouse_id: warehouses.length === 1 ? warehouses[0].id : '',
            order_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: new Date().toISOString().split('T')[0],
            total_amount: 0,
            tax_percent: defaultTaxPercent || 0,
            payment_terms: 'net_30',
            lines: [{ product_id: '', product_name: '', quantity: 1, unit_price: 0, lead_time_days: 0 }]
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_purchase_order') || 'New Purchase Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Supplier'} *</label>
                <Select
                  value={newPO.supplier_id}
                  onValueChange={async (value) => {
                    const supplier = suppliers.find(s => s.id === value);

                    // Update prices for existing lines based on new supplier
                    const updatedLines = await Promise.all(
                      newPO.lines.map(async (line) => {
                        if (line.product_id && value) {
                          const vendorPrice = await lookupVendorPriceForProduct(value, line.product_id);
                          if (vendorPrice) {
                            return {
                              ...line,
                              unit_price: vendorPrice.price,
                              lead_time_days: vendorPrice.lead_time_days || line.lead_time_days
                            };
                          }
                        }
                        return line;
                      })
                    );

                    const newDeliveryDate = !isDeliveryDateManual
                      ? calculateDeliveryDate(updatedLines, newPO.order_date)
                      : newPO.expected_delivery_date;

                    setNewPO({
                      ...newPO,
                      supplier_id: value,
                      vendor_name: supplier?.name || '',
                      lines: updatedLines,
                      expected_delivery_date: newDeliveryDate,
                      total_amount: calculateOrderTotal(updatedLines)
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_supplier') || 'Select supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.is_active !== false && s.status !== 'inactive').map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('warehouse') || 'Warehouse'}</label>
                {warehouses.length === 1 ? (
                  <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                ) : (
                  <Select
                    value={newPO.warehouse_id || '__none__'}
                    onValueChange={(value) => setNewPO({...newPO, warehouse_id: value === '__none__' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('auto_select') || 'Auto select'}</SelectItem>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('order_date') || 'Order Date'} *</label>
                <Input
                  type="date"
                  value={newPO.order_date}
                  onChange={(e) => setNewPO({...newPO, order_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('delivery_date') || 'Delivery Date'} {!isDeliveryDateManual && <span className="text-xs text-slate-500">({t('auto_calculated') || 'Auto'})</span>}</label>
                <Input
                  type="date"
                  value={newPO.expected_delivery_date}
                  onChange={(e) => {
                    setNewPO({...newPO, expected_delivery_date: e.target.value});
                    setIsDeliveryDateManual(true);
                  }}
                />
              </div>
            </div>

            {/* Order Lines */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-base font-semibold">{t('order_items') || 'Order Items'}</label>
                <Button size="sm" variant="outline" onClick={handleAddLine}>
                  <Plus className="w-4 h-4 mr-1" /> {t('add_line') || 'Add Line'}
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {newPO.lines.map((line, index) => {
                  const selectedProduct = products.find(p => p.id === line.product_id);
                  const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                  const hasPackagings = productPackagings[line.product_id]?.length > 0;
                  return (
                  <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                    <div className="flex gap-2 items-end">
                      <div className="flex-[2] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('product')}</label>}
                        <Select
                          value={line.product_id || ''}
                          onValueChange={(value) => handleLineChange(index, 'product_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('select_product') || 'Select product'} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} {product.has_variants && '(V)'} {product.lead_time_days > 0 && `(${product.lead_time_days} ${t('days') || 'days'})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {hasVariants && (
                        <div className="flex-[2] min-w-0">
                          {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('variant')}</label>}
                          <Select
                            value={line.variant_id || ''}
                            onValueChange={(value) => handleLineChange(index, 'variant_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('select_variant') || 'Select variant'} />
                            </SelectTrigger>
                            <SelectContent>
                              {productVariants[line.product_id]?.map((variant) => (
                                <SelectItem key={variant.id} value={variant.id}>
                                  {variant.variant_name || variant.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex-[1] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('qty')}</label>}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder={t('qty') || 'Qty'}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                          />
                          {line.unit_name && (
                            <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-[2] min-w-0">
                        {index === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('price')}</label>}
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={t('price') || 'Price'}
                          value={formatPriceInput(line.unit_price)}
                          onChange={(e) => handleLineChange(index, 'unit_price', parsePriceInput(e.target.value))}
                        />
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLine(index)}
                          disabled={newPO.lines.length === 1}
                          className="text-red-600 h-9 w-9 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {hasPackagings && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="text-xs text-slate-500 whitespace-nowrap">{t('packaging') || 'Packaging'}:</span>
                        <Select
                          value={line.packaging_id || 'none'}
                          onValueChange={(value) => handleLineChange(index, 'packaging_id', value === 'none' ? null : value)}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder={t('packaging') || 'Packaging'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('none') || 'None (units)'}</SelectItem>
                            {productPackagings[line.product_id]?.map((pkg) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.name} ({pkg.qty} {t('units') || 'units'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {line.packaging_id ? (
                          <>
                            <span className="text-xs text-slate-500">×</span>
                            <Input
                              type="number"
                              min="1"
                              className="h-8 w-16 text-xs"
                              value={line.packaging_qty || 1}
                              onChange={(e) => handleLineChange(index, 'packaging_qty', e.target.value)}
                            />
                            <span className="text-xs text-indigo-600 font-medium">
                              = {line.quantity} {t('units') || 'units'}
                            </span>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t('tax')} (%)</label>
                <Popover>
                  <PopoverAnchor asChild>
                    <div className="flex">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={newPO.tax_percent}
                        onChange={(e) => setNewPO({...newPO, tax_percent: e.target.value})}
                        className="rounded-r-none border-r-0"
                      />
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-l-none border-l-0 shrink-0 px-2">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                    </div>
                  </PopoverAnchor>
                  <PopoverContent className="w-56 p-1" align="end">
                    <div className="space-y-0.5">
                      {purchaseTaxRates.map(tr => (
                        <PopoverTrigger asChild key={tr.id}>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors"
                            onClick={() => setNewPO({...newPO, tax_percent: tr.rate, tax_rate_id: tr.id})}
                          >
                            {tr.name} ({tr.rate}%){tr.price_include ? ` (${t('incl') || 'incl.'})` : ''}
                          </button>
                        </PopoverTrigger>
                      ))}
                      {purchaseTaxRates.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">{t('no_tax_rates') || 'No tax rates available'}</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('total_amount') || 'Total Amount'}</label>
                {(() => {
                  const rawSubtotal = calculateOrderTotal(newPO.lines);
                  const taxPercent = parseFloat(newPO.tax_percent) || 0;
                  const selectedTax = newPO.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newPO.tax_rate_id)) : defaultPurchaseTax;
                  const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
                  const total = taxCalc.subtotal + taxCalc.taxAmount;
                  return (
                    <>
                      <Input
                        type="text"
                        value={formatPriceInput(Math.round(total))}
                        disabled
                        className="bg-slate-100"
                      />
                      {taxCalc.isInclusive && taxCalc.taxAmount > 0 && (
                        <p className="text-xs text-amber-600 mt-1">{t('tax')} ({t('incl') || 'incl.'}): {formatPriceInput(Math.round(taxCalc.taxAmount))}</p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t('payment_terms') || 'Payment Terms'}</label>
                <Select value={newPO.payment_terms} onValueChange={(value) => setNewPO({...newPO, payment_terms: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">{t('prepaid') || 'Prepaid'}</SelectItem>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_60">Net 60</SelectItem>
                    <SelectItem value="net_90">Net 90</SelectItem>
                    <SelectItem value="due_on_receipt">{t('due_on_receipt') || 'Due on Receipt'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleCreatePO}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                disabled={!newPO.supplier_id || newPO.lines.every(l => !l.product_id) || isSubmitting}
              >
                {isSubmitting ? (t('creating') || 'Creating...') : (t('create') || 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit PO Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('edit_order') || 'Edit Order'}</DialogTitle>
          </DialogHeader>
          {editPO && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('po_number') || 'PO Number'}</label>
                  <Input value={editPO.po_number} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('supplier') || 'Supplier'}</label>
                  <Input value={editPO.supplier_name || editPO.vendor_name} disabled />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('order_date') || 'Order Date'}</label>
                  <Input
                    type="date"
                    value={editPO.order_date?.split('T')[0] || ''}
                    onChange={(e) => setEditPO({...editPO, order_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('delivery_date') || 'Delivery Date'}</label>
                  <Input
                    type="date"
                    value={editPO.expected_delivery_date?.split('T')[0] || ''}
                    onChange={(e) => setEditPO({...editPO, expected_delivery_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('total_amount') || 'Total Amount'}</label>
                  <Input type="text" value={formatPriceInput(editPO.total_amount)} disabled className="bg-slate-100" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('payment_terms') || 'Payment Terms'}</label>
                  <Select value={editPO.payment_terms || 'net_30'} onValueChange={(value) => setEditPO({...editPO, payment_terms: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid">{t('prepaid') || 'Prepaid'}</SelectItem>
                      <SelectItem value="net_30">Net 30</SelectItem>
                      <SelectItem value="net_60">Net 60</SelectItem>
                      <SelectItem value="net_90">Net 90</SelectItem>
                      <SelectItem value="due_on_receipt">{t('due_on_receipt') || 'Due on Receipt'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('status') || 'Status'}</label>
                <Select value={editPO.status || 'draft'} onValueChange={(value) => setEditPO({...editPO, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                    <SelectItem value="sent">{t('sent') || 'Sent'}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled') || 'Cancelled'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowEditModal(false); setEditPO(null); }} className="flex-1">
                  {t('cancel') || 'Cancel'}
                </Button>
                <Button
                  onClick={handleUpdatePO}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <Dialog open={showDetailModal} onOpenChange={(open) => { setShowDetailModal(open); if (!open) { setDetailPO(null); setDetailPOLines([]); setOrderReturns([]); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('order_details') || 'Order Details'}
              {detailPO && orderHasReturns(detailPO.id) && (
                <Badge className="bg-red-100 text-red-700">
                  <MessageSquareWarning className="w-3 h-3 mr-1" />
                  {t('has_returns') || 'Has Returns'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailPO && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">{t('po_number') || 'PO Number'}</p>
                  <p className="font-mono font-semibold">{detailPO.po_number || detailPO.order_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('supplier') || 'Supplier'}</p>
                  <p className="font-medium">{detailPO.supplier_name || detailPO.vendor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('status') || 'Status'}</p>
                  <Badge className={getStatusColor(detailPO.status)}>{t(detailPO.status) || detailPO.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('total_amount') || 'Total Amount'}</p>
                  <p className="font-bold text-lg">{(detailPO.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">{t('order_date') || 'Order Date'}</p>
                  <p className="font-medium">{detailPO.order_date ? format(new Date(detailPO.order_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('delivery_date') || 'Delivery Date'}</p>
                  <p className="font-medium">{(detailPO.expected_delivery_date || detailPO.expected_date) ? format(new Date(detailPO.expected_delivery_date || detailPO.expected_date), 'dd.MM.yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('payment_terms') || 'Payment Terms'}</p>
                  <p className="font-medium">{detailPO.payment_terms || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('vendor_reference') || 'Vendor Reference'}</p>
                  <p className="font-medium">{detailPO.vendor_reference || '-'}</p>
                </div>
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4">
                <h3 className="text-base font-semibold mb-3">{t('order_items') || 'Order Items'}</h3>
                {isLoadingDetails ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : detailPOLines.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">{t('no_items') || 'No items'}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('product') || 'Product'}</TableHead>
                          <TableHead className="text-right">{t('quantity') || 'Quantity'}</TableHead>
                          <TableHead>{t('uom') || 'UOM'}</TableHead>
                          <TableHead className="text-right">{t('unit_price') || 'Unit Price'}</TableHead>
                          <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPOLines.map((line, idx) => (
                          <TableRow key={line.id || idx}>
                            <TableCell className="font-medium">{line.product_name || line.description}</TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-slate-500 text-sm">{line.unit_name || '-'}</TableCell>
                            <TableCell className="text-right">{(line.unit_price || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-semibold">{((line.quantity || 0) * (line.unit_price || 0)).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Returns Section */}
              {orderReturns.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <RotateCcw className="w-4 h-4" />
                    {t('returns') || 'Returns'}
                  </h3>
                  <div className="space-y-3">
                    {orderReturns.map((ret) => (
                      <div key={ret.id} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-red-700">{ret.return_number}</span>
                            <Badge className={
                              ret.status === 'credited' ? 'bg-green-100 text-green-800' :
                              ret.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                              ret.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              ret.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }>{t(ret.status) || ret.status}</Badge>
                          </div>
                          <span className="text-sm text-slate-500">
                            {ret.return_date ? format(new Date(ret.return_date), 'dd.MM.yyyy') : '-'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">{t('reason') || 'Reason'}:</span>
                            <span className="ml-1 font-medium">{t(ret.reason) || ret.reason}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{t('total_value') || 'Total Value'}:</span>
                            <span className="ml-1 font-semibold text-red-600">{(ret.total_value || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowDetailModal(false); setDetailPO(null); setDetailPOLines([]); setOrderReturns([]); }} className="flex-1">
                  {t('close') || 'Close'}
                </Button>
                {canUpdate(MODULES.PURCHASES) && (
                  <Button
                    onClick={(e) => { setShowDetailModal(false); handleEditPO(detailPO, e); }}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    {t('edit') || 'Edit'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'uz' ? "Buyurtmani o'chirish" : 'Delete Purchase Order'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'uz'
                ? `Haqiqatan ham "${deleteConfirm?.po_number || deleteConfirm?.order_number || ''}" buyurtmani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`
                : `Are you sure you want to delete order "${deleteConfirm?.po_number || deleteConfirm?.order_number || ''}"? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'uz' ? 'Bekor qilish' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (deleteConfirm) {
                  await deletePurchaseOrder(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
            >
              {language === 'uz' ? "O'chirish" : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
