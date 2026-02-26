import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Truck,
  FileText,
  Briefcase,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Stats Card Widget
export function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <Card className="bg-white hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                <span>{Math.abs(trend)}% {trend > 0 ? (t('increased') || 'increased') : (t('decreased') || 'decreased')}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Progress Widget
export function ProgressWidget({ project }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const progress = project.progress_percent || 0;

  const getStatusLabel = () => {
    if (progress < 25) return t('initial') || 'Initial';
    if (progress < 50) return t('developing') || 'Developing';
    if (progress < 75) return t('active') || 'Active';
    if (progress < 100) return t('finishing') || 'Finishing';
    return t('completed') || 'Completed';
  };

  return (
    <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t('overall_progress') || 'Overall Progress'}</h3>
          <Badge className="bg-white/20 hover:bg-white/30 text-white">{getStatusLabel()}</Badge>
        </div>
        <div className="text-center py-4">
          <div className="text-5xl font-bold mb-2">{progress}%</div>
          <Progress value={progress} className="h-3 bg-white/30" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-2xl font-bold">{project.buildings_count || 0}</p>
            <p className="text-xs text-white/80">{t('buildings') || 'Buildings'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{project.sections_count || 0}</p>
            <p className="text-xs text-white/80">{t('sections') || 'Sections'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{project.team_count || 0}</p>
            <p className="text-xs text-white/80">{t('team') || 'Team'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Financial Summary Widget
export function FinancialWidget({ project, formatCurrency }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const contractAmount = project.contract_amount || 0;
  const smetaAmount = project.total_smeta || 0;
  const spentAmount = project.spent_amount || 0;
  const remaining = contractAmount - spentAmount;
  const percentUsed = contractAmount > 0 ? (spentAmount / contractAmount) * 100 : 0;

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          {t('financial_indicators') || 'Financial Indicators'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">{t('contract_amount') || 'Contract Amount'}</span>
          <span className="font-semibold text-lg">{formatCurrency(contractAmount)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">{t('estimate_amount') || 'Estimate Amount'}</span>
          <span className="font-semibold">{formatCurrency(smetaAmount)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">{t('spent') || 'Spent'}</span>
          <span className="font-semibold text-orange-600">{formatCurrency(spentAmount)}</span>
        </div>
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-500">{t('budget_status') || 'Budget Status'}</span>
            <span className="text-sm font-medium">{percentUsed.toFixed(1)}% {t('used') || 'used'}</span>
          </div>
          <Progress value={percentUsed} className="h-2" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm font-medium text-slate-700">{t('remaining') || 'Remaining'}</span>
          <span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(remaining)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Timeline Widget
export function TimelineWidget({ project }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const startDate = project.planned_start_date ? parseISO(project.planned_start_date) : null;
  const endDate = project.planned_end_date ? parseISO(project.planned_end_date) : null;
  const actualStart = project.actual_start_date ? parseISO(project.actual_start_date) : null;
  const today = new Date();

  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) : 0;
  const daysElapsed = startDate ? differenceInDays(today, startDate) : 0;
  const daysRemaining = endDate ? differenceInDays(endDate, today) : 0;
  const percentElapsed = totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;

  const isOverdue = daysRemaining < 0;
  const isOnTrack = project.progress_percent >= percentElapsed;

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {t('timeline') || 'Timeline'}
          </CardTitle>
          <Badge className={isOverdue ? 'bg-red-100 text-red-700' : isOnTrack ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
            {isOverdue ? (t('overdue') || 'Overdue') : isOnTrack ? (t('on_track') || 'On Track') : (t('delay_risk') || 'Delay Risk')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">{t('start') || 'Start'}</p>
            <p className="font-semibold">{startDate ? format(startDate, 'dd.MM.yyyy') : '-'}</p>
            {actualStart && (
              <p className="text-xs text-green-600 mt-1">{t('actual') || 'Actual'}: {format(actualStart, 'dd.MM.yyyy')}</p>
            )}
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">{t('end') || 'End'}</p>
            <p className="font-semibold">{endDate ? format(endDate, 'dd.MM.yyyy') : '-'}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">{t('time_elapsed') || 'Time Elapsed'}</span>
            <span className="font-medium">{percentElapsed.toFixed(0)}%</span>
          </div>
          <div className="relative">
            <Progress value={percentElapsed} className="h-3" />
            <div
              className="absolute top-0 h-3 w-1 bg-red-500 rounded"
              style={{ left: `${Math.min(100, project.progress_percent || 0)}%` }}
              title={`Progress: ${project.progress_percent}%`}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{t('progress') || 'Progress'}: {project.progress_percent || 0}%</span>
            <span>{daysRemaining > 0 ? `${daysRemaining} ${t('days_remaining') || 'days remaining'}` : `${Math.abs(daysRemaining)} ${t('days_overdue') || 'days overdue'}`}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Team Overview Widget
export function TeamWidget({ team = [] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const roles = team.reduce((acc, member) => {
    const role = member.role || (t('other') || 'Other');
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          {t('team') || 'Team'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">{team.length}</p>
            <p className="text-sm text-slate-500">{t('members') || 'members'}</p>
          </div>
        </div>
        {Object.keys(roles).length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            {Object.entries(roles).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{role}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Vendors Overview Widget
export function VendorsWidget({ vendors = [], formatCurrency }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const totalContract = vendors.reduce((sum, v) => sum + (v.contract_amount || 0), 0);
  const activeVendors = vendors.filter(v => v.status === 'active').length;

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-orange-600" />
          {t('vendors') || 'Vendors'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{vendors.length}</p>
            <p className="text-xs text-slate-500">{t('total') || 'Total'}</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{activeVendors}</p>
            <p className="text-xs text-slate-500">{t('active') || 'Active'}</p>
          </div>
        </div>
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">{t('total_contracts') || 'Total Contracts'}</span>
            <span className="font-semibold">{formatCurrency(totalContract)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Actions Widget
export function QuickActionsWidget({ onAction }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const actions = [
    { id: 'daily_log', labelKey: 'daily_log', icon: FileText, color: 'bg-blue-100 text-blue-700' },
    { id: 'photo_report', labelKey: 'photo_report', icon: FileText, color: 'bg-green-100 text-green-700' },
    { id: 'material_request', labelKey: 'material_request', icon: Package, color: 'bg-orange-100 text-orange-700' },
    { id: 'add_team', labelKey: 'add_team_member', icon: Users, color: 'bg-purple-100 text-purple-700' },
  ];

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t('quick_actions') || 'Quick Actions'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onAction && onAction(action.id)}
                className={`p-3 rounded-lg ${action.color} hover:opacity-80 transition-opacity flex flex-col items-center gap-2`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{t(action.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Alerts Widget
export function AlertsWidget({ project, sections = [], vendors = [] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const alerts = [];

  // Check for budget issues
  if (project.total_smeta > project.contract_amount) {
    alerts.push({
      type: 'warning',
      title: t('estimate_exceeded') || 'Estimate Exceeded',
      description: t('estimate_exceeded_desc') || 'Estimate amount exceeds contract amount',
      icon: DollarSign,
    });
  }

  // Check for overdue
  if (project.planned_end_date && new Date(project.planned_end_date) < new Date()) {
    alerts.push({
      type: 'error',
      title: t('overdue') || 'Overdue',
      description: t('project_overdue_desc') || 'Project deadline has passed',
      icon: Clock,
    });
  }

  // Check for unapproved sections
  const unapprovedSections = sections.filter(s => s.status !== 'approved');
  if (unapprovedSections.length > 0) {
    alerts.push({
      type: 'info',
      title: `${unapprovedSections.length} ${t('unapproved_sections') || 'unapproved sections'}`,
      description: t('sections_need_approval') || 'Estimate sections need to be approved',
      icon: FileText,
    });
  }

  if (alerts.length === 0) {
    return (
      <Card className="bg-white">
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-slate-600">{t('no_alerts') || 'No alerts'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          {t('alerts') || 'Alerts'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, index) => {
          const Icon = alert.icon;
          const colors = {
            error: 'bg-red-50 border-red-200 text-red-700',
            warning: 'bg-amber-50 border-amber-200 text-amber-700',
            info: 'bg-blue-50 border-blue-200 text-blue-700',
          };
          return (
            <div key={index} className={`p-3 rounded-lg border ${colors[alert.type]}`}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{alert.title}</span>
              </div>
              <p className="text-xs mt-1 opacity-80">{alert.description}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default {
  StatsCard,
  ProgressWidget,
  FinancialWidget,
  TimelineWidget,
  TeamWidget,
  VendorsWidget,
  QuickActionsWidget,
  AlertsWidget,
};
