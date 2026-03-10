import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { inventoryService } from '@/api/services';
import { useCompany } from './CompanyContext';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';
import { useAdminSettings } from './AdminSettingsContext';

const PRODUCTS_STORAGE_KEY = 'genix_products';
const CATEGORIES_STORAGE_KEY = 'genix_product_categories';
const WAREHOUSES_STORAGE_KEY = 'genix_warehouses';
const INVENTORY_STORAGE_KEY = 'genix_inventory';
const STOCK_MOVEMENTS_STORAGE_KEY = 'genix_stock_movements';
const LOTS_STORAGE_KEY = 'genix_inventory_lots';
const STOCK_COUNTS_STORAGE_KEY = 'genix_stock_counts';
const BOMS_STORAGE_KEY = 'genix_boms';
const BOM_LINES_STORAGE_KEY = 'genix_bom_lines';
const REORDER_RULES_STORAGE_KEY = 'genix_reorder_rules';
const SCRAP_ORDERS_STORAGE_KEY = 'genix_scrap_orders';

const InventoryContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return companyId ? `${prefix}${baseKey}_${companyId}` : `${prefix}${baseKey}`;
};

// Sample products data
const sampleProducts = [
  {
    id: 'prod_1',
    code: 'ELEC-LP15',
    name: 'Laptop Pro 15"',
    sku: 'ELEC-LP15-001',
    barcode: '1234567890123',
    type: 'product',
    category_id: 'cat_1',
    description: 'High-performance laptop with 16GB RAM',
    cost_price: 899,
    list_price: 1299,
    min_price: 1100,
    is_stockable: true,
    track_inventory: true,
    min_stock_level: 20,
    reorder_point: 25,
    reorder_quantity: 50,
    is_purchasable: true,
    is_sellable: true,
    is_active: true,
    tags: ['electronics', 'computers'],
    created_at: new Date().toISOString()
  },
  {
    id: 'prod_2',
    code: 'ELEC-WM',
    name: 'Wireless Mouse',
    sku: 'ELEC-WM-002',
    barcode: '1234567890124',
    type: 'product',
    category_id: 'cat_1',
    description: 'Ergonomic wireless mouse',
    cost_price: 15,
    list_price: 29.99,
    min_price: 22,
    is_stockable: true,
    track_inventory: true,
    min_stock_level: 25,
    reorder_point: 30,
    reorder_quantity: 100,
    is_purchasable: true,
    is_sellable: true,
    is_active: true,
    tags: ['electronics', 'accessories'],
    created_at: new Date().toISOString()
  },
  {
    id: 'prod_3',
    code: 'FURN-OC',
    name: 'Office Chair Premium',
    sku: 'FURN-OC-001',
    type: 'product',
    category_id: 'cat_2',
    description: 'Ergonomic office chair with lumbar support',
    cost_price: 250,
    list_price: 449,
    min_price: 380,
    is_stockable: true,
    track_inventory: true,
    min_stock_level: 10,
    reorder_point: 15,
    reorder_quantity: 20,
    is_purchasable: true,
    is_sellable: true,
    is_active: true,
    tags: ['furniture', 'office'],
    created_at: new Date().toISOString()
  },
  {
    id: 'prod_4',
    code: 'SVC-INSTALL',
    name: 'Installation Service',
    sku: 'SVC-INSTALL-001',
    type: 'service',
    category_id: 'cat_3',
    description: 'Professional installation service',
    cost_price: 50,
    list_price: 99,
    min_price: 75,
    is_stockable: false,
    track_inventory: false,
    min_stock_level: 0,
    reorder_point: 0,
    reorder_quantity: 0,
    is_purchasable: false,
    is_sellable: true,
    is_active: true,
    tags: ['services'],
    created_at: new Date().toISOString()
  }
];

// Sample categories data
const sampleCategories = [
  {
    id: 'cat_1',
    code: 'ELEC',
    name: 'Electronics',
    description: 'Electronic products and accessories',
    parent_id: null,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'cat_2',
    code: 'FURN',
    name: 'Furniture',
    description: 'Office and home furniture',
    parent_id: null,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'cat_3',
    code: 'SVC',
    name: 'Services',
    description: 'Professional services',
    parent_id: null,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'cat_4',
    code: 'ELEC-COMP',
    name: 'Computers',
    description: 'Computers and laptops',
    parent_id: 'cat_1',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'cat_5',
    code: 'ELEC-ACC',
    name: 'Accessories',
    description: 'Electronic accessories',
    parent_id: 'cat_1',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

// Sample warehouses data
const sampleWarehouses = [
  {
    id: 'wh_1',
    code: 'WH-MAIN',
    name: 'Main Warehouse',
    address: '123 Industrial Blvd',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    postal_code: '10001',
    phone: '+1-555-0100',
    email: 'main@warehouse.com',
    manager_name: 'John Smith',
    is_active: true,
    is_default: true,
    created_at: new Date().toISOString(),
    locations: [
      { id: 'loc_1', code: 'A-1', name: 'Aisle A, Shelf 1', zone: 'A', is_active: true },
      { id: 'loc_2', code: 'A-2', name: 'Aisle A, Shelf 2', zone: 'A', is_active: true },
      { id: 'loc_3', code: 'B-1', name: 'Aisle B, Shelf 1', zone: 'B', is_active: true }
    ]
  },
  {
    id: 'wh_2',
    code: 'WH-DIST',
    name: 'Distribution Center',
    address: '456 Logistics Way',
    city: 'Los Angeles',
    state: 'CA',
    country: 'USA',
    postal_code: '90001',
    phone: '+1-555-0200',
    email: 'dist@warehouse.com',
    manager_name: 'Jane Doe',
    is_active: true,
    is_default: false,
    created_at: new Date().toISOString(),
    locations: [
      { id: 'loc_4', code: 'C-1', name: 'Aisle C, Shelf 1', zone: 'C', is_active: true },
      { id: 'loc_5', code: 'C-2', name: 'Aisle C, Shelf 2', zone: 'C', is_active: true }
    ]
  }
];

// Sample inventory (stock levels)
const sampleInventory = [
  {
    id: 'inv_1',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    location_id: 'loc_1',
    quantity: 45,
    reserved_quantity: 5,
    available_quantity: 40,
    lot_number: 'LOT-2025-001',
    cost_price: 899,
    last_count_date: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_2',
    product_id: 'prod_2',
    warehouse_id: 'wh_1',
    location_id: 'loc_2',
    quantity: 120,
    reserved_quantity: 10,
    available_quantity: 110,
    lot_number: 'LOT-2025-002',
    cost_price: 15,
    last_count_date: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_3',
    product_id: 'prod_3',
    warehouse_id: 'wh_1',
    location_id: 'loc_3',
    quantity: 32,
    reserved_quantity: 2,
    available_quantity: 30,
    lot_number: 'LOT-2025-003',
    cost_price: 250,
    last_count_date: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: 'inv_4',
    product_id: 'prod_1',
    warehouse_id: 'wh_2',
    location_id: 'loc_4',
    quantity: 20,
    reserved_quantity: 0,
    available_quantity: 20,
    lot_number: 'LOT-2025-004',
    cost_price: 899,
    last_count_date: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
];

// Sample stock movements
const sampleStockMovements = [
  {
    id: 'mov_1',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    movement_type: 'receipt',
    quantity: 20,
    unit_cost: 899,
    reference: 'PO-2025-001',
    notes: 'Regular stock replenishment',
    created_at: new Date().toISOString()
  },
  {
    id: 'mov_2',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    movement_type: 'shipment',
    quantity: -5,
    unit_cost: 899,
    reference: 'SO-2025-001',
    notes: 'Customer order fulfillment',
    created_at: new Date().toISOString()
  },
  {
    id: 'mov_3',
    product_id: 'prod_2',
    warehouse_id: 'wh_1',
    movement_type: 'adjustment',
    quantity: 10,
    unit_cost: 15,
    reference: 'ADJ-2025-001',
    notes: 'Inventory count adjustment',
    created_at: new Date().toISOString()
  },
  {
    id: 'mov_4',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    to_warehouse_id: 'wh_2',
    movement_type: 'transfer',
    quantity: -20,
    unit_cost: 899,
    reference: 'TRF-2025-001',
    notes: 'Transfer to distribution center',
    created_at: new Date().toISOString()
  }
];

// Sample inventory lots (for FIFO/batch tracking)
const sampleLots = [
  {
    id: 'lot_1',
    lot_number: 'LOT-2025-001',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    quantity: 25,
    original_quantity: 30,
    unit_cost: 890,
    manufacture_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    serial_numbers: [],
    status: 'active',
    supplier: 'TechSupply Inc',
    received_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString()
  },
  {
    id: 'lot_2',
    lot_number: 'LOT-2025-002',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    quantity: 20,
    original_quantity: 20,
    unit_cost: 899,
    manufacture_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    serial_numbers: [],
    status: 'active',
    supplier: 'Office Depot',
    received_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString()
  },
  {
    id: 'lot_3',
    lot_number: 'LOT-2025-003',
    product_id: 'prod_2',
    warehouse_id: 'wh_1',
    quantity: 120,
    original_quantity: 150,
    unit_cost: 15,
    manufacture_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    expiry_date: null,
    serial_numbers: [],
    status: 'active',
    supplier: 'Gadget Wholesale',
    received_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString()
  },
  {
    id: 'lot_4',
    lot_number: 'LOT-2024-050',
    product_id: 'prod_3',
    warehouse_id: 'wh_1',
    quantity: 5,
    original_quantity: 10,
    unit_cost: 240,
    manufacture_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    expiry_date: null,
    serial_numbers: ['SN-001', 'SN-002', 'SN-003', 'SN-004', 'SN-005'],
    status: 'active',
    supplier: 'Furniture Pro',
    received_date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString()
  }
];

// Sample BOMs (Bill of Materials)
const sampleBOMs = [
  {
    id: 'bom_1',
    code: 'BOM-DESKTOP-001',
    name: 'Desktop Computer Assembly',
    product_id: 'prod_1',
    bom_type: 'manufacturing',
    quantity: 1,
    is_active: true,
    notes: 'Standard desktop computer assembly BOM',
    created_at: new Date().toISOString()
  }
];

// Sample BOM Lines
const sampleBOMLines = [
  {
    id: 'boml_1',
    bom_id: 'bom_1',
    component_id: 'prod_2',
    quantity: 1,
    unit_of_measure: 'pcs',
    notes: 'Wireless mouse included',
    created_at: new Date().toISOString()
  }
];

// Sample Reorder Rules
const sampleReorderRules = [
  {
    id: 'rr_1',
    product_id: 'prod_1',
    warehouse_id: 'wh_1',
    min_qty: 10,
    max_qty: 100,
    reorder_qty: 50,
    trigger_type: 'min_qty',
    supplier_id: null,
    lead_time_days: 7,
    is_active: true,
    auto_create_po: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'rr_2',
    product_id: 'prod_2',
    warehouse_id: 'wh_1',
    min_qty: 20,
    max_qty: 200,
    reorder_qty: 100,
    trigger_type: 'min_qty',
    supplier_id: null,
    lead_time_days: 5,
    is_active: true,
    auto_create_po: false,
    created_at: new Date().toISOString()
  }
];

// Sample Scrap Orders
const sampleScrapOrders = [
  {
    id: 'scrap_1',
    scrap_number: 'SCRAP-2025-001',
    product_id: 'prod_2',
    warehouse_id: 'wh_1',
    quantity: 5,
    reason: 'damaged',
    reason_notes: 'Damaged during shipping',
    scrap_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'completed',
    scrapped_by: 'John Smith',
    approved_by: 'Jane Doe',
    cost_impact: 75,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Sample stock counts (inventarizatsiya)
const sampleStockCounts = [
  {
    id: 'sc_1',
    count_number: 'INV-2025-001',
    warehouse_id: 'wh_1',
    count_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'completed',
    counted_by: 'John Smith',
    approved_by: 'Jane Doe',
    notes: 'Monthly inventory count',
    lines: [
      { product_id: 'prod_1', system_qty: 42, counted_qty: 45, variance: 3, variance_reason: 'Uncounted receipt found' },
      { product_id: 'prod_2', system_qty: 118, counted_qty: 120, variance: 2, variance_reason: 'Minor count error' },
      { product_id: 'prod_3', system_qty: 32, counted_qty: 32, variance: 0, variance_reason: null }
    ],
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'sc_2',
    count_number: 'INV-2025-002',
    warehouse_id: 'wh_2',
    count_date: new Date().toISOString().split('T')[0],
    status: 'in_progress',
    counted_by: 'Mike Johnson',
    approved_by: null,
    notes: 'Quarterly audit count',
    lines: [
      { product_id: 'prod_1', system_qty: 20, counted_qty: null, variance: null, variance_reason: null }
    ],
    created_at: new Date().toISOString(),
    completed_at: null
  }
];

export function InventoryProvider({ children }) {
  const { activeCompany } = useCompany();
  const { getSetting } = useAdminSettings();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [lots, setLots] = useState([]);
  const [stockCounts, setStockCounts] = useState([]);
  const [boms, setBOMs] = useState([]);
  const [bomLines, setBOMLines] = useState([]);
  const [reorderRules, setReorderRules] = useState([]);
  const [scrapOrders, setScrapOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  // Get admin settings for inventory module - these affect module behavior
  const inventorySettings = useMemo(() => ({
    // Costing Method
    costingMethod: getSetting('inventory.costing.method', 'FIFO'),
    valuationMode: getSetting('inventory.costing.valuation', 'automatic'),

    // Traceability
    traceabilityEnabled: getSetting('inventory.traceability.enabled', true),
    lotTrackingEnabled: getSetting('inventory.traceability.lot_tracking', true),
    serialTrackingEnabled: getSetting('inventory.traceability.serial_number_tracking', false),
    expiryTrackingEnabled: getSetting('inventory.traceability.expiry_date_tracking', true),

    // Warehouse
    defaultWarehouseId: getSetting('inventory.warehouse.default_warehouse_id', null),
    allowNegativeStock: getSetting('inventory.warehouse.allow_negative_stock', false),
    requireLocation: getSetting('inventory.warehouse.require_location', false),
    multiLocationEnabled: getSetting('inventory.warehouse.multi_location', false),

    // Reorder
    autoReorderEnabled: getSetting('inventory.reorder.auto_reorder', false),
    defaultReorderQty: getSetting('inventory.reorder.default_reorder_quantity', 10),
    lowStockThresholdPercent: getSetting('inventory.reorder.low_stock_threshold_percent', 20),

    // Units
    defaultUnit: getSetting('inventory.units.default_unit', 'Unit'),
    unitsOfMeasure: getSetting('inventory.units.units_of_measure', []),

    // Barcode
    barcodeFormat: getSetting('inventory.barcode.format', 'EAN13'),
    autoGenerateBarcode: getSetting('inventory.barcode.auto_generate', false)
  }), [getSetting]);

  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;
    const demoMode = isDemoMode();

    // Helper to get data - only use sample data in demo mode when localStorage is empty
    const getData = (key, sampleData) => {
      const storageKey = getStorageKey(key, companyId);
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
      return demoMode ? sampleData : [];
    };

    setProducts(getData(PRODUCTS_STORAGE_KEY, sampleProducts));
    setCategories(getData(CATEGORIES_STORAGE_KEY, sampleCategories));
    setWarehouses(getData(WAREHOUSES_STORAGE_KEY, sampleWarehouses));
    setInventory(getData(INVENTORY_STORAGE_KEY, sampleInventory));
    setStockMovements(getData(STOCK_MOVEMENTS_STORAGE_KEY, sampleStockMovements));
    setLots(getData(LOTS_STORAGE_KEY, sampleLots));
    setStockCounts(getData(STOCK_COUNTS_STORAGE_KEY, sampleStockCounts));
    setBOMs(getData(BOMS_STORAGE_KEY, sampleBOMs));
    setBOMLines(getData(BOM_LINES_STORAGE_KEY, sampleBOMLines));
    setReorderRules(getData(REORDER_RULES_STORAGE_KEY, sampleReorderRules));
    setScrapOrders(getData(SCRAP_ORDERS_STORAGE_KEY, sampleScrapOrders));

    // Only initialize localStorage with sample data in demo mode
    if (demoMode) {
      const initIfEmpty = (key, sampleData) => {
        const storageKey = getStorageKey(key, companyId);
        if (!localStorage.getItem(storageKey)) {
          localStorage.setItem(storageKey, JSON.stringify(sampleData));
        }
      };

      initIfEmpty(PRODUCTS_STORAGE_KEY, sampleProducts);
      initIfEmpty(CATEGORIES_STORAGE_KEY, sampleCategories);
      initIfEmpty(WAREHOUSES_STORAGE_KEY, sampleWarehouses);
      initIfEmpty(INVENTORY_STORAGE_KEY, sampleInventory);
      initIfEmpty(STOCK_MOVEMENTS_STORAGE_KEY, sampleStockMovements);
      initIfEmpty(LOTS_STORAGE_KEY, sampleLots);
      initIfEmpty(STOCK_COUNTS_STORAGE_KEY, sampleStockCounts);
      initIfEmpty(BOMS_STORAGE_KEY, sampleBOMs);
      initIfEmpty(BOM_LINES_STORAGE_KEY, sampleBOMLines);
      initIfEmpty(REORDER_RULES_STORAGE_KEY, sampleReorderRules);
      initIfEmpty(SCRAP_ORDERS_STORAGE_KEY, sampleScrapOrders);
    }
  }, [activeCompany]);

  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const isAvailable = await checkBackendHealth();
      setBackendAvailable(isAvailable);
      if (isAvailable) {
        try {
          const [productsData, categoriesData, warehousesData, inventoryData, movementsData] = await Promise.all([
            inventoryService.listProducts(),
            inventoryService.listCategories(),
            inventoryService.listWarehouses(),
            inventoryService.listInventory(),
            inventoryService.listInventoryMovements({ limit: 1000 })
          ]);

          // Transform warehouse data from backend format to frontend format
          const transformedWarehouses = (warehousesData || []).map(w => ({
            ...w,
            // Flatten address from backend nested format
            address: w.address?.street1 || '',
            city: w.address?.city || '',
            state: w.address?.state || '',
            country: w.address?.country || '',
            postal_code: w.address?.postal_code || '',
            // Keep locations as-is (they come from backend now)
            locations: w.locations || []
          }));

          // When backend is available, use backend data directly (even if empty)
          // This ensures data is consistent across all devices
          setProducts(productsData || []);
          setCategories(categoriesData || []);
          setWarehouses(transformedWarehouses);
          setInventory(inventoryData || []);
          setStockMovements(movementsData || []);

          // Also load lots, stock counts, BOMs, reorder rules, scrap orders from backend
          // For now, these still fall back to localStorage until backend endpoints are ready
          const companyId = activeCompany?.id;
          const demoMode = isDemoMode();

          const getLocalData = (key, sampleData) => {
            const storageKey = getStorageKey(key, companyId);
            const stored = localStorage.getItem(storageKey);
            if (stored) return JSON.parse(stored);
            return demoMode ? sampleData : [];
          };

          setLots(getLocalData(LOTS_STORAGE_KEY, sampleLots));

          // Load stock counts from backend
          try {
            const stockCountsData = await inventoryService.listStockCounts();
            setStockCounts(stockCountsData || []);
          } catch (scErr) {
            console.warn('[InventoryContext] Stock counts API not available, using localStorage:', scErr.message);
            setStockCounts(getLocalData(STOCK_COUNTS_STORAGE_KEY, sampleStockCounts));
          }

          // Load scrap orders from backend
          try {
            const scrapData = await inventoryService.listScrapOrders();
            setScrapOrders(scrapData || []);
          } catch (scrapErr) {
            console.warn('[InventoryContext] Scrap orders API not available, using localStorage:', scrapErr.message);
            setScrapOrders(getLocalData(SCRAP_ORDERS_STORAGE_KEY, sampleScrapOrders));
          }

          setBOMs(getLocalData(BOMS_STORAGE_KEY, sampleBOMs));
          setBOMLines(getLocalData(BOM_LINES_STORAGE_KEY, sampleBOMLines));

          // Load reorder rules from backend
          try {
            const reorderData = await inventoryService.listReorderRules();
            setReorderRules(reorderData || []);
          } catch (rrErr) {
            console.warn('[InventoryContext] Reorder rules API not available, using localStorage:', rrErr.message);
            setReorderRules(getLocalData(REORDER_RULES_STORAGE_KEY, sampleReorderRules));
          }
        } catch (apiError) {
          console.error('[InventoryContext] API call failed:', apiError);
          console.error('[InventoryContext] Error details:', apiError.response?.data || apiError.message);
          console.warn('[InventoryContext] Falling back to localStorage');
          loadFromLocalStorage();
        }
      } else {
        // Backend not available, using localStorage
        loadFromLocalStorage();
      }
    } catch (err) {
      console.error('[InventoryContext] Error loading inventory data:', err);
      setError(err.message);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromLocalStorage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleCompanyChange = () => {
      loadData();
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadData]);

  // ================== PRODUCTS ==================
  const createProduct = useCallback(async (productData) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        const newProduct = await inventoryService.createProduct({
          ...productData,
          company_id: companyId
        });
        setProducts(prev => [...prev, newProduct]);
        return newProduct;
      } catch (err) {
        console.error('API error creating product:', err);
        throw err; // Re-throw to let caller handle the error
      }
    }

    // Only use localStorage when backend is not available
    const storageKey = getStorageKey(PRODUCTS_STORAGE_KEY, companyId);
    const newProduct = {
      id: `prod_${Date.now()}`,
      ...productData,
      created_at: new Date().toISOString()
    };
    const updated = [...products, newProduct];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setProducts(updated);
    return newProduct;
  }, [backendAvailable, products, activeCompany]);

  const updateProduct = useCallback(async (id, productData) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        const updatedProduct = await inventoryService.updateProduct(id, productData);
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...productData, ...updatedProduct } : p));
        return;
      } catch (err) {
        console.error('API error updating product:', err);
        throw err;
      }
    }

    // Only use localStorage when backend is not available
    const storageKey = getStorageKey(PRODUCTS_STORAGE_KEY, companyId);
    const updated = products.map(p => p.id === id ? { ...p, ...productData } : p);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setProducts(updated);
  }, [backendAvailable, products, activeCompany]);

  const deleteProduct = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        await inventoryService.deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
        return;
      } catch (err) {
        console.error('API error deleting product:', err);
        throw err;
      }
    }

    // Only use localStorage when backend is not available
    const storageKey = getStorageKey(PRODUCTS_STORAGE_KEY, companyId);
    const updated = products.filter(p => p.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setProducts(updated);
  }, [backendAvailable, products, activeCompany]);

  // ================== CATEGORIES ==================
  const createCategory = useCallback(async (categoryData) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        const newCategory = await inventoryService.createCategory(categoryData);
        setCategories(prev => [...prev, newCategory]);
        return newCategory;
      } catch (err) {
        console.error('API error creating category:', err);
        throw err;
      }
    }

    // Only use localStorage when backend is not available
    const storageKey = getStorageKey(CATEGORIES_STORAGE_KEY, companyId);
    const newCategory = {
      id: `cat_${Date.now()}`,
      ...categoryData,
      created_at: new Date().toISOString()
    };
    const updated = [...categories, newCategory];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCategories(updated);
    return newCategory;
  }, [backendAvailable, categories, activeCompany]);

  const updateCategory = useCallback(async (id, categoryData) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        const updatedCategory = await inventoryService.updateCategory(id, categoryData);
        setCategories(prev => prev.map(c => c.id === id ? { ...c, ...categoryData, ...updatedCategory } : c));
        return;
      } catch (err) {
        console.error('API error updating category:', err);
        throw err;
      }
    }

    // Only use localStorage when backend is not available
    const storageKey = getStorageKey(CATEGORIES_STORAGE_KEY, companyId);
    const updated = categories.map(c => c.id === id ? { ...c, ...categoryData } : c);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCategories(updated);
  }, [backendAvailable, categories, activeCompany]);

  const deleteCategory = useCallback(async (id) => {
    const companyId = activeCompany?.id;

    if (backendAvailable) {
      try {
        await inventoryService.deleteCategory(id);
        setCategories(prev => prev.filter(c => c.id !== id));
        return;
      } catch (err) {
        console.error('API error deleting category:', err);
        throw err;
      }
    }

    // Only use localStorage when backend is not available
    const storageKey = getStorageKey(CATEGORIES_STORAGE_KEY, companyId);
    const updated = categories.filter(c => c.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setCategories(updated);
  }, [backendAvailable, categories, activeCompany]);

  // ================== WAREHOUSES ==================
  // Transform frontend warehouse data to backend format
  const transformWarehouseData = (warehouseData) => {
    const { address, city, state, country, postal_code, phone, email, manager_name, ...rest } = warehouseData;
    return {
      ...rest,
      address: {
        street1: address || '',
        city: city || '',
        state: state || '',
        country: country || '',
        postal_code: postal_code || ''
      },
      // Backend doesn't have phone/email/manager_name on warehouse, they're in the address or separate
      // Keep these for localStorage compatibility
      phone,
      email,
      manager_name
    };
  };

  const createWarehouse = useCallback(async (warehouseData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(WAREHOUSES_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        const transformedData = transformWarehouseData(warehouseData);
        const newWarehouse = await inventoryService.createWarehouse(transformedData);
        setWarehouses(prev => [...prev, newWarehouse]);
        return newWarehouse;
      } catch (err) {
        console.error('API error creating warehouse:', err);
        throw err; // Re-throw so the caller knows it failed
      }
    }

    const newWarehouse = {
      id: `wh_${Date.now()}`,
      ...warehouseData,
      locations: [],
      created_at: new Date().toISOString()
    };
    const updated = [...warehouses, newWarehouse];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setWarehouses(updated);
    return newWarehouse;
  }, [backendAvailable, warehouses, activeCompany]);

  const updateWarehouse = useCallback(async (id, warehouseData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(WAREHOUSES_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        const transformedData = transformWarehouseData(warehouseData);
        const updatedWarehouse = await inventoryService.updateWarehouse(id, transformedData);
        setWarehouses(prev => prev.map(w => w.id === id ? updatedWarehouse : w));
        return updatedWarehouse;
      } catch (err) {
        console.error('API error updating warehouse:', err);
        throw err;
      }
    }

    const updated = warehouses.map(w => w.id === id ? { ...w, ...warehouseData } : w);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setWarehouses(updated);
  }, [backendAvailable, warehouses, activeCompany]);

  const deleteWarehouse = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(WAREHOUSES_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        await inventoryService.deleteWarehouse(id);
        setWarehouses(prev => prev.filter(w => w.id !== id));
        return;
      } catch (err) {
        console.error('API error deleting warehouse:', err);
        throw err;
      }
    }

    const updated = warehouses.filter(w => w.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setWarehouses(updated);
  }, [backendAvailable, warehouses, activeCompany]);

  // Transform frontend location data to backend format
  const transformLocationData = (locationData) => {
    const { code, name, type, parent_id, aisle, rack, shelf, bin, capacity } = locationData;
    const transformed = {
      code,
      name,
      type: type || 'storage',
    };
    // Only include optional fields if they have values
    if (parent_id && parent_id !== '__none__' && parent_id !== '') {
      transformed.parent_id = parent_id;
    }
    if (aisle) transformed.aisle = aisle;
    if (rack) transformed.rack = rack;
    if (shelf) transformed.shelf = shelf;
    if (bin) transformed.bin = bin;
    if (capacity && capacity !== '' && !isNaN(parseFloat(capacity))) {
      transformed.capacity = parseFloat(capacity);
    }
    return transformed;
  };

  const createWarehouseLocation = useCallback(async (warehouseId, locationData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(WAREHOUSES_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        const transformedData = transformLocationData(locationData);
        const newLocation = await inventoryService.createWarehouseLocation(warehouseId, transformedData);
        setWarehouses(prev => prev.map(w =>
          w.id === warehouseId
            ? { ...w, locations: [...(w.locations || []), newLocation] }
            : w
        ));
        return newLocation;
      } catch (err) {
        console.error('API error creating location:', err);
        throw err;
      }
    }

    const newLocation = {
      id: `loc_${Date.now()}`,
      ...locationData,
      is_active: true
    };
    const updated = warehouses.map(w =>
      w.id === warehouseId
        ? { ...w, locations: [...(w.locations || []), newLocation] }
        : w
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setWarehouses(updated);
    return newLocation;
  }, [backendAvailable, warehouses, activeCompany]);

  const updateWarehouseLocation = useCallback(async (warehouseId, locationId, locationData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(WAREHOUSES_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        const transformedData = transformLocationData(locationData);
        const updatedLocation = await inventoryService.updateWarehouseLocation(warehouseId, locationId, transformedData);
        setWarehouses(prev => prev.map(w => {
          if (w.id === warehouseId) {
            return {
              ...w,
              locations: (w.locations || []).map(loc =>
                loc.id === locationId ? updatedLocation : loc
              )
            };
          }
          return w;
        }));
        return updatedLocation;
      } catch (err) {
        console.error('API error updating location:', err);
        throw err;
      }
    }

    const updated = warehouses.map(w => {
      if (w.id === warehouseId) {
        return {
          ...w,
          locations: (w.locations || []).map(loc =>
            loc.id === locationId ? { ...loc, ...locationData } : loc
          )
        };
      }
      return w;
    });
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setWarehouses(updated);
  }, [backendAvailable, warehouses, activeCompany]);

  const deleteWarehouseLocation = useCallback(async (warehouseId, locationId) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(WAREHOUSES_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        await inventoryService.deleteWarehouseLocation(warehouseId, locationId);
        setWarehouses(prev => prev.map(w => {
          if (w.id === warehouseId) {
            return {
              ...w,
              locations: (w.locations || []).filter(loc => loc.id !== locationId)
            };
          }
          return w;
        }));
        return;
      } catch (err) {
        console.error('API error deleting location:', err);
        throw err;
      }
    }

    const updated = warehouses.map(w => {
      if (w.id === warehouseId) {
        return {
          ...w,
          locations: (w.locations || []).filter(loc => loc.id !== locationId)
        };
      }
      return w;
    });
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setWarehouses(updated);
  }, [backendAvailable, warehouses, activeCompany]);

  // ================== INVENTORY OPERATIONS ==================
  const adjustInventory = useCallback(async (adjustmentData) => {
    const companyId = activeCompany?.id;
    const inventoryKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);
    const movementsKey = getStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, companyId);

    // Check negative stock setting
    const existingItem = inventory.find(
      i => i.product_id === adjustmentData.product_id && i.warehouse_id === adjustmentData.warehouse_id
    );
    const currentQty = existingItem?.quantity || 0;
    const newQty = currentQty + adjustmentData.quantity;

    // Validate: prevent negative stock if setting disallows it
    if (newQty < 0 && !inventorySettings.allowNegativeStock) {
      throw new Error('Negative stock is not allowed. Enable "Allow Negative Stock" in Admin Settings to permit this operation.');
    }

    // Validate: require location if setting requires it
    if (inventorySettings.requireLocation && !adjustmentData.location_id) {
      throw new Error('Location is required. This setting is enabled in Admin Settings.');
    }

    if (backendAvailable) {
      try {
        const result = await inventoryService.adjustInventory(adjustmentData);
        // Refresh inventory data from backend after successful adjustment
        const inventoryData = await inventoryService.listInventory();
        setInventory(inventoryData || []);
        const movementsData = await inventoryService.listInventoryMovements();
        setStockMovements(movementsData || []);
        return result;
      } catch (err) {
        console.error('API error:', err);
        throw err; // Re-throw to let caller handle it
      }
    }

    // Update inventory (localStorage fallback when backend not available)
    const existingIndex = inventory.findIndex(
      i => i.product_id === adjustmentData.product_id && i.warehouse_id === adjustmentData.warehouse_id
    );

    let updatedInventory;
    if (existingIndex >= 0) {
      updatedInventory = inventory.map((item, idx) =>
        idx === existingIndex
          ? { ...item, quantity: item.quantity + adjustmentData.quantity }
          : item
      );
    } else {
      updatedInventory = [...inventory, {
        id: `inv_${Date.now()}`,
        product_id: adjustmentData.product_id,
        warehouse_id: adjustmentData.warehouse_id,
        location_id: adjustmentData.location_id,
        quantity: adjustmentData.quantity,
        reserved_quantity: 0,
        available_quantity: adjustmentData.quantity,
        created_at: new Date().toISOString()
      }];
    }
    localStorage.setItem(inventoryKey, JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

    // Create movement record
    const movement = {
      id: `mov_${Date.now()}`,
      product_id: adjustmentData.product_id,
      warehouse_id: adjustmentData.warehouse_id,
      movement_type: adjustmentData.movement_type || 'adjustment',
      quantity: adjustmentData.quantity,
      unit_cost: adjustmentData.unit_cost || 0,
      total_value: (adjustmentData.unit_cost || 0) * Math.abs(adjustmentData.quantity),
      reference: adjustmentData.reference || `ADJ-${Date.now()}`,
      notes: adjustmentData.reason,
      supplier_or_customer: adjustmentData.supplier_or_customer,
      created_at: new Date().toISOString()
    };
    const updatedMovements = [...stockMovements, movement];
    localStorage.setItem(movementsKey, JSON.stringify(updatedMovements));
    setStockMovements(updatedMovements);

    return movement;
  }, [backendAvailable, inventory, stockMovements, activeCompany]);

  const transferInventory = useCallback(async (transferData) => {
    const companyId = activeCompany?.id;
    const inventoryKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);
    const movementsKey = getStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        const result = await inventoryService.transferInventory(transferData);
        // Refresh inventory data from backend after successful transfer
        const inventoryData = await inventoryService.listInventory();
        setInventory(inventoryData || []);
        const movementsData = await inventoryService.listInventoryMovements();
        setStockMovements(movementsData || []);
        return result;
      } catch (err) {
        console.error('API error:', err);
        console.error('API error response:', err.response?.data);
        throw err; // Re-throw to let caller handle it
      }
    }

    // Decrement source
    let updatedInventory = inventory.map(item => {
      if (item.product_id === transferData.product_id && item.warehouse_id === transferData.from_warehouse_id) {
        return { ...item, quantity: item.quantity - transferData.quantity };
      }
      return item;
    });

    // Increment destination
    const destIndex = updatedInventory.findIndex(
      i => i.product_id === transferData.product_id && i.warehouse_id === transferData.to_warehouse_id
    );

    if (destIndex >= 0) {
      updatedInventory = updatedInventory.map((item, idx) =>
        idx === destIndex
          ? { ...item, quantity: item.quantity + transferData.quantity }
          : item
      );
    } else {
      updatedInventory.push({
        id: `inv_${Date.now()}`,
        product_id: transferData.product_id,
        warehouse_id: transferData.to_warehouse_id,
        location_id: transferData.to_location_id,
        quantity: transferData.quantity,
        reserved_quantity: 0,
        available_quantity: transferData.quantity,
        created_at: new Date().toISOString()
      });
    }

    localStorage.setItem(inventoryKey, JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

    // Create transfer movement record
    const movement = {
      id: `mov_${Date.now()}`,
      product_id: transferData.product_id,
      warehouse_id: transferData.from_warehouse_id,
      to_warehouse_id: transferData.to_warehouse_id,
      movement_type: 'transfer',
      quantity: transferData.quantity,
      reference: transferData.reference || `TRF-${Date.now()}`,
      notes: transferData.notes,
      created_at: new Date().toISOString()
    };
    const updatedMovements = [...stockMovements, movement];
    localStorage.setItem(movementsKey, JSON.stringify(updatedMovements));
    setStockMovements(updatedMovements);

    return movement;
  }, [backendAvailable, inventory, stockMovements, activeCompany]);

  const getInventoryValuation = useCallback(async () => {
    if (backendAvailable) {
      try {
        return await inventoryService.getInventoryValuation();
      } catch (err) {
        console.error('API error:', err);
      }
    }
    // Calculate from local data
    return inventory.reduce((total, item) => {
      const product = products.find(p => p.id === item.product_id);
      return total + (item.quantity * (product?.cost_price || 0));
    }, 0);
  }, [backendAvailable, inventory, products]);

  const getInventorySummary = useCallback(() => {
    const totalValue = inventory.reduce((total, item) => {
      const product = products.find(p => p.id === item.product_id);
      const qty = item.quantity_on_hand ?? item.quantity ?? 0;
      const unitCost = item.unit_cost ?? product?.cost_price ?? 0;
      return total + (qty * unitCost);
    }, 0);

    const totalItems = inventory.reduce((total, item) => {
      return total + (item.quantity_on_hand ?? item.quantity ?? 0);
    }, 0);

    const lowStockProducts = products.filter(p => {
      const stockItems = inventory.filter(i => i.product_id === p.id);
      const totalStock = stockItems.reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0);
      return p.is_stockable !== false && totalStock <= (p.min_stock_level || 0) && totalStock > 0;
    });

    return {
      totalValue,
      totalItems,
      totalProducts: products.length,
      totalWarehouses: warehouses.length,
      lowStockCount: lowStockProducts.length,
      lowStockProducts
    };
  }, [inventory, products, warehouses]);

  // Helper to get product stock across warehouses
  const getProductStock = useCallback((productId) => {
    return inventory
      .filter(i => i.product_id === productId)
      .map(i => ({
        ...i,
        warehouse: warehouses.find(w => w.id === i.warehouse_id)
      }));
  }, [inventory, warehouses]);

  // Helper to get warehouse inventory
  const getWarehouseInventory = useCallback((warehouseId) => {
    return inventory
      .filter(i => i.warehouse_id === warehouseId)
      .map(i => ({
        ...i,
        product: products.find(p => p.id === i.product_id)
      }));
  }, [inventory, products]);

  // ================== LOT/BATCH TRACKING ==================
  const createLot = useCallback(async (lotData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(LOTS_STORAGE_KEY, companyId);

    const newLot = {
      id: `lot_${Date.now()}`,
      lot_number: lotData.lot_number || `LOT-${new Date().getFullYear()}-${String(lots.length + 1).padStart(3, '0')}`,
      ...lotData,
      original_quantity: lotData.quantity,
      status: 'active',
      created_at: new Date().toISOString()
    };
    const updated = [...lots, newLot];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setLots(updated);
    return newLot;
  }, [lots, activeCompany]);

  const updateLot = useCallback(async (id, lotData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(LOTS_STORAGE_KEY, companyId);
    const updated = lots.map(l => l.id === id ? { ...l, ...lotData } : l);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setLots(updated);
  }, [lots, activeCompany]);

  const deleteLot = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(LOTS_STORAGE_KEY, companyId);
    const updated = lots.filter(l => l.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setLots(updated);
  }, [lots, activeCompany]);

  const consumeLot = useCallback(async (lotId, quantity) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(LOTS_STORAGE_KEY, companyId);
    const updated = lots.map(l => {
      if (l.id === lotId) {
        const newQty = l.quantity - quantity;
        return { ...l, quantity: Math.max(0, newQty), status: newQty <= 0 ? 'depleted' : 'active' };
      }
      return l;
    });
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setLots(updated);
  }, [lots, activeCompany]);

  const getProductLots = useCallback((productId) => {
    return lots
      .filter(l => l.product_id === productId && l.status === 'active')
      .sort((a, b) => new Date(a.received_date) - new Date(b.received_date)); // FIFO order
  }, [lots]);

  const getExpiringLots = useCallback((daysAhead = 30) => {
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return lots
      .filter(l => l.expiry_date && new Date(l.expiry_date) <= futureDate && l.status === 'active')
      .map(l => ({
        ...l,
        product: products.find(p => p.id === l.product_id),
        warehouse: warehouses.find(w => w.id === l.warehouse_id),
        daysUntilExpiry: Math.ceil((new Date(l.expiry_date) - new Date()) / (24 * 60 * 60 * 1000))
      }))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [lots, products, warehouses]);

  // ================== STOCK COUNTING (INVENTARIZATSIYA) ==================
  const createStockCount = useCallback(async (countData) => {
    if (backendAvailable) {
      try {
        const newCount = await inventoryService.createStockCount({
          warehouse_id: countData.warehouse_id,
          organization_id: countData.organization_id || null,
          count_date: countData.count_date || new Date().toISOString().split('T')[0],
          count_type: countData.count_type || 'full',
          notes: countData.notes || '',
          counted_by: countData.counted_by || '',
          selected_products: countData.selected_products || [],
        });
        // Refresh stock counts list from backend
        const stockCountsData = await inventoryService.listStockCounts();
        setStockCounts(stockCountsData || []);
        return newCount;
      } catch (err) {
        console.error('[InventoryContext] Failed to create stock count via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage-only mode
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STOCK_COUNTS_STORAGE_KEY, companyId);

    // Get current inventory for the warehouse
    let warehouseInventory = inventory.filter(i => i.warehouse_id === countData.warehouse_id);

    // If specific products are selected, filter to only those
    if (countData.selected_products && countData.selected_products.length > 0) {
      warehouseInventory = warehouseInventory.filter(i =>
        countData.selected_products.includes(i.product_id)
      );
    }

    const lines = warehouseInventory.map(inv => ({
      product_id: inv.product_id,
      system_qty: inv.quantity_on_hand ?? inv.quantity ?? 0,
      counted_qty: null,
      variance: null,
      variance_reason: null
    }));

    const newCount = {
      id: `sc_${Date.now()}`,
      count_number: `INV-${new Date().getFullYear()}-${String(stockCounts.length + 1).padStart(3, '0')}`,
      warehouse_id: countData.warehouse_id,
      count_date: countData.count_date || new Date().toISOString().split('T')[0],
      status: 'draft',
      counted_by: countData.counted_by || '',
      approved_by: null,
      notes: countData.notes || '',
      lines,
      created_at: new Date().toISOString(),
      completed_at: null
    };
    const updated = [...stockCounts, newCount];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setStockCounts(updated);
    return newCount;
  }, [stockCounts, inventory, activeCompany, backendAvailable]);

  const updateStockCountLine = useCallback(async (countId, productId, countedQty, reason, systemQtyOverride) => {
    if (backendAvailable) {
      try {
        await inventoryService.recordCountLine(countId, {
          product_id: productId,
          counted_quantity: countedQty,
          notes: reason || '',
        });
        // Refresh this stock count from backend
        const updatedCount = await inventoryService.getStockCount(countId);
        setStockCounts(prev => prev.map(sc => sc.id === countId ? updatedCount : sc));
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to record count line via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage-only mode
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STOCK_COUNTS_STORAGE_KEY, companyId);
    const updated = stockCounts.map(sc => {
      if (sc.id === countId) {
        const updatedLines = sc.lines.map(line => {
          if (line.product_id === productId) {
            const systemQty = systemQtyOverride ?? line.system_qty ?? 0;
            const variance = countedQty - systemQty;
            return {
              ...line,
              counted_qty: countedQty,
              variance,
              variance_reason: reason || null,
              system_qty: systemQty
            };
          }
          return line;
        });
        return { ...sc, lines: updatedLines, status: 'in_progress' };
      }
      return sc;
    });
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setStockCounts(updated);
  }, [stockCounts, activeCompany, backendAvailable]);

  const completeStockCount = useCallback(async (countId, approvedBy) => {
    if (backendAvailable) {
      try {
        // Backend handles everything: inventory adjustments + journal entries
        await inventoryService.completeStockCount(countId);

        // Refresh all data from backend
        const [stockCountsData, inventoryData, movementsData] = await Promise.all([
          inventoryService.listStockCounts(),
          inventoryService.listInventory(),
          inventoryService.listInventoryMovements(),
        ]);
        setStockCounts(stockCountsData || []);
        setInventory(inventoryData || []);
        setStockMovements(movementsData || []);
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to complete stock count via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage-only mode
    const companyId = activeCompany?.id;
    const countsKey = getStorageKey(STOCK_COUNTS_STORAGE_KEY, companyId);
    const inventoryKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);
    const movementsKey = getStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, companyId);

    const count = stockCounts.find(sc => sc.id === countId);
    if (!count) return;

    const linesWithVariance = (count.lines || []).filter(line => line.variance && line.variance !== 0);

    let updatedInventory = [...inventory];
    const newMovements = [];

    linesWithVariance.forEach(line => {
      updatedInventory = updatedInventory.map(inv => {
        if (inv.product_id === line.product_id && inv.warehouse_id === count.warehouse_id) {
          return { ...inv, quantity: line.counted_qty, last_count_date: new Date().toISOString() };
        }
        return inv;
      });

      newMovements.push({
        id: `mov_${Date.now()}_${line.product_id}`,
        product_id: line.product_id,
        warehouse_id: count.warehouse_id,
        movement_type: 'adjustment',
        quantity: line.variance,
        reference: count.count_number,
        notes: `Inventory count adjustment: ${line.variance_reason || 'Count variance'}`,
        created_at: new Date().toISOString()
      });
    });

    localStorage.setItem(inventoryKey, JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

    const updatedMovements = [...stockMovements, ...newMovements];
    localStorage.setItem(movementsKey, JSON.stringify(updatedMovements));
    setStockMovements(updatedMovements);

    const updatedCounts = stockCounts.map(sc =>
      sc.id === countId
        ? { ...sc, status: 'completed', approved_by: approvedBy, completed_at: new Date().toISOString() }
        : sc
    );
    localStorage.setItem(countsKey, JSON.stringify(updatedCounts));
    setStockCounts(updatedCounts);
  }, [stockCounts, inventory, stockMovements, activeCompany, backendAvailable]);

  const cancelStockCount = useCallback(async (countId) => {
    if (backendAvailable) {
      try {
        await inventoryService.deleteStockCount(countId);
        setStockCounts(prev => prev.filter(sc => sc.id !== countId));
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to delete stock count via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage-only mode
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STOCK_COUNTS_STORAGE_KEY, companyId);
    const updated = stockCounts.map(sc =>
      sc.id === countId ? { ...sc, status: 'cancelled' } : sc
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setStockCounts(updated);
  }, [stockCounts, activeCompany, backendAvailable]);

  // ================== BILL OF MATERIALS (BOM) ==================
  const createBOM = useCallback(async (bomData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BOMS_STORAGE_KEY, companyId);

    const newBOM = {
      id: `bom_${Date.now()}`,
      code: bomData.code || `BOM-${Date.now()}`,
      ...bomData,
      is_active: true,
      created_at: new Date().toISOString()
    };
    const updated = [...boms, newBOM];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBOMs(updated);
    return newBOM;
  }, [boms, activeCompany]);

  const updateBOM = useCallback(async (id, bomData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BOMS_STORAGE_KEY, companyId);
    const updated = boms.map(b => b.id === id ? { ...b, ...bomData } : b);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBOMs(updated);
  }, [boms, activeCompany]);

  const deleteBOM = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const bomsKey = getStorageKey(BOMS_STORAGE_KEY, companyId);
    const linesKey = getStorageKey(BOM_LINES_STORAGE_KEY, companyId);

    // Delete BOM
    const updatedBOMs = boms.filter(b => b.id !== id);
    localStorage.setItem(bomsKey, JSON.stringify(updatedBOMs));
    setBOMs(updatedBOMs);

    // Delete associated lines
    const updatedLines = bomLines.filter(l => l.bom_id !== id);
    localStorage.setItem(linesKey, JSON.stringify(updatedLines));
    setBOMLines(updatedLines);
  }, [boms, bomLines, activeCompany]);

  const createBOMLine = useCallback(async (lineData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BOM_LINES_STORAGE_KEY, companyId);

    const newLine = {
      id: `boml_${Date.now()}`,
      ...lineData,
      created_at: new Date().toISOString()
    };
    const updated = [...bomLines, newLine];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBOMLines(updated);
    return newLine;
  }, [bomLines, activeCompany]);

  const updateBOMLine = useCallback(async (id, lineData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BOM_LINES_STORAGE_KEY, companyId);
    const updated = bomLines.map(l => l.id === id ? { ...l, ...lineData } : l);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBOMLines(updated);
  }, [bomLines, activeCompany]);

  const deleteBOMLine = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(BOM_LINES_STORAGE_KEY, companyId);
    const updated = bomLines.filter(l => l.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setBOMLines(updated);
  }, [bomLines, activeCompany]);

  const getBOMLinesByBOM = useCallback((bomId) => {
    return bomLines.filter(l => l.bom_id === bomId);
  }, [bomLines]);

  const calculateBOMCost = useCallback((bomId) => {
    const lines = getBOMLinesByBOM(bomId);
    return lines.reduce((total, line) => {
      const component = products.find(p => p.id === line.component_id);
      return total + (line.quantity * (component?.cost_price || 0));
    }, 0);
  }, [getBOMLinesByBOM, products]);

  // ================== REORDER RULES ==================
  const createReorderRule = useCallback(async (ruleData) => {
    if (backendAvailable) {
      try {
        const result = await inventoryService.createReorderRule({
          product_id: ruleData.product_id,
          warehouse_id: ruleData.warehouse_id || undefined,
          min_qty: parseFloat(ruleData.min_qty) || 0,
          max_qty: parseFloat(ruleData.max_qty) || 0,
          reorder_qty: parseFloat(ruleData.reorder_qty) || 0,
          trigger_type: ruleData.trigger_type || 'min_qty',
          lead_time_days: parseInt(ruleData.lead_time_days) || 0,
          safety_stock: parseFloat(ruleData.safety_stock) || 0,
          auto_create_po: !!ruleData.auto_create_po,
          notes: ruleData.notes || '',
        });
        const rulesList = await inventoryService.listReorderRules();
        setReorderRules(rulesList || []);
        return result;
      } catch (err) {
        console.error('[InventoryContext] Failed to create reorder rule via API:', err);
        throw err;
      }
    }

    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(REORDER_RULES_STORAGE_KEY, companyId);

    const newRule = {
      id: `rr_${Date.now()}`,
      ...ruleData,
      is_active: true,
      created_at: new Date().toISOString()
    };
    const updated = [...reorderRules, newRule];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setReorderRules(updated);
    return newRule;
  }, [reorderRules, activeCompany, backendAvailable]);

  const updateReorderRule = useCallback(async (id, ruleData) => {
    if (backendAvailable) {
      try {
        const updateData = {};
        if (ruleData.min_qty !== undefined) updateData.min_qty = parseFloat(ruleData.min_qty);
        if (ruleData.max_qty !== undefined) updateData.max_qty = parseFloat(ruleData.max_qty);
        if (ruleData.reorder_qty !== undefined) updateData.reorder_qty = parseFloat(ruleData.reorder_qty);
        if (ruleData.trigger_type !== undefined) updateData.trigger_type = ruleData.trigger_type;
        if (ruleData.lead_time_days !== undefined) updateData.lead_time_days = parseInt(ruleData.lead_time_days);
        if (ruleData.safety_stock !== undefined) updateData.safety_stock = parseFloat(ruleData.safety_stock);
        if (ruleData.auto_create_po !== undefined) updateData.auto_create_po = ruleData.auto_create_po;
        if (ruleData.is_active !== undefined) updateData.is_active = ruleData.is_active;
        if (ruleData.notes !== undefined) updateData.notes = ruleData.notes;

        await inventoryService.updateReorderRule(id, updateData);
        const rulesList = await inventoryService.listReorderRules();
        setReorderRules(rulesList || []);
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to update reorder rule via API:', err);
        throw err;
      }
    }

    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(REORDER_RULES_STORAGE_KEY, companyId);
    const updated = reorderRules.map(r => r.id === id ? { ...r, ...ruleData } : r);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setReorderRules(updated);
  }, [reorderRules, activeCompany, backendAvailable]);

  const deleteReorderRule = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await inventoryService.deleteReorderRule(id);
        const rulesList = await inventoryService.listReorderRules();
        setReorderRules(rulesList || []);
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to delete reorder rule via API:', err);
        throw err;
      }
    }

    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(REORDER_RULES_STORAGE_KEY, companyId);
    const updated = reorderRules.filter(r => r.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setReorderRules(updated);
  }, [reorderRules, activeCompany, backendAvailable]);

  const getReorderRulesByProduct = useCallback((productId) => {
    return reorderRules.filter(r => r.product_id === productId);
  }, [reorderRules]);

  const checkReorderNeeded = useCallback(() => {
    const productsNeedingReorder = [];

    reorderRules.filter(r => r.is_active).forEach(rule => {
      const productInventory = inventory.filter(i =>
        i.product_id === rule.product_id &&
        (!rule.warehouse_id || i.warehouse_id === rule.warehouse_id)
      );
      const totalStock = productInventory.reduce((sum, i) => sum + i.quantity, 0);

      if (totalStock <= rule.min_qty) {
        const product = products.find(p => p.id === rule.product_id);
        const maxQty = rule.max_qty || rule.min_qty;
        const suggestedOrder = Math.max(maxQty - totalStock, 0);
        productsNeedingReorder.push({
          ...rule,
          product,
          current_stock: totalStock,
          shortage: rule.min_qty - totalStock,
          suggested_order: suggestedOrder
        });
      }
    });

    return productsNeedingReorder;
  }, [reorderRules, inventory, products]);

  // ================== SCRAP MANAGEMENT ==================
  const createScrapOrder = useCallback(async (scrapData) => {
    if (backendAvailable) {
      try {
        const product = products.find(p => p.id === scrapData.product_id);
        const result = await inventoryService.createScrapOrder({
          product_id: scrapData.product_id,
          warehouse_id: scrapData.warehouse_id,
          quantity: scrapData.quantity,
          unit_cost: product?.cost_price || 0,
          reason: scrapData.reason,
          reason_notes: scrapData.reason_notes || '',
          scrap_date: scrapData.scrap_date || new Date().toISOString().split('T')[0],
          notes: scrapData.notes || '',
        });
        const scrapList = await inventoryService.listScrapOrders();
        setScrapOrders(scrapList || []);
        return result;
      } catch (err) {
        console.error('[InventoryContext] Failed to create scrap order via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(SCRAP_ORDERS_STORAGE_KEY, companyId);

    const product = products.find(p => p.id === scrapData.product_id);
    const costImpact = scrapData.quantity * (product?.cost_price || 0);

    const newScrap = {
      id: `scrap_${Date.now()}`,
      scrap_number: `SCRAP-${new Date().getFullYear()}-${String(scrapOrders.length + 1).padStart(3, '0')}`,
      ...scrapData,
      cost_impact: costImpact,
      status: 'draft',
      created_at: new Date().toISOString()
    };
    const updated = [...scrapOrders, newScrap];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setScrapOrders(updated);
    return newScrap;
  }, [scrapOrders, products, activeCompany, backendAvailable]);

  const updateScrapOrder = useCallback(async (id, scrapData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(SCRAP_ORDERS_STORAGE_KEY, companyId);
    const updated = scrapOrders.map(s => s.id === id ? { ...s, ...scrapData } : s);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setScrapOrders(updated);
  }, [scrapOrders, activeCompany]);

  const confirmScrapOrder = useCallback(async (id, approvedBy) => {
    if (backendAvailable) {
      try {
        await inventoryService.confirmScrapOrder(id);
        // Refresh scrap orders, inventory, and movements
        const [scrapList, inventoryData, movementsData] = await Promise.all([
          inventoryService.listScrapOrders(),
          inventoryService.listInventory(),
          inventoryService.listInventoryMovements(),
        ]);
        setScrapOrders(scrapList || []);
        setInventory(inventoryData || []);
        setStockMovements(movementsData || []);
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to confirm scrap order via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage
    const companyId = activeCompany?.id;
    const scrapKey = getStorageKey(SCRAP_ORDERS_STORAGE_KEY, companyId);
    const inventoryKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);
    const movementsKey = getStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, companyId);

    const scrap = scrapOrders.find(s => s.id === id);
    if (!scrap) return;

    // Reduce inventory
    const updatedInventory = inventory.map(inv => {
      if (inv.product_id === scrap.product_id && inv.warehouse_id === scrap.warehouse_id) {
        return { ...inv, quantity: Math.max(0, inv.quantity - scrap.quantity) };
      }
      return inv;
    });
    localStorage.setItem(inventoryKey, JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

    // Create scrap movement
    const movement = {
      id: `mov_${Date.now()}`,
      product_id: scrap.product_id,
      warehouse_id: scrap.warehouse_id,
      movement_type: 'scrap',
      quantity: -scrap.quantity,
      reference: scrap.scrap_number,
      notes: `Scrapped: ${scrap.reason} - ${scrap.reason_notes || ''}`,
      created_at: new Date().toISOString()
    };
    const updatedMovements = [...stockMovements, movement];
    localStorage.setItem(movementsKey, JSON.stringify(updatedMovements));
    setStockMovements(updatedMovements);

    // Update scrap status
    const updatedScraps = scrapOrders.map(s =>
      s.id === id
        ? { ...s, status: 'completed', approved_by: approvedBy, completed_at: new Date().toISOString() }
        : s
    );
    localStorage.setItem(scrapKey, JSON.stringify(updatedScraps));
    setScrapOrders(updatedScraps);
  }, [scrapOrders, inventory, stockMovements, activeCompany, backendAvailable]);

  const cancelScrapOrder = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await inventoryService.cancelScrapOrder(id);
        const scrapList = await inventoryService.listScrapOrders();
        setScrapOrders(scrapList || []);
        return;
      } catch (err) {
        console.error('[InventoryContext] Failed to cancel scrap order via API:', err);
        throw err;
      }
    }

    // Fallback: localStorage
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(SCRAP_ORDERS_STORAGE_KEY, companyId);
    const updated = scrapOrders.map(s =>
      s.id === id ? { ...s, status: 'cancelled' } : s
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setScrapOrders(updated);
  }, [scrapOrders, activeCompany, backendAvailable]);

  const getScrapSummary = useCallback(() => {
    const completed = scrapOrders.filter(s => s.status === 'completed');
    const totalCost = completed.reduce((sum, s) => sum + (s.total_cost || s.cost_impact || 0), 0);
    const totalQuantity = completed.reduce((sum, s) => sum + (s.quantity || 0), 0);

    const byReason = completed.reduce((acc, s) => {
      const reason = s.reason || 'other';
      acc[reason] = (acc[reason] || 0) + (s.quantity || 0);
      return acc;
    }, {});

    return {
      totalOrders: completed.length,
      totalCost,
      totalQuantity,
      byReason,
      pendingOrders: scrapOrders.filter(s => s.status === 'draft').length
    };
  }, [scrapOrders]);

  // Legacy compatibility - items mapped to products with stock info
  const items = products.map(p => {
    const stockItems = inventory.filter(i => i.product_id === p.id);
    // Handle both backend (quantity_on_hand) and localStorage (quantity) field names
    const totalStock = stockItems.reduce((sum, i) => sum + (i.quantity_on_hand ?? i.quantity ?? 0), 0);
    return {
      ...p,
      current_stock: totalStock,
      status: totalStock <= 0 ? 'out_of_stock' : totalStock <= (p.min_stock_level || 0) ? 'low_stock' : 'active'
    };
  });

  const value = useMemo(() => ({
    // Products
    products,
    createProduct,
    updateProduct,
    deleteProduct,

    // Categories
    categories,
    createCategory,
    updateCategory,
    deleteCategory,

    // Warehouses
    warehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    createWarehouseLocation,
    updateWarehouseLocation,
    deleteWarehouseLocation,

    // Inventory
    inventory,
    stockMovements,
    adjustInventory,
    transferInventory,
    getInventoryValuation,
    getInventorySummary,
    getProductStock,
    getWarehouseInventory,

    // Lot/Batch Tracking
    lots,
    createLot,
    updateLot,
    deleteLot,
    consumeLot,
    getProductLots,
    getExpiringLots,

    // Stock Counting (Inventarizatsiya)
    stockCounts,
    createStockCount,
    updateStockCountLine,
    completeStockCount,
    cancelStockCount,

    // Bill of Materials (BOM)
    boms,
    bomLines,
    createBOM,
    updateBOM,
    deleteBOM,
    createBOMLine,
    updateBOMLine,
    deleteBOMLine,
    getBOMLinesByBOM,
    calculateBOMCost,

    // Reorder Rules
    reorderRules,
    createReorderRule,
    updateReorderRule,
    deleteReorderRule,
    getReorderRulesByProduct,
    checkReorderNeeded,

    // Scrap Management
    scrapOrders,
    createScrapOrder,
    updateScrapOrder,
    confirmScrapOrder,
    cancelScrapOrder,
    getScrapSummary,

    // Legacy compatibility
    items,
    createItem: createProduct,
    updateItem: updateProduct,
    deleteItem: deleteProduct,
    createStockMovement: adjustInventory,
    listItems: () => items,
    listMovements: () => stockMovements,

    // State
    isLoading,
    backendAvailable,
    error,
    refreshData: loadData,

    // Admin Settings
    settings: inventorySettings,
    isCostingMethod: (method) => inventorySettings.costingMethod === method,
    isLotTrackingEnabled: () => inventorySettings.lotTrackingEnabled,
    isSerialTrackingEnabled: () => inventorySettings.serialTrackingEnabled,
    isExpiryTrackingEnabled: () => inventorySettings.expiryTrackingEnabled,
    canHaveNegativeStock: () => inventorySettings.allowNegativeStock,
    requiresLocation: () => inventorySettings.requireLocation,
    isMultiLocationEnabled: () => inventorySettings.multiLocationEnabled,
    isAutoReorderEnabled: () => inventorySettings.autoReorderEnabled,
    getDefaultUnit: () => inventorySettings.defaultUnit,
    getUnitsOfMeasure: () => inventorySettings.unitsOfMeasure
  }), [products, createProduct, updateProduct, deleteProduct, categories, createCategory, updateCategory, deleteCategory, warehouses, createWarehouse, updateWarehouse, deleteWarehouse, createWarehouseLocation, updateWarehouseLocation, deleteWarehouseLocation, inventory, stockMovements, adjustInventory, transferInventory, getInventoryValuation, getInventorySummary, getProductStock, getWarehouseInventory, lots, createLot, updateLot, deleteLot, consumeLot, getProductLots, getExpiringLots, stockCounts, createStockCount, updateStockCountLine, completeStockCount, cancelStockCount, boms, bomLines, createBOM, updateBOM, deleteBOM, createBOMLine, updateBOMLine, deleteBOMLine, getBOMLinesByBOM, calculateBOMCost, reorderRules, createReorderRule, updateReorderRule, deleteReorderRule, getReorderRulesByProduct, checkReorderNeeded, scrapOrders, createScrapOrder, updateScrapOrder, confirmScrapOrder, cancelScrapOrder, getScrapSummary, items, isLoading, backendAvailable, error, loadData, inventorySettings]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}
