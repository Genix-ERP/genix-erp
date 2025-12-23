import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { inventoryService } from '@/api/services';
import { useCompany } from './CompanyContext';

const INVENTORY_STORAGE_KEY = 'genix_inventory';
const STOCK_MOVEMENTS_STORAGE_KEY = 'genix_stock_movements';

const InventoryContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

// Check if backend is available
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const checkBackendAvailable = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/info`);
    return response.ok;
  } catch {
    return false;
  }
};

// Sample inventory data for demo
const sampleInventory = [
  {
    id: 'inv_1',
    name: 'Laptop Pro 15"',
    sku: 'ELEC-LP15-001',
    category: 'electronics',
    description: 'High-performance laptop with 16GB RAM',
    current_stock: 45,
    reorder_level: 20,
    reorder_quantity: 50,
    unit_cost: 899,
    selling_price: 1299,
    supplier: 'TechSupply Inc',
    location: 'Warehouse A-1',
    status: 'active',
    costing_method: 'fifo',
    sales_velocity: 3.2,
    abc_classification: 'A',
    last_movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  },
  {
    id: 'inv_2',
    name: 'Wireless Mouse',
    sku: 'ELEC-WM-002',
    category: 'electronics',
    description: 'Ergonomic wireless mouse',
    current_stock: 8,
    reorder_level: 25,
    reorder_quantity: 100,
    unit_cost: 15,
    selling_price: 29.99,
    supplier: 'TechSupply Inc',
    location: 'Warehouse A-2',
    status: 'low_stock',
    costing_method: 'fifo',
    sales_velocity: 8.5,
    abc_classification: 'B',
    last_movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  },
  {
    id: 'inv_3',
    name: 'Office Chair Premium',
    sku: 'FURN-OC-001',
    category: 'office',
    description: 'Ergonomic office chair with lumbar support',
    current_stock: 32,
    reorder_level: 10,
    reorder_quantity: 20,
    unit_cost: 250,
    selling_price: 449,
    supplier: 'ComfortSeating Co',
    location: 'Warehouse B-1',
    status: 'active',
    costing_method: 'weighted_average',
    sales_velocity: 1.2,
    abc_classification: 'A',
    last_movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  },
  {
    id: 'inv_4',
    name: 'USB-C Cable 2m',
    sku: 'ELEC-USB-003',
    category: 'electronics',
    description: 'High-speed USB-C charging cable',
    current_stock: 250,
    reorder_level: 100,
    reorder_quantity: 500,
    unit_cost: 3,
    selling_price: 12.99,
    supplier: 'CableMasters',
    location: 'Warehouse A-3',
    status: 'active',
    costing_method: 'fifo',
    sales_velocity: 15.3,
    abc_classification: 'C',
    last_movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  },
  {
    id: 'inv_5',
    name: 'Standing Desk',
    sku: 'FURN-SD-001',
    category: 'office',
    description: 'Electric height-adjustable standing desk',
    current_stock: 0,
    reorder_level: 5,
    reorder_quantity: 10,
    unit_cost: 450,
    selling_price: 799,
    supplier: 'DeskWorks Ltd',
    location: 'Warehouse B-2',
    status: 'backordered',
    costing_method: 'fifo',
    sales_velocity: 0.8,
    abc_classification: 'A',
    last_movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  }
];

const sampleStockMovements = [
  {
    id: 'mov_1',
    item_id: 'inv_1',
    movement_type: 'inbound',
    quantity: 20,
    unit_cost: 899,
    reference: 'PO-2025-001',
    notes: 'Regular stock replenishment',
    movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  },
  {
    id: 'mov_2',
    item_id: 'inv_1',
    movement_type: 'outbound',
    quantity: 5,
    unit_cost: 899,
    reference: 'SO-2025-001',
    notes: 'Customer order fulfillment',
    movement_date: new Date().toISOString(),
    created_date: new Date().toISOString()
  }
];

export function InventoryProvider({ children }) {
  const { activeCompany } = useCompany();
  const [items, setItems] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [error, setError] = useState(null);

  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;
    const itemsKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);
    const movementsKey = getStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, companyId);

    const storedItems = localStorage.getItem(itemsKey);
    setItems(storedItems ? JSON.parse(storedItems) : sampleInventory);

    const storedMovements = localStorage.getItem(movementsKey);
    setStockMovements(storedMovements ? JSON.parse(storedMovements) : sampleStockMovements);

    if (!storedItems) localStorage.setItem(itemsKey, JSON.stringify(sampleInventory));
    if (!storedMovements) localStorage.setItem(movementsKey, JSON.stringify(sampleStockMovements));
  }, [activeCompany]);

  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      const isAvailable = await checkBackendAvailable();
      setBackendAvailable(isAvailable);

      if (isAvailable) {
        try {
          const [products, inventory, movements] = await Promise.all([
            inventoryService.listProducts(),
            inventoryService.listInventory(),
            inventoryService.listInventoryMovements()
          ]);

          // Merge products and inventory data
          const mergedItems = (products || []).map(product => {
            const stock = (inventory || []).find(s => s.product_id === product.id);
            return {
              ...product,
              current_stock: stock?.quantity || 0,
              location: stock?.location || 'Unknown'
            };
          });

          setItems(mergedItems.length > 0 ? mergedItems : sampleInventory);
          setStockMovements(movements || sampleStockMovements);
        } catch (apiError) {
          console.warn('API call failed, falling back to localStorage:', apiError);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    } catch (err) {
      console.error('Error loading inventory data:', err);
      setError(err.message);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromLocalStorage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for company change events
  useEffect(() => {
    const handleCompanyChange = () => {
      loadData();
    };
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [loadData]);

  // Inventory Item CRUD
  const createItem = useCallback(async (itemData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        const newProduct = await inventoryService.createProduct({
          ...itemData,
          company_id: companyId
        });
        setItems(prev => [...prev, newProduct]);
        return newProduct;
      } catch (err) {
        console.error('API error, falling back to local:', err);
      }
    }

    const newItem = {
      id: `inv_${Date.now()}`,
      ...itemData,
      company_id: companyId,
      costing_method: itemData.costing_method || 'fifo',
      sales_velocity: 0,
      abc_classification: 'C',
      last_movement_date: new Date().toISOString(),
      created_date: new Date().toISOString()
    };
    const updated = [...items, newItem];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setItems(updated);
    return newItem;
  }, [backendAvailable, items, activeCompany]);

  const updateItem = useCallback(async (id, itemData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        await inventoryService.updateProduct(id, itemData);
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const updated = items.map(item => item.id === id ? { ...item, ...itemData } : item);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setItems(updated);
  }, [backendAvailable, items, activeCompany]);

  const deleteItem = useCallback(async (id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(INVENTORY_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        await inventoryService.deleteProduct(id);
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const updated = items.filter(item => item.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setItems(updated);
  }, [backendAvailable, items, activeCompany]);

  // Stock Movement CRUD
  const createStockMovement = useCallback(async (movementData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(STOCK_MOVEMENTS_STORAGE_KEY, companyId);

    if (backendAvailable) {
      try {
        if (movementData.movement_type === 'inbound' || movementData.movement_type === 'outbound') {
          await inventoryService.adjustInventory({
            product_id: movementData.item_id,
            quantity: movementData.movement_type === 'inbound' ? movementData.quantity : -movementData.quantity,
            reason: movementData.notes,
            reference: movementData.reference
          });
        }
      } catch (err) {
        console.error('API error:', err);
      }
    }

    const newMovement = {
      id: `mov_${Date.now()}`,
      ...movementData,
      company_id: companyId,
      movement_date: new Date().toISOString(),
      created_date: new Date().toISOString()
    };
    const updated = [...stockMovements, newMovement];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setStockMovements(updated);

    // Update item stock based on movement
    const item = items.find(i => i.id === movementData.item_id);
    if (item) {
      const stockChange = movementData.movement_type === 'inbound' ? movementData.quantity : -movementData.quantity;
      updateItem(item.id, {
        current_stock: item.current_stock + stockChange,
        last_movement_date: new Date().toISOString()
      });
    }

    return newMovement;
  }, [backendAvailable, stockMovements, items, updateItem, activeCompany]);

  // Transfer inventory between locations
  const transferInventory = useCallback(async (data) => {
    if (backendAvailable) {
      try {
        await inventoryService.transferInventory(data);
      } catch (err) {
        console.error('API error:', err);
      }
    }
    // Local handling would go here
  }, [backendAvailable]);

  // Get inventory valuation
  const getInventoryValuation = useCallback(async () => {
    if (backendAvailable) {
      try {
        return await inventoryService.getInventoryValuation();
      } catch (err) {
        console.error('API error:', err);
      }
    }
    // Calculate from local data
    return items.reduce((total, item) => total + (item.current_stock * item.unit_cost), 0);
  }, [backendAvailable, items]);

  const listItems = useCallback((sortField) => {
    let sorted = [...items];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return sorted;
  }, [items]);

  const listMovements = useCallback((sortField, limit) => {
    let sorted = [...stockMovements];
    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => desc ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1));
    }
    return limit ? sorted.slice(0, limit) : sorted;
  }, [stockMovements]);

  return (
    <InventoryContext.Provider value={{
      items,
      stockMovements,
      isLoading,
      backendAvailable,
      error,
      createItem,
      updateItem,
      deleteItem,
      createStockMovement,
      transferInventory,
      getInventoryValuation,
      listItems,
      listMovements,
      refreshData: loadData
    }}>
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
