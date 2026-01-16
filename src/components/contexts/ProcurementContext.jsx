import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import procurementService from '@/api/services/procurement';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';

const ProcurementContext = createContext(null);

// Helper to get storage key with demo prefix
const getStorageKey = (key) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return `${prefix}${key}`;
};

// Storage keys
const STORAGE_KEYS = {
  SUPPLIERS: 'genix_suppliers',
  PURCHASE_ORDERS: 'genix_purchase_orders',
  RFQS: 'genix_rfqs',
  CONTRACTS: 'genix_contracts',
  PRICE_HISTORY: 'genix_price_history',
};

// Sample data
const sampleSuppliers = [
  {
    id: '1',
    code: 'SUP-001',
    name: 'Tashkent Trade LLC',
    contact_person: 'Akmal Karimov',
    email: 'info@tashkenttrade.uz',
    phone: '+998 71 123 4567',
    address: 'Tashkent, Mirzo Ulugbek tumani',
    tax_id: '123456789',
    payment_terms: 'net_30',
    currency: 'UZS',
    rating: 4.5,
    total_orders: 45,
    total_spent: 125000000,
    status: 'active',
    categories: ['Electronics', 'Office Supplies'],
    created_at: '2024-01-15',
  },
  {
    id: '2',
    code: 'SUP-002',
    name: 'Global Import Export',
    contact_person: 'Dilshod Rahimov',
    email: 'sales@globalimport.uz',
    phone: '+998 90 234 5678',
    address: 'Samarkand, Registon',
    tax_id: '987654321',
    payment_terms: 'net_60',
    currency: 'USD',
    rating: 4.2,
    total_orders: 32,
    total_spent: 85000,
    status: 'active',
    categories: ['Raw Materials', 'Chemicals'],
    created_at: '2024-02-20',
  },
  {
    id: '3',
    code: 'SUP-003',
    name: 'Ferghana Textiles',
    contact_person: 'Nodira Yusupova',
    email: 'orders@ferghanatextiles.uz',
    phone: '+998 73 345 6789',
    address: 'Ferghana viloyati',
    tax_id: '456789123',
    payment_terms: 'net_30',
    currency: 'UZS',
    rating: 4.8,
    total_orders: 78,
    total_spent: 250000000,
    status: 'active',
    categories: ['Textiles', 'Fabrics'],
    created_at: '2023-11-10',
  },
];

const sampleRFQs = [
  {
    id: '1',
    rfq_number: 'RFQ-2024-001',
    title: 'Ofis jihozlari uchun taklif',
    description: 'Kompyuter va ofis jihozlari sotib olish uchun narx taklifi',
    status: 'open',
    deadline: '2024-02-15',
    created_at: '2024-02-01',
    created_by: 'Admin',
    items: [
      { name: 'Kompyuter Dell', quantity: 10, unit: 'dona' },
      { name: 'Monitor LG 24"', quantity: 10, unit: 'dona' },
      { name: 'Stol', quantity: 20, unit: 'dona' },
    ],
    suppliers_invited: ['1', '2'],
    responses: [
      { supplier_id: '1', total_amount: 150000000, submitted_at: '2024-02-05', status: 'submitted' },
    ],
  },
  {
    id: '2',
    rfq_number: 'RFQ-2024-002',
    title: 'Xom ashyo uchun taklif',
    description: 'Ishlab chiqarish uchun xom ashyo',
    status: 'closed',
    deadline: '2024-01-20',
    created_at: '2024-01-05',
    created_by: 'Admin',
    items: [
      { name: 'Paxta', quantity: 1000, unit: 'kg' },
      { name: 'Ip', quantity: 500, unit: 'kg' },
    ],
    suppliers_invited: ['2', '3'],
    responses: [
      { supplier_id: '2', total_amount: 50000, submitted_at: '2024-01-15', status: 'accepted' },
      { supplier_id: '3', total_amount: 55000, submitted_at: '2024-01-18', status: 'rejected' },
    ],
    winner_supplier_id: '2',
  },
];

const sampleContracts = [
  {
    id: '1',
    contract_number: 'CNT-2024-001',
    supplier_id: '1',
    supplier_name: 'Tashkent Trade LLC',
    title: 'Yillik ta\'minot shartnomasi',
    type: 'annual',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    value: 500000000,
    currency: 'UZS',
    status: 'active',
    terms: 'Har oyda kamida 50 mln so\'mlik mahsulot yetkazib berish',
    auto_renew: true,
    created_at: '2024-01-01',
  },
  {
    id: '2',
    contract_number: 'CNT-2024-002',
    supplier_id: '3',
    supplier_name: 'Ferghana Textiles',
    title: 'Gazlama yetkazib berish shartnomasi',
    type: 'fixed',
    start_date: '2024-02-01',
    end_date: '2024-06-30',
    value: 200000000,
    currency: 'UZS',
    status: 'active',
    terms: 'Har oy 1000 metr gazlama yetkazib berish',
    auto_renew: false,
    created_at: '2024-02-01',
  },
];

const samplePriceHistory = [
  {
    id: '1',
    product_name: 'Kompyuter Dell',
    supplier_id: '1',
    supplier_name: 'Tashkent Trade LLC',
    prices: [
      { date: '2024-01-01', price: 15000000, currency: 'UZS' },
      { date: '2024-02-01', price: 14500000, currency: 'UZS' },
      { date: '2024-03-01', price: 15200000, currency: 'UZS' },
    ],
  },
  {
    id: '2',
    product_name: 'Paxta',
    supplier_id: '2',
    supplier_name: 'Global Import Export',
    prices: [
      { date: '2024-01-01', price: 50, currency: 'USD' },
      { date: '2024-02-01', price: 48, currency: 'USD' },
      { date: '2024-03-01', price: 52, currency: 'USD' },
    ],
  },
];

export function ProcurementProvider({ children }) {
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [rfqs, setRFQs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Load data from backend or localStorage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const demoMode = isDemoMode();
        const isBackendAvailable = await checkBackendHealth();
        setBackendAvailable(isBackendAvailable);

        if (isBackendAvailable) {
          // Try to load from backend
          try {
            const [suppliersData, posData, rfqsData, contractsData] = await Promise.all([
              procurementService.listSuppliers().catch(() => null),
              procurementService.listOrders().catch(() => null),
              procurementService.listRFQs().catch(() => null),
              procurementService.listContracts().catch(() => null),
            ]);

            // Use backend data if available, else fall back to demo data
            setSuppliers(Array.isArray(suppliersData) && suppliersData.length > 0 ? suppliersData : (demoMode ? sampleSuppliers : []));
            setPurchaseOrders(Array.isArray(posData) ? posData : []);
            setRFQs(Array.isArray(rfqsData) && rfqsData.length > 0 ? rfqsData : (demoMode ? sampleRFQs : []));
            setContracts(Array.isArray(contractsData) && contractsData.length > 0 ? contractsData : (demoMode ? sampleContracts : []));
            setPriceHistory(demoMode ? samplePriceHistory : []);
          } catch (apiError) {
            console.warn('API call failed, falling back to localStorage:', apiError);
            loadFromLocalStorage(demoMode);
          }
        } else {
          loadFromLocalStorage(demoMode);
        }
      } catch (error) {
        console.error('Error loading procurement data:', error);
        const demoMode = isDemoMode();
        setSuppliers(demoMode ? sampleSuppliers : []);
        setRFQs(demoMode ? sampleRFQs : []);
        setContracts(demoMode ? sampleContracts : []);
        setPriceHistory(demoMode ? samplePriceHistory : []);
      } finally {
        setIsLoading(false);
      }
    };

    const loadFromLocalStorage = (demoMode) => {
      const getData = (key, sampleData) => {
        const storageKey = getStorageKey(key);
        const stored = localStorage.getItem(storageKey);
        if (stored) return JSON.parse(stored);
        return demoMode ? sampleData : [];
      };

      setSuppliers(getData(STORAGE_KEYS.SUPPLIERS, sampleSuppliers));
      setPurchaseOrders(getData(STORAGE_KEYS.PURCHASE_ORDERS, []));
      setRFQs(getData(STORAGE_KEYS.RFQS, sampleRFQs));
      setContracts(getData(STORAGE_KEYS.CONTRACTS, sampleContracts));
      setPriceHistory(getData(STORAGE_KEYS.PRICE_HISTORY, samplePriceHistory));

      // Initialize localStorage with sample data only in demo mode
      if (demoMode) {
        const initIfEmpty = (key, sampleData) => {
          const storageKey = getStorageKey(key);
          if (!localStorage.getItem(storageKey)) {
            localStorage.setItem(storageKey, JSON.stringify(sampleData));
          }
        };
        initIfEmpty(STORAGE_KEYS.SUPPLIERS, sampleSuppliers);
        initIfEmpty(STORAGE_KEYS.RFQS, sampleRFQs);
        initIfEmpty(STORAGE_KEYS.CONTRACTS, sampleContracts);
        initIfEmpty(STORAGE_KEYS.PRICE_HISTORY, samplePriceHistory);
      }
    };

    loadData();
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.SUPPLIERS), JSON.stringify(suppliers));
    }
  }, [suppliers, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.PURCHASE_ORDERS), JSON.stringify(purchaseOrders));
    }
  }, [purchaseOrders, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.RFQS), JSON.stringify(rfqs));
    }
  }, [rfqs, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.CONTRACTS), JSON.stringify(contracts));
    }
  }, [contracts, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.PRICE_HISTORY), JSON.stringify(priceHistory));
    }
  }, [priceHistory, isLoading]);

  // Supplier CRUD operations
  const createSupplier = useCallback(async (supplierData) => {
    if (backendAvailable) {
      try {
        const response = await procurementService.createSupplier({
          ...supplierData,
          type: 'vendor',
        });
        setSuppliers(prev => [...prev, response]);
        return response;
      } catch (error) {
        console.error('Failed to create supplier via API:', error);
      }
    }
    // Fallback to local
    const newSupplier = {
      ...supplierData,
      id: Date.now().toString(),
      code: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
      rating: 0,
      total_orders: 0,
      total_spent: 0,
      status: 'active',
      created_at: new Date().toISOString().split('T')[0],
    };
    setSuppliers(prev => [...prev, newSupplier]);
    return newSupplier;
  }, [suppliers.length, backendAvailable]);

  const updateSupplier = useCallback(async (id, updates) => {
    if (backendAvailable) {
      try {
        await procurementService.updateSupplier(id, updates);
      } catch (error) {
        console.error('Failed to update supplier via API:', error);
      }
    }
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [backendAvailable]);

  const deleteSupplier = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await procurementService.deleteSupplier(id);
      } catch (error) {
        console.error('Failed to delete supplier via API:', error);
      }
    }
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, [backendAvailable]);

  const getSupplierById = useCallback((id) => {
    return suppliers.find(s => s.id === id);
  }, [suppliers]);

  // RFQ operations
  const createRFQ = useCallback(async (rfqData) => {
    const newRFQ = {
      ...rfqData,
      id: Date.now().toString(),
      rfq_number: `RFQ-${new Date().getFullYear()}-${String(rfqs.length + 1).padStart(3, '0')}`,
      status: 'draft',
      responses: [],
      created_at: new Date().toISOString().split('T')[0],
    };
    setRFQs(prev => [...prev, newRFQ]);
    return newRFQ;
  }, [rfqs.length]);

  const updateRFQ = useCallback(async (id, updates) => {
    setRFQs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const deleteRFQ = useCallback(async (id) => {
    setRFQs(prev => prev.filter(r => r.id !== id));
  }, []);

  const submitRFQResponse = useCallback(async (rfqId, response) => {
    setRFQs(prev => prev.map(r => {
      if (r.id === rfqId) {
        return {
          ...r,
          responses: [...(r.responses || []), {
            ...response,
            submitted_at: new Date().toISOString(),
            status: 'submitted',
          }],
        };
      }
      return r;
    }));
  }, []);

  const selectRFQWinner = useCallback(async (rfqId, supplierId) => {
    setRFQs(prev => prev.map(r => {
      if (r.id === rfqId) {
        return {
          ...r,
          status: 'closed',
          winner_supplier_id: supplierId,
          responses: r.responses.map(resp => ({
            ...resp,
            status: resp.supplier_id === supplierId ? 'accepted' : 'rejected',
          })),
        };
      }
      return r;
    }));
  }, []);

  // Contract operations
  const createContract = useCallback(async (contractData) => {
    const supplier = getSupplierById(contractData.supplier_id);
    const newContract = {
      ...contractData,
      id: Date.now().toString(),
      contract_number: `CNT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`,
      supplier_name: supplier?.name || '',
      status: 'draft',
      created_at: new Date().toISOString().split('T')[0],
    };
    setContracts(prev => [...prev, newContract]);
    return newContract;
  }, [contracts.length, getSupplierById]);

  const updateContract = useCallback(async (id, updates) => {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteContract = useCallback(async (id) => {
    setContracts(prev => prev.filter(c => c.id !== id));
  }, []);

  // Price history operations
  const addPriceRecord = useCallback(async (productName, supplierId, price, currency = 'UZS') => {
    const supplier = getSupplierById(supplierId);
    const existingProduct = priceHistory.find(
      p => p.product_name === productName && p.supplier_id === supplierId
    );

    if (existingProduct) {
      setPriceHistory(prev => prev.map(p => {
        if (p.id === existingProduct.id) {
          return {
            ...p,
            prices: [...p.prices, {
              date: new Date().toISOString().split('T')[0],
              price,
              currency,
            }],
          };
        }
        return p;
      }));
    } else {
      setPriceHistory(prev => [...prev, {
        id: Date.now().toString(),
        product_name: productName,
        supplier_id: supplierId,
        supplier_name: supplier?.name || '',
        prices: [{
          date: new Date().toISOString().split('T')[0],
          price,
          currency,
        }],
      }]);
    }
  }, [priceHistory, getSupplierById]);

  const getProductPriceHistory = useCallback((productName) => {
    return priceHistory.filter(p => p.product_name === productName);
  }, [priceHistory]);

  // Purchase Order operations (from ModulesContext)
  const createPurchaseOrder = useCallback(async (poData) => {
    const supplier = getSupplierById(poData.supplier_id);
    const newPO = {
      ...poData,
      id: Date.now().toString(),
      po_number: poData.po_number || `PO-${Date.now()}`,
      supplier_name: supplier?.name || poData.vendor_name || '',
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    setPurchaseOrders(prev => [...prev, newPO]);

    // Update supplier stats
    if (supplier) {
      updateSupplier(supplier.id, {
        total_orders: (supplier.total_orders || 0) + 1,
      });
    }

    return newPO;
  }, [getSupplierById, updateSupplier]);

  const updatePurchaseOrder = useCallback(async (id, updates) => {
    setPurchaseOrders(prev => prev.map(po => {
      if (po.id === id) {
        const updated = { ...po, ...updates };
        // If received, update supplier spent amount
        if (updates.status === 'received' && po.status !== 'received') {
          const supplier = getSupplierById(po.supplier_id);
          if (supplier) {
            updateSupplier(supplier.id, {
              total_spent: (supplier.total_spent || 0) + (po.total_amount || 0),
            });
          }
        }
        return updated;
      }
      return po;
    }));
  }, [getSupplierById, updateSupplier]);

  const deletePurchaseOrder = useCallback(async (id) => {
    setPurchaseOrders(prev => prev.filter(po => po.id !== id));
  }, []);

  // Supplier rating update
  const updateSupplierRating = useCallback(async (supplierId, rating, comment = '') => {
    const supplier = getSupplierById(supplierId);
    if (supplier) {
      // Simple average rating calculation
      const currentRating = supplier.rating || 0;
      const totalOrders = supplier.total_orders || 1;
      const newRating = ((currentRating * (totalOrders - 1)) + rating) / totalOrders;

      updateSupplier(supplierId, {
        rating: Math.round(newRating * 10) / 10,
        last_rating_date: new Date().toISOString().split('T')[0],
        last_rating_comment: comment,
      });
    }
  }, [getSupplierById, updateSupplier]);

  // Summary statistics
  const getSupplierStats = useCallback(() => {
    const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
    const totalSpent = suppliers.reduce((sum, s) => sum + (s.total_spent || 0), 0);
    const avgRating = suppliers.length > 0
      ? suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length
      : 0;

    return {
      totalSuppliers: suppliers.length,
      activeSuppliers,
      totalSpent,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }, [suppliers]);

  const value = {
    // State
    suppliers,
    purchaseOrders,
    rfqs,
    contracts,
    priceHistory,
    isLoading,
    backendAvailable,

    // Supplier operations
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getSupplierById,
    updateSupplierRating,
    getSupplierStats,

    // RFQ operations
    createRFQ,
    updateRFQ,
    deleteRFQ,
    submitRFQResponse,
    selectRFQWinner,

    // Contract operations
    createContract,
    updateContract,
    deleteContract,

    // Price history operations
    addPriceRecord,
    getProductPriceHistory,

    // Purchase Order operations
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  };

  return (
    <ProcurementContext.Provider value={value}>
      {children}
    </ProcurementContext.Provider>
  );
}

export function useProcurement() {
  const context = useContext(ProcurementContext);
  if (!context) {
    throw new Error('useProcurement must be used within a ProcurementProvider');
  }
  return context;
}

export default ProcurementContext;
