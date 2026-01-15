import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { isDemoMode } from '@/config/dataMode';

const SalesContext = createContext(null);

// Helper to get storage key with demo prefix
const getStorageKey = (key) => {
  const prefix = isDemoMode() ? 'demo_' : '';
  return `${prefix}${key}`;
};

// Storage keys
const STORAGE_KEYS = {
  QUOTATIONS: 'genix_quotations',
  SALES_ORDERS: 'genix_sales_orders_v2',
  INVOICES: 'genix_invoices',
  RETURNS: 'genix_returns',
  DISCOUNTS: 'genix_discounts',
};

// Sample quotations
const sampleQuotations = [
  {
    id: '1',
    quotation_number: 'QT-2024-001',
    customer_id: '1',
    customer_name: 'TechCorp Industries',
    contact_person: 'John Smith',
    email: 'john@techcorp.com',
    valid_until: '2024-02-28',
    status: 'sent',
    items: [
      { product_id: '1', product_name: 'Laptop Dell', quantity: 5, unit_price: 15000000, total: 75000000 },
      { product_id: '2', product_name: 'Monitor LG', quantity: 5, unit_price: 3000000, total: 15000000 },
    ],
    subtotal: 90000000,
    discount_percent: 5,
    discount_amount: 4500000,
    tax_percent: 12,
    tax_amount: 10260000,
    total_amount: 95760000,
    notes: 'Yetkazib berish 3 kun ichida',
    created_at: '2024-02-01',
    created_by: 'Admin',
  },
  {
    id: '2',
    quotation_number: 'QT-2024-002',
    customer_id: '2',
    customer_name: 'Global Trading LLC',
    contact_person: 'Maria Garcia',
    email: 'maria@globaltrading.com',
    valid_until: '2024-02-15',
    status: 'accepted',
    items: [
      { product_id: '3', product_name: 'Office Chair', quantity: 20, unit_price: 2500000, total: 50000000 },
    ],
    subtotal: 50000000,
    discount_percent: 10,
    discount_amount: 5000000,
    tax_percent: 12,
    tax_amount: 5400000,
    total_amount: 50400000,
    notes: '',
    created_at: '2024-02-05',
    created_by: 'Admin',
    converted_to_order: 'SO-2024-001',
  },
];

// Sample invoices
const sampleInvoices = [
  {
    id: '1',
    invoice_number: 'INV-2024-001',
    sales_order_id: '1',
    customer_id: '2',
    customer_name: 'Global Trading LLC',
    invoice_date: '2024-02-10',
    due_date: '2024-03-10',
    status: 'paid',
    payment_status: 'paid',
    items: [
      { product_id: '3', product_name: 'Office Chair', quantity: 20, unit_price: 2500000, total: 50000000 },
    ],
    subtotal: 50000000,
    discount_amount: 5000000,
    tax_amount: 5400000,
    total_amount: 50400000,
    paid_amount: 50400000,
    balance: 0,
    payment_method: 'bank_transfer',
    payment_date: '2024-02-15',
    notes: '',
    created_at: '2024-02-10',
  },
  {
    id: '2',
    invoice_number: 'INV-2024-002',
    sales_order_id: '2',
    customer_id: '1',
    customer_name: 'TechCorp Industries',
    invoice_date: '2024-02-15',
    due_date: '2024-03-15',
    status: 'sent',
    payment_status: 'partial',
    items: [
      { product_id: '1', product_name: 'Laptop Dell', quantity: 3, unit_price: 15000000, total: 45000000 },
    ],
    subtotal: 45000000,
    discount_amount: 0,
    tax_amount: 5400000,
    total_amount: 50400000,
    paid_amount: 25000000,
    balance: 25400000,
    payment_method: 'cash',
    payment_date: '2024-02-20',
    notes: 'Qolgan summa keyingi oyda',
    created_at: '2024-02-15',
  },
];

// Sample returns
const sampleReturns = [
  {
    id: '1',
    return_number: 'RET-2024-001',
    sales_order_id: '1',
    invoice_id: '1',
    customer_id: '2',
    customer_name: 'Global Trading LLC',
    return_date: '2024-02-20',
    status: 'approved',
    reason: 'defective',
    items: [
      { product_id: '3', product_name: 'Office Chair', quantity: 2, unit_price: 2500000, total: 5000000, condition: 'damaged' },
    ],
    total_amount: 5000000,
    refund_method: 'credit_note',
    refund_status: 'processed',
    notes: 'Shikastlangan mahsulotlar qaytarildi',
    created_at: '2024-02-20',
  },
];

// Sample discounts/promotions
const sampleDiscounts = [
  {
    id: '1',
    code: 'SALE10',
    name: '10% chegirma',
    type: 'percentage',
    value: 10,
    min_order_amount: 10000000,
    max_discount: 5000000,
    valid_from: '2024-02-01',
    valid_until: '2024-02-28',
    usage_limit: 100,
    used_count: 23,
    status: 'active',
    applies_to: 'all',
    created_at: '2024-02-01',
  },
  {
    id: '2',
    code: 'NEWCUSTOMER',
    name: 'Yangi mijoz chegirmasi',
    type: 'fixed',
    value: 1000000,
    min_order_amount: 5000000,
    max_discount: 1000000,
    valid_from: '2024-01-01',
    valid_until: '2024-12-31',
    usage_limit: null,
    used_count: 45,
    status: 'active',
    applies_to: 'new_customers',
    created_at: '2024-01-01',
  },
];

export function SalesProvider({ children }) {
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const demoMode = isDemoMode();

        const getData = (key, sampleData) => {
          const storageKey = getStorageKey(key);
          const stored = localStorage.getItem(storageKey);
          if (stored) return JSON.parse(stored);
          return demoMode ? sampleData : [];
        };

        setQuotations(getData(STORAGE_KEYS.QUOTATIONS, sampleQuotations));
        setInvoices(getData(STORAGE_KEYS.INVOICES, sampleInvoices));
        setReturns(getData(STORAGE_KEYS.RETURNS, sampleReturns));
        setDiscounts(getData(STORAGE_KEYS.DISCOUNTS, sampleDiscounts));

        // Initialize localStorage with sample data only in demo mode
        if (demoMode) {
          const initIfEmpty = (key, sampleData) => {
            const storageKey = getStorageKey(key);
            if (!localStorage.getItem(storageKey)) {
              localStorage.setItem(storageKey, JSON.stringify(sampleData));
            }
          };
          initIfEmpty(STORAGE_KEYS.QUOTATIONS, sampleQuotations);
          initIfEmpty(STORAGE_KEYS.INVOICES, sampleInvoices);
          initIfEmpty(STORAGE_KEYS.RETURNS, sampleReturns);
          initIfEmpty(STORAGE_KEYS.DISCOUNTS, sampleDiscounts);
        }
      } catch (error) {
        console.error('Error loading sales data:', error);
        const demoMode = isDemoMode();
        setQuotations(demoMode ? sampleQuotations : []);
        setInvoices(demoMode ? sampleInvoices : []);
        setReturns(demoMode ? sampleReturns : []);
        setDiscounts(demoMode ? sampleDiscounts : []);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.QUOTATIONS), JSON.stringify(quotations));
    }
  }, [quotations, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.INVOICES), JSON.stringify(invoices));
    }
  }, [invoices, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.RETURNS), JSON.stringify(returns));
    }
  }, [returns, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getStorageKey(STORAGE_KEYS.DISCOUNTS), JSON.stringify(discounts));
    }
  }, [discounts, isLoading]);

  // Quotation CRUD
  const createQuotation = useCallback(async (data) => {
    const newQuotation = {
      ...data,
      id: Date.now().toString(),
      quotation_number: `QT-${new Date().getFullYear()}-${String(quotations.length + 1).padStart(3, '0')}`,
      status: 'draft',
      created_at: new Date().toISOString().split('T')[0],
    };
    setQuotations(prev => [...prev, newQuotation]);
    return newQuotation;
  }, [quotations.length]);

  const updateQuotation = useCallback(async (id, updates) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  }, []);

  const deleteQuotation = useCallback(async (id) => {
    setQuotations(prev => prev.filter(q => q.id !== id));
  }, []);

  const convertQuotationToOrder = useCallback(async (quotationId) => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) return null;

    // Create sales order from quotation
    const orderNumber = `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

    // Update quotation status
    updateQuotation(quotationId, {
      status: 'accepted',
      converted_to_order: orderNumber,
    });

    return { order_number: orderNumber, ...quotation };
  }, [quotations, updateQuotation]);

  // Invoice CRUD
  const createInvoice = useCallback(async (data) => {
    const newInvoice = {
      ...data,
      id: Date.now().toString(),
      invoice_number: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
      status: 'draft',
      payment_status: 'unpaid',
      paid_amount: 0,
      balance: data.total_amount,
      created_at: new Date().toISOString().split('T')[0],
    };
    setInvoices(prev => [...prev, newInvoice]);
    return newInvoice;
  }, [invoices.length]);

  const updateInvoice = useCallback(async (id, updates) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        const updated = { ...inv, ...updates };
        // Calculate payment status
        if (updates.paid_amount !== undefined) {
          updated.balance = updated.total_amount - updated.paid_amount;
          if (updated.paid_amount >= updated.total_amount) {
            updated.payment_status = 'paid';
          } else if (updated.paid_amount > 0) {
            updated.payment_status = 'partial';
          } else {
            updated.payment_status = 'unpaid';
          }
        }
        return updated;
      }
      return inv;
    }));
  }, []);

  const deleteInvoice = useCallback(async (id) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  }, []);

  const recordPayment = useCallback(async (invoiceId, amount, method, date) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const newPaidAmount = (invoice.paid_amount || 0) + amount;
    updateInvoice(invoiceId, {
      paid_amount: newPaidAmount,
      payment_method: method,
      payment_date: date || new Date().toISOString().split('T')[0],
    });
  }, [invoices, updateInvoice]);

  // Return CRUD
  const createReturn = useCallback(async (data) => {
    const newReturn = {
      ...data,
      id: Date.now().toString(),
      return_number: `RET-${new Date().getFullYear()}-${String(returns.length + 1).padStart(3, '0')}`,
      status: 'pending',
      refund_status: 'pending',
      created_at: new Date().toISOString().split('T')[0],
    };
    setReturns(prev => [...prev, newReturn]);
    return newReturn;
  }, [returns.length]);

  const updateReturn = useCallback(async (id, updates) => {
    setReturns(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const approveReturn = useCallback(async (returnId) => {
    updateReturn(returnId, { status: 'approved' });
  }, [updateReturn]);

  const processRefund = useCallback(async (returnId, method) => {
    updateReturn(returnId, {
      refund_status: 'processed',
      refund_method: method,
      refund_date: new Date().toISOString().split('T')[0],
    });
  }, [updateReturn]);

  // Discount CRUD
  const createDiscount = useCallback(async (data) => {
    const newDiscount = {
      ...data,
      id: Date.now().toString(),
      used_count: 0,
      status: 'active',
      created_at: new Date().toISOString().split('T')[0],
    };
    setDiscounts(prev => [...prev, newDiscount]);
    return newDiscount;
  }, []);

  const updateDiscount = useCallback(async (id, updates) => {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDiscount = useCallback(async (id) => {
    setDiscounts(prev => prev.filter(d => d.id !== id));
  }, []);

  const applyDiscount = useCallback((code, orderAmount, isNewCustomer = false) => {
    const discount = discounts.find(d =>
      d.code === code &&
      d.status === 'active' &&
      new Date(d.valid_from) <= new Date() &&
      new Date(d.valid_until) >= new Date()
    );

    if (!discount) return { valid: false, messageKey: 'code_not_found' };

    if (discount.min_order_amount && orderAmount < discount.min_order_amount) {
      return { valid: false, messageKey: 'min_order_amount', minAmount: discount.min_order_amount };
    }

    if (discount.usage_limit && discount.used_count >= discount.usage_limit) {
      return { valid: false, messageKey: 'discount_limit_reached' };
    }

    if (discount.applies_to === 'new_customers' && !isNewCustomer) {
      return { valid: false, messageKey: 'new_customers_only' };
    }

    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (orderAmount * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }

    if (discount.max_discount && discountAmount > discount.max_discount) {
      discountAmount = discount.max_discount;
    }

    return {
      valid: true,
      discount,
      discountAmount,
      message: `${discount.name}: -${discountAmount.toLocaleString()}`,
    };
  }, [discounts]);

  const useDiscountCode = useCallback(async (code) => {
    const discount = discounts.find(d => d.code === code);
    if (discount) {
      updateDiscount(discount.id, { used_count: (discount.used_count || 0) + 1 });
    }
  }, [discounts, updateDiscount]);

  // AI Analytics
  const getSalesAnalytics = useCallback(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Revenue calculations
    const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const thisMonthInvoices = paidInvoices.filter(inv => {
      const invDate = new Date(inv.payment_date || inv.invoice_date);
      return invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear;
    });
    const thisMonthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    // Outstanding amounts
    const outstandingInvoices = invoices.filter(inv => inv.payment_status !== 'paid');
    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

    // Overdue invoices
    const overdueInvoices = outstandingInvoices.filter(inv => new Date(inv.due_date) < now);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

    // Quotation conversion rate
    const totalQuotations = quotations.length;
    const acceptedQuotations = quotations.filter(q => q.status === 'accepted').length;
    const conversionRate = totalQuotations > 0 ? (acceptedQuotations / totalQuotations) * 100 : 0;

    // Return rate
    const totalReturns = returns.length;
    const totalOrders = invoices.length;
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    // Average order value
    const avgOrderValue = invoices.length > 0
      ? invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) / invoices.length
      : 0;

    return {
      totalRevenue,
      thisMonthRevenue,
      totalOutstanding,
      overdueAmount,
      overdueInvoices: overdueInvoices.length,
      conversionRate,
      returnRate,
      avgOrderValue,
      totalQuotations,
      acceptedQuotations,
      totalReturns,
      activeDiscounts: discounts.filter(d => d.status === 'active').length,
    };
  }, [invoices, quotations, returns, discounts]);

  // AI Insights
  const getAIInsights = useMemo(() => {
    const analytics = getSalesAnalytics();
    const insights = [];
    const recommendations = [];

    // Revenue insights
    if (analytics.thisMonthRevenue > 0) {
      insights.push({
        type: 'positive',
        titleKey: 'monthly_revenue',
        descriptionKey: 'current_month_revenue',
        metric: analytics.thisMonthRevenue,
        priority: 'high',
      });
    }

    // Outstanding payments warning
    if (analytics.totalOutstanding > 0) {
      insights.push({
        type: analytics.overdueInvoices > 0 ? 'warning' : 'info',
        titleKey: 'outstanding_invoices',
        descriptionKey: 'overdue_invoices_count',
        overdueCount: analytics.overdueInvoices,
        metric: analytics.totalOutstanding,
        priority: analytics.overdueInvoices > 0 ? 'high' : 'medium',
      });
    }

    // Conversion rate insights
    if (analytics.conversionRate < 50 && analytics.totalQuotations > 5) {
      insights.push({
        type: 'warning',
        titleKey: 'low_conversion',
        descriptionKey: 'conversion_low_desc',
        metric: `${analytics.conversionRate.toFixed(1)}%`,
        priority: 'medium',
      });
      recommendations.push({
        actionKey: 'review_quotations',
        descriptionKey: 'analyze_rejected',
        impact: 'high',
      });
    }

    // Return rate warning
    if (analytics.returnRate > 5) {
      insights.push({
        type: 'negative',
        titleKey: 'high_returns',
        descriptionKey: 'return_rate_high',
        metric: `${analytics.returnRate.toFixed(1)}%`,
        priority: 'high',
      });
      recommendations.push({
        actionKey: 'check_quality',
        descriptionKey: 'analyze_return_reasons',
        impact: 'high',
      });
    }

    // Recommendations
    if (analytics.overdueAmount > 0) {
      recommendations.push({
        actionKey: 'collect_payments',
        descriptionKey: 'amount_overdue',
        overdueAmount: analytics.overdueAmount,
        impact: 'high',
      });
    }

    if (analytics.activeDiscounts < 2) {
      recommendations.push({
        actionKey: 'run_discount_campaign',
        descriptionKey: 'few_active_discounts',
        impact: 'medium',
      });
    }

    return { insights, recommendations, metrics: analytics };
  }, [getSalesAnalytics]);

  const value = {
    // State
    quotations,
    invoices,
    returns,
    discounts,
    isLoading,

    // Quotation operations
    createQuotation,
    updateQuotation,
    deleteQuotation,
    convertQuotationToOrder,

    // Invoice operations
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,

    // Return operations
    createReturn,
    updateReturn,
    approveReturn,
    processRefund,

    // Discount operations
    createDiscount,
    updateDiscount,
    deleteDiscount,
    applyDiscount,
    useDiscountCode,

    // Analytics
    getSalesAnalytics,
    getAIInsights,
  };

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
}

export default SalesContext;
