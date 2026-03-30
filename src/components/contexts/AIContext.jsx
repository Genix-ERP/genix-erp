import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { aiService } from '@/api/services/ai';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useCompany } from './CompanyContext';
import { useInventory } from './InventoryContext';
import { useCustomers } from './CustomersContext';
import { useFinancials } from './FinancialsContext';
import { useModules } from './ModulesContext';
import { useVendors } from './VendorsContext';
import { useLanguage } from './LanguageContext';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { createCurrencyFormatter } from '@/utils/formatCurrency';

const AIContext = createContext(null);

// Action types that AI can execute
const AI_ACTIONS = {
  // Company
  CREATE_COMPANY: 'create_company',
  // Inventory
  CREATE_INVENTORY_ITEM: 'create_inventory_item',
  UPDATE_INVENTORY_ITEM: 'update_inventory_item',
  ADJUST_STOCK: 'adjust_stock',
  // Customers
  CREATE_CUSTOMER: 'create_customer',
  UPDATE_CUSTOMER: 'update_customer',
  // Sales
  CREATE_SALES_ORDER: 'create_sales_order',
  // Purchases
  CREATE_PURCHASE_ORDER: 'create_purchase_order',
  // HR
  CREATE_EMPLOYEE: 'create_employee',
  // Finance
  CREATE_EXPENSE: 'create_expense',
  CREATE_INVOICE: 'create_invoice',
  // Projects
  CREATE_PROJECT: 'create_project',
  // Contracts
  CREATE_CONTRACT: 'create_contract',
  // Vendors
  CREATE_VENDOR: 'create_vendor'
};

// Parse user message to detect action intent
const parseActionIntent = (message) => {
  const lowerMessage = message.toLowerCase();

  // Company creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      lowerMessage.includes('company')) {
    const nameMatch = message.match(/(?:called|named|name[d]?)\s+["']?([^"'\n,]+)["']?/i) ||
                      message.match(/company\s+["']?([^"'\n,]+)["']?/i);
    return {
      action: AI_ACTIONS.CREATE_COMPANY,
      params: {
        company_name: nameMatch ? nameMatch[1].trim() : null
      }
    };
  }

  // Inventory creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      (lowerMessage.includes('product') || lowerMessage.includes('item') || lowerMessage.includes('inventory'))) {
    const nameMatch = message.match(/(?:called|named|name[d]?)\s+["']?([^"'\n,]+)["']?/i) ||
                      message.match(/(?:product|item)\s+["']?([^"'\n,]+)["']?/i);
    const quantityMatch = message.match(/(\d+)\s*(?:units?|pcs?|pieces?|items?)/i);
    const priceMatch = message.match(/(?:\$|price[d]?\s*(?:at)?)\s*(\d+(?:\.\d+)?)/i);

    return {
      action: AI_ACTIONS.CREATE_INVENTORY_ITEM,
      params: {
        name: nameMatch ? nameMatch[1].trim() : null,
        quantity: quantityMatch ? parseInt(quantityMatch[1]) : null,
        price: priceMatch ? parseFloat(priceMatch[1]) : null
      }
    };
  }

  // Stock adjustment patterns
  if ((lowerMessage.includes('add') || lowerMessage.includes('increase') || lowerMessage.includes('reduce') ||
       lowerMessage.includes('decrease') || lowerMessage.includes('adjust')) &&
      lowerMessage.includes('stock')) {
    const quantityMatch = message.match(/(\d+)\s*(?:units?|pcs?|pieces?|items?)?/i);
    const productMatch = message.match(/(?:of|for|to)\s+["']?([^"'\n,]+)["']?/i);
    const isDecrease = lowerMessage.includes('reduce') || lowerMessage.includes('decrease') || lowerMessage.includes('remove');

    return {
      action: AI_ACTIONS.ADJUST_STOCK,
      params: {
        product_name: productMatch ? productMatch[1].trim() : null,
        quantity: quantityMatch ? parseInt(quantityMatch[1]) * (isDecrease ? -1 : 1) : null
      }
    };
  }

  // Customer creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      lowerMessage.includes('customer')) {
    const nameMatch = message.match(/(?:called|named|name[d]?)\s+["']?([^"'\n,]+)["']?/i) ||
                      message.match(/customer\s+["']?([^"'\n,]+)["']?/i);
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
    const phoneMatch = message.match(/(?:phone|tel)[:\s]*([+\d\s-]+)/i);

    return {
      action: AI_ACTIONS.CREATE_CUSTOMER,
      params: {
        name: nameMatch ? nameMatch[1].trim() : null,
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[1].trim() : null
      }
    };
  }

  // Sales order patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      (lowerMessage.includes('sales order') || lowerMessage.includes('order') || lowerMessage.includes('buyurtma'))) {
    const customerMatch = message.match(/(?:for|from|customer)\s+["']?([^"'\n,]+)["']?/i);
    const amountMatch = message.match(/(?:\$|sum|amount)\s*(\d+(?:[.,]\d+)?)/i);
    const itemsMatch = message.match(/(\d+)\s*(?:items?|products?|dona)/i);

    return {
      action: AI_ACTIONS.CREATE_SALES_ORDER,
      params: {
        customer_name: customerMatch ? customerMatch[1].trim() : null,
        total_amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null,
        items_count: itemsMatch ? parseInt(itemsMatch[1]) : 1
      }
    };
  }

  // Purchase order patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      (lowerMessage.includes('purchase order') || lowerMessage.includes('purchase') || lowerMessage.includes('xarid'))) {
    const vendorMatch = message.match(/(?:from|vendor|supplier|yetkazuvchi)\s+["']?([^"'\n,]+)["']?/i);
    const amountMatch = message.match(/(?:\$|sum|amount)\s*(\d+(?:[.,]\d+)?)/i);

    return {
      action: AI_ACTIONS.CREATE_PURCHASE_ORDER,
      params: {
        vendor_name: vendorMatch ? vendorMatch[1].trim() : null,
        total_amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null
      }
    };
  }

  // Employee creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new') || lowerMessage.includes('hire')) &&
      (lowerMessage.includes('employee') || lowerMessage.includes('worker') || lowerMessage.includes('xodim') || lowerMessage.includes('ishchi'))) {
    const nameMatch = message.match(/(?:called|named|name[d]?)\s+["']?([^"'\n,]+)["']?/i) ||
                      message.match(/(?:employee|worker|xodim)\s+["']?([^"'\n,]+)["']?/i);
    const positionMatch = message.match(/(?:as|position|job|lavozim)\s+["']?([^"'\n,]+)["']?/i);
    const departmentMatch = message.match(/(?:department|bo'lim)\s+["']?([^"'\n,]+)["']?/i);
    const salaryMatch = message.match(/(?:salary|maosh|pay)\s*(?:\$|:)?\s*(\d+(?:[.,]\d+)?)/i);

    return {
      action: AI_ACTIONS.CREATE_EMPLOYEE,
      params: {
        full_name: nameMatch ? nameMatch[1].trim() : null,
        job_title: positionMatch ? positionMatch[1].trim() : null,
        department: departmentMatch ? departmentMatch[1].trim() : null,
        salary: salaryMatch ? parseFloat(salaryMatch[1].replace(',', '.')) : null
      }
    };
  }

  // Expense creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('log') || lowerMessage.includes('record')) &&
      (lowerMessage.includes('expense') || lowerMessage.includes('xarajat') || lowerMessage.includes('cost'))) {
    const amountMatch = message.match(/(?:\$|sum|amount)\s*(\d+(?:[.,]\d+)?)/i) ||
                        message.match(/(\d+(?:[.,]\d+)?)\s*(?:so'm|dollar|\$)/i);
    const categoryMatch = message.match(/(?:for|category|type)\s+["']?([^"'\n,]+)["']?/i);
    const descMatch = message.match(/(?:description|note|izoh)\s*[:\s]+["']?([^"'\n]+)["']?/i);

    return {
      action: AI_ACTIONS.CREATE_EXPENSE,
      params: {
        amount: amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null,
        category: categoryMatch ? categoryMatch[1].trim() : 'general',
        description: descMatch ? descMatch[1].trim() : null
      }
    };
  }

  // Project creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new') || lowerMessage.includes('start')) &&
      (lowerMessage.includes('project') || lowerMessage.includes('loyiha'))) {
    const nameMatch = message.match(/(?:called|named|name[d]?|project)\s+["']?([^"'\n,]+)["']?/i);
    const clientMatch = message.match(/(?:for|client|customer|mijoz)\s+["']?([^"'\n,]+)["']?/i);
    const budgetMatch = message.match(/(?:budget|byudjet)\s*(?:\$|:)?\s*(\d+(?:[.,]\d+)?)/i);

    return {
      action: AI_ACTIONS.CREATE_PROJECT,
      params: {
        project_name: nameMatch ? nameMatch[1].trim() : null,
        client_name: clientMatch ? clientMatch[1].trim() : null,
        budget: budgetMatch ? parseFloat(budgetMatch[1].replace(',', '.')) : null
      }
    };
  }

  // Contract creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      (lowerMessage.includes('contract') || lowerMessage.includes('shartnoma'))) {
    const nameMatch = message.match(/(?:called|named|name[d]?|contract)\s+["']?([^"'\n,]+)["']?/i);
    const partyMatch = message.match(/(?:with|party|tomon)\s+["']?([^"'\n,]+)["']?/i);
    const valueMatch = message.match(/(?:value|worth|qiymat)\s*(?:\$|:)?\s*(\d+(?:[.,]\d+)?)/i);

    return {
      action: AI_ACTIONS.CREATE_CONTRACT,
      params: {
        contract_name: nameMatch ? nameMatch[1].trim() : null,
        party_name: partyMatch ? partyMatch[1].trim() : null,
        contract_value: valueMatch ? parseFloat(valueMatch[1].replace(',', '.')) : null
      }
    };
  }

  // Vendor/Supplier creation patterns
  if ((lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new')) &&
      (lowerMessage.includes('vendor') || lowerMessage.includes('supplier') ||
       lowerMessage.includes('yetkazuvchi') || lowerMessage.includes('hamkor') || lowerMessage.includes('ta\'minotchi'))) {
    const nameMatch = message.match(/(?:called|named|name[d]?)\s+["']?([^"'\n,]+)["']?/i) ||
                      message.match(/(?:vendor|supplier|yetkazuvchi|hamkor)\s+["']?([^"'\n,]+)["']?/i);
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
    const phoneMatch = message.match(/(?:phone|tel|telefon)[:\s]*([+\d\s-]+)/i);
    const contactMatch = message.match(/(?:contact|aloqa)\s+["']?([^"'\n,]+)["']?/i);

    return {
      action: AI_ACTIONS.CREATE_VENDOR,
      params: {
        vendor_name: nameMatch ? nameMatch[1].trim() : null,
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[1].trim() : null,
        contact_name: contactMatch ? contactMatch[1].trim() : null
      }
    };
  }

  return null;
};

// Helper to get company-specific storage key
const getStorageKey = (baseKey, companyId) => {
  return companyId ? `${baseKey}_${companyId}` : baseKey;
};

// Helper to get user's data from localStorage (company-scoped)
const getUserData = (companyId) => {
  try {
    const salesOrders = JSON.parse(localStorage.getItem(getStorageKey('genix_sales_orders', companyId)) || '[]');
    const purchaseOrders = JSON.parse(localStorage.getItem(getStorageKey('genix_purchase_orders', companyId)) || '[]');
    const inventory = JSON.parse(localStorage.getItem(getStorageKey('genix_inventory', companyId)) || '[]');
    const employees = JSON.parse(localStorage.getItem(getStorageKey('genix_employees', companyId)) || '[]');
    const expenses = JSON.parse(localStorage.getItem(getStorageKey('genix_expense_claims', companyId)) || '[]');
    const payroll = JSON.parse(localStorage.getItem(getStorageKey('genix_payroll', companyId)) || '[]');
    const assets = JSON.parse(localStorage.getItem(getStorageKey('genix_fixed_assets', companyId)) || '[]');
    const projects = JSON.parse(localStorage.getItem(getStorageKey('genix_projects', companyId)) || '[]');
    const contracts = JSON.parse(localStorage.getItem(getStorageKey('genix_contracts', companyId)) || '[]');
    const customers = JSON.parse(localStorage.getItem(getStorageKey('genix_customers', companyId)) || '[]');
    const financialTransactions = JSON.parse(localStorage.getItem(getStorageKey('genix_financial_transactions', companyId)) || '[]');

    return {
      salesOrders,
      purchaseOrders,
      inventory,
      employees,
      expenses,
      payroll,
      assets,
      projects,
      contracts,
      customers,
      financialTransactions
    };
  } catch (error) {
    console.error('Error loading user data:', error);
    return {};
  }
};

// AI text translations for multilingual support
const AI_TEXTS = {
  en: {
    salesAnalysis: 'Sales Analysis',
    noSalesOrders: "You don't have any sales orders recorded yet.",
    toGetStarted: 'To get started:',
    goToSalesOrders: 'Go to **Sales Orders** module',
    createFirstSalesOrder: 'Create your first sales order',
    comeBackForInsights: 'Come back and ask me for insights!',
    onceSalesData: 'Once you have sales data, I can help you with:',
    revenueTrends: 'Revenue trends and growth analysis',
    topCustomersByRevenue: 'Top customers by revenue',
    productPerformance: 'Product performance insights',
    salesForecasting: 'Sales forecasting',
    keyMetrics: 'Key Metrics:',
    totalRevenue: 'Total Revenue',
    totalOrders: 'Total Orders',
    avgOrderValue: 'Average Order Value',
    orderStatusBreakdown: 'Order Status Breakdown:',
    orders: 'orders',
    topCustomers: 'Top Customers by Revenue:',
    noCustomerData: 'No customer data available',
    outstandingPayments: 'Outstanding Payments:',
    unpaidOrdersTotaling: 'unpaid orders totaling',
    allOrdersPaid: 'All orders are paid!',
    recommendations: 'Recommendations:',
    focusOnRetaining: 'Focus on retaining',
    yourTopCustomer: '(your top customer)',
    followUpOn: 'Follow up on',
    unpaidInvoices: 'unpaid invoices',
    considerAnalyzing: 'Consider analyzing product performance for optimization',
    yourDataSummary: 'Your Data',
    inventoryAnalysis: 'Inventory Analysis',
    noInventoryItems: "You don't have any inventory items recorded yet.",
    goToInventory: 'Go to **Inventory** module',
    addYourProducts: 'Add your products/items',
    setReorderLevels: 'Set reorder levels for automatic alerts',
    onceInventoryData: 'Once you have inventory data, I can help you with:',
    lowStockAlerts: 'Low stock alerts',
    reorderRecommendations: 'Reorder recommendations',
    deadStockIdentification: 'Dead stock identification',
    inventoryValuation: 'Inventory valuation',
    overview: 'Overview:',
    totalSKUs: 'Total SKUs',
    totalUnits: 'Total Units',
    totalValue: 'Total Value',
    lowStockAlert: 'Low Stock Alert',
    items: 'items',
    product: 'Product',
    current: 'Current',
    reorderLevel: 'Reorder Level',
    status: 'Status',
    outOfStock: 'Out of Stock',
    low: 'Low',
    allItemsStocked: 'All items are adequately stocked!',
    needsImmediateAttention: 'items need immediate attention',
    createPurchaseOrders: 'Create purchase orders for',
    lowStockItems: 'low stock items',
    inventoryLevelsHealthy: 'Inventory levels are healthy',
    urgent: 'Urgent: Restock',
    outOfStockItems: 'out-of-stock items',
    reviewSlowMoving: 'Review slow-moving items for promotions',
    financialAnalysis: 'Financial Analysis',
    noFinancialData: "You don't have any financial data recorded yet.",
    createSalesOrdersToTrack: 'Create **Sales Orders** to track revenue',
    logExpenses: 'Log **Expenses** for cost tracking',
    recordFinancialTrans: 'Record **Financial Transactions** for cash flow',
    onceFinancialData: 'Once you have data, I can help you with:',
    cashFlowAnalysis: 'Cash flow analysis',
    profitMarginCalc: 'Profit margin calculations',
    expenseBreakdowns: 'Expense breakdowns',
    receivablesPayablesTracking: 'Receivables and payables tracking',
    financialHealthDashboard: 'Financial Health Dashboard',
    revenueProfit: 'Revenue & Profit:',
    totalPurchases: 'Total Purchases',
    totalExpenses: 'Total Expenses',
    grossProfit: 'Gross Profit',
    netProfit: 'Net Profit',
    profitMargin: 'Profit Margin',
    receivablesPayables: 'Receivables & Payables:',
    accountsReceivable: 'Accounts Receivable',
    unpaidInvoicesCount: 'unpaid invoices',
    accountsPayable: 'Accounts Payable',
    unpaidBills: 'unpaid bills',
    expenseBreakdown: 'Expense Breakdown:',
    billsPendingPayment: 'bills pending payment',
    reviewExpenses: 'Review expenses - currently operating at a loss',
    maintainProfitability: 'Maintain current profitability trends',
    businessAtGlance: 'Your Business at a Glance:',
    salesOrdersCount: 'Sales Orders',
    noOrdersYet: 'No orders yet',
    inventoryItemsCount: 'Inventory Items',
    lowStockCount: 'low stock',
    noItemsYet: 'No items yet',
    customersCount: 'Customers',
    noneYet: 'None yet',
    employeesCount: 'Employees',
    assetsCount: 'Assets',
    projectsCount: 'Projects',
    contractsCount: 'Contracts',
    whatToAnalyze: 'What would you like to analyze?',
    showSalesPerformance: 'Show me sales performance',
    whatInventoryRestock: 'What inventory needs restocking?',
    analyzeFinancialHealth: 'Analyze our financial health',
    showCustomerInsights: 'Show customer insights',
    hrPayrollSummary: 'HR and payroll summary',
    imYourCopilot: "I'm your Genix AI Business Copilot. I can help you with:",
    analyticsInsights: 'Analytics & Insights',
    salesPerformanceAnalysis: 'Sales performance analysis',
    inventoryOptimization: 'Inventory optimization',
    financialHealthMonitoring: 'Financial health monitoring',
    customerBehaviorInsights: 'Customer behavior insights',
    automation: 'Automation',
    createManageWorkflows: 'Create and manage workflows',
    setupAlertsNotifications: 'Set up alerts and notifications',
    automateRepetitiveTasks: 'Automate repetitive tasks',
    reports: 'Reports',
    generateFinancialStatements: 'Generate financial statements',
    createSalesReports: 'Create sales reports',
    exportDataFormats: 'Export data in various formats',
    recommendationsSection: 'Recommendations',
    identifyOpportunities: 'Identify opportunities',
    flagRisksIssues: 'Flag risks and issues',
    suggestImprovements: 'Suggest improvements',
    gettingStarted: 'Getting Started:',
    noDataYet: "It looks like you don't have much data yet. Start by adding:",
    customersInModule: '**Customers** in the Customers module',
    inventoryItemsInModule: '**Inventory items** in the Inventory module',
    salesOrdersToTrack: '**Sales orders** to track revenue',
    onceDataPersonalized: 'Once you have data, I can provide personalized insights and recommendations!',
    greeting: 'Hello! How can I help you today?',
  },
  uz: {
    salesAnalysis: 'Savdo Tahlili',
    noSalesOrders: "Sizda hali savdo buyurtmalari yo'q.",
    toGetStarted: 'Boshlash uchun:',
    goToSalesOrders: '**Savdo Buyurtmalari** moduliga o\'ting',
    createFirstSalesOrder: 'Birinchi savdo buyurtmangizni yarating',
    comeBackForInsights: 'Qaytib kelib, tahlil so\'rang!',
    onceSalesData: 'Savdo ma\'lumotlaringiz bo\'lganda, quyidagilar bilan yordam bera olaman:',
    revenueTrends: 'Daromad tendensiyalari va o\'sish tahlili',
    topCustomersByRevenue: 'Daromad bo\'yicha eng yaxshi mijozlar',
    productPerformance: 'Mahsulot samaradorligi haqida ma\'lumot',
    salesForecasting: 'Savdo prognozi',
    keyMetrics: 'Asosiy Ko\'rsatkichlar:',
    totalRevenue: 'Jami Daromad',
    totalOrders: 'Jami Buyurtmalar',
    avgOrderValue: 'O\'rtacha Buyurtma Qiymati',
    orderStatusBreakdown: 'Buyurtma Holati:',
    orders: 'buyurtma',
    topCustomers: 'Daromad bo\'yicha Eng Yaxshi Mijozlar:',
    noCustomerData: 'Mijoz ma\'lumotlari mavjud emas',
    outstandingPayments: 'To\'lanmagan To\'lovlar:',
    unpaidOrdersTotaling: 'jami summa bilan to\'lanmagan buyurtmalar',
    allOrdersPaid: 'Barcha buyurtmalar to\'langan!',
    recommendations: 'Tavsiyalar:',
    focusOnRetaining: 'Ushlab qolishga e\'tibor bering:',
    yourTopCustomer: '(eng yaxshi mijozingiz)',
    followUpOn: 'Kuzatib boring:',
    unpaidInvoices: 'to\'lanmagan hisob-faktura',
    considerAnalyzing: 'Optimallashtirish uchun mahsulot samaradorligini tahlil qilishni o\'ylab ko\'ring',
    yourDataSummary: 'Sizning Ma\'lumotlaringiz',
    inventoryAnalysis: 'Inventar Tahlili',
    noInventoryItems: "Sizda hali inventar mahsulotlari yo'q.",
    goToInventory: '**Inventar** moduliga o\'ting',
    addYourProducts: 'Mahsulotlaringizni qo\'shing',
    setReorderLevels: 'Avtomatik ogohlantirishlar uchun qayta buyurtma darajasini belgilang',
    onceInventoryData: 'Inventar ma\'lumotlaringiz bo\'lganda, quyidagilar bilan yordam bera olaman:',
    lowStockAlerts: 'Kam zaxira ogohlantirishlari',
    reorderRecommendations: 'Qayta buyurtma tavsiylari',
    deadStockIdentification: 'Harakatsiz zaxiralarni aniqlash',
    inventoryValuation: 'Inventar baholash',
    overview: 'Umumiy Ko\'rinish:',
    totalSKUs: 'Jami SKUlar',
    totalUnits: 'Jami Birliklar',
    totalValue: 'Jami Qiymat',
    lowStockAlert: 'Kam Zaxira Ogohlantirishi',
    items: 'ta mahsulot',
    product: 'Mahsulot',
    current: 'Joriy',
    reorderLevel: 'Qayta buyurtma',
    status: 'Holat',
    outOfStock: 'Tugagan',
    low: 'Kam',
    allItemsStocked: 'Barcha mahsulotlar yetarli darajada mavjud!',
    needsImmediateAttention: 'ta mahsulot zudlik bilan e\'tibor talab qiladi',
    createPurchaseOrders: 'Xarid buyurtmasi yarating:',
    lowStockItems: 'kam zaxiradagi mahsulot',
    inventoryLevelsHealthy: 'Inventar darajalari sog\'lom',
    urgent: 'Shoshilinch: Qayta to\'ldiring',
    outOfStockItems: 'tugagan mahsulot',
    reviewSlowMoving: 'Sekin sotilayotgan mahsulotlarni aksiyalar uchun ko\'rib chiqing',
    financialAnalysis: 'Moliyaviy Tahlil',
    noFinancialData: "Sizda hali moliyaviy ma'lumotlar yo'q.",
    createSalesOrdersToTrack: 'Daromadni kuzatish uchun **Savdo Buyurtmalari** yarating',
    logExpenses: 'Xarajatlarni kuzatish uchun **Xarajatlar** kiriting',
    recordFinancialTrans: 'Pul oqimi uchun **Moliyaviy Operatsiyalar** qayd qiling',
    onceFinancialData: 'Ma\'lumotlaringiz bo\'lganda, quyidagilar bilan yordam bera olaman:',
    cashFlowAnalysis: 'Pul oqimi tahlili',
    profitMarginCalc: 'Foyda marjasini hisoblash',
    expenseBreakdowns: 'Xarajatlar taqsimoti',
    receivablesPayablesTracking: 'Debitorlik va kreditorlik kuzatuvi',
    financialHealthDashboard: 'Moliyaviy Salomatlik Paneli',
    revenueProfit: 'Daromad va Foyda:',
    totalPurchases: 'Jami Xaridlar',
    totalExpenses: 'Jami Xarajatlar',
    grossProfit: 'Yalpi Foyda',
    netProfit: 'Sof Foyda',
    profitMargin: 'Foyda Marjasi',
    receivablesPayables: 'Debitorlik va Kreditorlik:',
    accountsReceivable: 'Debitorlik',
    unpaidInvoicesCount: 'to\'lanmagan hisob-faktura',
    accountsPayable: 'Kreditorlik',
    unpaidBills: 'to\'lanmagan hisob',
    expenseBreakdown: 'Xarajatlar Taqsimoti:',
    billsPendingPayment: 'to\'lovni kutayotgan hisob',
    reviewExpenses: 'Xarajatlarni ko\'rib chiqing - hozirda zarar bilan ishlayapti',
    maintainProfitability: 'Joriy foyda tendensiyalarini saqlang',
    businessAtGlance: 'Biznesingiz bir qarashda:',
    salesOrdersCount: 'Savdo Buyurtmalari',
    noOrdersYet: 'Hali buyurtmalar yo\'q',
    inventoryItemsCount: 'Inventar Mahsulotlari',
    lowStockCount: 'kam zaxira',
    noItemsYet: 'Hali mahsulotlar yo\'q',
    customersCount: 'Mijozlar',
    noneYet: 'Hali yo\'q',
    employeesCount: 'Xodimlar',
    assetsCount: 'Aktivlar',
    projectsCount: 'Loyihalar',
    contractsCount: 'Shartnomalar',
    whatToAnalyze: 'Nimani tahlil qilishni xohlaysiz?',
    showSalesPerformance: 'Savdo samaradorligini ko\'rsating',
    whatInventoryRestock: 'Qaysi inventar to\'ldirilishi kerak?',
    analyzeFinancialHealth: 'Moliyaviy salomatlikni tahlil qiling',
    showCustomerInsights: 'Mijozlar haqida ma\'lumot ko\'rsating',
    hrPayrollSummary: 'HR va ish haqi xulosasi',
    imYourCopilot: "Men sizning Genix AI Biznes Yordamchingizman. Quyidagilar bilan yordam bera olaman:",
    analyticsInsights: 'Tahlil va Tushunchalar',
    salesPerformanceAnalysis: 'Savdo samaradorligi tahlili',
    inventoryOptimization: 'Inventarni optimallashtirish',
    financialHealthMonitoring: 'Moliyaviy salomatlik monitoringi',
    customerBehaviorInsights: 'Mijoz xulq-atvori haqida tushunchalar',
    automation: 'Avtomatlashtirish',
    createManageWorkflows: 'Ish jarayonlarini yaratish va boshqarish',
    setupAlertsNotifications: 'Ogohlantirishlar va bildirishnomalarni sozlash',
    automateRepetitiveTasks: 'Takrorlanuvchi vazifalarni avtomatlashtirish',
    reports: 'Hisobotlar',
    generateFinancialStatements: 'Moliyaviy hisobotlar yaratish',
    createSalesReports: 'Savdo hisobotlarini yaratish',
    exportDataFormats: 'Ma\'lumotlarni turli formatlarda eksport qilish',
    recommendationsSection: 'Tavsiyalar',
    identifyOpportunities: 'Imkoniyatlarni aniqlash',
    flagRisksIssues: 'Xavf va muammolarni belgilash',
    suggestImprovements: 'Yaxshilanishlarni taklif qilish',
    gettingStarted: 'Boshlash:',
    noDataYet: "Ko'rinishidan hali ko'p ma'lumotingiz yo'q. Quyidagilarni qo'shishdan boshlang:",
    customersInModule: 'Mijozlar moduliga **Mijozlar**',
    inventoryItemsInModule: 'Inventar moduliga **Inventar mahsulotlari**',
    salesOrdersToTrack: 'Daromadni kuzatish uchun **Savdo buyurtmalari**',
    onceDataPersonalized: 'Ma\'lumotlaringiz bo\'lganda, shaxsiylashtirilgan tahlil va tavsiyalar bera olaman!',
    greeting: 'Salom! Bugun sizga qanday yordam bera olaman?',
  },
  ru: {
    salesAnalysis: 'Анализ Продаж',
    noSalesOrders: "У вас пока нет записанных заказов на продажу.",
    toGetStarted: 'Чтобы начать:',
    goToSalesOrders: 'Перейдите в модуль **Заказы на продажу**',
    createFirstSalesOrder: 'Создайте свой первый заказ',
    comeBackForInsights: 'Вернитесь и спросите меня об аналитике!',
    onceSalesData: 'Когда у вас будут данные о продажах, я могу помочь с:',
    revenueTrends: 'Анализ трендов и роста выручки',
    topCustomersByRevenue: 'Топ клиенты по выручке',
    productPerformance: 'Аналитика производительности продуктов',
    salesForecasting: 'Прогнозирование продаж',
    greeting: 'Привет! Чем я могу вам помочь сегодня?',
    // Add more Russian translations as needed
  }
};

// Helper to get translated text
const getAIText = (key, lang = 'en') => {
  const texts = AI_TEXTS[lang] || AI_TEXTS.en;
  return texts[key] || AI_TEXTS.en[key] || key;
};

// Detect user's language from message
const detectMessageLanguage = (message) => {
  const lowerMessage = message.toLowerCase();

  // Uzbek patterns
  const uzPatterns = ['salom', 'rahmat', 'qanday', 'nima', 'kerak', 'yordam', 'ko\'rsating', 'tahlil',
    'savdo', 'xarid', 'mijoz', 'mahsulot', 'inventar', 'xodim', 'loyiha', 'shartnoma',
    'qilish', 'yaratish', 'qo\'shish', 'o\'chirish', 'yangilash', 'menga', 'biznes'];

  // Russian patterns
  const ruPatterns = ['привет', 'спасибо', 'помощь', 'показать', 'анализ', 'продажи', 'покупки',
    'клиенты', 'товары', 'инвентарь', 'сотрудники', 'проекты', 'контракты'];

  const uzScore = uzPatterns.filter(p => lowerMessage.includes(p)).length;
  const ruScore = ruPatterns.filter(p => lowerMessage.includes(p)).length;

  if (uzScore > ruScore && uzScore > 0) return 'uz';
  if (ruScore > uzScore && ruScore > 0) return 'ru';
  return null; // Return null to use system language
};

// AI response generator for demo/fallback mode - uses REAL user data (company-scoped)
const generateDemoResponse = (message, context = {}, companyId = null, systemLang = 'en', formatCurrency = null) => {
  // Use provided formatCurrency or create a default one
  const fmtCurrency = formatCurrency || createCurrencyFormatter();
  const lowerMessage = message.toLowerCase();
  const userData = getUserData(companyId);

  // Detect language from message or use system language
  const detectedLang = detectMessageLanguage(message);
  const lang = detectedLang || systemLang || 'en';
  const t = (key) => getAIText(key, lang);

  // Sales & Revenue queries
  if (lowerMessage.includes('sales') || lowerMessage.includes('revenue') || lowerMessage.includes('top customer') ||
      lowerMessage.includes('savdo') || lowerMessage.includes('daromad') || lowerMessage.includes('sotuv') ||
      lowerMessage.includes('buyurtma') || lowerMessage.includes('mijoz')) {
    const { salesOrders = [], customers = [] } = userData;

    if (salesOrders.length === 0) {
      return {
        content: `**Sales Analysis:**

You don't have any sales orders recorded yet.

**To get started:**
1. Go to **Sales Orders** module
2. Create your first sales order
3. Come back and ask me for insights!

Once you have sales data, I can help you with:
- Revenue trends and growth analysis
- Top customers by revenue
- Product performance insights
- Sales forecasting`,
        tool_calls: [{ name: 'analyze_sales_data', status: 'completed' }]
      };
    }

    const totalRevenue = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const avgOrderValue = salesOrders.length > 0 ? totalRevenue / salesOrders.length : 0;

    // Calculate customer revenue
    const customerRevenue = {};
    salesOrders.forEach(o => {
      if (o.customer_name) {
        customerRevenue[o.customer_name] = (customerRevenue[o.customer_name] || 0) + (o.total_amount || 0);
      }
    });

    const topCustomers = Object.entries(customerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Status breakdown
    const statusCounts = salesOrders.reduce((acc, o) => {
      acc[o.status || 'unknown'] = (acc[o.status || 'unknown'] || 0) + 1;
      return acc;
    }, {});

    const unpaidOrders = salesOrders.filter(o => o.payment_status === 'unpaid');
    const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    let topCustomersText = topCustomers.length > 0
      ? topCustomers.map((c, i) => `${i + 1}. ${c[0]} - ${fmtCurrency(c[1])}`).join('\n')
      : 'No customer data available';

    return {
      content: `**Sales Analysis - Your Data:**

**Key Metrics:**
- Total Revenue: ${fmtCurrency(totalRevenue)}
- Total Orders: ${salesOrders.length}
- Average Order Value: ${fmtCurrency(avgOrderValue)}

**Order Status Breakdown:**
${Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count} orders`).join('\n')}

**Top Customers by Revenue:**
${topCustomersText}

${unpaidOrders.length > 0 ? `**⚠️ Outstanding Payments:**
- ${unpaidOrders.length} unpaid orders totaling ${fmtCurrency(unpaidTotal)}` : '**✓ All orders are paid!**'}

**Recommendations:**
${topCustomers.length > 0 ? `- Focus on retaining ${topCustomers[0][0]} (your top customer)` : '- Start building your customer base'}
${unpaidOrders.length > 0 ? `- Follow up on ${unpaidOrders.length} unpaid invoices` : ''}
- Consider analyzing product performance for optimization`,
      tool_calls: [{ name: 'analyze_sales_data', status: 'completed' }]
    };
  }

  // Inventory queries
  if (lowerMessage.includes('inventory') || lowerMessage.includes('stock') || lowerMessage.includes('reorder') || lowerMessage.includes('restock') ||
      lowerMessage.includes('inventar') || lowerMessage.includes('ombor') || lowerMessage.includes('mahsulot') ||
      lowerMessage.includes('tovar') || lowerMessage.includes('zaxira') || lowerMessage.includes('qaysi') ||
      lowerMessage.includes('kam') || lowerMessage.includes('to\'ldir') || lowerMessage.includes('tugay')) {
    const { inventory = [] } = userData;

    if (inventory.length === 0) {
      return {
        content: `**Inventory Analysis:**

You don't have any inventory items recorded yet.

**To get started:**
1. Go to **Inventory** module
2. Add your products/items
3. Set reorder levels for automatic alerts

Once you have inventory data, I can help you with:
- Low stock alerts
- Reorder recommendations
- Dead stock identification
- Inventory valuation`,
        tool_calls: [{ name: 'analyze_inventory', status: 'completed' }]
      };
    }

    const totalValue = inventory.reduce((sum, i) => sum + ((i.current_stock || 0) * (i.unit_cost || 0)), 0);
    const totalUnits = inventory.reduce((sum, i) => sum + (i.current_stock || 0), 0);
    const lowStockItems = inventory.filter(i => (i.current_stock || 0) <= (i.reorder_level || 10));
    const outOfStock = inventory.filter(i => (i.current_stock || 0) === 0);

    const lowStockTable = lowStockItems.slice(0, 5).map(i =>
      `| ${i.name || i.item_name || 'Unknown'} | ${i.current_stock || 0} | ${i.reorder_level || 10} | ${(i.current_stock || 0) === 0 ? '🚨 Out of Stock' : '⚠️ Low'} |`
    ).join('\n');

    return {
      content: `**Inventory Analysis - Your Data:**

**Overview:**
- Total SKUs: ${inventory.length}
- Total Units: ${totalUnits.toLocaleString()}
- Total Value: ${fmtCurrency(totalValue)}

${lowStockItems.length > 0 ? `**⚠️ Low Stock Alert (${lowStockItems.length} items):**
| Product | Current | Reorder Level | Status |
|---------|---------|---------------|--------|
${lowStockTable}` : '**✓ All items are adequately stocked!**'}

${outOfStock.length > 0 ? `**🚨 Out of Stock: ${outOfStock.length} items need immediate attention**` : ''}

**Recommendations:**
${lowStockItems.length > 0 ? `- Create purchase orders for ${lowStockItems.length} low stock items` : '- Inventory levels are healthy'}
${outOfStock.length > 0 ? `- Urgent: Restock ${outOfStock.length} out-of-stock items` : ''}
- Review slow-moving items for promotions`,
      tool_calls: [{ name: 'analyze_inventory', status: 'completed' }]
    };
  }

  // Financial queries
  if (lowerMessage.includes('cash') || lowerMessage.includes('financial') || lowerMessage.includes('expense') || lowerMessage.includes('profit') ||
      lowerMessage.includes('moliya') || lowerMessage.includes('pul') || lowerMessage.includes('xarajat') ||
      lowerMessage.includes('foyda') || lowerMessage.includes('kassa') || lowerMessage.includes('oqim')) {
    const { salesOrders = [], purchaseOrders = [], expenses = [], financialTransactions = [] } = userData;

    const hasFinancialData = salesOrders.length > 0 || expenses.length > 0 || financialTransactions.length > 0;

    if (!hasFinancialData) {
      return {
        content: `**Financial Analysis:**

You don't have any financial data recorded yet.

**To get started:**
1. Create **Sales Orders** to track revenue
2. Log **Expenses** for cost tracking
3. Record **Financial Transactions** for cash flow

Once you have data, I can help you with:
- Cash flow analysis
- Profit margin calculations
- Expense breakdowns
- Receivables and payables tracking`,
        tool_calls: [{ name: 'analyze_financials', status: 'completed' }]
      };
    }

    // Calculate financial metrics from real data
    const totalRevenue = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPurchases = purchaseOrders.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    // Accounts receivable (unpaid sales)
    const unpaidSales = salesOrders.filter(o => o.payment_status === 'unpaid' || o.payment_status === 'pending');
    const accountsReceivable = unpaidSales.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Accounts payable (unpaid purchases)
    const unpaidPurchases = purchaseOrders.filter(p => p.payment_status === 'unpaid' || p.payment_status === 'pending');
    const accountsPayable = unpaidPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    // Expense breakdown by category
    const expenseByCategory = expenses.reduce((acc, e) => {
      const cat = e.category || 'Other';
      acc[cat] = (acc[cat] || 0) + (e.amount || 0);
      return acc;
    }, {});

    const grossProfit = totalRevenue - totalPurchases;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return {
      content: `**Financial Health Dashboard - Your Data:**

**Revenue & Profit:**
- Total Revenue: ${fmtCurrency(totalRevenue)}
- Total Purchases: ${fmtCurrency(totalPurchases)}
- Total Expenses: ${fmtCurrency(totalExpenses)}
- Gross Profit: ${fmtCurrency(grossProfit)}
- Net Profit: ${fmtCurrency(netProfit)}
- Profit Margin: ${profitMargin}%

**Receivables & Payables:**
- Accounts Receivable: ${fmtCurrency(accountsReceivable)} (${unpaidSales.length} unpaid invoices)
- Accounts Payable: ${fmtCurrency(accountsPayable)} (${unpaidPurchases.length} unpaid bills)

${Object.keys(expenseByCategory).length > 0 ? `**Expense Breakdown:**
${Object.entries(expenseByCategory).map(([cat, amt]) => `- ${cat}: ${fmtCurrency(amt)}`).join('\n')}` : ''}

**Recommendations:**
${unpaidSales.length > 0 ? `- Follow up on ${unpaidSales.length} unpaid invoices totaling ${fmtCurrency(accountsReceivable)}` : '- All invoices are paid!'}
${unpaidPurchases.length > 0 ? `- ${unpaidPurchases.length} bills pending payment` : ''}
${netProfit < 0 ? '- ⚠️ Review expenses - currently operating at a loss' : '- Maintain current profitability trends'}`,
      tool_calls: [{ name: 'analyze_financials', status: 'completed' }]
    };
  }

  // Customer/CRM queries
  if (lowerMessage.includes('customer') || lowerMessage.includes('lead') || lowerMessage.includes('crm')) {
    const { customers = [], salesOrders = [] } = userData;

    if (customers.length === 0) {
      return {
        content: `**Customer Analytics:**

You don't have any customers recorded yet.

**To get started:**
1. Go to **Customers** module
2. Add your customers and contacts
3. Create sales orders to track customer revenue

Once you have customer data, I can help you with:
- Customer revenue analysis
- Top customer identification
- Customer segmentation
- Engagement tracking`,
        tool_calls: [{ name: 'analyze_customers', status: 'completed' }]
      };
    }

    // Calculate customer metrics from real data
    const customerRevenue = {};
    salesOrders.forEach(o => {
      if (o.customer_name) {
        customerRevenue[o.customer_name] = (customerRevenue[o.customer_name] || 0) + (o.total_amount || 0);
      }
    });

    const topCustomers = Object.entries(customerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Segment customers by revenue
    const enterprise = Object.entries(customerRevenue).filter(([, rev]) => rev > 50000);
    const midMarket = Object.entries(customerRevenue).filter(([, rev]) => rev >= 10000 && rev <= 50000);
    const smb = Object.entries(customerRevenue).filter(([, rev]) => rev < 10000);

    // Customers with unpaid orders
    const customersWithUnpaid = [...new Set(
      salesOrders.filter(o => o.payment_status === 'unpaid').map(o => o.customer_name)
    )];

    const totalCustomerRevenue = Object.values(customerRevenue).reduce((sum, r) => sum + r, 0);

    return {
      content: `**Customer Analytics - Your Data:**

**Overview:**
- Total Customers: ${customers.length}
- Customers with Orders: ${Object.keys(customerRevenue).length}
- Total Revenue: ${fmtCurrency(totalCustomerRevenue)}

**Customer Segments by Revenue:**
- Enterprise (>${fmtCurrency(50000)}): ${enterprise.length} accounts
- Mid-Market (${fmtCurrency(10000)}-${fmtCurrency(50000)}): ${midMarket.length} accounts
- SMB (<${fmtCurrency(10000)}): ${smb.length} accounts

${topCustomers.length > 0 ? `**Top Customers by Revenue:**
${topCustomers.map((c, i) => `${i + 1}. ${c[0]} - ${fmtCurrency(c[1])}`).join('\n')}` : ''}

${customersWithUnpaid.length > 0 ? `**⚠️ Customers with Unpaid Orders:**
${customersWithUnpaid.slice(0, 5).map(c => `- ${c}`).join('\n')}` : '**✓ All customers have paid their orders!**'}

**Recommendations:**
${topCustomers.length > 0 ? `- Nurture relationship with ${topCustomers[0][0]} (top customer)` : '- Focus on acquiring new customers'}
${customersWithUnpaid.length > 0 ? `- Follow up with ${customersWithUnpaid.length} customers on payments` : ''}
- Consider loyalty programs for repeat customers`,
      tool_calls: [{ name: 'analyze_customers', status: 'completed' }]
    };
  }

  // HR/Employee queries
  if (lowerMessage.includes('employee') || lowerMessage.includes('hr') || lowerMessage.includes('payroll') || lowerMessage.includes('staff')) {
    const { employees = [], payroll = [] } = userData;

    if (employees.length === 0) {
      return {
        content: `**HR Analytics:**

You don't have any employees recorded yet.

**To get started:**
1. Go to **HR** module
2. Add your employees
3. Set up payroll records

Once you have employee data, I can help you with:
- Workforce overview
- Department distribution
- Payroll summaries
- Compensation analysis`,
        tool_calls: [{ name: 'analyze_hr', status: 'completed' }]
      };
    }

    // Calculate HR metrics from real data
    const activeEmployees = employees.filter(e => e.status === 'active' || !e.status);

    // Department distribution
    const departments = employees.reduce((acc, e) => {
      const dept = e.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});

    // Payroll calculations
    const totalMonthlyPayroll = payroll.reduce((sum, p) => sum + (p.net_salary || p.gross_salary || 0), 0);
    const pendingPayroll = payroll.filter(p => p.status === 'pending' || p.status === 'draft');
    const processedPayroll = payroll.filter(p => p.status === 'paid' || p.status === 'processed');

    // Average salary
    const avgSalary = employees.length > 0
      ? employees.reduce((sum, e) => sum + (e.salary || e.basic_salary || 0), 0) / employees.length
      : 0;

    return {
      content: `**HR Analytics - Your Data:**

**Workforce Overview:**
- Total Employees: ${employees.length}
- Active Employees: ${activeEmployees.length}
- Average Salary: ${fmtCurrency(avgSalary)}

**Department Distribution:**
${Object.entries(departments).map(([dept, count]) => `- ${dept}: ${count} employees`).join('\n')}

**Payroll Summary:**
- Total Payroll Records: ${payroll.length}
- Processed Payrolls: ${processedPayroll.length}
- Pending Payrolls: ${pendingPayroll.length}
${totalMonthlyPayroll > 0 ? `- Total Payroll Amount: ${fmtCurrency(totalMonthlyPayroll)}` : ''}

**Recommendations:**
${pendingPayroll.length > 0 ? `- Process ${pendingPayroll.length} pending payroll records` : '- All payroll records are processed!'}
${Object.keys(departments).length === 1 ? '- Consider organizing employees into departments' : ''}
- Review compensation benchmarks for retention`,
      tool_calls: [{ name: 'analyze_hr', status: 'completed' }]
    };
  }

  // Assets queries
  if (lowerMessage.includes('asset') || lowerMessage.includes('equipment') || lowerMessage.includes('depreciation')) {
    const { assets = [] } = userData;

    if (assets.length === 0) {
      return {
        content: `**Asset Management:**

You don't have any assets recorded yet.

**To get started:**
1. Go to **Assets** module
2. Add your company assets (equipment, vehicles, etc.)
3. Track depreciation and maintenance

Once you have asset data, I can help you with:
- Asset valuation and depreciation tracking
- Maintenance schedules
- Asset lifecycle analysis
- Disposal recommendations`,
        tool_calls: [{ name: 'analyze_assets', status: 'completed' }]
      };
    }

    const totalValue = assets.reduce((sum, a) => sum + (a.current_value || a.purchase_price || 0), 0);
    const totalPurchaseValue = assets.reduce((sum, a) => sum + (a.purchase_price || 0), 0);
    const totalDepreciation = totalPurchaseValue - totalValue;

    // Asset categories
    const byCategory = assets.reduce((acc, a) => {
      const cat = a.category || a.asset_type || 'Other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    // Asset status
    const byStatus = assets.reduce((acc, a) => {
      const status = a.status || 'active';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Assets needing maintenance
    const needsMaintenance = assets.filter(a => {
      if (!a.next_maintenance_date) return false;
      const maintDate = new Date(a.next_maintenance_date);
      const today = new Date();
      return maintDate <= today;
    });

    return {
      content: `**Asset Management - Your Data:**

**Overview:**
- Total Assets: ${assets.length}
- Purchase Value: ${fmtCurrency(totalPurchaseValue)}
- Current Value: ${fmtCurrency(totalValue)}
- Total Depreciation: ${fmtCurrency(totalDepreciation)}

**Assets by Category:**
${Object.entries(byCategory).map(([cat, count]) => `- ${cat}: ${count}`).join('\n')}

**Assets by Status:**
${Object.entries(byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

${needsMaintenance.length > 0 ? `**⚠️ Maintenance Due:**
${needsMaintenance.slice(0, 5).map(a => `- ${a.name || a.asset_name}: Overdue`).join('\n')}` : '**✓ All maintenance is up to date!**'}

**Recommendations:**
${needsMaintenance.length > 0 ? `- Schedule maintenance for ${needsMaintenance.length} assets` : '- Continue regular maintenance schedule'}
- Review depreciation schedules for accuracy
- Consider disposal of fully depreciated assets`,
      tool_calls: [{ name: 'analyze_assets', status: 'completed' }]
    };
  }

  // Projects queries
  if (lowerMessage.includes('project') || lowerMessage.includes('task') || lowerMessage.includes('milestone')) {
    const { projects = [] } = userData;

    if (projects.length === 0) {
      return {
        content: `**Project Management:**

You don't have any projects recorded yet.

**To get started:**
1. Go to **Projects** module
2. Create your first project
3. Add tasks and milestones

Once you have project data, I can help you with:
- Project progress tracking
- Resource allocation analysis
- Timeline and deadline monitoring
- Budget vs actual analysis`,
        tool_calls: [{ name: 'analyze_projects', status: 'completed' }]
      };
    }

    const byStatus = projects.reduce((acc, p) => {
      const status = p.status || 'active';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.spent || p.actual_cost || 0), 0);

    // Overdue projects
    const overdue = projects.filter(p => {
      if (!p.end_date || p.status === 'completed') return false;
      return new Date(p.end_date) < new Date();
    });

    // At risk (over budget)
    const overBudget = projects.filter(p => (p.spent || p.actual_cost || 0) > (p.budget || 0));

    return {
      content: `**Project Management - Your Data:**

**Overview:**
- Total Projects: ${projects.length}
- Total Budget: ${fmtCurrency(totalBudget)}
- Total Spent: ${fmtCurrency(totalSpent)}
- Budget Utilization: ${totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%

**Projects by Status:**
${Object.entries(byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

${overdue.length > 0 ? `**⚠️ Overdue Projects:**
${overdue.slice(0, 5).map(p => `- ${p.name || p.project_name}`).join('\n')}` : '**✓ All projects are on schedule!**'}

${overBudget.length > 0 ? `**💰 Over Budget:**
${overBudget.slice(0, 5).map(p => `- ${p.name || p.project_name}`).join('\n')}` : '**✓ All projects within budget!**'}

**Recommendations:**
${overdue.length > 0 ? `- Address ${overdue.length} overdue projects` : '- Maintain current project timelines'}
${overBudget.length > 0 ? `- Review spending on ${overBudget.length} over-budget projects` : ''}
- Regular milestone reviews recommended`,
      tool_calls: [{ name: 'analyze_projects', status: 'completed' }]
    };
  }

  // Contracts queries
  if (lowerMessage.includes('contract') || lowerMessage.includes('agreement') || lowerMessage.includes('renewal')) {
    const { contracts = [] } = userData;

    if (contracts.length === 0) {
      return {
        content: `**Contract Management:**

You don't have any contracts recorded yet.

**To get started:**
1. Go to **Contracts** module
2. Add your contracts (customer, vendor, employee, etc.)
3. Set expiry dates for renewal tracking

Once you have contract data, I can help you with:
- Contract expiry alerts
- Renewal recommendations
- Contract value analysis
- Compliance tracking`,
        tool_calls: [{ name: 'analyze_contracts', status: 'completed' }]
      };
    }

    const totalValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    const activeContracts = contracts.filter(c => c.status === 'active');

    // Expiring soon (within 30 days)
    const expiringSoon = contracts.filter(c => {
      if (!c.end_date || c.status !== 'active') return false;
      const endDate = new Date(c.end_date);
      const today = new Date();
      const daysUntil = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    });

    // By type
    const byType = contracts.reduce((acc, c) => {
      const type = c.contract_type || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // By status
    const byStatus = contracts.reduce((acc, c) => {
      const status = c.status || 'draft';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      content: `**Contract Management - Your Data:**

**Overview:**
- Total Contracts: ${contracts.length}
- Active Contracts: ${activeContracts.length}
- Total Contract Value: ${fmtCurrency(totalValue)}

**Contracts by Type:**
${Object.entries(byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

**Contracts by Status:**
${Object.entries(byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

${expiringSoon.length > 0 ? `**⚠️ Expiring Within 30 Days:**
${expiringSoon.map(c => `- ${c.contract_name || c.contract_number}: ${c.end_date}`).join('\n')}` : '**✓ No contracts expiring soon!**'}

**Recommendations:**
${expiringSoon.length > 0 ? `- Review ${expiringSoon.length} contracts for renewal` : '- All contracts are up to date'}
- Set up auto-renewal where applicable
- Regular compliance reviews recommended`,
      tool_calls: [{ name: 'analyze_contracts', status: 'completed' }]
    };
  }

  // Workflow/Automation queries
  if (lowerMessage.includes('workflow') || lowerMessage.includes('automat') || lowerMessage.includes('process')) {
    return {
      content: `**Workflow Automation Suggestions:**

Based on your current processes, I can help automate:

**High-Impact Automations:**
1. **Invoice Processing** - Automatically generate and send invoices when orders are fulfilled
2. **Low Stock Alerts** - Trigger reorder notifications when inventory hits threshold
3. **Payment Reminders** - Send automated follow-ups for overdue invoices

**Quick Wins:**
- Auto-assign leads based on territory rules
- Scheduled report generation and email delivery
- Customer welcome email sequences

**Implementation:**
I can create any of these workflows for you. Just say:
- "Create invoice automation workflow"
- "Set up low stock alerts"
- "Build payment reminder sequence"

Which automation would you like to implement first?`,
      tool_calls: []
    };
  }

  // Report/Export queries
  if (lowerMessage.includes('report') || lowerMessage.includes('export') || lowerMessage.includes('generate')) {
    return {
      content: `**Report Generation:**

I can generate the following reports for you:

**Financial Reports:**
- Balance Sheet
- Income Statement
- Cash Flow Statement
- Accounts Receivable Aging
- Accounts Payable Aging

**Sales Reports:**
- Sales by Period
- Sales by Product
- Sales by Customer
- Pipeline Analysis

**Inventory Reports:**
- Stock Valuation
- Movement History
- Reorder Recommendations

**HR Reports:**
- Headcount Summary
- Payroll Report
- Leave Balances

To generate a report, specify:
- Report type
- Date range
- Format (PDF, Excel, or on-screen)

Example: "Generate sales report for last quarter as PDF"`,
      tool_calls: []
    };
  }

  // Check if user just said greeting (hello, salom, etc.)
  const greetingPatterns = ['hello', 'hi', 'hey', 'salom', 'assalomu', 'привет', 'здравствуй'];
  const isGreeting = greetingPatterns.some(p => lowerMessage.includes(p)) && lowerMessage.length < 30;

  if (isGreeting) {
    return {
      content: t('greeting'),
      tool_calls: []
    };
  }

  // Default response - show data summary
  const { salesOrders = [], inventory = [], employees = [], customers = [], expenses = [], assets = [], projects = [], contracts = [] } = userData;

  const hasData = salesOrders.length > 0 || inventory.length > 0 || employees.length > 0 || customers.length > 0;

  if (hasData) {
    const totalRevenue = salesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const lowStockItems = inventory.filter(i => (i.current_stock || 0) <= (i.reorder_level || 10));

    return {
      content: `${t('imYourCopilot').split('.')[0]}.

**${t('businessAtGlance')}**
${salesOrders.length > 0 ? `- ${t('salesOrdersCount')}: ${salesOrders.length} (${t('totalRevenue')}: ${fmtCurrency(totalRevenue)})` : `- ${t('salesOrdersCount')}: ${t('noOrdersYet')}`}
${inventory.length > 0 ? `- ${t('inventoryItemsCount')}: ${inventory.length}${lowStockItems.length > 0 ? ` (⚠️ ${lowStockItems.length} ${t('lowStockCount')})` : ''}` : `- ${t('inventoryItemsCount')}: ${t('noItemsYet')}`}
${customers.length > 0 ? `- ${t('customersCount')}: ${customers.length}` : `- ${t('customersCount')}: ${t('noneYet')}`}
${employees.length > 0 ? `- ${t('employeesCount')}: ${employees.length}` : `- ${t('employeesCount')}: ${t('noneYet')}`}
${assets.length > 0 ? `- ${t('assetsCount')}: ${assets.length}` : ''}
${projects.length > 0 ? `- ${t('projectsCount')}: ${projects.length}` : ''}
${contracts.length > 0 ? `- ${t('contractsCount')}: ${contracts.length}` : ''}

**${t('whatToAnalyze')}**
- "${t('showSalesPerformance')}"
- "${t('whatInventoryRestock')}"
- "${t('analyzeFinancialHealth')}"
- "${t('showCustomerInsights')}"
- "${t('hrPayrollSummary')}"`,
      tool_calls: []
    };
  }

  return {
    content: `${t('imYourCopilot')}

**📊 ${t('analyticsInsights')}**
- ${t('salesPerformanceAnalysis')}
- ${t('inventoryOptimization')}
- ${t('financialHealthMonitoring')}
- ${t('customerBehaviorInsights')}

**🤖 ${t('automation')}**
- ${t('createManageWorkflows')}
- ${t('setupAlertsNotifications')}
- ${t('automateRepetitiveTasks')}

**📋 ${t('reports')}**
- ${t('generateFinancialStatements')}
- ${t('createSalesReports')}
- ${t('exportDataFormats')}

**💡 ${t('recommendationsSection')}**
- ${t('identifyOpportunities')}
- ${t('flagRisksIssues')}
- ${t('suggestImprovements')}

**${t('gettingStarted')}**
${t('noDataYet')}
1. ${t('customersInModule')}
2. ${t('inventoryItemsInModule')}
3. ${t('salesOrdersToTrack')}

${t('onceDataPersonalized')}`,
    tool_calls: []
  };
};

export function AIProvider({ children }) {
  const { isBackendConnected, isOwner, isSiteAdmin, user } = useAuth();
  const { activeCompany, addCompany, companies, getCompanyCount } = useCompany();
  const { canMakeAIRequest, incrementAIUsage, getRemainingAIRequests, getAIUsagePercentage, getPlanLimits, subscription, canAddCompany } = useSubscription();
  const { formatCurrency } = useCurrencyFormatter();

  // Get user's language preference
  let currentLanguage = 'en';
  try {
    const langContext = useLanguage();
    currentLanguage = langContext?.language || 'en';
  } catch (e) {
    // LanguageContext not available, use default
  }

  // Get context methods for AI actions
  let inventoryContext = null;
  let customersContext = null;
  let financialsContext = null;

  try {
    inventoryContext = useInventory();
  } catch (e) {
    // Context not available
  }

  try {
    customersContext = useCustomers();
  } catch (e) {
    // Context not available
  }

  try {
    financialsContext = useFinancials();
  } catch (e) {
    // Context not available
  }

  let modulesContext = null;
  try {
    modulesContext = useModules();
  } catch (e) {
    // Context not available
  }

  let vendorsContext = null;
  try {
    vendorsContext = useVendors();
  } catch (e) {
    // Context not available
  }

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState([]);
  const [aiLimitReached, setAiLimitReached] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // For confirmation flow
  const messageIdCounter = useRef(0);

  // Execute AI action with permission checks
  const executeAction = useCallback(async (actionIntent) => {
    const { action, params } = actionIntent;

    // Check user permissions
    const canExecute = isOwner() || isSiteAdmin();
    if (!canExecute) {
      return {
        success: false,
        error: 'permission_denied',
        message: 'Sizda bu amalni bajarish uchun ruxsat yo\'q. Faqat egasi yoki administrator bu amalni bajara oladi.'
      };
    }

    switch (action) {
      case AI_ACTIONS.CREATE_COMPANY: {
        // Check subscription limit
        if (!canAddCompany()) {
          const limits = getPlanLimits();
          return {
            success: false,
            error: 'limit_reached',
            message: `Kompaniya limiti (${limits.maxCompanies}) ga yetildi. Tarifni yangilang.`
          };
        }

        if (!params.company_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Kompaniya nomini kiriting. Masalan: "Yangi kompaniya yarating ABC Corp deb nomlang"'
          };
        }

        const companyData = {
          company_code: params.company_name.replace(/\s+/g, '_').toUpperCase().slice(0, 10),
          company_name: params.company_name,
          country: 'Uzbekistan',
          currency: 'UZS',
          accounting_standard: 'LOCAL_GAAP'
        };

        const result = addCompany(companyData);
        if (result.success) {
          return {
            success: true,
            message: `✅ **Kompaniya yaratildi!**\n\n**Nomi:** ${params.company_name}\n**Kodi:** ${companyData.company_code}\n\nKompaniyani tanlash uchun yuqoridagi kompaniya almashtirgichni ishlating.`,
            data: result.company
          };
        }
        return {
          success: false,
          error: result.error,
          message: result.message || 'Kompaniya yaratishda xatolik yuz berdi'
        };
      }

      case AI_ACTIONS.CREATE_INVENTORY_ITEM: {
        if (!inventoryContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Inventar moduli mavjud emas. Iltimos, sahifani yangilang.'
          };
        }

        if (!params.name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Mahsulot nomini kiriting. Masalan: "Mahsulot qo\'shing laptop deb nomlang, 100 dona, $500"'
          };
        }

        const itemData = {
          name: params.name,
          item_name: params.name,
          sku: `SKU-${Date.now()}`,
          current_stock: params.quantity || 0,
          unit_cost: params.price || 0,
          selling_price: params.price ? params.price * 1.3 : 0, // 30% markup
          reorder_level: 10,
          category: 'General',
          status: 'active'
        };

        try {
          const newItem = await inventoryContext.createItem(itemData);
          return {
            success: true,
            message: `✅ **Mahsulot qo'shildi!**\n\n**Nomi:** ${params.name}\n**Miqdori:** ${params.quantity || 0} dona\n**Narxi:** ${formatCurrency(params.price || 0)}\n\nInventar bo'limida ko'rishingiz mumkin.`,
            data: newItem
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Mahsulot qo'shishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.ADJUST_STOCK: {
        if (!inventoryContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Inventar moduli mavjud emas.'
          };
        }

        if (!params.product_name || !params.quantity) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Mahsulot nomi va miqdorini kiriting. Masalan: "Laptop uchun 50 dona stock qo\'shing"'
          };
        }

        // Find the product
        const items = inventoryContext.items || [];
        const item = items.find(i =>
          (i.name || i.item_name || '').toLowerCase().includes(params.product_name.toLowerCase())
        );

        if (!item) {
          return {
            success: false,
            error: 'not_found',
            message: `"${params.product_name}" mahsuloti topilmadi. Mavjud mahsulotlar: ${items.slice(0, 5).map(i => i.name || i.item_name).join(', ')}`
          };
        }

        const newStock = (item.current_stock || 0) + params.quantity;
        if (newStock < 0) {
          return {
            success: false,
            error: 'insufficient_stock',
            message: `Yetarli zaxira yo'q. Joriy zaxira: ${item.current_stock}`
          };
        }

        try {
          await inventoryContext.updateItem(item.id, { current_stock: newStock });
          const action = params.quantity > 0 ? 'qo\'shildi' : 'ayirildi';
          return {
            success: true,
            message: `✅ **Zaxira yangilandi!**\n\n**Mahsulot:** ${item.name || item.item_name}\n**O'zgarish:** ${params.quantity > 0 ? '+' : ''}${params.quantity} dona\n**Yangi zaxira:** ${newStock} dona`,
            data: { item_id: item.id, new_stock: newStock }
          };
        } catch (err) {
          return {
            success: false,
            error: 'update_failed',
            message: `Zaxirani yangilashda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_CUSTOMER: {
        if (!customersContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Mijozlar moduli mavjud emas.'
          };
        }

        if (!params.name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Mijoz nomini kiriting. Masalan: "Yangi mijoz qo\'shing Ali Valiyev, email: ali@example.com"'
          };
        }

        const customerData = {
          name: params.name,
          customer_name: params.name,
          email: params.email || '',
          phone: params.phone || '',
          status: 'active',
          customer_type: 'individual'
        };

        try {
          const newCustomer = await customersContext.createCustomer(customerData);
          return {
            success: true,
            message: `✅ **Mijoz qo'shildi!**\n\n**Ismi:** ${params.name}${params.email ? `\n**Email:** ${params.email}` : ''}${params.phone ? `\n**Telefon:** ${params.phone}` : ''}\n\nMijozlar bo'limida ko'rishingiz mumkin.`,
            data: newCustomer
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Mijoz qo'shishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_SALES_ORDER: {
        if (!modulesContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Savdo moduli mavjud emas.'
          };
        }

        if (!params.customer_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Mijoz nomini kiriting. Masalan: "Tech Solutions uchun $5000 lik buyurtma yarating"'
          };
        }

        const orderData = {
          customer_name: params.customer_name,
          order_date: new Date().toISOString().split('T')[0],
          delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: params.total_amount || 0,
          tax_amount: (params.total_amount || 0) * 0.08,
          shipping_cost: 0,
          total_amount: (params.total_amount || 0) * 1.08,
          status: 'draft',
          payment_status: 'unpaid'
        };

        try {
          const newOrder = await modulesContext.createSalesOrder(orderData);
          return {
            success: true,
            message: `✅ **Buyurtma yaratildi!**\n\n**Buyurtma raqami:** ${newOrder.order_number}\n**Mijoz:** ${params.customer_name}\n**Summa:** ${formatCurrency(params.total_amount || 0)}\n\nSavdo buyurtmalari bo'limida ko'rishingiz mumkin.`,
            data: newOrder
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Buyurtma yaratishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_PURCHASE_ORDER: {
        if (!modulesContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Xarid moduli mavjud emas.'
          };
        }

        if (!params.vendor_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Yetkazuvchi nomini kiriting. Masalan: "TechSupply dan $10000 lik xarid buyurtmasi yarating"'
          };
        }

        const poData = {
          vendor_name: params.vendor_name,
          order_date: new Date().toISOString().split('T')[0],
          expected_delivery_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          total_amount: params.total_amount || 0,
          status: 'draft',
          payment_terms: 'net_30'
        };

        try {
          const newPO = await modulesContext.createPurchaseOrder(poData);
          return {
            success: true,
            message: `✅ **Xarid buyurtmasi yaratildi!**\n\n**Buyurtma raqami:** ${newPO.po_number}\n**Yetkazuvchi:** ${params.vendor_name}\n**Summa:** ${formatCurrency(params.total_amount || 0)}\n\nXarid buyurtmalari bo'limida ko'rishingiz mumkin.`,
            data: newPO
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Xarid buyurtmasi yaratishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_EMPLOYEE: {
        if (!modulesContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'HR moduli mavjud emas.'
          };
        }

        if (!params.full_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Xodim ismini kiriting. Masalan: "Ali Valiyev ismli xodim qo\'shing, lavozimi: dasturchi, maosh: $2000"'
          };
        }

        const empData = {
          full_name: params.full_name,
          job_title: params.job_title || 'Xodim',
          department: params.department || 'general',
          salary: params.salary || 0,
          hire_date: new Date().toISOString().split('T')[0],
          status: 'active',
          performance_score: 3.5,
          turnover_risk: 'low'
        };

        try {
          const newEmp = modulesContext.createEmployee(empData);
          return {
            success: true,
            message: `✅ **Xodim qo'shildi!**\n\n**Ismi:** ${params.full_name}\n**Lavozimi:** ${params.job_title || 'Xodim'}${params.department ? `\n**Bo'lim:** ${params.department}` : ''}${params.salary ? `\n**Maosh:** ${formatCurrency(params.salary)}` : ''}\n\nHR bo'limida ko'rishingiz mumkin.`,
            data: newEmp
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Xodim qo'shishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_EXPENSE: {
        if (!modulesContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Xarajatlar moduli mavjud emas.'
          };
        }

        if (!params.amount) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Xarajat summasini kiriting. Masalan: "$500 xarajat qo\'shing, kategoriya: transport"'
          };
        }

        const expData = {
          expense_date: new Date().toISOString().split('T')[0],
          claim_date: new Date().toISOString().split('T')[0],
          category: params.category || 'general',
          amount: params.amount,
          description: params.description || `${params.category || 'Umumiy'} xarajati`,
          status: 'submitted'
        };

        try {
          const newExp = modulesContext.createExpense(expData);
          return {
            success: true,
            message: `✅ **Xarajat qo'shildi!**\n\n**Summa:** ${formatCurrency(params.amount)}\n**Kategoriya:** ${params.category || 'Umumiy'}${params.description ? `\n**Izoh:** ${params.description}` : ''}\n\nXarajatlar bo'limida ko'rishingiz mumkin.`,
            data: newExp
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Xarajat qo'shishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_PROJECT: {
        if (!modulesContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Loyihalar moduli mavjud emas.'
          };
        }

        if (!params.project_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Loyiha nomini kiriting. Masalan: "Veb-sayt loyihasi yarating, mijoz: Tech Solutions, byudjet: $50000"'
          };
        }

        const projData = {
          project_name: params.project_name,
          client_name: params.client_name || '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          budget: params.budget || 0,
          actual_cost: 0,
          status: 'planning',
          progress_percentage: 0,
          priority: 'medium',
          billing_type: 'fixed_price'
        };

        try {
          const newProj = modulesContext.createProject(projData);
          return {
            success: true,
            message: `✅ **Loyiha yaratildi!**\n\n**Nomi:** ${params.project_name}${params.client_name ? `\n**Mijoz:** ${params.client_name}` : ''}${params.budget ? `\n**Byudjet:** ${formatCurrency(params.budget)}` : ''}\n\nLoyihalar bo'limida ko'rishingiz mumkin.`,
            data: newProj
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Loyiha yaratishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_CONTRACT: {
        if (!modulesContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Shartnomalar moduli mavjud emas.'
          };
        }

        if (!params.contract_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Shartnoma nomini kiriting. Masalan: "Texnik xizmat shartnomasi yarating, tomon: Tech Solutions, qiymat: $10000"'
          };
        }

        const contData = {
          contract_name: params.contract_name,
          contract_type: 'customer',
          party_name: params.party_name || '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          contract_value: params.contract_value || 0,
          billing_cycle: 'monthly',
          auto_renew: false,
          status: 'draft'
        };

        try {
          const newCont = modulesContext.createContract(contData);
          return {
            success: true,
            message: `✅ **Shartnoma yaratildi!**\n\n**Nomi:** ${params.contract_name}${params.party_name ? `\n**Tomon:** ${params.party_name}` : ''}${params.contract_value ? `\n**Qiymat:** ${formatCurrency(params.contract_value)}` : ''}\n\nShartnomalar bo'limida ko'rishingiz mumkin.`,
            data: newCont
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Shartnoma yaratishda xatolik: ${err.message}`
          };
        }
      }

      case AI_ACTIONS.CREATE_VENDOR: {
        if (!vendorsContext) {
          return {
            success: false,
            error: 'context_unavailable',
            message: 'Yetkazuvchilar moduli mavjud emas.'
          };
        }

        if (!params.vendor_name) {
          return {
            success: false,
            error: 'missing_params',
            message: 'Yetkazuvchi nomini kiriting. Masalan: "Yangi yetkazuvchi qo\'shing Office Depot, email: vendor@office.com"'
          };
        }

        const vendorData = {
          vendor_name: params.vendor_name,
          contact_name: params.contact_name || '',
          email: params.email || '',
          phone: params.phone || '',
          status: 'active'
        };

        try {
          const newVendor = vendorsContext.createVendor(vendorData);
          return {
            success: true,
            message: `✅ **Yetkazuvchi qo'shildi!**\n\n**Nomi:** ${params.vendor_name}\n**Kodi:** ${newVendor.vendor_code}${params.email ? `\n**Email:** ${params.email}` : ''}${params.phone ? `\n**Telefon:** ${params.phone}` : ''}\n\nYetkazuvchilar bo'limida ko'rishingiz mumkin.`,
            data: newVendor
          };
        } catch (err) {
          return {
            success: false,
            error: 'create_failed',
            message: `Yetkazuvchi qo'shishda xatolik: ${err.message}`
          };
        }
      }

      default:
        return {
          success: false,
          error: 'unknown_action',
          message: 'Noma\'lum amal'
        };
    }
  }, [isOwner, isSiteAdmin, canAddCompany, getPlanLimits, addCompany, inventoryContext, customersContext, modulesContext, vendorsContext, formatCurrency]);

  // Confirm and execute pending action
  const confirmAction = useCallback(async () => {
    if (!pendingAction) return null;

    const result = await executeAction(pendingAction);
    setPendingAction(null);
    return result;
  }, [pendingAction, executeAction]);

  // Cancel pending action
  const cancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Load capabilities on mount
  useEffect(() => {
    const loadCapabilities = async () => {
      if (isBackendConnected) {
        try {
          const caps = await aiService.getCapabilities();
          setCapabilities(caps);
        } catch (error) {
          console.error('Error loading AI capabilities:', error);
          // Use default capabilities
          setCapabilities(getDefaultCapabilities());
        }
      } else {
        setCapabilities(getDefaultCapabilities());
      }
    };
    loadCapabilities();
  }, [isBackendConnected]);

  const getDefaultCapabilities = () => [
    {
      name: 'Sales Analysis',
      description: 'Analyze sales data, trends, and provide insights',
      category: 'analysis',
      examples: ['Analyze last quarter sales', 'Top selling products', 'Sales trends by region']
    },
    {
      name: 'Inventory Optimization',
      description: 'Optimize inventory levels and predict stock needs',
      category: 'forecasting',
      examples: ['Products needing reorder', 'Forecast inventory', 'Slow-moving items']
    },
    {
      name: 'Financial Insights',
      description: 'Analyze financial data and provide recommendations',
      category: 'analysis',
      examples: ['Cash flow status', 'Receivables aging', 'Revenue vs expenses']
    },
    {
      name: 'Process Automation',
      description: 'Suggest and help automate business processes',
      category: 'automation',
      examples: ['Automate invoicing', 'Workflow suggestions', 'Alert setup']
    }
  ];

  // Create a new conversation
  const createConversation = useCallback(async (metadata = {}) => {
    const conversationId = `conv_${Date.now()}`;

    if (isBackendConnected) {
      try {
        const conv = await aiService.createConversation(metadata);
        setActiveConversation(conv);
        setMessages(conv.messages || []);
        return conv;
      } catch (error) {
        console.error('Error creating conversation:', error);
      }
    }

    // Fallback to local conversation
    const localConv = {
      id: conversationId,
      title: metadata.name || 'New Conversation',
      messages: [],
      created_at: new Date().toISOString()
    };
    setActiveConversation(localConv);
    setMessages([]);
    setConversations(prev => [localConv, ...prev]);
    return localConv;
  }, [isBackendConnected]);

  // Send a message
  const sendMessage = useCallback(async (content, context = {}) => {
    if (!content.trim()) return;

    // Check AI request limit
    if (!canMakeAIRequest()) {
      setAiLimitReached(true);
      const limits = getPlanLimits();
      const limitMessage = {
        id: `msg_${++messageIdCounter.current}`,
        role: 'assistant',
        content: `⚠️ **AI So'rovlar Limiti Tugadi**

Siz bu oydagi AI so'rovlar limitiga yetdingiz (${limits.aiRequestsPerMonth} ta so'rov).

**Variantlar:**
1. Kelasi oy boshida limit qayta tiklanadi
2. Obunangizni yuqori darajaga oshiring:
   - **Professional** - 2,500 AI so'rov/oy
   - **Enterprise** - Cheksiz AI so'rovlar

Obunani o'zgartirish uchun **Sozlamalar** → **Obuna** bo'limiga o'ting.`,
        isLimitWarning: true,
        created_at: new Date().toISOString()
      };

      // Add user message first
      const userMessage = {
        id: `msg_${++messageIdCounter.current}`,
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage, limitMessage]);
      return limitMessage;
    }

    setIsLoading(true);
    setAiLimitReached(false);

    // Add user message immediately
    const userMessage = {
      id: `msg_${++messageIdCounter.current}`,
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Increment AI usage counter
      incrementAIUsage();

      // Check for action intent in the message
      const actionIntent = parseActionIntent(content);

      if (actionIntent) {
        // Execute the action directly
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX

        const actionResult = await executeAction(actionIntent);

        const assistantMessage = {
          id: `msg_${++messageIdCounter.current}`,
          role: 'assistant',
          content: actionResult.message,
          isActionResult: true,
          actionSuccess: actionResult.success,
          actionData: actionResult.data,
          tool_calls: actionResult.success ? [{ name: actionIntent.action, status: 'completed' }] : [],
          created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return assistantMessage;
      }

      // Try backend AI service first
      if (isBackendConnected) {
        try {
          // Enhance context with business data for better AI responses
          const enhancedContext = {
            ...context,
            company_id: activeCompany?.id,
            user_language: currentLanguage,
            business_data: getUserData(activeCompany?.id) // Send actual business data to AI
          };

          // Call backend AI without requiring conversation ID
          const response = await aiService.chat(content, activeConversation?.id, enhancedContext);
          const assistantMessage = {
            id: `msg_${++messageIdCounter.current}`,
            role: 'assistant',
            content: response.message?.content || response.content || 'I apologize, but I could not process your request.',
            tool_calls: response.tool_calls || [],
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
          return assistantMessage;
        } catch (backendError) {
          console.warn('Backend AI error, using fallback:', backendError);
          // Fall through to demo response only if backend fails
        }
      }

      // Generate demo response with slight delay for realism (only as fallback)
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

      const demoResponse = generateDemoResponse(content, context, activeCompany?.id, currentLanguage, formatCurrency);
      const assistantMessage = {
        id: `msg_${++messageIdCounter.current}`,
        role: 'assistant',
        content: demoResponse.content,
        tool_calls: demoResponse.tool_calls,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      return assistantMessage;

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: `msg_${++messageIdCounter.current}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      return errorMessage;
    }
  }, [isBackendConnected, activeConversation, canMakeAIRequest, incrementAIUsage, getPlanLimits, executeAction, activeCompany, formatCurrency]);

  // Clear current conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setActiveConversation(null);
  }, []);

  // List conversations
  const listConversations = useCallback(async () => {
    if (isBackendConnected) {
      try {
        const convs = await aiService.listConversations();
        setConversations(convs);
        return convs;
      } catch (error) {
        console.error('Error listing conversations:', error);
      }
    }
    return conversations;
  }, [isBackendConnected, conversations]);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId) => {
    if (isBackendConnected) {
      try {
        await aiService.deleteConversation(conversationId);
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (activeConversation?.id === conversationId) {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [isBackendConnected, activeConversation]);

  const canExecuteActions = isOwner() || isSiteAdmin();
  const aiUsageRemaining = getRemainingAIRequests();
  const aiUsagePercentage = getAIUsagePercentage();
  const aiRequestsLimit = getPlanLimits().aiRequestsPerMonth;
  const aiPlan = subscription?.plan || 'free_trial';

  const value = useMemo(() => ({
    // State
    conversations,
    activeConversation,
    messages,
    isLoading,
    capabilities,
    isConnected: isBackendConnected,
    aiLimitReached,
    pendingAction,

    // AI Usage Info
    aiUsage: {
      remaining: aiUsageRemaining,
      percentage: aiUsagePercentage,
      limit: aiRequestsLimit,
      plan: aiPlan
    },

    // Available AI Actions
    availableActions: AI_ACTIONS,

    // Actions
    createConversation,
    sendMessage,
    clearConversation,
    listConversations,
    deleteConversation,
    setActiveConversation,

    // AI Action Execution
    executeAction,
    confirmAction,
    cancelAction,
    canExecuteActions,
  }), [conversations, activeConversation, messages, isLoading, capabilities, isBackendConnected, aiLimitReached, pendingAction, aiUsageRemaining, aiUsagePercentage, aiRequestsLimit, aiPlan, createConversation, sendMessage, clearConversation, listConversations, deleteConversation, setActiveConversation, executeAction, confirmAction, cancelAction, canExecuteActions]);

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

export default AIContext;
