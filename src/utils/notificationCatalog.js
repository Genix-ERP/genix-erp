// notificationCatalog.js
//
// Pure-frontend translation layer for in-app notifications.
//
// Why this file exists:
//   Backend writes `title`/`message` at creation time in the user's profile
//   language (see handler/notifications.go — `createTranslatedNotification`).
//   Those frozen strings are what the mobile app reads and must NOT change.
//   But on the web we want the notification list to re-render in whatever
//   language the user has selected in the UI right now, including on rows
//   created when the user had a different language set.
//
//   So the web renders from `type` + `data` (both already present on every
//   row) using the catalog below. When `type` is unknown, or any required
//   `data` field is missing, we fall back to the stored `title`/`message` —
//   mobile's behaviour and the behaviour for legacy / ad-hoc rows.
//
// Adding a new type:
//   1. Make sure the Go emitter packs every interpolated field into the
//      notifications `data` JSONB (additive, mobile-safe).
//   2. Add an entry below with the translation KEYS for title / body and
//      the list of required data fields.
//   3. Add the translation keys to translations.jsx for en / uz / ru.

// List of notification templates. Each entry:
//   titleKey / bodyKey — translation keys consumed by `t()`.
//   fields — data fields that must be present on `data` for the body
//            interpolation to be safe. If any are missing we fall back to
//            the stored strings.
//   format — optional per-field formatters, e.g. numbers as currency.
export const NOTIFICATION_TEMPLATES = {
  // ── Inventory ─────────────────────────────────────────────────────────
  low_stock: {
    titleKey: 'notif_low_stock_title',
    bodyKey: 'notif_low_stock_body',
    fields: ['product_name', 'available'],
    format: { available: 'number' },
  },
  material_reservation_request: {
    titleKey: 'notif_material_reservation_request_title',
    bodyKey: 'notif_material_reservation_request_body',
    fields: ['product_name', 'quantity'],
    format: { quantity: 'number' },
  },
  // ── Vazifalar (task management) ───────────────────────────────────────
  task_assigned: {
    titleKey: 'notif_task_assigned_title',
    bodyKey: 'notif_task_assigned_body',
    fields: ['task_title', 'board_name'],
  },
  task_comment_mention: {
    titleKey: 'notif_task_comment_mention_title',
    bodyKey: 'notif_task_comment_mention_body',
    fields: ['actor_name', 'task_title'],
  },
  task_overdue: {
    titleKey: 'notif_task_overdue_title',
    bodyKey: 'notif_task_overdue_body',
    fields: ['task_title', 'due_date'],
  },
  // ── Sales ─────────────────────────────────────────────────────────────
  sales_order_confirmed: {
    titleKey: 'notif_sales_order_confirmed_title',
    bodyKey: 'notif_sales_order_confirmed_body',
    fields: ['order_number', 'customer_name', 'amount'],
    format: { amount: 'number' },
  },
  invoice_sent: {
    titleKey: 'notif_invoice_sent_title',
    bodyKey: 'notif_invoice_sent_body',
    fields: ['invoice_number', 'customer_name', 'amount'],
    format: { amount: 'number' },
  },
  invoice_overdue: {
    titleKey: 'notif_invoice_overdue_title',
    bodyKey: 'notif_invoice_overdue_body',
    fields: ['invoice_number', 'customer_name'],
  },
  payment_recorded: {
    titleKey: 'notif_payment_recorded_title',
    bodyKey: 'notif_payment_recorded_body',
    fields: ['amount', 'invoice_number', 'customer_name'],
    format: { amount: 'number' },
  },
  payment_received: {
    titleKey: 'notif_payment_received_title',
    bodyKey: 'notif_payment_received_body',
    fields: ['amount', 'customer_name'],
    format: { amount: 'number' },
  },
  credit_note_created: {
    titleKey: 'notif_credit_note_created_title',
    bodyKey: 'notif_credit_note_created_body',
    fields: ['credit_note_number', 'invoice_number', 'amount'],
    format: { amount: 'number' },
  },
  // ── Payments / AR ─────────────────────────────────────────────────────
  payment_confirmed: {
    titleKey: 'notif_payment_confirmed_title',
    bodyKey: 'notif_payment_confirmed_body',
    fields: ['payment_number', 'amount', 'contact_name'],
    format: { amount: 'number' },
  },
  // ── Purchase / Vendor ─────────────────────────────────────────────────
  purchase_invoice_created: {
    titleKey: 'notif_purchase_invoice_created_title',
    bodyKey: 'notif_purchase_invoice_created_body',
    fields: ['invoice_number', 'vendor_name', 'amount'],
    format: { amount: 'number' },
  },
  purchase_invoice_confirmed: {
    titleKey: 'notif_purchase_invoice_confirmed_title',
    bodyKey: 'notif_purchase_invoice_confirmed_body',
    fields: ['invoice_number', 'vendor_name'],
  },
  purchase_order_approved: {
    titleKey: 'notif_purchase_order_approved_title',
    bodyKey: 'notif_purchase_order_approved_body',
    fields: ['order_number', 'vendor_name', 'amount'],
    format: { amount: 'number' },
  },
  vendor_bill_overdue: {
    titleKey: 'notif_vendor_bill_overdue_title',
    bodyKey: 'notif_vendor_bill_overdue_body',
    fields: ['invoice_number', 'vendor', 'overdue_days'],
    format: { overdue_days: 'number' },
  },
  // ── Expenses / Payroll ────────────────────────────────────────────────
  expense_approved: {
    titleKey: 'notif_expense_approved_title',
    bodyKey: 'notif_expense_approved_body',
    fields: ['expense_number', 'amount'],
    format: { amount: 'number' },
  },
  salary_confirmed: {
    titleKey: 'notif_salary_confirmed_title',
    bodyKey: 'notif_salary_confirmed_body',
    fields: ['net_salary', 'employee_name'],
    format: { net_salary: 'number' },
  },
  // ── Construction acts ────────────────────────────────────────────────
  act_signed: {
    titleKey: 'notif_act_signed_title',
    bodyKey: 'notif_act_signed_body',
    fields: ['project_id'],
  },
  act_cancelled: {
    titleKey: 'notif_act_cancelled_title',
    bodyKey: 'notif_act_cancelled_body',
    fields: ['reason'],
  },
  forma19_created: {
    titleKey: 'notif_forma19_created_title',
    bodyKey: 'notif_forma19_created_body',
    fields: ['act_name'],
  },
  // ── Construction reja/fakt (budget monitoring) ───────────────────────
  budget_exceeded: {
    titleKey: 'notif_budget_exceeded_title',
    bodyKey: 'notif_budget_exceeded_body',
    fields: ['stage_name', 'budget_pct'],
    format: { budget_pct: 'number' },
  },
  budget_warning: {
    titleKey: 'notif_budget_warning_title',
    bodyKey: 'notif_budget_warning_body',
    fields: ['stage_name', 'budget_pct'],
    format: { budget_pct: 'number' },
  },
  // ── Reconciliation ───────────────────────────────────────────────────
  reconciliation_reminder: {
    titleKey: 'notif_reconciliation_reminder_title',
    bodyKey: 'notif_reconciliation_reminder_body',
    fields: ['partner_name', 'days'],
    format: { days: 'number' },
  },
  reconciliation_no_response: {
    titleKey: 'notif_reconciliation_no_response_title',
    bodyKey: 'notif_reconciliation_no_response_body',
    fields: ['partner_name', 'days'],
    format: { days: 'number' },
  },
  reconciliation_response: {
    titleKey: 'notif_reconciliation_response_title',
    bodyKey: 'notif_reconciliation_response_body',
    fields: ['partner_name', 'response'],
  },
  // ── CRM ──────────────────────────────────────────────────────────────
  // Reminder fired by the activity-reminder background worker. The
  // `activity_type` field ('call', 'meeting', 'email', 'follow_up') is
  // mapped via t() to the user-facing label so the title is fully
  // translated regardless of the language the activity was created in.
  //
  // `titleFields` and `bodyFields` let the title and body fall back
  // to stored values independently. Notifications created before the
  // worker started packing `lead_name` still have `activity_type`, so
  // the title gets translated even when the body has to fall back.
  crm_activity_reminder: {
    titleKey: 'notif_crm_activity_reminder_title',
    bodyKey: 'notif_crm_activity_reminder_body',
    titleFields: ['activity_type'],
    bodyFields: ['activity_type', 'lead_name'],
    translate: {
      activity_type: (v) => v === 'follow_up' ? 'action_other' : `action_${v}`,
    },
  },
};

// The API ships `data` as a JSON string (ListNotifications does `data::text`).
// This normaliser handles that and the already-object case so callers don't
// have to care.
function normaliseData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function formatValue(value, kind, language) {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    // `Intl` is browser-native and handles locale-specific thousands
    // separators (space for uz/ru, comma for en).
    return new Intl.NumberFormat(language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US').format(n);
  }
  return String(value);
}

// `template` is a translated string like "Mahsulot {product_name} kam qoldi
// ({available} qoldi)". We replace each `{field}` with the matching value
// from `data`, applying the optional formatter or the optional translation
// helper. `translate[field]` is a function that takes the raw value and
// returns a translation key — useful when the value itself is an enum
// like activity_type='call' that we want rendered as a localized label.
function interpolate(template, data, formatters = {}, language = 'en', translate = {}, t = null) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const raw = data[key];
    if (raw === undefined || raw === null || raw === '') return '';
    if (translate[key] && typeof t === 'function') {
      const tkey = translate[key](raw);
      const translated = t(tkey);
      // If the dictionary doesn't have the key, t() returns the key
      // itself — fall back to the raw value rather than show "action_xxx".
      if (translated && translated !== tkey) return translated;
    }
    return formatValue(raw, formatters[key], language);
  });
}

/**
 * Turn a notification row from the API into the pair of display strings
 * that the dropdown / full list should show. Falls back to the stored
 * `title`/`message` whenever the catalog can't confidently re-render.
 *
 * @param {object} n         - notification row from /api/v1/notifications
 * @param {(key:string)=>string} t - translation fn from useTranslation(language)
 * @param {string} language  - 'en' | 'uz' | 'ru' (for number formatting)
 */
export function renderNotification(n, t, language) {
  if (!n) return { title: '', body: '' };
  const tmpl = NOTIFICATION_TEMPLATES[n.type];
  const storedTitle = n.title || '';
  const storedBody = n.message || '';

  if (!tmpl) return { title: storedTitle, body: storedBody };

  const data = normaliseData(n.data);

  // Per-field requirement check — title and body fall back
  // independently. `titleFields` / `bodyFields` override the legacy
  // shared `fields` array. This lets the title render in the user's
  // current language even when the body has to fall back to stored
  // text (e.g. old CRM reminders that have activity_type but no
  // lead_name in their data payload).
  const isMissing = (fields) =>
    (fields || []).some((f) => data[f] === undefined || data[f] === null || data[f] === '');
  const titleMissing = isMissing(tmpl.titleFields || tmpl.fields);
  const bodyMissing = isMissing(tmpl.bodyFields || tmpl.fields);

  // A translation key returned by the t() helper equal to the key itself
  // means the entry isn't in the dictionary yet → fall back rather than
  // show a raw `notif_xxx` string.
  const titleTemplate = t(tmpl.titleKey);
  const bodyTemplate = t(tmpl.bodyKey);
  const titleKeyMissing = titleTemplate === tmpl.titleKey;
  const bodyKeyMissing = bodyTemplate === tmpl.bodyKey;

  return {
    title: (titleMissing || titleKeyMissing)
      ? storedTitle
      : interpolate(titleTemplate, data, tmpl.format, language, tmpl.translate, t),
    body: (bodyMissing || bodyKeyMissing)
      ? storedBody
      : interpolate(bodyTemplate, data, tmpl.format, language, tmpl.translate, t),
  };
}
