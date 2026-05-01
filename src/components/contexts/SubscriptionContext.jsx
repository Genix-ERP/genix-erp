import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import subscriptionService from '@/api/services/subscription';

const SUBSCRIPTION_KEY = 'genix_company_subscription';
const AI_USAGE_KEY = 'genix_ai_usage';
const COMPANY_USERS_KEY = 'genix_company_users';

// Plan definitions matching your pricing page
const PLAN_LIMITS = {
  free_trial: {
    name: 'Free Trial',
    price: 0,
    minUsers: 1,
    maxUsers: 3,
    maxCompanies: 1,
    aiRequestsPerMonth: 50,
    cloudStorageGB: 1,
    features: {
      ai_data_entry: true,
      basic_financials: true,
      simple_inventory: true,
      standard_reports: false,
      email_support: true,
      mobile_access: false,
      single_company: true,
      advanced_ai: false,
      multi_module_erp: false,
      workflow_automation: false,
      custom_reports: false,
      priority_support: false,
      api_access: false,
      multi_company: false,
      advanced_security: false,
      white_label: false,
      dedicated_support: false,
      full_ai_suite: false,
      ai_supply_chain: false,
      custom_ai_training: false,
      dedicated_account_manager: false,
      on_premise: false,
      soc2_gdpr: false,
      custom_integrations: false
    }
  },
  starter: {
    name: 'Starter',
    price: 299,
    minUsers: 1,
    maxUsers: 10,
    maxCompanies: 1,
    aiRequestsPerMonth: 500,
    cloudStorageGB: 5,
    features: {
      ai_data_entry: true,
      basic_financials: true,
      simple_inventory: true,
      standard_reports: true,
      email_support: true,
      mobile_access: true,
      single_company: true,
      advanced_ai: false,
      multi_module_erp: false,
      workflow_automation: false,
      custom_reports: false,
      priority_support: false,
      api_access: false,
      multi_company: false,
      advanced_security: false,
      white_label: false,
      dedicated_support: false,
      full_ai_suite: false,
      ai_supply_chain: false,
      custom_ai_training: false,
      dedicated_account_manager: false,
      on_premise: false,
      soc2_gdpr: false,
      custom_integrations: false
    }
  },
  professional: {
    name: 'Professional',
    price: 499,
    minUsers: 1,
    maxUsers: 50,
    aiRequestsPerMonth: 2500,
    cloudStorageGB: 50,
    features: {
      ai_data_entry: true,
      basic_financials: true,
      simple_inventory: true,
      standard_reports: true,
      email_support: true,
      mobile_access: true,
      single_company: true,
      advanced_ai: true,
      multi_module_erp: true,
      workflow_automation: true,
      custom_reports: true,
      priority_support: true,
      api_access: true,
      multi_company: true, // up to 3 companies
      advanced_security: true,
      white_label: false,
      dedicated_support: false,
      full_ai_suite: false,
      ai_supply_chain: false,
      custom_ai_training: false,
      dedicated_account_manager: false,
      on_premise: false,
      soc2_gdpr: false,
      custom_integrations: false
    },
    maxCompanies: 3,
    apiCallsPerMonth: 5000
  },
  enterprise: {
    name: 'Enterprise',
    price: 999,
    minUsers: 1,
    maxUsers: -1, // unlimited
    aiRequestsPerMonth: -1, // unlimited
    cloudStorageGB: -1, // unlimited
    features: {
      ai_data_entry: true,
      basic_financials: true,
      simple_inventory: true,
      standard_reports: true,
      email_support: true,
      mobile_access: true,
      single_company: true,
      advanced_ai: true,
      multi_module_erp: true,
      workflow_automation: true,
      custom_reports: true,
      priority_support: true,
      api_access: true,
      multi_company: true,
      advanced_security: true,
      white_label: true,
      dedicated_support: true,
      full_ai_suite: true,
      ai_supply_chain: true,
      custom_ai_training: true,
      dedicated_account_manager: true,
      on_premise: true,
      soc2_gdpr: true,
      custom_integrations: true
    },
    maxCompanies: -1, // unlimited
    apiCallsPerMonth: -1 // unlimited
  }
};

// Feature descriptions for UI
const FEATURE_DESCRIPTIONS = {
  ai_data_entry: 'AI yordamida ma\'lumot kiritish',
  basic_financials: 'Asosiy moliyaviy boshqaruv',
  simple_inventory: 'Oddiy inventar kuzatuvi',
  standard_reports: 'Standart hisobotlar (15+ hisobot)',
  email_support: 'Email yordam',
  mobile_access: 'Mobil kirish',
  single_company: 'Bitta kompaniya profili',
  advanced_ai: 'AI tahlil va prognozlash',
  multi_module_erp: 'Ko\'p modulli ERP (Moliya, HR, SCM)',
  workflow_automation: 'Avtomatlashtirilgan ish oqimi mexanizmi',
  custom_reports: 'Maxsus hisobot qurish',
  priority_support: 'Ustuvor yordam (8s javob)',
  api_access: 'API kirish',
  multi_company: 'Ko\'p kompaniya profillari',
  advanced_security: 'Xavfsizlik va ruxsatlar',
  white_label: 'White-Label variantlar',
  dedicated_support: '24/7 Premium yordam (1s javob)',
  full_ai_suite: 'To\'liq AI to\'plami (Chatbot, Prognoz AI)',
  ai_supply_chain: 'AI asosida ta\'minot zanjirini optimallashtirish',
  custom_ai_training: 'Maxsus AI model o\'qitish',
  dedicated_account_manager: 'Maxsus hisob menejeri',
  on_premise: 'On-Premise joylashtirilish varianti',
  soc2_gdpr: 'Muvofiqlik (SOC2, GDPR)',
  custom_integrations: 'Maxsus integratsiyalar'
};

const SubscriptionContext = createContext();

export function SubscriptionProvider({ children }) {
  const { user: authUser, backendAvailable } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [aiUsage, setAiUsage] = useState({ count: 0, month: null });
  const [companyUsers, setCompanyUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Backend trial status (real data from server)
  const [trialStatus, setTrialStatus] = useState(null); // { status, plan, trial_ends_at, account_clear_at, trial_days_remaining, days_until_clear }

  // The /subscription/status endpoint isn't deployed on the production
  // backend (returns 404), and the resulting noise pollutes every page
  // load via SubscriptionContext mounting at the app root. We've
  // disabled the call until the backend ships the endpoint. The
  // downstream consumers (isTrialExpiredReal, getTrialDaysRemainingReal,
  // etc.) already handle null trialStatus gracefully — they fall back
  // to the local subscription state.
  const fetchTrialStatus = useCallback(async () => {
    // no-op — see comment above
  }, []);

  // Interval also disabled since the fetch is a no-op. Kept the hook
  // shell so existing wiring (imports, deps array, exports) doesn't
  // need to change; flip the body back when the API ships.
  useEffect(() => {
    // intentionally empty
  }, [fetchTrialStatus]);

  // Listen for payment_success message from the Multicard tab
  useEffect(() => {
    const handlePaymentMessage = (e) => {
      if (e.data?.type === 'payment_success') {
        fetchTrialStatus();
      }
    };
    window.addEventListener('message', handlePaymentMessage);
    return () => window.removeEventListener('message', handlePaymentMessage);
  }, [fetchTrialStatus]);

  // Listen for 402 responses from any API call — force payment wall immediately
  useEffect(() => {
    const handle402 = () => {
      setTrialStatus(prev => {
        if (prev?.status === 'active') return prev; // don't override paid accounts
        return { ...(prev || {}), status: 'past_due' };
      });
    };
    window.addEventListener('genix:payment-required', handle402);
    return () => window.removeEventListener('genix:payment-required', handle402);
  }, []);

  // Check if current user is a site admin (full system access)
  const isSystemAdmin = useCallback(() => {
    // First check auth context user (source of truth)
    const user = authUser || (() => {
      try {
        const stored = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    })();
    if (!user) return false;

    if (user.is_system_admin) return true;
    if (user.role === 'site_admin' || user.role === 'system_admin') return true;
    if (user.roles && Array.isArray(user.roles)) {
      const hasSiteAdminRole = user.roles.some(r =>
        r.code === 'site_admin' || r.code === 'system_admin'
      );
      if (hasSiteAdminRole) return true;
    }
    if (user.email === 'admin@genixerp.com') return true;

    return false;
  }, [authUser]);

  // Check if current user is an owner (company owner with subscription control)
  const isOwner = useCallback(() => {
    const user = authUser || (() => {
      try {
        const stored = localStorage.getItem('genixerp_user') || localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    })();
    if (!user) return false;

    if (user.is_system_admin || user.role === 'site_admin') return true;
    if (user.role === 'owner' || user.role === 'company_owner') return true;
    if (user.roles && Array.isArray(user.roles)) {
      const hasOwnerRole = user.roles.some(r =>
        r.code === 'owner' || r.code === 'company_owner'
      );
      if (hasOwnerRole) return true;
    }
    if (user.email === 'owner@genixerp.com') return true;

    return false;
  }, [authUser]);

  // Load subscription from storage
  const loadSubscription = useCallback(() => {
    try {
      // System admins always get Enterprise plan (unlimited access)
      if (isSystemAdmin()) {
        const adminSub = {
          plan: 'enterprise',
          status: 'active',
          startDate: new Date().toISOString(),
          trialEndsAt: null,
          currentUsers: 1,
          companyCount: 1,
          isAdmin: true // Flag to identify admin subscription
        };
        localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(adminSub));
        setSubscription(adminSub);
      } else {
        const stored = localStorage.getItem(SUBSCRIPTION_KEY);
        if (stored) {
          const parsedSub = JSON.parse(stored);
          // If stored subscription was admin but user is no longer admin, reset to free trial
          if (parsedSub.isAdmin) {
            const defaultSub = {
              plan: 'free_trial',
              status: 'trial',
              startDate: new Date().toISOString(),
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              currentUsers: 1,
              companyCount: 1
            };
            localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(defaultSub));
            setSubscription(defaultSub);
          } else {
            setSubscription(parsedSub);
          }
        } else {
          // Default to free trial
          const defaultSub = {
            plan: 'free_trial',
            status: 'trial',
            startDate: new Date().toISOString(),
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
            currentUsers: 1,
            companyCount: 1
          };
          localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(defaultSub));
          setSubscription(defaultSub);
        }
      }

      // Load AI usage
      const usageStored = localStorage.getItem(AI_USAGE_KEY);
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      if (usageStored) {
        const usage = JSON.parse(usageStored);
        // Reset if new month
        if (usage.month !== currentMonth) {
          const newUsage = { count: 0, month: currentMonth };
          localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newUsage));
          setAiUsage(newUsage);
        } else {
          setAiUsage(usage);
        }
      } else {
        const newUsage = { count: 0, month: currentMonth };
        localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newUsage));
        setAiUsage(newUsage);
      }

      // Load company users
      const usersStored = localStorage.getItem(COMPANY_USERS_KEY);
      if (usersStored) {
        setCompanyUsers(JSON.parse(usersStored));
      } else {
        // Create default admin user
        const currentUser = localStorage.getItem('genixerp_user');
        const defaultUsers = currentUser ? [JSON.parse(currentUser)] : [{
          id: 'user_1',
          email: 'admin@genixerp.com',
          full_name: 'Administrator',
          role: 'admin',
          status: 'active',
          created_date: new Date().toISOString()
        }];
        localStorage.setItem(COMPANY_USERS_KEY, JSON.stringify(defaultUsers));
        setCompanyUsers(defaultUsers);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Get current plan limits
  const getPlanLimits = useCallback(() => {
    const planKey = subscription?.plan || 'free_trial';
    return PLAN_LIMITS[planKey] || PLAN_LIMITS.free_trial;
  }, [subscription]);

  // Check if a feature is available
  const hasFeature = useCallback((featureKey) => {
    const limits = getPlanLimits();
    return limits.features[featureKey] === true;
  }, [getPlanLimits]);

  // Check if user can add more users
  const canAddUser = useCallback(() => {
    const limits = getPlanLimits();
    if (limits.maxUsers === -1) return true; // unlimited
    return (subscription?.currentUsers || 1) < limits.maxUsers;
  }, [subscription, getPlanLimits]);

  // Check if user can add more companies
  const canAddCompany = useCallback(() => {
    const limits = getPlanLimits();
    if (!limits.maxCompanies || limits.maxCompanies === -1) return true;
    return (subscription?.companyCount || 1) < limits.maxCompanies;
  }, [subscription, getPlanLimits]);

  // Check AI request limit
  const canMakeAIRequest = useCallback(() => {
    const limits = getPlanLimits();
    if (limits.aiRequestsPerMonth === -1) return true; // unlimited
    return aiUsage.count < limits.aiRequestsPerMonth;
  }, [aiUsage, getPlanLimits]);

  // Get remaining AI requests
  const getRemainingAIRequests = useCallback(() => {
    const limits = getPlanLimits();
    if (limits.aiRequestsPerMonth === -1) return -1; // unlimited
    return Math.max(0, limits.aiRequestsPerMonth - aiUsage.count);
  }, [aiUsage, getPlanLimits]);

  // Increment AI usage
  const incrementAIUsage = useCallback(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    let newUsage;

    if (aiUsage.month !== currentMonth) {
      // New month, reset counter
      newUsage = { count: 1, month: currentMonth };
    } else {
      newUsage = { ...aiUsage, count: aiUsage.count + 1 };
    }

    localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newUsage));
    setAiUsage(newUsage);
    return newUsage.count;
  }, [aiUsage]);

  // Update subscription
  const updateSubscription = useCallback((updates) => {
    const updated = { ...subscription, ...updates };
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(updated));
    setSubscription(updated);
  }, [subscription]);

  // Upgrade plan
  const upgradePlan = useCallback((newPlan) => {
    const updated = {
      ...subscription,
      plan: newPlan,
      status: 'active',
      upgradedAt: new Date().toISOString(),
      trialEndsAt: null
    };
    localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(updated));
    setSubscription(updated);
  }, [subscription]);

  // Check if trial is expired
  const isTrialExpired = useCallback(() => {
    if (subscription?.status !== 'trial') return false;
    if (!subscription?.trialEndsAt) return false;
    return new Date(subscription.trialEndsAt) < new Date();
  }, [subscription]);

  // Get days remaining in trial
  const getTrialDaysRemaining = useCallback(() => {
    if (subscription?.status !== 'trial' || !subscription?.trialEndsAt) return 0;
    const remaining = Math.ceil((new Date(subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  }, [subscription]);

  // Get usage percentage for AI requests
  const getAIUsagePercentage = useCallback(() => {
    const limits = getPlanLimits();
    if (limits.aiRequestsPerMonth === -1) return 0;
    return Math.min(100, (aiUsage.count / limits.aiRequestsPerMonth) * 100);
  }, [aiUsage, getPlanLimits]);

  // Get upgrade recommendation
  const getUpgradeRecommendation = useCallback(() => {
    const currentPlan = subscription?.plan || 'free_trial';
    const limits = getPlanLimits();

    const recommendations = [];

    // Check AI usage
    if (limits.aiRequestsPerMonth !== -1) {
      const usagePercent = (aiUsage.count / limits.aiRequestsPerMonth) * 100;
      if (usagePercent >= 80) {
        recommendations.push({
          type: 'ai_limit',
          message: `AI so'rovlar limitiga yaqinlashyapsiz (${aiUsage.count}/${limits.aiRequestsPerMonth})`,
          suggestedPlan: currentPlan === 'starter' ? 'professional' : 'enterprise'
        });
      }
    }

    // Check user count
    if (limits.maxUsers !== -1) {
      const userPercent = ((subscription?.currentUsers || 1) / limits.maxUsers) * 100;
      if (userPercent >= 80) {
        recommendations.push({
          type: 'user_limit',
          message: `Foydalanuvchi limitiga yaqinlashyapsiz`,
          suggestedPlan: currentPlan === 'starter' ? 'professional' : 'enterprise'
        });
      }
    }

    return recommendations;
  }, [subscription, aiUsage, getPlanLimits]);

  // ============ USER MANAGEMENT ============

  // Add a new user
  const addUser = useCallback((userData) => {
    const limits = getPlanLimits();

    // Check user limit
    if (limits.maxUsers !== -1 && companyUsers.length >= limits.maxUsers) {
      return { success: false, error: 'user_limit_reached', message: `Foydalanuvchi limiti (${limits.maxUsers}) ga yetildi` };
    }

    const newUser = {
      id: `user_${Date.now()}`,
      ...userData,
      status: 'active',
      created_date: new Date().toISOString()
    };

    const updated = [...companyUsers, newUser];
    localStorage.setItem(COMPANY_USERS_KEY, JSON.stringify(updated));
    setCompanyUsers(updated);

    // Update subscription user count
    updateSubscription({ currentUsers: updated.length });

    return { success: true, user: newUser };
  }, [companyUsers, getPlanLimits, updateSubscription]);

  // Update a user
  const updateUser = useCallback((userId, updates) => {
    const updated = companyUsers.map(u =>
      u.id === userId ? { ...u, ...updates, updated_date: new Date().toISOString() } : u
    );
    localStorage.setItem(COMPANY_USERS_KEY, JSON.stringify(updated));
    setCompanyUsers(updated);
    return { success: true };
  }, [companyUsers]);

  // Delete a user
  const deleteUser = useCallback((userId) => {
    const updated = companyUsers.filter(u => u.id !== userId);
    localStorage.setItem(COMPANY_USERS_KEY, JSON.stringify(updated));
    setCompanyUsers(updated);

    // Update subscription user count
    updateSubscription({ currentUsers: updated.length });

    return { success: true };
  }, [companyUsers, updateSubscription]);

  // Get user by ID
  const getUser = useCallback((userId) => {
    return companyUsers.find(u => u.id === userId);
  }, [companyUsers]);

  // Toggle user status (active/blocked)
  const toggleUserStatus = useCallback((userId) => {
    const user = companyUsers.find(u => u.id === userId);
    if (!user) return { success: false, error: 'user_not_found' };

    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    return updateUser(userId, { status: newStatus });
  }, [companyUsers, updateUser]);

  // Change user role
  const changeUserRole = useCallback((userId, newRole) => {
    return updateUser(userId, { role: newRole });
  }, [updateUser]);

  const isSystemAdminVal = isSystemAdmin();
  const isOwnerVal = isOwner();

  // Activate subscription after payment and re-fetch status
  const activateSubscription = useCallback(async (plan = 'starter') => {
    try {
      await subscriptionService.activate(plan);
      await fetchTrialStatus();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.response?.data?.message || 'Activation failed' };
    }
  }, [fetchTrialStatus]);

  // Derived helpers backed by real backend data (with localStorage fallback)
  const isTrialExpiredReal = useCallback(() => {
    if (trialStatus) {
      return trialStatus.status === 'past_due' || trialStatus.status === 'expired';
    }
    // fallback to localStorage-based check
    if (subscription?.status !== 'trial') return false;
    if (!subscription?.trialEndsAt) return false;
    return new Date(subscription.trialEndsAt) < new Date();
  }, [trialStatus, subscription]);

  const getTrialDaysRemainingReal = useCallback(() => {
    if (trialStatus?.trial_days_remaining !== undefined) {
      return trialStatus.trial_days_remaining;
    }
    // fallback
    if (subscription?.status !== 'trial' || !subscription?.trialEndsAt) return 0;
    const remaining = Math.ceil((new Date(subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  }, [trialStatus, subscription]);

  const value = useMemo(() => ({
    subscription,
    aiUsage,
    companyUsers,
    isLoading,
    planLimits: PLAN_LIMITS,
    featureDescriptions: FEATURE_DESCRIPTIONS,
    isSystemAdmin: isSystemAdminVal,
    isOwner: isOwnerVal,
    // Real backend trial status
    trialStatus,
    // Methods
    getPlanLimits,
    hasFeature,
    canAddUser,
    canAddCompany,
    canMakeAIRequest,
    getRemainingAIRequests,
    incrementAIUsage,
    updateSubscription,
    upgradePlan,
    activateSubscription,
    isTrialExpired: isTrialExpiredReal,
    getTrialDaysRemaining: getTrialDaysRemainingReal,
    getAIUsagePercentage,
    getUpgradeRecommendation,
    refreshSubscription: loadSubscription,
    refreshTrialStatus: fetchTrialStatus,
    // User Management
    addUser,
    updateUser,
    deleteUser,
    getUser,
    toggleUserStatus,
    changeUserRole
  }), [subscription, aiUsage, companyUsers, isLoading, isSystemAdminVal, isOwnerVal, trialStatus, getPlanLimits, hasFeature, canAddUser, canAddCompany, canMakeAIRequest, getRemainingAIRequests, incrementAIUsage, updateSubscription, upgradePlan, activateSubscription, isTrialExpiredReal, getTrialDaysRemainingReal, getAIUsagePercentage, getUpgradeRecommendation, loadSubscription, fetchTrialStatus, addUser, updateUser, deleteUser, getUser, toggleUserStatus, changeUserRole]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

export { PLAN_LIMITS, FEATURE_DESCRIPTIONS };
