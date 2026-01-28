import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import procurementService from '@/api/services/procurement';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';
import { useAdminSettings } from './AdminSettingsContext';

const ProcurementContext = createContext(null);

// Storage keys
const STORAGE_KEYS = {
  SUPPLIERS: 'suppliers',
  PURCHASE_ORDERS: 'purchase_orders',
  RFQS: 'rfqs',
  CONTRACTS: 'contracts',
  PRICE_HISTORY: 'price_history',
};

const getStorageKey = (key) => `procurement_${key}`;

// Sample data for demo mode
const sampleSuppliers = [
  {
    id: '1',
    code: 'SUP-001',
    name: 'Acme Supplies',
    email: 'contact@acme.com',
    phone: '+998901234567',
    status: 'active',
    rating: 4.5,
    total_orders: 25,
    total_spent: 150000000,
    created_at: '2024-01-15',
  },
  {
    id: '2',
    code: 'SUP-002',
    name: 'Global Parts Inc',
    email: 'info@globalparts.com',
    phone: '+998909876543',
    status: 'active',
    rating: 4.2,
    total_orders: 18,
    total_spent: 85000000,
    created_at: '2024-02-20',
  },
];

const sampleRFQs = [];
const sampleContracts = [];
const samplePriceHistory = [];

export function ProcurementProvider({ children }) {
  const { getSetting } = useAdminSettings();
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [rfqs, setRFQs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Admin settings for procurement module - these affect module behavior
  const purchaseSettings = useMemo(() => ({
    // Approval workflow
    approvalWorkflowEnabled: getSetting('purchase.approval.workflow_enabled', false),
    approvalThresholds: getSetting('purchase.approval.thresholds', [
      { amount: 1000000, approver_role: 'manager' },
      { amount: 10000000, approver_role: 'admin' }
    ]),

    // Vendor settings
    defaultPaymentTerms: getSetting('purchase.vendor.default_payment_terms', 'Net 30'),
    vendorRatingEnabled: getSetting('purchase.vendor.rating_enabled', true),
    preferredVendorsOnly: getSetting('purchase.vendor.preferred_vendors_only', false),

    // RFQ settings
    rfqValidityDays: getSetting('purchase.rfq.validity_days', 15),
    autoCreatePO: getSetting('purchase.rfq.auto_create_po', false),

    // Lead time
    defaultLeadTimeDays: getSetting('purchase.lead_time.default_days', 7),

    // Blanket orders
    blanketOrdersEnabled: getSetting('purchase.blanket_orders.enabled', false)
  }), [getSetting]);

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
          name: supplierData.name,
          email: supplierData.email || undefined,
          phone: supplierData.phone || undefined,
          tax_id: supplierData.tax_id || undefined,
          notes: supplierData.notes || undefined,
          // Map frontend payment_terms to backend expected format (days as integer)
          payment_terms: supplierData.payment_terms === 'net_30' ? 30 :
                        supplierData.payment_terms === 'net_60' ? 60 :
                        supplierData.payment_terms === 'net_15' ? 15 : 30,
        });
        // Map backend response to frontend format
        const mappedSupplier = {
          ...response,
          contact_person: response.contact_persons?.[0]?.name || '',
          address: response.billing_address?.street || response.shipping_address?.street || '',
          rating: 0,
          total_orders: 0,
          total_spent: 0,
        };
        setSuppliers(prev => [...prev, mappedSupplier]);
        return mappedSupplier;
      } catch (error) {
        console.error('Failed to create supplier via API:', error);
        throw error; // Re-throw to let UI handle the error
      }
    }
    // Fallback to local only when backend is not available
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

  // RFQ operations (RFQs API to be implemented)
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
    if (backendAvailable) {
      try {
        const newContract = await procurementService.createContract(contractData);
        setContracts(prev => [...prev, newContract]);
        return newContract;
      } catch (error) {
        console.error('Failed to create contract via API:', error);
      }
    }
    // Fallback to local
    const newContract = {
      ...contractData,
      id: Date.now().toString(),
      contract_number: `CON-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`,
      status: 'draft',
      created_at: new Date().toISOString().split('T')[0],
    };
    setContracts(prev => [...prev, newContract]);
    return newContract;
  }, [backendAvailable, contracts.length]);

  const updateContract = useCallback(async (id, updates) => {
    if (backendAvailable) {
      try {
        const updated = await procurementService.updateContract(id, updates);
        setContracts(prev => prev.map(c => c.id === id ? updated : c));
        return updated;
      } catch (error) {
        console.error('Failed to update contract via API:', error);
      }
    }
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [backendAvailable]);

  const deleteContract = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await procurementService.deleteContract(id);
      } catch (error) {
        console.error('Failed to delete contract via API:', error);
      }
    }
    setContracts(prev => prev.filter(c => c.id !== id));
  }, [backendAvailable]);

  // Price history operations (to be implemented in backend)
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

  // Purchase Order operations
  const createPurchaseOrder = useCallback(async (poData) => {
    if (backendAvailable) {
      try {
        const newPO = await procurementService.createOrder(poData);
        setPurchaseOrders(prev => [...prev, newPO]);
        return newPO;
      } catch (error) {
        console.error('Failed to create PO via API:', error);
      }
    }
    // Fallback to local
    const newPO = {
      ...poData,
      id: Date.now().toString(),
      order_number: `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(4, '0')}`,
      status: 'draft',
      created_at: new Date().toISOString().split('T')[0],
    };
    setPurchaseOrders(prev => [...prev, newPO]);
    return newPO;
  }, [backendAvailable, purchaseOrders.length]);

  const updatePurchaseOrder = useCallback(async (id, updates) => {
    if (backendAvailable) {
      try {
        const updated = await procurementService.updateOrder(id, updates);
        setPurchaseOrders(prev => prev.map(po => po.id === id ? updated : po));
        return updated;
      } catch (error) {
        console.error('Failed to update PO via API:', error);
      }
    }
    setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, ...updates } : po));
  }, [backendAvailable]);

  const deletePurchaseOrder = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await procurementService.deleteOrder(id);
      } catch (error) {
        console.error('Failed to delete PO via API:', error);
      }
    }
    setPurchaseOrders(prev => prev.filter(po => po.id !== id));
  }, [backendAvailable]);

  const approvePurchaseOrder = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        const approved = await procurementService.approveOrder(id);
        setPurchaseOrders(prev => prev.map(po => po.id === id ? approved : po));
        return approved;
      } catch (error) {
        console.error('Failed to approve PO via API:', error);
      }
    }
    setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'approved' } : po));
  }, [backendAvailable]);

  const receivePurchaseOrder = useCallback(async (id, data) => {
    if (backendAvailable) {
      try {
        const received = await procurementService.receiveOrder(id, data);
        setPurchaseOrders(prev => prev.map(po => po.id === id ? received : po));
        return received;
      } catch (error) {
        console.error('Failed to receive PO via API:', error);
      }
    }
    setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'received', ...data } : po));
  }, [backendAvailable]);

  // Supplier rating update
  const updateSupplierRating = useCallback(async (supplierId, rating, comment = '') => {
    const supplier = getSupplierById(supplierId);
    if (supplier) {
      const currentRating = supplier.rating || 0;
      const totalOrders = supplier.total_orders || 1;
      const newRating = ((currentRating * (totalOrders - 1)) + rating) / totalOrders;

      await updateSupplier(supplierId, {
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

  // Refresh data from backend
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isBackendAvailable = await checkBackendHealth();
      setBackendAvailable(isBackendAvailable);

      if (isBackendAvailable) {
        const [suppliersData, posData, rfqsData, contractsData] = await Promise.all([
          procurementService.listSuppliers().catch(() => null),
          procurementService.listOrders().catch(() => null),
          procurementService.listRFQs().catch(() => null),
          procurementService.listContracts().catch(() => null),
        ]);

        if (suppliersData) setSuppliers(suppliersData);
        if (posData) setPurchaseOrders(posData);
        if (rfqsData) setRFQs(rfqsData);
        if (contractsData) setContracts(contractsData);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    // State
    suppliers,
    purchaseOrders,
    rfqs,
    contracts,
    priceHistory,
    isLoading,
    error,
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
    approvePurchaseOrder,
    receivePurchaseOrder,

    // Refresh
    refreshData,

    // Admin Settings (from Admin Settings page)
    settings: purchaseSettings,
    // Helper functions for settings
    isApprovalRequired: (amount) => {
      if (!purchaseSettings.approvalWorkflowEnabled) return false;
      return purchaseSettings.approvalThresholds.some(t => amount >= t.amount);
    },
    getRequiredApproverRole: (amount) => {
      if (!purchaseSettings.approvalWorkflowEnabled) return null;
      const threshold = purchaseSettings.approvalThresholds
        .filter(t => amount >= t.amount)
        .sort((a, b) => b.amount - a.amount)[0];
      return threshold?.approver_role || null;
    },
    getDefaultPaymentTerms: () => purchaseSettings.defaultPaymentTerms,
    getRFQValidityDays: () => purchaseSettings.rfqValidityDays,
    getDefaultLeadTime: () => purchaseSettings.defaultLeadTimeDays,
    isVendorRatingEnabled: () => purchaseSettings.vendorRatingEnabled,
    isPreferredVendorsOnly: () => purchaseSettings.preferredVendorsOnly,
    isBlanketOrdersEnabled: () => purchaseSettings.blanketOrdersEnabled
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