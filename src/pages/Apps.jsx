
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Briefcase,
  Users,
  DollarSign,
  Package,
  Search,
  Zap,
  CheckCircle,
  Download,
  Rocket,
  Loader2,
  ShoppingCart,
  ShoppingBag,
  Monitor,
  Receipt,
  FileText,
  Ship,
  Lock,
  Building2,
  BarChart3,
  Eye,
  EyeOff
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useInstalledApps } from '@/components/contexts/InstalledAppsContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';

const appsList = [
  {
    id: 'crm',
    nameKey: 'app_crm_name',
    descriptionKey: 'app_crm_description',
    version: '2.1',
    icon: Users,
    color: 'var(--genix-blue)',
    permissionModule: MODULES.CUSTOMERS
  },
  {
    id: 'inventory',
    nameKey: 'app_inventory_name',
    descriptionKey: 'app_inventory_description',
    version: '1.8',
    icon: Package,
    color: 'var(--genix-orange)',
    permissionModule: MODULES.INVENTORY
  },
  {
    id: 'finance',
    nameKey: 'app_finance_name',
    descriptionKey: 'app_finance_description',
    version: '2.0',
    icon: DollarSign,
    color: 'var(--genix-green)',
    permissionModule: MODULES.FINANCIALS
  },
  {
    id: 'hr',
    nameKey: 'app_hr_name',
    descriptionKey: 'app_hr_description',
    version: '1.5',
    icon: Briefcase,
    color: 'var(--genix-purple)',
    permissionModule: MODULES.HR
  },
  {
    id: 'manufacturing',
    nameKey: 'app_manufacturing_name',
    descriptionKey: 'app_manufacturing_description',
    version: '1.0',
    icon: Zap,
    color: '#334155',
    permissionModule: MODULES.INVENTORY
  },
  {
    id: 'procurement',
    nameKey: 'app_procurement_name',
    descriptionKey: 'app_procurement_description',
    version: '1.0',
    icon: ShoppingCart,
    color: '#6366f1',
    permissionModule: MODULES.PURCHASES
  },
  {
    id: 'projects',
    nameKey: 'app_projects_name',
    descriptionKey: 'app_projects_description',
    version: '1.0',
    icon: Briefcase,
    color: '#3b82f6',
    permissionModule: MODULES.PROJECTS
  },
  {
    id: 'sales_orders',
    nameKey: 'app_sales_orders_name',
    descriptionKey: 'app_sales_orders_description',
    version: '1.0',
    icon: ShoppingBag,
    color: '#10b981',
    permissionModule: MODULES.SALES
  },
  {
    id: 'assets',
    nameKey: 'app_assets_name',
    descriptionKey: 'app_assets_description',
    version: '1.0',
    icon: Monitor,
    color: '#f59e0b',
    permissionModule: MODULES.INVENTORY
  },
  {
    id: 'expenses',
    nameKey: 'app_expenses_name',
    descriptionKey: 'app_expenses_description',
    version: '1.0',
    icon: Receipt,
    color: '#14b8a6',
    permissionModule: MODULES.FINANCIALS
  },
  {
    id: 'payroll',
    nameKey: 'app_payroll_name',
    descriptionKey: 'app_payroll_description',
    version: '1.0',
    icon: DollarSign,
    color: '#8b5cf6',
    permissionModule: MODULES.HR
  },
  {
    id: 'contracts',
    nameKey: 'app_contracts_name',
    descriptionKey: 'app_contracts_description',
    version: '1.0',
    icon: FileText,
    color: '#ec4899',
    permissionModule: MODULES.CONTRACTS
  },
  {
    id: 'cargo',
    nameKey: 'app_cargo_name',
    descriptionKey: 'app_cargo_description',
    version: '1.0',
    icon: Ship,
    color: '#0ea5e9',
    permissionModule: MODULES.INVENTORY
  },
  {
    id: 'construction',
    nameKey: 'app_construction_name',
    descriptionKey: 'app_construction_description',
    version: '1.0',
    icon: Building2,
    color: '#f97316',
    permissionModule: MODULES.CONSTRUCTION
  },
  {
    id: 'director_dashboard',
    nameKey: 'app_director_dashboard_name',
    descriptionKey: 'app_director_dashboard_description',
    version: '1.0',
    icon: BarChart3,
    color: '#185FA5',
    permissionModule: MODULES.DIRECTOR_DASHBOARD
  }
];

const AppCard = ({ app, isInstalled, onAction, isLoading, hasPermission }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { companies } = useCompany();
  const { getOrgsHidingApp, setAppHiddenForOrg } = useInstalledApps();
  const [visibilityOpen, setVisibilityOpen] = React.useState(false);
  const [savingOrgId, setSavingOrgId] = React.useState(null);

  // The set of orgs that currently HIDE this app. Drives both the
  // hint text on the card ("Hidden in N companies") and the initial
  // state of the modal's checkboxes (checked = visible, i.e. NOT hidden).
  const hiddenOrgIds = React.useMemo(
    () => new Set(getOrgsHidingApp(app.id)),
    [getOrgsHidingApp, app.id]
  );

  const handleAction = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasPermission) return;
    await onAction(app, isInstalled ? 'uninstall' : 'install');
  };

  const handleToggleVisibility = async (orgId, nextVisible) => {
    // nextVisible=true means "show this app for that org"
    //                = remove from hidden_apps. And vice versa.
    setSavingOrgId(orgId);
    try {
      await setAppHiddenForOrg(app.id, orgId, !nextVisible);
    } catch (err) {
      console.error('Failed to update app visibility:', err);
    } finally {
      setSavingOrgId(null);
    }
  };

  const hiddenCount = hiddenOrgIds.size;

  return (
    <Card className={`hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white/80 backdrop-blur-sm border-slate-200/60 flex flex-col h-full ${!hasPermission ? 'opacity-60' : ''}`}>
      {/* Header - Vertical Layout */}
      <CardHeader className="pb-4 pt-6 px-6 flex-shrink-0">
        {/* Icon - Centered at top */}
        <div className="flex justify-center mb-4 relative">
          <div
            style={{ backgroundColor: hasPermission ? app.color : '#94a3b8' }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
          >
            <app.icon className="w-10 h-10 text-white" />
          </div>
          {!hasPermission && (
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-500 rounded-full flex items-center justify-center shadow-md">
              <Lock className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Title - Full width, centered */}
        <div className="text-center">
          <CardTitle className="text-lg font-bold text-slate-900 leading-tight mb-3">
            {t(app.nameKey)}
          </CardTitle>
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium">
            v{app.version}
          </Badge>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex flex-col flex-1 pt-0 pb-6 px-6">
        {/* Description */}
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-6 text-center">
          {t(app.descriptionKey)}
        </p>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Buttons - PERFECTLY ALIGNED WITH SPACE-BETWEEN */}
        <div className="pt-4 border-t border-slate-100 flex-shrink-0">
          {!hasPermission ? (
            <div className="flex items-center justify-center">
              <Badge className="bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center gap-2 h-10 px-4">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm whitespace-nowrap">{t('no_permission') || 'Ruxsat yo\'q'}</span>
              </Badge>
            </div>
          ) : isInstalled ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-50 text-green-700 border border-green-200 flex items-center justify-center gap-2 h-10 px-4 flex-1 min-w-0">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-semibold text-sm whitespace-nowrap">{t('installed')}</span>
                </Badge>
                <Button
                  variant="outline"
                  className="text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-medium h-10 px-4 flex-1 min-w-0"
                  onClick={handleAction}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span className="text-sm whitespace-nowrap">{t('uninstall')}</span>
                    </>
                  ) : (
                    <span className="text-sm whitespace-nowrap">{t('uninstall')}</span>
                  )}
                </Button>
              </div>
              {/* Per-org visibility row. Only shown when there's more
                  than one company — single-org tenants don't need to
                  manage per-org overrides. */}
              {(companies?.length || 0) > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setVisibilityOpen(true); }}
                  className="flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors py-1"
                >
                  {hiddenCount > 0 ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {hiddenCount > 0
                      ? `${hiddenCount} ta kompaniyada yashirilgan`
                      : 'Barcha kompaniyalarda koʻrinadi'}
                  </span>
                  <span className="underline ml-1">Boshqarish</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border border-slate-200 h-10 px-4 font-medium text-sm flex items-center justify-center flex-1 min-w-0">
                <span className="whitespace-nowrap">{t('not_installed')}</span>
              </Badge>
              <Button
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 shadow-md font-semibold h-10 px-4 flex-1 min-w-0"
                onClick={handleAction}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="text-sm whitespace-nowrap">{t('install')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    <span className="text-sm whitespace-nowrap">{t('install')}</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* Per-organization visibility modal (migration 386). Empty
          hidden_apps = visible everywhere. Unchecking a company hides
          this app from the sidebar when that company is the active
          one. The backend route is NOT gated; this is purely a UI
          visibility override. */}
      <Dialog open={visibilityOpen} onOpenChange={setVisibilityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {`Koʻrinish: ${t(app.nameKey)}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Belgilangan kompaniyalarda ushbu ilova sidebarda koʻrinadi. Belgini olib tashlasangiz, oʻsha kompaniyada yashiriladi (ilova oʻrnatilgan boʻlib qoladi).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(companies || []).map(co => {
              const visible = !hiddenOrgIds.has(co.id);
              return (
                <label
                  key={co.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  <Checkbox
                    checked={visible}
                    disabled={savingOrgId === co.id}
                    onCheckedChange={(checked) => handleToggleVisibility(co.id, !!checked)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">{co.company_name || co.company_code || '—'}</span>
                    {co.company_code ? (
                      <span className="text-xs text-slate-400">{co.company_code}</span>
                    ) : null}
                  </div>
                  {savingOrgId === co.id && (
                    <Loader2 className="w-3.5 h-3.5 ml-auto animate-spin text-slate-400" />
                  )}
                </label>
              );
            })}
            {(!companies || companies.length === 0) && (
              <div className="text-sm text-slate-500 px-2 py-4 text-center">
                Kompaniyalar yoʻq
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setVisibilityOpen(false)}>Yopish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default function Apps() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { isLoading: appsLoading, isAppInstalled, installApp, uninstallApp, isAppHiddenInActiveCompany } = useInstalledApps();
  const { canAccess } = usePermissions();

  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAppId, setLoadingAppId] = useState(null);

  const handleAppAction = async (app, action) => {
    setLoadingAppId(app.id);
    try {
      if (action === 'install') {
        await installApp({
          app_id: app.id,
          app_name: t(app.nameKey),
          description: t(app.descriptionKey),
          version: app.version,
          icon: app.icon?.name || '',
          color: app.color || ''
        });
      } else if (action === 'uninstall') {
        await uninstallApp(app.id);
      }
    } catch (error) {
      console.error(`Error ${action}ing app:`, error);
    } finally {
      setLoadingAppId(null);
    }
  };

  // Filter apps by search query, then drop apps that are hidden in
  // the currently active company (consistent with sidebar behavior).
  // To unhide, the admin switches active company to one where the app
  // is visible and toggles it back from there.
  const filteredApps = appsList.filter(app => {
    if (isAppHiddenInActiveCompany(app.id)) return false;
    return (
      t(app.nameKey).toLowerCase().includes(searchQuery.toLowerCase()) ||
      t(app.descriptionKey).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Check if user has permission for each app
  const appsWithPermission = useMemo(() => {
    return filteredApps.map(app => ({
      ...app,
      hasPermission: canAccess(app.permissionModule)
    }));
  }, [filteredApps, canAccess]);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* Search Section - Enhanced */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder={t('search_apps')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 text-base bg-white/90 backdrop-blur-sm border-slate-200/60 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)] shadow-sm hover:shadow-md transition-all duration-200"
          />
        </div>

        {appsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--genix-blue)] mx-auto mb-4" />
              <p className="text-sm text-slate-600">{t('loading')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ gridAutoRows: '1fr' }}>
            {appsWithPermission.map(app => (
              <AppCard
                key={app.id}
                app={app}
                isInstalled={isAppInstalled(app.id)}
                onAction={handleAppAction}
                isLoading={loadingAppId === app.id}
                hasPermission={app.hasPermission}
              />
            ))}
          </div>
        )}

        {appsWithPermission.length === 0 && !appsLoading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('no_apps_found')}</h3>
            <p className="text-sm text-slate-500">Try adjusting your search terms</p>
          </div>
        )}

      </div>
    </div>
  );
}
