import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/contexts/AuthContext';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useInstalledApps } from '@/components/contexts/InstalledAppsContext';
import { useTranslation } from '@/components/utils/translations';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Building2,
  Users,
  Target,
  ShoppingCart,
  Package,
  Truck,
  Factory,
  Briefcase,
  DollarSign,
  FolderKanban,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload,
  Loader2,
  Info,
  Crown
} from 'lucide-react';

// Import settings components
import GeneralSettings from '@/components/admin-settings/GeneralSettings';
import CRMSettings from '@/components/admin-settings/CRMSettings';
import SalesSettings from '@/components/admin-settings/SalesSettings';
import InventorySettings from '@/components/admin-settings/InventorySettings';
import PurchaseSettings from '@/components/admin-settings/PurchaseSettings';
import ManufacturingSettings from '@/components/admin-settings/ManufacturingSettings';
import HRSettings from '@/components/admin-settings/HRSettings';
import FinanceSettings from '@/components/admin-settings/FinanceSettings';
import ProjectSettings from '@/components/admin-settings/ProjectSettings';
import CompanySettings from '@/components/settings/CompanySettings';
import SubscriptionSettings from '@/components/settings/SubscriptionSettings';

// Map settings sections to app IDs
// 'general' is always shown, others depend on installed apps
const SECTIONS = [
  { id: 'general', icon: Building2, label: 'general_settings', component: GeneralSettings, appIds: null }, // null = always show
  { id: 'companies', icon: Building2, label: 'companies', component: CompanySettings, appIds: null },
  { id: 'subscription', icon: Crown, label: 'subscription', component: SubscriptionSettings, appIds: null },
  { id: 'crm', icon: Target, label: 'crm_settings', component: CRMSettings, appIds: ['crm'] },
  { id: 'sales', icon: ShoppingCart, label: 'sales_settings', component: SalesSettings, appIds: ['sales_orders'] },
  { id: 'inventory', icon: Package, label: 'inventory_settings', component: InventorySettings, appIds: ['inventory'] },
  { id: 'purchase', icon: Truck, label: 'purchase_settings', component: PurchaseSettings, appIds: ['procurement'] },
  { id: 'manufacturing', icon: Factory, label: 'manufacturing_settings', component: ManufacturingSettings, appIds: ['manufacturing'] },
  { id: 'hr', icon: Briefcase, label: 'hr_settings', component: HRSettings, appIds: ['hr', 'payroll', 'expenses'] },
  { id: 'finance', icon: DollarSign, label: 'finance_settings', component: FinanceSettings, appIds: ['finance', 'assets', 'expenses'] },
  { id: 'projects', icon: FolderKanban, label: 'project_settings', component: ProjectSettings, appIds: ['projects'] }
];

export default function AdminSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user, isSiteAdmin, isOwner } = useAuth();
  const { isAppInstalled, installedApps } = useInstalledApps();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(() => {
    // Initialize from URL tab parameter, default to 'general'
    return searchParams.get('tab') || 'general';
  });
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const {
    settings,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    canManageSettings,
    saveSettings,
    resetAllSettings,
    discardChanges,
    exportSettings,
    importSettings
  } = useAdminSettings();

  // Filter sections based on installed apps
  const visibleSections = useMemo(() => {
    return SECTIONS.filter(section => {
      // Always show sections with null appIds (like general)
      if (section.appIds === null) return true;
      // Show section if any of its related apps are installed
      return section.appIds.some(appId => isAppInstalled(appId));
    });
  }, [isAppInstalled, installedApps]);

  // Permission check
  useEffect(() => {
    if (!isLoading && user && !canManageSettings()) {
      navigate('/');
    }
  }, [isLoading, user, canManageSettings, navigate]);

  // Handle URL tab parameter changes (e.g., from navigation links)
  const tabFromUrl = searchParams.get('tab');
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeSection) {
      setActiveSection(tabFromUrl);
    }
  }, [tabFromUrl]); // Only react to URL tab changes

  // Sync URL when activeSection changes from UI clicks
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab !== activeSection) {
      setSearchParams({ tab: activeSection }, { replace: true });
    }
  }, [activeSection]); // Only depend on activeSection

  // Reset active section if it becomes unavailable
  useEffect(() => {
    const sectionIds = visibleSections.map(s => s.id);
    if (!sectionIds.includes(activeSection)) {
      setActiveSection('general');
    }
  }, [visibleSections, activeSection]);

  // Handle save
  const handleSave = async () => {
    const success = await saveSettings();
    if (success) {
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
  };

  // Handle import
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedSettings = JSON.parse(event.target.result);
          importSettings(importedSettings);
        } catch (err) {
          console.error('Error parsing imported file:', err);
        }
      };
      reader.readAsText(file);
    }
  };

  // Get active component
  const ActiveComponent = visibleSections.find(s => s.id === activeSection)?.component;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-600">{t('loading_settings')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">{/* Hidden input for import */}
      <input
        type="file"
        id="import-settings"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Success/Error messages */}
      {showSaveSuccess && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {t('settings_saved_successfully')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Action buttons bar */}
        <div className="mb-6 flex items-center justify-between bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            {hasUnsavedChanges() && (
              <Badge variant="outline" className="bg-yellow-50 border-yellow-400 text-yellow-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {t('unsaved_changes') || 'Saqlanmagan o\'zgarishlar'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('import-settings').click()}
              className="text-slate-600"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('import') || 'Import'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportSettings}
              className="text-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('export') || 'Eksport'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={discardChanges}
              disabled={!hasUnsavedChanges() || isSaving}
              className="text-slate-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('discard') || 'Bekor qilish'}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges() || isSaving}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t('save_settings') || 'Saqlash'}
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-xl shadow-sm border p-2 sticky top-6">
              {visibleSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-sm">{t(section.label)}</span>
                  </button>
                );
              })}
            </nav>

            {/* Info about installed apps */}
            {visibleSections.length === 1 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    {t('install_apps_for_settings') || 'Install modules from the Apps page to see their settings here.'}
                  </p>
                </div>
              </div>
            )}

            {/* Reset all button */}
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllSettings}
                className="w-full text-slate-600 hover:text-red-600 hover:border-red-200"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t('reset_all_defaults')}
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </div>
    </div>
  );
}
