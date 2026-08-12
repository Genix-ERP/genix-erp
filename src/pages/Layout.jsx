

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  DollarSign,
  Briefcase,
  Grid3x3,
  Zap,
  Workflow,
  FolderKanban,
  Settings,
  Bot,
  ShoppingCart,
  ShoppingBag,
  Monitor,
  Receipt,
  FileText,
  Ship,
  Building2,
  BarChart3,
  Sparkles,
  Phone,
  Loader2
} from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import NotificationBell from "@/components/ui/NotificationBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import LanguageSelector from "@/components/ui/language-selector";
import CompanySwitcher from "@/components/ui/company-switcher";
import PhoneWidget from "@/components/crm/PhoneWidget";

// The AI widget drags AgentWorkspace → AgentBlocks → recharts + ReactMarkdown
// into whatever chunk imports it, so it must stay OUT of the eager layout
// graph — it loads on first open only.
const AIChatBox = React.lazy(() => import("@/components/ai/AIChatBox"));
import { useLanguage } from "@/components/contexts/LanguageContext";
import { InstalledAppsProvider, useInstalledApps } from "@/components/contexts/InstalledAppsContext";
import { CustomersProvider } from "@/components/contexts/CustomersContext";
import { VendorsProvider } from "@/components/contexts/VendorsContext";
import { InventoryProvider } from "@/components/contexts/InventoryContext";
import { FinancialsProvider } from "@/components/contexts/FinancialsContext";
import { ModulesProvider } from "@/components/contexts/ModulesContext";
import { SubscriptionProvider } from "@/components/contexts/SubscriptionContext";
import SubscriptionGate from "@/components/subscription/SubscriptionGate";
import ImpersonationBanner from "@/components/subscription/ImpersonationBanner";
import { CompanyProvider } from "@/components/contexts/CompanyContext";
import { RolesProvider } from "@/components/contexts/RolesContext";
import { ProcurementProvider } from "@/components/contexts/ProcurementContext";
import { SalesProvider } from "@/components/contexts/SalesContext";
import { ManufacturingProvider } from "@/components/contexts/ManufacturingContext";
import { HRProvider } from "@/components/contexts/HRContext";
import { AdminSettingsProvider, useAdminSettings } from "@/components/contexts/AdminSettingsContext";
import { resolveBrandLogoUrl, readStoredBrandLogo, applyFavicon, applyBrowserTitle, readStoredFavicon, readStoredTitle } from "@/utils/brandLogo";
import { CargoProvider } from "@/components/contexts/CargoContext";
import { ConstructionProvider } from "@/components/contexts/ConstructionContext";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from "@/components/contexts/AuthContext";
import { useEmployeePermissions } from "@/components/contexts/EmployeePermissionsContext";
import ErrorBoundary from "@/components/ErrorBoundary";

// Navigation link that closes mobile sidebar on click. Rendered through
// SidebarMenuButton's asChild (Radix Slot), which forwards a ref plus merged
// props (tooltip event handlers etc.) — so this must be a forwardRef
// component that spreads them onto the underlying Link.
const NavLink = React.forwardRef(function NavLink(
  { item, isActive, isPending, className = '', onClick, ...rest },
  ref
) {
  const { setOpenMobile, isMobile, state } = useSidebar();
  // When the desktop sidebar is collapsed to the icon rail, drop the label,
  // badge and side padding so only the centred icon shows.
  const collapsed = state === 'collapsed' && !isMobile;

  const handleClick = (e) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    onClick?.(e);
  };

  return (
    <Link
      ref={ref}
      {...rest}
      to={item.url}
      title={collapsed ? item.title : undefined}
      className={`${className} flex items-center w-full cursor-pointer py-3 ${
        collapsed ? 'justify-center px-0' : 'justify-between px-3'
      } ${
        isActive ? '!bg-gradient-to-r !from-[var(--genix-blue)]/20 !to-[var(--genix-purple)]/20 !text-[var(--genix-blue)] !font-semibold !shadow-md !border-l-4 !border-[var(--genix-blue)]' : ''
      }`}
      onClick={handleClick}
    >
      <div className={`flex items-center ${collapsed ? 'gap-0' : 'gap-3'}`}>
        {/* While the destination chunk downloads (router transition keeps the
            old page on screen) the clicked item's icon becomes a spinner, so
            the click visibly "took". */}
        {isPending ? (
          <Loader2 className="w-5 h-5 shrink-0 animate-spin text-[var(--genix-blue)]" />
        ) : (
          <item.icon className="w-5 h-5 shrink-0" />
        )}
        {!collapsed && <span className="font-medium text-sm">{item.title}</span>}
      </div>
      {!collapsed && item.badge && (
        <Badge
          variant="secondary"
          className={`text-[10px] px-2 py-0 h-5 border ${
            item.badge === "New"
              ? "bg-[var(--genix-green)]/10 text-[var(--genix-green)] border-[var(--genix-green)]/20"
              : item.badge === "Admin"
              ? "bg-[var(--genix-purple)]/10 text-[var(--genix-purple)] border-[var(--genix-purple)]/20"
              : "bg-[var(--genix-orange)]/10 text-[var(--genix-orange)] border-[var(--genix-orange)]/20"
          }`}
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );
});

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { isAppInstalled, isAppHiddenInActiveCompany } = useInstalledApps();
  const [isAIChatOpen, setIsAIChatOpen] = React.useState(false);
  const [isPhoneOpen, setIsPhoneOpen] = React.useState(false);
  const [aiInitialPrompt, setAIInitialPrompt] = React.useState(null);
  // Path the user clicked but the router hasn't committed yet. RR v7 wraps
  // navigation in startTransition, so while a lazy page chunk downloads the
  // old location stays rendered — this state is the only visible feedback.
  const [pendingPath, setPendingPath] = React.useState(null);
  const { user: currentUser, isSiteAdmin, isOwner, isSystemAdmin } = useAuth();
  const { canAccessModule, isAdmin } = useEmployeePermissions();
  const { settings: adminSettings } = useAdminSettings();
  // Always fall back to the public localStorage cache when settings don't
  // (yet) have a logo. The cache is only updated after an authoritative
  // backend response, so it doesn't get stale-cleared during initial mount.
  const settingsLogo = adminSettings?.general?.company?.logo_url || null;
  const brandLogoUrl = resolveBrandLogoUrl(settingsLogo || readStoredBrandLogo());
  const settingsFavicon = adminSettings?.general?.company?.favicon_url || null;
  const settingsTitle = adminSettings?.general?.company?.browser_title || null;

  // Apply the configurable browser title (falls back to the cached value, then
  // to the default inside applyBrowserTitle).
  React.useEffect(() => {
    applyBrowserTitle(settingsTitle || readStoredTitle());
  }, [settingsTitle]);

  // Apply the configurable browser favicon.
  React.useEffect(() => {
    applyFavicon(settingsFavicon || readStoredFavicon());
  }, [settingsFavicon]);

  // Force re-render when user role changes by including user in dependency tracking
  const userRole = currentUser?.role;
  const isUserOwner = isOwner();
  const isUserSiteAdmin = isSiteAdmin();
  // SEC-04: platform control-plane visibility is gated on the real
  // is_system_admin flag, never a tenant role.
  const isUserSystemAdmin = isSystemAdmin();

  // Expose AI chatbox opener globally
  React.useEffect(() => {
    window.openAIChat = (prompt = null) => {
      setAIInitialPrompt(prompt);
      setIsAIChatOpen(true);
    };

    return () => {
      delete window.openAIChat;
    };
  }, []);

  // NOTE: notification polling lives entirely inside <NotificationBell/>;
  // an earlier duplicate poll loop here was removed. Likewise the layout no
  // longer subscribes to Inventory/Modules/Financials contexts — a dead
  // "dynamicInsights" memo used to re-render the whole sidebar+header on
  // every update of the three heaviest stores.

  // A navigation is pending until the router commits the new location.
  React.useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

  // Safety valve: if a chunk request dies (offline, deploy in progress) the
  // router never commits — don't leave the spinner running forever.
  React.useEffect(() => {
    if (!pendingPath) return undefined;
    const id = setTimeout(() => setPendingPath(null), 15000);
    return () => clearTimeout(id);
  }, [pendingPath]);

  const handleNavClick = React.useCallback(
    (url) => {
      if (url !== location.pathname) setPendingPath(url);
    },
    [location.pathname]
  );

  // Map app IDs to navigation items with permission module keys
  // moduleId should match the module IDs in EmployeePermissionsContext
  const appNavigationMap = React.useMemo(() => ({
    'inventory': {
      title: t("inventory"),
      url: createPageUrl("Inventory"),
      icon: Package,
      badge: null,
      moduleId: 'inventory'
    },
    'crm': {
      title: t("crm"),
      url: createPageUrl("Customers"),
      icon: Users,
      badge: null,
      moduleId: 'crm'
    },
    'finance': {
      title: t("financials"),
      url: createPageUrl("Financials"),
      icon: DollarSign,
      badge: null,
      moduleId: 'finance'
    },
    'hr': {
      title: t("hr"),
      url: createPageUrl("HR"),
      icon: Briefcase,
      badge: null,
      moduleId: 'hr',
      // HR subpages must keep the sidebar item highlighted
      aliases: ['/leave-management', '/attendance', '/employee-contracts'],
    },
    'manufacturing': {
      title: t("manufacturing"),
      url: createPageUrl("Manufacturing"),
      icon: Zap,
      badge: null,
      moduleId: 'manufacturing'
    },
    'procurement': {
      title: t("procurement"),
      url: createPageUrl("Procurement"),
      icon: ShoppingCart,
      badge: null,
      moduleId: 'purchase'
    },
    'tasks': {
      title: t("tasks_module"),
      url: createPageUrl("Tasks"),
      icon: FolderKanban,
      badge: null,
      moduleId: 'tasks'
    },
    'sales_orders': {
      title: t("sales_orders"),
      url: createPageUrl("SalesOrders"),
      icon: ShoppingBag,
      badge: null,
      moduleId: 'sales'
    },
    'pos': {
      title: 'Point of Sale',
      url: createPageUrl("POS"),
      icon: ShoppingCart,
      badge: null,
      moduleId: 'sales'
    },
    'assets': {
      title: t("assets"),
      url: createPageUrl("Assets"),
      icon: Monitor,
      badge: null,
      moduleId: 'assets'
    },
    'expenses': {
      title: t("expenses"),
      url: createPageUrl("Expenses"),
      icon: Receipt,
      badge: null,
      moduleId: 'expenses'
    },
    // NOTE: ТЗ_Ish_Haqi_Soliq_Tolik.docx §8.1 lists "Фойда солиғи" as a
    // TAB ("Солиқ ҳисоби") inside an existing screen, not a standalone
    // sidebar module. The route /profit-tax still exists so the page can
    // be linked from inside another page (Financials/Expenses), but we
    // don't surface it as a top-level sidebar entry.
    'payroll': {
      title: t("payroll"),
      url: createPageUrl("Payroll"),
      icon: DollarSign,
      badge: null,
      moduleId: 'payroll'
    },
    'contracts': {
      title: t("contracts"),
      url: createPageUrl("Contracts"),
      icon: FileText,
      badge: null,
      moduleId: 'contracts'
    },
    'cargo': {
      title: t("cargo") || 'Cargo',
      url: createPageUrl("Cargo"),
      icon: Ship,
      badge: null,
      moduleId: 'cargo'
    },
    'construction': {
      title: t("construction") || 'Qurilish',
      url: createPageUrl("Construction"),
      icon: Building2,
      badge: null,
      moduleId: 'construction'
    },
    'director_dashboard': {
      title: t("director_dashboard") || 'Direktor paneli',
      url: createPageUrl("DirectorDashboard"),
      icon: BarChart3,
      badge: null,
      moduleId: 'director_dashboard'
    }
  }), [t]);

  // Always visible core items
  const coreNavigationItems = React.useMemo(() => [
    {
      title: t("dashboard"),
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
      badge: null
    },
    {
      title: t("workflows"),
      url: createPageUrl("Workflows"),
      icon: Workflow,
      badge: null
    },
    {
      title: t("ai_assistant"),
      url: createPageUrl("AIAssistant"),
      icon: Bot
    }
  ], [t]);

  // Admin-only items (visible to site_admin and owner)
  const adminNavigationItems = React.useMemo(() => [
    {
      title: t("apps"),
      url: createPageUrl("Apps"),
      icon: Grid3x3,
      badge: null
    },
    {
      title: t("settings"),
      url: createPageUrl("Settings"),
      icon: Settings,
      badge: null
    }
  ], [t]);

  // Build dynamic navigation based on installed apps AND user permissions
  // Use useMemo to properly track dependencies and re-render when user role changes
  const navigationItems = React.useMemo(() => {
    const dynamicItems = [];

    // Add Dashboard first (always visible)
    dynamicItems.push(coreNavigationItems[0]);

    // Add app modules based on installation status and permissions
    const isPrivilegedUser = isAdmin || isUserSiteAdmin || isUserOwner;
    Object.keys(appNavigationMap).forEach(appId => {
      // Skip POS here, we'll add it separately after sales_orders
      if (appId === 'pos') return;

      const appConfig = appNavigationMap[appId];
      const installed = isAppInstalled(appId);
      const hasModulePermission = canAccessModule(appConfig.moduleId);
      // Per-org hide override (migration 386). Even if the app is
      // installed tenant-wide and the user has permission, an admin
      // can hide specific apps inside specific companies (e.g. the
      // Cargo subsidiary doesn't show Construction).
      const hiddenInActiveCompany = isAppHiddenInActiveCompany(appId);

      // Privileged users: show if app is installed (they have access to everything)
      // Employees: show if they have explicit module permission (permission implies installation)
      const hasAccess = isPrivilegedUser || hasModulePermission;
      const shouldShow = isPrivilegedUser ? installed : (installed || hasModulePermission);

      if (shouldShow && hasAccess && !hiddenInActiveCompany) {
        dynamicItems.push(appConfig);
      }
    });

    // Add Workflows (only for admins and system admins)
    const hasWorkflowAccess = isUserSiteAdmin || isUserOwner ||
      userRole === 'admin' || userRole === 'system_admin';
    if (hasWorkflowAccess) {
      dynamicItems.push(coreNavigationItems[1]);
    }

    // Add Apps and Settings only for admins (site_admin or owner)
    if (isUserOwner) {
      dynamicItems.push(...adminNavigationItems);
    }

    // Add AI Assistant at the bottom
    dynamicItems.push(coreNavigationItems[2]);

    return dynamicItems;
  }, [coreNavigationItems, adminNavigationItems, appNavigationMap, isAdmin, isUserSiteAdmin, isUserSystemAdmin, isUserOwner, userRole, canAccessModule, isAppInstalled, isAppHiddenInActiveCompany, t]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-white to-slate-100">
        <style>
          {`
            :root {
              --genix-navy: #0B1426;
              --genix-blue: #0EA5E9;
              --genix-light-blue: #E0F2FE;
              --genix-purple: #8B5CF6;
              --genix-green: #10B981;
              --genix-orange: #F59E0B;
            }
            .brand-logo-transparent {
              mix-blend-mode: multiply;
              filter: contrast(1.1);
            }
            .nav-progress {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 3px;
              z-index: 100;
              overflow: hidden;
              background: transparent;
              pointer-events: none;
            }
            .nav-progress::after {
              content: '';
              display: block;
              height: 100%;
              width: 40%;
              background: linear-gradient(90deg, var(--genix-blue), var(--genix-purple));
              border-radius: 2px;
              animation: nav-progress-slide 1s ease-in-out infinite;
            }
            @keyframes nav-progress-slide {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}
        </style>
        {/* Indeterminate bar while a sidebar navigation waits for its chunk */}
        {pendingPath && <div className="nav-progress" aria-hidden="true" />}
        
        <Sidebar collapsible="icon" className="border-r border-slate-200/60 bg-white/80 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
          <SidebarHeader className="border-b border-slate-100 px-4 py-3 group-data-[collapsible=icon]:px-2">
            <div className="flex items-center justify-center w-full overflow-hidden">
              <img
                src={brandLogoUrl}
                alt="Logo"
                className="w-full max-w-[96px] h-auto object-contain brand-logo-transparent group-data-[collapsible=icon]:max-w-[32px]"
              />
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4 group-data-[collapsible=icon]:p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 mb-1 group-data-[collapsible=icon]:hidden">
                {t("core_modules") || "Core Modules"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url ||
                      item.aliases?.some(a => location.pathname === a || location.pathname.startsWith(a + '/'));
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          className={`relative group hover:bg-[var(--genix-light-blue)]/50 hover:text-[var(--genix-blue)] transition-all duration-200 rounded-xl mb-1 h-11 ${
                            isActive ? 'bg-gradient-to-r from-[var(--genix-blue)]/20 to-[var(--genix-purple)]/20 text-[var(--genix-blue)] font-semibold shadow-md border-l-4 border-[var(--genix-blue)]' : 'text-slate-600'
                          }`}
                        >
                          <NavLink
                            item={item}
                            isActive={isActive}
                            isPending={pendingPath === item.url}
                            onClick={() => handleNavClick(item.url)}
                          />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200/60 p-4 hidden md:block">
            {/* Footer content can be added here if needed */}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0" aria-label="Main content">
          <ImpersonationBanner />
          <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 h-14 md:h-16 px-3 md:px-6 flex items-center justify-between gap-3" role="banner">
            {/* Left: sidebar toggle + page title */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger className="h-9 w-9 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors" />
              <div className="w-px h-5 bg-slate-200 shrink-0 hidden sm:block" />
              <h1 className="text-base md:text-lg font-semibold tracking-tight text-[var(--genix-navy)] truncate">
                {currentPageName === 'AIAssistant' ? t('ai_assistant') :
                 currentPageName === 'DirectorDashboard' ? t('director_dashboard') :
                 currentPageName === 'Customers' ? t('crm') /* sidebar says CRM — the header must match */ :
                 currentPageName === 'LeaveManagement' ? t('leave_management') :
                 currentPageName === 'Attendance' ? t('attendance') :
                 currentPageName === 'EmployeeContracts' ? t('employee_contracts') :
                 (t(currentPageName?.toLowerCase()) || t("dashboard"))}
              </h1>
            </div>

            {/* Right: actions, grouped by dividers. One AI entry point —
                the pill opens the quick chat; the full AI page stays in
                the sidebar, so the old duplicate Bot icon is gone. */}
            <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
              <Button
                onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                title={t('ai_assistant')}
                className="h-9 rounded-full px-3 md:px-3.5 gap-1.5 text-xs font-semibold text-white shadow-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">{t('ai_assistant')}</span>
              </Button>

              <div className="w-px h-5 bg-slate-200 mx-1 md:mx-1.5 hidden sm:block" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPhoneOpen(!isPhoneOpen)}
                className={`h-9 w-9 rounded-lg transition-colors ${
                  isPhoneOpen
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={t('phone') || 'Telefon'}
              >
                <Phone className="w-4 h-4" />
              </Button>
              <NotificationBell />
              <LanguageSelector compact />

              <div className="w-px h-5 bg-slate-200 mx-1 md:mx-1.5 hidden md:block" />

              <div className="hidden md:flex items-center gap-0.5">
                <CompanySwitcher compact />
                <UserMenu compact />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <ErrorBoundary location={location}>
              <SubscriptionGate>
                {children}
              </SubscriptionGate>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Phone Widget */}
      <PhoneWidget
        isOpen={isPhoneOpen}
        onClose={() => setIsPhoneOpen(false)}
      />

      {/* AI ChatBox — mounted (and its chunk fetched) only on first open */}
      {isAIChatOpen && (
        <React.Suspense fallback={null}>
          <AIChatBox
            isOpen={isAIChatOpen}
            onClose={() => {
              setIsAIChatOpen(false);
              setAIInitialPrompt(null);
            }}
            initialPrompt={aiInitialPrompt}
          />
        </React.Suspense>
      )}
    </SidebarProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <SubscriptionProvider>
      <CompanyProvider>
        <AdminSettingsProvider>
          <RolesProvider>
            <InstalledAppsProvider>
              <CustomersProvider>
                <VendorsProvider>
                  <InventoryProvider>
                  <FinancialsProvider>
                    <ModulesProvider>
                      <ProcurementProvider>
                        <SalesProvider>
                          <ManufacturingProvider>
                            <HRProvider>
                              <CargoProvider>
                                <ConstructionProvider>
                                  <LayoutContent currentPageName={currentPageName}>{children}</LayoutContent>
                                </ConstructionProvider>
                              </CargoProvider>
                            </HRProvider>
                          </ManufacturingProvider>
                        </SalesProvider>
                      </ProcurementProvider>
                    </ModulesProvider>
                  </FinancialsProvider>
                </InventoryProvider>
                </VendorsProvider>
              </CustomersProvider>
            </InstalledAppsProvider>
          </RolesProvider>
        </AdminSettingsProvider>
      </CompanyProvider>
    </SubscriptionProvider>
  );
}

