import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCompany } from './CompanyContext';

const VENDORS_STORAGE_KEY = 'genix_vendors';

const VendorsContext = createContext();

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

// Sample vendors for demo purposes
const sampleVendors = [
  {
    id: 'ven_1',
    vendor_code: 'VEN-001',
    vendor_name: 'Office Depot',
    contact_name: 'John Smith',
    email: 'vendor@officedepot.com',
    phone: '+998 90 123 4567',
    address: {
      street: '123 Supply Ave',
      city: 'Tashkent',
      country: 'Uzbekistan'
    },
    payment_terms: 'net_30',
    currency: 'UZS',
    tax_id: '',
    is_preferred: true,
    status: 'active',
    rating: 4.5,
    notes: 'Reliable office supplies vendor',
    created_date: new Date().toISOString()
  },
  {
    id: 'ven_2',
    vendor_code: 'VEN-002',
    vendor_name: 'Tech Supplies Co',
    contact_name: 'Maria Garcia',
    email: 'sales@techsupplies.com',
    phone: '+998 91 234 5678',
    address: {
      street: '456 Tech Blvd',
      city: 'Tashkent',
      country: 'Uzbekistan'
    },
    payment_terms: 'net_15',
    currency: 'UZS',
    tax_id: '',
    is_preferred: false,
    status: 'active',
    rating: 4.0,
    notes: 'Computer and electronics supplier',
    created_date: new Date().toISOString()
  },
  {
    id: 'ven_3',
    vendor_code: 'VEN-003',
    vendor_name: 'Global Logistics',
    contact_name: 'Ali Karimov',
    email: 'info@globallogistics.uz',
    phone: '+998 93 345 6789',
    address: {
      street: '789 Shipping Lane',
      city: 'Samarkand',
      country: 'Uzbekistan'
    },
    payment_terms: 'net_30',
    currency: 'UZS',
    tax_id: '',
    is_preferred: false,
    status: 'active',
    rating: 3.5,
    notes: 'Freight and logistics services',
    created_date: new Date().toISOString()
  }
];

export function VendorsProvider({ children }) {
  const { activeCompany } = useCompany();
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load vendors from localStorage
  const loadFromLocalStorage = useCallback(() => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDORS_STORAGE_KEY, companyId);

    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setVendors(JSON.parse(stored));
    } else {
      // Initialize with sample vendors
      const initialVendors = sampleVendors.map(v => ({
        ...v,
        company_id: companyId
      }));
      localStorage.setItem(storageKey, JSON.stringify(initialVendors));
      setVendors(initialVendors);
    }
  }, [activeCompany]);

  // Load data
  const loadData = useCallback(async () => {
    if (!activeCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      // For now, use localStorage only
      // TODO: Add API integration when backend supports vendors
      loadFromLocalStorage();
    } catch (err) {
      console.error('Error loading vendors:', err);
      setError(err.message);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, loadFromLocalStorage]);

  // Load on mount and company change
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

  // Generate unique vendor code
  const generateVendorCode = useCallback(() => {
    const existingCodes = vendors.map(v => v.vendor_code);
    let counter = vendors.length + 1;
    let code = `VEN-${String(counter).padStart(3, '0')}`;

    while (existingCodes.includes(code)) {
      counter++;
      code = `VEN-${String(counter).padStart(3, '0')}`;
    }

    return code;
  }, [vendors]);

  // Create vendor
  const createVendor = useCallback((vendorData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDORS_STORAGE_KEY, companyId);

    const newVendor = {
      id: `ven_${Date.now()}`,
      vendor_code: vendorData.vendor_code || generateVendorCode(),
      vendor_name: vendorData.vendor_name,
      contact_name: vendorData.contact_name || '',
      email: vendorData.email || '',
      phone: vendorData.phone || '',
      address: vendorData.address || { street: '', city: '', country: 'Uzbekistan' },
      payment_terms: vendorData.payment_terms || 'net_30',
      currency: vendorData.currency || 'UZS',
      tax_id: vendorData.tax_id || '',
      is_preferred: vendorData.is_preferred || false,
      status: vendorData.status || 'active',
      rating: vendorData.rating || 0,
      notes: vendorData.notes || '',
      company_id: companyId,
      created_date: new Date().toISOString()
    };

    const updated = [newVendor, ...vendors];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendors(updated);
    return newVendor;
  }, [vendors, activeCompany, generateVendorCode]);

  // Update vendor
  const updateVendor = useCallback((id, vendorData) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDORS_STORAGE_KEY, companyId);

    const updated = vendors.map(v =>
      v.id === id ? { ...v, ...vendorData, updated_date: new Date().toISOString() } : v
    );
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendors(updated);
  }, [vendors, activeCompany]);

  // Delete vendor
  const deleteVendor = useCallback((id) => {
    const companyId = activeCompany?.id;
    const storageKey = getStorageKey(VENDORS_STORAGE_KEY, companyId);

    const updated = vendors.filter(v => v.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setVendors(updated);
  }, [vendors, activeCompany]);

  // Get vendor by ID
  const getVendorById = useCallback((id) => {
    return vendors.find(v => v.id === id);
  }, [vendors]);

  // Get vendor by name (for PO/Bill integration)
  const getVendorByName = useCallback((name) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();
    return vendors.find(v =>
      v.vendor_name.toLowerCase() === lowerName ||
      v.vendor_name.toLowerCase().includes(lowerName)
    );
  }, [vendors]);

  // List vendors with optional sorting and limit
  const listVendors = useCallback((sortField, limit) => {
    let sorted = [...vendors];

    if (sortField) {
      const desc = sortField.startsWith('-');
      const field = desc ? sortField.slice(1) : sortField;
      sorted.sort((a, b) => {
        const aVal = a[field] || '';
        const bVal = b[field] || '';
        if (desc) {
          return bVal > aVal ? 1 : -1;
        }
        return aVal > bVal ? 1 : -1;
      });
    }

    return limit ? sorted.slice(0, limit) : sorted;
  }, [vendors]);

  // Get active vendors only
  const getActiveVendors = useCallback(() => {
    return vendors.filter(v => v.status === 'active');
  }, [vendors]);

  // Get preferred vendors
  const getPreferredVendors = useCallback(() => {
    return vendors.filter(v => v.is_preferred && v.status === 'active');
  }, [vendors]);

  // Get vendor statistics
  const getVendorStats = useCallback(() => {
    const active = vendors.filter(v => v.status === 'active').length;
    const inactive = vendors.filter(v => v.status === 'inactive').length;
    const onHold = vendors.filter(v => v.status === 'on_hold').length;
    const preferred = vendors.filter(v => v.is_preferred).length;

    return {
      total: vendors.length,
      active,
      inactive,
      onHold,
      preferred
    };
  }, [vendors]);

  return (
    <VendorsContext.Provider value={{
      vendors,
      isLoading,
      error,
      // CRUD operations
      createVendor,
      updateVendor,
      deleteVendor,
      // Query operations
      getVendorById,
      getVendorByName,
      listVendors,
      getActiveVendors,
      getPreferredVendors,
      getVendorStats,
      // Utilities
      generateVendorCode,
      refreshData: loadData
    }}>
      {children}
    </VendorsContext.Provider>
  );
}

export function useVendors() {
  const context = useContext(VendorsContext);
  if (!context) {
    throw new Error('useVendors must be used within VendorsProvider');
  }
  return context;
}

export default VendorsContext;
