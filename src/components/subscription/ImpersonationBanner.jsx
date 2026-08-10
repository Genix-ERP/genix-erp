import React from 'react';
import { getAccessToken } from '@/api/client';
import { ShieldAlert } from 'lucide-react';

/**
 * Phase 3 (docs/admin-panel): while a Genix staff member is impersonating a
 * tenant ("mijoz sifatida kirish"), a persistent banner must be visible so it is
 * never ambiguous that this is a support session — and whether it is read-only.
 *
 * The impersonation access token carries `imp` (impersonator id) and `ro`
 * (read-only) claims. We decode the JWT payload client-side (no verification —
 * purely for display; the server is the authority) and render the banner.
 */
function decodeClaims(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function ImpersonationBanner() {
  const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
  const claims = token ? decodeClaims(token) : null;
  if (!claims || !claims.imp) {
    return null;
  }
  const readOnly = !!claims.ro;
  return (
    <div className={`w-full text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 ${readOnly ? 'bg-amber-600' : 'bg-rose-600'}`}>
      <ShieldAlert className="w-4 h-4" />
      <span>
        PLATFORMA — mijoz sifatida kirilgan{readOnly ? " (faqat ko'rish)" : ''}. Barcha amallar audit qilinadi.
      </span>
    </div>
  );
}
