

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
  Settings,
  Bell,
  Search,
  Bot,
  Menu,
  X,
  ShoppingCart,
  ShoppingBag,
  Monitor,
  Receipt,
  FileText,
  Shield,
  LogOut,
  Cog,
  Ship
} from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import AIChatBox from "@/components/ai/AIChatBox";
import { LanguageProvider, useLanguage } from "@/components/contexts/LanguageContext";
import { InstalledAppsProvider, useInstalledApps } from "@/components/contexts/InstalledAppsContext";
import { CustomersProvider } from "@/components/contexts/CustomersContext";
import { VendorsProvider } from "@/components/contexts/VendorsContext";
import { InventoryProvider } from "@/components/contexts/InventoryContext";
import { FinancialsProvider } from "@/components/contexts/FinancialsContext";
import { ModulesProvider } from "@/components/contexts/ModulesContext";
import { AIProvider } from "@/components/contexts/AIContext";
import { SubscriptionProvider } from "@/components/contexts/SubscriptionContext";
import { CompanyProvider } from "@/components/contexts/CompanyContext";
import { RolesProvider } from "@/components/contexts/RolesContext";
import { ProcurementProvider } from "@/components/contexts/ProcurementContext";
import { SalesProvider } from "@/components/contexts/SalesContext";
import { ManufacturingProvider } from "@/components/contexts/ManufacturingContext";
import { HRProvider } from "@/components/contexts/HRContext";
import { ProjectsProvider } from "@/components/contexts/ProjectsContext";
import { AdminSettingsProvider } from "@/components/contexts/AdminSettingsContext";
import { CargoProvider } from "@/components/contexts/CargoContext";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from "@/components/contexts/AuthContext";
import { useInventory } from "@/components/contexts/InventoryContext";
import { useModules } from "@/components/contexts/ModulesContext";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import ErrorBoundary from "@/components/ErrorBoundary";

// Navigation link that closes mobile sidebar on click
function NavLink({ item, isActive }) {
  const { setOpenMobile, isMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Link
      to={item.url}
      className={`flex items-center justify-between px-3 py-3 w-full ${
        isActive ? '!bg-gradient-to-r !from-[var(--genix-blue)]/20 !to-[var(--genix-purple)]/20 !text-[var(--genix-blue)] !font-semibold !shadow-md !border-l-4 !border-[var(--genix-blue)]' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <item.icon className="w-5 h-5" />
        <span className="font-medium text-sm">{item.title}</span>
      </div>
      {item.badge && (
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
}

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { installedApps, isAppInstalled } = useInstalledApps();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAIChatOpen, setIsAIChatOpen] = React.useState(false);
  const [aiInitialPrompt, setAIInitialPrompt] = React.useState(null);
  const { user: currentUser, logout, isSiteAdmin, isOwner } = useAuth();

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

  // Get data for dynamic AI insights
  const { items: inventory } = useInventory();
  const { salesOrders } = useModules();
  const { financialTransactions } = useFinancials();

  // Calculate dynamic insights
  const dynamicInsights = React.useMemo(() => {
    const lowStockCount = inventory.filter(i => i.current_stock <= (i.reorder_level || 10)).length;

    const monthlyRevenue = {};
    financialTransactions.filter(t => t.transaction_type === 'income').forEach(t => {
      const month = new Date(t.date).toLocaleString('default', { month: 'short' });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + t.amount;
    });
    const months = Object.keys(monthlyRevenue);
    const lastMonth = monthlyRevenue[months[months.length - 1]] || 0;
    const prevMonth = monthlyRevenue[months[months.length - 2]] || 0;
    const revenueGrowth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth * 100).toFixed(0) : 0;

    const activeOrders = salesOrders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length;

    return { lowStockCount, revenueGrowth, activeOrders };
  }, [inventory, financialTransactions, salesOrders]);

  // Map app IDs to navigation items
  const appNavigationMap = {
    'inventory': {
      title: t("inventory"),
      url: createPageUrl("Inventory"),
      icon: Package,
      badge: "3"
    },
    'crm': {
      title: t("crm"),
      url: createPageUrl("Customers"),
      icon: Users,
      badge: null
    },
    'finance': {
      title: t("financials"),
      url: createPageUrl("Financials"),
      icon: DollarSign,
      badge: null
    },
    'hr': {
      title: t("hr"),
      url: createPageUrl("HR"),
      icon: Briefcase,
      badge: null
    },
    'manufacturing': {
      title: t("manufacturing"),
      url: createPageUrl("Manufacturing"),
      icon: Zap,
      badge: null
    },
    'procurement': {
      title: t("procurement"),
      url: createPageUrl("Procurement"),
      icon: ShoppingCart,
      badge: null
    },
    'projects': {
      title: t("projects"),
      url: createPageUrl("Projects"),
      icon: Briefcase,
      badge: null
    },
    'sales_orders': {
      title: t("sales_orders"),
      url: createPageUrl("SalesOrders"),
      icon: ShoppingBag,
      badge: null
    },
    'assets': {
      title: t("assets"),
      url: createPageUrl("Assets"),
      icon: Monitor,
      badge: null
    },
    'expenses': {
      title: t("expenses"),
      url: createPageUrl("Expenses"),
      icon: Receipt,
      badge: null
    },
    'payroll': {
      title: t("payroll"),
      url: createPageUrl("Payroll"),
      icon: DollarSign,
      badge: null
    },
    'contracts': {
      title: t("contracts"),
      url: createPageUrl("Contracts"),
      icon: FileText,
      badge: null
    },
    'cargo': {
      title: t("cargo") || 'Cargo',
      url: createPageUrl("Cargo"),
      icon: Ship,
      badge: null
    }
  };

  // Always visible core items
  const coreNavigationItems = [
    {
      title: t("dashboard"),
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
      badge: null
    },
    {
      title: t("workflows"),
      url: createPageUrl("Workflows"),
      icon: Zap,
      badge: null
    },
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
    },
    {
      title: t("ai_assistant"),
      url: createPageUrl("AIAssistant"),
      icon: Bot,
      badge: "New"
    }
  ];

  // Build dynamic navigation based on installed apps
  const getNavigationItems = () => {
    const dynamicItems = [];

    // Add Dashboard first
    dynamicItems.push(coreNavigationItems[0]);

    // Add installed app modules
    Object.keys(appNavigationMap).forEach(appId => {
      if (isAppInstalled(appId)) {
        dynamicItems.push(appNavigationMap[appId]);
      }
    });

    // Add Workflows, Apps, Settings (excluding AI Assistant for now)
    dynamicItems.push(...coreNavigationItems.slice(1, 4));

    // Note: Admin Settings removed - "Settings" now opens AdminSettings directly

    // Add Admin Panel if user is site admin
    if (isSiteAdmin()) {
      dynamicItems.push({
        title: t("admin_panel"),
        url: createPageUrl("AdminPanel"),
        icon: Shield,
        badge: "Admin"
      });
    }

    // Add AI Assistant at the bottom
    dynamicItems.push(coreNavigationItems[4]);

    return dynamicItems;
  };

  const navigationItems = getNavigationItems();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-slate-100">
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
            .genix-logo-transparent {
              mix-blend-mode: multiply;
              filter: brightness(1.1) contrast(1.05);
            }
          `}
        </style>
        
        <Sidebar className="border-r border-slate-200/60 bg-white/80 backdrop-blur-xl">
          <SidebarHeader className="border-b border-slate-200/60 px-4 py-3">
            <div className="flex flex-col gap-2">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68d244cb8a392237a5acfbd9/a049d6898_Logo.png"
                alt="Genix Logo"
                className="h-36 w-auto object-contain genix-logo-transparent -mt-2"
              />
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-transparent opacity-30"></div>
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-slate-400 whitespace-nowrap">
                  AI-Powered ERP
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-[var(--genix-blue)] to-transparent opacity-30"></div>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <div className="mb-6 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={t("search") + " " + t("ask_anything").toLowerCase()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-[var(--genix-blue)]/20 focus:border-[var(--genix-blue)] h-9 text-sm"
                />
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 mb-1">
                {t("core_modules") || "Core Modules"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`relative group hover:bg-[var(--genix-light-blue)]/50 hover:text-[var(--genix-blue)] transition-all duration-200 rounded-xl mb-1 h-11 ${
                            isActive ? 'bg-gradient-to-r from-[var(--genix-blue)]/20 to-[var(--genix-purple)]/20 text-[var(--genix-blue)] font-semibold shadow-md border-l-4 border-[var(--genix-blue)]' : 'text-slate-600'
                          }`}
                        >
                          <NavLink item={item} isActive={isActive} />
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

        <main className="flex-1 flex flex-col min-w-0">
          <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="md:hidden hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
                <div className="hidden md:block">
                  <h1 className="text-xl md:text-2xl font-bold text-[var(--genix-navy)]">
                    {currentPageName === 'AdminPanel' ? t('admin_panel') : (t(currentPageName?.toLowerCase()) || t("dashboard"))}
                  </h1>
                  {currentPageName !== 'AIAssistant' && (
                    <p className="text-slate-500 text-xs md:text-sm mt-0.5 hidden lg:block">
                      {t("welcome_to_ai_erp") || "Welcome to your AI-powered ERP"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                {/* Company Switcher - Like Odoo in navbar */}
                <div className="hidden md:block">
                  <CompanySwitcher />
                </div>
                <LanguageSelector />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                  className="relative hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-500 hover:text-white rounded-full transition-all duration-200"
                  title={t('ai_assistant')}
                >
                  <Bot className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <Link to={createPageUrl("Notifications")}>
                  <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full transition-all duration-200">
                    <Bell className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                </Link>
                <div className="hidden md:block">
                  <UserMenu compact />
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* AI ChatBox */}
      <AIChatBox
        isOpen={isAIChatOpen}
        onClose={() => {
          setIsAIChatOpen(false);
          setAIInitialPrompt(null);
        }}
        initialPrompt={aiInitialPrompt}
      />
    </SidebarProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
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
                                <ProjectsProvider>
                                  <CargoProvider>
                                    <AIProvider>
                                      <LayoutContent children={children} currentPageName={currentPageName} />
                                    </AIProvider>
                                  </CargoProvider>
                                </ProjectsProvider>
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
    </LanguageProvider>
  );
}

