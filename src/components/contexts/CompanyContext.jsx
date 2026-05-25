import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import apiClient from '@/api/client';
import { useEmployeePermissions } from './EmployeePermissionsContext';

const ACTIVE_COMPANY_KEY = 'genix_active_company';

const CompanyContext = createContext();

// Helper to get current user ID from localStorage
const getCurrentUserId = () => {
  try {
    const userData = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id || user.email;
    }
  } catch (e) {
    console.error('Error getting user ID:', e);
  }
  return 'default';
};

// Helper to get user-specific storage key
const getUserStorageKey = (baseKey) => {
  const userId = getCurrentUserId();
  return `${baseKey}_user_${userId}`;
};

export function CompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompanyState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Get permission context for organization filtering
  const { isAdmin, organizationIds, canAccessOrganization, isLoading: permissionsLoading } = useEmployeePermissions();

  // Use ref to always have access to latest companies without causing stale closures
  const companiesRef = useRef(companies);
  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  // Load companies from backend API
  const loadCompanies = useCallback(async () => {
    try {
      const userId = getCurrentUserId();
      setCurrentUserId(userId);
      setIsLoading(true);

      // Try to load from backend API
      const response = await apiClient.get('/organizations');
      // Backend returns { success: true, data: [...] }
      let companiesList = Array.isArray(response.data?.data) ? response.data.data : [];

      // Map backend format to frontend format
      // Note: Backend returns null for empty optional fields, so we use fallback values
      companiesList = companiesList.map(org => ({
        id: org.id,
        company_code: org.code || '',
        company_name: org.name || '',
        tax_id: org.tax_id || '',
        oked: org.oked || '',
        bank_account: org.bank_account || '',
        bank_mfo: org.bank_mfo || '',
        bank_name: org.bank_name || '',
        is_vat_payer: org.is_vat_payer || false,
        tax_regime: org.tax_regime || '',
        activity_status: org.activity_status || 'active',
        business_group: org.business_group || '',
        intercompany_relations: org.intercompany_relations || '',
        intercompany_vendor_ids: org.intercompany_vendor_ids || [],
        director_name: org.director_name || '',
        director_phone: org.director_phone || '',
        phone: org.contact_info?.phone || '',
        email: org.contact_info?.email || '',
        legal_address: org.legal_address || '',
        notes: org.notes || '',
        country: org.country ?? 'Uzbekistan',
        currency: org.currency ?? 'UZS',
        logo_url: org.logo_url || null,
        is_active: org.is_active !== false,
        owner_id: userId,
        created_date: org.created_at,
        updated_date: org.updated_at,
        // Per-org sidebar visibility list (migration 386). Apps whose ID
        // appears here are hidden from the sidebar when this company is
        // active. Defaults to [] for orgs with no overrides.
        hidden_apps: Array.isArray(org.hidden_apps) ? org.hidden_apps : [],
        // Keep original backend data
        _backend: org
      }));

      // Filter companies based on user's organization permissions
      // Admins see all companies, regular employees see only assigned companies
      if (!isAdmin && organizationIds && organizationIds.length > 0) {
        companiesList = companiesList.filter(company => organizationIds.includes(company.id));
      }

      // Only auto-create a default org if the user is an admin and there are truly no orgs at all
      if (companiesList.length === 0 && isAdmin) {
        try {
          const createResponse = await apiClient.post('/organizations', {
            code: 'MAIN',
            name: 'Asosiy Kompaniya',
            type: 'company',
            country: 'Uzbekistan',
            currency: 'UZS',
            accounting_standard: 'LOCAL_GAAP'
          });

          // Backend returns { success: true, data: {...} }
          const newOrg = createResponse.data?.data || createResponse.data;
          companiesList = [{
            id: newOrg.id,
            company_code: newOrg.code || 'MAIN',
            company_name: newOrg.name || 'Asosiy Kompaniya',
            country: newOrg.country ?? 'Uzbekistan',
            currency: newOrg.currency ?? 'UZS',
            accounting_standard: newOrg.accounting_standard ?? 'LOCAL_GAAP',
            logo_url: newOrg.logo_url || null,
            is_active: newOrg.is_active !== false,
            owner_id: userId,
            created_date: newOrg.created_at,
            _backend: newOrg
          }];
        } catch (createError) {
          console.error('Error creating default company:', createError);
        }
      }

      setCompanies(companiesList);

      // Load active company from localStorage (user preference)
      const activeKey = getUserStorageKey(ACTIVE_COMPANY_KEY);
      const activeId = localStorage.getItem(activeKey);

      if (activeId && companiesList.find(c => c.id === activeId)) {
        setActiveCompanyState(companiesList.find(c => c.id === activeId));
      } else if (companiesList.length > 0) {
        // Set first company as active
        setActiveCompanyState(companiesList[0]);
        localStorage.setItem(activeKey, companiesList[0].id);
      }
    } catch (error) {
      console.error('Error loading companies from API:', error);
      // Fallback: If API fails and user is not authenticated, set empty state
      setCompanies([]);
      setActiveCompanyState(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, organizationIds]);

  useEffect(() => {
    // Wait for permissions to be loaded before loading companies
    if (!permissionsLoading) {
      loadCompanies();
    }
  }, [loadCompanies, permissionsLoading]);

  // Reload companies when user changes (login/logout)
  useEffect(() => {
    const checkUserChange = () => {
      const newUserId = getCurrentUserId();
      if (newUserId !== currentUserId && currentUserId !== null) {
        loadCompanies();
      }
    };

    window.addEventListener('storage', checkUserChange);
    const interval = setInterval(checkUserChange, 30000);

    return () => {
      window.removeEventListener('storage', checkUserChange);
      clearInterval(interval);
    };
  }, [currentUserId, loadCompanies]);

  // Set active company
  const setActiveCompany = useCallback((companyId) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setActiveCompanyState(company);
      localStorage.setItem(getUserStorageKey(ACTIVE_COMPANY_KEY), companyId);
      // Reload the page so all components refetch with the new organization header
      window.location.reload();
      return { success: true };
    }
    return { success: false, error: 'company_not_found' };
  }, [companies]);

  // Add a new company
  const addCompany = async (companyData, maxCompanies = -1) => {
    // Use ref to get latest companies to avoid stale closure issues
    const currentCompanies = companiesRef.current;
    // Check limit
    if (maxCompanies !== -1 && currentCompanies.length >= maxCompanies) {
      return {
        success: false,
        error: 'limit_reached',
        message: `Kompaniya limiti (${maxCompanies}) ga yetildi. Tarifni yangilang.`
      };
    }

    // Auto-generate unique code if not provided
    const autoCode = companyData.company_code || `ORG-${Date.now()}`;

    try {
      // Create on backend with all Uzbekistan business fields
      const response = await apiClient.post('/organizations', {
        code: autoCode,
        name: companyData.company_name,
        type: 'company',
        tax_id: companyData.tax_id,
        oked: companyData.oked,
        bank_account: companyData.bank_account,
        bank_mfo: companyData.bank_mfo,
        bank_name: companyData.bank_name,
        is_vat_payer: companyData.is_vat_payer,
        tax_regime: companyData.tax_regime,
        activity_status: companyData.activity_status || 'active',
        business_group: companyData.business_group,
        intercompany_relations: companyData.intercompany_relations,
        intercompany_vendor_ids: companyData.intercompany_vendor_ids || [],
        director_name: companyData.director_name,
        director_phone: companyData.director_phone,
        legal_address: companyData.legal_address,
        notes: companyData.notes,
        country: companyData.country || 'Uzbekistan',
        currency: companyData.currency || 'UZS',
        logo_url: companyData.logo_url,
        contact_info: {
          email: companyData.email,
          phone: companyData.phone
        }
      });

      // Backend returns { success: true, data: {...} }
      const newOrg = response.data?.data || response.data;
      const userId = getCurrentUserId();

      const newCompany = {
        id: newOrg.id,
        company_code: newOrg.code || '',
        company_name: newOrg.name || '',
        tax_id: newOrg.tax_id || companyData.tax_id || '',
        oked: newOrg.oked || companyData.oked || '',
        bank_account: newOrg.bank_account || companyData.bank_account || '',
        bank_mfo: newOrg.bank_mfo || companyData.bank_mfo || '',
        bank_name: newOrg.bank_name || companyData.bank_name || '',
        is_vat_payer: newOrg.is_vat_payer ?? companyData.is_vat_payer ?? false,
        tax_regime: newOrg.tax_regime || companyData.tax_regime || '',
        activity_status: newOrg.activity_status || companyData.activity_status || 'active',
        business_group: newOrg.business_group || companyData.business_group || '',
        intercompany_relations: newOrg.intercompany_relations || companyData.intercompany_relations || '',
        director_name: newOrg.director_name || companyData.director_name || '',
        director_phone: newOrg.director_phone || companyData.director_phone || '',
        phone: newOrg.contact_info?.phone || companyData.phone || '',
        email: newOrg.contact_info?.email || companyData.email || '',
        legal_address: newOrg.legal_address || companyData.legal_address || '',
        notes: newOrg.notes || companyData.notes || '',
        country: newOrg.country ?? companyData.country ?? 'Uzbekistan',
        currency: newOrg.currency ?? companyData.currency ?? 'UZS',
        logo_url: newOrg.logo_url || null,
        is_active: newOrg.is_active !== false,
        owner_id: userId,
        created_date: newOrg.created_at,
        _backend: newOrg
      };

      // Use functional update to avoid stale state
      setCompanies(prev => {
        const updated = [...prev, newCompany];
        // If this is the first company, set it as active
        if (updated.length === 1) {
          setActiveCompanyState(newCompany);
          localStorage.setItem(getUserStorageKey(ACTIVE_COMPANY_KEY), newCompany.id);
        }
        return updated;
      });

      const result = { success: true, company: newCompany };
      return result;
    } catch (error) {
      console.error('Error creating company (catch block):', error);
      const errorData = error.response?.data?.error;
      const errorMessage = typeof errorData === 'string'
        ? errorData
        : errorData?.message || error.message;

      if (error.response?.status === 409) {
        return {
          success: false,
          error: 'duplicate_code',
          message: 'Bu kod bilan kompaniya mavjud'
        };
      }

      return {
        success: false,
        error: 'api_error',
        message: errorMessage || 'Kompaniya yaratishda xatolik'
      };
    }
  };

  // Update a company
  const updateCompany = useCallback(async (companyId, updates) => {
    try {
      // Map frontend field names to backend field names
      const backendUpdates = {};
      if (updates.company_code !== undefined) backendUpdates.code = updates.company_code;
      if (updates.company_name !== undefined) backendUpdates.name = updates.company_name;
      if (updates.tax_id !== undefined) backendUpdates.tax_id = updates.tax_id;
      if (updates.oked !== undefined) backendUpdates.oked = updates.oked;
      if (updates.bank_account !== undefined) backendUpdates.bank_account = updates.bank_account;
      if (updates.bank_mfo !== undefined) backendUpdates.bank_mfo = updates.bank_mfo;
      if (updates.bank_name !== undefined) backendUpdates.bank_name = updates.bank_name;
      if (updates.is_vat_payer !== undefined) backendUpdates.is_vat_payer = updates.is_vat_payer;
      if (updates.tax_regime !== undefined) backendUpdates.tax_regime = updates.tax_regime;
      if (updates.activity_status !== undefined) backendUpdates.activity_status = updates.activity_status;
      if (updates.business_group !== undefined) backendUpdates.business_group = updates.business_group;
      if (updates.intercompany_relations !== undefined) backendUpdates.intercompany_relations = updates.intercompany_relations;
      if (updates.director_name !== undefined) backendUpdates.director_name = updates.director_name;
      if (updates.director_phone !== undefined) backendUpdates.director_phone = updates.director_phone;
      if (updates.legal_address !== undefined) backendUpdates.legal_address = updates.legal_address;
      if (updates.notes !== undefined) backendUpdates.notes = updates.notes;
      if (updates.country !== undefined) backendUpdates.country = updates.country;
      if (updates.currency !== undefined) backendUpdates.currency = updates.currency;
      if (updates.logo_url !== undefined) backendUpdates.logo_url = updates.logo_url;
      if (updates.is_active !== undefined) backendUpdates.is_active = updates.is_active;
      if (updates.intercompany_vendor_ids !== undefined) backendUpdates.intercompany_vendor_ids = updates.intercompany_vendor_ids;
      // Handle contact info
      if (updates.email !== undefined || updates.phone !== undefined) {
        backendUpdates.contact_info = {
          email: updates.email,
          phone: updates.phone
        };
      }

      await apiClient.put(`/organizations/${companyId}`, backendUpdates);

      // Update local state
      const updated = companies.map(c =>
        c.id === companyId ? { ...c, ...updates, updated_date: new Date().toISOString() } : c
      );
      setCompanies(updated);

      // Update active company if it was updated
      if (activeCompany?.id === companyId) {
        setActiveCompanyState(updated.find(c => c.id === companyId));
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating company:', error);

      if (error.response?.status === 409) {
        return {
          success: false,
          error: 'duplicate_code',
          message: 'Bu kod bilan kompaniya mavjud'
        };
      }

      return {
        success: false,
        error: 'api_error',
        message: error.response?.data?.error || 'Kompaniyani yangilashda xatolik'
      };
    }
  }, [companies, activeCompany]);

  // Delete a company
  const deleteCompany = useCallback(async (companyId) => {
    // Prevent deleting last company
    if (companies.length <= 1) {
      return {
        success: false,
        error: 'last_company',
        message: 'Oxirgi kompaniyani o\'chirish mumkin emas'
      };
    }

    try {
      await apiClient.delete(`/organizations/${companyId}`);

      const updated = companies.filter(c => c.id !== companyId);
      setCompanies(updated);

      // If deleted company was active, switch to first available
      if (activeCompany?.id === companyId && updated.length > 0) {
        setActiveCompany(updated[0].id);
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting company:', error);

      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'last_company',
          message: 'Oxirgi kompaniyani o\'chirish mumkin emas'
        };
      }

      return {
        success: false,
        error: 'api_error',
        message: error.response?.data?.error || 'Kompaniyani o\'chirishda xatolik'
      };
    }
  }, [companies, activeCompany, setActiveCompany]);

  // Get company by ID
  const getCompany = useCallback((companyId) => {
    return companies.find(c => c.id === companyId);
  }, [companies]);

  // Get company count
  const getCompanyCount = useCallback(() => {
    return companies.length;
  }, [companies]);

  // Toggle company active status
  const toggleCompanyStatus = useCallback(async (companyId) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return { success: false, error: 'company_not_found' };

    return updateCompany(companyId, { is_active: !company.is_active });
  }, [companies, updateCompany]);

  // Import companies from array
  const importCompanies = useCallback(async (companiesData) => {
    try {
      const response = await apiClient.post('/organizations/import', {
        organizations: companiesData
      });

      // Refresh companies list after import
      await loadCompanies();

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error importing companies:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'import_failed'
      };
    }
  }, [loadCompanies]);

  // Export companies to JSON
  const exportCompanies = useCallback(() => {
    return companies.map(company => ({
      code: company.company_code,
      name: company.company_name,
      tax_id: company.tax_id,
      oked: company.oked,
      bank_account: company.bank_account,
      bank_mfo: company.bank_mfo,
      bank_name: company.bank_name,
      is_vat_payer: company.is_vat_payer,
      tax_regime: company.tax_regime,
      activity_status: company.activity_status,
      business_group: company.business_group,
      intercompany_relations: company.intercompany_relations,
      director_name: company.director_name,
      director_phone: company.director_phone,
      legal_address: company.legal_address,
      notes: company.notes,
      currency: company.currency,
      country: company.country,
      contact_info: {
        email: company.email,
        phone: company.phone
      }
    }));
  }, [companies]);

  const value = useMemo(() => ({
    companies,
    activeCompany,
    isLoading,
    // Methods
    setActiveCompany,
    addCompany,
    updateCompany,
    deleteCompany,
    getCompany,
    getCompanyCount,
    toggleCompanyStatus,
    importCompanies,
    exportCompanies,
    refreshCompanies: loadCompanies
  }), [companies, activeCompany, isLoading, setActiveCompany, addCompany, updateCompany, deleteCompany, getCompany, getCompanyCount, toggleCompanyStatus, importCompanies, exportCompanies, loadCompanies]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}

export default CompanyContext;
