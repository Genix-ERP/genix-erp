import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { Segmented } from '@/components/shared/DashboardKit';
import { fixedAssetsV2Service as fa } from '@/api/services/fixedAssetsV2';
import AssetsRegistry from '@/components/assets/AssetsRegistry';
import AssetFormDialog from '@/components/assets/AssetFormDialog';
import AssetDetailPanel from '@/components/assets/AssetDetailPanel';
import DepreciationRunsTab from '@/components/assets/DepreciationRunsTab';
import { safeT, errMsg } from '@/components/assets/assetUtils';

/**
 * Aktivlar — the unified fixed-asset module (2026-08-03 rebuild,
 * docs/aktivlar-audit.md). One register (fa_assets), two tabs:
 *   - Aktivlar: stat strip, NBV trend, filterable registry, asset card panel
 *   - Amortizatsiya: the monthly run journal (draft → post → reverse)
 * The legacy "classic" tab, the /financials duplicate form and the years-based
 * form are gone; accounting mapping stays in Settings (owner-only), linked.
 */
export default function Assets() {
  const { language } = useLanguage();
  const { t: t0 } = useTranslation(language);
  const t = safeT(t0);
  const { formatCurrency } = useCurrencyFormatter();
  const navigate = useNavigate();
  const { isOwner, isSiteAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const mayCreate = canCreate(MODULES.ASSETS);
  const mayUpdate = canUpdate(MODULES.ASSETS);
  // Post/reverse/dispose map to the backend's finance.asset.approve — gated to
  // the highest frontend tier (the v2 panel used to render these for everyone).
  const mayApprove = canDelete(MODULES.ASSETS);
  const canEditSettings = !!(isOwner?.() || isSiteAdmin?.());

  const [tab, setTab] = useState('registry'); // 'registry' | 'depreciation'
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [openAssetId, setOpenAssetId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fa.listAssets(),
      fa.getStats().catch(() => null),
      fa.getMapping().catch(() => null),
    ])
      .then(([list, st, map]) => {
        setAssets(list);
        setStats(st);
        setMapping(map);
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('assets') || 'Aktivlar'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('fa_page_subtitle') || 'Asosiy vositalar registri va oylik amortizatsiya'}
          </p>
        </div>
        <Segmented
          options={[
            { id: 'registry', label: t('fixed_assets') || 'Asosiy vositalar' },
            { id: 'depreciation', label: t('depreciation') || 'Amortizatsiya' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'registry' ? (
        <AssetsRegistry
          assets={assets}
          stats={stats}
          loading={loading}
          mapping={mapping}
          t={t}
          formatCurrency={formatCurrency}
          canCreate={mayCreate}
          canEditSettings={canEditSettings}
          onAdd={() => setFormOpen(true)}
          onOpenAsset={setOpenAssetId}
          onOpenSettings={() => navigate('/settings?tab=asset-mapping')}
        />
      ) : (
        <DepreciationRunsTab
          t={t}
          canApprove={mayApprove}
          formatCurrency={formatCurrency}
          onPosted={load}
        />
      )}

      <AssetFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={load}
        mapping={mapping}
        t={t}
        canEditSettings={canEditSettings}
      />

      <AssetDetailPanel
        assetId={openAssetId}
        onClose={() => setOpenAssetId(null)}
        onChanged={load}
        t={t}
        canUpdate={mayUpdate}
        canApprove={mayApprove}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
