// Default Admin Settings Configuration for Genix ERP
// Following Odoo/SAP ERP standards

export const DEFAULT_ADMIN_SETTINGS = {
  // General Settings
  general: {
    company: {
      name: '',
      legal_name: '',
      tax_id: '',
      registration_number: '',
      address: {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Uzbekistan'
      },
      contact: {
        email: '',
        phone: '',
        website: ''
      },
      logo_url: null
    },
    localization: {
      language: 'uz',
      timezone: 'Asia/Tashkent',
      date_format: 'DD/MM/YYYY',
      time_format: '24h',
      currency: 'UZS',
      currency_symbol: "so'm",
      decimal_separator: ',',
      thousands_separator: ' ',
      currency_position: 'after' // 'before' or 'after'
    },
    fiscal: {
      fiscal_year_start_month: 1, // January
      fiscal_year_start_day: 1
    }
  },

  // CRM Settings
  crm: {
    lead_scoring: {
      enabled: false,
      rules: []
    },
    pipeline: {
      default_stages: ['New', 'Qualified', 'Proposition', 'Negotiation', 'Won', 'Lost'],
      auto_create_opportunity: true
    },
    assignment: {
      auto_assign_leads: false,
      assignment_method: 'manual', // 'manual', 'round_robin', 'load_balanced'
      follow_up_reminder_days: 3
    },
    duplicate_detection: {
      enabled: true,
      check_fields: ['email', 'phone']
    }
  },

  // Sales Settings
  sales: {
    quotation: {
      validity_days: 30,
      auto_confirm: false,
      require_approval: false,
      approval_threshold: 0
    },
    pricing: {
      strategy: 'standard', // 'standard', 'tiered', 'customer_specific'
      allow_discounts: true,
      max_discount_percent: 20,
      discount_approval_threshold: 10
    },
    payment: {
      default_terms: 'Net 30',
      available_terms: ['Immediate', 'Net 15', 'Net 30', 'Net 45', 'Net 60']
    },
    invoice: {
      auto_generate: true,
      auto_send: false
    },
    credit: {
      enable_credit_limit: false,
      default_credit_limit: 0
    }
  },

  // Inventory Settings
  inventory: {
    traceability: {
      enabled: true,
      lot_tracking: true,
      serial_number_tracking: false,
      expiry_date_tracking: true
    },
    costing: {
      method: 'FIFO', // 'FIFO', 'LIFO', 'AVCO', 'STANDARD'
      valuation: 'automatic' // 'manual', 'automatic'
    },
    warehouse: {
      default_warehouse_id: null,
      allow_negative_stock: false,
      require_location: false,
      multi_location: false
    },
    reorder: {
      auto_reorder: false,
      default_reorder_quantity: 10,
      low_stock_threshold_percent: 20
    },
    units: {
      default_unit: 'Unit',
      units_of_measure: [
        { name: 'Unit', symbol: 'Unit', category: 'unit', ratio: 1 },
        { name: 'Kilogram', symbol: 'kg', category: 'weight', ratio: 1 },
        { name: 'Gram', symbol: 'g', category: 'weight', ratio: 0.001 },
        { name: 'Liter', symbol: 'L', category: 'volume', ratio: 1 },
        { name: 'Meter', symbol: 'm', category: 'length', ratio: 1 },
        { name: 'Piece', symbol: 'pcs', category: 'unit', ratio: 1 },
        { name: 'Box', symbol: 'box', category: 'unit', ratio: 1 },
        { name: 'Dozen', symbol: 'dz', category: 'unit', ratio: 12 }
      ]
    },
    barcode: {
      format: 'EAN13', // 'EAN13', 'EAN8', 'UPC', 'CODE128'
      auto_generate: false
    }
  },

  // Purchase Settings
  purchase: {
    approval: {
      workflow_enabled: false,
      thresholds: [
        { amount: 1000000, approver_role: 'manager' },
        { amount: 10000000, approver_role: 'admin' }
      ]
    },
    vendor: {
      default_payment_terms: 'Net 30',
      rating_enabled: true,
      preferred_vendors_only: false
    },
    rfq: {
      validity_days: 15,
      auto_create_po: false
    },
    lead_time: {
      default_days: 7
    },
    blanket_orders: {
      enabled: false
    }
  },

  // Manufacturing Settings
  manufacturing: {
    planning: {
      method: 'MTO', // 'MRP', 'MTO' (Make to Order), 'MTS' (Make to Stock)
      default_lead_time_days: 5
    },
    work_center: {
      default_capacity: 8, // hours per day
      efficiency_rate: 100 // percentage
    },
    quality: {
      control_enabled: true,
      inspection_required: true
    },
    production: {
      auto_consume_components: false,
      backflush_enabled: false
    }
  },

  // HR Settings
  hr: {
    leave: {
      types: [
        { id: 'annual', name: 'Annual Leave', days_per_year: 24, carry_forward: true, max_carry_forward: 10 },
        { id: 'sick', name: 'Sick Leave', days_per_year: 15, carry_forward: false, max_carry_forward: 0 },
        { id: 'unpaid', name: 'Unpaid Leave', days_per_year: 0, carry_forward: false, max_carry_forward: 0 },
        { id: 'maternity', name: 'Maternity Leave', days_per_year: 126, carry_forward: false, max_carry_forward: 0 }
      ],
      approval_required: true
    },
    expense: {
      categories: [
        { id: 'travel', name: 'Travel', approval_required: true },
        { id: 'meals', name: 'Meals & Entertainment', approval_required: true },
        { id: 'supplies', name: 'Office Supplies', approval_required: false },
        { id: 'equipment', name: 'Equipment', approval_required: true },
        { id: 'other', name: 'Other', approval_required: true }
      ],
      auto_approval_limit: 100000
    },
    work: {
      hours_per_day: 8,
      days_per_week: 5,
      overtime_multiplier: 1.5
    },
    attendance: {
      tracking_enabled: false,
      geolocation_required: false
    },
    payroll: {
      pay_period: 'monthly', // 'weekly', 'bi-weekly', 'monthly'
      currency: 'UZS'
    }
  },

  // Finance Settings
  finance: {
    fiscal_year: {
      start_month: 1,
      start_day: 1
    },
    accounts: {
      chart_template: 'standard', // 'standard', 'IFRS', 'local_GAAP'
      default_sales_account: null,
      default_purchase_account: null,
      default_inventory_account: null,
      default_receivables_account: null,
      default_payables_account: null
    },
    tax: {
      default_sales_tax: 12, // percentage (Uzbekistan VAT)
      default_purchase_tax: 12,
      tax_rounding: 'line', // 'line', 'document'
      price_includes_tax: false
    },
    currency: {
      multi_currency_enabled: false,
      exchange_rate_source: 'manual', // 'manual', 'api'
      base_currency: 'UZS'
    },
    banking: {
      reconciliation_tolerance: 0,
      auto_match_transactions: true
    },
    journal: {
      auto_post_entries: false,
      require_approval: true
    },
    lock_date: {
      date: null,
      enabled: false
    }
  },

  // Project Settings
  projects: {
    billing: {
      default_type: 'time_materials', // 'fixed_price', 'time_materials', 'milestone'
      allow_overtime_billing: true,
      default_hourly_rate: 0
    },
    timesheet: {
      approval_required: true,
      max_hours_per_day: 12,
      reminder_enabled: true
    },
    task: {
      default_hours: 8,
      allow_subtasks: true
    },
    stages: ['Planning', 'In Progress', 'Review', 'Completed', 'On Hold', 'Cancelled']
  }
};

// Helper to get a setting value by path
export function getSetting(settings, path, defaultValue = null) {
  const keys = path.split('.');
  let value = settings;

  for (const key of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return defaultValue;
    }
    value = value[key];
  }

  return value !== undefined ? value : defaultValue;
}

// Helper to set a setting value by path
export function setSetting(settings, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = settings;

  for (const key of keys) {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
  return settings;
}

// Deep merge helper
export function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export default DEFAULT_ADMIN_SETTINGS;
