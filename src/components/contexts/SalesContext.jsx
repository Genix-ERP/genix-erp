import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { salesService } from '@/api/services/sales';
import { useAdminSettings } from './AdminSettingsContext';
import { useCompany } from './CompanyContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const SalesContext = createContext(null);

export function SalesProvider({ children }) {
  const { getSetting } = useAdminSettings();
  const { activeCompany } = useCompany();
  const { formatCurrency } = useCurrencyFormatter();
  const [quotations, setQuotations] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin settings for sales module - these affect module behavior
  const salesSettings = useMemo(() => ({
    // Quotation settings
    quotationValidityDays: getSetting('sales.quotation.validity_days', 30),
    autoConfirmQuotation: getSetting('sales.quotation.auto_confirm', false),
    requireApproval: getSetting('sales.quotation.require_approval', false),
    approvalThreshold: getSetting('sales.quotation.approval_threshold', 0),

    // Pricing settings
    pricingStrategy: getSetting('sales.pricing.strategy', 'standard'),
    allowDiscounts: getSetting('sales.pricing.allow_discounts', true),
    maxDiscountPercent: getSetting('sales.pricing.max_discount_percent', 20),
    discountApprovalThreshold: getSetting('sales.pricing.discount_approval_threshold', 10),

    // Payment settings
    defaultPaymentTerms: getSetting('sales.payment.default_terms', 'Net 30'),
    availablePaymentTerms: getSetting('sales.payment.available_terms', ['Immediate', 'Net 15', 'Net 30', 'Net 45', 'Net 60']),

    // Invoice settings
    autoGenerateInvoice: getSetting('sales.invoice.auto_generate', true),
    autoSendInvoice: getSetting('sales.invoice.auto_send', false),

    // Credit settings
    enableCreditLimit: getSetting('sales.credit.enable_credit_limit', false),
    defaultCreditLimit: getSetting('sales.credit.default_credit_limit', 0)
  }), [getSetting]);

  // Load data from backend when company is available
  useEffect(() => {
    if (activeCompany) {
      loadData();
    }
  }, [activeCompany]);

  const loadData = async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    setError(null);
    try {
      const [quotationsData, ordersData, invoicesData, returnsData, discountsData] = await Promise.all([
        salesService.listQuotations(),
        salesService.listOrders(),
        salesService.listInvoices(),
        salesService.listReturns(),
        salesService.listDiscounts(),
      ]);
      setQuotations(quotationsData || []);
      setSalesOrders(ordersData || []);
      setInvoices(invoicesData || []);
      setReturns(returnsData || []);
      setDiscounts(discountsData || []);
    } catch (err) {
      console.error('Error loading sales data:', err);
      setError(err.message);
      setQuotations([]);
      setSalesOrders([]);
      setInvoices([]);
      setReturns([]);
      setDiscounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quotation CRUD - now using backend API
  const createQuotation = useCallback(async (data) => {
    const newQuotation = await salesService.createQuotation(data);
    setQuotations(prev => [...prev, newQuotation]);
    return newQuotation;
  }, []);

  const updateQuotation = useCallback(async (id, updates) => {
    const updated = await salesService.updateQuotation(id, updates);
    setQuotations(prev => prev.map(q => q.id === id ? updated : q));
    return updated;
  }, []);

  const deleteQuotation = useCallback(async (id) => {
    await salesService.deleteQuotation(id);
    setQuotations(prev => prev.filter(q => q.id !== id));
  }, []);

  const convertQuotationToOrder = useCallback(async (quotationId) => {
    const result = await salesService.convertQuotationToOrder(quotationId);
    // Update quotation in state with new status
    setQuotations(prev => prev.map(q => q.id === quotationId ? result : q));
    // Refresh sales orders to include the new order
    const ordersData = await salesService.listOrders();
    setSalesOrders(ordersData || []);
    return result;
  }, []);

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

  const createInvoiceFromOrder = useCallback(async (orderId) => {
    const newInvoice = await salesService.createInvoiceFromOrder(orderId);
    setInvoices(prev => [newInvoice, ...prev]);
    return newInvoice;
  }, []);

  // Get single sales order with lines
  const getOrder = useCallback(async (id) => {
    const order = await salesService.getOrder(id);
    return order;
  }, []);

  // Invoice CRUD
  const getInvoice = useCallback(async (id) => {
    const invoice = await salesService.getInvoice(id);
    return invoice;
  }, []);

  const createInvoice = useCallback(async (data, customerName) => {
    const newInvoice = await salesService.createInvoice(data);
    // Backend may not return customer_name, so merge it from the input
    const invoiceWithCustomer = {
      ...newInvoice,
      customer_name: newInvoice.customer_name || customerName || '',
    };
    setInvoices(prev => [...prev, invoiceWithCustomer]);
    return invoiceWithCustomer;
  }, []);

  const updateInvoice = useCallback(async (id, updates) => {
    const updated = await salesService.updateInvoice(id, updates);
    // Merge updated data with existing invoice to preserve all fields
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updated } : inv));
    return updated;
  }, []);

  const deleteInvoice = useCallback(async (id) => {
    await salesService.deleteInvoice(id);
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  }, []);

  const recordPayment = useCallback(async (invoiceId, amount, method, date, writeOffAmount = 0) => {
    const payload = { amount: parseFloat(amount) || 0, payment_method: method || 'bank_transfer', payment_date: date };
    if (writeOffAmount > 0) payload.write_off_amount = parseFloat(writeOffAmount) || 0;
    const result = await salesService.recordPayment(invoiceId, payload);
    // Merge result with existing invoice to preserve fields like customer_name
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, ...result } : inv));
    return result;
  }, []);

  // Return CRUD - using backend API
  const createReturn = useCallback(async (data) => {
    const newReturn = await salesService.createReturn(data);
    setReturns(prev => [...prev, newReturn]);
    return newReturn;
  }, []);

  const updateReturn = useCallback(async (id, updates) => {
    const updated = await salesService.updateReturn(id, updates);
    setReturns(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  }, []);

  const deleteReturn = useCallback(async (id) => {
    await salesService.deleteReturn(id);
    setReturns(prev => prev.filter(r => r.id !== id));
  }, []);

  const approveReturn = useCallback(async (returnId) => {
    const approved = await salesService.approveReturn(returnId);
    setReturns(prev => prev.map(r => r.id === returnId ? approved : r));
    return approved;
  }, []);

  const rejectReturn = useCallback(async (returnId) => {
    const rejected = await salesService.rejectReturn(returnId);
    setReturns(prev => prev.map(r => r.id === returnId ? rejected : r));
    return rejected;
  }, []);

  const processRefund = useCallback(async (returnId, data) => {
    const processed = await salesService.processRefund(returnId, data);
    setReturns(prev => prev.map(r => r.id === returnId ? processed : r));
    return processed;
  }, []);

  // Discount CRUD - using backend API
  const createDiscount = useCallback(async (data) => {
    const newDiscount = await salesService.createDiscount(data);
    setDiscounts(prev => [...prev, newDiscount]);
    return newDiscount;
  }, []);

  const updateDiscount = useCallback(async (id, updates) => {
    const updated = await salesService.updateDiscount(id, updates);
    setDiscounts(prev => prev.map(d => d.id === id ? updated : d));
    return updated;
  }, []);

  const deleteDiscount = useCallback(async (id) => {
    await salesService.deleteDiscount(id);
    setDiscounts(prev => prev.filter(d => d.id !== id));
  }, []);

  const validateDiscountCode = useCallback(async (code, orderAmount, customerId, isNewCustomer = false) => {
    try {
      const result = await salesService.validateDiscountCode({
        code,
        order_amount: orderAmount,
        customer_id: customerId,
        is_new_customer: isNewCustomer,
      });
      return result;
    } catch (err) {
      return { valid: false, message: err.response?.data?.message || 'Invalid discount code' };
    }
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

    if (discount.new_customers_only && !isNewCustomer) {
      return { valid: false, messageKey: 'new_customers_only' };
    }

    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      discountAmount = (orderAmount * discount.discount_value) / 100;
    } else {
      discountAmount = discount.discount_value;
    }

    if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
      discountAmount = discount.max_discount_amount;
    }

    return {
      valid: true,
      discount,
      discountAmount,
      message: `${discount.name}: -${formatCurrency(discountAmount)}`,
    };
  }, [discounts, formatCurrency]);

  const useDiscountCode = useCallback(async (discountId, customerId, salesOrderId, amountDiscounted) => {
    try {
      await salesService.useDiscountCode(discountId, {
        customer_id: customerId,
        sales_order_id: salesOrderId,
        amount_discounted: amountDiscounted,
      });
      // Update local state
      setDiscounts(prev => prev.map(d =>
        d.id === discountId ? { ...d, used_count: (d.used_count || 0) + 1 } : d
      ));
    } catch (err) {
      console.error('Failed to record discount usage:', err);
    }
  }, []);

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
  }, [activeCompany]);

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
    getOrder,
    createSalesOrder,
    updateSalesOrder,
    deleteSalesOrder,
    confirmSalesOrder,
    cancelSalesOrder,
    createInvoiceFromOrder,

    // Invoice operations
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,

    // Return operations
    createReturn,
    updateReturn,
    deleteReturn,
    approveReturn,
    rejectReturn,
    processRefund,

    // Discount operations
    createDiscount,
    updateDiscount,
    deleteDiscount,
    applyDiscount,
    validateDiscountCode,
    useDiscountCode,

    // Analytics
    getSalesAnalytics,
    getAIInsights,

    // Refresh
    refreshData,

    // Admin Settings (from Admin Settings page)
    settings: salesSettings,
    // Helper functions for settings
    getQuotationValidityDays: () => salesSettings.quotationValidityDays,
    getDefaultPaymentTerms: () => salesSettings.defaultPaymentTerms,
    getMaxDiscountPercent: () => salesSettings.maxDiscountPercent,
    isDiscountsAllowed: () => salesSettings.allowDiscounts,
    needsDiscountApproval: (discountPercent) => discountPercent > salesSettings.discountApprovalThreshold,
    needsApproval: (amount) => salesSettings.requireApproval && amount >= salesSettings.approvalThreshold,
    isCreditLimitEnabled: () => salesSettings.enableCreditLimit
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
