import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import procurementService from '@/api/services/procurement';

const ProcurementContext = createContext(null);

export function ProcurementProvider({ children }) {
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [rfqs, setRFQs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data from backend on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [suppliersData, ordersData, contractsData] = await Promise.all([
        procurementService.listSuppliers(),
        procurementService.listOrders(),
        procurementService.listContracts(),
      ]);
      setSuppliers(suppliersData || []);
      setPurchaseOrders(ordersData || []);
      setContracts(contractsData || []);
    } catch (err) {
      console.error('Error loading procurement data:', err);
      setError(err.message);
      setSuppliers([]);
      setPurchaseOrders([]);
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Supplier CRUD operations
  const createSupplier = useCallback(async (supplierData) => {
    const newSupplier = await procurementService.createSupplier(supplierData);
    setSuppliers(prev => [...prev, newSupplier]);
    return newSupplier;
  }, []);

  const updateSupplier = useCallback(async (id, updates) => {
    const updated = await procurementService.updateSupplier(id, updates);
    setSuppliers(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  const deleteSupplier = useCallback(async (id) => {
    await procurementService.deleteSupplier(id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, []);

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
    const newContract = await procurementService.createContract(contractData);
    setContracts(prev => [...prev, newContract]);
    return newContract;
  }, []);

  const updateContract = useCallback(async (id, updates) => {
    const updated = await procurementService.updateContract(id, updates);
    setContracts(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  }, []);

  const deleteContract = useCallback(async (id) => {
    await procurementService.deleteContract(id);
    setContracts(prev => prev.filter(c => c.id !== id));
  }, []);

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
    const newPO = await procurementService.createOrder(poData);
    setPurchaseOrders(prev => [...prev, newPO]);
    return newPO;
  }, []);

  const updatePurchaseOrder = useCallback(async (id, updates) => {
    const updated = await procurementService.updateOrder(id, updates);
    setPurchaseOrders(prev => prev.map(po => po.id === id ? updated : po));
    return updated;
  }, []);

  const deletePurchaseOrder = useCallback(async (id) => {
    await procurementService.deleteOrder(id);
    setPurchaseOrders(prev => prev.filter(po => po.id !== id));
  }, []);

  const approvePurchaseOrder = useCallback(async (id) => {
    const approved = await procurementService.approveOrder(id);
    setPurchaseOrders(prev => prev.map(po => po.id === id ? approved : po));
    return approved;
  }, []);

  const receivePurchaseOrder = useCallback(async (id, data) => {
    const received = await procurementService.receiveOrder(id, data);
    setPurchaseOrders(prev => prev.map(po => po.id === id ? received : po));
    return received;
  }, []);

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
    await loadData();
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
