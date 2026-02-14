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

// Stats Card Widget
export function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
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
                <span>{Math.abs(trend)}% {trend > 0 ? 'oshdi' : 'kamaydi'}</span>
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
  const progress = project.progress_percent || 0;
  const status = progress < 25 ? 'Boshlang\'ich' : progress < 50 ? 'Rivojlanmoqda' : progress < 75 ? 'Faol' : progress < 100 ? 'Tugallanmoqda' : 'Tugallangan';

  return (
    <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Umumiy progress</h3>
          <Badge className="bg-white/20 hover:bg-white/30 text-white">{status}</Badge>
        </div>
        <div className="text-center py-4">
          <div className="text-5xl font-bold mb-2">{progress}%</div>
          <Progress value={progress} className="h-3 bg-white/30" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-2xl font-bold">{project.buildings_count || 0}</p>
            <p className="text-xs text-white/80">Binolar</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{project.sections_count || 0}</p>
            <p className="text-xs text-white/80">Bo'limlar</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{project.team_count || 0}</p>
            <p className="text-xs text-white/80">Jamoa</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Financial Summary Widget
export function FinancialWidget({ project, formatCurrency }) {
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
          Moliyaviy ko'rsatkichlar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Shartnoma summasi</span>
          <span className="font-semibold text-lg">{formatCurrency(contractAmount)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Smeta summasi</span>
          <span className="font-semibold">{formatCurrency(smetaAmount)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Sarflangan</span>
          <span className="font-semibold text-orange-600">{formatCurrency(spentAmount)}</span>
        </div>
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-500">Byudjet holati</span>
            <span className="text-sm font-medium">{percentUsed.toFixed(1)}% ishlatilgan</span>
          </div>
          <Progress value={percentUsed} className="h-2" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm font-medium text-slate-700">Qoldiq</span>
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
            Vaqt jadvali
          </CardTitle>
          <Badge className={isOverdue ? 'bg-red-100 text-red-700' : isOnTrack ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
            {isOverdue ? 'Muddati o\'tgan' : isOnTrack ? 'Grafikda' : 'Kechikish xavfi'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Boshlanish</p>
            <p className="font-semibold">{startDate ? format(startDate, 'dd.MM.yyyy') : '-'}</p>
            {actualStart && (
              <p className="text-xs text-green-600 mt-1">Haqiqiy: {format(actualStart, 'dd.MM.yyyy')}</p>
            )}
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Tugash</p>
            <p className="font-semibold">{endDate ? format(endDate, 'dd.MM.yyyy') : '-'}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Vaqt o'tishi</span>
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
            <span>Progress: {project.progress_percent || 0}%</span>
            <span>{daysRemaining > 0 ? `${daysRemaining} kun qoldi` : `${Math.abs(daysRemaining)} kun kechikish`}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Team Overview Widget
export function TeamWidget({ team = [] }) {
  const roles = team.reduce((acc, member) => {
    const role = member.role || 'Boshqa';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          Jamoa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">{team.length}</p>
            <p className="text-sm text-slate-500">a'zo</p>
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
  const totalContract = vendors.reduce((sum, v) => sum + (v.contract_amount || 0), 0);
  const activeVendors = vendors.filter(v => v.status === 'active').length;

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-orange-600" />
          Pudratchilar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{vendors.length}</p>
            <p className="text-xs text-slate-500">Jami</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{activeVendors}</p>
            <p className="text-xs text-slate-500">Faol</p>
          </div>
        </div>
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Jami shartnomalar</span>
            <span className="font-semibold">{formatCurrency(totalContract)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Actions Widget
export function QuickActionsWidget({ onAction }) {
  const actions = [
    { id: 'daily_log', label: 'Kunlik jurnal', icon: FileText, color: 'bg-blue-100 text-blue-700' },
    { id: 'photo_report', label: 'Foto hisobot', icon: FileText, color: 'bg-green-100 text-green-700' },
    { id: 'material_request', label: 'Material so\'rovi', icon: Package, color: 'bg-orange-100 text-orange-700' },
    { id: 'add_team', label: 'Jamoa qo\'shish', icon: Users, color: 'bg-purple-100 text-purple-700' },
  ];

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Tez amallar</CardTitle>
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
                <span className="text-xs font-medium">{action.label}</span>
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
  const alerts = [];

  // Check for budget issues
  if (project.total_smeta > project.contract_amount) {
    alerts.push({
      type: 'warning',
      title: 'Smeta oshib ketgan',
      description: 'Smeta summasi shartnoma summasidan yuqori',
      icon: DollarSign,
    });
  }

  // Check for overdue
  if (project.planned_end_date && new Date(project.planned_end_date) < new Date()) {
    alerts.push({
      type: 'error',
      title: 'Muddat o\'tgan',
      description: 'Loyiha tugash muddati o\'tib ketgan',
      icon: Clock,
    });
  }

  // Check for unapproved sections
  const unapprovedSections = sections.filter(s => s.status !== 'approved');
  if (unapprovedSections.length > 0) {
    alerts.push({
      type: 'info',
      title: `${unapprovedSections.length} ta tasdiqlanmagan bo'lim`,
      description: 'Smeta bo\'limlari tasdiqlanishi kerak',
      icon: FileText,
    });
  }

  if (alerts.length === 0) {
    return (
      <Card className="bg-white">
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-slate-600">Hech qanday ogohlantirish yo'q</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Ogohlantirishlar
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
