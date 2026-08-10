import React, { useState } from 'react';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import { useAuth } from '@/components/contexts/AuthContext';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, CreditCard } from 'lucide-react';

/**
 * F5 (docs/admin-panel/audit.md): when a tenant's subscription has expired the
 * backend returns 402 on every data call. Previously each page just errored out
 * with raw toasts. This gate renders one clean full-screen "Obuna tugagan"
 * payment wall instead, with a checkout CTA — so a suspended company sees a
 * coherent screen, not broken widgets.
 *
 * Platform staff (is_system_admin) are never gated — they must be able to manage
 * the very tenants that are suspended.
 */
export default function SubscriptionGate({ children }) {
  const { isTrialExpired, trialStatus } = useSubscription();
  const { isSystemAdmin, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const blocked = typeof isTrialExpired === 'function' ? isTrialExpired() : false;
  const isPlatformStaff = typeof isSystemAdmin === 'function' ? isSystemAdmin() : false;

  if (!blocked || isPlatformStaff) {
    return children;
  }

  const startCheckout = async () => {
    setLoading(true);
    try {
      const users = trialStatus?.paid_users || 1;
      const resp = await apiClient.post('/subscription/checkout', { users, period: 'monthly' });
      const url = resp?.data?.data?.checkout_url || resp?.data?.checkout_url;
      if (url) {
        window.location.href = url;
        return;
      }
    } catch (e) {
      // fall through to the contact hint
    } finally {
      setLoading(false);
    }
    window.alert("To'lov sahifasini ochib bo'lmadi. Iltimos, Genix qo'llab-quvvatlash xizmatiga murojaat qiling.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Obuna muddati tugagan</h1>
        <p className="text-slate-600 mb-6">
          Kompaniyangiz obunasi tugadi va tizimga kirish vaqtincha to'xtatildi.
          Ishni davom ettirish uchun obunani yangilang. Ma'lumotlaringiz saqlanib qoladi.
        </p>

        {trialStatus?.status && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
            Holat: <span className="font-semibold text-slate-800">{trialStatus.status}</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={startCheckout} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            <CreditCard className="w-4 h-4 mr-2" />
            {loading ? 'Yuklanmoqda…' : "To'lovni amalga oshirish"}
          </Button>
          <Button variant="outline" onClick={() => logout && logout()} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Chiqish
          </Button>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Savollar bo'lsa Genix qo'llab-quvvatlash xizmatiga murojaat qiling.
        </p>
      </div>
    </div>
  );
}
