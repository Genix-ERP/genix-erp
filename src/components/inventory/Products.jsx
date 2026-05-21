import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Package, Pencil, Trash2, Eye, DollarSign,
  Tag, Barcode, Box, Boxes, Filter, MoreHorizontal, AlertCircle,
  CheckCircle, XCircle, ShoppingCart, Archive, Upload, Download, History,
  Layers, Printer, HelpCircle, Truck, RefreshCw, Scale, ChevronDown, ChevronLeft, ChevronRight, ShieldCheck,
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import ExcelJS from "exceljs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { useInventory } from "@/components/contexts/InventoryContext";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/components/contexts/CompanyContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LotTracking from "./LotTracking";
import PriceLabelPrinting from "./PriceLabelPrinting";
import ProductVariants from "./ProductVariants";
import Packages from "./Packages";
import PackageTypes from "./PackageTypes";
import UnitsOfMeasure from "./UnitsOfMeasure";
import MaterialReservations from "./MaterialReservations";
import { inventoryService } from '@/api/services/inventory';
import apiClient from '@/api/client';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '');
const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return API_ORIGIN + url;
};
import { useToast } from "@/components/ui/use-toast";

// Import universal ERP components
import {
  ImportModal,
  ExportModal,
  ImportExportButtons,
  useAuditTrail,
} from '@/components/shared';
// parseSpreadsheetFile lets us bypass the ImportModal for product import.
// The Radix Dialog used by ImportModal closes itself when the OS file picker
// returns (its outside-interaction detection misfires on file pickers in
// macOS), tearing down the input before its change handler can run. By
// running the file input directly on the products page we skip the dialog
// entirely.
import { parseSpreadsheetFile } from '@/components/shared/ImportExport';

// ── EAN-13 Barcode Utilities ──────────────────────────────────────────────────
const EAN13_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN13_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN13_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN13_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

const calculateEAN13CheckDigit = (digits12) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
};

const generateEAN13 = () => {
  // Prefix 200-299 is reserved for internal/in-store use
  let digits = '200';
  for (let i = 0; i < 9; i++) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits + calculateEAN13CheckDigit(digits);
};

const isValidEAN13 = (code) => {
  if (!/^\d{13}$/.test(code)) return false;
  return calculateEAN13CheckDigit(code.substring(0, 12)) === parseInt(code[12]);
};

const EAN13Barcode = ({ code, width = 200, height = 60 }) => {
  if (!code || !/^\d{13}$/.test(code)) return null;
  const d = code.split('').map(Number);
  const parity = EAN13_PARITY[d[0]];

  let bin = '101';
  for (let i = 0; i < 6; i++) bin += parity[i] === 'L' ? EAN13_L[d[i+1]] : EAN13_G[d[i+1]];
  bin += '01010';
  for (let i = 0; i < 6; i++) bin += EAN13_R[d[i+7]];
  bin += '101';

  const bw = width / (bin.length + 14);
  const qz = bw * 7;
  const gh = height;
  const nh = height - 6;
  const fs = Math.max(9, Math.min(13, bw * 6));
  const bars = [];
  let x = qz;
  for (let i = 0; i < bin.length; i++) {
    const isG = i < 3 || (i >= 45 && i <= 49) || i >= bin.length - 3;
    if (bin[i] === '1') bars.push(<rect key={i} x={x} y={0} width={bw} height={isG ? gh : nh} fill="black" />);
    x += bw;
  }
  const tw = x + qz;
  const lgx = qz + 3 * bw;
  const rgx = qz + 50 * bw;
  const dw = 7 * bw;

  return (
    <svg width={tw} height={gh + 16} viewBox={`0 0 ${tw} ${gh + 16}`} className="bg-white">
      {bars}
      <text x={qz - 2} y={gh + 12} textAnchor="end" fontSize={fs} fontFamily="monospace">{d[0]}</text>
      {[1,2,3,4,5,6].map(i => (
        <text key={`l${i}`} x={lgx + (i-1)*dw + dw/2} y={gh + 12} textAnchor="middle" fontSize={fs} fontFamily="monospace">{d[i]}</text>
      ))}
      {[7,8,9,10,11,12].map(i => (
        <text key={`r${i}`} x={rgx + (i-7)*dw + dw/2} y={gh + 12} textAnchor="middle" fontSize={fs} fontFamily="monospace">{d[i]}</text>
      ))}
    </svg>
  );
};
// ── End EAN-13 ────────────────────────────────────────────────────────────────

// Field Help Component - Odoo-style tooltip for field explanations
// Note: TooltipProvider should be at a higher level, not per-component
const FieldHelp = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs bg-slate-800 text-white p-2 rounded-lg shadow-lg">
      <p>{text}</p>
    </TooltipContent>
  </Tooltip>
);

// Label with help tooltip
const LabelWithHelp = ({ label, helpText, required }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 flex items-center">
    {label}{required && ' *'}
    {helpText && <FieldHelp text={helpText} />}
  </label>
);

export default function Products() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency, currency_symbol } = useCurrencyFormatter();
  const {
    products,
    categories,
    inventory,
    warehouses,
    items,
    stockMovements,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
    isLoading,
    isLotTrackingEnabled,
    refreshData: refreshInventoryData,
  } = useInventory();
  const { accounts } = useFinancials();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();
  const { companies, activeCompany } = useCompany();
  const { toast } = useToast();

  const emptyCategoryAccounts = {
    income_account_id: '',
    expense_account_id: '',
    stock_valuation_account_id: '',
    stock_input_account_id: '',
    stock_output_account_id: '',
  };

  // Compute default accounts by account_type code
  const defaultCategoryAccounts = useMemo(() => {
    const findByType = (typeCode) => accounts.find(a => a.account_type?.code === typeCode)?.id || '';
    return {
      income_account_id: findByType('REVENUE'),
      expense_account_id: findByType('COGS'),
      stock_valuation_account_id: findByType('INV'),
      stock_input_account_id: findByType('INV'),
      stock_output_account_id: findByType('COGS'),
    };
  }, [accounts]);

  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState("trade");

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [productsLoading, setProductsLoading] = useState(false);
  const pageSize = 20;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [activeSubTab, setActiveSubTab] = useState("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  // Confirmation modal that appears before the file picker — gives users
  // a "Download Template" button so they can grab the expected column
  // shape (Nomi / Shtrix kod / Kategoriya / Teglar / Tan narxi / Sotish
  // narxi) and a "Choose File" button that triggers the body-level
  // singleton input.
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
  // Direct file-input ref for product import. The ref points at the
  // wrapper <div>; the actual <input type=file> is mounted into it via
  // the useEffect below using vanilla DOM APIs (addEventListener, NOT
  // React onChange). Reason: React's onChange on a file input was
  // mysteriously dropping events in this app — verified by the user's
  // browser-level test where a `document.createElement('input')` with
  // `inp.onchange = ...` worked perfectly while the same flow through
  // a JSX `<input onChange={...}>` did not fire. By staying on the DOM
  // side for the listener we guarantee the change event reaches us.
  const productImportFileRef = useRef(null);
  const [isProductImporting, setIsProductImporting] = useState(false);
  // Two-step modal: 'main' shows the upload/download choice; 'fields'
  // shows the column picker — only reached via the Download Template
  // button. Reset to 'main' whenever the modal closes so the next
  // open starts on the simple view.
  const [importStep, setImportStep] = useState('main');

  // Single source of truth for what the product import understands.
  // Drives BOTH the downloaded template (column order + headers) AND
  // the spreadsheet parser (header → backend field mapping). To add a
  // new importable field, just add an entry here — the modal, template
  // generator, and parser all consume this list.
  //
  // `default: true` means the column is pre-selected when the user
  // opens the import modal. Required (`name`) is also default-on and
  // can't be unchecked (the parser drops rows missing it).
  const IMPORT_FIELD_DEFS = useMemo(() => ([
    // ── Core (recommended for almost every import) ────────────────────
    { key: 'name',           label: 'Nomi',             group: 'core',     required: true,  default: true,  width: 32 },
    { key: 'barcode',        label: 'Shtrix kod',       group: 'core',     default: true,  width: 18 },
    { key: 'category',       label: 'Kategoriya',       group: 'core',     default: true,  width: 22 },
    { key: 'tags',           label: 'Teglar',           group: 'core',     default: true,  width: 22 },
    { key: 'cost_price',     label: 'Tan narxi',        group: 'pricing',  default: true,  width: 14, kind: 'number' },
    { key: 'list_price',     label: 'Sotish narxi',     group: 'pricing',  default: true,  width: 14, kind: 'number' },

    // ── Pricing extras ────────────────────────────────────────────────
    { key: 'wholesale_price',label: 'Ulgurji narxi',    group: 'pricing',  width: 14, kind: 'number' },
    { key: 'min_price',      label: 'Min narxi',        group: 'pricing',  width: 14, kind: 'number' },
    { key: 'delivery_price', label: 'Yetkazib berish narxi', group: 'pricing', width: 16, kind: 'number' },

    // ── Identifiers ───────────────────────────────────────────────────
    { key: 'search_key',     label: 'Qidiruv kaliti',   group: 'identifiers', width: 18 },
    { key: 'sku',            label: 'SKU',              group: 'identifiers', width: 14 },
    { key: 'brand',          label: 'Brend',            group: 'identifiers', width: 18 },
    { key: 'manufacturer',   label: 'Ishlab chiqaruvchi', group: 'identifiers', width: 22 },
    { key: 'model_number',   label: 'Model raqami',     group: 'identifiers', width: 18 },
    { key: 'upc',            label: 'UPC',              group: 'identifiers', width: 14 },
    { key: 'ean',            label: 'EAN',              group: 'identifiers', width: 14 },
    { key: 'isbn',           label: 'ISBN',             group: 'identifiers', width: 14 },
    { key: 'mpn',            label: 'MPN',              group: 'identifiers', width: 14 },
    { key: 'hs_code',        label: 'HS kodi',          group: 'identifiers', width: 14 },
    { key: 'country_of_origin', label: 'Mamlakat',      group: 'identifiers', width: 18 },

    // ── Inventory ─────────────────────────────────────────────────────
    { key: 'inventory_type', label: 'Tovar turi',       group: 'inventory', width: 16 },
    { key: 'min_stock_level',label: 'Min qoldiq',       group: 'inventory', width: 14, kind: 'number' },
    { key: 'reorder_point',  label: 'Qayta buyurtma nuqtasi', group: 'inventory', width: 18, kind: 'number' },
    { key: 'reorder_quantity', label: 'Qayta buyurtma miqdori', group: 'inventory', width: 18, kind: 'number' },
    { key: 'shelf_life_days',label: 'Saqlash muddati (kun)', group: 'inventory', width: 18, kind: 'number' },
    { key: 'storage_conditions', label: 'Saqlash sharoiti', group: 'inventory', width: 22 },

    // ── Supplier ──────────────────────────────────────────────────────
    { key: 'supplier_sku',   label: 'Yetkazib beruvchi SKU', group: 'supplier', width: 18 },
    { key: 'lead_time_days', label: 'Yetkazib berish kuni', group: 'supplier', width: 18, kind: 'number' },
    { key: 'customer_lead_time_days', label: 'Mijoz uchun kuni', group: 'supplier', width: 18, kind: 'number' },

    // ── Dimensions ────────────────────────────────────────────────────
    { key: 'weight',         label: 'Vazn (kg)',        group: 'dimensions', width: 12, kind: 'number' },
    { key: 'length',         label: 'Uzunlik (cm)',     group: 'dimensions', width: 12, kind: 'number' },
    { key: 'width',          label: 'Eni (cm)',         group: 'dimensions', width: 12, kind: 'number' },
    { key: 'height',         label: 'Balandlik (cm)',   group: 'dimensions', width: 12, kind: 'number' },

    // ── Other ─────────────────────────────────────────────────────────
    { key: 'description',    label: 'Tavsif',           group: 'other',    width: 40 },
    { key: 'warranty_months',label: 'Kafolat (oy)',     group: 'other',    width: 14, kind: 'number' },
    { key: 'type',           label: 'Tur',              group: 'other',    width: 12 },
  ]), []);

  // Selected import fields. Initialized from `default: true` entries
  // and persisted in localStorage so the user's preference survives
  // page reloads and tab switches.
  const [selectedImportFields, setSelectedImportFields] = useState(() => {
    try {
      const stored = localStorage.getItem('genix_product_import_fields');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) { /* ignore */ }
    return IMPORT_FIELD_DEFS.filter(f => f.default).map(f => f.key);
  });
  useEffect(() => {
    try { localStorage.setItem('genix_product_import_fields', JSON.stringify(selectedImportFields)); }
    catch (_) { /* localStorage may be unavailable in private mode — non-fatal */ }
  }, [selectedImportFields]);
  const [showExportModal, setShowExportModal] = useState(false);
  // Holds the FULL filtered product set used by the Export modal.
  // The list view itself is paginated (default 20 per page) so passing
  // `filteredProducts` to ExportModal would only export the current
  // page. We fetch the full set on demand when the user clicks Export
  // so the modal sees everything that matches the current filters.
  const [allProductsForExport, setAllProductsForExport] = useState([]);
  const [isPreparingExport, setIsPreparingExport] = useState(false);
  const [showCategoryImportModal, setShowCategoryImportModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryManageModal, setShowCategoryManageModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryAccounts, setCategoryAccounts] = useState({ ...emptyCategoryAccounts });

  // Units of Measure (fetched from DB for dynamic selects)
  const [uomList, setUomList] = useState([]);

  // Variant management state (for edit modal)
  const [editProductAttributes, setEditProductAttributes] = useState([]);
  const [allAttributes, setAllAttributes] = useState([]);
  const [editProductVariants, setEditProductVariants] = useState([]);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  // Set defaults when accounts load
  useEffect(() => {
    if (defaultCategoryAccounts.income_account_id && !showCategoryModal && !showEditCategoryModal) {
      setCategoryAccounts({ ...defaultCategoryAccounts });
    }
  }, [defaultCategoryAccounts]);
  const { addAuditLog } = useAuditTrail('products');

  // Fetch units of measure for dynamic selects
  useEffect(() => {
    const fetchUom = async () => {
      try {
        const res = await apiClient.get('/units-of-measure', { params: { limit: 200 } });
        setUomList(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error('Failed to fetch UOM:', err);
      }
    };
    fetchUom();
  }, []);

  // Format number with thousands separators for display in price inputs
  const formatPriceDisplay = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const str = String(value);
    // Allow typing decimal point
    const parts = str.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (parts.length > 1) return intPart + '.' + parts[1];
    return intPart;
  };

  const handlePriceChange = (field, rawValue) => {
    // Strip everything except digits and dot
    const cleaned = rawValue.replace(/[^\d.]/g, '');
    // Prevent multiple dots
    const dotIndex = cleaned.indexOf('.');
    const sanitized = dotIndex >= 0
      ? cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '')
      : cleaned;
    setFormData(prev => ({ ...prev, [field]: sanitized }));
  };

  // Cleanup all modals on unmount to prevent navigation blocking
  useEffect(() => {
    return () => {
      setShowCreateModal(false);
      setShowEditModal(false);
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setShowImportModal(false);
      setShowExportModal(false);
      setShowCategoryModal(false);
      setShowCategoryManageModal(false);
      setShowEditCategoryModal(false);
      setShowDeleteCategoryModal(false);
    };
  }, []);

  // Export columns configuration - comprehensive product fields.
  //
  // The `id` column is REQUIRED and locked-on. It carries the product's
  // UUID so the user can edit the file in Excel and re-import it as a
  // bulk UPDATE — the backend matches each row to an existing product
  // by `id` and only writes the columns the user filled in. Without
  // `id` re-importing the same export would create duplicate products.
  const exportColumns = [
    { key: 'id', label: 'ID', required: true },
    // Basic Info
    { key: 'name', label: 'Nomi' },
    { key: 'barcode', label: 'Shtrix kod' },
    { key: 'type', label: 'Turi' },
    { key: 'category_id', label: 'Kategoriya', render: (v) => categories.find(c => c.id === v)?.name || '-' },
    { key: 'description', label: 'Tavsif' },
    { key: 'tags', label: 'Teglar', render: (v) => (v || []).join(', ') },

    // Pricing
    { key: 'cost_price', label: 'Tan narxi', render: (v) => formatCurrency(v || 0) },
    { key: 'list_price', label: 'Sotish narxi', render: (v) => formatCurrency(v || 0) },
    { key: 'min_price', label: 'Minimal narx', render: (v) => v ? formatCurrency(v) : '-' },
    { key: 'wholesale_price', label: 'Ulgurji narx', render: (v) => v ? formatCurrency(v) : '-' },

    // Stock Settings
    { key: 'is_stockable', label: 'Zaxira qilinadimi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'track_inventory', label: 'Inventar kuzatish', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'min_stock_level', label: 'Minimal zaxira' },
    { key: 'reorder_point', label: 'Qayta buyurtma nuqtasi' },
    { key: 'reorder_quantity', label: 'Qayta buyurtma miqdori' },

    // Sales & Purchase
    { key: 'is_purchasable', label: 'Sotib olinadimi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'is_sellable', label: 'Sotiladimi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'is_active', label: 'Holat', render: (v) => v ? 'Faol' : 'Nofaol' },

    // Module Visibility (Odoo-style)
    { key: 'can_be_sold', label: 'Sotish modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_purchased', label: 'Sotib olish modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'available_in_pos', label: 'POS modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_expensed', label: 'Xarajatlar modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_rented', label: 'Ijara modulida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'can_be_subcontracted', label: 'Subpudrat sifatida', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'is_overhead_expense', label: 'Nakladnoy xarajat', render: (v) => v ? 'Ha' : 'Yo\'q' },

    // Identification
    { key: 'brand', label: 'Brend' },
    { key: 'manufacturer', label: 'Ishlab chiqaruvchi' },
    { key: 'model_number', label: 'Model raqami' },
    { key: 'upc', label: 'UPC' },
    { key: 'ean', label: 'EAN' },
    { key: 'isbn', label: 'ISBN' },
    { key: 'mpn', label: 'MPN' },

    // Physical Properties
    { key: 'weight', label: 'Og\'irlik' },
    { key: 'weight_unit', label: 'Og\'irlik birligi' },
    { key: 'length', label: 'Uzunlik' },
    { key: 'width', label: 'Kenglik' },
    { key: 'height', label: 'Balandlik' },
    { key: 'dimension_unit', label: 'O\'lcham birligi' },

    // Additional Info
    { key: 'warranty_months', label: 'Kafolat (oy)' },
    { key: 'country_of_origin', label: 'Kelib chiqish mamlakatiy' },
    { key: 'hs_code', label: 'HS kodi' },
    { key: 'tax_class', label: 'Soliq sinfi' },

    // Supplier Info
    { key: 'supplier_sku', label: 'Yetkazib beruvchi SKU' },
    { key: 'lead_time_days', label: 'Yetkazib berish muddati (kun)' },

    // Storage
    { key: 'shelf_life_days', label: 'Saqlash muddati (kun)' },
    { key: 'storage_conditions', label: 'Saqlash sharoitlari' },
    { key: 'requires_lot_tracking', label: 'Partiya kuzatuvi', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'requires_serial_tracking', label: 'Seriya kuzatuvi', render: (v) => v ? 'Ha' : 'Yo\'q' },

    // Units of Measure — keys match what the API returns in ProductResponse
    // (unit_code / *_unit_name), not the form field names. The previous keys
    // (inventory_uom / sales_uom / purchase_uom) only exist on the edit form
    // state, so the export silently wrote empty cells.
    { key: 'unit_code', label: 'Inventar birligi' },
    { key: 'sales_unit_name', label: 'Sotish birligi' },
    { key: 'purchase_unit_name', label: 'Sotib olish birligi' },
    { key: 'uom_conversion_factor', label: 'Birlik konvertatsiyasi' },

    // Expiration
    { key: 'track_expiration', label: 'Muddatni kuzatish', render: (v) => v ? 'Ha' : 'Yo\'q' },
    { key: 'expiration_time_days', label: 'Yaroqlilik muddati (kun)' },
    { key: 'removal_time_days', label: 'Olib tashlash muddati (kun)' },
    { key: 'alert_time_days', label: 'Ogohlantirish muddati (kun)' },
  ];

  // Import columns configuration
  const importColumns = [
    { key: 'name', label: 'Nomi', required: true },
    { key: 'barcode', label: 'Shtrix kod' },
    { key: 'category', label: 'Kategoriya' },
    { key: 'tags', label: 'Teglar' },
    { key: 'cost_price', label: 'Tan narxi' },
    { key: 'list_price', label: 'Sotish narxi' },
  ];

  const handleImport = async (data) => {
    // Build the payload for the bulk endpoint. The backend handles
    // category resolution by name, code auto-generation, and per-row
    // duplicate detection — we just pass through what's in the sheet.
    // (Old behaviour: 690 sequential `await createProduct(...)` calls,
    // which froze the modal for ~3 minutes and bailed on the first
    // failure with one terse error.)
    // eslint-disable-next-line no-console
    console.log('[product-import] handleImport called', {
      rows: Array.isArray(data) ? data.length : 'not-array',
      firstRow: Array.isArray(data) ? data[0] : null,
      activeCompanyId: activeCompany?.id || null,
    });
    const products = (data || [])
      .filter(row => row && row.name != null && String(row.name).trim() !== '')
      .map(row => {
        let categoryId = '';
        if (row.category) {
          const cat = categories.find(c => c.name?.toLowerCase() === row.category?.toString().toLowerCase());
          if (cat) categoryId = cat.id;
        }
        return {
          name: String(row.name).trim(),
          // Caller-supplied barcode wins; otherwise the server auto-slugs
          // a code from the name.
          barcode: row.barcode != null ? String(row.barcode).trim() : '',
          category_id: categoryId || undefined,
          // Pass the raw category string too so the backend can match by
          // case-insensitive name even if the frontend cache is stale.
          category: row.category != null ? String(row.category).trim() : undefined,
          tags: row.tags ? String(row.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
          type: 'product',
          cost_price: parseFloat(row.cost_price) || 0,
          list_price: parseFloat(row.list_price) || 0,
          is_active: true,
        };
      });

    // eslint-disable-next-line no-console
    console.log('[product-import] built products payload', {
      count: products.length,
      firstThree: products.slice(0, 3),
    });

    if (products.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('[product-import] aborting: products array is empty after mapping. ' +
        'This usually means the column mapping in the modal didn\'t map "Nomi" → name. ' +
        'Raw data sample:', (data || []).slice(0, 2));
      toast({ title: 'Import: 0 rows', description: 'Faylda mahsulot topilmadi (mapping bo‘sh bo‘lishi mumkin)' });
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[product-import] POST /products/bulk →', {
      productCount: products.length,
      organization_ids: activeCompany?.id ? [activeCompany.id] : [],
    });

    let result;
    try {
      result = await inventoryService.bulkCreateProducts({
        products,
        organization_ids: activeCompany?.id ? [activeCompany.id] : [],
      });
      // eslint-disable-next-line no-console
      console.log('[product-import] bulk result', result);
    } catch (err) {
      // Network or 5xx — surface a real message instead of axios's
      // generic "Request failed with status code 500".
      console.error('[product-import] Bulk import failed:', err);
      console.error('[product-import] response data:', err?.response?.data);
      console.error('[product-import] response status:', err?.response?.status);
      const detail = err?.response?.data?.message || err?.message || String(err);
      throw new Error(detail);
    }

    const { created = 0, skipped = 0, failed = 0, total = products.length, outcomes = [] } = result || {};

    // Refresh inventory state so the new products appear in the list
    // without a page reload.
    if (typeof refreshInventoryData === 'function') {
      try { await refreshInventoryData(); } catch (_) { /* non-fatal */ }
    }

    addAuditLog('create', 'batch',
      `${created}/${total} products imported (skipped: ${skipped}, failed: ${failed})`);

    // Surface a summary. If anything was skipped or failed, log the
    // per-row details so the admin can investigate.
    const summaryTitle = `Import: ${created} created · ${skipped} skipped · ${failed} failed`;
    if (skipped > 0 || failed > 0) {
      const issues = outcomes
        .filter(o => o.status === 'skipped' || o.status === 'failed')
        .slice(0, 20)
        .map(o => `Row ${o.row} (${o.name}): ${o.status}${o.reason ? ' — ' + o.reason : ''}`)
        .join('\n');
      console.warn('[Product import] outcome summary:\n' + issues);
      toast({
        title: summaryTitle,
        description: issues || undefined,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    } else {
      toast({ title: summaryTitle });
    }
  };

  // Direct (no-modal) product import. Click flow:
  //   1. User clicks the "Import" button → triggers the hidden file input.
  //   2. Native file picker opens; user selects xlsx/csv.
  //   3. We parse here, build the bulk payload, POST /products/bulk,
  //      refresh the list, and toast a summary.
  // This deliberately skips ImportModal because Radix Dialog kept eating
  // the input's change event when the file picker closed.
  // Generate a styled template xlsx with the expected column headers
  // and trigger a browser download. Mirrors the styling of the
  // ImportExport `downloadTemplate` so it visually matches the other
  // import templates in the app.
  const downloadProductImportTemplate = async () => {
    // Build columns from the user's selected fields, preserving the
    // canonical order from IMPORT_FIELD_DEFS. Always include the
    // required `name` column even if somehow excluded from the
    // selection (defensive — the UI prevents unchecking it).
    const selectedKeys = new Set([
      'name',
      ...selectedImportFields,
    ]);
    const cols = IMPORT_FIELD_DEFS
      .filter(f => selectedKeys.has(f.key))
      .map(f => ({ label: f.label, required: !!f.required, width: f.width || 18, kind: f.kind }));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'GenixERP';
    wb.created = new Date();
    const ws = wb.addWorksheet('Mahsulotlar');

    // Header row — bold white text on blue, centered, with a thin
    // bottom border.
    const headerRow = ws.addRow(cols.map(c => c.required ? `${c.label} *` : c.label));
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FF2563EB' } },
        bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
        left:   { style: 'thin', color: { argb: 'FF2563EB' } },
        right:  { style: 'thin', color: { argb: 'FF2563EB' } },
      };
    });

    // Sample row — one example value per selected column. Hard-coded
    // examples for known fields; falls back to the column label for
    // anything else so the user sees what shape we expect even on
    // custom imports.
    const SAMPLES = {
      name: 'Vешалка прешебочный никель простая',
      barcode: '4780000000123',
      category: 'Xomashyo',
      tags: 'mebel, fabrika',
      cost_price: 3782,
      list_price: 4500,
      wholesale_price: 4200,
      min_price: 4000,
      delivery_price: 0,
      brand: 'BrandName',
      manufacturer: 'Factory',
      model_number: 'MD-123',
      upc: '012345678905',
      ean: '4006381333931',
      isbn: '978-3-16-148410-0',
      mpn: 'MPN-001',
      hs_code: '7308.30',
      country_of_origin: 'CN',
      sku: 'SKU-001',
      search_key: 'CHAIR-NICK-3782',
      weight: 1.5,
      length: 40,
      width: 30,
      height: 90,
      warranty_months: 12,
      lead_time_days: 7,
      customer_lead_time_days: 3,
      shelf_life_days: 365,
      storage_conditions: 'Quruq, salqin',
      min_stock_level: 5,
      reorder_point: 10,
      reorder_quantity: 50,
      supplier_sku: 'VSKU-001',
      description: 'Mahsulot tavsifi',
      type: 'product',
      inventory_type: 'trade',
    };
    const selectedDefs = IMPORT_FIELD_DEFS.filter(f => selectedKeys.has(f.key));
    const sample = ws.addRow(selectedDefs.map(f => SAMPLES[f.key] != null ? SAMPLES[f.key] : ''));
    sample.height = 22;
    sample.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 };
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });

    // Note row below the sample explaining required + auto-create.
    // Merge across however many columns the user picked.
    const noteRow = ws.addRow([
      '* — Majburiy. Mavjud bo‘lmagan kategoriya avtomatik yaratiladi. Bir xil nomli mahsulot mavjud bo‘lsa, dublikat yaratilmaydi (joriy kompaniyaga ulanadi).',
    ]);
    const lastColLetter = (n) => {
      // Convert 1-based column number to letter (A, B, ..., Z, AA, AB, ...).
      let s = ''; let m = n;
      while (m > 0) { const r = (m - 1) % 26; s = String.fromCharCode(65 + r) + s; m = Math.floor((m - 1) / 26); }
      return s;
    };
    const noteEnd = lastColLetter(cols.length);
    ws.mergeCells(`A${noteRow.number}:${noteEnd}${noteRow.number}`);
    const note = ws.getCell(`A${noteRow.number}`);
    note.font = { italic: true, color: { argb: 'FFEF4444' }, size: 9 };
    note.alignment = { vertical: 'middle', wrapText: true };
    noteRow.height = 36;

    // Apply column widths.
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

    // Freeze the header row so it stays visible when the user scrolls.
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Mahsulotlar_template.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDirectProductImportFile = async (e) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires onChange.
    if (e.target) e.target.value = '';
    if (!file) return;

    setIsProductImporting(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      // eslint-disable-next-line no-console
      console.log('[product-import] parsed', { headers: parsed.headers, rows: parsed.rows?.length });

      // Build the header → backend-field map from IMPORT_FIELD_DEFS so
      // any field the template can include is also parsable on the way
      // back. Keep a few legacy aliases (English column names) so an
      // older template still works after the field-set was expanded.
      const headerKeyMap = {};
      IMPORT_FIELD_DEFS.forEach(f => {
        // The Uzbek label as written in the template.
        headerKeyMap[f.label.toLowerCase()] = f.key;
        // The bare backend key, in case the user typed it directly.
        headerKeyMap[f.key.toLowerCase()] = f.key;
      });
      // Aliases so the round-trip Export → Edit → Import works even
      // when the export column labels don't perfectly match the
      // import-template labels. `id` is always recognized so the
      // round trip works regardless of language.
      Object.assign(headerKeyMap, {
        // ID variants
        id: 'id',
        'product id': 'id',
        'product_id': 'id',
        // English aliases for common columns
        name: 'name',
        barcode: 'barcode',
        category: 'category',
        tags: 'tags',
        'cost price': 'cost_price',
        'list price': 'list_price',
        'wholesale price': 'wholesale_price',
        'min price': 'min_price',
        'delivery price': 'delivery_price',
        brand: 'brand',
        manufacturer: 'manufacturer',
        weight: 'weight',
        description: 'description',
        // Uzbek labels used by the Export modal that differ slightly
        // from the import template's labels — covers both spellings
        // so a re-import of an exported xlsx maps correctly.
        'turi': 'type',                  // export: "Turi" — import: "Tur"
        'minimal narx': 'min_price',     // export: "Minimal narx" — import: "Min narxi"
        'ulgurji narx': 'wholesale_price', // export: "Ulgurji narx" — import: "Ulgurji narxi"
        'kelib chiqish mamlakatiy': 'country_of_origin', // export label
        'og\'irlik': 'weight',
        'uzunlik': 'length',                               // export: "Uzunlik" — import: "Uzunlik (cm)"
        'kenglik': 'width',
        'balandlik': 'height',                             // export: "Balandlik" — import: "Balandlik (cm)"
        'minimal zaxira': 'min_stock_level',               // export: "Minimal zaxira" — import: "Min qoldiq"
        'yetkazib berish muddati (kun)': 'lead_time_days', // export: "Yetkazib berish muddati (kun)" — import: "Yetkazib berish kuni"
        'saqlash sharoitlari': 'storage_conditions',       // export: plural — import: "Saqlash sharoiti" (singular)
      });
      // Strip the "*" required-marker, collapse whitespace, lowercase.
      // The downloaded template writes headers like "Nomi *" with the
      // asterisk inline, and users often paste them back unchanged —
      // without this normalisation the lookup misses and every row
      // gets filtered out, producing the "0 rows" toast.
      const normaliseHeader = (h) =>
        String(h || '')
          .toLowerCase()
          .replace(/\*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const mapping = {};
      (parsed.headers || []).forEach(h => {
        const norm = normaliseHeader(h);
        if (headerKeyMap[norm]) mapping[h] = headerKeyMap[norm];
      });

      const txt = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : undefined);
      const num = (v) => {
        if (v == null || v === '') return undefined;
        const f = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(f) ? f : undefined;
      };

      const products = (parsed.rows || [])
        .map(raw => {
          const row = {};
          Object.entries(mapping).forEach(([h, key]) => { row[key] = raw[h]; });
          return row;
        })
        // A row is valid for processing if it has either:
        //   - an `id` (UPDATE mode — the user is editing an existing product), or
        //   - a `name` (CREATE mode — making a new product).
        // Empty-but-existent rows in the spreadsheet (Excel often leaves
        // trailing empty rows) get filtered out.
        .filter(r => r && (txt(r.id) || txt(r.name)))
        .map(r => {
          const id = txt(r.id);
          const isUpdate = !!id;

          let categoryId = '';
          if (r.category) {
            const cat = categories.find(c => c.name?.toLowerCase() === String(r.category).toLowerCase());
            if (cat) categoryId = cat.id;
          }

          // For UPDATE rows we ONLY include fields the user actually
          // populated — anything blank stays as-is on the server. For
          // CREATE rows we enforce sensible defaults (cost_price = 0
          // etc.) so the row is shaped like a fresh CreateProduct call.
          const payload = isUpdate
            ? { id, type: txt(r.type), tags: r.tags ? String(r.tags).split(',').map(t => t.trim()).filter(Boolean) : undefined }
            : {
                name: String(r.name).trim(),
                type: txt(r.type) || 'product',
                is_active: true,
                tags: r.tags ? String(r.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
              };

          // Set name and category_id only when the user actually
          // provided values for them. On UPDATE rows, omitted name
          // means "keep existing"; on CREATE rows we already set name
          // above.
          const nameVal = txt(r.name);
          if (nameVal && isUpdate) payload.name = nameVal;
          if (categoryId) payload.category_id = categoryId;
          if (txt(r.category)) payload.category = txt(r.category);

          // Strings — only included when present, so UPDATE rows don't
          // accidentally null-out columns the user didn't touch.
          ['barcode', 'sku', 'search_key', 'brand', 'manufacturer',
           'model_number', 'upc', 'ean', 'isbn', 'mpn', 'hs_code',
           'country_of_origin', 'description', 'storage_conditions',
           'inventory_type', 'supplier_sku',
          ].forEach(k => { const v = txt(r[k]); if (v !== undefined) payload[k] = v; });

          // Numbers.
          ['cost_price', 'list_price', 'wholesale_price', 'min_price',
           'delivery_price', 'weight', 'length', 'width', 'height',
           'min_stock_level', 'reorder_point', 'reorder_quantity',
           'warranty_months', 'lead_time_days', 'customer_lead_time_days',
           'shelf_life_days',
          ].forEach(k => { const v = num(r[k]); if (v !== undefined) payload[k] = v; });

          // CREATE-only defaults: list view + margin calculations
          // assume non-null prices.
          if (!isUpdate) {
            if (payload.cost_price == null) payload.cost_price = 0;
            if (payload.list_price == null) payload.list_price = 0;
          }

          return payload;
        });

      if (products.length === 0) {
        toast({ title: 'Import: 0 rows', description: 'Faylda mahsulot topilmadi (kolonkalar mos kelmadi)' });
        return;
      }

      const result = await inventoryService.bulkCreateProducts({
        products,
        organization_ids: activeCompany?.id ? [activeCompany.id] : [],
      });

      const { total = products.length, outcomes = [] } = result || {};
      // Count outcomes from the per-row results so we don't miss the
      // 'updated' status that the backend's UPDATE branch emits — the
      // top-level `result.created` only covers CREATE rows.
      const counts = (outcomes || []).reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});
      const created = counts.created || result?.created || 0;
      const updated = counts.updated || 0;
      const skipped = counts.skipped || result?.skipped || 0;
      const failed  = counts.failed  || result?.failed  || 0;

      // Refresh both the inventory-level cache (for stock counts on
      // sibling tabs) AND the products list itself. The local
      // `fetchProducts()` call is essential — without it the page
      // keeps showing the previously-loaded page data even though
      // the server has the updated values, making it look like the
      // import did nothing even when the toast says "N updated".
      if (typeof refreshInventoryData === 'function') {
        try { await refreshInventoryData(); } catch (_) { /* non-fatal */ }
      }
      try { await fetchProducts(); } catch (_) { /* non-fatal */ }
      addAuditLog('create', 'batch',
        `${created} created · ${updated} updated · ${skipped} skipped · ${failed} failed (of ${total})`);

      const parts = [];
      if (created > 0) parts.push(`${created} created`);
      if (updated > 0) parts.push(`${updated} updated`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed > 0) parts.push(`${failed} failed`);
      const summaryTitle = `Import: ${parts.join(' · ') || '0 rows'}`;

      if (skipped > 0 || failed > 0) {
        const issues = outcomes
          .filter(o => o.status === 'skipped' || o.status === 'failed')
          .slice(0, 20)
          .map(o => `Row ${o.row} (${o.name}): ${o.status}${o.reason ? ' — ' + o.reason : ''}`)
          .join('\n');
        console.warn('[product-import] outcome summary:\n' + issues);
        toast({
          title: summaryTitle,
          description: issues || undefined,
          variant: failed > 0 ? 'destructive' : 'default',
        });
      } else {
        toast({ title: summaryTitle });
      }
    } catch (err) {
      console.error('[product-import] failed:', err);
      const detail = err?.response?.data?.message || err?.message || String(err);
      toast({
        title: 'Import error',
        description: detail,
        variant: 'destructive',
      });
    } finally {
      setIsProductImporting(false);
    }
  };

  // Mount the file input on <body>, NOT inside the React tree.
  // Reason: the user's Products component is being unmounted/remounted
  // by something upstream (verified via window.__importDebug — multiple
  // mount/cleanup cycles after page load). Keeping the input alive
  // across those remounts means clicking it from the toolbar always has
  // a working <input>, regardless of what React does to its tree.
  // We attach the change listener once at app-level on the singleton
  // input. The "Import" button just .click()s it.
  // Hand the LATEST handler closure to a window-level slot every render.
  // The body-attached singleton input's listener (bound once per page)
  // reads from this slot, so it always invokes the freshest closure
  // even after the React component unmounts/remounts.
  useEffect(() => {
    window.__productImportHandler = handleDirectProductImportFile;
  });

  // One-time setup: ensure a body-attached file input exists and has a
  // change listener bound exactly once per page lifecycle. We CAN'T
  // re-bind the listener on each component mount because the parent
  // tree cycles unmount→mount and the cleanup would remove the listener
  // *during* the open OS file picker — when the user then picks a file
  // and the change event fires, there's no handler attached. By binding
  // once and routing through `window.__productImportHandler`, the
  // listener survives any number of React remounts.
  useEffect(() => {
    let input = document.getElementById('genixerp-product-import-input-singleton');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv';
      input.id = 'genixerp-product-import-input-singleton';
      document.body.appendChild(input);
    }
    // Always re-apply style (overwrites any stale pointer-events:none
    // from older versions of this code).
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
    productImportFileRef.current = input;

    if (input.dataset.bound !== 'true') {
      input.addEventListener('change', (e) => {
        const handler = window.__productImportHandler;
        if (handler) handler(e);
      });
      input.dataset.bound = 'true';
    }
    // Intentionally NO cleanup — we don't want to detach the listener
    // when the React component unmounts. The input + listener live
    // for the whole page lifecycle.
  }, []);

  const categoryImportColumns = [
    { key: 'name', label: 'Nomi', required: true },
    { key: 'description', label: 'Tavsif' },
  ];

  const handleCategoryImport = async (data) => {
    for (const row of data) {
      const categoryData = {
        name: row.name,
        code: row.code || row.name.toUpperCase().replace(/\s+/g, '-').substring(0, 20),
        description: row.description || '',
        is_active: true,
      };
      await createCategory(categoryData);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    search_key: '',
    type: 'product',
    category_id: '',
    description: '',
    cost_price: '',
    list_price: '',
    min_price: '',
    wholesale_price: '',
    is_stockable: true,
    track_inventory: true,
    min_stock_level: '',
    reorder_point: '',
    reorder_quantity: '',
    is_purchasable: true,
    is_sellable: true,
    is_active: true,
    // Module visibility (Odoo-style)
    can_be_sold: true,
    can_be_purchased: true,
    available_in_pos: false,
    can_be_expensed: false,
    can_be_rented: false,
    can_be_subcontracted: false,
    is_overhead_expense: false,
    is_manufacturable: false,
    auto_manufacture: false,
    has_delivery: false,
    delivery_price: '',
    organization_ids: [],
    tags: [],
    // New advanced fields
    brand: '',
    manufacturer: '',
    model_number: '',
    upc: '',
    ean: '',
    isbn: '',
    mpn: '', // Manufacturer Part Number
    // Weight & Dimensions
    weight: '',
    weight_unit: 'kg',
    length: '',
    width: '',
    height: '',
    dimension_unit: 'cm',
    // Additional info
    warranty_months: '',
    country_of_origin: '',
    hs_code: '', // Harmonized System code for customs
    tax_class: 'standard',
    // Variants
    has_variants: false,
    variant_attributes: [], // e.g., [{name: 'Color', values: ['Red', 'Blue']}, {name: 'Size', values: ['S', 'M', 'L']}]
    variants: [], // Generated variant combinations
    // Bundle/Combo items (for type 'combo')
    bundle_items: [], // [{product_id: '', quantity: 1, product_name: ''}]
    // Supplier info
    default_supplier_id: '',
    supplier_sku: '',
    lead_time_days: '',
    // Storage
    shelf_life_days: '',
    storage_conditions: '',
    requires_lot_tracking: false,
    requires_serial_tracking: false,
    // Media
    image_url: '',
    additional_images: [],
    // SEO/Web
    meta_title: '',
    meta_description: '',
    url_slug: '',
    // Units of Measure (SAP-style)
    inventory_uom: 'unit',
    sales_uom: 'unit',
    purchase_uom: 'unit',
    uom_conversion_factor: '1',
    // Customer Lead Time
    customer_lead_time_days: '',
    // Expiration tracking
    track_expiration: false,
    expiration_time_days: '', // Default expiration time from production/receipt
    use_expiration_date: false,
    use_best_before_date: false,
    removal_time_days: '', // Days before expiration to remove from available stock
    alert_time_days: '', // Days before expiration to show alert
    inventory_type: 'trade',
  });

  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [newVariantAttribute, setNewVariantAttribute] = useState({ name: '', values: '' });

  // Backend product attributes for variant selection
  const [backendAttributes, setBackendAttributes] = useState([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState('');
  const [selectedValueIds, setSelectedValueIds] = useState([]);
  const [showCreateAttribute, setShowCreateAttribute] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrInlineValues, setNewAttrInlineValues] = useState([]); // [{name, price_extra}]
  const [newAttrValName, setNewAttrValName] = useState('');
  const [newAttrValPrice, setNewAttrValPrice] = useState('');
  const [isCreatingAttr, setIsCreatingAttr] = useState(false);
  const [showAddValue, setShowAddValue] = useState(false);
  const [newValueName, setNewValueName] = useState('');
  const [newValuePriceExtra, setNewValuePriceExtra] = useState('');
  const [isAddingValue, setIsAddingValue] = useState(false);

  const fetchBackendAttributes = async () => {
    try {
      const response = await apiClient.get('/product-attributes');
      setBackendAttributes(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load product attributes:', err);
    }
  };

  useEffect(() => {
    fetchBackendAttributes();
  }, []);

  const handleCreateInlineAttribute = async () => {
    if (!newAttrName.trim() || newAttrInlineValues.length === 0) return;
    setIsCreatingAttr(true);
    try {
      // Create attribute first (backend inline values don't support price_extra)
      const res = await apiClient.post('/product-attributes', {
        name: newAttrName.trim(),
        display_type: 'select',
        create_variant: true,
        values: [],
      });
      const attrId = res.data?.data?.id || res.data?.id;
      // Add each value with price_extra via separate endpoint
      if (attrId) {
        for (let i = 0; i < newAttrInlineValues.length; i++) {
          const v = newAttrInlineValues[i];
          await apiClient.post(`/product-attributes/${attrId}/values`, {
            name: v.name,
            price_extra: v.price_extra || 0,
            sort_order: i,
          });
        }
      }
      await fetchBackendAttributes();
      setNewAttrName('');
      setNewAttrInlineValues([]);
      setNewAttrValName('');
      setNewAttrValPrice('');
      setShowCreateAttribute(false);
    } catch (err) {
      console.error('Failed to create attribute:', err);
    } finally {
      setIsCreatingAttr(false);
    }
  };

  const handleAddValueToAttribute = async () => {
    if (!selectedAttributeId || !newValueName.trim()) return;
    setIsAddingValue(true);
    try {
      await apiClient.post(`/product-attributes/${selectedAttributeId}/values`, {
        name: newValueName.trim(),
        price_extra: parseFloat(newValuePriceExtra) || 0,
      });
      await fetchBackendAttributes();
      setNewValueName('');
      setNewValuePriceExtra('');
      setShowAddValue(false);
    } catch (err) {
      console.error('Failed to add value:', err);
    } finally {
      setIsAddingValue(false);
    }
  };

  // NOTE: Summary calculations were here but have been moved further down,
  // after accessibleWarehouseIds is declared, so the "Omborda" card can
  // count products that actually have stock in an accessible warehouse
  // (rather than just counting products with the is_stockable attribute,
  // which was a misleading proxy that ignored real stock levels).

  // Fetch the entire filtered product set (across all pages) and open
  // the Export modal once the data is in hand. Uses the same filters
  // as the list view so a user who's filtered to "Plita" gets the
  // full Plita set in their export, not just the visible page.
  const handleOpenExport = useCallback(async () => {
    setIsPreparingExport(true);
    try {
      const params = { page: 1, limit: 10000 };
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter !== "all") params.category_id = categoryFilter;
      if (inventoryTypeFilter !== "all") params.inventory_type = inventoryTypeFilter;
      if (warehouseFilter !== "all") params.warehouse_id = warehouseFilter;
      if (statusFilter === "inactive") params.include_inactive = "true";
      const result = await inventoryService.listProductsPaginated(params);
      let items = result?.data || [];
      // Same client-side filters as fetchProducts so the export
      // matches what the user sees on screen. Warehouse filter is now
      // server-side; only the inactive filter still needs client filtering
      // because the backend returns active+inactive when include_inactive=true.
      if (statusFilter === "inactive") {
        items = items.filter(product => !product.is_active);
      }
      setAllProductsForExport(items);
      setShowExportModal(true);
    } catch (err) {
      console.error('Failed to load products for export:', err);
      toast({
        variant: 'destructive',
        title: t('error') || 'Error',
        description: t('export_load_failed') || "Eksport uchun mahsulotlarni yuklab bo'lmadi",
      });
    } finally {
      setIsPreparingExport(false);
    }
  }, [searchQuery, categoryFilter, warehouseFilter, statusFilter, inventoryTypeFilter, toast, t]);

  // Server-side fetch for products with pagination.
  // Warehouse filter is now sent to the backend (ListProducts accepts a
  // `warehouse_id` param that filters via EXISTS on the inventory table).
  // Previously the warehouse filter was applied client-side over the current
  // 20-row page, which silently dropped any matching product that lived on
  // any other page — making the filter look like it only worked for one item.
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const params = { page: currentPage, limit: pageSize };
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter !== "all") params.category_id = categoryFilter;
      if (inventoryTypeFilter !== "all") params.inventory_type = inventoryTypeFilter;
      if (warehouseFilter !== "all") params.warehouse_id = warehouseFilter;
      if (statusFilter === "inactive") params.include_inactive = "true";
      const result = await inventoryService.listProductsPaginated(params);
      let items = result?.data || [];
      // For inactive filter, backend returns all — filter client-side
      if (statusFilter === "inactive") {
        items = items.filter(product => !product.is_active);
      }
      setFilteredProducts(items);
      setTotalProducts(result?.meta?.total || 0);
    } catch (error) {
      console.error('Error fetching products:', error);
      setFilteredProducts([]);
      setTotalProducts(0);
    } finally {
      setProductsLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter, warehouseFilter, statusFilter, inventoryTypeFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, warehouseFilter, statusFilter, inventoryTypeFilter]);

  const totalPages = Math.ceil(totalProducts / pageSize);

  // Set of warehouse IDs belonging to the active company/organization
  const accessibleWarehouseIds = useMemo(() => {
    if (!activeCompany?.id) return new Set((warehouses || []).map(w => w.id));
    return new Set(
      (warehouses || []).filter(w => w.organization_id === activeCompany.id).map(w => w.id)
    );
  }, [warehouses, activeCompany]);

  // Summary stat cards above the product table. Two notes for future-self:
  //   • totalProducts comes from the paginated API meta so it reflects the
  //     full filtered set, not just the current page.
  //   • activeProducts / inStockProducts / lowStockProducts are computed
  //     from the local `products` and `inventory` arrays. The inventory
  //     context fetches products with limit=5000 and inventory with
  //     limit=10000, so for tenants beyond those caps these stats can
  //     undercount — switch to a dedicated /products/stats endpoint if
  //     that ever becomes a real problem.
  //   • "inStockProducts" replaces the previous `stockableProducts`
  //     metric (count of products with is_stockable=true). is_stockable
  //     was a product attribute, not a measurement of real stock, which
  //     made the "Omborda" card disagree with the warehouse totals.
  const summaryStats = useMemo(() => {
    const inStockProductIds = new Set();
    for (const inv of inventory || []) {
      const qty = inv.quantity_on_hand ?? inv.quantity ?? 0;
      if (qty <= 0) continue;
      if (inv.warehouse_type === 'scrap') continue;
      if (!accessibleWarehouseIds.has(inv.warehouse_id)) continue;
      if (inv.product_id) inStockProductIds.add(inv.product_id);
    }
    return {
      totalProducts: totalProducts,
      activeProducts: products.filter(p => p.is_active).length,
      inStockProducts: inStockProductIds.size,
      lowStockProducts: products.filter(p => {
        const stock = items.filter(i => i.product_id === p.id).reduce((s, i) => s + (i.current_stock || 0), 0);
        return p.min_stock_level > 0 && stock <= p.min_stock_level;
      }).length,
    };
  }, [totalProducts, products, inventory, items, accessibleWarehouseIds]);

  const getProductStock = (productId) => {
    let stockItems = inventory.filter(i => i.product_id === productId && i.warehouse_type !== 'scrap' && accessibleWarehouseIds.has(i.warehouse_id));
    if (warehouseFilter !== "all") {
      stockItems = stockItems.filter(i => i.warehouse_id === warehouseFilter);
    }
    return stockItems.reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0);
  };

  const getProductScrapStock = (productId) => {
    const scrapItems = inventory.filter(i => i.product_id === productId && i.warehouse_type === 'scrap' && accessibleWarehouseIds.has(i.warehouse_id));
    return scrapItems.reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      barcode: '',
      search_key: '',
      type: 'product',
      category_id: '',
      description: '',
      cost_price: '',
      list_price: '',
      min_price: '',
      wholesale_price: '',
      is_stockable: true,
      track_inventory: true,
      min_stock_level: '',
      reorder_point: '',
      reorder_quantity: '',
      is_purchasable: true,
      is_sellable: true,
      is_active: true,
      // Module visibility (Odoo-style)
      can_be_sold: true,
      can_be_purchased: true,
      available_in_pos: false,
      can_be_expensed: false,
      can_be_rented: false,
      can_be_subcontracted: false,
      is_overhead_expense: false,
      is_manufacturable: false,
      auto_manufacture: false,
      has_delivery: false,
      delivery_price: '',
      organization_ids: activeCompany?.id ? [activeCompany.id] : [],
      tags: [],
      // Advanced fields
      brand: '',
      manufacturer: '',
      model_number: '',
      upc: '',
      ean: '',
      isbn: '',
      mpn: '',
      weight: '',
      weight_unit: 'kg',
      length: '',
      width: '',
      height: '',
      dimension_unit: 'cm',
      warranty_months: '',
      country_of_origin: '',
      hs_code: '',
      tax_class: 'standard',
      has_variants: false,
      variant_attributes: [],
      variants: [],
      bundle_items: [],
      default_supplier_id: '',
      supplier_sku: '',
      lead_time_days: '',
      shelf_life_days: '',
      storage_conditions: '',
      requires_lot_tracking: false,
      requires_serial_tracking: false,
      image_url: '',
      additional_images: [],
      meta_title: '',
      meta_description: '',
      url_slug: '',
      // Units of Measure
      inventory_uom: 'unit',
      sales_uom: 'unit',
      purchase_uom: 'unit',
      uom_conversion_factor: '1',
      // Customer Lead Time
      customer_lead_time_days: '',
      // Expiration tracking
      track_expiration: false,
      expiration_time_days: '',
      use_expiration_date: false,
      use_best_before_date: false,
      removal_time_days: '',
      alert_time_days: '',
      inventory_type: 'trade',
    });
    setShowAdvancedFields(false);
    setNewVariantAttribute({ name: '', values: '' });
    setSelectedAttributeId('');
    setSelectedValueIds([]);
    setShowCreateAttribute(false);
    setNewAttrName('');
    setNewAttrInlineValues([]);
    setNewAttrValName('');
    setNewAttrValPrice('');
    setShowAddValue(false);
    setNewValueName('');
    setNewValuePriceExtra('');
  };

  const handleCreate = async () => {
    // Validate at least one company is selected
    if (companies.length > 0 && formData.organization_ids.length === 0) {
      toast?.({ title: t('no_companies_selected_warning') || 'Please select at least one company', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      // Auto-generate EAN-13 barcode if not provided
      const barcode = formData.barcode || generateEAN13();
      // Generate code from barcode or name (backend requires 'code' field)
      const generatedCode = barcode || formData.name.toUpperCase().replace(/\s+/g, '-').substring(0, 50);
      const productData = {
        ...formData,
        barcode,
        code: generatedCode,
        inventory_type: formData.inventory_type,
        cost_price: parseFloat(formData.cost_price) || 0,
        list_price: parseFloat(formData.list_price) || 0,
        min_price: parseFloat(formData.min_price) || 0,
        wholesale_price: parseFloat(formData.wholesale_price) || 0,
        has_delivery: formData.has_delivery,
        delivery_price: parseFloat(formData.delivery_price) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        reorder_quantity: parseFloat(formData.reorder_quantity) || 0,
        weight: parseFloat(formData.weight) || null,
        length: parseFloat(formData.length) || null,
        width: parseFloat(formData.width) || null,
        height: parseFloat(formData.height) || null,
        warranty_months: parseInt(formData.warranty_months) || null,
        lead_time_days: parseInt(formData.lead_time_days) || null,
        shelf_life_days: parseInt(formData.shelf_life_days) || null,
        customer_lead_time_days: parseInt(formData.customer_lead_time_days) || null,
        expiration_time_days: parseInt(formData.expiration_time_days) || null,
        removal_time_days: parseInt(formData.removal_time_days) || null,
        alert_time_days: parseInt(formData.alert_time_days) || null,
        uom_conversion_factor: parseFloat(formData.uom_conversion_factor) || 1,
      };

      const newProduct = await createProduct(productData);

      // If product has variants, link attributes and generate variants
      if (formData.has_variants && formData.variant_attributes.length > 0 && newProduct?.id) {
        try {
          // Link each attribute + selected values to the product
          for (const attr of formData.variant_attributes) {
            await apiClient.post(`/products/${newProduct.id}/attributes`, {
              product_id: newProduct.id,
              attribute_id: attr.attribute_id,
              value_ids: attr.values.map(v => v.id),
            });
          }
          // Auto-generate variant combinations
          await apiClient.post('/product-variants/generate', {
            product_id: newProduct.id,
          });
        } catch (variantErr) {
          console.error('Error setting up variants:', variantErr);
        }
      }

      resetForm();
      setShowCreateModal(false);
      fetchProducts();
    } catch (error) {
      console.error('Error creating product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    const hasAdvancedData = product.brand || product.manufacturer || product.weight ||
                           product.has_variants || product.warranty_months || product.hs_code;
    setFormData({
      name: product.name || '',
      barcode: product.barcode || '',
      search_key: product.search_key || '',
      type: product.type || 'product',
      category_id: product.category_id || '',
      description: product.description || '',
      cost_price: product.cost_price ? product.cost_price.toString() : '',
      list_price: product.list_price ? product.list_price.toString() : '',
      min_price: product.min_price ? product.min_price.toString() : '',
      wholesale_price: product.wholesale_price ? product.wholesale_price.toString() : '',
      has_delivery: product.has_delivery || false,
      delivery_price: product.delivery_price ? product.delivery_price.toString() : '',
      is_stockable: product.is_stockable !== false,
      track_inventory: product.track_inventory !== false,
      min_stock_level: product.min_stock_level?.toString() || '',
      reorder_point: product.reorder_point?.toString() || '',
      reorder_quantity: product.reorder_quantity?.toString() || '',
      is_purchasable: product.is_purchasable !== false,
      is_sellable: product.is_sellable !== false,
      is_active: product.is_active !== false,
      // Module visibility (Odoo-style)
      can_be_sold: product.can_be_sold !== false,
      can_be_purchased: product.can_be_purchased !== false,
      available_in_pos: product.available_in_pos || false,
      can_be_expensed: product.can_be_expensed || false,
      can_be_rented: product.can_be_rented || false,
      can_be_subcontracted: product.can_be_subcontracted || false,
      is_overhead_expense: product.is_overhead_expense || false,
      is_manufacturable: product.is_manufacturable || false,
      auto_manufacture: product.auto_manufacture || false,
      tags: product.tags || [],
      // Advanced fields
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      model_number: product.model_number || '',
      upc: product.upc || '',
      ean: product.ean || '',
      isbn: product.isbn || '',
      mpn: product.mpn || '',
      weight: product.weight?.toString() || '',
      weight_unit: product.weight_unit || 'kg',
      length: product.length?.toString() || '',
      width: product.width?.toString() || '',
      height: product.height?.toString() || '',
      dimension_unit: product.dimension_unit || 'cm',
      warranty_months: product.warranty_months?.toString() || '',
      country_of_origin: product.country_of_origin || '',
      hs_code: product.hs_code || '',
      tax_class: product.tax_class || 'standard',
      has_variants: product.has_variants || false,
      variant_attributes: product.variant_attributes || [],
      variants: product.variants || [],
      bundle_items: product.bundle_items || [],
      default_supplier_id: product.default_supplier_id || '',
      supplier_sku: product.supplier_sku || '',
      lead_time_days: product.lead_time_days?.toString() || '',
      shelf_life_days: product.shelf_life_days?.toString() || '',
      storage_conditions: product.storage_conditions || '',
      requires_lot_tracking: product.requires_lot_tracking || false,
      requires_serial_tracking: product.requires_serial_tracking || false,
      image_url: product.image_url || '',
      additional_images: product.additional_images || [],
      meta_title: product.meta_title || '',
      meta_description: product.meta_description || '',
      url_slug: product.url_slug || '',
      // Units of Measure
      inventory_uom: product.unit_code || product.inventory_uom || 'unit',
      sales_uom: product.unit_code || product.sales_uom || 'unit',
      purchase_uom: product.unit_code || product.purchase_uom || 'unit',
      uom_conversion_factor: product.uom_conversion_factor?.toString() || '1',
      // Customer Lead Time
      customer_lead_time_days: product.customer_lead_time_days?.toString() || '',
      // Expiration tracking
      track_expiration: product.track_expiration || false,
      expiration_time_days: product.expiration_time_days?.toString() || '',
      use_expiration_date: product.use_expiration_date || false,
      use_best_before_date: product.use_best_before_date || false,
      removal_time_days: product.removal_time_days?.toString() || '',
      alert_time_days: product.alert_time_days?.toString() || '',
      organization_ids: product.organization_ids || [],
      inventory_type: product.inventory_type || 'trade',
    });
    setShowAdvancedFields(hasAdvancedData || product.track_expiration);
    setShowEditModal(true);
    loadEditProductData(product.id);
  };

  // Load attributes and variants for the product being edited
  const loadEditProductData = async (productId) => {
    try {
      const [attrsRes, variantsRes, allAttrsRes] = await Promise.all([
        apiClient.get(`/products/${productId}/attributes`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/product-variants?product_id=${productId}`).catch(() => ({ data: { data: [] } })),
        apiClient.get('/product-attributes').catch(() => ({ data: { data: [] } })),
      ]);
      setEditProductAttributes(attrsRes.data?.data || []);
      const variantData = variantsRes.data?.data;
      setEditProductVariants(Array.isArray(variantData) ? variantData : variantData?.items || []);
      setAllAttributes(allAttrsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load product variant data:', err);
    }
  };

  const handleAddAttrToProduct = async (attributeId, valueIds) => {
    if (!selectedProduct) return;
    try {
      await apiClient.post(`/products/${selectedProduct.id}/attributes`, {
        product_id: selectedProduct.id,
        attribute_id: attributeId,
        value_ids: valueIds,
      });
      toast({ title: t('success'), description: t('attribute_added_to_product') || 'Attribute added' });
      loadEditProductData(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateProductVariants = async () => {
    if (!selectedProduct) return;
    setIsGeneratingVariants(true);
    try {
      const response = await apiClient.post('/product-variants/generate', {
        product_id: selectedProduct.id,
      });
      const count = response.data?.data?.created_count || 0;
      toast({ title: t('success'), description: `${t('generated') || 'Generated'} ${count} ${t('variants') || 'variants'}` });
      loadEditProductData(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const handleDeleteProductVariant = async (variantId) => {
    try {
      await apiClient.delete(`/product-variants/${variantId}`);
      toast({ title: t('success'), description: t('variant_deleted') || 'Variant deleted' });
      loadEditProductData(selectedProduct.id);
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const productData = {
        ...formData,
        inventory_type: formData.inventory_type,
        cost_price: parseFloat(formData.cost_price) || 0,
        list_price: parseFloat(formData.list_price) || 0,
        min_price: parseFloat(formData.min_price) || 0,
        wholesale_price: parseFloat(formData.wholesale_price) || 0,
        has_delivery: formData.has_delivery,
        delivery_price: parseFloat(formData.delivery_price) || 0,
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        reorder_quantity: parseFloat(formData.reorder_quantity) || 0,
        weight: parseFloat(formData.weight) || null,
        length: parseFloat(formData.length) || null,
        width: parseFloat(formData.width) || null,
        height: parseFloat(formData.height) || null,
        warranty_months: parseInt(formData.warranty_months) || null,
        lead_time_days: parseInt(formData.lead_time_days) || null,
        shelf_life_days: parseInt(formData.shelf_life_days) || null,
        customer_lead_time_days: parseInt(formData.customer_lead_time_days) || null,
        expiration_time_days: parseInt(formData.expiration_time_days) || null,
        removal_time_days: parseInt(formData.removal_time_days) || null,
        alert_time_days: parseInt(formData.alert_time_days) || null,
        uom_conversion_factor: parseFloat(formData.uom_conversion_factor) || 1,
      };

      await updateProduct(selectedProduct.id, productData);
      toast({ title: t('success'), description: t('product_updated') || 'Mahsulot yangilandi' });
      resetForm();
      setSelectedProduct(null);
      setShowEditModal(false);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      const errData = error?.response?.data?.error;
      const errMsg = typeof errData === 'string' ? errData : errData?.message || error?.response?.data?.message || error.message || t('update_failed');
      toast({ title: t('error'), description: errMsg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(selectedProduct.id);
      setSelectedProduct(null);
      setShowDeleteModal(false);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleViewDetail = (product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    const categoryData = {
      code: newCategoryName.toUpperCase().replace(/\s+/g, '-').substring(0, 10),
      name: newCategoryName.trim(),
      description: '',
      parent_id: null,
      is_active: true,
      income_account_id: categoryAccounts.income_account_id || null,
      expense_account_id: categoryAccounts.expense_account_id || null,
      stock_valuation_account_id: categoryAccounts.stock_valuation_account_id || null,
      stock_input_account_id: categoryAccounts.stock_input_account_id || null,
      stock_output_account_id: categoryAccounts.stock_output_account_id || null,
    };

    createCategory(categoryData);
    setNewCategoryName('');
    setCategoryAccounts({ ...defaultCategoryAccounts });
    setShowCategoryModal(false);
  };

  const handleEditCategoryClick = (category) => {
    setSelectedCategory(category);
    setEditCategoryName(category.name);
    setCategoryAccounts({
      income_account_id: category.income_account_id || defaultCategoryAccounts.income_account_id,
      expense_account_id: category.expense_account_id || defaultCategoryAccounts.expense_account_id,
      stock_valuation_account_id: category.stock_valuation_account_id || defaultCategoryAccounts.stock_valuation_account_id,
      stock_input_account_id: category.stock_input_account_id || defaultCategoryAccounts.stock_input_account_id,
      stock_output_account_id: category.stock_output_account_id || defaultCategoryAccounts.stock_output_account_id,
    });
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = () => {
    if (!editCategoryName.trim() || !selectedCategory) return;

    updateCategory(selectedCategory.id, {
      name: editCategoryName.trim(),
      code: editCategoryName.toUpperCase().replace(/\s+/g, '-').substring(0, 10),
      income_account_id: categoryAccounts.income_account_id || '',
      expense_account_id: categoryAccounts.expense_account_id || '',
      stock_valuation_account_id: categoryAccounts.stock_valuation_account_id || '',
      stock_input_account_id: categoryAccounts.stock_input_account_id || '',
      stock_output_account_id: categoryAccounts.stock_output_account_id || '',
    });
    setEditCategoryName('');
    setCategoryAccounts({ ...defaultCategoryAccounts });
    setSelectedCategory(null);
    setShowEditCategoryModal(false);
  };

  const handleDeleteCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowDeleteCategoryModal(true);
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;

    try {
      await deleteCategory(selectedCategory.id);
      setSelectedCategory(null);
      setShowDeleteCategoryModal(false);
    } catch (err) {
      // Map backend BadRequest messages to translated toasts. The backend
      // refuses to delete a category that still has products or has child
      // categories — without this surfacing, the user just sees a silent
      // failure (toast title is generic, body lives in console).
      const backendMsg = err?.response?.data?.error?.message || '';
      let description = t('delete_category_failed') || 'Failed to delete category';
      if (backendMsg.includes('associated products')) {
        description = t('category_has_products')
          || 'This category still has products. Move them to another category before deleting.';
      } else if (backendMsg.includes('child categories')) {
        description = t('category_has_subcategories')
          || 'This category has sub-categories. Delete the sub-categories first.';
      }
      toast({
        title: t('delete_category_failed') || 'Failed to delete category',
        description,
        variant: 'destructive',
      });
      setShowDeleteCategoryModal(false);
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      product: 'bg-blue-100 text-blue-800 border-blue-200',
      service: 'bg-purple-100 text-purple-800 border-purple-200',
      bundle: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStockStatus = (product) => {
    if (!product.is_stockable) return null;
    const stock = getProductStock(product.id);
    if (stock <= 0) return { label: t('out_of_stock'), color: 'bg-red-100 text-red-800 border-red-200' };
    if (stock <= product.min_stock_level) return { label: t('low_stock'), color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: t('in_stock'), color: 'bg-green-100 text-green-800 border-green-200' };
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '-';
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* Sub-tabs for Products, Lots, Labels */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg mb-4">
          <TabsTrigger
            value="list"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Package className="w-4 h-4" />
            {t('products')}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Tag className="w-4 h-4" />
            {t('categories')}
          </TabsTrigger>
          {isLotTrackingEnabled() && (
            <TabsTrigger
              value="lots"
              className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Archive className="w-4 h-4" />
              {t('lots')}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="labels"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Printer className="w-4 h-4" />
            {t('labels')}
          </TabsTrigger>
          <TabsTrigger
            value="variants"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Layers className="w-4 h-4" />
            {t('variants')}
          </TabsTrigger>
          <TabsTrigger
            value="packages"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Boxes className="w-4 h-4" />
            {t('packages')}
          </TabsTrigger>
          <TabsTrigger
            value="package-types"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Box className="w-4 h-4" />
            {t('package_types') || 'Package Types'}
          </TabsTrigger>
          <TabsTrigger
            value="units"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Scale className="w-4 h-4" />
            {t('units_of_measure')}
          </TabsTrigger>
          <TabsTrigger
            value="reserved"
            className="flex items-center gap-2 px-4 py-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            {t('reserved') || 'Zaxiralar'}
          </TabsTrigger>
        </TabsList>

        {/* Products List Tab */}
        <TabsContent value="list" className="mt-0 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('total_products')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {summaryStats.totalProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('active')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.activeProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('products_in_stock') || 'In Stock'}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summaryStats.inStockProducts}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Box className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm ${summaryStats.lowStockProducts > 0 ? 'border-amber-200' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{t('low_stock')}</p>
                <p className={`text-2xl font-bold ${summaryStats.lowStockProducts > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {summaryStats.lowStockProducts}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${summaryStats.lowStockProducts > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                <AlertCircle className={`w-6 h-6 ${summaryStats.lowStockProducts > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Products Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader className="border-b border-slate-100 pb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--genix-blue)]/10 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {t('products_services')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {totalProducts} {t('items')}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_products')}
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 h-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px] bg-slate-50">
                    <SelectValue placeholder={t('category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_categories')}</SelectItem>
                    {categories.filter(c => !c.parent_id).map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCategoryManageModal(true)}
                  title={t('manage_categories')}
                  className="h-10 w-10"
                >
                  <Tag className="w-4 h-4" />
                </Button>
              </div>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[160px] bg-slate-50">
                  <SelectValue placeholder={t('warehouse') || 'Warehouse'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_warehouses') || 'All warehouses'}</SelectItem>
                  {(warehouses || []).filter(w => w.is_active !== false && accessibleWarehouseIds.has(w.id)).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={inventoryTypeFilter} onValueChange={setInventoryTypeFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'uz' ? 'Barcha turlar' : language === 'ru' ? 'Все типы' : 'All Types'}</SelectItem>
                  <SelectItem value="trade">{language === 'uz' ? 'Sotish uchun (1340)' : language === 'ru' ? 'Для продажи (1340)' : 'Trade (1340)'}</SelectItem>
                  <SelectItem value="raw">{language === 'uz' ? 'Xom ashyo (1310)' : language === 'ru' ? 'Сырьё (1310)' : 'Raw Material (1310)'}</SelectItem>
                  <SelectItem value="finished">{language === 'uz' ? 'Tayyor mahsulot (1330)' : language === 'ru' ? 'Готовая продукция (1330)' : 'Finished Goods (1330)'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] bg-slate-50">
                  <SelectValue placeholder={t('status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="inactive">{t('inactive')}</SelectItem>
                </SelectContent>
              </Select>
              {/* Import button — opens a small confirm modal that lets
                  the user download the template first. Picking a file
                  inside the modal triggers the body-attached singleton
                  <input type="file"> (see useEffect above). */}
              <button
                type="button"
                onClick={() => setShowImportConfirmModal(true)}
                disabled={isProductImporting}
                className="inline-flex items-center gap-2 h-9 px-3 text-sm font-medium border border-input bg-background rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {t('import') || 'Import'}
                {isProductImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </button>
              {/* Keep the export button using the original component.
                  Wrapped in handleOpenExport so we fetch the full
                  filtered product set (across pages) BEFORE opening
                  the modal — passing the visible page only would
                  silently truncate the export to ~20 rows. */}
              <ImportExportButtons
                onExport={handleOpenExport}
                isExporting={isPreparingExport}
              />
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 transition-opacity shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" /> {t('new_product')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(isLoading || productsLoading) ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[var(--genix-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 text-sm">{t('loading')}</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Package className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? t('no_products_found') || 'No products found' : t('no_products_yet') || 'No products yet'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? t('try_adjusting_search') || 'Try adjusting your search or filters'
                  : t('start_by_adding_product') || 'Start by adding your first product or service'}
              </p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-semibold text-slate-700 min-w-[200px]">{t('product')}</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">{t('category')}</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('cost')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('price')}</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('profit_margin')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right min-w-[80px] whitespace-nowrap">{t('stock')}</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700 min-w-[80px] whitespace-nowrap">{t('status')}</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center min-w-[100px] whitespace-nowrap">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    const currentStock = getProductStock(product.id);
                    return (
                      <TableRow
                        key={product.id}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                              {product.image_url ? (
                                <img src={getImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-slate-900">{product.name}</p>
                                {product.track_inventory === false && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                    {language === 'uz' ? "Kuzatilmaydi" : language === 'ru' ? "Без учёта" : "Untracked"}
                                  </Badge>
                                )}
                              </div>
                              {product.barcode && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Barcode className="w-3 h-3" /> {product.barcode}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-slate-600">
                          {getCategoryName(product.category_id)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right font-medium text-slate-700 tabular-nums">
                          {formatCurrency(product.cost_price || 0)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(product.list_price || 0)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">
                          {(() => {
                            const cost = Number(product.cost_price) || 0;
                            const price = Number(product.list_price) || 0;
                            if (cost <= 0 || price <= 0) {
                              return <span className="text-slate-400">—</span>;
                            }
                            const pct = ((price - cost) / cost) * 100;
                            const cls =
                              pct > 0
                                ? 'text-green-700 font-semibold'
                                : pct < 0
                                ? 'text-red-600 font-semibold'
                                : 'text-slate-600';
                            return (
                              <span className={cls}>
                                {pct.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.is_stockable ? (
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-slate-900 tabular-nums">
                                {currentStock}
                                {product.unit_name ? ` (${product.unit_name})` : product.unit_code ? ` (${product.unit_code})` : ''}
                              </span>
                              {stockStatus && (
                                <Badge className={`${stockStatus.color} text-xs mt-1`}>
                                  {stockStatus.label}
                                </Badge>
                              )}
                              {(() => {
                                const scrap = getProductScrapStock(product.id);
                                return scrap > 0 ? (
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs mt-1">
                                    {t('scrap')}: {scrap}
                                  </Badge>
                                ) : null;
                              })()}
                            </div>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={product.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }>
                            {product.is_active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(product)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                            </Button>
                            {canUpdate(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4 text-slate-500" />
                              </Button>
                            )}
                            {canDelete(MODULES.INVENTORY) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(product)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-slate-500">
                  {t('showing') || "Ko'rsatilmoqda"} {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalProducts)} / {totalProducts}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-0">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-xl flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      {t('product_categories')}
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      {t('manage_categories_description')}
                    </p>
                  </div>
                </div>
                {canCreate(MODULES.INVENTORY) && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCategoryImportModal(true)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t('import')}
                    </Button>
                    <Button
                      onClick={() => setShowCategoryModal(true)}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white hover:opacity-90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('add_category')}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Tag className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-medium">{t('no_categories_yet')}</p>
                  <p className="text-sm">{t('add_first_category')}</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-semibold text-slate-700">{t('category_name')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('code')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('description')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">{t('products_count')}</TableHead>
                        <TableHead className="font-semibold text-slate-700">{t('status')}</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => {
                        // Use the backend-supplied tenant-wide count rather
                        // than filtering the org-scoped `products` array.
                        // The local count missed products in sibling orgs,
                        // which made the delete-category guard refuse rows
                        // the UI claimed had "0 mahsulotlar".
                        const productCount = category.product_count
                          ?? products.filter(p => p.category_id === category.id).length;
                        return (
                          <TableRow key={category.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                                  <Tag className="w-4 h-4 text-blue-600" />
                                </div>
                                {category.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 font-mono text-xs">
                                {category.code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600 max-w-[200px] truncate">
                              {category.description || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={productCount > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}>
                                {productCount} {t('products').toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={category.is_active !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {category.is_active !== false ? t('active') : t('inactive')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canUpdate(MODULES.INVENTORY) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCategoryClick(category)}
                                    className="h-8 w-8 p-0 hover:bg-blue-50"
                                  >
                                    <Pencil className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                                  </Button>
                                )}
                                {canDelete(MODULES.INVENTORY) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCategoryClick(category)}
                                    className="h-8 w-8 p-0 hover:bg-red-50"
                                    disabled={productCount > 0}
                                  >
                                    <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                  </Button>
                                )}
                              </div>
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
        </TabsContent>

        {/* Lots Tab */}
        <TabsContent value="lots" className="mt-0">
          <LotTracking />
        </TabsContent>

        {/* Labels Tab */}
        <TabsContent value="labels" className="mt-0">
          <PriceLabelPrinting />
        </TabsContent>

        {/* Variants Tab */}
        <TabsContent value="variants" className="mt-0">
          <ProductVariants />
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="mt-0">
          <Packages />
        </TabsContent>

        {/* Package Types Tab */}
        <TabsContent value="package-types" className="mt-0">
          <PackageTypes />
        </TabsContent>


        {/* Units of Measure Tab */}
        <TabsContent value="units" className="mt-0">
          <UnitsOfMeasure />
        </TabsContent>
        <TabsContent value="reserved" className="mt-0">
          <MaterialReservations />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Product Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
        if (!open) {
          setShowCreateModal(false);
          setShowEditModal(false);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              {showEditModal ? t('edit_product') : t('new_product')}
            </DialogTitle>
            <DialogDescription>
              {showEditModal ? t('update_product_info') : t('add_product_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Product Image */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('product_image') || 'Product Image'}</h4>
              <div className="flex items-start gap-4">
                {formData.image_url ? (
                  <div className="relative">
                    <img
                      src={getImageUrl(formData.image_url)}
                      alt={formData.name || 'Product'}
                      className="w-28 h-28 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, image_url: ''})}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="w-28 h-28 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">{t('upload') || 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const res = await apiClient.post('/files/upload', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          const url = res.data?.data?.url || res.data?.url;
                          if (url) setFormData({...formData, image_url: url});
                        } catch (err) {
                          console.error('Image upload failed:', err);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('basic_information')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('name')}
                    required
                    helpText={t('help_product_name') || "Mahsulot nomi sotuvda va hisobotlarda ko'rsatiladi"}
                  />
                  <Input
                    placeholder={t('product_name_placeholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <LabelWithHelp
                    label={t('type')}
                    required
                    helpText={t('help_product_type') || "Mahsulot - omborda saqlanadi. Xizmat - omborda saqlanmaydi. To'plam - bir nechta mahsulotlardan tashkil topgan"}
                  />
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      type: value,
                      is_stockable: value === 'product',
                      track_inventory: value === 'product',
                      bundle_items: value === 'bundle' ? formData.bundle_items : [],
                      inventory_type: value === 'service' ? 'service' : (value === 'product' ? 'trade' : formData.inventory_type)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">{t('product')}</SelectItem>
                      <SelectItem value="service">{t('service')}</SelectItem>
                      <SelectItem value="bundle">{t('bundle')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === 'product' && (
                  <div>
                    <LabelWithHelp
                      label="Tovar turi (buxgalteriya)"
                      helpText="Xom ashyo (1310), Sotish uchun (1340), Tayyor mahsulot (1330)"
                    />
                    <Select
                      value={formData.inventory_type}
                      onValueChange={(value) => setFormData({...formData, inventory_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trade">Sotish uchun tovar (1340)</SelectItem>
                        <SelectItem value="raw">Xom ashyo (1310)</SelectItem>
                        <SelectItem value="finished">Tayyor mahsulot (1330)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <LabelWithHelp
                    label={t('barcode')}
                    helpText={t('help_barcode') || "Mahsulotning shtrix-kodi. Skaner yordamida tez qidirish uchun ishlatiladi"}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="EAN-13"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="EAN-13 avtomatik yaratish"
                      onClick={() => setFormData({...formData, barcode: generateEAN13()})}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.barcode && isValidEAN13(formData.barcode) && (
                    <div className="mt-2 p-3 bg-white border rounded-lg flex flex-col items-center">
                      <EAN13Barcode code={formData.barcode} width={220} height={55} />
                      <span className="text-[10px] text-slate-400 mt-1">EAN-13</span>
                    </div>
                  )}
                  {formData.barcode && formData.barcode.length > 0 && !isValidEAN13(formData.barcode) && (
                    <p className="text-xs text-amber-500 mt-1">EAN-13 formatida emas (13 ta raqam kerak)</p>
                  )}
                </div>
                <div>
                  <LabelWithHelp
                    label={t('search_key') || 'Qidiruv kaliti'}
                    helpText={t('help_search_key') || "Kompaniyalararo bir xil materialni bog'laydi. Qurilish kompaniyasi smetadagi nomi bilan kiritsa, ishlab chiqaruvchi o'z nomi bilan sotadi — lekin kalit bir xil bo'lgani uchun tizim bog'laydi."}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Masalan: PK59106SHVC8"
                      value={formData.search_key}
                      onChange={(e) => setFormData({...formData, search_key: e.target.value.toUpperCase()})}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t('generate_search_key') || "Nomdan avtomatik yaratish"}
                      onClick={() => {
                        const name = formData.name || '';
                        let key = '';
                        for (const ch of name) {
                          if (/[\p{L}\p{N}]/u.test(ch)) key += ch.toUpperCase();
                          if (key.length >= 32) break;
                        }
                        setFormData({...formData, search_key: key});
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.search_key && (
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{formData.search_key}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <LabelWithHelp
                    label={t('category')}
                    helpText={t('help_category') || "Mahsulotlar kategoriyasi. Hisobotlar va filtrlar uchun ishlatiladi"}
                  />
                  <div className="flex gap-2">
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({...formData, category_id: value})}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('select_category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canCreate(MODULES.INVENTORY) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowCategoryModal(true)}
                        title={t('add_category')}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <LabelWithHelp
                  label={t('tags')}
                  helpText={t('help_tags') || "Teglar mahsulotlarni guruhlash va qidirish uchun ishlatiladi"}
                />
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50 min-h-[42px]">
                  {(formData.tags || []).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-700 px-2 py-1 flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = formData.tags.filter((_, i) => i !== index);
                          setFormData({...formData, tags: newTags});
                        }}
                        className="ml-1 hover:text-red-500"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    placeholder={t('add_tag_placeholder') || "Teg qo'shish (Enter bosing)"}
                    className="border-0 bg-transparent p-0 h-6 min-w-[120px] flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        const newTag = e.target.value.trim();
                        if (!formData.tags?.includes(newTag)) {
                          setFormData({...formData, tags: [...(formData.tags || []), newTag]});
                        }
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('tags_hint') || "Teglarni qo'shish uchun yozing va Enter bosing"}</p>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-700 mb-1 block">{t('description')}</label>
                <Textarea
                  placeholder={t('product_description_placeholder')}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                />
              </div>

              {/* Bundle Items - Only show when type is 'bundle' */}
              {formData.type === 'bundle' && (
                <div className="mt-4 p-4 border border-orange-200 rounded-lg bg-orange-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-orange-600" />
                      {t('bundle_items') || "To'plam tarkibi"}
                    </h4>
                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                      {formData.bundle_items?.length || 0} {t('items') || "element"}
                    </Badge>
                  </div>

                  {/* Bundle items list */}
                  {formData.bundle_items && formData.bundle_items.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.bundle_items.map((item, index) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {product?.name || item.product_name || t('unknown_product')}
                              </p>
                              <p className="text-xs text-slate-500">
                                {t('price')}: {formatCurrency(product?.list_price || 0)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...formData.bundle_items];
                                  newItems[index].quantity = parseInt(e.target.value) || 1;
                                  setFormData({...formData, bundle_items: newItems});
                                }}
                                className="w-16 h-8 text-center text-sm"
                              />
                              <span className="text-xs text-slate-500">{t('qty') || 'dona'}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newItems = formData.bundle_items.filter((_, i) => i !== index);
                                  setFormData({...formData, bundle_items: newItems});
                                }}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add product to bundle */}
                  <div className="flex gap-2">
                    <Select
                      value=""
                      onValueChange={(productId) => {
                        if (productId && !formData.bundle_items?.some(item => item.product_id === productId)) {
                          const product = products.find(p => p.id === productId);
                          setFormData({
                            ...formData,
                            bundle_items: [
                              ...(formData.bundle_items || []),
                              { product_id: productId, quantity: 1, product_name: product?.name || '' }
                            ]
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t('select_product_to_add') || "Mahsulot qo'shish..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {products
                          .filter(p => p.type !== 'bundle' && p.is_active && !formData.bundle_items?.some(item => item.product_id === p.id))
                          .map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex items-center gap-2">
                                <span>{product.name}</span>
                                <span className="text-slate-500">- {formatCurrency(product.list_price || 0)}</span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bundle price summary */}
                  {formData.bundle_items && formData.bundle_items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-orange-200">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{t('total_items_price') || "Elementlar narxi jami"}:</span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(formData.bundle_items.reduce((sum, item) => {
                            const product = products.find(p => p.id === item.product_id);
                            return sum + ((product?.list_price || 0) * (item.quantity || 1));
                          }, 0))}
                        </span>
                      </div>
                      <p className="text-xs text-orange-600 mt-1">
                        {t('bundle_price_hint') || "To'plam narxini quyida alohida belgilashingiz mumkin"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Companies */}
            {companies.length > 1 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">{t('companies')}</h4>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-left font-normal">
                      <span className="truncate">
                        {formData.organization_ids.length === 0
                          ? t('select_companies_hint')
                          : formData.organization_ids.length === companies.length
                            ? t('all_companies') || 'All companies'
                            : companies.filter(c => formData.organization_ids.includes(c.id)).map(c => c.company_name).join(', ')
                        }
                      </span>
                      <ChevronDown className="w-4 h-4 ml-2 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent noPortal className="w-[--radix-popover-trigger-width] p-2" align="start">
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer"
                      onClick={() => {
                        const allSelected = formData.organization_ids.length === companies.length;
                        setFormData(prev => ({
                          ...prev,
                          organization_ids: allSelected ? [] : companies.map(c => c.id)
                        }));
                      }}
                    >
                      <Checkbox checked={formData.organization_ids.length === companies.length} />
                      <span className="text-sm font-medium">{t('select_all') || 'Select all'}</span>
                    </div>
                    <div className="border-t my-1" />
                    <div className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain">
                      {companies.map(company => {
                        const isActive = activeCompany?.id === company.id;
                        return (
                          <div
                            key={company.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 cursor-pointer ${isActive ? 'bg-blue-50' : ''}`}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                organization_ids: prev.organization_ids.includes(company.id)
                                  ? prev.organization_ids.filter(id => id !== company.id)
                                  : [...prev.organization_ids, company.id]
                              }));
                            }}
                          >
                            <Checkbox checked={formData.organization_ids.includes(company.id)} />
                            <span className="text-sm">{company.company_name}</span>
                            {isActive && <span className="text-xs text-blue-600 ml-auto">{t('current') || 'joriy'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                {formData.organization_ids.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">{t('no_companies_selected_warning')}</p>
                )}
              </div>
            )}

            {/* Pricing */}
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">{t('pricing')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <LabelWithHelp
                    label={t('cost_price')}
                    helpText={t('help_cost_price')}
                  />
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="pr-14"
                      value={formatPriceDisplay(formData.cost_price)}
                      onChange={(e) => handlePriceChange('cost_price', e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">{currency_symbol}</span>
                  </div>
                </div>
                <div>
                  <LabelWithHelp
                    label={t('list_price')}
                    required
                    helpText={t('help_list_price')}
                  />
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="pr-14"
                      value={formatPriceDisplay(formData.list_price)}
                      onChange={(e) => handlePriceChange('list_price', e.target.value)}
                      required
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">{currency_symbol}</span>
                  </div>
                </div>
              </div>

              {/* Delivery price */}
              <div className="mt-4 flex items-start gap-3">
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="has_delivery"
                    checked={formData.has_delivery}
                    onChange={(e) => setFormData({...formData, has_delivery: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                  <label htmlFor="has_delivery" className="text-sm font-medium text-slate-700 cursor-pointer whitespace-nowrap">
                    {t('has_delivery') || 'Yetkazib berish bor'}
                  </label>
                </div>
                {formData.has_delivery && (
                  <div className="flex-1">
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        className="pr-14"
                        value={formatPriceDisplay(formData.delivery_price)}
                        onChange={(e) => handlePriceChange('delivery_price', e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">{currency_symbol}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{t('delivery_price_desc') || 'Yetkazib berish narxi'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Settings */}
            {formData.type === 'product' && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">{t('inventory_settings')}</h4>
                <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">
                      {language === 'uz' ? "Miqdorni kuzatish" : language === 'ru' ? "Отслеживать количество" : "Track Inventory"}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {language === 'uz'
                        ? "O'chirilganda miqdor omborda kamaytirilmaydi (suv, gaz kabi cheksiz ta'minotlar)"
                        : language === 'ru'
                        ? "При отключении количество не списывается со склада (вода, газ — бесконечное снабжение)"
                        : "When off, quantity is never deducted from inventory (water, gas — infinite supply)"}
                    </p>
                  </div>
                  <Switch
                    checked={formData.track_inventory !== false}
                    onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <LabelWithHelp
                      label={t('min_stock_level')}
                      helpText={t('help_min_stock') || "Minimal zaxira miqdori. Omborda shu miqdordan kam bo'lmasligi kerak"}
                    />
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label={t('reorder_point')}
                      helpText={t('help_reorder_point') || "Qayta buyurtma nuqtasi. Zaxira shu miqdorga tushganda ogohlantirish beriladi"}
                    />
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.reorder_point}
                      onChange={(e) => setFormData({...formData, reorder_point: e.target.value})}
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label={t('reorder_qty')}
                      helpText={t('help_reorder_qty') || "Qayta buyurtma miqdori. Avtomatik buyurtmada tavsiya etiladigan miqdor"}
                    />
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.reorder_quantity}
                      onChange={(e) => setFormData({...formData, reorder_quantity: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_manufacturable}
                      onCheckedChange={(checked) => setFormData({...formData, is_manufacturable: checked, auto_manufacture: checked ? formData.auto_manufacture : false})}
                    />
                    <span className="text-sm text-slate-700 flex items-center">
                      {t('is_manufacturable')}
                      <FieldHelp text={t('help_is_manufacturable')} />
                    </span>
                  </div>
                  {formData.is_manufacturable && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.auto_manufacture}
                        onCheckedChange={(checked) => setFormData({...formData, auto_manufacture: checked})}
                      />
                      <span className="text-sm text-slate-700 flex items-center">
                        {t('auto_manufacture')}
                        <FieldHelp text={t('help_auto_manufacture')} />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Weight & Dimensions */}
            {formData.type === 'product' && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">{t('weight_dimensions') || 'Weight & Dimensions'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('weight') || 'Weight'}</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.weight}
                      onChange={(e) => setFormData({...formData, weight: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('unit_of_measure') || 'Unit of Measure'}</label>
                    <Select
                      value={formData.inventory_uom}
                      onValueChange={(value) => setFormData({...formData, inventory_uom: value, sales_uom: value, purchase_uom: value, weight_unit: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {uomList.map(u => (
                          <SelectItem key={u.code} value={u.code}>{u.name} ({u.code})</SelectItem>
                        ))}
                        {uomList.length === 0 && (
                          <SelectItem value="unit">Unit</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('length') || 'Length'}</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.length}
                      onChange={(e) => setFormData({...formData, length: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('width') || 'Width'}</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.width}
                      onChange={(e) => setFormData({...formData, width: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">{t('height') || 'Height'}</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.height}
                      onChange={(e) => setFormData({...formData, height: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Module Visibility */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {t('module_visibility') || "Modul ko'rinishi"}
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {t('module_visibility_desc') || "Mahsulot qaysi modullarda ko'rinishini belgilang"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_sold"
                    checked={formData.can_be_sold}
                    onChange={(e) => setFormData({...formData, can_be_sold: e.target.checked, is_sellable: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="can_be_sold" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <ShoppingCart className="w-4 h-4 mr-1 text-blue-500" />
                    {t('sales') || 'Sotish'}
                    <FieldHelp text={t('help_can_be_sold') || "Bu mahsulot Sotish modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_purchased"
                    checked={formData.can_be_purchased}
                    onChange={(e) => setFormData({...formData, can_be_purchased: e.target.checked, is_purchasable: e.target.checked})}
                    className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                  />
                  <label htmlFor="can_be_purchased" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <Archive className="w-4 h-4 mr-1 text-green-500" />
                    {t('purchase') || 'Sotib olish'}
                    <FieldHelp text={t('help_can_be_purchased') || "Bu mahsulot Sotib olish modulida ko'rinadi"} />
                  </label>
                </div>
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_be_expensed"
                    checked={formData.can_be_expensed}
                    onChange={(e) => setFormData({...formData, can_be_expensed: e.target.checked})}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <label htmlFor="can_be_expensed" className="text-sm text-slate-700 flex items-center cursor-pointer">
                    <DollarSign className="w-4 h-4 mr-1 text-orange-500" />
                    {t('expenses') || 'Xarajatlar'}
                    <FieldHelp text={t('help_can_be_expensed') || "Bu mahsulot Xarajatlar modulida ko'rinadi"} />
                  </label>
                </div>
              </div>
            </div>

            {/* Advanced Fields Toggle */}
            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--genix-blue)] hover:text-[var(--genix-purple)] transition-colors"
              >
                {showAdvancedFields ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    {t('hide_advanced_fields') || 'Hide Advanced Fields'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {t('show_advanced_fields') || 'Show Advanced Fields'}
                  </>
                )}
              </button>
            </div>

            {/* Advanced Fields Section */}
            {showAdvancedFields && (
              <>
                {/* Additional Module Visibility */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('additional_modules') || "Qo'shimcha modullar"}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="available_in_pos"
                        checked={formData.available_in_pos}
                        onChange={(e) => setFormData({...formData, available_in_pos: e.target.checked})}
                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                      />
                      <label htmlFor="available_in_pos" className="text-sm text-slate-700 flex items-center cursor-pointer">
                        <Printer className="w-4 h-4 mr-1 text-purple-500" />
                        {t('pos') || 'Savdo nuqtasi'}
                        <FieldHelp text={t('help_available_in_pos') || "Bu mahsulot POS (Savdo nuqtasi) modulida ko'rinadi"} />
                      </label>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-cyan-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="can_be_rented"
                        checked={formData.can_be_rented}
                        onChange={(e) => setFormData({...formData, can_be_rented: e.target.checked})}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                      />
                      <label htmlFor="can_be_rented" className="text-sm text-slate-700 flex items-center cursor-pointer">
                        <History className="w-4 h-4 mr-1 text-cyan-500" />
                        {t('rental') || 'Ijara'}
                        <FieldHelp text={t('help_can_be_rented') || "Bu mahsulot Ijara modulida ko'rinadi"} />
                      </label>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="can_be_subcontracted"
                        checked={formData.can_be_subcontracted}
                        onChange={(e) => setFormData({...formData, can_be_subcontracted: e.target.checked})}
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                      />
                      <label htmlFor="can_be_subcontracted" className="text-sm text-slate-700 flex items-center cursor-pointer">
                        <Layers className="w-4 h-4 mr-1 text-red-500" />
                        {t('subcontracting') || 'Subpudrat'}
                        <FieldHelp text={t('help_can_be_subcontracted') || "Bu mahsulot Ishlab chiqarish modulida subpudrat sifatida ishlatiladi"} />
                      </label>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="is_overhead_expense"
                        checked={formData.is_overhead_expense}
                        onChange={(e) => setFormData({...formData, is_overhead_expense: e.target.checked})}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                      />
                      <label htmlFor="is_overhead_expense" className="text-sm text-slate-700 flex items-center cursor-pointer">
                        <Truck className="w-4 h-4 mr-1 text-amber-500" />
                        {t('overhead_expense') || 'Nakladnoy xarajat'}
                        <FieldHelp text={t('help_is_overhead_expense') || "Bu mahsulot nakladnoy xarajatlar (transport, bojxona, yuk tashish) sifatida ishlatiladi"} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Brand & Manufacturer */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('brand_manufacturer') || 'Brand & Manufacturer'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('brand') || 'Brand'}</label>
                      <Input
                        placeholder={t('brand_placeholder') || 'e.g., Samsung, Apple'}
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('manufacturer') || 'Manufacturer'}</label>
                      <Input
                        placeholder={t('manufacturer_placeholder') || 'e.g., Samsung Electronics'}
                        value={formData.manufacturer}
                        onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('model_number') || 'Model Number'}</label>
                      <Input
                        placeholder={t('model_placeholder') || 'e.g., SM-G998B'}
                        value={formData.model_number}
                        onChange={(e) => setFormData({...formData, model_number: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('mpn') || 'MPN (Manufacturer Part Number)'}</label>
                      <Input
                        placeholder={t('mpn_placeholder') || 'Manufacturer part number'}
                        value={formData.mpn}
                        onChange={(e) => setFormData({...formData, mpn: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Identifiers */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('additional_identifiers') || 'Additional Identifiers'}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('upc') || 'UPC'}</label>
                      <Input
                        placeholder="012345678901"
                        value={formData.upc}
                        onChange={(e) => setFormData({...formData, upc: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('ean') || 'EAN'}</label>
                      <Input
                        placeholder="0123456789012"
                        value={formData.ean}
                        onChange={(e) => setFormData({...formData, ean: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('isbn') || 'ISBN'}</label>
                      <Input
                        placeholder="978-0-123456-47-2"
                        value={formData.isbn}
                        onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Product Variants */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {t('product_variants') || 'Product Variants'}
                    <Badge className="bg-blue-100 text-blue-700 text-xs">{t('optional') || 'Optional'}</Badge>
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.has_variants}
                        onCheckedChange={(checked) => setFormData({...formData, has_variants: checked})}
                      />
                      <span className="text-sm text-slate-700">{t('this_product_has_variants') || 'This product has variants (e.g., Size, Color)'}</span>
                    </div>

                    {formData.has_variants && (
                      <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        {/* Added variant attributes */}
                        {formData.variant_attributes.length > 0 && (
                          <div className="space-y-2">
                            {formData.variant_attributes.map((attr, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                                <div className="flex-1">
                                  <span className="font-medium text-slate-700">{attr.name}:</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {attr.values.map((val, vi) => (
                                      <Badge key={vi} variant="secondary" className="text-xs">
                                        {val.name}
                                        {val.price_extra > 0 && (
                                          <span className="text-green-600 ml-1">+{val.price_extra}</span>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newAttrs = formData.variant_attributes.filter((_, i) => i !== index);
                                    setFormData({...formData, variant_attributes: newAttrs});
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Select existing attribute or create new */}
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Select
                                value={selectedAttributeId}
                                onValueChange={(val) => {
                                  setSelectedAttributeId(val);
                                  setSelectedValueIds([]);
                                  setShowAddValue(false);
                                  setNewValueName('');
                                  setNewValuePriceExtra('');
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('select_attribute')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {backendAttributes
                                    .filter(a => !formData.variant_attributes.some(va => va.attribute_id === a.id))
                                    .map(attr => (
                                      <SelectItem key={attr.id} value={attr.id}>
                                        {attr.name} ({(attr.values || []).length})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const attr = backendAttributes.find(a => a.id === selectedAttributeId);
                                if (attr && selectedValueIds.length > 0) {
                                  const selectedValues = (attr.values || []).filter(v => selectedValueIds.includes(v.id));
                                  setFormData({
                                    ...formData,
                                    variant_attributes: [
                                      ...formData.variant_attributes,
                                      {
                                        attribute_id: attr.id,
                                        name: attr.name,
                                        values: selectedValues.map(v => ({ id: v.id, name: v.name, price_extra: v.price_extra || 0 }))
                                      }
                                    ]
                                  });
                                  setSelectedAttributeId('');
                                  setSelectedValueIds([]);
                                }
                              }}
                              disabled={!selectedAttributeId || selectedValueIds.length === 0}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              {t('add_attribute')}
                            </Button>
                          </div>

                          {/* Show values of selected attribute */}
                          {selectedAttributeId && (() => {
                            const attr = backendAttributes.find(a => a.id === selectedAttributeId);
                            const values = attr?.values || [];
                            return (
                              <div className="bg-white border rounded-lg p-3 space-y-3">
                                {values.length > 0 && (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-slate-700">{t('select_values')}:</p>
                                      <button
                                        type="button"
                                        className="text-xs text-blue-600 hover:underline"
                                        onClick={() => setSelectedValueIds(
                                          selectedValueIds.length === values.length ? [] : values.map(v => v.id)
                                        )}
                                      >
                                        {selectedValueIds.length === values.length ? t('deselect_all') : t('select_all')}
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {values.map(val => {
                                        const isSelected = selectedValueIds.includes(val.id);
                                        return (
                                          <button
                                            key={val.id}
                                            type="button"
                                            onClick={() => setSelectedValueIds(
                                              isSelected
                                                ? selectedValueIds.filter(id => id !== val.id)
                                                : [...selectedValueIds, val.id]
                                            )}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                              isSelected
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                          >
                                            {val.html_color && (
                                              <span
                                                className="inline-block w-3 h-3 rounded-full mr-1.5 border border-slate-300"
                                                style={{ backgroundColor: val.html_color }}
                                              />
                                            )}
                                            {val.name}
                                            {val.price_extra > 0 && (
                                              <span className="text-green-600 ml-1 text-xs">+{val.price_extra}</span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                                {values.length === 0 && (
                                  <p className="text-xs text-slate-500">{t('no_values')}</p>
                                )}
                                {/* Add new value inline */}
                                {!showAddValue ? (
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                    onClick={() => setShowAddValue(true)}
                                  >
                                    <Plus className="w-3 h-3" />
                                    {t('add_value')}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 pt-1 border-t">
                                    <Input
                                      className="h-8 text-sm"
                                      placeholder={t('value_placeholder')}
                                      value={newValueName}
                                      onChange={(e) => setNewValueName(e.target.value)}
                                    />
                                    <Input
                                      className="h-8 text-sm w-28"
                                      placeholder={t('price_extra')}
                                      type="text"
                                      inputMode="decimal"
                                      value={formatPriceInput(newValuePriceExtra)}
                                      onChange={(e) => setNewValuePriceExtra(parsePriceInput(e.target.value))}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 shrink-0"
                                      onClick={handleAddValueToAttribute}
                                      disabled={!newValueName.trim() || isAddingValue}
                                    >
                                      {isAddingValue ? '...' : t('add')}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 shrink-0"
                                      onClick={() => { setShowAddValue(false); setNewValueName(''); setNewValuePriceExtra(''); }}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Create new attribute inline */}
                          {!showCreateAttribute ? (
                            <button
                              type="button"
                              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                              onClick={() => setShowCreateAttribute(true)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {t('create_new_attribute')}
                            </button>
                          ) : (
                            <div className="bg-white border rounded-lg p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-700">{t('create_new_attribute')}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setShowCreateAttribute(false); setNewAttrName(''); setNewAttrInlineValues([]); setNewAttrValName(''); setNewAttrValPrice(''); }}
                                  className="h-6 w-6 p-0"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                              <Input
                                placeholder={t('attribute_name') || 'Attribute'}
                                value={newAttrName}
                                onChange={(e) => setNewAttrName(e.target.value)}
                              />
                              {/* Added values list */}
                              {newAttrInlineValues.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {newAttrInlineValues.map((v, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs gap-1">
                                      {v.name}
                                      {v.price_extra > 0 && <span className="text-green-600">+{v.price_extra}</span>}
                                      <button
                                        type="button"
                                        onClick={() => setNewAttrInlineValues(newAttrInlineValues.filter((_, idx) => idx !== i))}
                                        className="ml-0.5 text-slate-400 hover:text-red-500"
                                      >×</button>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {/* Add value row */}
                              <div className="flex items-center gap-2">
                                <Input
                                  className="h-8 text-sm"
                                  placeholder={t('value_name') || 'Value'}
                                  value={newAttrValName}
                                  onChange={(e) => setNewAttrValName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newAttrValName.trim()) {
                                      e.preventDefault();
                                      setNewAttrInlineValues([...newAttrInlineValues, { name: newAttrValName.trim(), price_extra: parseFloat(newAttrValPrice) || 0 }]);
                                      setNewAttrValName('');
                                      setNewAttrValPrice('');
                                    }
                                  }}
                                />
                                <Input
                                  className="h-8 text-sm w-28"
                                  placeholder={t('price_extra')}
                                  type="text"
                                  inputMode="decimal"
                                  value={formatPriceInput(newAttrValPrice)}
                                  onChange={(e) => setNewAttrValPrice(parsePriceInput(e.target.value))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newAttrValName.trim()) {
                                      e.preventDefault();
                                      setNewAttrInlineValues([...newAttrInlineValues, { name: newAttrValName.trim(), price_extra: parseFloat(newAttrValPrice) || 0 }]);
                                      setNewAttrValName('');
                                      setNewAttrValPrice('');
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 shrink-0"
                                  onClick={() => {
                                    if (newAttrValName.trim()) {
                                      setNewAttrInlineValues([...newAttrInlineValues, { name: newAttrValName.trim(), price_extra: parseFloat(newAttrValPrice) || 0 }]);
                                      setNewAttrValName('');
                                      setNewAttrValPrice('');
                                    }
                                  }}
                                  disabled={!newAttrValName.trim()}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleCreateInlineAttribute}
                                disabled={!newAttrName.trim() || newAttrInlineValues.length === 0 || isCreatingAttr}
                              >
                                {isCreatingAttr ? t('creating') : t('create_attribute')}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Variant preview */}
                        {formData.variant_attributes.length > 0 && (
                          <div className="text-sm text-slate-600 bg-white border rounded-lg p-3">
                            <p className="font-medium mb-1">{t('variants_will_be_generated')}</p>
                            <p className="text-xs text-slate-500">
                              {formData.variant_attributes.reduce((acc, attr) => acc * attr.values.length, 1)} {t('variants_total')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Product Info */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('additional_info') || 'Additional Information'}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('warranty_months') || 'Warranty (Months)'}</label>
                      <Input
                        type="number"
                        placeholder="12"
                        value={formData.warranty_months}
                        onChange={(e) => setFormData({...formData, warranty_months: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('country_of_origin') || 'Country of Origin'}</label>
                      <Input
                        placeholder={t('country_placeholder') || 'e.g., China, USA'}
                        value={formData.country_of_origin}
                        onChange={(e) => setFormData({...formData, country_of_origin: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('hs_code') || 'HS Code (Customs)'}</label>
                      <Input
                        placeholder="8471.30.00"
                        value={formData.hs_code}
                        onChange={(e) => setFormData({...formData, hs_code: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('tax_class') || 'Tax Class'}</label>
                      <Select
                        value={formData.tax_class}
                        onValueChange={(value) => setFormData({...formData, tax_class: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">{t('standard') || 'Standard'}</SelectItem>
                          <SelectItem value="reduced">{t('reduced') || 'Reduced'}</SelectItem>
                          <SelectItem value="zero">{t('zero_rate') || 'Zero Rate'}</SelectItem>
                          <SelectItem value="exempt">{t('tax_exempt') || 'Tax Exempt'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('lead_time_days') || 'Lead Time (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="7"
                        value={formData.lead_time_days}
                        onChange={(e) => setFormData({...formData, lead_time_days: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('shelf_life_days') || 'Shelf Life (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="365"
                        value={formData.shelf_life_days}
                        onChange={(e) => setFormData({...formData, shelf_life_days: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Storage & Tracking */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('storage_tracking') || 'Storage & Tracking'}</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('storage_conditions') || 'Storage Conditions'}</label>
                      <Input
                        placeholder={t('storage_placeholder') || 'e.g., Keep in cool, dry place'}
                        value={formData.storage_conditions}
                        onChange={(e) => setFormData({...formData, storage_conditions: e.target.value})}
                      />
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.requires_lot_tracking}
                          onCheckedChange={(checked) => setFormData({...formData, requires_lot_tracking: checked})}
                        />
                        <span className="text-sm text-slate-700">{t('requires_lot_tracking') || 'Requires Lot/Batch Tracking'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.requires_serial_tracking}
                          onCheckedChange={(checked) => setFormData({...formData, requires_serial_tracking: checked})}
                        />
                        <span className="text-sm text-slate-700">{t('requires_serial_tracking') || 'Requires Serial Number Tracking'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wholesale Price */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('wholesale_pricing') || 'Wholesale Pricing'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('wholesale_price') || 'Wholesale Price'}</label>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          className="pr-14"
                          value={formatPriceDisplay(formData.wholesale_price)}
                          onChange={(e) => handlePriceChange('wholesale_price', e.target.value)}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">{currency_symbol}</span>
                      </div>
                    </div>
                  </div>
                </div>


                {/* Customer Lead Time */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">{t('delivery_lead_times') || 'Delivery & Lead Times'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('customer_lead_time') || 'Customer Lead Time (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="3"
                        value={formData.customer_lead_time_days}
                        onChange={(e) => setFormData({...formData, customer_lead_time_days: e.target.value})}
                      />
                      <p className="text-xs text-slate-500 mt-1">{t('customer_lead_time_desc') || 'Delivery time to customer from order'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">{t('supplier_lead_time') || 'Supplier Lead Time (Days)'}</label>
                      <Input
                        type="number"
                        placeholder="7"
                        value={formData.lead_time_days}
                        onChange={(e) => setFormData({...formData, lead_time_days: e.target.value})}
                      />
                      <p className="text-xs text-slate-500 mt-1">{t('supplier_lead_time_desc') || 'Time to receive from supplier'}</p>
                    </div>
                  </div>
                </div>

                {/* Expiration Tracking (Odoo-style) */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    {t('expiration_tracking') || 'Expiration & Best Before'}
                    <Badge className="bg-red-100 text-red-700 text-xs">{t('perishable') || 'Perishable'}</Badge>
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.track_expiration}
                        onCheckedChange={(checked) => setFormData({...formData, track_expiration: checked})}
                      />
                      <span className="text-sm text-slate-700">{t('enable_expiration_tracking') || 'Enable expiration date tracking for this product'}</span>
                    </div>

                    {formData.track_expiration && (
                      <div className="bg-red-50 p-4 rounded-lg space-y-4">
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={formData.use_expiration_date}
                              onCheckedChange={(checked) => setFormData({...formData, use_expiration_date: checked})}
                            />
                            <span className="text-sm text-slate-700">{t('use_expiration_date') || 'Use Expiration Date'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={formData.use_best_before_date}
                              onCheckedChange={(checked) => setFormData({...formData, use_best_before_date: checked})}
                            />
                            <span className="text-sm text-slate-700">{t('use_best_before_date') || 'Use Best Before Date'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('expiration_time') || 'Expiration Time (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="365"
                              value={formData.expiration_time_days}
                              onChange={(e) => setFormData({...formData, expiration_time_days: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t('from_production') || 'From production/receipt'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('best_before_time') || 'Best Before (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="300"
                              value={formData.shelf_life_days}
                              onChange={(e) => setFormData({...formData, shelf_life_days: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('removal_time') || 'Removal Time (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="30"
                              value={formData.removal_time_days}
                              onChange={(e) => setFormData({...formData, removal_time_days: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t('before_expiration') || 'Before expiration'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-700 mb-1 block">{t('alert_time') || 'Alert Time (Days)'}</label>
                            <Input
                              type="number"
                              placeholder="60"
                              value={formData.alert_time_days}
                              onChange={(e) => setFormData({...formData, alert_time_days: e.target.value})}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t('show_warning') || 'Show warning'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Attributes & Variants Section - Only in Edit Mode */}
            {showEditModal && (
              <div className="border-t border-slate-200 pt-6">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--genix-purple)]" />
                  {t('attributes_and_variants') || "Atributlar va variantlar"}
                </h4>

                {/* Currently configured attributes */}
                {editProductAttributes.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {editProductAttributes.map(pa => {
                      const fullAttr = allAttributes.find(a => a.id === pa.attribute_id);
                      const configuredValueIds = (pa.values || []).map(v => v.value_id);
                      const missingValues = fullAttr?.values?.filter(v => !configuredValueIds.includes(v.id)) || [];

                      return (
                        <div key={pa.pta_id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="font-medium text-sm text-slate-700">{pa.attribute_name}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {pa.values?.map(v => (
                              <Badge key={v.ptav_id} variant="outline" className="text-xs">
                                {v.html_color && (
                                  <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: v.html_color }} />
                                )}
                                {v.value_name}
                                {v.price_extra > 0 && ` (+${formatCurrency(v.price_extra)})`}
                              </Badge>
                            ))}
                          </div>
                          {/* Add missing values */}
                          {missingValues.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-xs text-slate-500 mb-1">{t('add_new_values') || "Yangi qiymatlar qo'shish"}:</p>
                              <div className="flex flex-wrap gap-1">
                                {missingValues.map(val => (
                                  <Button
                                    key={val.id}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-6"
                                    onClick={() => handleAddAttrToProduct(pa.attribute_id, [val.id])}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {val.html_color && (
                                      <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: val.html_color }} />
                                    )}
                                    {val.name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 mb-4">{t('no_attributes_configured') || "Atributlar sozlanmagan"}</p>
                )}

                {/* Add new attribute */}
                {(() => {
                  const availableAttrs = allAttributes.filter(
                    a => !editProductAttributes.some(pa => pa.attribute_id === a.id)
                  );
                  if (availableAttrs.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        {t('add_attribute_to_product') || "Atribut qo'shish"}
                      </label>
                      <Select
                        value=""
                        onValueChange={(attrId) => {
                          const attr = allAttributes.find(a => a.id === attrId);
                          if (attr && attr.values?.length > 0) {
                            handleAddAttrToProduct(attrId, attr.values.map(v => v.id));
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('select_attribute') || "Atributni tanlang"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAttrs.map(attr => (
                            <SelectItem key={attr.id} value={attr.id}>
                              {attr.name} ({attr.values?.length || 0} {t('values') || 'values'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Existing variants */}
                {editProductVariants.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">
                      {t('product_variants_list') || "Mahsulot variantlari"} ({editProductVariants.length})
                    </h5>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-xs">{t('variant') || 'Variant'}</TableHead>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs text-right">{t('cost_price') || 'Cost'}</TableHead>
                            <TableHead className="text-xs text-right">{t('list_price') || 'Price'}</TableHead>
                            <TableHead className="text-xs text-right">{t('stock') || 'Stock'}</TableHead>
                            <TableHead className="text-xs text-right">{t('actions') || ''}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editProductVariants.map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {v.attributes?.map((attr, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {attr.html_color && (
                                        <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: attr.html_color }} />
                                      )}
                                      {attr.value_name}
                                    </Badge>
                                  )) || v.variant_name || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-slate-500">{v.sku || '-'}</TableCell>
                              <TableCell className="text-xs text-right">{v.cost_price ? formatCurrency(v.cost_price) : '-'}</TableCell>
                              <TableCell className="text-xs text-right">{v.list_price ? formatCurrency(v.list_price) : '-'}</TableCell>
                              <TableCell className="text-xs text-right">{v.stock_quantity || 0}</TableCell>
                              <TableCell className="text-xs text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => handleDeleteProductVariant(v.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {editProductVariants.length === 0 && editProductAttributes.length > 0 && (
                  <p className="text-sm text-slate-400 mb-4">{t('no_variants_generated') || "Variantlar hali yaratilmagan"}</p>
                )}

                {/* Generate Variants button */}
                {editProductAttributes.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateProductVariants}
                    disabled={isGeneratingVariants}
                    className="w-full"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingVariants ? 'animate-spin' : ''}`} />
                    {isGeneratingVariants
                      ? (t('generating') || "Yaratilmoqda...")
                      : (t('generate_variants') || "Variantlarni yaratish")}
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="flex-1"
                disabled={isSaving}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={showEditModal ? handleUpdate : handleCreate}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={isSaving || !formData.name}
              >
                {isSaving ? t('saving') : showEditModal ? t('update_product') : t('create_product')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('product_details') || 'Product Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Package className="w-8 h-8 text-slate-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getTypeColor(selectedProduct.type)}>
                      {selectedProduct.type}
                    </Badge>
                    <Badge className={selectedProduct.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-600'
                    }>
                      {selectedProduct.is_active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('category') || 'Category'}</p>
                  <p className="text-sm font-semibold text-slate-900">{getCategoryName(selectedProduct.category_id)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('barcode') || 'Barcode'}</p>
                  {selectedProduct.barcode && isValidEAN13(selectedProduct.barcode) ? (
                    <div className="flex flex-col items-center mt-1">
                      <EAN13Barcode code={selectedProduct.barcode} width={180} height={50} />
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">{selectedProduct.barcode || '-'}</p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">{t('tags') || 'Tags'}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.tags && selectedProduct.tags.length > 0 ? (
                    selectedProduct.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-700 px-2 py-1">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-400 text-sm">-</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">{t('cost_price') || 'Cost Price'}</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedProduct.cost_price || 0)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">{t('list_price') || 'List Price'}</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(selectedProduct.list_price || 0)}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">{t('current_stock') || 'Current Stock'}</p>
                  <p className="text-lg font-bold text-purple-700">
                    {selectedProduct.is_stockable ? getProductStock(selectedProduct.id) : 'N/A'}
                  </p>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">{t('description') || 'Description'}</p>
                  <p className="text-sm text-slate-700">{selectedProduct.description}</p>
                </div>
              )}

              {/* Bundle Items in Detail Modal */}
              {selectedProduct.type === 'bundle' && selectedProduct.bundle_items && selectedProduct.bundle_items.length > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600 mb-2 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {t('bundle_items') || "To'plam tarkibi"}
                  </p>
                  <div className="space-y-2">
                    {selectedProduct.bundle_items.map((item, idx) => {
                      const product = products.find(p => p.id === item.product_id);
                      return (
                        <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-orange-100">
                          <span className="text-slate-700">{product?.name || item.product_name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              x{item.quantity}
                            </Badge>
                            <span className="text-slate-500">{formatCurrency((product?.list_price || 0) * item.quantity)}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-orange-200 flex justify-between text-sm font-semibold">
                      <span className="text-orange-700">{t('total_items_price') || "Jami"}:</span>
                      <span className="text-orange-700">
                        {formatCurrency(selectedProduct.bundle_items.reduce((sum, item) => {
                          const product = products.find(p => p.id === item.product_id);
                          return sum + ((product?.list_price || 0) * (item.quantity || 1));
                        }, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {canUpdate(MODULES.INVENTORY) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEdit(selectedProduct);
                    }}
                    className="flex-1"
                  >
                    <Pencil className="w-4 h-4 mr-2" /> {t('edit') || 'Edit'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1"
                >
                  {t('close') || 'Close'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_product') || 'Delete Product'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('confirm_delete_product') || 'Are you sure you want to delete'}{' '}
              <span className="font-semibold text-slate-900">"{selectedProduct?.name}"</span>?
              {t('action_cannot_be_undone') || 'This action cannot be undone.'}
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  {t('delete_product_warning') || 'Deleting this product may affect existing inventory records and transactions.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete') || 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Import Confirm Modal — opens before the file picker.
          Lets the user download the template + see the expected columns
          before they pick a file. The file picker itself is the body-
          attached singleton <input type="file"> mounted by the
          useEffect above; clicking "Choose file" .click()s that input
          (which is OUTSIDE the React tree, so this dialog can mount /
          unmount freely without destroying it). */}
      <Dialog
        open={showImportConfirmModal}
        onOpenChange={(open) => {
          setShowImportConfirmModal(open);
          // Reset to the main step whenever the modal closes so the
          // next time the user opens it, they see the simple view
          // rather than landing back on the field chooser.
          if (!open) setImportStep('main');
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {importStep === 'fields' && (
                <button
                  type="button"
                  onClick={() => setImportStep('main')}
                  className="p-1 -ml-1 hover:bg-slate-100 rounded"
                  title={t('back') || 'Back'}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <Upload className="w-5 h-5" />
              {importStep === 'fields'
                ? (t('products_import_select_fields') || 'Ustunlarni tanlang')
                : t('products_import_title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {importStep === 'fields'
                ? (t('products_import_select_fields_hint') || 'Shablonga qaysi ustunlar kirishini belgilang')
                : t('products_import_description')}
            </DialogDescription>
          </DialogHeader>

          {importStep === 'main' ? (
            // ── Step 1: simple chooser ─────────────────────────────────
            <>
              <div className="overflow-y-auto px-6 py-4 flex-1 min-h-0 space-y-4">
                <div className="text-sm text-slate-600 leading-relaxed">
                  {t('products_import_help_note')}
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 px-6 py-3 border-t bg-slate-50 flex-shrink-0">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setImportStep('fields')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t('products_import_download_template')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    // Trigger the file picker FIRST, synchronously
                    // inside the user click handler — Chrome's
                    // transient user activation must still be active
                    // or it'll silently refuse to open the OS file
                    // picker. THEN close the modal.
                    productImportFileRef.current?.click();
                    setShowImportConfirmModal(false);
                    setImportStep('main');
                  }}
                  disabled={isProductImporting}
                  className="gap-2 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90"
                >
                  <Upload className="w-4 h-4" />
                  {t('products_import_choose_and_upload')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            // ── Step 2: column picker (only on Download flow) ──────────
            <>
              <div className="overflow-y-auto px-6 py-4 flex-1 min-h-0 space-y-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-slate-800">
                      {t('products_import_select_fields') || 'Ustunlarni tanlang'}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({selectedImportFields.length}/{IMPORT_FIELD_DEFS.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => setSelectedImportFields(IMPORT_FIELD_DEFS.map(f => f.key))}
                      >
                        {t('select_all') || 'Hammasini tanlash'}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => setSelectedImportFields(IMPORT_FIELD_DEFS.filter(f => f.default).map(f => f.key))}
                      >
                        {t('reset_to_default') || 'Sukut bo\'yicha'}
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const GROUP_LABELS = {
                      core: t('field_group_core') || 'Asosiy',
                      pricing: t('field_group_pricing') || 'Narxlash',
                      identifiers: t('field_group_identifiers') || 'Identifikatorlar',
                      inventory: t('field_group_inventory') || 'Ombor',
                      supplier: t('field_group_supplier') || 'Yetkazib beruvchi',
                      dimensions: t('field_group_dimensions') || 'O\'lchamlar',
                      other: t('field_group_other') || 'Boshqa',
                    };
                    const grouped = IMPORT_FIELD_DEFS.reduce((acc, f) => {
                      (acc[f.group] = acc[f.group] || []).push(f); return acc;
                    }, {});
                    const groupOrder = ['core', 'pricing', 'identifiers', 'inventory', 'supplier', 'dimensions', 'other'];
                    const selectedSet = new Set(selectedImportFields);
                    const toggle = (key) => {
                      if (selectedSet.has(key)) {
                        setSelectedImportFields(selectedImportFields.filter(k => k !== key));
                      } else {
                        setSelectedImportFields([...selectedImportFields, key]);
                      }
                    };
                    return groupOrder.filter(g => grouped[g]).map(g => (
                      <div key={g} className="mb-3 last:mb-0">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">
                          {GROUP_LABELS[g]}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {grouped[g].map(f => {
                            const isChecked = selectedSet.has(f.key);
                            const isLocked = !!f.required;
                            return (
                              <label
                                key={f.key}
                                className={`flex items-center gap-2 text-xs cursor-pointer hover:bg-white px-2 py-1 rounded ${isLocked ? 'opacity-90 cursor-not-allowed' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked || isLocked}
                                  disabled={isLocked}
                                  onChange={() => !isLocked && toggle(f.key)}
                                  className="rounded"
                                />
                                <span className={isChecked ? 'text-slate-800 font-medium' : 'text-slate-600'}>
                                  {f.label}
                                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 px-6 py-3 border-t bg-slate-50 flex-shrink-0">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setImportStep('main')}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('back') || 'Back'}
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    await downloadProductImportTemplate();
                    setShowImportConfirmModal(false);
                    setImportStep('main');
                  }}
                  className="gap-2 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90"
                >
                  <Download className="w-4 h-4" />
                  {t('products_import_download_template')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Modal (legacy — kept for code references; not opened) */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        columns={importColumns}
        entityName="Mahsulotlar"
      />

      {/* Category Import Modal */}
      <ImportModal
        open={showCategoryImportModal}
        onClose={() => setShowCategoryImportModal(false)}
        onImport={handleCategoryImport}
        columns={categoryImportColumns}
        entityName="Kategoriyalar"
      />

      {/* Export Modal — receives the FULL filtered product set
          (not just the visible page) via allProductsForExport,
          which is populated by handleOpenExport before the modal
          opens. */}
      <ExportModal
        open={showExportModal}
        onClose={() => { setShowExportModal(false); setAllProductsForExport([]); }}
        data={allProductsForExport}
        columns={exportColumns}
        entityName="Mahsulotlar"
        title="Mahsulotlar ro'yxati"
      />

      {/* Create Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={(open) => {
        setShowCategoryModal(open);
        if (!open) { setNewCategoryName(''); setCategoryAccounts({ ...defaultCategoryAccounts }); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('add_category')}
            </DialogTitle>
            <DialogDescription>
              {t('add_category_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('category_name')} *
              </label>
              <Input
                placeholder={t('category_name_placeholder')}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>

            {/* GL Account Selectors */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">{t('accounting_accounts')}</h4>
              <div className="space-y-3">
                {[
                  { key: 'income_account_id', label: t('income_account') },
                  { key: 'expense_account_id', label: t('expense_account') },
                  { key: 'stock_valuation_account_id', label: t('stock_valuation_account') },
                  { key: 'stock_input_account_id', label: t('stock_input_account') },
                  { key: 'stock_output_account_id', label: t('stock_output_account') },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">{label}</label>
                    <Select
                      value={categoryAccounts[key] || 'none'}
                      onValueChange={(v) => setCategoryAccounts(prev => ({ ...prev, [key]: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('select_account')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— {t('none')} —</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {language === 'ru' && acc.name_ru ? acc.name_ru : language === 'en' && acc.name_en ? acc.name_en : acc.name_uz || acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setCategoryAccounts({ ...defaultCategoryAccounts });
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              {canCreate(MODULES.INVENTORY) && (
                <Button
                  onClick={handleCreateCategory}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('create')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Modal */}
      <Dialog open={showCategoryManageModal} onOpenChange={setShowCategoryManageModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[var(--genix-purple)]" />
              {t('manage_categories')}
            </DialogTitle>
            <DialogDescription>
              {t('manage_categories_description')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Add new category inline */}
            {canCreate(MODULES.INVENTORY) && (
              <div className="flex gap-2">
                <Input
                  placeholder={t('category_name_placeholder')}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  className="flex-1"
                />
                <Button
                  onClick={handleCreateCategory}
                  className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add')}
                </Button>
              </div>
            )}

            {/* Categories list */}
            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {t('no_categories_yet')}
                </div>
              ) : (
                categories.map(category => (
                  <div
                    key={category.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 group"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{category.name}</p>
                      <p className="text-xs text-slate-500">{t('code')}: {category.code}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canUpdate(MODULES.INVENTORY) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCategoryClick(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                      )}
                      {canDelete(MODULES.INVENTORY) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategoryClick(category)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCategoryManageModal(false)}
              >
                {t('close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog open={showEditCategoryModal} onOpenChange={(open) => {
        setShowEditCategoryModal(open);
        if (!open) { setEditCategoryName(''); setSelectedCategory(null); setCategoryAccounts({ ...defaultCategoryAccounts }); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-[var(--genix-blue)]" />
              {t('edit_category')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                {t('category_name')} *
              </label>
              <Input
                placeholder={t('category_name_placeholder')}
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
              />
            </div>

            {/* GL Account Selectors */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">{t('accounting_accounts')}</h4>
              <div className="space-y-3">
                {[
                  { key: 'income_account_id', label: t('income_account') },
                  { key: 'expense_account_id', label: t('expense_account') },
                  { key: 'stock_valuation_account_id', label: t('stock_valuation_account') },
                  { key: 'stock_input_account_id', label: t('stock_input_account') },
                  { key: 'stock_output_account_id', label: t('stock_output_account') },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-sm font-medium text-slate-600 mb-1 block">{label}</label>
                    <Select
                      value={categoryAccounts[key] || 'none'}
                      onValueChange={(v) => setCategoryAccounts(prev => ({ ...prev, [key]: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('select_account')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— {t('none')} —</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {language === 'ru' && acc.name_ru ? acc.name_ru : language === 'en' && acc.name_en ? acc.name_en : acc.name_uz || acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditCategoryModal(false);
                  setEditCategoryName('');
                  setSelectedCategory(null);
                  setCategoryAccounts({ ...defaultCategoryAccounts });
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleUpdateCategory}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={!editCategoryName.trim()}
              >
                {t('save_changes')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation Modal */}
      <Dialog open={showDeleteCategoryModal} onOpenChange={setShowDeleteCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('delete_category')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 mb-4">
              {t('delete_category_confirm')}{' '}
              <span className="font-semibold text-slate-900">"{selectedCategory?.name}"</span>?
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  {t('delete_category_warning')}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteCategoryModal(false);
                  setSelectedCategory(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDeleteCategory}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
