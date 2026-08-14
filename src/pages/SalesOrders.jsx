import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useModules } from '@/components/contexts/ModulesContext';
import { useCustomers } from '@/components/contexts/CustomersContext';
import { useSales } from '@/components/contexts/SalesContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Plus, ShoppingBag, Receipt, RotateCcw, Tag, Printer, X,
  LayoutDashboard, Building2, Settings, MessageSquareWarning, ChevronDown, Check, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { salesService } from '@/api/services/sales';
import { pricelistsService } from '@/api/services/pricelists';
import { inventoryService } from '@/api/services/inventory';
import contractsService from '@/api/services/contracts';
import apiClient from '@/api/client';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import ProductCombobox from "@/components/shared/ProductCombobox";
import CustomerCombobox from "@/components/shared/CustomerCombobox";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useFinancials } from '@/components/contexts/FinancialsContext';
import { useInventory } from '@/components/contexts/InventoryContext';

// Sales tab surfaces — each its own chunk; Radix unmounts inactive
// TabsContent, so lazy() defers all but the visible tab.
const SalesDashboard = lazy(() => import('@/components/sales/SalesDashboard'));
const Invoices = lazy(() => import('@/components/sales/Invoices'));
const Orders = lazy(() => import('@/components/sales/Orders'));
const SalesSettingsTab = lazy(() => import('@/components/sales/SalesSettingsTab'));
import { orderStatusClass } from '@/components/sales/orderStatus';

function TabLoading() {
  return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
}

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  PrintPreviewModal,
  BatchPrintModal,
  useAuditTrail,
} from '@/components/shared';
import { useCompany } from '@/components/contexts/CompanyContext';
import { getPrintCompanyConfig } from '@/components/sales/printConfig';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

// Savdo — 4 top tabs (dashboard · orders · invoices · settings). The old
// page had 8: quotations and deliveries were order-flow surfaces split
// off from Buyurtmalar, while discounts/carriers/dropshipping were
// reference data masquerading as workflows. Old ?tab= URLs land on the
// tab that now hosts that flow (the sub-tab is picked below).
const LEGACY_TAB_MAP = {
  quotations: 'orders',
  deliveries: 'orders',
  discounts: 'settings',
  carriers: 'settings',
  dropshipping: 'settings',
};

const TAB_STYLE =
  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ' +
  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] ' +
  'data-[state=active]:text-white data-[state=active]:shadow-md ' +
  'data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100';

export default function SalesOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const { canRead, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { salesOrders = [], createSalesOrder, updateSalesOrder, isLoading: ordersLoading, refreshData: refreshModulesData } = useModules();
  const { customers = [] } = useCustomers();
  const { getSetting } = useAdminSettings();
  const { taxRates = [], journals = [], paymentJournals = [] } = useFinancials();
  const bankCashJournals = paymentJournals.length > 0 ? paymentJournals : journals.filter(j => j.type === 'bank' || j.type === 'cash');
  const { getProductStock } = useInventory();

  // Get default tax from settings
  const defaultSalesTaxId = getSetting('sales.tax.default_tax_id', '');
  const salesTaxRates = taxRates.filter(tr => tr.tax_type === 'sales' || !tr.tax_type);
  // Prefer the explicitly configured default, fall back to first active sales tax
  const defaultSalesTax = defaultSalesTaxId
    ? taxRates.find(tr => String(tr.id) === String(defaultSalesTaxId))
    : salesTaxRates.find(tr => tr.is_active !== false) || null;
  const defaultTaxPercent = defaultSalesTax?.rate || 0;
  const {
    returns = [],
    isLoading: salesLoading,
    confirmSalesOrder,
    createInvoiceFromOrder,
    refreshData: refreshSalesData,
    applyDiscount,
    useDiscountCode,
  } = useSales();

  // Refresh data when navigating to this page
  useEffect(() => {
    refreshSalesData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const location = useLocation();
  const rawTab = searchParams.get("tab") || "dashboard";
  const activeTab = LEGACY_TAB_MAP[rawTab] || rawTab;
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

  // Old bookmarked URLs land on the sub-tab that now hosts that flow.
  const initialOrdersSubtab = rawTab === 'quotations' ? 'quotations'
    : rawTab === 'deliveries' ? 'deliveries'
    : 'list';
  const initialSettingsSubtab = rawTab === 'carriers' ? 'carriers'
    : rawTab === 'dropshipping' ? 'dropshipping'
    : 'discounts';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderReturns, setOrderReturns] = useState([]);
  const { addAuditLog } = useAuditTrail('sales_orders');

  // Check if an order has returns
  const orderHasReturns = useCallback((orderId) => {
    return returns.some(r => r.sales_order_id === orderId);
  }, [returns]);

  // Get returns for a specific order
  const getOrderReturns = useCallback((orderId) => {
    return returns.filter(r => r.sales_order_id === orderId);
  }, [returns]);

  // Track newly created invoice to auto-open it
  const [newInvoiceId, setNewInvoiceId] = useState(null);

  // Export columns configuration
  const exportColumns = [
    { key: 'order_number', label: t('order_number') },
    { key: 'customer_name', label: t('customer') },
    { key: 'order_date', label: t('date'), render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'delivery_date', label: t('delivery_date'), render: (v) => v ? format(new Date(v), 'dd.MM.yyyy') : '-' },
    { key: 'total_amount', label: t('amount'), render: (v) => formatCurrency(v || 0) },
    { key: 'status', label: t('status') },
    { key: 'payment_status', label: t('payment_status') },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'customer_name', label: t('customer'), required: true },
    { key: 'order_date', label: t('date'), required: true },
    { key: 'delivery_date', label: t('delivery_date') },
    { key: 'subtotal', label: t('amount'), required: true },
  ];

  const handleImport = async (data) => {
    for (const row of data) {
      const subtotal = parseFloat(row.subtotal) || 0;
      const taxAmount = subtotal * 0.12;
      const orderData = {
        order_number: `SO-${Date.now()}`,
        customer_name: row.customer_name,
        order_date: row.order_date,
        delivery_date: row.delivery_date,
        subtotal,
        tax_amount: taxAmount,
        shipping_cost: 0,
        total_amount: subtotal + taxAmount,
        status: 'quotation',
        payment_status: 'unpaid',
      };
      createSalesOrder(orderData);
    }
    addAuditLog('create', 'batch', `${data.length} orders imported`);
  };

  const generatePrintConfig = (order) => {
    // Build table data from order lines if available
    const lines = order.lines || [];
    const tableData = lines.length > 0
      ? lines.map((line, idx) => {
          // Prefer the product's canonical name (from the products
          // JOIN in the backend) as the primary label — this is
          // *this* company's name for the product. Fall back to the
          // line description for legacy lines without product_id.
          // alt_name is the matching product in the *other* company
          // (via search_key), so it carries the counterparty's name
          // for the same item. Printing both lets each side recognise
          // what was sold/bought on intercompany documents.
          const primary = line.product_name || line.description || '-';
          const description = line.alt_name && line.alt_name !== primary
            ? `${primary}\n(${line.alt_name})`
            : primary;
          return {
            no: idx + 1,
            description,
            quantity: line.quantity || 0,
            unit_price: formatCurrency(line.unit_price || 0),
            total: formatCurrency((line.quantity || 0) * (line.unit_price || 0)),
          };
        })
      : [{ no: 1, description: t('no_items'), quantity: '-', unit_price: '-', total: '-' }];

    return {
      template: 'order',
      title: t('sales_order'),
      documentNumber: order.order_number,
      documentDate: order.order_date ? format(new Date(order.order_date), 'dd.MM.yyyy') : '',
      orientation: 'landscape',
      headerFields: [
        { label: t('customer'), value: order.customer_name },
        { label: t('delivery_date'), value: order.delivery_date || order.expected_date ? format(new Date(order.delivery_date || order.expected_date), 'dd.MM.yyyy') : '-' },
        ...(order.vehicle_number ? [{ label: t('vehicle_number') || 'Moshina raqami', value: order.vehicle_number }] : []),
      ],
      tableColumns: [
        { key: 'no', label: '№', width: 10 },
        { key: 'description', label: t('description') },
        { key: 'quantity', label: t('quantity'), align: 'center', width: 20 },
        { key: 'unit_price', label: t('price'), align: 'right', width: 30 },
        { key: 'total', label: t('total'), align: 'right', width: 35 },
      ],
      tableData,
      totals: [
        { label: t('subtotal'), value: formatCurrency(order.subtotal || 0) },
        { label: t('tax'), value: formatCurrency(order.tax_amount || 0) },
        { label: t('shipping'), value: formatCurrency(order.shipping_amount || order.shipping_cost || 0) },
        { label: t('total'), value: formatCurrency(order.total_amount || 0), bold: true },
      ],
      // Show the order comment/note on the printout (TZ #1).
      notes: order.notes || order.comment || order.internal_notes || '',
      customCompany: activeCompany ? getPrintCompanyConfig(activeCompany) : null,
    };
  };

  const [newOrder, setNewOrder] = useState({
    order_number: '',
    customer_name: '',
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0], // Default to today
    warehouse_id: '',
    carrier: '',
    vehicle_number: '',
    project_id: '',
    project_name: '',
    contract_id: '',
    lines: [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }],
    subtotal: 0,
    tax_percent: 0,
    tax_rate_id: '',
    tax_amount: 0,
    shipping_cost: 0,
    total_amount: 0,
    discount_code: '',
    discount_id: '',
    discount_name: '',
    discount_type: '',
    discount_value: 0,
    max_discount_amount: null,
  });
  // Pre-fill default tax from settings
  useEffect(() => {
    if (defaultTaxPercent > 0 && newOrder.tax_percent === 0) {
      setNewOrder(prev => ({ ...prev, tax_percent: defaultTaxPercent, tax_rate_id: defaultSalesTax?.id || '' }));
    }
  }, [defaultTaxPercent]);

  // Open create modal pre-filled with customer from navigation state
  useEffect(() => {
    if (location.state?.createOrderForCustomer) {
      const { id, company_name, name } = location.state.createOrderForCustomer;
      setNewOrder(prev => ({
        ...prev,
        customer_id: id,
        customer_name: company_name || name || '',
      }));
      setShowCreateModal(true);
      // Clear state so refresh doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Open a specific order's detail when navigated with openOrderId
  // (e.g. from a customer's sales history on the CRM page).
  useEffect(() => {
    if (location.state?.openOrderId && Array.isArray(salesOrders) && salesOrders.length) {
      const found = salesOrders.find(o => o.id === location.state.openOrderId);
      if (found) {
        setSelectedOrder(found);
        window.history.replaceState({}, '');
      }
    }
  }, [location.state, salesOrders]);

  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [discountValidation, setDiscountValidation] = useState({ valid: false, message: '' });
  const [editingOrder, setEditingOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Products list for selection
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Product variants
  const [productVariants, setProductVariants] = useState({}); // { productId: variants[] }

  // Product packagings (e.g., 6-pack, case of 24)
  const [productPackagings, setProductPackagings] = useState({}); // { productId: packagings[] }

  // Warehouses list for selection
  const [warehouses, setWarehouses] = useState([]);

  // Carriers list for selection
  const [carriers, setCarriers] = useState([]);

  // Income contracts per customer for the optional "Shartnoma" link
  const [customerContracts, setCustomerContracts] = useState({}); // { customerId: contracts[] }

  // All intercompany projects (from orgs we sell to)
  const [allIntercompanyProjects, setAllIntercompanyProjects] = useState([]);
  const [loadingIntercompanyProjects, setLoadingIntercompanyProjects] = useState(false);

  // Track if delivery date was manually set (for new order)
  const [isDeliveryDateManual, setIsDeliveryDateManual] = useState(false);
  // Track if delivery date was manually set (for editing order)
  const [isEditDeliveryDateManual, setIsEditDeliveryDateManual] = useState(false);

  // Fetch products and warehouses on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const data = await inventoryService.listProducts({ limit: 1000 });
        const all = Array.isArray(data) ? data : data?.items || [];
        setProducts(all.filter(p => p.can_be_sold !== false && p.is_sellable !== false));
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setProductsLoading(false);
      }
    };
    const fetchWarehouses = async () => {
      try {
        const data = await inventoryService.listWarehouses({ limit: 100 });
        const list = Array.isArray(data) ? data : data?.items || [];
        setWarehouses(list);
        if (list.length === 1) {
          setNewOrder(prev => ({ ...prev, warehouse_id: list[0].id }));
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
      }
    };
    const fetchCarriers = async () => {
      try {
        const data = await inventoryService.listCarriers({ active: 'true' });
        setCarriers(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error('Failed to fetch carriers:', error);
      }
    };
    const fetchIntercompanyProjects = async () => {
      // Find all intercompany customers (those with source_organization_id)
      const intercompanyCustomers = (customers || []).filter(c => c.source_organization_id);
      if (intercompanyCustomers.length === 0) return;

      // /construction/projects/by-organization is gated by construction:read
      // on the backend. A user with sales but no construction access would
      // 403 on every intercompany customer; skip the fetch and just leave the
      // intercompany-projects list empty (the UI handles that).
      if (!canRead(MODULES.CONSTRUCTION)) return;

      setLoadingIntercompanyProjects(true);
      try {
        const allProjects = [];
        for (const customer of intercompanyCustomers) {
          const res = await apiClient.get('/construction/projects/by-organization', {
            params: { organization_id: customer.source_organization_id }
          });
          const projects = res.data?.data || [];
          // Tag each project with the customer info for auto-selection
          projects.forEach(p => {
            p._customer_id = customer.id;
            p._customer_name = customer.company_name || customer.name || '';
          });
          allProjects.push(...projects);
        }
        setAllIntercompanyProjects(allProjects);
      } catch (error) {
        console.error('Failed to fetch intercompany projects:', error);
      } finally {
        setLoadingIntercompanyProjects(false);
      }
    };
    fetchProducts();
    fetchWarehouses();
    fetchCarriers();
    fetchIntercompanyProjects();
  }, [customers]);

  // Fetch the selected customer's income contracts (cached per customer).
  // The contracts list endpoint filters by vendor_id (the counterparty
  // contact — same contacts table sales-order customers come from) and
  // direction; a defensive client-side filter keeps only that partner's rows.
  const fetchCustomerContracts = useCallback(async (customerId) => {
    if (!customerId) return;
    try {
      const { items } = await contractsService.list({ vendor_id: customerId, direction: 'income', limit: 100 });
      const list = (Array.isArray(items) ? items : []).filter(
        c => !c.vendor_id || c.vendor_id === customerId
      );
      setCustomerContracts(prev => ({ ...prev, [customerId]: list }));
    } catch (error) {
      // No contracts module access (403) or transient failure — hide gracefully
      console.error('Failed to fetch customer contracts:', error);
      setCustomerContracts(prev => ({ ...prev, [customerId]: [] }));
    }
  }, []);

  useEffect(() => {
    if (newOrder.customer_id && customerContracts[newOrder.customer_id] === undefined) {
      fetchCustomerContracts(newOrder.customer_id);
    }
  }, [newOrder.customer_id, customerContracts, fetchCustomerContracts]);

  useEffect(() => {
    const cid = editingOrder?.customer_id;
    if (cid && customerContracts[cid] === undefined) {
      fetchCustomerContracts(cid);
    }
  }, [editingOrder?.customer_id, customerContracts, fetchCustomerContracts]);

  // Calculate delivery date based on product lead times
  const calculateDeliveryDate = useCallback((orderLines, orderDate) => {
    const baseDate = orderDate ? new Date(orderDate) : new Date();

    // Get max lead time from all products in order lines
    const maxLeadTime = orderLines.reduce((max, line) => {
      const leadTime = line.product?.lead_time_days || line.lead_time_days || 0;
      return Math.max(max, leadTime);
    }, 0);

    // If no lead times, return today's date
    if (maxLeadTime === 0) {
      return new Date().toISOString().split('T')[0];
    }

    // Add lead time days to base date
    const deliveryDate = new Date(baseDate);
    deliveryDate.setDate(deliveryDate.getDate() + maxLeadTime);
    return deliveryDate.toISOString().split('T')[0];
  }, []);

  // Calculate order totals from line items
  const calculateOrderTotals = (lines) => {
    const subtotal = lines.reduce((sum, line) => sum + (parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)), 0);
    return subtotal;
  };

  // Calculate tax considering price_include flag (like Odoo)
  // When price_include=true, the entered prices already contain tax, so we back-calculate
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

  const handleAddLine = (order, setOrder, isManualDelivery, setManualDelivery) => {
    const newLines = [...order.lines, { product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }];
    setOrder({
      ...order,
      lines: newLines
    });
    // Note: Adding empty line doesn't change delivery date
  };

  const handleRemoveLine = (order, setOrder, index, isManualDelivery) => {
    const newLines = order.lines.filter((_, i) => i !== index);
    const updatedLines = newLines.length > 0 ? newLines : [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }];

    // Recalculate delivery date if not manually set
    if (!isManualDelivery) {
      const newDeliveryDate = calculateDeliveryDate(updatedLines, order.order_date);
      setOrder({ ...order, lines: updatedLines, delivery_date: newDeliveryDate });
    } else {
      setOrder({ ...order, lines: updatedLines });
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

  // Fetch packagings for a product (e.g., 6-pack, case of 24)
  const fetchProductPackagings = useCallback(async (productId) => {
    if (!productId || productPackagings[productId]) return;
    try {
      const data = await inventoryService.listProductPackagingsByProduct(productId);
      // Only show packagings available for sales
      const salesPackagings = (Array.isArray(data) ? data : []).filter(p => p.sales);
      setProductPackagings(prev => ({ ...prev, [productId]: salesPackagings }));
    } catch (error) {
      console.error('Failed to fetch packagings:', error);
    }
  }, [productPackagings]);

  // Get total available stock for a product across all warehouses (or specific warehouse)
  const getAvailableStock = useCallback((productId, warehouseId) => {
    if (!productId) return null;
    const stockRecords = getProductStock(productId);
    if (!stockRecords || stockRecords.length === 0) return null;
    if (warehouseId) {
      const record = stockRecords.find(s => s.warehouse_id === warehouseId);
      return record ? (record.quantity_available ?? record.available_quantity ?? record.quantity_on_hand ?? record.quantity ?? 0) : null;
    }
    return stockRecords.reduce((sum, s) => sum + (s.quantity_available ?? s.available_quantity ?? s.quantity_on_hand ?? s.quantity ?? 0), 0);
  }, [getProductStock]);

  // Check stock warning for a line item
  const getStockWarning = useCallback((line, warehouseId) => {
    if (!line.product_id) return null;
    const available = getAvailableStock(line.product_id, warehouseId);
    if (available === null) return null;
    const qty = parseFloat(line.quantity) || 0;
    if (available <= 0) return { type: 'error', message: t('stock_not_available'), available: 0 };
    if (qty > available) return { type: 'warning', message: t('stock_exceeded').replace('{qty}', available), available };
    return null;
  }, [getAvailableStock, t]);

  // Monotonic per-line request tokens so stale get-price responses (product
  // or quantity changed since the request went out) are dropped.
  const priceReqSeqRef = useRef({});

  // Resolve a line's unit price through the pricelist chain (explicit
  // pricelist → customer's pricelist → tenant default → list_price) with
  // qty breaks. Applies the price only if the line still shows the same
  // product when the response arrives; marks the line so quantity changes
  // re-resolve qty-break prices.
  const resolveLinePrice = async ({ scope, setOrder, index, productId, customerId, quantity, listPrice }) => {
    const key = `${scope}:${index}`;
    const reqId = (priceReqSeqRef.current[key] || 0) + 1;
    priceReqSeqRef.current[key] = reqId;
    try {
      const result = await pricelistsService.getProductPrice({
        product_id: productId,
        customer_id: customerId,
        quantity: parseFloat(quantity) || 1,
      });
      if (priceReqSeqRef.current[key] !== reqId) return; // stale response
      const price = result?.computed_price ?? result?.original_price ?? listPrice ?? 0;
      const fromPricelist = Boolean(result?.pricelist_id);
      setOrder(prev => {
        const lines = [...(prev.lines || [])];
        const line = lines[index];
        // Product changed since the request was sent — ignore.
        if (!line || line.product_id !== productId) return prev;
        lines[index] = { ...line, unit_price: price, price_from_pricelist: fromPricelist };
        return { ...prev, lines };
      });
      if (!price) warnPriceNotFound();
    } catch (error) {
      // Keep the synchronously-set list_price fallback on failure.
      console.error('Failed to resolve pricelist price:', error);
    }
  };

  // "Mahsulot narxi topilmadi" — fixed toast id so repeats replace instead of stacking.
  const warnPriceNotFound = () => {
    toast.warning(
      t('price_not_found_warning') || "Mahsulot narxi topilmadi — narxni qo'lda kiriting",
      { id: 'price-not-found' }
    );
  };

  const handleLineChange = (order, setOrder, index, field, value, isManualDelivery) => {
    // Which modal owns this line — used to key in-flight price requests.
    const scope = setOrder === setNewOrder ? 'new' : 'edit';
    const newLines = [...order.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If changing product selection, also update lead_time_days and recalculate delivery date
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        // Auto-set UOM: prefer sales_unit, fallback to default unit
        const unitId = selectedProduct.sales_unit_id || selectedProduct.unit_id || null;
        const unitName = selectedProduct.sales_unit_name || selectedProduct.unit_name || '';

        // Selling at cost is a margin leak — list_price or 0, never cost_price.
        const fallbackPrice = selectedProduct.list_price ?? 0;
        newLines[index] = {
          ...newLines[index],
          product_name: selectedProduct.name,
          product_id: selectedProduct.id,
          unit_price: fallbackPrice,
          price_from_pricelist: false,
          lead_time_days: selectedProduct.lead_time_days || 0,
          unit_id: unitId,
          unit_name: unitName,
          product: selectedProduct,
          variant_id: null, // Reset variant when product changes
          variant_name: null,
          packaging_id: null, // Reset packaging when product changes
          packaging_qty: null,
          packaging_name: null,
          packaging_unit_qty: null
        };

        // Pricelist-aware autofill: only when a customer is chosen.
        if (order.customer_id) {
          resolveLinePrice({
            scope,
            setOrder,
            index,
            productId: selectedProduct.id,
            customerId: order.customer_id,
            quantity: newLines[index].quantity || 1,
            listPrice: fallbackPrice,
          });
        } else if (!fallbackPrice) {
          warnPriceNotFound();
        }

        // Fetch variants if product has variants
        if (selectedProduct.has_variants) {
          fetchProductVariants(selectedProduct.id);
        }

        // Always fetch packagings for the product
        fetchProductPackagings(selectedProduct.id);

        // Recalculate delivery date if not manually set
        if (!isManualDelivery) {
          const newDeliveryDate = calculateDeliveryDate(newLines, order.order_date);
          setOrder({ ...order, lines: newLines, delivery_date: newDeliveryDate });
          return;
        }
      }
    }

    // Manual price edit wins: stop treating the line as pricelist-driven and
    // invalidate any in-flight get-price request for it.
    if (field === 'unit_price') {
      newLines[index] = { ...newLines[index], price_from_pricelist: false };
      const key = `${scope}:${index}`;
      priceReqSeqRef.current[key] = (priceReqSeqRef.current[key] || 0) + 1;
    }

    // If changing variant selection
    if (field === 'variant_id' && value) {
      const productId = newLines[index].product_id;
      const variants = productVariants[productId] || [];
      const selectedVariant = variants.find(v => v.id === value);
      if (selectedVariant) {
        newLines[index] = {
          ...newLines[index],
          variant_id: selectedVariant.id,
          variant_name: selectedVariant.variant_name,
          unit_price: selectedVariant.list_price || newLines[index].unit_price,
          price_from_pricelist: false
        };
      }
    }

    // If changing packaging selection
    if (field === 'packaging_id') {
      if (value) {
        const productId = newLines[index].product_id;
        const packagings = productPackagings[productId] || [];
        const selectedPackaging = packagings.find(p => p.id === value);
        if (selectedPackaging) {
          // Auto-calculate quantity based on packaging
          const packagingQty = newLines[index].packaging_qty || 1;
          newLines[index] = {
            ...newLines[index],
            packaging_id: selectedPackaging.id,
            packaging_name: selectedPackaging.name,
            packaging_unit_qty: selectedPackaging.qty,
            packaging_qty: packagingQty,
            quantity: packagingQty * selectedPackaging.qty // Auto-calculate total quantity
          };
        }
      } else {
        // Clear packaging fields if "None" selected
        newLines[index] = {
          ...newLines[index],
          packaging_id: null,
          packaging_name: null,
          packaging_unit_qty: null,
          packaging_qty: null
        };
      }
    }

    // If changing packaging quantity
    if (field === 'packaging_qty' && newLines[index].packaging_id) {
      const packagingQty = parseFloat(value) || 1;
      const packagingUnitQty = newLines[index].packaging_unit_qty || 1;
      newLines[index] = {
        ...newLines[index],
        packaging_qty: packagingQty,
        quantity: packagingQty * packagingUnitQty // Auto-calculate total quantity
      };
    }

    // Quantity changed on a pricelist-priced line — re-resolve for qty breaks.
    if (
      (field === 'quantity' || field === 'packaging_qty') &&
      newLines[index].price_from_pricelist &&
      newLines[index].product_id &&
      order.customer_id
    ) {
      resolveLinePrice({
        scope,
        setOrder,
        index,
        productId: newLines[index].product_id,
        customerId: order.customer_id,
        quantity: newLines[index].quantity,
        listPrice: newLines[index].product?.list_price ?? newLines[index].unit_price ?? 0,
      });
    }

    setOrder({ ...order, lines: newLines });
  };

  // Calculate discount amount based on subtotal and discount settings
  const calculateDiscountAmount = (subtotal, discount) => {
    if (!discount) return 0;

    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      discountAmount = (subtotal * discount.discount_value) / 100;
    } else {
      discountAmount = discount.discount_value;
    }

    // Apply max discount cap
    if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
      discountAmount = discount.max_discount_amount;
    }

    // Don't discount more than the subtotal
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    return discountAmount;
  };

  // Handle applying discount code
  const handleApplyDiscount = () => {
    if (!discountCodeInput.trim()) {
      setDiscountValidation({ valid: false, message: t('enter_discount_code') || 'Please enter a discount code' });
      return;
    }

    const subtotal = calculateOrderTotals(newOrder.lines);
    const result = applyDiscount(discountCodeInput.trim(), subtotal, false);

    if (result.valid) {
      // Store the discount details, not just the calculated amount
      setNewOrder({
        ...newOrder,
        discount_code: discountCodeInput.trim(),
        discount_id: result.discount.id,
        discount_name: result.discount.name,
        discount_type: result.discount.discount_type,
        discount_value: result.discount.discount_value,
        max_discount_amount: result.discount.max_discount_amount || null,
      });
      setDiscountValidation({ valid: true, message: result.message });
    } else {
      setDiscountValidation({ valid: false, message: t(result.messageKey) || 'Invalid discount code' });
      setNewOrder({
        ...newOrder,
        discount_code: '',
        discount_id: '',
        discount_name: '',
        discount_type: '',
        discount_value: 0,
        max_discount_amount: null,
      });
    }
  };

  // Handle removing discount
  const handleRemoveDiscount = () => {
    setNewOrder({
      ...newOrder,
      discount_code: '',
      discount_id: '',
      discount_name: '',
      discount_type: '',
      discount_value: 0,
      max_discount_amount: null,
    });
    setDiscountCodeInput('');
    setDiscountValidation({ valid: false, message: '' });
  };

  const handleCreateOrder = async () => {
    const rawSubtotal = calculateOrderTotals(newOrder.lines);
    const taxPercent = parseFloat(newOrder.tax_percent) || 0;
    const selectedTax = newOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newOrder.tax_rate_id)) : defaultSalesTax;
    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
    const subtotal = taxCalc.subtotal;
    const taxAmount = taxCalc.taxAmount;
    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;

    // Calculate discount dynamically based on current subtotal
    const discountAmount = newOrder.discount_id ? calculateDiscountAmount(subtotal, {
      discount_type: newOrder.discount_type,
      discount_value: newOrder.discount_value,
      max_discount_amount: newOrder.max_discount_amount,
    }) : 0;

    const total = subtotal + taxAmount + shippingCost - discountAmount;

    // Filter and format lines - only include lines with valid product_id.
    // tax_id rides on every line: the backend derives line VAT from it and
    // the invoice built at shipment copies the line taxes — without it the
    // whole chain shipped VAT-free (soliq audit 2026-08-13).
    const lineTaxId = taxPercent > 0 ? (selectedTax?.id || undefined) : undefined;
    const validLines = newOrder.lines
      .filter(line => line.product_id && line.product_id.trim() !== '')
      .map(line => ({
        product_id: line.product_id,
        description: line.description || line.product_name || '',
        quantity: parseFloat(line.quantity) || 1,
        unit_price: parseFloat(line.unit_price) || 0,
        tax_id: lineTaxId,
        packaging_id: line.packaging_id || undefined,
        packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
      }));

    // Check if customer_id is a valid UUID (backend requires UUID format)
    const isValidUUID = (str) => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    const orderData = {
      order_number: newOrder.order_number || '',
      organization_id: activeCompany?.id,
      customer_name: newOrder.customer_name,
      // Only send customer_id if it's a valid UUID, otherwise backend will use customer_name
      ...(isValidUUID(newOrder.customer_id) && { customer_id: newOrder.customer_id }),
      order_date: newOrder.order_date,
      delivery_date: newOrder.delivery_date,
      expected_date: newOrder.delivery_date, // Backend uses expected_date
      warehouse_id: newOrder.warehouse_id || undefined,
      carrier: newOrder.carrier || undefined,
      vehicle_number: newOrder.vehicle_number || undefined,
      project_id: newOrder.project_id || undefined,
      project_name: newOrder.project_name || undefined,
      contract_id: newOrder.contract_id || undefined,
      subtotal,
      tax_amount: taxAmount,
      shipping_amount: shippingCost,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      discount_code: newOrder.discount_code || undefined,
      total_amount: total,
      status: 'draft',
      payment_status: 'unpaid',
      payment_journal_id: newOrder.payment_journal_id || undefined,
      notes: newOrder.notes || undefined,
      lines: validLines.length > 0 ? validLines : undefined, // Only send lines if valid
    };

    // Validate: intercompany orders must have a project selected
    const selectedCustomer = customers.find(c => c.id === newOrder.customer_id);
    if (selectedCustomer?.source_organization_id && !newOrder.project_id) {
      alert(t('intercompany_project_required') || 'Kompaniyalararo buyurtma uchun loyihani tanlash majburiy');
      return;
    }

    try {
      const createdOrder = await createSalesOrder(orderData);

      // Record discount usage if discount was applied
      if (newOrder.discount_id && discountAmount > 0) {
        try {
          await useDiscountCode(
            newOrder.discount_id,
            newOrder.customer_id || null,
            createdOrder?.id || null,
            discountAmount
          );
        } catch (discountError) {
          console.error('Error recording discount usage:', discountError);
        }
      }

      setShowCreateModal(false);
      resetOrderForm();
      setDiscountCodeInput('');
      setDiscountValidation({ valid: false, message: '' });
      addAuditLog('create', 'new', orderData.order_number || `SO-${Date.now()}`);
      // Refresh orders list so the new SO appears without manual page reload
      try { await refreshModulesData?.(); } catch { /* non-blocking */ }
    } catch (error) {
      console.error('Error creating sales order:', error);
      console.error('Error response:', error.response?.data);
      console.error('Order data sent:', orderData);
      const apiErr = error.response?.data?.error;
      if (apiErr?.code === 'DISCOUNT_LIMIT_EXCEEDED') {
        // 422 from the tenant's discount-limit policy — name the reason
        // instead of a generic "couldn't create" failure.
        toast.error(
          t('discount_limit_exceeded_toast')
          || "Chegirma ruxsat etilgan limitdan oshib ketdi"
        );
        return;
      }
      toast.error(
        apiErr?.message
        || t('error_creating_order')
        || "Buyurtmani yaratib bo'lmadi"
      );
    }
  };

  const handleEditOrder = async () => {
    const rawSubtotal = calculateOrderTotals(editingOrder.lines);
    const taxPercent = parseFloat(editingOrder.tax_percent) || 0;
    const selectedTax = editingOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(editingOrder.tax_rate_id)) : defaultSalesTax;
    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
    const subtotal = taxCalc.subtotal;
    const taxAmount = taxCalc.taxAmount;
    const shippingCost = parseFloat(editingOrder.shipping_cost) || 0;
    const total = subtotal + taxAmount + shippingCost;

    // Filter and format lines - only include lines with valid product_id.
    // Same tax_id propagation as create (soliq audit 2026-08-13).
    const editLineTaxId = taxPercent > 0 ? (selectedTax?.id || undefined) : undefined;
    const validLines = editingOrder.lines
      .filter(line => line.product_id && line.product_id.trim() !== '')
      .map(line => ({
        product_id: line.product_id,
        description: line.description || line.product_name || '',
        quantity: parseFloat(line.quantity) || 1,
        unit_price: parseFloat(line.unit_price) || 0,
        tax_id: editLineTaxId,
        packaging_id: line.packaging_id || undefined,
        packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
      }));

    // Check if customer_id is a valid UUID
    const isValidUUID = (str) => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    try {
      await updateSalesOrder(editingOrder.id, {
        customer_name: editingOrder.customer_name,
        ...(isValidUUID(editingOrder.customer_id) && { customer_id: editingOrder.customer_id }),
        delivery_date: editingOrder.delivery_date,
        expected_date: editingOrder.delivery_date,
        warehouse_id: editingOrder.warehouse_id || undefined,
        carrier: editingOrder.carrier || undefined,
        // "" clears the link server-side (NULL), a uuid sets it
        contract_id: editingOrder.contract_id || '',
        subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingCost,
        total_amount: total,
        lines: validLines.length > 0 ? validLines : undefined,
      });
      setShowEditModal(false);
      setEditingOrder(null);
      addAuditLog('update', editingOrder.id, editingOrder.order_number);
      // Refresh from the server so the list reflects the updated customer
      // / lines / totals. updateSalesOrder() already merges the API
      // response into local state, but the merge only covers fields the
      // single-order endpoint returns — a full reload is the safest way
      // to pick up joined fields (customer name, warehouse name, etc).
      try { await refreshModulesData?.(); } catch { /* non-blocking */ }
    } catch (error) {
      console.error('Error updating sales order:', error);
      toast.error(
        error.response?.data?.error?.message
        || t('error_updating_order')
        || "Buyurtmani yangilab bo'lmadi"
      );
    }
  };

  // "Delete" from the UI is a cancel: POST /sales-orders/:id/cancel.
  // The backend owns the status lifecycle now — no DELETE, no PUT status.
  const handleDeleteOrder = async (orderId) => {
    if (!orderId) return;
    try {
      await salesService.cancelOrder(orderId);
      addAuditLog('cancel', orderId, orderId);
      toast.success(t('order_cancelled') || 'Buyurtma bekor qilindi');
      await refreshModulesData();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(
        error.response?.data?.error?.message
        || t('error_cancelling_order')
        || "Buyurtmani bekor qilib bo'lmadi"
      );
    }
  };

  const resetOrderForm = () => {
    setNewOrder({
      order_number: '',
      customer_name: '',
      customer_id: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date().toISOString().split('T')[0], // Default to today
      warehouse_id: warehouses.length === 1 ? warehouses[0].id : '',
      carrier: '',
      vehicle_number: '',
      project_id: '',
      project_name: '',
      contract_id: '',
      lines: [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '', lead_time_days: 0 }],
      subtotal: 0,
      tax_percent: defaultTaxPercent,
      discount_code: '',
      discount_id: '',
      discount_name: '',
      discount_type: '',
      discount_value: 0,
      max_discount_amount: null,
      tax_amount: 0,
      shipping_cost: 0,
      total_amount: 0,
      payment_journal_id: '',
    });
    setDiscountCodeInput('');
    setDiscountValidation({ valid: false, message: '' });
    setIsDeliveryDateManual(false);
    // The state is named `allIntercompanyProjects`; an earlier rename missed
    // this reset call, which threw `setIntercompanyProjects is not defined`
    // whenever the new-order dialog closed.
    setAllIntercompanyProjects([]);
  };

  // Only draft/quotation → confirmed remains a direct user action, and it
  // goes through POST /confirm. Every other transition has its own flow
  // (delivery validation sets shipped/delivered, /cancel cancels) — the
  // backend rejects raw PUT status writes.
  // One press ships a confirmed order: create the delivery order, validate it.
  //
  // Validate is the step that actually moves stock and flips the order to
  // shipped; before this, shipping meant leaving Savdo, opening Ombor, and
  // confirming there — the two-trip flow the goods-receipt side already
  // removed. Insufficient stock comes back as a per-item list, and a partial
  // failure (created but not validated) is said plainly rather than reported
  // as success.
  const handleShipOrder = async (order) => {
    try {
      const dorder = await salesService.createDeliveryOrder({
        sales_order_id: order.id,
        warehouse_id: order.warehouse_id || undefined,
      });
      try {
        await salesService.validateDeliveryOrder(dorder.id);
        toast.success(t('order_shipped') || "Buyurtma jo'natildi — zaxiradan chiqarildi");
      } catch (vErr) {
        const items = vErr?.response?.data?.errors;
        if (Array.isArray(items) && items.length) {
          toast.error(
            (t('insufficient_stock') || 'Zaxira yetarli emas') + ': ' +
            items.map((i) => `${i.product_name}: ${i.available}/${i.requested}`).join('; '),
            { duration: 8000 },
          );
        } else {
          toast.error(
            (t('ship_failed') || "Buyurtmani jo'natib bo'lmadi") + ': ' +
            (vErr?.response?.data?.message || vErr?.message || '') +
            " — yetkazib berish hujjati yaratildi, Yetkazib berishlar bo'limidan tasdiqlang",
            { duration: 8000 },
          );
        }
        return;
      }
      refreshModulesData?.();
    } catch (err) {
      toast.error(
        (t('ship_failed') || "Buyurtmani jo'natib bo'lmadi") + ': ' +
        (err?.response?.data?.message || err?.response?.data?.error || err?.message || ''),
      );
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (newStatus !== 'confirmed') return;
    try {
      await confirmSalesOrder(orderId);
      if (refreshSalesData) refreshSalesData();
      if (refreshModulesData) refreshModulesData();
    } catch (error) {
      console.error('Failed to confirm order:', error);
      const apiErr = error.response?.data?.error;
      if (apiErr?.code === 'CREDIT_LIMIT_EXCEEDED') {
        // 422 from the tenant's "block" credit policy — spell out the math
        // (outstanding + order total vs the limit) so the seller knows
        // exactly why the confirm was refused.
        const d = apiErr.details || {};
        toast.error(
          (t('credit_limit_exceeded_toast')
            || 'Kredit limiti oshdi: qarzdorlik {outstanding} + buyurtma {order_total} > limit {credit_limit}')
            .replace('{outstanding}', formatCurrency(Number(d.outstanding) || 0))
            .replace('{order_total}', formatCurrency(Number(d.order_total) || 0))
            .replace('{credit_limit}', formatCurrency(Number(d.credit_limit) || 0))
        );
        return;
      }
      toast.error(
        apiErr?.message
        || t('error')
        || 'Xatolik yuz berdi'
      );
    }
  };

  const handleCreateInvoice = async (orderId) => {
    try {
      const newInvoice = await createInvoiceFromOrder(orderId);
      // Refresh both contexts to get updated invoices and order has_invoice flags
      if (refreshSalesData) refreshSalesData();
      if (refreshModulesData) refreshModulesData();
      // Set the new invoice ID so Invoices component auto-opens it
      if (newInvoice?.id) {
        setNewInvoiceId(newInvoice.id);
      }
      // Switch to invoices tab to show the new invoice
      setActiveTab('invoices');
    } catch (error) {
      console.error('Failed to create invoice:', error);
      // If invoice already exists (400), refresh data silently to hide the button
      if (error?.response?.status === 400) {
        if (refreshSalesData) refreshSalesData();
        if (refreshModulesData) refreshModulesData();
        setActiveTab('invoices');
      } else {
        toast.error(t('error_creating_invoice') || 'Failed to create invoice');
      }
    }
  };

  // "Yetkazilganini fakturalash" — partial invoice covering only
  // delivered-but-uninvoiced quantities (?basis=delivered). Unlike the
  // full-order invoice, several of these per order are allowed.
  const handleCreateInvoiceDelivered = async (orderId) => {
    try {
      const newInvoice = await salesService.createInvoiceFromOrderDelivered(orderId);
      toast.success(
        t('invoice_bill_delivered_success')
        || 'Yetkazilgan miqdor uchun hisob-faktura yaratildi'
      );
      if (refreshSalesData) refreshSalesData();
      if (refreshModulesData) refreshModulesData();
      if (newInvoice?.id) {
        setNewInvoiceId(newInvoice.id);
      }
      setActiveTab('invoices');
    } catch (error) {
      console.error('Failed to create delivered-basis invoice:', error);
      // 400 carries the reason (e.g. nothing delivered yet) — surface it.
      toast.error(
        error?.response?.data?.error?.message
        || t('error_creating_invoice')
        || 'Failed to create invoice'
      );
    }
  };

  const handleViewOrder = async (order) => {
    try {
      // Fetch full order details including lines
      const fullOrder = await salesService.getOrder(order.id);
      setSelectedOrder(fullOrder);
      // Get returns for this order
      const orderReturnsData = getOrderReturns(order.id);
      setOrderReturns(orderReturnsData);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      // Fallback to using the list order data
      setSelectedOrder(order);
      setOrderReturns(getOrderReturns(order.id));
      setShowDetailModal(true);
    }
  };

  // Enrich each order line with `alt_names` = other products in the
  // tenant that share the same search_key. This powers the
  // dual-name print (seller's "Eshik Hi tech" + buyer's internal
  // "ПБ-5.9*100а" below it) so both parties see a name they
  // recognize on the printed document.
  const enrichLinesWithAltNames = async (lines) => {
    if (!Array.isArray(lines) || lines.length === 0) return lines;
    // Collect unique search_keys from the seller's products
    const keyByLine = new Map();
    for (const line of lines) {
      const prod = products.find(p => p.id === line.product_id);
      const key = prod?.search_key;
      if (key) keyByLine.set(line, key);
    }
    const uniqueKeys = [...new Set(keyByLine.values())];
    if (uniqueKeys.length === 0) return lines;

    // Fetch counterparty matches per unique key in parallel.
    // `exclude_organization_id` keeps the seller's own products out
    // of the result — we only want the OTHER org's name for the
    // same material, which is what the buyer recognises on the PDF.
    const keyToMatches = new Map();
    await Promise.all(uniqueKeys.map(async (k) => {
      try {
        const res = await apiClient.get('/products/by-search-key', {
          params: {
            key: k,
            ...(activeCompany?.id ? { exclude_organization_id: activeCompany.id } : {}),
          },
        });
        const list = res.data?.data?.products ?? res.data?.products ?? [];
        keyToMatches.set(k, list);
      } catch { /* ignore failed key */ }
    }));

    // Attach the first counterparty match's name as alt_name
    return lines.map(line => {
      const key = keyByLine.get(line);
      if (!key) return line;
      const matches = keyToMatches.get(key) || [];
      const alt = matches.find(m => m.id !== line.product_id && m.name);
      return alt ? { ...line, alt_name: alt.name } : line;
    });
  };

  const handlePrintOrder = async (order) => {
    try {
      const fullOrder = await salesService.getOrder(order.id);
      if (fullOrder.lines) {
        fullOrder.lines = await enrichLinesWithAltNames(fullOrder.lines);
      }
      setSelectedOrder(fullOrder);
      setShowPrintPreview(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      setSelectedOrder(order);
      setShowPrintPreview(true);
    }
  };

  // Loading state
  if (ordersLoading || salesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">{t('loading')}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-6">

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="dashboard" className={TAB_STYLE}>
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dashboard') || 'Asosiy panel'}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className={TAB_STYLE}>
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">{t('orders') || 'Buyurtmalar'}</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className={TAB_STYLE}>
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">{t('invoices') || 'Hisob-fakturalar'}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className={TAB_STYLE}>
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('settings') || 'Sozlamalar'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab — DashboardKit + GET /sales-orders/stats */}
          <TabsContent value="dashboard" className="mt-6">
            <Suspense fallback={<TabLoading />}>
              <SalesDashboard t={t} language={language} onOpenTab={setActiveTab} />
            </Suspense>
          </TabsContent>

          {/* Orders Tab — list · quotations · deliveries · returns */}
          <TabsContent value="orders" className="space-y-6">
            <Suspense fallback={<TabLoading />}>
            <Orders
              onShipOrder={handleShipOrder}
              key={initialOrdersSubtab}
              initialSubtab={initialOrdersSubtab}
              onCreateOrder={() => setShowCreateModal(true)}
              onEditOrder={async (order) => {
                try {
                  const fullOrder = await salesService.getOrder(order.id);
                  setEditingOrder({
                    ...fullOrder,
                    delivery_date: fullOrder.expected_date || fullOrder.delivery_date || '',
                    shipping_cost: fullOrder.shipping_amount || fullOrder.shipping_cost || 0,
                    lines: fullOrder.lines || [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '' }]
                  });
                } catch (error) {
                  console.error('Failed to fetch order details:', error);
                  setEditingOrder({...order, lines: order.lines || [{ product_name: '', product_id: '', quantity: 1, unit_price: 0, description: '' }]});
                }
                setShowEditModal(true);
              }}
              onViewOrder={handleViewOrder}
              onPrintOrder={handlePrintOrder}
              onUpdateStatus={handleUpdateStatus}
              onCreateInvoice={handleCreateInvoice}
              onCreateInvoiceDelivered={handleCreateInvoiceDelivered}
              onDeleteOrder={handleDeleteOrder}
              showImportModal={showImportModal}
              setShowImportModal={setShowImportModal}
              showExportModal={showExportModal}
              setShowExportModal={setShowExportModal}
              showBatchPrint={showBatchPrint}
              setShowBatchPrint={setShowBatchPrint}
            />
            </Suspense>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Suspense fallback={<TabLoading />}>
              <Invoices openInvoiceId={newInvoiceId} onInvoiceOpened={() => setNewInvoiceId(null)} />
            </Suspense>
          </TabsContent>

          {/* Settings Tab — discounts · carriers · pricelists · payment terms · templates · dropshipping */}
          <TabsContent value="settings">
            <Suspense fallback={<TabLoading />}>
              <SalesSettingsTab key={initialSettingsSubtab} initialSubtab={initialSettingsSubtab} />
            </Suspense>
          </TabsContent>

        </Tabs>

        {/* Create Order Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) resetOrderForm(); }}>
          {/* Prevent accidental dismissal via outside-click or Escape so
              users don't lose half-filled forms. Closing requires the X
              button or Cancel button. */}
          <DialogContent
            className="max-w-6xl max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{t('create_new_order')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('customer')} *</Label>
                  <CustomerCombobox
                    customers={customers}
                    value={newOrder.customer_id || ''}
                    onValueChange={(value, customer) => {
                      if (!customer) customer = customers.find(c => c.id === value);
                      setNewOrder({
                        ...newOrder,
                        customer_id: value,
                        customer_name: customer?.company_name || customer?.name || '',
                        project_id: '',
                        project_name: '',
                        contract_id: '',
                      });
                    }}
                    placeholder={t('select_customer') || 'Mijozni tanlang'}
                    t={t}
                  />
                </div>
                {/* Project selector — only for intercompany customers or project-first flow */}
                {(() => {
                  // Determine which projects to show
                  const selectedCustomer = customers.find(c => c.id === newOrder.customer_id);
                  const isIntercompany = selectedCustomer?.source_organization_id;

                  // If customer selected and is intercompany — filter projects for that customer
                  // If no customer selected — show all intercompany projects (project-first flow)
                  // If customer selected but NOT intercompany — hide project selector
                  if (newOrder.customer_id && !isIntercompany) return null;

                  const visibleProjects = newOrder.customer_id
                    ? allIntercompanyProjects.filter(p => p._customer_id === newOrder.customer_id)
                    : allIntercompanyProjects;

                  if (visibleProjects.length === 0 && !newOrder.customer_id) return null;

                  return (
                    <div>
                      <Label>{t('project') || 'Loyiha'} {isIntercompany && <span className="text-red-500">*</span>}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal h-9 px-3 text-sm"
                          >
                            <span className="truncate">
                              {newOrder.project_id
                                ? (() => {
                                    const p = allIntercompanyProjects.find(p => p.id === newOrder.project_id);
                                    return p ? `${p.project_code} — ${p.project_name}` : newOrder.project_name;
                                  })()
                                : (t('select_project') || 'Loyihani tanlang')}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command shouldFilter={true}>
                            <CommandInput placeholder={t('search') || "Qidirish..."} />
                            <CommandList>
                              <CommandEmpty>{t('not_found') || "Topilmadi"}</CommandEmpty>
                              <CommandGroup>
                                {visibleProjects.map((project) => (
                                  <CommandItem
                                    key={project.id}
                                    value={`${project.project_code} ${project.project_name} ${project._customer_name}`}
                                    onSelect={() => {
                                      setNewOrder({
                                        ...newOrder,
                                        project_id: project.id,
                                        project_name: project.project_name || '',
                                        customer_id: project._customer_id,
                                        customer_name: project._customer_name,
                                      });
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newOrder.project_id === project.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="truncate">
                                      <span className="font-medium">{project.project_code} — {project.project_name}</span>
                                      {!newOrder.customer_id && (
                                        <span className="text-xs text-slate-500 ml-2">({project._customer_name})</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })()}
                {/* Optional contract link — the customer's income contracts */}
                {newOrder.customer_id && (
                  <div>
                    <Label>{t('contract_select_label') || 'Shartnoma'}</Label>
                    <Select
                      value={newOrder.contract_id || 'none'}
                      onValueChange={(value) => setNewOrder({ ...newOrder, contract_id: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('contract_none') || '—'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('contract_none') || '—'}</SelectItem>
                        {(customerContracts[newOrder.customer_id] || []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.contract_number}{c.title ? ` — ${c.title}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('order_date')} *</Label>
                  <Input
                    type="date"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label>{t('delivery_date')} {!isDeliveryDateManual && <span className="text-xs text-slate-500">({t('auto_calculated') || 'Auto'})</span>}</Label>
                  <Input
                    type="date"
                    value={newOrder.delivery_date}
                    onChange={(e) => {
                      setNewOrder({...newOrder, delivery_date: e.target.value});
                      setIsDeliveryDateManual(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('warehouse') || 'Warehouse'}</Label>
                  {warehouses.length === 1 ? (
                    <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                  ) : (
                    <Select
                      value={newOrder.warehouse_id || ''}
                      onValueChange={(value) => setNewOrder({...newOrder, warehouse_id: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>{t('carrier') || 'Carrier'}</Label>
                  <Select
                    value={newOrder.carrier || ''}
                    onValueChange={(value) => setNewOrder({...newOrder, carrier: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_carrier') || 'Select carrier'} />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.name}>
                          {carrier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('vehicle_number') || 'Moshina raqami'}</Label>
                  <Input
                    placeholder="01 A 123 AA"
                    value={newOrder.vehicle_number || ''}
                    onChange={(e) => setNewOrder({...newOrder, vehicle_number: e.target.value})}
                  />
                </div>
              </div>

              {/* Comment / note — shown on the printed order */}
              <div>
                <Label>{t('notes') || (language === 'ru' ? 'Комментарий' : 'Izoh')}</Label>
                <textarea
                  className="w-full min-h-[70px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--genix-purple)]/20"
                  placeholder={language === 'ru' ? 'Комментарий к заказу (печатается на документе)' : "Buyurtma izohi (chekda chiqadi)"}
                  value={newOrder.notes || ''}
                  onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                />
              </div>

              {/* Order Lines */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-semibold">{t('order_items')}</Label>
                  <Button size="sm" variant="outline" onClick={() => handleAddLine(newOrder, setNewOrder, isDeliveryDateManual, setIsDeliveryDateManual)}>
                    <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                  </Button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {newOrder.lines.map((line, index) => {
                    const selectedProduct = products.find(p => p.id === line.product_id);
                    const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                    const hasPackagings = productPackagings[line.product_id]?.length > 0;
                    return (
                    <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                      <div className="flex gap-2 items-end">
                        <div className="flex-[2] min-w-0">
                          {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('product')}</Label>}
                          <ProductCombobox
                            products={products}
                            value={line.product_id || ''}
                            onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'product_id', value, isDeliveryDateManual)}
                            placeholder={t('select_product')}
                            t={t}
                          />
                        </div>
                        {hasVariants && (
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('variant')}</Label>}
                            <Select
                              value={line.variant_id || ''}
                              onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'variant_id', value, isDeliveryDateManual)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_variant') || 'Variant'} />
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
                        {hasPackagings && (
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packaging')}</Label>}
                            <Select
                              value={line.packaging_id || 'none'}
                              onValueChange={(value) => handleLineChange(newOrder, setNewOrder, index, 'packaging_id', value === 'none' ? null : value, isDeliveryDateManual)}
                            >
                              <SelectTrigger>
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
                          </div>
                        )}
                        {line.packaging_id ? (
                          <>
                            <div className="flex-[1] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packs') || 'Packs'}</Label>}
                              <Input
                                type="number"
                                min="1"
                                placeholder={t('packs') || 'Packs'}
                                value={line.packaging_qty || 1}
                                onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'packaging_qty', e.target.value, isDeliveryDateManual)}
                              />
                            </div>
                            <div className="flex-[1] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total_qty') || 'Total'}</Label>}
                              <Input
                                type="number"
                                placeholder={t('total_qty') || 'Total'}
                                value={line.quantity}
                                disabled
                                className="bg-slate-100"
                                title={`${line.packaging_qty || 1} × ${line.packaging_unit_qty || 1} = ${line.quantity}`}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex-[1] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('qty')}</Label>}
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                placeholder={t('qty')}
                                value={line.quantity}
                                onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'quantity', e.target.value, isDeliveryDateManual)}
                              />
                              {line.unit_name && (
                                <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-[1.5] min-w-0">
                          {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('price')}</Label>}
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder={t('price')}
                            value={formatPriceInput(line.unit_price)}
                            onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'unit_price', parsePriceInput(e.target.value), isDeliveryDateManual)}
                          />
                        </div>
                        <div className="flex-[1.5] min-w-0">
                          {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total')}</Label>}
                          <div className="h-9 flex items-center justify-end px-3 bg-white border rounded-md text-sm font-medium text-slate-700">
                            {formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)).toFixed(2)))}
                          </div>
                        </div>
                        {!line.packaging_id && (
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('note')}</Label>}
                            <Input
                              placeholder={t('note')}
                              value={line.description}
                              onChange={(e) => handleLineChange(newOrder, setNewOrder, index, 'description', e.target.value, isDeliveryDateManual)}
                            />
                          </div>
                        )}
                        <div className="flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveLine(newOrder, setNewOrder, index, isDeliveryDateManual)}
                            disabled={newOrder.lines.length === 1}
                            className="text-red-600 h-9 w-9 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {line.variant_name && (
                        <div className="text-xs text-slate-500 pl-1">
                          {t('variant')}: {line.variant_name}
                        </div>
                      )}
                      {(() => {
                        const warning = getStockWarning(line, newOrder.warehouse_id);
                        if (!warning) return null;
                        return (
                          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded mt-1 ${
                            warning.type === 'error'
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}>
                            <MessageSquareWarning className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{warning.message}</span>
                          </div>
                        );
                      })()}
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Tax and Shipping */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label>{t('tax')} (%)</Label>
                  <Popover>
                    <PopoverAnchor asChild>
                      <div className="flex">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={newOrder.tax_percent}
                          onChange={(e) => setNewOrder({...newOrder, tax_percent: e.target.value})}
                          className="rounded-r-none border-r-0"
                        />
                        {parseFloat(newOrder.tax_percent) > 0 && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-none border-x-0 shrink-0 px-1 text-slate-400 hover:text-red-500"
                            onClick={() => setNewOrder({...newOrder, tax_percent: 0, tax_rate_id: ''})}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-l-none border-l-0 shrink-0 px-2">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                      </div>
                    </PopoverAnchor>
                    <PopoverContent className="w-56 p-1" align="end">
                      <div className="space-y-0.5">
                        {salesTaxRates.map(tr => (
                          <PopoverTrigger asChild key={tr.id}>
                            <button
                              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors"
                              onClick={() => setNewOrder({...newOrder, tax_percent: tr.rate, tax_rate_id: tr.id})}
                            >
                              {tr.name} ({tr.rate}%){tr.price_include ? ` (${t('incl') || 'incl.'})` : ''}
                            </button>
                          </PopoverTrigger>
                        ))}
                        {salesTaxRates.length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-500">{t('no_tax_rates') || 'No tax rates available'}</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>{t('shipping')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatPriceInput(newOrder.shipping_cost)}
                    onChange={(e) => setNewOrder({...newOrder, shipping_cost: parsePriceInput(e.target.value)})}
                  />
                </div>
              </div>

              {/* Discount Code */}
              <div className="border-t pt-4">
                <Label>{t('discount_code') || 'Discount Code'}</Label>
                <div className="flex gap-2 mt-1">
                  {!newOrder.discount_id ? (
                    <>
                      <Input
                        placeholder={t('enter_code') || 'Enter discount code'}
                        value={discountCodeInput}
                        onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleApplyDiscount}
                        disabled={!discountCodeInput.trim()}
                      >
                        {t('apply') || 'Apply'}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-700">{newOrder.discount_code}</span>
                        <span className="text-green-600">- {newOrder.discount_name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveDiscount}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {discountValidation.message && !newOrder.discount_id && (
                  <p className={`text-sm mt-1 ${discountValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                    {discountValidation.message}
                  </p>
                )}
              </div>

              {/* Payment Journal */}
              {bankCashJournals.length > 0 && (
                <div>
                  <Label>{t('payment_journal') || "To'lov jurnali"}</Label>
                  <Select
                    value={newOrder.payment_journal_id || ''}
                    onValueChange={(value) => setNewOrder({...newOrder, payment_journal_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_journal') || "Jurnal tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      {bankCashJournals.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.name} ({j.type === 'bank' ? t('bank') || 'Bank' : t('cash') || 'Naqd'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Totals */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="space-y-2">
                  {(() => {
                    const rawSubtotal = calculateOrderTotals(newOrder.lines);
                    const taxPercent = parseFloat(newOrder.tax_percent) || 0;
                    const selectedTax = newOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(newOrder.tax_rate_id)) : defaultSalesTax;
                    const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
                    const subtotal = taxCalc.subtotal;
                    const taxAmount = taxCalc.taxAmount;
                    const shippingCost = parseFloat(newOrder.shipping_cost) || 0;
                    const discountAmount = newOrder.discount_id ? calculateDiscountAmount(subtotal, {
                      discount_type: newOrder.discount_type,
                      discount_value: newOrder.discount_value,
                      max_discount_amount: newOrder.max_discount_amount,
                    }) : 0;
                    const total = subtotal + taxAmount + shippingCost - discountAmount;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('subtotal')}:</span>
                          <span className="font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>{t('discount')} ({newOrder.discount_code}):</span>
                            <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('tax')}{taxCalc.isInclusive ? ` (${t('incl') || 'incl.'})` : ''}:</span>
                          <span className="font-medium">{formatCurrency(taxAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('shipping')}:</span>
                          <span className="font-medium">{formatCurrency(shippingCost)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                          <span className="font-semibold text-lg">{t('total_amount')}:</span>
                          <span className="text-2xl font-bold text-blue-600">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); resetOrderForm(); }} className="flex-1">
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newOrder.customer_name || newOrder.lines.every(l => !l.product_id && !l.product_name)}
                >
                  {t('create')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Modal */}
        <ImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
          columns={importColumns}
          entityName={t('sales_order')}
        />

        {/* Export Modal */}
        <ExportModal
          open={showExportModal}
          onClose={() => setShowExportModal(false)}
          data={salesOrders}
          columns={exportColumns}
          entityName={t('sales_orders')}
          title={t('sales_orders')}
        />

        {/* Print Preview Modal */}
        {selectedOrder && (
          <PrintPreviewModal
            open={showPrintPreview}
            onClose={() => {
              setShowPrintPreview(false);
              setSelectedOrder(null);
            }}
            config={generatePrintConfig(selectedOrder)}
            filename={`sales_order_${selectedOrder.id}`}
          />
        )}

        {/* Order Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={(open) => { setShowDetailModal(open); if (!open) { setSelectedOrder(null); setOrderReturns([]); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {t('order_details') || 'Order Details'}
                {selectedOrder && orderHasReturns(selectedOrder.id) && (
                  <Badge className="bg-red-100 text-red-700">
                    <MessageSquareWarning className="w-3 h-3 mr-1" />
                    {t('has_returns') || 'Has Returns'}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t('order_number') || 'Order Number'}</p>
                    <p className="font-mono font-medium">{selectedOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('status') || 'Status'}</p>
                    <Badge className={orderStatusClass(selectedOrder.status)}>{t(selectedOrder.status)}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('customer') || 'Customer'}</p>
                    <p className="font-medium">{selectedOrder.customer_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('order_date') || 'Order Date'}</p>
                    <p className="font-medium">
                      {selectedOrder.order_date ? format(new Date(selectedOrder.order_date), 'dd.MM.yyyy') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('delivery_date') || 'Delivery Date'}</p>
                    <p className="font-medium">
                      {(selectedOrder.expected_date || selectedOrder.delivery_date || selectedOrder.expected_delivery_date)
                        ? format(new Date(selectedOrder.expected_date || selectedOrder.delivery_date || selectedOrder.expected_delivery_date), 'dd.MM.yyyy')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('payment_status') || 'Payment Status'}</p>
                    <Badge className={
                      selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      selectedOrder.payment_status === 'partial' || selectedOrder.payment_status === 'partial_paid' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {t(selectedOrder.payment_status) || selectedOrder.payment_status || t('unpaid') || 'Unpaid'}
                    </Badge>
                  </div>
                  {selectedOrder.carrier && (
                    <div>
                      <p className="text-sm text-slate-500">{t('carrier') || 'Tashuvchi'}</p>
                      <p className="font-medium">{selectedOrder.carrier}</p>
                    </div>
                  )}
                  {selectedOrder.vehicle_number && (
                    <div>
                      <p className="text-sm text-slate-500">{t('vehicle_number') || 'Moshina raqami'}</p>
                      <p className="font-medium">{selectedOrder.vehicle_number}</p>
                    </div>
                  )}
                  {selectedOrder.project_name && (
                    <div>
                      <p className="text-sm text-slate-500">{t('project') || 'Loyiha'}</p>
                      <p className="font-medium flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                        {selectedOrder.project_name}
                      </p>
                    </div>
                  )}
                </div>

                {selectedOrder.lines && selectedOrder.lines.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2">{t('order_items') || 'Order Items'}</p>
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      {selectedOrder.lines.map((line, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span className="font-medium">{line.description || line.product_name || 'Product'}</span>
                            <p className="text-xs text-slate-500">{t('quantity')}: {line.quantity}{line.unit_name ? ` ${line.unit_name}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{formatCurrency(line.quantity * line.unit_price)}</span>
                            <p className="text-xs text-slate-500">{formatCurrency(line.unit_price)} x {line.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('subtotal')}:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('tax')}:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{t('shipping')}:</span>
                      <span className="font-medium">{formatCurrency(selectedOrder.shipping_amount || selectedOrder.shipping_cost || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                      <span className="font-semibold text-lg">{t('total_amount')}:</span>
                      <span className="text-2xl font-bold text-blue-600">{formatCurrency(selectedOrder.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Returns Section */}
                {orderReturns.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-2 flex items-center gap-2 text-red-600">
                      <RotateCcw className="w-4 h-4" />
                      {t('returns') || 'Returns'}
                    </p>
                    <div className="space-y-3">
                      {orderReturns.map((ret) => (
                        <div key={ret.id} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-red-700">{ret.return_number}</span>
                              <Badge className={
                                ret.status === 'completed' || ret.status === 'refunded' ? 'bg-green-100 text-green-800' :
                                ret.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                ret.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                ret.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                                'bg-gray-100 text-gray-800'
                              }>{t(ret.status) || ret.status}</Badge>
                            </div>
                            <span className="text-sm text-slate-500">
                              {ret.return_date ? format(new Date(ret.return_date), 'dd.MM.yyyy') : '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-500">{t('reason') || 'Reason'}:</span>
                              <span className="ml-1 font-medium">{t(ret.return_reason) || ret.return_reason}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{t('total_value') || 'Total Value'}:</span>
                              <span className="ml-1 font-semibold text-red-600">{formatCurrency(ret.total_amount || ret.refund_amount || 0)}</span>
                            </div>
                          </div>
                          {/* Returned Items */}
                          {ret.items && ret.items.length > 0 && (
                            <div className="mt-2 border-t border-red-100 pt-2">
                              <p className="text-xs text-slate-500 mb-1">{t('returned_items') || 'Returned Items'}:</p>
                              <div className="space-y-1">
                                {ret.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm bg-white/50 px-2 py-1 rounded">
                                    <span className="font-medium">{item.product_name}</span>
                                    <span className="text-red-600 font-semibold">
                                      {item.quantity} {t('pcs') || 'pcs'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ret.notes && (
                            <p className="text-sm text-slate-600 mt-2 border-t border-red-100 pt-2">{ret.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div>
                    <p className="text-sm text-slate-500">{t('notes') || 'Notes'}</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowDetailModal(false); setSelectedOrder(null); setOrderReturns([]); }} className="flex-1">
                    {t('close') || 'Close'}
                  </Button>
                  <Button onClick={() => { setShowDetailModal(false); handlePrintOrder(selectedOrder); }} className="flex-1">
                    <Printer className="w-4 h-4 mr-2" /> {t('print') || 'Print'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Batch Print Modal */}
        <BatchPrintModal
          open={showBatchPrint}
          onClose={() => setShowBatchPrint(false)}
          documents={salesOrders.map(o => ({
            id: o.id,
            name: o.order_number,
            number: o.order_number,
            date: o.order_date ? format(new Date(o.order_date), 'dd.MM.yyyy') : '',
          }))}
          generateConfig={generatePrintConfig}
          entityName={t('order')}
        />

        {/* Edit Order Modal */}
        {editingOrder && (
          <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) { setEditingOrder(null); setIsEditDeliveryDateManual(false); } }}>
            <DialogContent
              className="max-w-6xl max-h-[90vh] overflow-y-auto"
              onPointerDownOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{t('edit_order')} - {editingOrder.order_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('customer')} *</Label>
                    <CustomerCombobox
                      customers={customers}
                      value={editingOrder.customer_id || ''}
                      onValueChange={(value, customer) => {
                        setEditingOrder({
                          ...editingOrder,
                          customer_id: value,
                          customer_name: customer?.company_name || customer?.name || '',
                          contract_id: '',
                        });
                      }}
                      placeholder={editingOrder.customer_name || t('select_customer') || 'Select customer'}
                      t={t}
                    />
                  </div>
                  <div>
                    <Label>{t('delivery_date')} {!isEditDeliveryDateManual && <span className="text-xs text-slate-500">({t('auto_calculated') || 'Auto'})</span>}</Label>
                    <Input
                      type="date"
                      value={editingOrder.delivery_date || ''}
                      onChange={(e) => {
                        setEditingOrder({...editingOrder, delivery_date: e.target.value});
                        setIsEditDeliveryDateManual(true);
                      }}
                    />
                  </div>
                </div>

                {/* Optional contract link — the customer's income contracts */}
                {editingOrder.customer_id && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('contract_select_label') || 'Shartnoma'}</Label>
                      <Select
                        value={editingOrder.contract_id || 'none'}
                        onValueChange={(value) => setEditingOrder({ ...editingOrder, contract_id: value === 'none' ? '' : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('contract_none') || '—'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('contract_none') || '—'}</SelectItem>
                          {(customerContracts[editingOrder.customer_id] || []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.contract_number}{c.title ? ` — ${c.title}` : ''}
                            </SelectItem>
                          ))}
                          {/* Keep an already-linked contract selectable even if it
                              no longer appears in the active income list */}
                          {editingOrder.contract_id
                            && !(customerContracts[editingOrder.customer_id] || []).some(c => c.id === editingOrder.contract_id) && (
                            <SelectItem value={editingOrder.contract_id}>
                              {(t('contract_select_label') || 'Shartnoma')} · {String(editingOrder.contract_id).slice(0, 8)}…
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('warehouse') || 'Warehouse'}</Label>
                    {warehouses.length === 1 ? (
                      <Input value={warehouses[0].name} disabled className="bg-slate-50" />
                    ) : (
                      <Select
                        value={editingOrder.warehouse_id || ''}
                        onValueChange={(value) => setEditingOrder({...editingOrder, warehouse_id: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_warehouse') || 'Select warehouse'} />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>{t('carrier') || 'Carrier'}</Label>
                    <Select
                      value={editingOrder.carrier || ''}
                      onValueChange={(value) => setEditingOrder({...editingOrder, carrier: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_carrier') || 'Select carrier'} />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.name}>
                            {carrier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Order Lines */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-semibold">{t('order_items')}</Label>
                    <Button size="sm" variant="outline" onClick={() => handleAddLine(editingOrder, setEditingOrder, isEditDeliveryDateManual, setIsEditDeliveryDateManual)}>
                      <Plus className="w-4 h-4 mr-1" /> {t('add_line')}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {editingOrder.lines.map((line, index) => {
                      const selectedProduct = products.find(p => p.id === line.product_id);
                      const hasVariants = selectedProduct?.has_variants && productVariants[line.product_id]?.length > 0;
                      const hasPackagings = productPackagings[line.product_id]?.length > 0;
                      return (
                      <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                        <div className="flex gap-2 items-end">
                          <div className="flex-[2] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('product')}</Label>}
                            <ProductCombobox
                              products={products}
                              value={line.product_id || ''}
                              onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'product_id', value, isEditDeliveryDateManual)}
                              placeholder={line.product_name || t('select_product')}
                              t={t}
                            />
                          </div>
                          {hasVariants && (
                            <div className="flex-[2] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('variant')}</Label>}
                              <Select
                                value={line.variant_id || ''}
                                onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'variant_id', value, isEditDeliveryDateManual)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('select_variant') || 'Variant'} />
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
                          {hasPackagings && (
                            <div className="flex-[2] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packaging')}</Label>}
                              <Select
                                value={line.packaging_id || 'none'}
                                onValueChange={(value) => handleLineChange(editingOrder, setEditingOrder, index, 'packaging_id', value === 'none' ? null : value, isEditDeliveryDateManual)}
                              >
                                <SelectTrigger>
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
                            </div>
                          )}
                          {line.packaging_id ? (
                            <>
                              <div className="flex-[1] min-w-0">
                                {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('packs') || 'Packs'}</Label>}
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder={t('packs') || 'Packs'}
                                  value={line.packaging_qty || 1}
                                  onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'packaging_qty', e.target.value, isEditDeliveryDateManual)}
                                />
                              </div>
                              <div className="flex-[1] min-w-0">
                                {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total_qty') || 'Total'}</Label>}
                                <Input
                                  type="number"
                                  placeholder={t('total_qty') || 'Total'}
                                  value={line.quantity}
                                  disabled
                                  className="bg-slate-100"
                                  title={`${line.packaging_qty || 1} × ${line.packaging_unit_qty || 1} = ${line.quantity}`}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="flex-[1] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('qty')}</Label>}
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  placeholder={t('qty')}
                                  value={line.quantity}
                                  onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'quantity', e.target.value, isEditDeliveryDateManual)}
                                />
                                {line.unit_name && (
                                  <span className="text-xs text-slate-500 whitespace-nowrap">{line.unit_name}</span>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex-[1.5] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('price')}</Label>}
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder={t('price')}
                              value={formatPriceInput(line.unit_price)}
                              onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'unit_price', parsePriceInput(e.target.value), isEditDeliveryDateManual)}
                            />
                          </div>
                          <div className="flex-[1.5] min-w-0">
                            {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('total')}</Label>}
                            <div className="h-9 flex items-center justify-end px-3 bg-white border rounded-md text-sm font-medium text-slate-700">
                              {formatPriceInput(String((parseFloat(line.quantity || 0) * parseFloat(line.unit_price || 0)).toFixed(2)))}
                            </div>
                          </div>
                          {!line.packaging_id && (
                            <div className="flex-[2] min-w-0">
                              {index === 0 && <Label className="text-xs text-slate-500 mb-1">{t('note')}</Label>}
                              <Input
                                placeholder={t('note')}
                                value={line.description || ''}
                                onChange={(e) => handleLineChange(editingOrder, setEditingOrder, index, 'description', e.target.value, isEditDeliveryDateManual)}
                              />
                            </div>
                          )}
                          <div className="flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveLine(editingOrder, setEditingOrder, index, isEditDeliveryDateManual)}
                              disabled={editingOrder.lines.length === 1}
                              className="text-red-600 h-9 w-9 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {line.packaging_name && (
                          <div className="text-xs text-slate-500 pl-1">
                            {t('packaging')}: {line.packaging_name} ({line.packaging_qty || 1} × {line.packaging_unit_qty || 1} = {line.quantity} {t('units') || 'units'})
                          </div>
                        )}
                        {(() => {
                          const warning = getStockWarning(line, editingOrder.warehouse_id);
                          if (!warning) return null;
                          return (
                            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded mt-1 ${
                              warning.type === 'error'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>
                              <MessageSquareWarning className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{warning.message}</span>
                            </div>
                          );
                        })()}
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tax and Shipping */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <Label>{t('tax')} (%)</Label>
                    <Popover>
                      <PopoverAnchor asChild>
                        <div className="flex">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={editingOrder.tax_percent || 0}
                            onChange={(e) => setEditingOrder({...editingOrder, tax_percent: e.target.value})}
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
                          {salesTaxRates.map(tr => (
                            <PopoverTrigger asChild key={tr.id}>
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors"
                                onClick={() => setEditingOrder({...editingOrder, tax_percent: tr.rate})}
                              >
                                {tr.name} ({tr.rate}%)
                              </button>
                            </PopoverTrigger>
                          ))}
                          {salesTaxRates.length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-500">{t('no_tax_rates') || 'No tax rates available'}</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>{t('shipping')}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formatPriceInput(editingOrder.shipping_cost || 0)}
                      onChange={(e) => setEditingOrder({...editingOrder, shipping_cost: parsePriceInput(e.target.value)})}
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    {(() => {
                      const rawSubtotal = calculateOrderTotals(editingOrder.lines);
                      const taxPercent = parseFloat(editingOrder.tax_percent) || 0;
                      const selectedTax = editingOrder.tax_rate_id ? taxRates.find(tr => String(tr.id) === String(editingOrder.tax_rate_id)) : defaultSalesTax;
                      const taxCalc = calculateTaxFromRate(rawSubtotal, taxPercent, selectedTax);
                      const subtotal = taxCalc.subtotal;
                      const taxAmount = taxCalc.taxAmount;
                      const shippingCost = parseFloat(editingOrder.shipping_cost) || 0;
                      const total = subtotal + taxAmount + shippingCost;
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('subtotal')}:</span>
                            <span className="font-medium">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('tax')}{taxCalc.isInclusive ? ` (${t('incl') || 'incl.'})` : ''}:</span>
                            <span className="font-medium">{formatCurrency(taxAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('shipping')}:</span>
                            <span className="font-medium">{formatCurrency(shippingCost)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                            <span className="font-semibold text-lg">{t('total_amount')}:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingOrder(null); }} className="flex-1">
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleEditOrder}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                    disabled={!editingOrder.customer_name || editingOrder.lines.every(l => !l.product_id && !l.product_name)}
                  >
                    {t('save_changes')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
}
