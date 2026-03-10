import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useCompany } from './CompanyContext';
import { cargoService } from '@/api/services/cargo';

const CargoContext = createContext();

export const useCargoContext = () => {
  const context = useContext(CargoContext);
  if (!context) {
    throw new Error('useCargoContext must be used within CargoProvider');
  }
  return context;
};

export const CargoProvider = ({ children }) => {
  const { activeCompany } = useCompany();

  // Shipments state
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargo cash register state
  const [cargoCash, setCargoCash] = useState({
    uzs_balance: 0,
    usd_balance: 0,
    transactions: []
  });

  // Company accounts (B2B/B2C companies)
  const [companyAccounts, setCompanyAccounts] = useState([]);

  // Storage keys (for localStorage fallback)
  const STORAGE_KEYS = {
    shipments: `genix_cargo_shipments_${activeCompany?.id}`,
    cash: `genix_cargo_cash_${activeCompany?.id}`,
    accounts: `genix_cargo_accounts_${activeCompany?.id}`
  };

  // Use backend API (true) or localStorage (false)
  const [useBackend, setUseBackend] = useState(true);

  // Load data from backend or localStorage
  useEffect(() => {
    if (!activeCompany?.id) return;

    loadShipments();
    loadCashSummary();
  }, [activeCompany?.id]);

  // Load shipments
  const loadShipments = async () => {
    if (!useBackend) {
      // Load from localStorage
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.shipments);
        if (saved) setShipments(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading shipments from localStorage:', error);
      }
      return;
    }

    // Load from backend
    try {
      setLoading(true);
      const data = await cargoService.listShipments();
      setShipments(data || []);
    } catch (error) {
      console.error('Error loading shipments from backend:', error);
      // Fallback to localStorage
      setUseBackend(false);
      const saved = localStorage.getItem(STORAGE_KEYS.shipments);
      if (saved) setShipments(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  // Load cash summary
  const loadCashSummary = async () => {
    if (!useBackend) {
      // Load from localStorage
      try {
        const savedCash = localStorage.getItem(STORAGE_KEYS.cash);
        const savedAccounts = localStorage.getItem(STORAGE_KEYS.accounts);
        if (savedCash) setCargoCash(JSON.parse(savedCash));
        if (savedAccounts) setCompanyAccounts(JSON.parse(savedAccounts));
      } catch (error) {
        console.error('Error loading cash from localStorage:', error);
      }
      return;
    }

    // Load from backend
    try {
      const data = await cargoService.getCashSummary();
      setCargoCash({
        uzs_balance: data.uzs_balance || 0,
        usd_balance: data.usd_balance || 0,
        transactions: data.transactions || []
      });
    } catch (error) {
      console.error('Error loading cash summary from backend:', error);
      // Fallback to localStorage
      const savedCash = localStorage.getItem(STORAGE_KEYS.cash);
      if (savedCash) setCargoCash(JSON.parse(savedCash));
    }
  };

  // Save to localStorage (fallback)
  const saveToStorage = useCallback((key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, []);

  // Shipment status enum
  const SHIPMENT_STATUS = {
    ORDERED: 'ordered',
    IN_TRANSIT: 'in_transit',
    IN_CUSTOMS: 'in_customs',
    RECEIVED: 'received',
    DISTRIBUTED: 'distributed'
  };

  // Transport types
  const TRANSPORT_TYPES = {
    AIR: 'air',
    AUTO: 'auto',
    RAIL: 'rail',
    SEA: 'sea'
  };

  // Create new shipment
  const createShipment = useCallback(async (shipmentData) => {
    if (!useBackend) {
      // Create locally
      const newShipment = {
        id: Date.now(),
        ...shipmentData,
        status: SHIPMENT_STATUS.ORDERED,
        created_date: new Date().toISOString(),
        status_history: [{
          status: SHIPMENT_STATUS.ORDERED,
          date: new Date().toISOString(),
          note: 'Shipment created'
        }]
      };

      const updatedShipments = [...shipments, newShipment];
      setShipments(updatedShipments);
      saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
      return newShipment;
    }

    // Create via backend - Transform data to match backend schema
    try {
      const backendData = {
        tracking_number: shipmentData.tracking_number || '',
        supplier_country: shipmentData.supplier_country || '',
        supplier_company: shipmentData.supplier_company || '',
        expected_date: shipmentData.expected_date || null,
        transport_cost: shipmentData.costs?.transport || 0,
        customs_cost: shipmentData.costs?.customs || 0,
        insurance_cost: shipmentData.costs?.insurance || 0,
        other_cost: shipmentData.costs?.other || 0,
        notes: shipmentData.notes || '',
        items: shipmentData.items.map(item => ({
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.price || 0,
          currency: item.currency,
          hs_code: item.hs_code || '',
          description: item.description || ''
        }))
      };

      const result = await cargoService.createShipment(backendData);
      await loadShipments(); // Reload to get full data
      return result;
    } catch (error) {
      console.error('Error creating shipment:', error);
      throw error;
    }
  }, [shipments, useBackend, saveToStorage, STORAGE_KEYS.shipments]);

  // Update shipment status
  const updateShipmentStatus = useCallback(async (shipmentId, newStatus, note = '') => {
    if (!useBackend) {
      // Update locally
      const updatedShipments = shipments.map(s => {
        if (s.id === shipmentId) {
          return {
            ...s,
            status: newStatus,
            status_history: [
              ...s.status_history,
              {
                status: newStatus,
                date: new Date().toISOString(),
                note
              }
            ]
          };
        }
        return s;
      });

      setShipments(updatedShipments);
      saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
      return;
    }

    // Update via backend
    try {
      await cargoService.updateShipmentStatus(shipmentId, { status: newStatus, note });
      await loadShipments();
    } catch (error) {
      console.error('Error updating shipment status:', error);
      throw error;
    }
  }, [shipments, useBackend, saveToStorage, STORAGE_KEYS.shipments]);

  // Update shipment
  const updateShipment = useCallback(async (shipmentId, updates) => {
    if (!useBackend) {
      // Update locally
      const updatedShipments = shipments.map(s =>
        s.id === shipmentId ? { ...s, ...updates } : s
      );
      setShipments(updatedShipments);
      saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
      return;
    }

    // Update via backend
    try {
      await cargoService.updateShipment(shipmentId, updates);
      await loadShipments(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating shipment from backend:', error);
      // Fallback to local update if backend fails
      const updatedShipments = shipments.map(s =>
        s.id === shipmentId ? { ...s, ...updates } : s
      );
      setShipments(updatedShipments);
      saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
    }
  }, [shipments, useBackend, saveToStorage, STORAGE_KEYS.shipments, loadShipments]);

  // Delete shipment
  const deleteShipment = useCallback(async (shipmentId) => {
    if (!useBackend) {
      // Delete locally
      const updatedShipments = shipments.filter(s => s.id !== shipmentId);
      setShipments(updatedShipments);
      saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
      return;
    }

    // Delete via backend
    try {
      await cargoService.deleteShipment(shipmentId);
      await loadShipments();
    } catch (error) {
      console.error('Error deleting shipment from backend:', error);
      // Fallback to local delete if backend fails
      const updatedShipments = shipments.filter(s => s.id !== shipmentId);
      setShipments(updatedShipments);
      saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
    }
  }, [shipments, useBackend, saveToStorage, STORAGE_KEYS.shipments, loadShipments]);

  // Distribute goods to B2B/B2C
  const distributeGoods = useCallback(async (shipmentId, distribution) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    if (!useBackend) {
      // Distribute locally
      updateShipment(shipmentId, {
        distribution,
        status: SHIPMENT_STATUS.DISTRIBUTED
      });

      // Update company accounts
      distribution.forEach(dist => {
        const existingAccount = companyAccounts.find(a => a.company_id === dist.company_id);
        const totalCost = dist.total_cost || 0;

        if (existingAccount) {
          const updatedAccounts = companyAccounts.map(a => {
            if (a.company_id === dist.company_id) {
              return {
                ...a,
                debt: (a.debt || 0) + totalCost,
                balance: (a.balance || 0) - totalCost
              };
            }
            return a;
          });
          setCompanyAccounts(updatedAccounts);
          saveToStorage(STORAGE_KEYS.accounts, updatedAccounts);
        } else {
          const newAccount = {
            company_id: dist.company_id,
            company_name: dist.company_name,
            company_type: dist.company_type,
            debt: totalCost,
            credit: 0,
            balance: -totalCost,
            created_date: new Date().toISOString()
          };
          const updatedAccounts = [...companyAccounts, newAccount];
          setCompanyAccounts(updatedAccounts);
          saveToStorage(STORAGE_KEYS.accounts, updatedAccounts);
        }
      });
      return;
    }

    // Distribute via backend
    try {
      await cargoService.createDistribution(shipmentId, distribution[0]); // Backend expects single distribution
      await loadShipments();
    } catch (error) {
      console.error('Error creating distribution:', error);
      throw error;
    }
  }, [shipments, companyAccounts, updateShipment, useBackend, saveToStorage, STORAGE_KEYS.accounts]);

  // Add cash transaction
  const addCashTransaction = useCallback(async (transaction) => {
    const { type, amount, currency, category, description, company_id } = transaction;

    if (!useBackend) {
      // Add locally
      const newTransaction = {
        id: Date.now(),
        type,
        amount,
        currency,
        category,
        description,
        company_id,
        date: new Date().toISOString()
      };

      // Update balance
      const updatedCash = { ...cargoCash };
      const balanceKey = currency === 'USD' ? 'usd_balance' : 'uzs_balance';

      if (type === 'income') {
        updatedCash[balanceKey] += amount;
      } else {
        updatedCash[balanceKey] -= amount;
      }

      updatedCash.transactions = [...(cargoCash.transactions || []), newTransaction];

      setCargoCash(updatedCash);
      saveToStorage(STORAGE_KEYS.cash, updatedCash);

      // Update company account if applicable
      if (company_id) {
        const updatedAccounts = companyAccounts.map(acc => {
          if (acc.company_id === company_id) {
            if (type === 'income') {
              return {
                ...acc,
                credit: (acc.credit || 0) + amount,
                balance: (acc.balance || 0) + amount
              };
            } else {
              return {
                ...acc,
                debt: (acc.debt || 0) + amount,
                balance: (acc.balance || 0) - amount
              };
            }
          }
          return acc;
        });
        setCompanyAccounts(updatedAccounts);
        saveToStorage(STORAGE_KEYS.accounts, updatedAccounts);
      }

      return newTransaction;
    }

    // Add via backend
    try {
      const result = await cargoService.createCashTransaction({
        transaction_type: type,
        amount,
        currency,
        category,
        description,
        related_company_id: company_id
      });
      await loadCashSummary();
      return result;
    } catch (error) {
      console.error('Error creating cash transaction:', error);
      throw error;
    }
  }, [cargoCash, companyAccounts, useBackend, saveToStorage, STORAGE_KEYS.cash, STORAGE_KEYS.accounts]);

  // Get shipments by status
  const getShipmentsByStatus = useCallback((status) => {
    return shipments.filter(s => s.status === status);
  }, [shipments]);

  // Calculate total costs for shipment
  const calculateShipmentCosts = useCallback((shipment) => {
    const costs = shipment.costs || {};
    return {
      transport: costs.transport || 0,
      customs: costs.customs || 0,
      insurance: costs.insurance || 0,
      other: costs.other || 0,
      total: (costs.transport || 0) + (costs.customs || 0) + (costs.insurance || 0) + (costs.other || 0)
    };
  }, []);

  // Calculate cost coefficient
  const calculateCostCoefficient = useCallback((shipment) => {
    const totalGoods = shipment.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const totalCosts = calculateShipmentCosts(shipment).total;

    if (totalGoods === 0) return 0;
    return (totalCosts / totalGoods);
  }, [calculateShipmentCosts]);

  const value = useMemo(() => ({
    // State
    shipments,
    loading,
    cargoCash,
    setCargoCash,
    companyAccounts,

    // Constants
    SHIPMENT_STATUS,
    TRANSPORT_TYPES,

    // Methods
    createShipment,
    updateShipment,
    deleteShipment,
    updateShipmentStatus,
    distributeGoods,
    addCashTransaction,
    getShipmentsByStatus,
    calculateShipmentCosts,
    calculateCostCoefficient,

    // Refresh methods
    loadShipments,
    loadCashSummary,

    // Helpers
    setLoading
  }), [shipments, loading, cargoCash, companyAccounts, createShipment, updateShipment, deleteShipment, updateShipmentStatus, distributeGoods, addCashTransaction, getShipmentsByStatus, calculateShipmentCosts, calculateCostCoefficient, loadShipments, loadCashSummary]);

  return (
    <CargoContext.Provider value={value}>
      {children}
    </CargoContext.Provider>
  );
};
