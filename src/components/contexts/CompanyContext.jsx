import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
        country: org.country ?? 'Uzbekistan',
        currency: org.currency ?? 'UZS',
        accounting_standard: org.accounting_standard ?? 'LOCAL_GAAP',
        logo_url: org.logo_url || null,
        is_active: org.is_active !== false,
        owner_id: userId,
        created_date: org.created_at,
        updated_date: org.updated_at,
        // Keep original backend data
        _backend: org
      }));

      // Filter companies based on user's organization permissions
      // Admins see all companies, regular employees see only assigned companies
      if (!isAdmin && organizationIds && organizationIds.length > 0) {
        companiesList = companiesList.filter(company => organizationIds.includes(company.id));
      }

      // If no companies exist, create a default one
      if (companiesList.length === 0) {
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
    const interval = setInterval(checkUserChange, 1000);

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
    console.log('addCompany called with:', companyData, 'maxCompanies:', maxCompanies);
    console.log('Current companies count:', currentCompanies.length);

    // Check limit
    if (maxCompanies !== -1 && currentCompanies.length >= maxCompanies) {
      console.log('Limit reached - returning error');
      return {
        success: false,
        error: 'limit_reached',
        message: `Kompaniya limiti (${maxCompanies}) ga yetildi. Tarifni yangilang.`
      };
    }

    // Check for duplicate code locally first
    if (currentCompanies.some(c => c.company_code === companyData.company_code)) {
      console.log('Duplicate code found locally');
      return {
        success: false,
        error: 'duplicate_code',
        message: 'Bu kod bilan kompaniya mavjud'
      };
    }

    try {
      // Create on backend
      const response = await apiClient.post('/organizations', {
        code: companyData.company_code,
        name: companyData.company_name,
        type: 'company',
        country: companyData.country,
        currency: companyData.currency,
        accounting_standard: companyData.accounting_standard,
        logo_url: companyData.logo_url
      });

      // Backend returns { success: true, data: {...} }
      const newOrg = response.data?.data || response.data;
      const userId = getCurrentUserId();

      const newCompany = {
        id: newOrg.id,
        company_code: newOrg.code || '',
        company_name: newOrg.name || '',
        country: newOrg.country ?? companyData.country ?? 'Uzbekistan',
        currency: newOrg.currency ?? companyData.currency ?? 'UZS',
        accounting_standard: newOrg.accounting_standard ?? companyData.accounting_standard ?? 'LOCAL_GAAP',
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

      console.log('Company created successfully, returning success');
      const result = { success: true, company: newCompany };
      console.log('Returning result:', result);
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
      if (updates.country !== undefined) backendUpdates.country = updates.country;
      if (updates.currency !== undefined) backendUpdates.currency = updates.currency;
      if (updates.accounting_standard !== undefined) backendUpdates.accounting_standard = updates.accounting_standard;
      if (updates.logo_url !== undefined) backendUpdates.logo_url = updates.logo_url;
      if (updates.is_active !== undefined) backendUpdates.is_active = updates.is_active;

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

  return (
    <CompanyContext.Provider value={{
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
      refreshCompanies: loadCompanies
    }}>
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
