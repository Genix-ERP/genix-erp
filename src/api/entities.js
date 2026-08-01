// Entity wrappers that use Go backend API services
// Expose a generic list/create/update/delete interface over REST endpoints

import { hrService } from './services/hr';
import apiClient from './client';

// Generic entity wrapper for endpoints that follow REST conventions
const createGenericEntity = (endpoint) => ({
  async list(sortOrder = '') {
    try {
      const params = {};
      if (sortOrder) {
        if (sortOrder.startsWith('-')) {
          params.sort_by = sortOrder.substring(1);
          params.sort_order = 'DESC';
        } else {
          params.sort_by = sortOrder;
          params.sort_order = 'ASC';
        }
      }
      const response = await apiClient.get(endpoint, { params });
      return response.data.data || [];
    } catch (error) {
      console.error(`Error listing ${endpoint}:`, error);
      return [];
    }
  },
  async filter(filters = {}) {
    try {
      const response = await apiClient.get(endpoint, { params: filters });
      return response.data.data || [];
    } catch (error) {
      console.error(`Error filtering ${endpoint}:`, error);
      return [];
    }
  },
  async get(id) {
    try {
      const response = await apiClient.get(`${endpoint}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error getting ${endpoint}/${id}:`, error);
      return null;
    }
  },
  async create(data) {
    const response = await apiClient.post(endpoint, data);
    return response.data.data;
  },
  async update(id, data) {
    const response = await apiClient.put(`${endpoint}/${id}`, data);
    return response.data.data;
  },
  async delete(id) {
    await apiClient.delete(`${endpoint}/${id}`);
  }
});

// Generate unique ID with random suffix to prevent duplicates
const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
};

// Local storage entity for features that don't have backend endpoints yet
const createLocalEntity = (storageKey) => ({
  async list() {
    try {
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  async filter(filters = {}) {
    const items = await this.list();
    return items.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  },
  async get(id) {
    const items = await this.list();
    return items.find(item => item.id === id) || null;
  },
  async create(data) {
    const items = await this.list();
    const newItem = { ...data, id: data.id || generateUniqueId(), created_at: new Date().toISOString() };
    items.push(newItem);
    localStorage.setItem(storageKey, JSON.stringify(items));
    return newItem;
  },
  async update(id, data) {
    const items = await this.list();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify(items));
      return items[index];
    }
    throw new Error('Item not found');
  },
  async delete(id) {
    const items = await this.list();
    const filtered = items.filter(item => item.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(filtered));
  }
});

// CRM / Contacts - use Go backend
export const Customer = createGenericEntity('/contacts');
export const Lead = createLocalEntity('genix_leads');
export const Opportunity = createLocalEntity('genix_opportunities');
export const CallLog = createLocalEntity('genix_call_logs');
export const CommunicationLog = createLocalEntity('genix_communication_logs');

// Inventory - use Go backend
export const InventoryItem = createGenericEntity('/inventory');
export const StockMovement = createLocalEntity('genix_stock_movements');

// HR - use Go backend
export const Employee = {
  async list(sortOrder = '') {
    try {
      const params = {};
      if (sortOrder) {
        if (sortOrder.startsWith('-')) {
          params.sort_by = sortOrder.substring(1);
          params.sort_order = 'DESC';
        } else {
          params.sort_by = sortOrder;
          params.sort_order = 'ASC';
        }
      }
      return await hrService.listEmployees(params);
    } catch (error) {
      console.error('Error listing employees:', error);
      return [];
    }
  },
  async get(id) {
    return await hrService.getEmployee(id);
  },
  async create(data) {
    return await hrService.createEmployee(data);
  },
  async update(id, data) {
    return await hrService.updateEmployee(id, data);
  },
  async delete(id) {
    return await hrService.deleteEmployee(id);
  }
};

// Finance - use Go backend where available
export const FinancialTransaction = createLocalEntity('genix_financial_transactions');
export const ChartOfAccounts = createGenericEntity('/accounts');
export const JournalEntry = createGenericEntity('/journal-entries');
export const JournalLine = createLocalEntity('genix_journal_lines');
export const Invoice = createGenericEntity('/sales-invoices');
export const BankAccount = createLocalEntity('genix_bank_accounts');
export const FixedAsset = createLocalEntity('genix_fixed_assets');
export const TaxConfiguration = createGenericEntity('/tax-rates');

// Sales - use Go backend
export const SalesOrder = createGenericEntity('/sales-orders');

// Purchase - use Go backend
export const PurchaseOrder = createGenericEntity('/purchase-orders');

// Workflows - use Go backend
export const Workflow = createGenericEntity('/workflows');

// Workflow automation rules (the real engine: trigger_event -> conditions -> actions)
export const WorkflowRule = createGenericEntity('/workflow-rules');

// Notifications - use Go backend
export const Notification = createGenericEntity('/notifications');

// Company / Admin - local storage for now
export const Company = createLocalEntity('genix_companies');
export const InstalledApp = createLocalEntity('genix_installed_apps');
export const Subscription = createLocalEntity('genix_subscriptions');
export const License = createLocalEntity('genix_licenses');
export const RolePermission = createGenericEntity('/permissions');

// Manufacturing - local storage for now
export const BillOfMaterials = createLocalEntity('genix_bom');
export const WorkCenter = createLocalEntity('genix_work_centers');
export const ProductionOrder = createLocalEntity('genix_production_orders');
export const WorkOrder = createLocalEntity('genix_work_orders');
export const QualityCheck = createLocalEntity('genix_quality_checks');

// Expenses - use Go backend (endpoint: /expenses)
export const ExpenseClaim = createGenericEntity('/expenses');

// Payroll - use Go backend (endpoint: /payroll-periods)
export const Payroll = createGenericEntity('/payroll-periods');

// Assets - use Go backend (endpoint: /fixed-assets)
export const Asset = createGenericEntity('/fixed-assets');

// Contracts - use Go backend
export const Contract = createGenericEntity('/contracts');

// Attendance - Connected to backend database
export const AttendanceRecord = createGenericEntity('/attendance');

// Leave Management - Connected to backend database
export const LeaveRequest = createGenericEntity('/leave-requests');
export const LeaveBalance = createGenericEntity('/leave-balances');

// Employee Contracts - Connected to backend database (separate from procurement contracts)
export const EmployeeContract = createGenericEntity('/employee-contracts');
