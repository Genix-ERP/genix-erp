import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { salesService } from '@/api/services/sales';

const SalesContext = createContext(null);

export function SalesProvider({ children }) {
  const [quotations, setQuotations] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [discounts, setDiscounts] = useState([]);
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
      const [ordersData, invoicesData] = await Promise.all([
        salesService.listOrders(),
        salesService.listInvoices(),
      ]);
      setSalesOrders(ordersData || []);
      setInvoices(invoicesData || []);
    } catch (err) {
      console.error('Error loading sales data:', err);
      setError(err.message);
      setSalesOrders([]);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quotation CRUD (quotations API to be implemented)
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

    const orderNumber = `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

    updateQuotation(quotationId, {
      status: 'accepted',
      converted_to_order: orderNumber,
    });

    return { order_number: orderNumber, ...quotation };
  }, [quotations, updateQuotation]);

  // Sales Order CRUD
  const createSalesOrder = useCallback(async (data) => {
    const newOrder = await salesService.createOrder(data);
    setSalesOrders(prev => [...prev, newOrder]);
    return newOrder;
  }, []);

  const updateSalesOrder = useCallback(async (id, updates) => {
    const updated = await salesService.updateOrder(id, updates);
    setSalesOrders(prev => prev.map(o => o.id === id ? updated : o));
    return updated;
  }, []);

  const deleteSalesOrder = useCallback(async (id) => {
    await salesService.deleteOrder(id);
    setSalesOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  const confirmSalesOrder = useCallback(async (id) => {
    const confirmed = await salesService.confirmOrder(id);
    setSalesOrders(prev => prev.map(o => o.id === id ? confirmed : o));
    return confirmed;
  }, []);

  const cancelSalesOrder = useCallback(async (id) => {
    const cancelled = await salesService.cancelOrder(id);
    setSalesOrders(prev => prev.map(o => o.id === id ? cancelled : o));
    return cancelled;
  }, []);

  // Invoice CRUD
  const createInvoice = useCallback(async (data) => {
    const newInvoice = await salesService.createInvoice(data);
    setInvoices(prev => [...prev, newInvoice]);
    return newInvoice;
  }, []);

  const updateInvoice = useCallback(async (id, updates) => {
    const updated = await salesService.updateInvoice(id, updates);
    setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
    return updated;
  }, []);

  const deleteInvoice = useCallback(async (id) => {
    await salesService.deleteInvoice(id);
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  }, []);

  const recordPayment = useCallback(async (invoiceId, amount, method, date) => {
    const result = await salesService.recordPayment(invoiceId, { amount, method, date });
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? result : inv));
    return result;
  }, []);

  // Return CRUD (returns API to be implemented)
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

  // Discount CRUD (discounts API to be implemented)
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

  // Analytics
  const getSalesAnalytics = useCallback(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const thisMonthInvoices = paidInvoices.filter(inv => {
      const invDate = new Date(inv.payment_date || inv.invoice_date);
      return invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear;
    });
    const thisMonthRevenue = thisMonthInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    const outstandingInvoices = invoices.filter(inv => inv.payment_status !== 'paid');
    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

    const overdueInvoices = outstandingInvoices.filter(inv => new Date(inv.due_date) < now);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

    const totalQuotations = quotations.length;
    const acceptedQuotations = quotations.filter(q => q.status === 'accepted').length;
    const conversionRate = totalQuotations > 0 ? (acceptedQuotations / totalQuotations) * 100 : 0;

    const totalReturns = returns.length;
    const totalOrders = invoices.length;
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

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

    if (analytics.thisMonthRevenue > 0) {
      insights.push({
        type: 'positive',
        titleKey: 'monthly_revenue',
        descriptionKey: 'current_month_revenue',
        metric: analytics.thisMonthRevenue,
        priority: 'high',
      });
    }

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

  // Refresh data from backend
  const refreshData = useCallback(async () => {
    await loadData();
  }, []);

  const value = {
    // State
    quotations,
    salesOrders,
    invoices,
    returns,
    discounts,
    isLoading,
    error,

    // Quotation operations
    createQuotation,
    updateQuotation,
    deleteQuotation,
    convertQuotationToOrder,

    // Sales Order operations
    createSalesOrder,
    updateSalesOrder,
    deleteSalesOrder,
    confirmSalesOrder,
    cancelSalesOrder,

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

    // Refresh
    refreshData,
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
