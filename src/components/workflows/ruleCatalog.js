// Client-side catalog for the rule builder. Must stay a subset of the backend
// catalog in genix-backend/internal/handler/workflow_engine.go.
import {
  Package, FileText, Users, AlertTriangle, Clock, ShoppingCart,
  CreditCard, Truck, UserPlus, UserMinus, FileSignature, ArrowRightLeft, ClipboardList,
  Receipt, Monitor,
} from 'lucide-react';

// field.type: 'number' | 'text' | 'select' (with options)
export const TRIGGER_EVENTS = [
  {
    value: 'inventory.low_stock', labelKey: 'evt_low_stock', descKey: 'evt_low_stock_desc',
    category: 'inventory', icon: Package, scheduled: false,
    fields: [
      { key: 'product_name', labelKey: 'wf_f_product_name', type: 'text' },
      { key: 'product_code', labelKey: 'wf_f_product_code', type: 'text' },
      { key: 'available', labelKey: 'wf_f_available', type: 'number' },
      { key: 'reorder_point', labelKey: 'wf_f_reorder_point', type: 'number' },
    ],
  },
  {
    value: 'inventory.adjusted', labelKey: 'evt_inventory_adjusted', descKey: 'evt_inventory_adjusted_desc',
    category: 'inventory', icon: ArrowRightLeft, scheduled: false,
    fields: [
      { key: 'product_name', labelKey: 'wf_f_product_name', type: 'text' },
      { key: 'product_code', labelKey: 'wf_f_product_code', type: 'text' },
      { key: 'quantity', labelKey: 'wf_f_quantity', type: 'number' },
      { key: 'new_balance', labelKey: 'wf_f_new_balance', type: 'number' },
    ],
  },
  {
    value: 'invoice.overdue', labelKey: 'evt_invoice_overdue', descKey: 'evt_invoice_overdue_desc',
    category: 'sales', icon: FileText, scheduled: true,
    fields: [
      { key: 'invoice_number', labelKey: 'wf_f_invoice_number', type: 'text' },
      { key: 'customer_name', labelKey: 'wf_f_customer_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
      { key: 'days_overdue', labelKey: 'wf_f_days_overdue', type: 'number' },
    ],
    updatable: { target: 'sales_invoices', fields: [{ field: 'status', labelKey: 'status' }] },
  },
  {
    value: 'sales_order.created', labelKey: 'evt_sales_order_created', descKey: 'evt_sales_order_created_desc',
    category: 'sales', icon: ShoppingCart, scheduled: false,
    fields: [
      { key: 'order_number', labelKey: 'wf_f_order_number', type: 'text' },
      { key: 'customer_name', labelKey: 'wf_f_customer_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
    updatable: { target: 'sales_orders', fields: [{ field: 'status', labelKey: 'status' }] },
  },
  {
    value: 'payment.received', labelKey: 'evt_payment_received', descKey: 'evt_payment_received_desc',
    category: 'sales', icon: CreditCard, scheduled: false,
    fields: [
      { key: 'invoice_number', labelKey: 'wf_f_invoice_number', type: 'text' },
      { key: 'customer_name', labelKey: 'wf_f_customer_name', type: 'text' },
      { key: 'amount', labelKey: 'wf_f_amount', type: 'number' },
    ],
  },
  {
    value: 'purchase_order.confirmed', labelKey: 'evt_po_confirmed', descKey: 'evt_po_confirmed_desc',
    category: 'purchase', icon: ClipboardList, scheduled: false,
    fields: [
      { key: 'order_number', labelKey: 'wf_f_order_number', type: 'text' },
      { key: 'vendor_name', labelKey: 'wf_f_vendor_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
    updatable: { target: 'purchase_orders', fields: [{ field: 'status', labelKey: 'status' }] },
  },
  {
    value: 'purchase_order.received', labelKey: 'evt_po_received', descKey: 'evt_po_received_desc',
    category: 'purchase', icon: Truck, scheduled: false,
    fields: [
      { key: 'order_number', labelKey: 'wf_f_order_number', type: 'text' },
      { key: 'vendor_name', labelKey: 'wf_f_vendor_name', type: 'text' },
    ],
  },
  {
    value: 'lead.created', labelKey: 'evt_lead_created', descKey: 'evt_lead_created_desc',
    category: 'crm', icon: Users, scheduled: false,
    fields: [
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'company_name', labelKey: 'wf_f_company_name', type: 'text' },
      { key: 'source', labelKey: 'wf_f_source', type: 'text' },
      { key: 'expected_value', labelKey: 'wf_f_expected_value', type: 'number' },
    ],
    updatable: {
      target: 'leads',
      fields: [{ field: 'status', labelKey: 'status' }, { field: 'source', labelKey: 'wf_f_source' }],
    },
  },
  {
    value: 'lead.status_changed', labelKey: 'evt_lead_status_changed', descKey: 'evt_lead_status_changed_desc',
    category: 'crm', icon: ArrowRightLeft, scheduled: false,
    fields: [
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'old_status', labelKey: 'wf_f_old_status', type: 'text' },
      { key: 'new_status', labelKey: 'wf_f_new_status', type: 'text' },
    ],
    updatable: { target: 'leads', fields: [{ field: 'status', labelKey: 'status' }] },
  },
  {
    value: 'lead.won', labelKey: 'evt_lead_won', descKey: 'evt_lead_won_desc',
    category: 'crm', icon: Users, scheduled: false,
    fields: [
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'company_name', labelKey: 'wf_f_company_name', type: 'text' },
      { key: 'amount', labelKey: 'wf_f_expected_value', type: 'number' },
    ],
  },
  {
    value: 'lead.lost', labelKey: 'evt_lead_lost', descKey: 'evt_lead_lost_desc',
    category: 'crm', icon: ArrowRightLeft, scheduled: false,
    fields: [
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'lost_reason', labelKey: 'wf_f_lost_reason', type: 'text' },
      { key: 'amount', labelKey: 'wf_f_expected_value', type: 'number' },
    ],
  },
  {
    value: 'lead.stale', labelKey: 'evt_lead_stale', descKey: 'evt_lead_stale_desc',
    category: 'crm', icon: ArrowRightLeft, scheduled: true,
    fields: [
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'stage', labelKey: 'wf_f_new_status', type: 'text' },
      { key: 'stale_days', labelKey: 'wf_f_stale_days', type: 'number' },
    ],
  },
  {
    value: 'task.assigned', labelKey: 'evt_task_assigned', descKey: 'evt_task_assigned_desc',
    category: 'tasks', icon: Users, scheduled: false,
    fields: [
      { key: 'task_title', labelKey: 'wf_f_task_title', type: 'text' },
      { key: 'board_name', labelKey: 'wf_f_board_name', type: 'text' },
      {
        key: 'priority', labelKey: 'wf_f_priority', type: 'select',
        options: ['low', 'normal', 'high', 'urgent'],
      },
    ],
    updatable: {
      target: 'tasks',
      fields: [{ field: 'priority', labelKey: 'wf_f_priority', options: ['low', 'normal', 'high', 'urgent'] }],
    },
  },
  {
    value: 'task.status_changed', labelKey: 'evt_task_status', descKey: 'evt_task_status_desc',
    category: 'tasks', icon: Clock, scheduled: false,
    fields: [
      { key: 'task_title', labelKey: 'wf_f_task_title', type: 'text' },
      { key: 'old_column', labelKey: 'wf_f_old_column', type: 'text' },
      { key: 'new_column', labelKey: 'wf_f_new_column', type: 'text' },
      { key: 'is_completed', labelKey: 'wf_f_is_completed', type: 'select', options: ['true', 'false'] },
    ],
    updatable: {
      target: 'tasks',
      fields: [{ field: 'priority', labelKey: 'wf_f_priority', options: ['low', 'normal', 'high', 'urgent'] }],
    },
  },
  {
    value: 'task.overdue', labelKey: 'evt_task_overdue', descKey: 'evt_task_overdue_desc',
    category: 'tasks', icon: AlertTriangle, scheduled: true,
    fields: [
      { key: 'task_title', labelKey: 'wf_f_task_title', type: 'text' },
      { key: 'board_name', labelKey: 'wf_f_board_name', type: 'text' },
      { key: 'days_overdue', labelKey: 'wf_f_days_overdue', type: 'number' },
    ],
    updatable: {
      target: 'tasks',
      fields: [{ field: 'priority', labelKey: 'wf_f_priority', options: ['low', 'normal', 'high', 'urgent'] }],
    },
  },
  {
    value: 'employee.created', labelKey: 'evt_employee_created', descKey: 'evt_employee_created_desc',
    category: 'hr', icon: UserPlus, scheduled: false,
    fields: [
      { key: 'employee_name', labelKey: 'wf_f_employee_name', type: 'text' },
      { key: 'position', labelKey: 'wf_f_position', type: 'text' },
    ],
  },
  {
    value: 'employee.terminated', labelKey: 'evt_employee_terminated', descKey: 'evt_employee_terminated_desc',
    category: 'hr', icon: UserMinus, scheduled: false,
    fields: [
      { key: 'employee_name', labelKey: 'wf_f_employee_name', type: 'text' },
    ],
  },
  {
    value: 'contracts.created', labelKey: 'evt_contracts_created', descKey: 'evt_contracts_created_desc',
    category: 'contracts', icon: FileSignature, scheduled: false,
    fields: [
      { key: 'contract_number', labelKey: 'wf_f_contract_number', type: 'text' },
      { key: 'title', labelKey: 'wf_f_contract_title', type: 'text' },
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'value', labelKey: 'wf_f_amount', type: 'number' },
      {
        key: 'direction', labelKey: 'wf_f_direction', type: 'select',
        options: [
          { value: 'income', labelKey: 'direction_income' },
          { value: 'expense', labelKey: 'direction_expense' },
        ],
      },
    ],
  },
  {
    value: 'contracts.status_changed', labelKey: 'evt_contracts_status_changed', descKey: 'evt_contracts_status_changed_desc',
    category: 'contracts', icon: FileSignature, scheduled: false,
    fields: [
      { key: 'contract_number', labelKey: 'wf_f_contract_number', type: 'text' },
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'old_status', labelKey: 'wf_f_old_status', type: 'text' },
      { key: 'new_status', labelKey: 'wf_f_new_status', type: 'text' },
    ],
  },
  {
    // Renamed from contract.expiring (443 migrates stored rules).
    value: 'contracts.expiring_soon', labelKey: 'evt_contract_expiring', descKey: 'evt_contract_expiring_desc',
    category: 'contracts', icon: FileSignature, scheduled: true,
    fields: [
      { key: 'contract_number', labelKey: 'wf_f_contract_number', type: 'text' },
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
      { key: 'days_to_expiry', labelKey: 'wf_f_days_to_expiry', type: 'number' },
      { key: 'threshold_days', labelKey: 'wf_f_threshold_days', type: 'number' },
    ],
  },
  {
    value: 'contracts.expired', labelKey: 'evt_contracts_expired', descKey: 'evt_contracts_expired_desc',
    category: 'contracts', icon: FileSignature, scheduled: true,
    fields: [
      { key: 'contract_number', labelKey: 'wf_f_contract_number', type: 'text' },
      { key: 'contact_name', labelKey: 'wf_f_contact_name', type: 'text' },
    ],
  },
  {
    value: 'expenses.submitted', labelKey: 'evt_expenses_submitted', descKey: 'evt_expenses_submitted_desc',
    category: 'expenses', icon: Receipt, scheduled: false,
    fields: [
      { key: 'expense_number', labelKey: 'wf_f_expense_number', type: 'text' },
      { key: 'employee_name', labelKey: 'wf_f_employee_name', type: 'text' },
      { key: 'category_name', labelKey: 'wf_f_category_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'expenses.approved', labelKey: 'evt_expenses_approved', descKey: 'evt_expenses_approved_desc',
    category: 'expenses', icon: Receipt, scheduled: false,
    fields: [
      { key: 'expense_number', labelKey: 'wf_f_expense_number', type: 'text' },
      { key: 'employee_name', labelKey: 'wf_f_employee_name', type: 'text' },
      { key: 'category_name', labelKey: 'wf_f_category_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'expenses.rejected', labelKey: 'evt_expenses_rejected', descKey: 'evt_expenses_rejected_desc',
    category: 'expenses', icon: Receipt, scheduled: false,
    fields: [
      { key: 'expense_number', labelKey: 'wf_f_expense_number', type: 'text' },
      { key: 'employee_name', labelKey: 'wf_f_employee_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
      { key: 'reason', labelKey: 'wf_f_reason', type: 'text' },
    ],
  },
  {
    value: 'expenses.paid', labelKey: 'evt_expenses_paid', descKey: 'evt_expenses_paid_desc',
    category: 'expenses', icon: Receipt, scheduled: false,
    fields: [
      { key: 'expense_number', labelKey: 'wf_f_expense_number', type: 'text' },
      { key: 'employee_name', labelKey: 'wf_f_employee_name', type: 'text' },
      { key: 'category_name', labelKey: 'wf_f_category_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'payroll.period_confirmed', labelKey: 'evt_payroll_period_confirmed', descKey: 'evt_payroll_period_confirmed_desc',
    category: 'hr', icon: CreditCard, scheduled: false,
    fields: [
      { key: 'period_name', labelKey: 'wf_f_period_name', type: 'text' },
      { key: 'total_net', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'payroll.paid', labelKey: 'evt_payroll_paid', descKey: 'evt_payroll_paid_desc',
    category: 'hr', icon: CreditCard, scheduled: false,
    fields: [
      { key: 'period_name', labelKey: 'wf_f_period_name', type: 'text' },
      { key: 'total_net', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  // Aktivlar (fixed assets) — 2026-08-03 rebuild
  {
    value: 'assets.commissioned', labelKey: 'evt_asset_commissioned', descKey: 'evt_asset_commissioned_desc',
    category: 'assets', icon: Monitor, scheduled: false,
    fields: [
      { key: 'inventory_number', labelKey: 'wf_f_inventory_number', type: 'text' },
      { key: 'asset_name', labelKey: 'wf_f_asset_name', type: 'text' },
      { key: 'cost', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'assets.depreciation_posted', labelKey: 'evt_asset_depr_posted', descKey: 'evt_asset_depr_posted_desc',
    category: 'assets', icon: Monitor, scheduled: false,
    fields: [
      { key: 'period', labelKey: 'wf_f_period', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
      { key: 'asset_count', labelKey: 'wf_f_asset_count', type: 'number' },
    ],
  },
  {
    value: 'assets.disposed', labelKey: 'evt_asset_disposed', descKey: 'evt_asset_disposed_desc',
    category: 'assets', icon: Monitor, scheduled: false,
    fields: [
      { key: 'inventory_number', labelKey: 'wf_f_inventory_number', type: 'text' },
      { key: 'asset_name', labelKey: 'wf_f_asset_name', type: 'text' },
      {
        key: 'disposal_type', labelKey: 'wf_f_disposal_type', type: 'select',
        options: ['sale', 'writeoff'],
      },
      { key: 'gain_loss', labelKey: 'wf_f_gain_loss', type: 'number' },
      { key: 'sale_price', labelKey: 'wf_f_sale_price', type: 'number' },
    ],
  },
  {
    value: 'assets.fully_depreciated', labelKey: 'evt_asset_fully_depreciated', descKey: 'evt_asset_fully_depreciated_desc',
    category: 'assets', icon: Monitor, scheduled: false,
    fields: [
      { key: 'inventory_number', labelKey: 'wf_f_inventory_number', type: 'text' },
      { key: 'asset_name', labelKey: 'wf_f_asset_name', type: 'text' },
      { key: 'depreciable_base', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  // Qurilish (construction) — 2026-08-03 hardening
  {
    value: 'construction.project_created', labelKey: 'evt_construction_project_created', descKey: 'evt_construction_project_created_desc',
    category: 'construction', icon: ClipboardList, scheduled: false,
    fields: [
      { key: 'code', labelKey: 'wf_f_project_code', type: 'text' },
      { key: 'name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'region', labelKey: 'region', type: 'text' },
    ],
  },
  {
    value: 'construction.project_status_changed', labelKey: 'evt_construction_status_changed', descKey: 'evt_construction_status_changed_desc',
    category: 'construction', icon: ClipboardList, scheduled: false,
    fields: [
      { key: 'name', labelKey: 'wf_f_project_name', type: 'text' },
      {
        key: 'new_status', labelKey: 'status', type: 'select',
        options: ['draft', 'planning', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'],
      },
      {
        key: 'old_status', labelKey: 'wf_f_old_status', type: 'select',
        options: ['draft', 'planning', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'],
      },
    ],
  },
  {
    value: 'construction.project_commissioned', labelKey: 'evt_construction_commissioned', descKey: 'evt_construction_commissioned_desc',
    category: 'construction', icon: ClipboardList, scheduled: false,
    fields: [
      { key: 'name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'capitalized_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'construction.act_approved', labelKey: 'evt_construction_act_approved', descKey: 'evt_construction_act_approved_desc',
    category: 'construction', icon: FileSignature, scheduled: false,
    fields: [
      { key: 'act_number', labelKey: 'wf_f_act_number', type: 'text' },
      { key: 'act_type', labelKey: 'wf_f_act_type', type: 'select', options: ['forma2', 'ks2', 'ks3', 'hidden_work'] },
      { key: 'project_name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'total_amount', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'construction.act_signed', labelKey: 'evt_construction_act_signed', descKey: 'evt_construction_act_signed_desc',
    category: 'construction', icon: FileSignature, scheduled: false,
    fields: [
      { key: 'act_number', labelKey: 'wf_f_act_number', type: 'text' },
      { key: 'act_type', labelKey: 'wf_f_act_type', type: 'select', options: ['forma2', 'ks2', 'ks3', 'hidden_work'] },
      { key: 'project_name', labelKey: 'wf_f_project_name', type: 'text' },
    ],
  },
  {
    value: 'construction.material_request_approved', labelKey: 'evt_construction_mr_approved', descKey: 'evt_construction_mr_approved_desc',
    category: 'construction', icon: Package, scheduled: false,
    fields: [
      { key: 'project_name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'total_expense', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'construction.material_request_created', labelKey: 'evt_construction_mr_created', descKey: 'evt_construction_mr_created_desc',
    category: 'construction', icon: Package, scheduled: false,
    fields: [
      { key: 'request_number', labelKey: 'wf_f_order_number', type: 'text' },
      { key: 'project_name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'priority', labelKey: 'wf_f_priority', type: 'text' },
    ],
  },
  {
    value: 'construction.material_request_issued', labelKey: 'evt_construction_mr_issued', descKey: 'evt_construction_mr_issued_desc',
    category: 'construction', icon: Package, scheduled: false,
    fields: [
      { key: 'request_number', labelKey: 'wf_f_order_number', type: 'text' },
      { key: 'project_name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'total_value', labelKey: 'wf_f_total_amount', type: 'number' },
    ],
  },
  {
    value: 'construction.material_request_rejected', labelKey: 'evt_construction_mr_rejected', descKey: 'evt_construction_mr_rejected_desc',
    category: 'construction', icon: Package, scheduled: false,
    fields: [
      { key: 'request_number', labelKey: 'wf_f_order_number', type: 'text' },
      { key: 'reason', labelKey: 'wf_f_reason', type: 'text' },
    ],
  },
  {
    value: 'construction.budget_overrun', labelKey: 'evt_construction_budget_overrun', descKey: 'evt_construction_budget_overrun_desc',
    category: 'construction', icon: AlertTriangle, scheduled: true,
    fields: [
      { key: 'name', labelKey: 'wf_f_project_name', type: 'text' },
      { key: 'budget', labelKey: 'wf_f_total_amount', type: 'number' },
      { key: 'actual', labelKey: 'wf_f_actual_amount', type: 'number' },
      { key: 'overrun_pct', labelKey: 'wf_f_overrun_pct', type: 'number' },
    ],
  },
];

export const EVENT_BY_VALUE = Object.fromEntries(TRIGGER_EVENTS.map((e) => [e.value, e]));

// Module grouping order for the trigger picker
export const EVENT_CATEGORIES = ['inventory', 'sales', 'purchase', 'crm', 'tasks', 'hr', 'contracts', 'expenses', 'assets', 'construction'];

export const CATEGORY_LABEL_KEYS = {
  inventory: 'inventory',
  sales: 'sales',
  purchase: 'purchase',
  crm: 'crm',
  tasks: 'tasks',
  hr: 'hr',
  contracts: 'contracts',
  expenses: 'expenses',
  assets: 'assets',
  construction: 'construction',
};

export const OPERATORS = [
  { value: 'eq', labelKey: 'wf_op_eq', types: ['number', 'text', 'select'] },
  { value: 'neq', labelKey: 'wf_op_neq', types: ['number', 'text', 'select'] },
  { value: 'gt', labelKey: 'wf_op_gt', types: ['number'] },
  { value: 'gte', labelKey: 'wf_op_gte', types: ['number'] },
  { value: 'lt', labelKey: 'wf_op_lt', types: ['number'] },
  { value: 'lte', labelKey: 'wf_op_lte', types: ['number'] },
  { value: 'contains', labelKey: 'wf_op_contains', types: ['text'] },
  { value: 'not_contains', labelKey: 'wf_op_not_contains', types: ['text'] },
];

export const ACTION_TYPES = [
  { value: 'create_notification', labelKey: 'act_create_notification', descKey: 'act_create_notification_desc' },
  { value: 'create_task', labelKey: 'act_create_task', descKey: 'act_create_task_desc' },
  { value: 'update_field', labelKey: 'act_update_field', descKey: 'act_update_field_desc' },
  { value: 'send_telegram', labelKey: 'act_send_telegram', descKey: 'act_send_telegram_desc', disabled: true },
];

export const NOTIFICATION_ROLES = ['owner', 'site_admin', 'admin', 'employee'];

// Builds the human-readable one-line summary shown in the rules list:
// "QACHON … [AGAR n shart] → harakatlar"
export function ruleSummary(rule, t) {
  const event = EVENT_BY_VALUE[rule.trigger_event];
  const eventLabel = event ? t(event.labelKey) : rule.trigger_event;

  let condCount = 0;
  try {
    const c = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
    if (c && Array.isArray(c.conditions)) condCount = c.conditions.length;
    else if (c && typeof c === 'object') condCount = Object.keys(c).length;
  } catch { /* unparsable conditions — treat as none */ }

  let actionLabels = [];
  try {
    const actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
    actionLabels = (actions || []).map((a) => {
      const def = ACTION_TYPES.find((d) => d.value === a.type);
      if (def) return t(def.labelKey);
      if (a.type === 'update_status') return t('act_update_field');
      if (a.type === 'update_task_priority') return t('act_update_field');
      if (a.type === 'create_followup_task') return t('act_create_task');
      return a.type;
    });
  } catch { /* unparsable actions */ }

  const condPart = condCount > 0 ? ` · ${condCount} ${t('wf_conditions_short')}` : '';
  return `${eventLabel}${condPart} → ${actionLabels.join(', ')}`;
}

// Related-record links for the execution log
export function relatedRecordLink(relatedType, relatedId, triggerData) {
  switch (relatedType) {
    case 'task': {
      const boardId = triggerData?.board_id;
      return boardId ? `/tasks/${boardId}` : '/tasks';
    }
    case 'product': return '/inventory';
    case 'sales_invoice': return '/financials';
    case 'sales_order': return '/salesorders';
    case 'purchase_order': return '/procurement';
    case 'lead': return '/customers';
    case 'employee': return '/hr';
    case 'contract': return '/contracts';
    default: return null;
  }
}
