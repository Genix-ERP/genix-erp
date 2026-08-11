import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import procurementService from '@/api/services/procurement';
import { isDemoMode, checkBackendHealth } from '@/config/dataMode';
import { useAdminSettings } from './AdminSettingsContext';
import { toast } from 'sonner';

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
            const [suppliersData, posData, rfqsData, contractsData, priceHistoryData] = await Promise.all([
              procurementService.listSuppliers().catch(() => null),
              procurementService.listOrders().catch(() => null),
              procurementService.listRFQs().catch(() => null),
              procurementService.listContracts().catch(() => null),
              procurementService.listPriceHistoryGrouped().catch(() => null),
            ]);

            // Use backend data if available, else fall back to demo data
            setSuppliers(Array.isArray(suppliersData) && suppliersData.length > 0 ? suppliersData : (demoMode ? sampleSuppliers : []));
            // Reverse status mapping: backend → frontend
            const reverseStatusMap = {
              'ordered': 'sent',
              'approved': 'confirmed',
              'pending_approval': 'pending_approval',
              'draft': 'draft',
              'partial': 'partial',
              'received': 'received',
              'cancelled': 'cancelled',
            };
            // Map backend PO fields to frontend format
            const mappedPOs = Array.isArray(posData) ? posData.map(po => ({
              ...po,
              po_number: po.order_number,
              supplier_id: po.vendor_id,
              supplier_name: po.vendor_name,
              expected_delivery_date: po.expected_date,
              status: reverseStatusMap[po.status] || po.status,
            })) : [];
            setPurchaseOrders(mappedPOs);
            setRFQs(Array.isArray(rfqsData) && rfqsData.length > 0 ? rfqsData : (demoMode ? sampleRFQs : []));
            // Map backend contract fields to frontend format
            const mappedContracts = Array.isArray(contractsData) ? contractsData.map(contract => ({
              ...contract,
              supplier_id: contract.vendor_id,
              supplier_name: contract.vendor_name,
              type: contract.contract_type,
              auto_renew: contract.auto_renewal,
            })) : [];
            setContracts(mappedContracts.length > 0 ? mappedContracts : (demoMode ? sampleContracts : []));
            // Map backend price history to frontend format
            const mappedPriceHistory = Array.isArray(priceHistoryData) ? priceHistoryData.map(item => ({
              id: item.id,
              product_name: item.product_name,
              supplier_id: item.supplier_id,
              supplier_name: item.supplier_name,
              prices: item.prices || [],
            })) : [];
            setPriceHistory(mappedPriceHistory.length > 0 ? mappedPriceHistory : (demoMode ? samplePriceHistory : []));
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
          contact_person: supplierData.contact_person || undefined,
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
          contact_person: response.contact_person || response.contact_persons?.[0]?.name || '',
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
      
        toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
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
      
        toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }, [backendAvailable]);

  const getSupplierById = useCallback((id) => {
    return suppliers.find(s => s.id === id);
  }, [suppliers]);

  // RFQ operations
  const createRFQ = useCallback(async (rfqData) => {
    if (backendAvailable) {
      try {
        // Transform frontend data to backend format
        const backendPayload = {
          title: rfqData.title || '',
          description: rfqData.description || '',
          deadline: rfqData.deadline || '',
          notes: rfqData.notes || '',
          items: (rfqData.items || []).filter(item => item.name || item.product_id).map(item => ({
            product_id: item.product_id || '',
            description: item.name || item.description || '',
            quantity: parseFloat(item.quantity) || 1,
            unit_id: item.unit_id || '',
            notes: item.notes || '',
          })),
          vendor_ids: rfqData.suppliers_invited || [],
        };

        const newRFQ = await procurementService.createRFQ(backendPayload);
        // Transform backend response to frontend format
        const mappedRFQ = {
          ...newRFQ,
          suppliers_invited: rfqData.suppliers_invited || [],
          responses: newRFQ.responses || [],
        };
        setRFQs(prev => [mappedRFQ, ...prev]);
        return mappedRFQ;
      } catch (error) {
        console.error('Failed to create RFQ via API:', error);
        throw error;
      }
    }
    // Fallback to local only when backend is not available
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
  }, [backendAvailable, rfqs.length]);

  const updateRFQ = useCallback(async (id, updates) => {
    if (backendAvailable) {
      try {
        // For status changes like opening RFQ, use the appropriate endpoint
        if (updates.status === 'open') {
          await procurementService.openRFQ(id);
        } else {
          await procurementService.updateRFQ(id, updates);
        }
        setRFQs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
        return { id, ...updates };
      } catch (error) {
        console.error('Failed to update RFQ via API:', error);
        throw error;
      }
    }
    setRFQs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, [backendAvailable]);

  const deleteRFQ = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await procurementService.deleteRFQ(id);
        setRFQs(prev => prev.filter(r => r.id !== id));
        return;
      } catch (error) {
        console.error('Failed to delete RFQ via API:', error);
        throw error;
      }
    }
    setRFQs(prev => prev.filter(r => r.id !== id));
  }, [backendAvailable]);

  const submitRFQResponse = useCallback(async (rfqId, response) => {
    if (backendAvailable) {
      try {
        await procurementService.submitRFQResponse(rfqId, response);
        // Refresh data to get updated responses
        const rfqData = await procurementService.getRFQ(rfqId);
        setRFQs(prev => prev.map(r => r.id === rfqId ? { ...r, ...rfqData } : r));
        return;
      } catch (error) {
        console.error('Failed to submit RFQ response via API:', error);
        throw error;
      }
    }
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
  }, [backendAvailable]);

  const selectRFQWinner = useCallback(async (rfqId, responseId) => {
    if (backendAvailable) {
      try {
        await procurementService.selectRFQWinner(rfqId, responseId);
        // Refresh data to get updated RFQ status
        const rfqData = await procurementService.getRFQ(rfqId);
        setRFQs(prev => prev.map(r => r.id === rfqId ? { ...r, ...rfqData, status: 'closed' } : r));
        return;
      } catch (error) {
        console.error('Failed to select RFQ winner via API:', error);
        throw error;
      }
    }
    setRFQs(prev => prev.map(r => {
      if (r.id === rfqId) {
        return {
          ...r,
          status: 'closed',
          winner_supplier_id: responseId,
          responses: r.responses.map(resp => ({
            ...resp,
            status: resp.supplier_id === responseId ? 'accepted' : 'rejected',
          })),
        };
      }
      return r;
    }));
  }, [backendAvailable]);

  // Contract operations
  const createContract = useCallback(async (contractData) => {
    if (backendAvailable) {
      try {
        // Transform frontend data to backend format
        const backendPayload = {
          title: contractData.title,
          vendor_id: contractData.supplier_id || contractData.vendor_id,
          contract_type: contractData.type || contractData.contract_type || 'fixed',
          start_date: contractData.start_date,
          end_date: contractData.end_date,
          value: parseFloat(contractData.value) || 0,
          terms: contractData.terms || '',
          auto_renewal: contractData.auto_renew || contractData.auto_renewal || false,
        };
        const newContract = await procurementService.createContract(backendPayload);
        // Map backend response to frontend format
        const mappedContract = {
          ...newContract,
          supplier_id: newContract.vendor_id,
          supplier_name: newContract.vendor_name,
          type: newContract.contract_type,
          auto_renew: newContract.auto_renewal,
        };
        setContracts(prev => [...prev, mappedContract]);
        return mappedContract;
      } catch (error) {
        console.error('Failed to create contract via API:', error);
        throw error;
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
        // Transform frontend updates to backend format
        const backendUpdates = {};
        if (updates.title) backendUpdates.title = updates.title;
        if (updates.type || updates.contract_type) backendUpdates.contract_type = updates.type || updates.contract_type;
        if (updates.end_date) backendUpdates.end_date = updates.end_date;
        if (updates.value !== undefined) backendUpdates.value = parseFloat(updates.value);
        if (updates.terms) backendUpdates.terms = updates.terms;
        if (updates.auto_renew !== undefined || updates.auto_renewal !== undefined) {
          backendUpdates.auto_renewal = updates.auto_renew ?? updates.auto_renewal;
        }
        if (updates.status) backendUpdates.status = updates.status;

        await procurementService.updateContract(id, backendUpdates);
        // Update local state with frontend field names
        const frontendUpdates = {
          ...updates,
          type: updates.type || updates.contract_type,
          auto_renew: updates.auto_renew ?? updates.auto_renewal,
        };
        setContracts(prev => prev.map(c => c.id === id ? { ...c, ...frontendUpdates } : c));
        return { id, ...frontendUpdates };
      } catch (error) {
        console.error('Failed to update contract via API:', error);
        throw error;
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
      
        toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    setContracts(prev => prev.filter(c => c.id !== id));
  }, [backendAvailable]);

  // Price history operations
  const addPriceRecord = useCallback(async (productName, supplierId, price, currency = 'UZS', productId = null) => {
    if (backendAvailable && productId) {
      try {
        const newRecord = await procurementService.createPriceHistory({
          product_id: productId,
          vendor_id: supplierId,
          unit_price: price,
          currency: currency,
        });
        // Refresh the grouped price history data
        await refreshPriceHistory();
        return newRecord;
      } catch (error) {
        console.error('Failed to create price record via API:', error);
        throw error;
      }
    }
    // Fallback to local storage for demo mode or when no product_id
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
  }, [backendAvailable, priceHistory, getSupplierById]);

  // Refresh price history from backend
  const refreshPriceHistory = useCallback(async () => {
    if (!backendAvailable) return;
    try {
      const data = await procurementService.listPriceHistoryGrouped();
      if (Array.isArray(data)) {
        // Map to frontend format
        const mappedHistory = data.map(item => ({
          id: item.id,
          product_name: item.product_name,
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name,
          prices: item.prices || [],
        }));
        setPriceHistory(mappedHistory);
      }
    } catch (error) {
      console.error('Failed to refresh price history:', error);
    }
  }, [backendAvailable]);

  const getProductPriceHistory = useCallback((productName) => {
    return priceHistory.filter(p => p.product_name === productName);
  }, [priceHistory]);

  // Purchase Order operations
  const createPurchaseOrder = useCallback(async (poData) => {
    if (backendAvailable) {
      try {
        // Transform frontend data to backend format
        // Filter out empty lines (where no product is selected)
        const validLines = (poData.lines || []).filter(line =>
          line.product_id || line.product_name || line.description
        );

        // Ensure we have at least one line with valid data
        if (validLines.length === 0) {
          throw new Error('At least one product line is required');
        }

        const backendPayload = {
          order_number: poData.po_number || '',
          vendor_id: poData.supplier_id || poData.vendor_id,
          order_date: poData.order_date || new Date().toISOString().split('T')[0],
          expected_date: poData.expected_delivery_date || poData.expected_date || '',
          payment_terms: poData.payment_terms || 'net_30',
          warehouse_id: poData.warehouse_id || undefined,
          construction_project_id: poData.construction_project_id ? Number(poData.construction_project_id) : undefined,
          subtotal: poData.subtotal || 0,
          tax_amount: poData.tax_amount || 0,
          total_amount: poData.total_amount || 0,
          notes: poData.notes || '',
          lines: validLines.map(line => ({
            product_id: line.product_id || '',
            description: line.product_name || line.description || 'Product',
            quantity: parseFloat(line.quantity) || 1,
            unit_price: parseFloat(line.unit_price) || 0,
            unit_id: line.unit_id || '',
            discount_amount: parseFloat(line.discount_amount) || 0,
            tax_percent: 0, // Tax is calculated at order level, not per line
            notes: line.notes || '',
            packaging_id: line.packaging_id || undefined,
            packaging_qty: line.packaging_id ? (parseFloat(line.packaging_qty) || 1) : undefined,
          })),
        };

        const newPO = await procurementService.createOrder(backendPayload);
        // Transform backend response to frontend format
        const mappedPO = {
          ...newPO,
          po_number: newPO.order_number,
          supplier_id: newPO.vendor_id,
          supplier_name: newPO.vendor_name,
          expected_delivery_date: newPO.expected_date,
        };
        setPurchaseOrders(prev => [mappedPO, ...prev]);
        return mappedPO;
      } catch (error) {
        console.error('Failed to create PO via API:', error);
        throw error; // Re-throw to notify UI of failure
      }
    }
    // Fallback to local only when backend is not available
    const newPO = {
      ...poData,
      id: Date.now().toString(),
      po_number: poData.po_number || `PO-${String(purchaseOrders.length + 1).padStart(5, '0')}`,
      order_number: poData.po_number || `PO-${String(purchaseOrders.length + 1).padStart(5, '0')}`,
      status: 'draft',
      created_at: new Date().toISOString().split('T')[0],
    };
    setPurchaseOrders(prev => [newPO, ...prev]);
    return newPO;
  }, [backendAvailable, purchaseOrders.length]);

  const updatePurchaseOrder = useCallback(async (id, updates) => {
    if (backendAvailable) {
      try {
        // Transform frontend updates to backend format
        // Backend expects: expected_date, payment_terms, notes, status, vendor_id, etc.
        const backendUpdates = {};

        // Handle expected date (accept both field names)
        // Backend expects date in YYYY-MM-DD format (not ISO with time)
        if (updates.expected_date) {
          const dateStr = updates.expected_date;
          backendUpdates.expected_date = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        } else if (updates.expected_delivery_date) {
          const dateStr = updates.expected_delivery_date;
          backendUpdates.expected_date = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        }

        if (updates.payment_terms !== undefined) {
          // Backend expects payment_terms as string (e.g., "net_30", "30")
          backendUpdates.payment_terms = String(updates.payment_terms);
        }
        if (updates.notes !== undefined) {
          backendUpdates.notes = updates.notes;
        }
        if (updates.status) {
          // Block statuses that must go through dedicated endpoints
          // 'confirmed'/'approved' -> use approvePurchaseOrder() which calls POST /:id/approve
          // 'received' -> use receivePurchaseOrder() which calls POST /:id/receive
          const blockedStatuses = ['confirmed', 'approved', 'received'];
          if (blockedStatuses.includes(updates.status)) {
            throw new Error(`Status '${updates.status}' cannot be set via generic update. Use the dedicated endpoint.`);
          }
          const statusMap = {
            'draft': 'draft',
            'sent': 'ordered',
            'cancelled': 'cancelled',
            'partial': 'partial',
            'pending_approval': 'pending_approval',
            'ordered': 'ordered',
          };
          backendUpdates.status = statusMap[updates.status] || updates.status;
        }
        if (updates.vendor_id) {
          backendUpdates.vendor_id = updates.vendor_id;
        }
        if (updates.vendor_reference !== undefined) {
          backendUpdates.vendor_reference = updates.vendor_reference;
        }
        // Warehouse — accepts null/empty to clear back to NULL.
        // Was previously dropped here, so the edit modal's warehouse
        // change never reached the server.
        if (updates.warehouse_id !== undefined) {
          backendUpdates.warehouse_id = updates.warehouse_id || '';
        }
        if (updates.contact_person_id !== undefined) {
          backendUpdates.contact_person_id = updates.contact_person_id || '';
        }
        if (updates.internal_notes !== undefined) {
          backendUpdates.internal_notes = updates.internal_notes;
        }
        if (updates.shipping_amount !== undefined) {
          backendUpdates.shipping_amount = updates.shipping_amount;
        }
        // Lines — pass through as-is. The edit modal sends a complete
        // replacement set (handleUpdatePO in PurchaseOrders.jsx).
        // Was being dropped, which is why edits to product/qty/price
        // appeared to do nothing on save.
        if (Array.isArray(updates.lines)) {
          backendUpdates.lines = updates.lines;
        }

        // Only call API if there are updates to send
        if (Object.keys(backendUpdates).length > 0) {
          await procurementService.updateOrder(id, backendUpdates);
        }

        // Refresh from the authoritative server response — the local
        // optimistic merge below isn't enough because line replacement
        // recomputes server-side totals (subtotal/tax_amount/total_amount)
        // that the optimistic update doesn't know about. Without the
        // refetch, the list view shows stale numbers until reload.
        let refreshed = null;
        try {
          refreshed = await procurementService.getOrder(id);
        } catch (refreshErr) {
          console.warn('PO update succeeded but refetch failed:', refreshErr);
        }

        setPurchaseOrders(prev => prev.map(po => {
          if (po.id !== id) return po;
          if (refreshed) {
            // Map backend's order_number/vendor_name to the list's
            // expected po_number/vendor_name shape.
            return {
              ...po,
              ...refreshed,
              po_number: refreshed.po_number || refreshed.order_number || po.po_number,
              vendor_name: refreshed.vendor_name || po.vendor_name,
            };
          }
          return { ...po, ...updates };
        }));
        return refreshed || { id, ...updates };
      } catch (error) {
        console.error('Failed to update PO via API:', error);
        throw error;
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
      
        toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    setPurchaseOrders(prev => prev.filter(po => po.id !== id));
  }, [backendAvailable]);

  const approvePurchaseOrder = useCallback(async (id) => {
    if (backendAvailable) {
      try {
        await procurementService.approveOrder(id);
        // Backend returns {message, status}, not full PO — update local state with confirmed status
        setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'confirmed' } : po));
        return { id, status: 'confirmed' };
      } catch (error) {
        console.error('Failed to approve PO via API:', error);
        throw error;
      }
    }
    setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'confirmed' } : po));
  }, [backendAvailable]);

  const receivePurchaseOrder = useCallback(async (id, data) => {
    if (backendAvailable) {
      try {
        let receiveData = data;
        // If no lines provided, fetch the full PO and receive all remaining quantities
        if (!receiveData?.lines || receiveData.lines.length === 0) {
          const fullPO = await procurementService.getOrder(id);
          if (fullPO?.lines?.length > 0) {
            receiveData = {
              lines: fullPO.lines.map(line => ({
                line_id: line.id,
                quantity_received: line.quantity - (line.quantity_received || 0),
              })).filter(line => line.quantity_received > 0),
              ...receiveData,
            };
          }
        }
        await procurementService.receiveOrder(id, receiveData);
        setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'received' } : po));
        return { id, status: 'received' };
      } catch (error) {
        console.error('Failed to receive PO via API:', error);
        throw error;
      }
    }
    setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status: 'received', ...data } : po));
  }, [backendAvailable]);

  // Supplier rating update
  const updateSupplierRating = useCallback(async (supplierId, rating, comment = '') => {
    if (backendAvailable) {
      try {
        const result = await procurementService.rateSupplier(supplierId, rating, comment);
        // Update local state with new average rating from backend
        setSuppliers(prev => prev.map(s =>
          s.id === supplierId
            ? { ...s, rating: result.rating, rating_count: result.rating_count }
            : s
        ));
        return;
      } catch (err) {
        console.error('Failed to rate supplier via backend:', err);
      }
    }
    // Fallback: local-only update
    const supplier = getSupplierById(supplierId);
    if (supplier) {
      const currentRating = supplier.rating || 0;
      const ratingCount = supplier.rating_count || 0;
      const newRating = ratingCount > 0
        ? ((currentRating * ratingCount) + rating) / (ratingCount + 1)
        : rating;

      setSuppliers(prev => prev.map(s =>
        s.id === supplierId
          ? { ...s, rating: Math.round(newRating * 10) / 10, rating_count: ratingCount + 1 }
          : s
      ));
    }
  }, [backendAvailable, getSupplierById]);

  // Summary statistics
  const getSupplierStats = useCallback(() => {
    const activeSuppliers = suppliers.filter(s => s.status === 'active').length;

    // Build a set of current supplier IDs for filtering
    const supplierIds = new Set(suppliers.map(s => s.id));

    // Calculate total spent from purchase orders only for listed suppliers
    let totalSpent = 0;
    let totalOrders = 0;
    purchaseOrders.forEach(po => {
      const vendorId = po.vendor_id || po.supplier_id;
      if (vendorId && supplierIds.has(vendorId)) {
        totalOrders++;
        if (['received', 'completed', 'partial', 'approved', 'ordered'].includes(po.status)) {
          totalSpent += (po.total_amount || po.total || 0);
        }
      }
    });

    // Calculate average rating from suppliers (only those with ratings)
    const ratedSuppliers = suppliers.filter(s => s.rating > 0);
    const avgRating = ratedSuppliers.length > 0
      ? ratedSuppliers.reduce((sum, s) => sum + s.rating, 0) / ratedSuppliers.length
      : 0;

    return {
      totalSuppliers: suppliers.length,
      activeSuppliers,
      totalSpent,
      totalOrders,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }, [suppliers, purchaseOrders]);

  // Refresh data from backend
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isBackendAvailable = await checkBackendHealth();
      setBackendAvailable(isBackendAvailable);

      if (isBackendAvailable) {
        const [suppliersData, posData, rfqsData, contractsData, priceHistoryData] = await Promise.all([
          procurementService.listSuppliers().catch(() => null),
          procurementService.listOrders().catch(() => null),
          procurementService.listRFQs().catch(() => null),
          procurementService.listContracts().catch(() => null),
          procurementService.listPriceHistoryGrouped().catch(() => null),
        ]);

        if (suppliersData) setSuppliers(suppliersData);
        if (posData) {
          // Reverse status mapping: backend → frontend
          const reverseStatusMap = {
            'ordered': 'sent',
            'approved': 'confirmed',
            'pending_approval': 'pending_approval',
            'draft': 'draft',
            'partial': 'partial',
            'received': 'received',
            'cancelled': 'cancelled',
          };
          const mappedPOs = posData.map(po => ({
            ...po,
            po_number: po.order_number,
            supplier_id: po.vendor_id,
            supplier_name: po.vendor_name,
            expected_delivery_date: po.expected_date,
            status: reverseStatusMap[po.status] || po.status,
          }));
          setPurchaseOrders(mappedPOs);
        }
        if (rfqsData) setRFQs(rfqsData);
        if (contractsData) {
          // Map backend contract fields to frontend format
          const mappedContracts = contractsData.map(contract => ({
            ...contract,
            supplier_id: contract.vendor_id,
            supplier_name: contract.vendor_name,
            type: contract.contract_type,
            auto_renew: contract.auto_renewal,
          }));
          setContracts(mappedContracts);
        }
        if (priceHistoryData) {
          // Map backend price history to frontend format
          const mappedPriceHistory = priceHistoryData.map(item => ({
            id: item.id,
            product_name: item.product_name,
            supplier_id: item.supplier_id,
            supplier_name: item.supplier_name,
            prices: item.prices || [],
          }));
          setPriceHistory(mappedPriceHistory);
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
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
  }), [suppliers, purchaseOrders, rfqs, contracts, priceHistory, isLoading, error, backendAvailable, createSupplier, updateSupplier, deleteSupplier, getSupplierById, updateSupplierRating, getSupplierStats, createRFQ, updateRFQ, deleteRFQ, submitRFQResponse, selectRFQWinner, createContract, updateContract, deleteContract, addPriceRecord, getProductPriceHistory, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, approvePurchaseOrder, receivePurchaseOrder, refreshData, purchaseSettings]);

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