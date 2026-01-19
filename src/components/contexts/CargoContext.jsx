import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCompany } from './CompanyContext';

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

  // Storage keys
  const STORAGE_KEYS = {
    shipments: `genix_cargo_shipments_${activeCompany?.id}`,
    cash: `genix_cargo_cash_${activeCompany?.id}`,
    accounts: `genix_cargo_accounts_${activeCompany?.id}`
  };

  // Load data from localStorage
  useEffect(() => {
    if (!activeCompany?.id) return;

    try {
      const savedShipments = localStorage.getItem(STORAGE_KEYS.shipments);
      const savedCash = localStorage.getItem(STORAGE_KEYS.cash);
      const savedAccounts = localStorage.getItem(STORAGE_KEYS.accounts);

      if (savedShipments) setShipments(JSON.parse(savedShipments));
      if (savedCash) setCargoCash(JSON.parse(savedCash));
      if (savedAccounts) setCompanyAccounts(JSON.parse(savedAccounts));
    } catch (error) {
      console.error('Error loading cargo data:', error);
    }
  }, [activeCompany?.id]);

  // Save to localStorage
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
  const createShipment = useCallback((shipmentData) => {
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
  }, [shipments, saveToStorage, STORAGE_KEYS.shipments]);

  // Update shipment status
  const updateShipmentStatus = useCallback((shipmentId, newStatus, note = '') => {
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
  }, [shipments, saveToStorage, STORAGE_KEYS.shipments]);

  // Update shipment
  const updateShipment = useCallback((shipmentId, updates) => {
    const updatedShipments = shipments.map(s =>
      s.id === shipmentId ? { ...s, ...updates } : s
    );
    setShipments(updatedShipments);
    saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
  }, [shipments, saveToStorage, STORAGE_KEYS.shipments]);

  // Delete shipment
  const deleteShipment = useCallback((shipmentId) => {
    const updatedShipments = shipments.filter(s => s.id !== shipmentId);
    setShipments(updatedShipments);
    saveToStorage(STORAGE_KEYS.shipments, updatedShipments);
  }, [shipments, saveToStorage, STORAGE_KEYS.shipments]);

  // Distribute goods to B2B/B2C
  const distributeGoods = useCallback((shipmentId, distribution) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    // Update shipment with distribution info
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
  }, [shipments, companyAccounts, updateShipment, saveToStorage, STORAGE_KEYS.accounts]);

  // Add cash transaction
  const addCashTransaction = useCallback((transaction) => {
    const { type, amount, currency, category, description, company_id } = transaction;

    const newTransaction = {
      id: Date.now(),
      type, // 'income' or 'expense'
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
  }, [cargoCash, companyAccounts, saveToStorage, STORAGE_KEYS.cash, STORAGE_KEYS.accounts]);

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

  const value = {
    // State
    shipments,
    loading,
    cargoCash,
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

    // Helpers
    setLoading
  };

  return (
    <CargoContext.Provider value={value}>
      {children}
    </CargoContext.Provider>
  );
};
