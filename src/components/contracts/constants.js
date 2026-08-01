// Shared config for the Shartnomalar module.
// Status vocabulary mirrors genix-backend/internal/domain/entity/contract.go.

export const CONTRACT_STATUSES = {
  draft: { labelKey: 'cstatus_draft', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
  negotiation: { labelKey: 'cstatus_negotiation', chip: 'bg-blue-100 text-blue-700 border-blue-200' },
  signing: { labelKey: 'cstatus_signing', chip: 'bg-violet-100 text-violet-700 border-violet-200' },
  active: { labelKey: 'cstatus_active', chip: 'bg-green-100 text-green-700 border-green-200' },
  completed: { labelKey: 'cstatus_completed', chip: 'bg-sky-100 text-sky-700 border-sky-200' },
  cancelled: { labelKey: 'cstatus_cancelled', chip: 'bg-orange-100 text-orange-700 border-orange-200' },
  expired: { labelKey: 'cstatus_expired', chip: 'bg-red-100 text-red-700 border-red-200' },
};

export const CONTRACT_DIRECTIONS = {
  income: { labelKey: 'direction_income', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expense: { labelKey: 'direction_expense', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const CONTRACT_TYPES = ['fixed', 'annual', 'monthly', 'project'];

export const LINK_MODULES = [
  { value: 'crm_deal', labelKey: 'link_module_crm_deal' },
  { value: 'construction_object', labelKey: 'link_module_construction' },
  { value: 'sale_order', labelKey: 'link_module_sale_order' },
  { value: 'purchase_order', labelKey: 'link_module_purchase_order' },
];
