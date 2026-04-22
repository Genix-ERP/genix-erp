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
    // Customer
    customerAnalytics: 'Customer Analytics',
    noCustomers: "You don't have any customers recorded yet.",
    goToCustomers: 'Go to **Customers** module',
    addCustomersContacts: 'Add your customers and contacts',
    createSalesForRevenue: 'Create sales orders to track customer revenue',
    onceCustomerData: 'Once you have customer data, I can help you with:',
    customerRevenueAnalysis: 'Customer revenue analysis',
    topCustomerIdentification: 'Top customer identification',
    customerSegmentation: 'Customer segmentation',
    engagementTracking: 'Engagement tracking',
    customerOverview: 'Overview:',
    totalCustomers: 'Total Customers',
    customersWithOrders: 'Customers with Orders',
    customerSegmentsByRevenue: 'Customer Segments by Revenue:',
    enterprise: 'Enterprise',
    midMarket: 'Mid-Market',
    smb: 'SMB',
    accounts: 'accounts',
    customersWithUnpaid: 'Customers with Unpaid Orders:',
    allCustomersPaid: 'All customers have paid their orders!',
    nurtureTopCustomer: 'Nurture relationship with',
    topCustomerParen: '(top customer)',
    followUpWithCustomers: 'Follow up with',
    customersOnPayments: 'customers on payments',
    considerLoyalty: 'Consider loyalty programs for repeat customers',
    focusOnAcquiring: 'Focus on acquiring new customers',
    // HR
    hrAnalytics: 'HR Analytics',
    noEmployees: "You don't have any employees recorded yet.",
    goToHR: 'Go to **HR** module',
    addEmployees: 'Add your employees',
    setupPayrollRecords: 'Set up payroll records',
    onceEmployeeData: 'Once you have employee data, I can help you with:',
    workforceOverviewItem: 'Workforce overview',
    departmentDistributionItem: 'Department distribution',
    payrollSummariesItem: 'Payroll summaries',
    compensationAnalysisItem: 'Compensation analysis',
    workforceOverview: 'Workforce Overview:',
    totalEmployees: 'Total Employees',
    activeEmployees: 'Active Employees',
    averageSalary: 'Average Salary',
    departmentDistribution: 'Department Distribution:',
    employeesWord: 'employees',
    payrollSummary: 'Payroll Summary:',
    totalPayrollRecords: 'Total Payroll Records',
    processedPayrolls: 'Processed Payrolls',
    pendingPayrolls: 'Pending Payrolls',
    totalPayrollAmount: 'Total Payroll Amount',
    processPending: 'Process pending payroll records:',
    allPayrollProcessed: 'All payroll records are processed!',
    organizeIntoDepts: 'Consider organizing employees into departments',
    reviewCompensation: 'Review compensation benchmarks for retention',
    // Assets
    assetManagement: 'Asset Management',
    noAssets: "You don't have any assets recorded yet.",
    goToAssets: 'Go to **Assets** module',
    addCompanyAssets: 'Add your company assets (equipment, vehicles, etc.)',
    trackDepreciation: 'Track depreciation and maintenance',
    onceAssetData: 'Once you have asset data, I can help you with:',
    assetValuation: 'Asset valuation and depreciation tracking',
    maintenanceSchedules: 'Maintenance schedules',
    assetLifecycle: 'Asset lifecycle analysis',
    disposalRecommendations: 'Disposal recommendations',
    totalAssets: 'Total Assets',
    purchaseValue: 'Purchase Value',
    currentValue: 'Current Value',
    totalDepreciation: 'Total Depreciation',
    assetsByCategory: 'Assets by Category:',
    assetsByStatus: 'Assets by Status:',
    maintenanceDue: 'Maintenance Due:',
    overdue: 'Overdue',
    allMaintenanceUpToDate: 'All maintenance is up to date!',
    scheduleMaintenance: 'Schedule maintenance for',
    continueMaintenance: 'Continue regular maintenance schedule',
    reviewDepreciation: 'Review depreciation schedules for accuracy',
    considerDisposal: 'Consider disposal of fully depreciated assets',
    // Projects
    projectManagement: 'Project Management',
    noProjects: "You don't have any projects recorded yet.",
    goToProjects: 'Go to **Projects** module',
    createFirstProject: 'Create your first project',
    addTasksMilestones: 'Add tasks and milestones',
    onceProjectData: 'Once you have project data, I can help you with:',
    projectProgress: 'Project progress tracking',
    resourceAllocation: 'Resource allocation analysis',
    timelineMonitoring: 'Timeline and deadline monitoring',
    budgetAnalysis: 'Budget vs actual analysis',
    totalProjects: 'Total Projects',
    totalBudget: 'Total Budget',
    totalSpent: 'Total Spent',
    budgetUtilization: 'Budget Utilization',
    projectsByStatus: 'Projects by Status:',
    overdueProjects: 'Overdue Projects:',
    allOnSchedule: 'All projects are on schedule!',
    overBudget: 'Over Budget:',
    allWithinBudget: 'All projects within budget!',
    addressOverdue: 'Address overdue projects:',
    maintainTimelines: 'Maintain current project timelines',
    reviewOverBudget: 'Review spending on over-budget projects:',
    milestoneReviews: 'Regular milestone reviews recommended',
    // Contracts
    contractManagement: 'Contract Management',
    noContracts: "You don't have any contracts recorded yet.",
    goToContracts: 'Go to **Contracts** module',
    addContracts: 'Add your contracts (customer, vendor, employee, etc.)',
    setExpiryDates: 'Set expiry dates for renewal tracking',
    onceContractData: 'Once you have contract data, I can help you with:',
    contractExpiry: 'Contract expiry alerts',
    renewalRecs: 'Renewal recommendations',
    contractValueAnalysis: 'Contract value analysis',
    complianceTracking: 'Compliance tracking',
    totalContracts: 'Total Contracts',
    activeContracts: 'Active Contracts',
    totalContractValue: 'Total Contract Value',
    contractsByType: 'Contracts by Type:',
    contractsByStatus: 'Contracts by Status:',
    expiringSoon30: 'Expiring Within 30 Days:',
    noExpiringSoon: 'No contracts expiring soon!',
    reviewForRenewal: 'Review contracts for renewal:',
    allContractsUpToDate: 'All contracts are up to date',
    autoRenewal: 'Set up auto-renewal where applicable',
    complianceReviews: 'Regular compliance reviews recommended',
    // Workflow
    workflowSuggestions: 'Workflow Automation Suggestions',
    basedOnProcesses: 'Based on your current processes, I can help automate:',
    highImpact: 'High-Impact Automations:',
    invoiceProcessing: '**Invoice Processing** - Automatically generate and send invoices when orders are fulfilled',
    lowStockAlertsAuto: '**Low Stock Alerts** - Trigger reorder notifications when inventory hits threshold',
    paymentReminders: '**Payment Reminders** - Send automated follow-ups for overdue invoices',
    quickWins: 'Quick Wins:',
    autoAssignLeads: 'Auto-assign leads based on territory rules',
    scheduledReports: 'Scheduled report generation and email delivery',
    welcomeSequences: 'Customer welcome email sequences',
    implementation: 'Implementation:',
    canCreateWorkflows: 'I can create any of these workflows for you. Just say:',
    createInvoiceAutomation: '"Create invoice automation workflow"',
    setupLowStockCmd: '"Set up low stock alerts"',
    buildPaymentReminder: '"Build payment reminder sequence"',
    whichAutomation: 'Which automation would you like to implement first?',
    // Reports
    reportGeneration: 'Report Generation',
    canGenerateReports: 'I can generate the following reports for you:',
    financialReports: 'Financial Reports:',
    balanceSheet: 'Balance Sheet',
    incomeStatement: 'Income Statement',
    cashFlowStatement: 'Cash Flow Statement',
    arAging: 'Accounts Receivable Aging',
    apAging: 'Accounts Payable Aging',
    salesReports: 'Sales Reports:',
    salesByPeriod: 'Sales by Period',
    salesByProduct: 'Sales by Product',
    salesByCustomer: 'Sales by Customer',
    pipelineAnalysis: 'Pipeline Analysis',
    inventoryReports: 'Inventory Reports:',
    stockValuation: 'Stock Valuation',
    movementHistory: 'Movement History',
    reorderRecsReport: 'Reorder Recommendations',
    hrReports: 'HR Reports:',
    headcountSummary: 'Headcount Summary',
    payrollReport: 'Payroll Report',
    leaveBalances: 'Leave Balances',
    toGenerateReport: 'To generate a report, specify:',
    reportType: 'Report type',
    dateRange: 'Date range',
    reportFormat: 'Format (PDF, Excel, or on-screen)',
    reportExample: 'Example: "Generate sales report for last quarter as PDF"',
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
    // Customer
    customerAnalytics: 'Mijozlar Tahlili',
    noCustomers: "Sizda hali mijozlar yo'q.",
    goToCustomers: '**Mijozlar** moduliga o\'ting',
    addCustomersContacts: 'Mijozlar va kontaktlaringizni qo\'shing',
    createSalesForRevenue: 'Mijoz daromadini kuzatish uchun savdo buyurtmalari yarating',
    onceCustomerData: 'Mijozlar ma\'lumotingiz bo\'lganda, quyidagilar bilan yordam bera olaman:',
    customerRevenueAnalysis: 'Mijoz daromadi tahlili',
    topCustomerIdentification: 'Eng yaxshi mijozlarni aniqlash',
    customerSegmentation: 'Mijozlarni segmentlash',
    engagementTracking: 'Faollikni kuzatish',
    customerOverview: 'Umumiy Ko\'rinish:',
    totalCustomers: 'Jami Mijozlar',
    customersWithOrders: 'Buyurtmali Mijozlar',
    customerSegmentsByRevenue: 'Mijoz Segmentlari (Daromad bo\'yicha):',
    enterprise: 'Yirik',
    midMarket: 'O\'rta',
    smb: 'Kichik',
    accounts: 'ta hisob',
    customersWithUnpaid: 'To\'lovsiz Buyurtmali Mijozlar:',
    allCustomersPaid: 'Barcha mijozlar to\'lovlarini amalga oshirgan!',
    nurtureTopCustomer: 'Ushbu mijoz bilan munosabatni rivojlantiring:',
    topCustomerParen: '(eng yaxshi mijoz)',
    followUpWithCustomers: 'Kuzatib boring:',
    customersOnPayments: 'ta mijozning to\'lovlari',
    considerLoyalty: 'Doimiy mijozlar uchun sodiqlik dasturlarini ko\'rib chiqing',
    focusOnAcquiring: 'Yangi mijozlarni jalb qilishga e\'tibor bering',
    // HR
    hrAnalytics: 'HR Tahlili',
    noEmployees: "Sizda hali xodimlar yo'q.",
    goToHR: '**HR** moduliga o\'ting',
    addEmployees: 'Xodimlaringizni qo\'shing',
    setupPayrollRecords: 'Ish haqi yozuvlarini sozlang',
    onceEmployeeData: 'Xodimlar ma\'lumoti bo\'lganda, quyidagilar bilan yordam bera olaman:',
    workforceOverviewItem: 'Xodimlar umumiy ko\'rinishi',
    departmentDistributionItem: 'Bo\'limlar taqsimoti',
    payrollSummariesItem: 'Ish haqi xulosalari',
    compensationAnalysisItem: 'Kompensatsiya tahlili',
    workforceOverview: 'Xodimlar Umumiy Ko\'rinishi:',
    totalEmployees: 'Jami Xodimlar',
    activeEmployees: 'Faol Xodimlar',
    averageSalary: 'O\'rtacha Maosh',
    departmentDistribution: 'Bo\'limlar Taqsimoti:',
    employeesWord: 'xodim',
    payrollSummary: 'Ish Haqi Xulosasi:',
    totalPayrollRecords: 'Jami Ish Haqi Yozuvlari',
    processedPayrolls: 'Amalga Oshirilgan',
    pendingPayrolls: 'Kutilayotgan',
    totalPayrollAmount: 'Jami Ish Haqi Summasi',
    processPending: 'Kutilayotgan ish haqini amalga oshiring:',
    allPayrollProcessed: 'Barcha ish haqi yozuvlari amalga oshirilgan!',
    organizeIntoDepts: 'Xodimlarni bo\'limlarga taqsimlashni ko\'rib chiqing',
    reviewCompensation: 'Ushlab qolish uchun kompensatsiya benchmarkini ko\'rib chiqing',
    // Assets
    assetManagement: 'Aktivlar Boshqaruvi',
    noAssets: "Sizda hali aktivlar yo'q.",
    goToAssets: '**Aktivlar** moduliga o\'ting',
    addCompanyAssets: 'Kompaniya aktivlarini qo\'shing (uskunalar, transport va h.k.)',
    trackDepreciation: 'Amortizatsiya va texnik xizmatni kuzating',
    onceAssetData: 'Aktivlar ma\'lumoti bo\'lganda, quyidagilar bilan yordam bera olaman:',
    assetValuation: 'Aktivlar qiymati va amortizatsiyasini kuzatish',
    maintenanceSchedules: 'Texnik xizmat jadvallari',
    assetLifecycle: 'Aktiv hayot davri tahlili',
    disposalRecommendations: 'Hisobdan chiqarish tavsiyalari',
    totalAssets: 'Jami Aktivlar',
    purchaseValue: 'Sotib Olish Qiymati',
    currentValue: 'Joriy Qiymat',
    totalDepreciation: 'Jami Amortizatsiya',
    assetsByCategory: 'Kategoriya bo\'yicha Aktivlar:',
    assetsByStatus: 'Holat bo\'yicha Aktivlar:',
    maintenanceDue: 'Texnik Xizmat Kerak:',
    overdue: 'Muddati O\'tgan',
    allMaintenanceUpToDate: 'Barcha texnik xizmat yangilangan!',
    scheduleMaintenance: 'Texnik xizmat rejalashtiring:',
    continueMaintenance: 'Muntazam texnik xizmat jadvalini davom ettiring',
    reviewDepreciation: 'Aniqlik uchun amortizatsiya jadvallarini ko\'rib chiqing',
    considerDisposal: 'To\'liq amortizatsiya qilingan aktivlarni hisobdan chiqarishni ko\'rib chiqing',
    // Projects
    projectManagement: 'Loyihalar Boshqaruvi',
    noProjects: "Sizda hali loyihalar yo'q.",
    goToProjects: '**Loyihalar** moduliga o\'ting',
    createFirstProject: 'Birinchi loyihangizni yarating',
    addTasksMilestones: 'Vazifalar va bosqichlar qo\'shing',
    onceProjectData: 'Loyihalar ma\'lumoti bo\'lganda, quyidagilar bilan yordam bera olaman:',
    projectProgress: 'Loyiha jarayonini kuzatish',
    resourceAllocation: 'Resurslarni taqsimlash tahlili',
    timelineMonitoring: 'Muddat va vaqt nazorati',
    budgetAnalysis: 'Byudjet va haqiqiy tahlil',
    totalProjects: 'Jami Loyihalar',
    totalBudget: 'Jami Byudjet',
    totalSpent: 'Jami Xarajat',
    budgetUtilization: 'Byudjetdan Foydalanish',
    projectsByStatus: 'Holat bo\'yicha Loyihalar:',
    overdueProjects: 'Muddati O\'tgan Loyihalar:',
    allOnSchedule: 'Barcha loyihalar jadval bo\'yicha!',
    overBudget: 'Byudjetdan Oshgan:',
    allWithinBudget: 'Barcha loyihalar byudjet doirasida!',
    addressOverdue: 'Muddati o\'tgan loyihalarni hal qiling:',
    maintainTimelines: 'Joriy loyiha muddatlarini saqlang',
    reviewOverBudget: 'Byudjetdan oshgan loyihalar xarajatlarini ko\'rib chiqing:',
    milestoneReviews: 'Bosqichlarni muntazam ko\'rib chiqish tavsiya etiladi',
    // Contracts
    contractManagement: 'Shartnomalar Boshqaruvi',
    noContracts: "Sizda hali shartnomalar yo'q.",
    goToContracts: '**Shartnomalar** moduliga o\'ting',
    addContracts: 'Shartnomalaringizni qo\'shing (mijoz, yetkazib beruvchi, xodim va h.k.)',
    setExpiryDates: 'Yangilash kuzatuvi uchun muddatlarni o\'rnating',
    onceContractData: 'Shartnoma ma\'lumoti bo\'lganda, quyidagilar bilan yordam bera olaman:',
    contractExpiry: 'Shartnoma muddati ogohlantirishlari',
    renewalRecs: 'Yangilash tavsiyalari',
    contractValueAnalysis: 'Shartnoma qiymati tahlili',
    complianceTracking: 'Muvofiqlikni kuzatish',
    totalContracts: 'Jami Shartnomalar',
    activeContracts: 'Faol Shartnomalar',
    totalContractValue: 'Jami Shartnoma Qiymati',
    contractsByType: 'Tur bo\'yicha Shartnomalar:',
    contractsByStatus: 'Holat bo\'yicha Shartnomalar:',
    expiringSoon30: '30 Kun Ichida Tugaydigan:',
    noExpiringSoon: 'Yaqin orada tugaydigan shartnomalar yo\'q!',
    reviewForRenewal: 'Yangilash uchun shartnomalarni ko\'rib chiqing:',
    allContractsUpToDate: 'Barcha shartnomalar yangilangan',
    autoRenewal: 'Imkon qadar avto-yangilanishni sozlang',
    complianceReviews: 'Muntazam muvofiqlik tekshiruvlari tavsiya etiladi',
    // Workflow
    workflowSuggestions: 'Ish Jarayonini Avtomatlashtirish Takliflari',
    basedOnProcesses: 'Joriy jarayonlaringizga asosan, avtomatlashtirishda yordam bera olaman:',
    highImpact: 'Yuqori Samarali Avtomatlashtirishlar:',
    invoiceProcessing: '**Hisob-faktura Ishlov Berish** - Buyurtmalar bajarilganda hisob-fakturalarni avtomatik yaratish va yuborish',
    lowStockAlertsAuto: '**Kam Zaxira Ogohlantirishlari** - Inventar chegaraga yetganda qayta buyurtma bildirishnomalari',
    paymentReminders: '**To\'lov Eslatmalari** - Muddati o\'tgan hisob-fakturalar uchun avtomatik kuzatuvlar',
    quickWins: 'Tezkor Yutuqlar:',
    autoAssignLeads: 'Lidlarni hudud qoidalariga asoslangan holda avto-tayinlash',
    scheduledReports: 'Hisobotlarni avtomatik yaratish va email orqali yuborish',
    welcomeSequences: 'Mijozlarga salomlashuv email ketma-ketligi',
    implementation: 'Amalga Oshirish:',
    canCreateWorkflows: 'Men siz uchun ushbu ish jarayonlaridan birini yarata olaman. Shunchaki ayting:',
    createInvoiceAutomation: '"Hisob-faktura avtomatlashtirish ish jarayonini yarating"',
    setupLowStockCmd: '"Kam zaxira ogohlantirishlarini sozlang"',
    buildPaymentReminder: '"To\'lov eslatma ketma-ketligini yarating"',
    whichAutomation: 'Avval qaysi avtomatlashtirishni amalga oshirmoqchisiz?',
    // Reports
    reportGeneration: 'Hisobot Yaratish',
    canGenerateReports: 'Siz uchun quyidagi hisobotlarni yarata olaman:',
    financialReports: 'Moliyaviy Hisobotlar:',
    balanceSheet: 'Balans Hisoboti',
    incomeStatement: 'Daromadlar Hisoboti',
    cashFlowStatement: 'Pul Oqimi Hisoboti',
    arAging: 'Debitorlik Qarzdorligi',
    apAging: 'Kreditorlik Qarzdorligi',
    salesReports: 'Savdo Hisobotlari:',
    salesByPeriod: 'Davr bo\'yicha Savdo',
    salesByProduct: 'Mahsulot bo\'yicha Savdo',
    salesByCustomer: 'Mijoz bo\'yicha Savdo',
    pipelineAnalysis: 'Quvur tahlili',
    inventoryReports: 'Inventar Hisobotlari:',
    stockValuation: 'Zaxira Baholash',
    movementHistory: 'Harakat Tarixi',
    reorderRecsReport: 'Qayta Buyurtma Tavsiyalari',
    hrReports: 'HR Hisobotlari:',
    headcountSummary: 'Xodimlar Soni Xulosasi',
    payrollReport: 'Ish Haqi Hisoboti',
    leaveBalances: 'Ta\'til Qoldiqlari',
    toGenerateReport: 'Hisobot yaratish uchun quyidagilarni kiriting:',
    reportType: 'Hisobot turi',
    dateRange: 'Sana oralig\'i',
    reportFormat: 'Format (PDF, Excel yoki ekranda)',
    reportExample: 'Masalan: "O\'tgan chorak uchun savdo hisobotini PDF shaklida yarating"',
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
    keyMetrics: 'Ключевые Метрики:',
    totalRevenue: 'Общая Выручка',
    totalOrders: 'Всего Заказов',
    avgOrderValue: 'Средний Чек',
    orderStatusBreakdown: 'Статусы Заказов:',
    orders: 'заказов',
    topCustomers: 'Топ Клиенты по Выручке:',
    noCustomerData: 'Нет данных о клиентах',
    outstandingPayments: 'Неоплаченные Платежи:',
    unpaidOrdersTotaling: 'неоплаченных заказов на сумму',
    allOrdersPaid: 'Все заказы оплачены!',
    recommendations: 'Рекомендации:',
    focusOnRetaining: 'Сфокусируйтесь на удержании',
    yourTopCustomer: '(ваш лучший клиент)',
    followUpOn: 'Проследите за',
    unpaidInvoices: 'неоплаченных счетов',
    considerAnalyzing: 'Рассмотрите анализ производительности продуктов для оптимизации',
    yourDataSummary: 'Ваши Данные',
    inventoryAnalysis: 'Анализ Инвентаря',
    noInventoryItems: "У вас пока нет товаров в инвентаре.",
    goToInventory: 'Перейдите в модуль **Инвентарь**',
    addYourProducts: 'Добавьте свои товары',
    setReorderLevels: 'Установите уровни повторного заказа для автоматических оповещений',
    onceInventoryData: 'Когда у вас будут данные инвентаря, я могу помочь с:',
    lowStockAlerts: 'Оповещения о низких остатках',
    reorderRecommendations: 'Рекомендации по дозаказу',
    deadStockIdentification: 'Идентификация неходовых товаров',
    inventoryValuation: 'Оценка инвентаря',
    overview: 'Обзор:',
    totalSKUs: 'Всего SKU',
    totalUnits: 'Всего Единиц',
    totalValue: 'Общая Стоимость',
    lowStockAlert: 'Предупреждение о Низком Запасе',
    items: 'товаров',
    product: 'Товар',
    current: 'Текущий',
    reorderLevel: 'Уровень Заказа',
    status: 'Статус',
    outOfStock: 'Закончился',
    low: 'Низкий',
    allItemsStocked: 'Все товары в достаточном количестве!',
    needsImmediateAttention: 'товаров требуют внимания',
    createPurchaseOrders: 'Создайте заказы на закупку для',
    lowStockItems: 'товаров с низким остатком',
    inventoryLevelsHealthy: 'Уровни инвентаря в норме',
    urgent: 'Срочно: Пополнить',
    outOfStockItems: 'отсутствующих товаров',
    reviewSlowMoving: 'Рассмотрите акции для медленно продающихся товаров',
    financialAnalysis: 'Финансовый Анализ',
    noFinancialData: "У вас пока нет финансовых данных.",
    createSalesOrdersToTrack: 'Создайте **Заказы на продажу** для отслеживания выручки',
    logExpenses: 'Вносите **Расходы** для учёта затрат',
    recordFinancialTrans: 'Записывайте **Финансовые Операции** для движения денег',
    onceFinancialData: 'Когда у вас будут данные, я могу помочь с:',
    cashFlowAnalysis: 'Анализ денежного потока',
    profitMarginCalc: 'Расчёт маржи прибыли',
    expenseBreakdowns: 'Разбивка расходов',
    receivablesPayablesTracking: 'Учёт дебиторской и кредиторской задолженности',
    financialHealthDashboard: 'Панель Финансового Здоровья',
    revenueProfit: 'Выручка и Прибыль:',
    totalPurchases: 'Всего Закупок',
    totalExpenses: 'Всего Расходов',
    grossProfit: 'Валовая Прибыль',
    netProfit: 'Чистая Прибыль',
    profitMargin: 'Маржа Прибыли',
    receivablesPayables: 'Дебиторская и Кредиторская:',
    accountsReceivable: 'Дебиторская Задолженность',
    unpaidInvoicesCount: 'неоплаченных счетов',
    accountsPayable: 'Кредиторская Задолженность',
    unpaidBills: 'неоплаченных счетов',
    expenseBreakdown: 'Разбивка Расходов:',
    billsPendingPayment: 'счетов ожидают оплаты',
    reviewExpenses: 'Пересмотрите расходы - сейчас работаете в убыток',
    maintainProfitability: 'Поддерживайте текущие тренды прибыльности',
    businessAtGlance: 'Ваш Бизнес Кратко:',
    salesOrdersCount: 'Заказы на Продажу',
    noOrdersYet: 'Ещё нет заказов',
    inventoryItemsCount: 'Товары Инвентаря',
    lowStockCount: 'низкий остаток',
    noItemsYet: 'Ещё нет товаров',
    customersCount: 'Клиенты',
    noneYet: 'Ещё нет',
    employeesCount: 'Сотрудники',
    assetsCount: 'Активы',
    projectsCount: 'Проекты',
    contractsCount: 'Контракты',
    whatToAnalyze: 'Что бы вы хотели проанализировать?',
    showSalesPerformance: 'Покажи производительность продаж',
    whatInventoryRestock: 'Какой инвентарь нужно пополнить?',
    analyzeFinancialHealth: 'Проанализируй финансовое здоровье',
    showCustomerInsights: 'Покажи аналитику клиентов',
    hrPayrollSummary: 'Сводка HR и зарплат',
    imYourCopilot: "Я ваш AI-Копилот для бизнеса Genix. Могу помочь с:",
    analyticsInsights: 'Аналитика и Инсайты',
    salesPerformanceAnalysis: 'Анализ производительности продаж',
    inventoryOptimization: 'Оптимизация инвентаря',
    financialHealthMonitoring: 'Мониторинг финансового здоровья',
    customerBehaviorInsights: 'Инсайты поведения клиентов',
    automation: 'Автоматизация',
    createManageWorkflows: 'Создавайте и управляйте рабочими процессами',
    setupAlertsNotifications: 'Настройте оповещения и уведомления',
    automateRepetitiveTasks: 'Автоматизируйте повторяющиеся задачи',
    reports: 'Отчёты',
    generateFinancialStatements: 'Генерируйте финансовую отчётность',
    createSalesReports: 'Создавайте отчёты по продажам',
    exportDataFormats: 'Экспортируйте данные в разных форматах',
    recommendationsSection: 'Рекомендации',
    identifyOpportunities: 'Определите возможности',
    flagRisksIssues: 'Отметьте риски и проблемы',
    suggestImprovements: 'Предложите улучшения',
    gettingStarted: 'Начало:',
    noDataYet: "Похоже, у вас пока мало данных. Начните с добавления:",
    customersInModule: '**Клиенты** в модуле Клиенты',
    inventoryItemsInModule: '**Товары** в модуле Инвентарь',
    salesOrdersToTrack: '**Заказы на продажу** для учёта выручки',
    onceDataPersonalized: 'Когда у вас появятся данные, я смогу давать персонализированные инсайты и рекомендации!',
    greeting: 'Привет! Чем я могу вам помочь сегодня?',
    // Customer
    customerAnalytics: 'Аналитика Клиентов',
    noCustomers: "У вас пока нет клиентов.",
    goToCustomers: 'Перейдите в модуль **Клиенты**',
    addCustomersContacts: 'Добавьте своих клиентов и контакты',
    createSalesForRevenue: 'Создайте заказы для отслеживания выручки клиента',
    onceCustomerData: 'Когда у вас будут данные клиентов, я могу помочь с:',
    customerRevenueAnalysis: 'Анализ выручки по клиентам',
    topCustomerIdentification: 'Определение лучших клиентов',
    customerSegmentation: 'Сегментация клиентов',
    engagementTracking: 'Отслеживание вовлечённости',
    customerOverview: 'Обзор:',
    totalCustomers: 'Всего Клиентов',
    customersWithOrders: 'Клиентов с Заказами',
    customerSegmentsByRevenue: 'Сегменты Клиентов по Выручке:',
    enterprise: 'Корпоративные',
    midMarket: 'Средние',
    smb: 'Малые',
    accounts: 'аккаунтов',
    customersWithUnpaid: 'Клиенты с Неоплаченными Заказами:',
    allCustomersPaid: 'Все клиенты оплатили свои заказы!',
    nurtureTopCustomer: 'Развивайте отношения с',
    topCustomerParen: '(лучший клиент)',
    followUpWithCustomers: 'Свяжитесь с',
    customersOnPayments: 'клиентами по оплатам',
    considerLoyalty: 'Рассмотрите программы лояльности для постоянных клиентов',
    focusOnAcquiring: 'Сфокусируйтесь на привлечении новых клиентов',
    // HR
    hrAnalytics: 'HR Аналитика',
    noEmployees: "У вас пока нет сотрудников.",
    goToHR: 'Перейдите в модуль **HR**',
    addEmployees: 'Добавьте своих сотрудников',
    setupPayrollRecords: 'Настройте записи о зарплате',
    onceEmployeeData: 'Когда у вас будут данные о сотрудниках, я могу помочь с:',
    workforceOverviewItem: 'Обзор персонала',
    departmentDistributionItem: 'Распределение по отделам',
    payrollSummariesItem: 'Сводки по зарплате',
    compensationAnalysisItem: 'Анализ компенсаций',
    workforceOverview: 'Обзор Персонала:',
    totalEmployees: 'Всего Сотрудников',
    activeEmployees: 'Активных Сотрудников',
    averageSalary: 'Средняя Зарплата',
    departmentDistribution: 'Распределение по Отделам:',
    employeesWord: 'сотрудников',
    payrollSummary: 'Сводка по Зарплате:',
    totalPayrollRecords: 'Всего Записей о Зарплате',
    processedPayrolls: 'Обработано',
    pendingPayrolls: 'В ожидании',
    totalPayrollAmount: 'Общая Сумма Зарплаты',
    processPending: 'Обработайте ожидающие записи:',
    allPayrollProcessed: 'Все записи о зарплате обработаны!',
    organizeIntoDepts: 'Рассмотрите организацию сотрудников по отделам',
    reviewCompensation: 'Пересмотрите бенчмарки компенсации для удержания',
    // Assets
    assetManagement: 'Управление Активами',
    noAssets: "У вас пока нет активов.",
    goToAssets: 'Перейдите в модуль **Активы**',
    addCompanyAssets: 'Добавьте активы компании (оборудование, транспорт и т.д.)',
    trackDepreciation: 'Отслеживайте амортизацию и обслуживание',
    onceAssetData: 'Когда у вас будут данные об активах, я могу помочь с:',
    assetValuation: 'Оценка активов и отслеживание амортизации',
    maintenanceSchedules: 'Графики обслуживания',
    assetLifecycle: 'Анализ жизненного цикла актива',
    disposalRecommendations: 'Рекомендации по списанию',
    totalAssets: 'Всего Активов',
    purchaseValue: 'Стоимость Покупки',
    currentValue: 'Текущая Стоимость',
    totalDepreciation: 'Общая Амортизация',
    assetsByCategory: 'Активы по Категории:',
    assetsByStatus: 'Активы по Статусу:',
    maintenanceDue: 'Требуется Обслуживание:',
    overdue: 'Просрочено',
    allMaintenanceUpToDate: 'Всё обслуживание в актуальном состоянии!',
    scheduleMaintenance: 'Запланируйте обслуживание для',
    continueMaintenance: 'Продолжайте регулярный график обслуживания',
    reviewDepreciation: 'Пересмотрите графики амортизации для точности',
    considerDisposal: 'Рассмотрите списание полностью амортизированных активов',
    // Projects
    projectManagement: 'Управление Проектами',
    noProjects: "У вас пока нет проектов.",
    goToProjects: 'Перейдите в модуль **Проекты**',
    createFirstProject: 'Создайте ваш первый проект',
    addTasksMilestones: 'Добавьте задачи и вехи',
    onceProjectData: 'Когда у вас будут данные о проектах, я могу помочь с:',
    projectProgress: 'Отслеживание прогресса проекта',
    resourceAllocation: 'Анализ распределения ресурсов',
    timelineMonitoring: 'Мониторинг сроков',
    budgetAnalysis: 'Анализ бюджета и фактических расходов',
    totalProjects: 'Всего Проектов',
    totalBudget: 'Общий Бюджет',
    totalSpent: 'Всего Потрачено',
    budgetUtilization: 'Использование Бюджета',
    projectsByStatus: 'Проекты по Статусу:',
    overdueProjects: 'Просроченные Проекты:',
    allOnSchedule: 'Все проекты идут по графику!',
    overBudget: 'Превышение Бюджета:',
    allWithinBudget: 'Все проекты в рамках бюджета!',
    addressOverdue: 'Разберитесь с просроченными проектами:',
    maintainTimelines: 'Поддерживайте текущие сроки проектов',
    reviewOverBudget: 'Пересмотрите расходы на проекты с превышением бюджета:',
    milestoneReviews: 'Рекомендуются регулярные обзоры вех',
    // Contracts
    contractManagement: 'Управление Контрактами',
    noContracts: "У вас пока нет контрактов.",
    goToContracts: 'Перейдите в модуль **Контракты**',
    addContracts: 'Добавьте свои контракты (клиент, поставщик, сотрудник и т.д.)',
    setExpiryDates: 'Установите даты окончания для отслеживания продления',
    onceContractData: 'Когда у вас будут данные о контрактах, я могу помочь с:',
    contractExpiry: 'Оповещения об окончании контракта',
    renewalRecs: 'Рекомендации по продлению',
    contractValueAnalysis: 'Анализ стоимости контракта',
    complianceTracking: 'Отслеживание соответствия',
    totalContracts: 'Всего Контрактов',
    activeContracts: 'Активных Контрактов',
    totalContractValue: 'Общая Стоимость Контрактов',
    contractsByType: 'Контракты по Типу:',
    contractsByStatus: 'Контракты по Статусу:',
    expiringSoon30: 'Истекают в Течение 30 Дней:',
    noExpiringSoon: 'Нет контрактов, истекающих в ближайшее время!',
    reviewForRenewal: 'Пересмотрите контракты для продления:',
    allContractsUpToDate: 'Все контракты актуальны',
    autoRenewal: 'Настройте автопродление где возможно',
    complianceReviews: 'Рекомендуются регулярные проверки соответствия',
    // Workflow
    workflowSuggestions: 'Предложения по Автоматизации',
    basedOnProcesses: 'Основываясь на ваших процессах, я могу помочь автоматизировать:',
    highImpact: 'Высокоэффективные Автоматизации:',
    invoiceProcessing: '**Обработка Счетов** - Автоматически создавать и отправлять счета при выполнении заказов',
    lowStockAlertsAuto: '**Оповещения о Низких Остатках** - Уведомления о дозаказе при достижении порога',
    paymentReminders: '**Напоминания об Оплате** - Автоматические напоминания об просроченных счетах',
    quickWins: 'Быстрые Победы:',
    autoAssignLeads: 'Автоматическое назначение лидов по правилам территории',
    scheduledReports: 'Запланированная генерация отчётов и отправка по email',
    welcomeSequences: 'Серии приветственных писем для клиентов',
    implementation: 'Внедрение:',
    canCreateWorkflows: 'Я могу создать любой из этих процессов. Просто скажите:',
    createInvoiceAutomation: '"Создай автоматизацию счетов"',
    setupLowStockCmd: '"Настрой оповещения о низких остатках"',
    buildPaymentReminder: '"Построй серию напоминаний об оплате"',
    whichAutomation: 'Какую автоматизацию хотите внедрить первой?',
    // Reports
    reportGeneration: 'Генерация Отчётов',
    canGenerateReports: 'Я могу создать следующие отчёты:',
    financialReports: 'Финансовые Отчёты:',
    balanceSheet: 'Баланс',
    incomeStatement: 'Отчёт о Прибылях и Убытках',
    cashFlowStatement: 'Отчёт о Движении Денежных Средств',
    arAging: 'Старение Дебиторской Задолженности',
    apAging: 'Старение Кредиторской Задолженности',
    salesReports: 'Отчёты по Продажам:',
    salesByPeriod: 'Продажи по Периоду',
    salesByProduct: 'Продажи по Продукту',
    salesByCustomer: 'Продажи по Клиенту',
    pipelineAnalysis: 'Анализ Воронки',
    inventoryReports: 'Отчёты по Инвентарю:',
    stockValuation: 'Оценка Запасов',
    movementHistory: 'История Движения',
    reorderRecsReport: 'Рекомендации по Дозаказу',
    hrReports: 'HR Отчёты:',
    headcountSummary: 'Сводка по Численности',
    payrollReport: 'Отчёт по Зарплате',
    leaveBalances: 'Остатки Отпусков',
    toGenerateReport: 'Чтобы создать отчёт, укажите:',
    reportType: 'Тип отчёта',
    dateRange: 'Диапазон дат',
    reportFormat: 'Формат (PDF, Excel или на экране)',
    reportExample: 'Пример: "Сгенерируй отчёт по продажам за прошлый квартал в PDF"',
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
        content: `## ${t('salesAnalysis')}

${t('noSalesOrders')}

**${t('toGetStarted')}**

1. ${t('goToSalesOrders')}
2. ${t('createFirstSalesOrder')}
3. ${t('comeBackForInsights')}

**${t('onceSalesData')}**

- ${t('revenueTrends')}
- ${t('topCustomersByRevenue')}
- ${t('productPerformance')}
- ${t('salesForecasting')}`,
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
      : t('noCustomerData');

    return {
      content: `**${t('salesAnalysis')} - ${t('yourDataSummary')}:**

**${t('keyMetrics')}**
- ${t('totalRevenue')}: ${fmtCurrency(totalRevenue)}
- ${t('totalOrders')}: ${salesOrders.length}
- ${t('avgOrderValue')}: ${fmtCurrency(avgOrderValue)}

**${t('orderStatusBreakdown')}**
${Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count} ${t('orders')}`).join('\n')}

**${t('topCustomers')}**
${topCustomersText}

${unpaidOrders.length > 0 ? `**⚠️ ${t('outstandingPayments')}**
- ${unpaidOrders.length} ${t('unpaidOrdersTotaling')} ${fmtCurrency(unpaidTotal)}` : `**✓ ${t('allOrdersPaid')}**`}

**${t('recommendations')}**
${topCustomers.length > 0 ? `- ${t('focusOnRetaining')} ${topCustomers[0][0]} ${t('yourTopCustomer')}` : `- ${t('focusOnAcquiring')}`}
${unpaidOrders.length > 0 ? `- ${t('followUpOn')} ${unpaidOrders.length} ${t('unpaidInvoices')}` : ''}
- ${t('considerAnalyzing')}`,
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
        content: `## ${t('inventoryAnalysis')}

${t('noInventoryItems')}

**${t('toGetStarted')}**

1. ${t('goToInventory')}
2. ${t('addYourProducts')}
3. ${t('setReorderLevels')}

**${t('onceInventoryData')}**

- ${t('lowStockAlerts')}
- ${t('reorderRecommendations')}
- ${t('deadStockIdentification')}
- ${t('inventoryValuation')}`,
        tool_calls: [{ name: 'analyze_inventory', status: 'completed' }]
      };
    }

    const totalValue = inventory.reduce((sum, i) => sum + ((i.current_stock || 0) * (i.unit_cost || 0)), 0);
    const totalUnits = inventory.reduce((sum, i) => sum + (i.current_stock || 0), 0);
    const lowStockItems = inventory.filter(i => (i.current_stock || 0) <= (i.reorder_level || 10));
    const outOfStock = inventory.filter(i => (i.current_stock || 0) === 0);

    const lowStockTable = lowStockItems.slice(0, 5).map(i =>
      `| ${i.name || i.item_name || 'Unknown'} | ${i.current_stock || 0} | ${i.reorder_level || 10} | ${(i.current_stock || 0) === 0 ? `🚨 ${t('outOfStock')}` : `⚠️ ${t('low')}`} |`
    ).join('\n');

    return {
      content: `**${t('inventoryAnalysis')} - ${t('yourDataSummary')}:**

**${t('overview')}**
- ${t('totalSKUs')}: ${inventory.length}
- ${t('totalUnits')}: ${totalUnits.toLocaleString()}
- ${t('totalValue')}: ${fmtCurrency(totalValue)}

${lowStockItems.length > 0 ? `**⚠️ ${t('lowStockAlert')} (${lowStockItems.length} ${t('items')}):**
| ${t('product')} | ${t('current')} | ${t('reorderLevel')} | ${t('status')} |
|---------|---------|---------------|--------|
${lowStockTable}` : `**✓ ${t('allItemsStocked')}**`}

${outOfStock.length > 0 ? `**🚨 ${t('outOfStock')}: ${outOfStock.length} ${t('needsImmediateAttention')}**` : ''}

**${t('recommendations')}**
${lowStockItems.length > 0 ? `- ${t('createPurchaseOrders')} ${lowStockItems.length} ${t('lowStockItems')}` : `- ${t('inventoryLevelsHealthy')}`}
${outOfStock.length > 0 ? `- ${t('urgent')} ${outOfStock.length} ${t('outOfStockItems')}` : ''}
- ${t('reviewSlowMoving')}`,
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
        content: `## ${t('financialAnalysis')}

${t('noFinancialData')}

**${t('toGetStarted')}**

1. ${t('createSalesOrdersToTrack')}
2. ${t('logExpenses')}
3. ${t('recordFinancialTrans')}

**${t('onceFinancialData')}**

- ${t('cashFlowAnalysis')}
- ${t('profitMarginCalc')}
- ${t('expenseBreakdowns')}
- ${t('receivablesPayablesTracking')}`,
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
      content: `**${t('financialHealthDashboard')} - ${t('yourDataSummary')}:**

**${t('revenueProfit')}**
- ${t('totalRevenue')}: ${fmtCurrency(totalRevenue)}
- ${t('totalPurchases')}: ${fmtCurrency(totalPurchases)}
- ${t('totalExpenses')}: ${fmtCurrency(totalExpenses)}
- ${t('grossProfit')}: ${fmtCurrency(grossProfit)}
- ${t('netProfit')}: ${fmtCurrency(netProfit)}
- ${t('profitMargin')}: ${profitMargin}%

**${t('receivablesPayables')}**
- ${t('accountsReceivable')}: ${fmtCurrency(accountsReceivable)} (${unpaidSales.length} ${t('unpaidInvoicesCount')})
- ${t('accountsPayable')}: ${fmtCurrency(accountsPayable)} (${unpaidPurchases.length} ${t('unpaidBills')})

${Object.keys(expenseByCategory).length > 0 ? `**${t('expenseBreakdown')}**
${Object.entries(expenseByCategory).map(([cat, amt]) => `- ${cat}: ${fmtCurrency(amt)}`).join('\n')}` : ''}

**${t('recommendations')}**
${unpaidSales.length > 0 ? `- ${t('followUpOn')} ${unpaidSales.length} ${t('unpaidInvoices')} (${fmtCurrency(accountsReceivable)})` : `- ${t('allOrdersPaid')}`}
${unpaidPurchases.length > 0 ? `- ${unpaidPurchases.length} ${t('billsPendingPayment')}` : ''}
${netProfit < 0 ? `- ⚠️ ${t('reviewExpenses')}` : `- ${t('maintainProfitability')}`}`,
      tool_calls: [{ name: 'analyze_financials', status: 'completed' }]
    };
  }

  // Customer/CRM queries
  if (lowerMessage.includes('customer') || lowerMessage.includes('lead') || lowerMessage.includes('crm') ||
      lowerMessage.includes('клиент') || lowerMessage.includes('покупатель')) {
    const { customers = [], salesOrders = [] } = userData;

    if (customers.length === 0) {
      return {
        content: `## ${t('customerAnalytics')}

${t('noCustomers')}

**${t('toGetStarted')}**

1. ${t('goToCustomers')}
2. ${t('addCustomersContacts')}
3. ${t('createSalesForRevenue')}

**${t('onceCustomerData')}**

- ${t('customerRevenueAnalysis')}
- ${t('topCustomerIdentification')}
- ${t('customerSegmentation')}
- ${t('engagementTracking')}`,
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
      content: `**${t('customerAnalytics')} - ${t('yourDataSummary')}:**

**${t('customerOverview')}**
- ${t('totalCustomers')}: ${customers.length}
- ${t('customersWithOrders')}: ${Object.keys(customerRevenue).length}
- ${t('totalRevenue')}: ${fmtCurrency(totalCustomerRevenue)}

**${t('customerSegmentsByRevenue')}**
- ${t('enterprise')} (>${fmtCurrency(50000)}): ${enterprise.length} ${t('accounts')}
- ${t('midMarket')} (${fmtCurrency(10000)}-${fmtCurrency(50000)}): ${midMarket.length} ${t('accounts')}
- ${t('smb')} (<${fmtCurrency(10000)}): ${smb.length} ${t('accounts')}

${topCustomers.length > 0 ? `**${t('topCustomers')}**
${topCustomers.map((c, i) => `${i + 1}. ${c[0]} - ${fmtCurrency(c[1])}`).join('\n')}` : ''}

${customersWithUnpaid.length > 0 ? `**⚠️ ${t('customersWithUnpaid')}**
${customersWithUnpaid.slice(0, 5).map(c => `- ${c}`).join('\n')}` : `**✓ ${t('allCustomersPaid')}**`}

**${t('recommendations')}**
${topCustomers.length > 0 ? `- ${t('nurtureTopCustomer')} ${topCustomers[0][0]} ${t('topCustomerParen')}` : `- ${t('focusOnAcquiring')}`}
${customersWithUnpaid.length > 0 ? `- ${t('followUpWithCustomers')} ${customersWithUnpaid.length} ${t('customersOnPayments')}` : ''}
- ${t('considerLoyalty')}`,
      tool_calls: [{ name: 'analyze_customers', status: 'completed' }]
    };
  }

  // HR/Employee queries
  if (lowerMessage.includes('employee') || lowerMessage.includes('hr') || lowerMessage.includes('payroll') || lowerMessage.includes('staff') ||
      lowerMessage.includes('xodim') || lowerMessage.includes('ishchi') || lowerMessage.includes('maosh') ||
      lowerMessage.includes('сотрудник') || lowerMessage.includes('зарплат') || lowerMessage.includes('персонал')) {
    const { employees = [], payroll = [] } = userData;

    if (employees.length === 0) {
      return {
        content: `**${t('hrAnalytics')}:**

${t('noEmployees')}

**${t('toGetStarted')}**
1. ${t('goToHR')}
2. ${t('addEmployees')}
3. ${t('setupPayrollRecords')}

${t('onceEmployeeData')}
- ${t('workforceOverviewItem')}
- ${t('departmentDistributionItem')}
- ${t('payrollSummariesItem')}
- ${t('compensationAnalysisItem')}`,
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
      content: `**${t('hrAnalytics')} - ${t('yourDataSummary')}:**

**${t('workforceOverview')}**
- ${t('totalEmployees')}: ${employees.length}
- ${t('activeEmployees')}: ${activeEmployees.length}
- ${t('averageSalary')}: ${fmtCurrency(avgSalary)}

**${t('departmentDistribution')}**
${Object.entries(departments).map(([dept, count]) => `- ${dept}: ${count} ${t('employeesWord')}`).join('\n')}

**${t('payrollSummary')}**
- ${t('totalPayrollRecords')}: ${payroll.length}
- ${t('processedPayrolls')}: ${processedPayroll.length}
- ${t('pendingPayrolls')}: ${pendingPayroll.length}
${totalMonthlyPayroll > 0 ? `- ${t('totalPayrollAmount')}: ${fmtCurrency(totalMonthlyPayroll)}` : ''}

**${t('recommendations')}**
${pendingPayroll.length > 0 ? `- ${t('processPending')} ${pendingPayroll.length}` : `- ${t('allPayrollProcessed')}`}
${Object.keys(departments).length === 1 ? `- ${t('organizeIntoDepts')}` : ''}
- ${t('reviewCompensation')}`,
      tool_calls: [{ name: 'analyze_hr', status: 'completed' }]
    };
  }

  // Assets queries
  if (lowerMessage.includes('asset') || lowerMessage.includes('equipment') || lowerMessage.includes('depreciation') ||
      lowerMessage.includes('aktiv') || lowerMessage.includes('uskuna') || lowerMessage.includes('amortizatsiya') ||
      lowerMessage.includes('актив') || lowerMessage.includes('оборудовани') || lowerMessage.includes('амортизац')) {
    const { assets = [] } = userData;

    if (assets.length === 0) {
      return {
        content: `**${t('assetManagement')}:**

${t('noAssets')}

**${t('toGetStarted')}**
1. ${t('goToAssets')}
2. ${t('addCompanyAssets')}
3. ${t('trackDepreciation')}

${t('onceAssetData')}
- ${t('assetValuation')}
- ${t('maintenanceSchedules')}
- ${t('assetLifecycle')}
- ${t('disposalRecommendations')}`,
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
      content: `**${t('assetManagement')} - ${t('yourDataSummary')}:**

**${t('overview')}**
- ${t('totalAssets')}: ${assets.length}
- ${t('purchaseValue')}: ${fmtCurrency(totalPurchaseValue)}
- ${t('currentValue')}: ${fmtCurrency(totalValue)}
- ${t('totalDepreciation')}: ${fmtCurrency(totalDepreciation)}

**${t('assetsByCategory')}**
${Object.entries(byCategory).map(([cat, count]) => `- ${cat}: ${count}`).join('\n')}

**${t('assetsByStatus')}**
${Object.entries(byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

${needsMaintenance.length > 0 ? `**⚠️ ${t('maintenanceDue')}**
${needsMaintenance.slice(0, 5).map(a => `- ${a.name || a.asset_name}: ${t('overdue')}`).join('\n')}` : `**✓ ${t('allMaintenanceUpToDate')}**`}

**${t('recommendations')}**
${needsMaintenance.length > 0 ? `- ${t('scheduleMaintenance')} ${needsMaintenance.length}` : `- ${t('continueMaintenance')}`}
- ${t('reviewDepreciation')}
- ${t('considerDisposal')}`,
      tool_calls: [{ name: 'analyze_assets', status: 'completed' }]
    };
  }

  // Projects queries
  if (lowerMessage.includes('project') || lowerMessage.includes('task') || lowerMessage.includes('milestone') ||
      lowerMessage.includes('loyiha') || lowerMessage.includes('vazifa') ||
      lowerMessage.includes('проект') || lowerMessage.includes('задач')) {
    const { projects = [] } = userData;

    if (projects.length === 0) {
      return {
        content: `**${t('projectManagement')}:**

${t('noProjects')}

**${t('toGetStarted')}**
1. ${t('goToProjects')}
2. ${t('createFirstProject')}
3. ${t('addTasksMilestones')}

${t('onceProjectData')}
- ${t('projectProgress')}
- ${t('resourceAllocation')}
- ${t('timelineMonitoring')}
- ${t('budgetAnalysis')}`,
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
      content: `**${t('projectManagement')} - ${t('yourDataSummary')}:**

**${t('overview')}**
- ${t('totalProjects')}: ${projects.length}
- ${t('totalBudget')}: ${fmtCurrency(totalBudget)}
- ${t('totalSpent')}: ${fmtCurrency(totalSpent)}
- ${t('budgetUtilization')}: ${totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%

**${t('projectsByStatus')}**
${Object.entries(byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

${overdue.length > 0 ? `**⚠️ ${t('overdueProjects')}**
${overdue.slice(0, 5).map(p => `- ${p.name || p.project_name}`).join('\n')}` : `**✓ ${t('allOnSchedule')}**`}

${overBudget.length > 0 ? `**💰 ${t('overBudget')}**
${overBudget.slice(0, 5).map(p => `- ${p.name || p.project_name}`).join('\n')}` : `**✓ ${t('allWithinBudget')}**`}

**${t('recommendations')}**
${overdue.length > 0 ? `- ${t('addressOverdue')} ${overdue.length}` : `- ${t('maintainTimelines')}`}
${overBudget.length > 0 ? `- ${t('reviewOverBudget')} ${overBudget.length}` : ''}
- ${t('milestoneReviews')}`,
      tool_calls: [{ name: 'analyze_projects', status: 'completed' }]
    };
  }

  // Contracts queries
  if (lowerMessage.includes('contract') || lowerMessage.includes('agreement') || lowerMessage.includes('renewal') ||
      lowerMessage.includes('shartnoma') || lowerMessage.includes('kelishuv') ||
      lowerMessage.includes('контракт') || lowerMessage.includes('соглашение') || lowerMessage.includes('договор')) {
    const { contracts = [] } = userData;

    if (contracts.length === 0) {
      return {
        content: `**${t('contractManagement')}:**

${t('noContracts')}

**${t('toGetStarted')}**
1. ${t('goToContracts')}
2. ${t('addContracts')}
3. ${t('setExpiryDates')}

${t('onceContractData')}
- ${t('contractExpiry')}
- ${t('renewalRecs')}
- ${t('contractValueAnalysis')}
- ${t('complianceTracking')}`,
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
      content: `**${t('contractManagement')} - ${t('yourDataSummary')}:**

**${t('overview')}**
- ${t('totalContracts')}: ${contracts.length}
- ${t('activeContracts')}: ${activeContracts.length}
- ${t('totalContractValue')}: ${fmtCurrency(totalValue)}

**${t('contractsByType')}**
${Object.entries(byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

**${t('contractsByStatus')}**
${Object.entries(byStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

${expiringSoon.length > 0 ? `**⚠️ ${t('expiringSoon30')}**
${expiringSoon.map(c => `- ${c.contract_name || c.contract_number}: ${c.end_date}`).join('\n')}` : `**✓ ${t('noExpiringSoon')}**`}

**${t('recommendations')}**
${expiringSoon.length > 0 ? `- ${t('reviewForRenewal')} ${expiringSoon.length}` : `- ${t('allContractsUpToDate')}`}
- ${t('autoRenewal')}
- ${t('complianceReviews')}`,
      tool_calls: [{ name: 'analyze_contracts', status: 'completed' }]
    };
  }

  // Workflow/Automation queries
  if (lowerMessage.includes('workflow') || lowerMessage.includes('automat') || lowerMessage.includes('process') ||
      lowerMessage.includes('avtomatlash') || lowerMessage.includes('jarayon') ||
      lowerMessage.includes('автоматиз') || lowerMessage.includes('процесс')) {
    return {
      content: `**${t('workflowSuggestions')}:**

${t('basedOnProcesses')}

**${t('highImpact')}**
1. ${t('invoiceProcessing')}
2. ${t('lowStockAlertsAuto')}
3. ${t('paymentReminders')}

**${t('quickWins')}**
- ${t('autoAssignLeads')}
- ${t('scheduledReports')}
- ${t('welcomeSequences')}

**${t('implementation')}**
${t('canCreateWorkflows')}
- ${t('createInvoiceAutomation')}
- ${t('setupLowStockCmd')}
- ${t('buildPaymentReminder')}

${t('whichAutomation')}`,
      tool_calls: []
    };
  }

  // Report/Export queries
  if (lowerMessage.includes('report') || lowerMessage.includes('export') || lowerMessage.includes('generate') ||
      lowerMessage.includes('hisobot') || lowerMessage.includes('eksport') ||
      lowerMessage.includes('отчёт') || lowerMessage.includes('отчет') || lowerMessage.includes('экспорт')) {
    return {
      content: `**${t('reportGeneration')}:**

${t('canGenerateReports')}

**${t('financialReports')}**
- ${t('balanceSheet')}
- ${t('incomeStatement')}
- ${t('cashFlowStatement')}
- ${t('arAging')}
- ${t('apAging')}

**${t('salesReports')}**
- ${t('salesByPeriod')}
- ${t('salesByProduct')}
- ${t('salesByCustomer')}
- ${t('pipelineAnalysis')}

**${t('inventoryReports')}**
- ${t('stockValuation')}
- ${t('movementHistory')}
- ${t('reorderRecsReport')}

**${t('hrReports')}**
- ${t('headcountSummary')}
- ${t('payrollReport')}
- ${t('leaveBalances')}

${t('toGenerateReport')}
- ${t('reportType')}
- ${t('dateRange')}
- ${t('reportFormat')}

${t('reportExample')}`,
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
      const detectedLang = detectMessageLanguage(content);
      const lang = detectedLang || currentLanguage || 'en';
      const limitContent = {
        uz: `⚠️ **AI So'rovlar Limiti Tugadi**

Siz bu oydagi AI so'rovlar limitiga yetdingiz (${limits.aiRequestsPerMonth} ta so'rov).

**Variantlar:**
1. Kelasi oy boshida limit qayta tiklanadi
2. Obunangizni yuqori darajaga oshiring:
   - **Professional** - 2,500 AI so'rov/oy
   - **Enterprise** - Cheksiz AI so'rovlar

Obunani o'zgartirish uchun **Sozlamalar** → **Obuna** bo'limiga o'ting.`,
        ru: `⚠️ **Лимит AI Запросов Исчерпан**

Вы достигли месячного лимита AI запросов (${limits.aiRequestsPerMonth} запросов).

**Варианты:**
1. Лимит сбросится в начале следующего месяца
2. Повысьте свой тариф:
   - **Professional** — 2 500 AI запросов/мес
   - **Enterprise** — безлимитные AI запросы

Чтобы изменить подписку, перейдите в **Настройки** → **Подписка**.`,
        en: `⚠️ **AI Request Limit Reached**

You've reached your monthly AI request limit (${limits.aiRequestsPerMonth} requests).

**Options:**
1. Your limit resets at the start of next month
2. Upgrade your subscription:
   - **Professional** — 2,500 AI requests/month
   - **Enterprise** — unlimited AI requests

To change your subscription, go to **Settings** → **Subscription**.`
      };
      const limitMessage = {
        id: `msg_${++messageIdCounter.current}`,
        role: 'assistant',
        content: limitContent[lang] || limitContent.en,
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
          const detectedLang = detectMessageLanguage(content);
          const lang = detectedLang || currentLanguage || 'en';
          const fallbackText = {
            uz: 'Kechirasiz, so\'rovingizni qayta ishlay olmadim.',
            ru: 'Извините, я не смог обработать ваш запрос.',
            en: 'I apologize, but I could not process your request.'
          };
          const assistantMessage = {
            id: `msg_${++messageIdCounter.current}`,
            role: 'assistant',
            content: response.message?.content || response.content || fallbackText[lang] || fallbackText.en,
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
      const detectedLang = detectMessageLanguage(content);
      const lang = detectedLang || currentLanguage || 'en';
      const errorText = {
        uz: 'Kechirasiz, so\'rovingizni qayta ishlashda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.',
        ru: 'Извините, произошла ошибка при обработке вашего запроса. Попробуйте ещё раз.',
        en: 'I apologize, but I encountered an error processing your request. Please try again.'
      };
      const errorMessage = {
        id: `msg_${++messageIdCounter.current}`,
        role: 'assistant',
        content: errorText[lang] || errorText.en,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      return errorMessage;
    }
  }, [isBackendConnected, activeConversation, canMakeAIRequest, incrementAIUsage, getPlanLimits, executeAction, activeCompany, formatCurrency, currentLanguage]);

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
