import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const COMPANIES_KEY = 'genix_companies';
const ACTIVE_COMPANY_KEY = 'genix_active_company';

const CompanyContext = createContext();

// Helper to get current user ID from localStorage
const getCurrentUserId = () => {
  try {
    const userData = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id || user.email; // Use ID or email as fallback
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

  // Load companies from storage (user-scoped)
  const loadCompanies = useCallback(() => {
    try {
      const userId = getCurrentUserId();
      setCurrentUserId(userId);

      const companiesKey = getUserStorageKey(COMPANIES_KEY);
      const activeKey = getUserStorageKey(ACTIVE_COMPANY_KEY);

      const stored = localStorage.getItem(companiesKey);
      let companiesList = [];

      if (stored) {
        companiesList = JSON.parse(stored);
      } else {
        // Create default company for this user
        const defaultCompany = {
          id: `comp_${Date.now()}`,
          company_code: 'MAIN',
          company_name: 'Asosiy Kompaniya',
          country: 'Uzbekistan',
          currency: 'UZS',
          accounting_standard: 'LOCAL_GAAP',
          logo_url: null,
          is_active: true,
          owner_id: userId, // Track owner
          created_date: new Date().toISOString()
        };
        companiesList = [defaultCompany];
        localStorage.setItem(companiesKey, JSON.stringify(companiesList));
      }

      setCompanies(companiesList);

      // Load active company (user-scoped)
      const activeId = localStorage.getItem(activeKey);
      if (activeId && companiesList.find(c => c.id === activeId)) {
        setActiveCompanyState(companiesList.find(c => c.id === activeId));
      } else if (companiesList.length > 0) {
        // Set first company as active
        setActiveCompanyState(companiesList[0]);
        localStorage.setItem(activeKey, companiesList[0].id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Reload companies when user changes (login/logout)
  useEffect(() => {
    const checkUserChange = () => {
      const newUserId = getCurrentUserId();
      if (newUserId !== currentUserId && currentUserId !== null) {
        // User changed, reload companies
        loadCompanies();
      }
    };

    // Listen for storage changes (in case of login/logout in another tab)
    window.addEventListener('storage', checkUserChange);

    // Also check periodically for user changes in same tab
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
      // Dispatch event for other contexts to reload data
      window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId } }));
      return { success: true };
    }
    return { success: false, error: 'company_not_found' };
  }, [companies]);

  // Add a new company
  const addCompany = useCallback((companyData, maxCompanies = -1) => {
    // Check limit
    if (maxCompanies !== -1 && companies.length >= maxCompanies) {
      return {
        success: false,
        error: 'limit_reached',
        message: `Kompaniya limiti (${maxCompanies}) ga yetildi. Tarifni yangilang.`
      };
    }

    // Check for duplicate code (within this user's companies)
    if (companies.some(c => c.company_code === companyData.company_code)) {
      return {
        success: false,
        error: 'duplicate_code',
        message: 'Bu kod bilan kompaniya mavjud'
      };
    }

    const userId = getCurrentUserId();
    const newCompany = {
      id: `comp_${Date.now()}`,
      ...companyData,
      owner_id: userId, // Track owner
      is_active: true,
      created_date: new Date().toISOString()
    };

    const updated = [...companies, newCompany];
    localStorage.setItem(getUserStorageKey(COMPANIES_KEY), JSON.stringify(updated));
    setCompanies(updated);

    // If this is the first company, set it as active
    if (updated.length === 1) {
      setActiveCompany(newCompany.id);
    }

    return { success: true, company: newCompany };
  }, [companies, setActiveCompany]);

  // Update a company
  const updateCompany = useCallback((companyId, updates) => {
    const updated = companies.map(c =>
      c.id === companyId ? { ...c, ...updates, updated_date: new Date().toISOString() } : c
    );
    localStorage.setItem(getUserStorageKey(COMPANIES_KEY), JSON.stringify(updated));
    setCompanies(updated);

    // Update active company if it was updated
    if (activeCompany?.id === companyId) {
      setActiveCompanyState(updated.find(c => c.id === companyId));
    }

    return { success: true };
  }, [companies, activeCompany]);

  // Delete a company
  const deleteCompany = useCallback((companyId) => {
    // Prevent deleting last company
    if (companies.length <= 1) {
      return {
        success: false,
        error: 'last_company',
        message: 'Oxirgi kompaniyani o\'chirish mumkin emas'
      };
    }

    const updated = companies.filter(c => c.id !== companyId);
    localStorage.setItem(getUserStorageKey(COMPANIES_KEY), JSON.stringify(updated));
    setCompanies(updated);

    // If deleted company was active, switch to first available
    if (activeCompany?.id === companyId && updated.length > 0) {
      setActiveCompany(updated[0].id);
    }

    return { success: true };
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
  const toggleCompanyStatus = useCallback((companyId) => {
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
