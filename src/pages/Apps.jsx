
import React, { useState, useEffect } from 'react';
import { InstalledApp } from '@/api/entities';
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
  FileText
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useInstalledApps } from '@/components/contexts/InstalledAppsContext';
import { useTranslation } from '@/components/utils/translations';

const appsList = [
  {
    id: 'crm',
    name: 'CRM & Sales',
    description: 'AI-powered customer relationship management with VOIP integration.',
    version: '2.1',
    icon: Users,
    color: 'var(--genix-blue)'
  },
  {
    id: 'inventory',
    name: 'Inventory & Supply Chain',
    description: 'FIFO-compliant stock management with demand forecasting.',
    version: '1.8',
    icon: Package,
    color: 'var(--genix-orange)'
  },
  {
    id: 'finance',
    name: 'Finance & Accounting',
    description: 'Automated bookkeeping, financial intelligence, and compliance.',
    version: '2.0',
    icon: DollarSign,
    color: 'var(--genix-green)'
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Intelligent workforce management, from recruitment to payroll.',
    version: '1.5',
    icon: Briefcase,
    color: 'var(--genix-purple)'
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Optimize production schedules, manage BOMs, and predict maintenance.',
    version: '1.0',
    icon: Zap,
    color: '#334155'
  },
  {
    id: 'procurement',
    name: 'Procurement & Purchasing',
    description: 'Smart vendor management with AI-driven price optimization.',
    version: '1.0',
    icon: ShoppingCart,
    color: '#6366f1'
  },
  {
    id: 'projects',
    name: 'Project Management',
    description: 'Plan, track, and deliver projects on time and within budget.',
    version: '1.0',
    icon: Briefcase,
    color: '#3b82f6'
  },
  {
    id: 'sales_orders',
    name: 'Sales Orders',
    description: 'Manage orders from quote to delivery with AI insights.',
    version: '1.0',
    icon: ShoppingBag,
    color: '#10b981'
  },
  {
    id: 'assets',
    name: 'Fixed Assets',
    description: 'Track and manage fixed assets with automated depreciation.',
    version: '1.0',
    icon: Monitor,
    color: '#f59e0b'
  },
  {
    id: 'expenses',
    name: 'Expense Management',
    description: 'Submit and manage expenses with AI receipt scanning.',
    version: '1.0',
    icon: Receipt,
    color: '#14b8a6'
  },
  {
    id: 'payroll',
    name: 'Payroll',
    description: 'Automated payroll processing with tax calculations.',
    version: '1.0',
    icon: DollarSign,
    color: '#8b5cf6'
  },
  {
    id: 'contracts',
    name: 'Contract Management',
    description: 'Manage contract lifecycle with automated renewals.',
    version: '1.0',
    icon: FileText,
    color: '#ec4899'
  }
];

const AppCard = ({ app, isInstalled, onAction, isLoading }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const handleAction = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await onAction(app, isInstalled ? 'uninstall' : 'install');
  };

  return (
    <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white/80 backdrop-blur-sm border-slate-200/60 flex flex-col h-full">
      {/* Header - Vertical Layout */}
      <CardHeader className="pb-4 pt-6 px-6 flex-shrink-0">
        {/* Icon - Centered at top */}
        <div className="flex justify-center mb-4">
          <div 
            style={{ backgroundColor: app.color }} 
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
          >
            <app.icon className="w-10 h-10 text-white" />
          </div>
        </div>
        
        {/* Title - Full width, centered */}
        <div className="text-center">
          <CardTitle className="text-lg font-bold text-slate-900 leading-tight mb-3">
            {app.name}
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
          {app.description}
        </p>
        
        {/* Spacer */}
        <div className="flex-1"></div>
        
        {/* Buttons - PERFECTLY ALIGNED WITH SPACE-BETWEEN */}
        <div className="pt-4 border-t border-slate-100 flex-shrink-0">
          {isInstalled ? (
            <div className="flex items-center justify-between gap-3">
              <Badge className="bg-green-50 text-green-700 border border-green-200 flex items-center justify-center gap-2 h-10 px-4 flex-shrink-0">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold text-sm whitespace-nowrap">{t('installed')}</span>
              </Badge>
              <Button 
                variant="outline" 
                className="text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-medium h-10 px-4 flex-shrink-0" 
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
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border border-slate-200 h-10 px-4 font-medium text-sm flex items-center justify-center flex-shrink-0">
                <span className="whitespace-nowrap">{t('not_installed')}</span>
              </Badge>
              <Button 
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:opacity-90 shadow-md font-semibold h-10 px-4 flex-shrink-0" 
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
    </Card>
  );
};

export default function Apps() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { installedApps, isLoading: appsLoading, refreshInstalledApps, isAppInstalled } = useInstalledApps();

  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAppId, setLoadingAppId] = useState(null);

  const handleAppAction = async (app, action) => {
    setLoadingAppId(app.id);
    try {
      if (action === 'install') {
        await InstalledApp.create({
          app_id: app.id,
          app_name: app.name,
          version: app.version,
          installed_date: new Date().toISOString(),
          status: 'active'
        });
      } else if (action === 'uninstall') {
        const installedApp = installedApps.find(ia => ia.app_id === app.id);
        if (installedApp) {
          await InstalledApp.delete(installedApp.id);
        }
      }
      refreshInstalledApps();
    } catch (error) {
      console.error(`Error ${action}ing app:`, error);
    }
    setLoadingAppId(null);
  };

  const filteredApps = appsList.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* Header Section - Redesigned */}
        <div className="bg-gradient-to-r from-white via-white to-blue-50/30 rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200/60">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[var(--genix-navy)] to-[var(--genix-blue)] bg-clip-text text-transparent mb-3">
              {t('apps_title')}
            </h1>
            <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl">
              {t('apps_subtitle')}
            </p>
          </div>
        </div>

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
            {filteredApps.map(app => (
              <AppCard 
                key={app.id} 
                app={app} 
                isInstalled={isAppInstalled(app.id)}
                onAction={handleAppAction}
                isLoading={loadingAppId === app.id}
              />
            ))}
          </div>
        )}

        {filteredApps.length === 0 && !appsLoading && (
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
