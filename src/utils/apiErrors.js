// apiErrors.js
//
// Extract and localise API error messages. Handles three backend shapes the
// Go layer emits (see internal/pkg/response/response.go):
//
//   { error: "string" }                                          // legacy
//   { error: { code, message }, ... }                            // structured, no details
//   { error: { code, message, details: { key: "string" } } }     // structured with details
//
// On top of that, known error codes can be mapped to translation templates
// with `{placeholder}` interpolation against the `details` map — so the user
// sees a localised toast while the backend keeps emitting canonical English
// messages for logs and mobile fallback.
//
// Adding a new localised code:
//   1. Backend: emit `response.ErrorWithDetails(c, status, "MY_CODE", msg, details)`.
//   2. Register below with the translation key + the fields used in details.
//   3. Add the translation key to translations.jsx with {placeholder} tokens.

const ERROR_TEMPLATES = {
  INSUFFICIENT_STOCK: {
    // "Insufficient stock. Available: 151.00, Requested: 200.00"
    titleKey: 'error_insufficient_stock',
    fields: ['available', 'requested'],
  },
  TAX_REGIME_CONFLICT: {
    // TZ §5.2: NDS (sales) and Turnover tax can't both be active.
    // `applies_to` is what the user tried to activate, `conflict` is the
    // opposing bucket they need to deactivate first.
    titleKey: 'error_tax_regime_conflict',
    fields: ['applies_to', 'conflict'],
  },
  // Purchase-order line edits blocked by FK / business rules.
  PO_LINES_LOCKED_RECEIVED: {
    titleKey: 'error_po_lines_locked_received',
    fields: [],
  },
  PO_LINES_LOCKED_BILLED: {
    titleKey: 'error_po_lines_locked_billed',
    fields: [],
  },
  PO_INVALID_VENDOR: {
    titleKey: 'error_po_invalid_vendor',
    fields: [],
  },
};

function interpolate(template, details) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const v = details?.[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Convert a caught axios/fetch error into a display string.
 *
 * @param {unknown} err       - the error object (axios error, thrown error, etc.)
 * @param {(key:string)=>string} t - useTranslation()'s `t` fn
 * @param {string} fallback   - what to display when nothing else matches
 * @returns {string}
 */
export function formatApiError(err, t, fallback) {
  if (typeof err === 'string') return err || fallback;
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;

  const e = data.error;

  // Structured: { error: { code, message, details? } }
  if (e && typeof e === 'object') {
    const tmpl = ERROR_TEMPLATES[e.code];
    if (tmpl && typeof t === 'function') {
      const translated = t(tmpl.titleKey);
      // `t()` returns the KEY itself when the entry is missing — fall back
      // to the backend-canonical English message in that case rather than
      // leaking raw keys into the UI.
      if (translated && translated !== tmpl.titleKey) {
        return interpolate(translated, e.details || {});
      }
    }
    if (typeof e.message === 'string' && e.message) return e.message;
    return fallback;
  }

  // Legacy shapes
  if (typeof e === 'string' && e) return e;
  if (typeof data.message === 'string' && data.message) return data.message;
  return fallback;
}
