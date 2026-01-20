import React, { useState } from 'react';
import { useCompany } from '@/components/contexts/CompanyContext';
import { useSubscription } from '@/components/contexts/SubscriptionContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Crown,
  Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CompanySwitcher({ compact = false }) {
  const {
    companies,
    activeCompany,
    setActiveCompany,
    getCompanyCount
  } = useCompany();

  const { getPlanLimits } = useSubscription();
  const limits = getPlanLimits();
  const maxCompanies = limits.maxCompanies || 1;
  const companyCount = getCompanyCount();
  const canAddMore = maxCompanies === -1 || companyCount < maxCompanies;
  const hasMultiCompany = limits.features?.multi_company;

  const handleCompanySwitch = (companyId) => {
    if (companyId !== activeCompany?.id) {
      setActiveCompany(companyId);
    }
  };

  // Get initials for company avatar
  const getInitials = (name) => {
    if (!name) return 'C';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={compact
            ? "flex items-center gap-1.5 px-2 py-1.5 h-auto hover:bg-slate-100/80 rounded-lg"
            : "w-full justify-between px-3 py-2 h-auto hover:bg-slate-100/80"
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Company Avatar */}
            <div className={`rounded-lg bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] flex items-center justify-center text-white font-bold flex-shrink-0 ${
              compact ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'
            }`}>
              {activeCompany?.logo_url ? (
                <img
                  src={activeCompany.logo_url}
                  alt={activeCompany.company_name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                getInitials(activeCompany?.company_name)
              )}
            </div>

            {/* Company Info */}
            {!compact && (
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium text-slate-900 truncate max-w-[140px]">
                  {activeCompany?.company_name || 'Kompaniya tanlang'}
                </span>
                <span className="text-xs text-slate-500">
                  {activeCompany?.company_code}
                </span>
              </div>
            )}
            {compact && (
              <span className="text-xs font-medium text-slate-900 truncate max-w-[100px]">
                {activeCompany?.company_name || 'Kompaniya'}
              </span>
            )}
          </div>

          {!compact && <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          {compact && <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {/* Header with usage */}
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Kompaniyalar</span>
          <Badge variant="secondary" className="text-xs">
            {companyCount}/{maxCompanies === -1 ? '∞' : maxCompanies}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Company List */}
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleCompanySwitch(company.id)}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              {/* Company Avatar */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                {company.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.company_name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  getInitials(company.company_name)
                )}
              </div>

              {/* Company Info */}
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium truncate">
                  {company.company_name}
                </span>
                <span className="text-xs text-slate-500">
                  {company.company_code} • {company.currency}
                </span>
              </div>

              {/* Active Indicator */}
              {activeCompany?.id === company.id && (
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Manage Companies - Redirects to Settings */}
        <Link to="/settings?tab=companies">
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2 text-slate-500" />
            <span>Kompaniyalarni boshqarish</span>
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
