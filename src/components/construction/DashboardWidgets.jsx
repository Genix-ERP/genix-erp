import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  FileText,
  Briefcase,
  CircleCheck,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// ─────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────
function Panel({ children, className, ...rest }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, icon: Icon, action, iconClass }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn('w-4 h-4', iconClass || 'text-slate-400')} strokeWidth={2} />}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stats Card
// ─────────────────────────────────────────────
export function StatsCard({ title, value, subtitle, icon: Icon, trend }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1.5">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend != null && (
            <div
              className={cn(
                'flex items-center gap-1 mt-2 text-xs font-medium',
                trend > 0 ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              <TrendingUp className={cn('w-3 h-3', trend < 0 && 'rotate-180')} />
              <span>
                {Math.abs(trend)}%{' '}
                {trend > 0 ? t('increased') || 'o\'sdi' : t('decreased') || 'pasaydi'}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-slate-500" strokeWidth={2} />
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// Progress Widget — clean, neutral, no gradient
// ─────────────────────────────────────────────
// Project status options shown in the inline ProgressWidget dropdown.
// Mirrors the values the project filter / edit form already accept so the
// statuses stay consistent across every place users can read/write them.
const PROJECT_STATUSES = [
  { value: 'draft',       tkey: 'draft',       fallback: 'Qoralama',       cls: 'bg-slate-100 text-slate-700' },
  { value: 'planning',    tkey: 'planning',    fallback: 'Rejalashtirish', cls: 'bg-violet-100 text-violet-700' },
  { value: 'in_progress', tkey: 'in_progress', fallback: 'Jarayonda',      cls: 'bg-amber-100 text-amber-700' },
  { value: 'on_hold',     tkey: 'on_hold',     fallback: "To'xtatilgan",   cls: 'bg-orange-100 text-orange-700' },
  { value: 'completed',   tkey: 'completed',   fallback: 'Tugallangan',    cls: 'bg-emerald-100 text-emerald-700' },
];

export function ProgressWidget({ project, onStatusChange }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const progress = Math.max(0, Math.min(100, Number(project.progress_percent) || 0));

  // Resolve current status — fall back to first option (draft) so the
  // Select always has a defined value and the trigger never goes blank.
  const currentStatus = project.status && PROJECT_STATUSES.some((s) => s.value === project.status)
    ? project.status
    : PROJECT_STATUSES[0].value;
  const currentMeta = PROJECT_STATUSES.find((s) => s.value === currentStatus) || PROJECT_STATUSES[0];

  const barColor =
    progress >= 100
      ? 'bg-emerald-500'
      : progress >= 50
      ? 'bg-blue-500'
      : progress > 0
      ? 'bg-amber-500'
      : 'bg-slate-300';

  return (
    <Panel className="p-5 h-full">
      <div className="flex items-center justify-between mb-5 gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {t('overall_progress') || 'Umumiy bajarilish'}
        </h3>
        {/* Inline status dropdown — replaces the previous progress-derived
           label so users can move the project across lifecycle states
           (draft → planning → in_progress → on_hold → completed) directly
           from the overview. The trigger pill picks up the matching status
           color so it still reads at a glance. */}
        {onStatusChange ? (
          <Select value={currentStatus} onValueChange={(v) => onStatusChange(v)}>
            <SelectTrigger
              className={cn(
                'h-7 w-auto min-w-[140px] gap-1.5 px-2.5 py-0.5 rounded-md border-0 text-xs font-medium',
                currentMeta.cls,
              )}
              aria-label={t('status') || 'Holat'}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {t(s.tkey) || s.fallback}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Read-only fallback when no change handler is supplied (keeps
          // the widget usable on summary screens where editing isn't
          // appropriate).
          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', currentMeta.cls)}>
            {t(currentMeta.tkey) || currentMeta.fallback}
          </span>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-4xl font-semibold text-slate-900 tabular-nums leading-none">
            {progress}
          </span>
          <span className="text-lg font-medium text-slate-400 leading-none">%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
      </div>

      {/* Sections column was removed at user request — the breakdown
         lives in the dedicated tabs and didn't earn its slot here.
         "Jamoa" was relabeled to "Ishchi soni" so the metric reads as a
         headcount rather than a generic team-name. */}
      <dl className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
        <div>
          <dt className="text-xs font-medium text-slate-500 mb-1.5">
            {t('buildings') || 'Binolar'}
          </dt>
          <dd className="text-xl font-semibold text-slate-900 tabular-nums leading-none">
            {project.buildings_count || 0}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 mb-1.5">
            {t('worker_count') || 'Ishchi soni'}
          </dt>
          <dd className="text-xl font-semibold text-slate-900 tabular-nums leading-none">
            {project.team_count || 0}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// Financial Widget
// ─────────────────────────────────────────────
export function FinancialWidget({ project, formatCurrency }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const contractAmount = Number(project.contract_amount) || 0;
  const smetaAmount = Number(project.total_smeta) || 0;
  const spentAmount = Number(project.spent_amount) || 0;
  const remaining = contractAmount - spentAmount;
  const percentUsed = contractAmount > 0 ? (spentAmount / contractAmount) * 100 : 0;

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('financial_indicators') || 'Moliyaviy ko\'rsatkichlar'}
        icon={DollarSign}
        iconClass="text-emerald-500"
      />
      <div className="px-5 pb-5 space-y-3">
        <Row label={t('contract_amount') || 'Shartnoma summasi'} value={formatCurrency(contractAmount)} bold />
        <Row label={t('estimate_amount') || 'Smeta summasi'} value={formatCurrency(smetaAmount)} />
        <Row label={t('spent') || 'Sarflangan'} value={formatCurrency(spentAmount)} valueClass="text-amber-600" />

        <div className="pt-3 border-t border-slate-100">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-medium text-slate-500">
              {t('budget_status') || 'Byudjet holati'}
            </span>
            <span className="text-xs font-semibold text-slate-900 tabular-nums">
              {percentUsed.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                percentUsed >= 100 ? 'bg-red-500' : percentUsed >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-baseline pt-3 border-t border-slate-100">
          <span className="text-sm font-medium text-slate-700">{t('remaining') || 'Qoldiq'}</span>
          <span
            className={cn(
              'text-base font-semibold tabular-nums',
              remaining >= 0 ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>
    </Panel>
  );
}

function Row({ label, value, bold, valueClass }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          bold ? 'text-base font-semibold text-slate-900' : 'text-sm font-medium text-slate-700',
          valueClass
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Timeline Widget — minimal, no saturated colors
// ─────────────────────────────────────────────
export function TimelineWidget({ project }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const startDate = project.planned_start_date ? parseISO(project.planned_start_date) : null;
  const endDate = project.planned_end_date ? parseISO(project.planned_end_date) : null;
  const actualStart = project.actual_start_date ? parseISO(project.actual_start_date) : null;
  const today = new Date();

  const totalDays = startDate && endDate ? Math.max(0, differenceInDays(endDate, startDate)) : 0;
  const daysElapsed = startDate ? differenceInDays(today, startDate) : 0;
  const daysRemaining = endDate ? differenceInDays(endDate, today) : 0;
  const percentElapsed =
    totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;
  const currentProgress = Number(project.progress_percent) || 0;

  const hasDates = !!(startDate && endDate);
  const notStarted = !actualStart && currentProgress === 0;
  const isOverdue = hasDates && daysRemaining < 0;
  const isOnTrack = hasDates && currentProgress >= percentElapsed;

  let statusLabel;
  let statusClass;
  if (!hasDates) {
    statusLabel = t('dates_not_set') || 'Sanalar kiritilmagan';
    statusClass = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (notStarted && daysElapsed < 0) {
    statusLabel = t('not_started_yet') || "Hali boshlanmagan";
    statusClass = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (isOverdue) {
    statusLabel = t('overdue') || "Muddati o'tgan";
    statusClass = 'bg-red-50 text-red-700 border-red-200';
  } else if (isOnTrack) {
    statusLabel = t('on_track') || "O'z vaqtida";
    statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else {
    statusLabel = t('delay_risk') || 'Kechikish xavfi';
    statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('timeline') || 'Muddatlar'}
        icon={Calendar}
        iconClass="text-blue-500"
        action={
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
              statusClass
            )}
          >
            {statusLabel}
          </span>
        }
      />
      <div className="px-5 pb-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">
              {t('start') || 'Boshlanish'}
            </p>
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              {startDate ? format(startDate, 'dd.MM.yyyy') : '—'}
            </p>
            {actualStart && (
              <p className="text-xs text-emerald-600 mt-0.5 tabular-nums">
                {t('actual') || 'Haqiqiy'}: {format(actualStart, 'dd.MM.yyyy')}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">
              {t('end') || 'Tugash'}
            </p>
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              {endDate ? format(endDate, 'dd.MM.yyyy') : '—'}
            </p>
          </div>
        </div>

        {hasDates && (
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs font-medium text-slate-500">
                {t('time_elapsed') || "Vaqt o'tishi"}
              </span>
              <span className="text-xs font-semibold text-slate-900 tabular-nums">
                {percentElapsed.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
              {/* Time elapsed */}
              <div
                className="absolute left-0 top-0 h-full bg-slate-400 rounded-full"
                style={{ width: `${percentElapsed}%` }}
              />
              {/* Current progress marker */}
              <div
                className="absolute top-0 h-1.5 w-0.5 bg-slate-900"
                style={{ left: `${Math.min(100, currentProgress)}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
              <span>
                {t('progress') || 'Jarayon'}:{' '}
                <span className="font-medium text-slate-600 tabular-nums">
                  {currentProgress}%
                </span>
              </span>
              <span className="tabular-nums">
                {daysRemaining >= 0
                  ? `${daysRemaining} ${t('days_remaining') || 'kun qoldi'}`
                  : `${Math.abs(daysRemaining)} ${t('days_overdue') || 'kun kechikish'}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// Team Widget
// ─────────────────────────────────────────────
export function TeamWidget({ team = [] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const roles = team.reduce((acc, member) => {
    const role = member.role || (t('other') || 'Boshqa');
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('team') || 'Jamoa'}
        icon={Users}
        iconClass="text-indigo-500"
      />
      <div className="px-5 pb-5">
        <div className="py-3">
          <p className="text-3xl font-semibold text-slate-900 tabular-nums">{team.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t('members') || 'a\'zo'}</p>
        </div>
        {Object.keys(roles).length > 0 && (
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {Object.entries(roles).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center text-sm">
                <span className="text-slate-600">{role}</span>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 text-xs font-medium text-slate-700 tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// Vendors Widget
// ─────────────────────────────────────────────
export function VendorsWidget({ vendors = [], formatCurrency }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const totalContract = vendors.reduce((sum, v) => sum + (Number(v.contract_amount) || 0), 0);
  const activeVendors = vendors.filter((v) => v.status === 'active').length;

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('vendors') || 'Yetkazib beruvchilar'}
        icon={Briefcase}
        iconClass="text-amber-500"
      />
      <div className="px-5 pb-5">
        <dl className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <dt className="text-xs font-medium text-slate-500 mb-1">{t('total') || 'Jami'}</dt>
            <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{vendors.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 mb-1">{t('active') || 'Faol'}</dt>
            <dd className="text-2xl font-semibold text-emerald-600 tabular-nums">{activeVendors}</dd>
          </div>
        </dl>
        <div className="pt-3 border-t border-slate-100">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-medium text-slate-500">
              {t('total_contracts') || 'Jami shartnomalar'}
            </span>
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {formatCurrency(totalContract)}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// Quick Actions Widget
// ─────────────────────────────────────────────
export function QuickActionsWidget({ onAction }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const actions = [
    { id: 'daily_log', labelKey: 'daily_log', icon: FileText },
    { id: 'photo_report', labelKey: 'photo_report', icon: FileText },
    { id: 'material_request', labelKey: 'material_request', icon: Package },
    { id: 'add_team', labelKey: 'add_team_member', icon: Users },
  ];

  return (
    <Panel className="h-full">
      <PanelHeader title={t('quick_actions') || 'Tezkor amallar'} />
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onAction && onAction(action.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <Icon className="w-4 h-4 text-slate-400" strokeWidth={2} />
                <span className="truncate">{t(action.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────
// Alerts Widget
// ─────────────────────────────────────────────
export function AlertsWidget({ project, sections = [], vendors = [] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const alerts = [];

  if (project.total_smeta > project.contract_amount && project.contract_amount > 0) {
    alerts.push({
      type: 'warning',
      title: t('estimate_exceeded') || 'Smeta oshib ketgan',
      description: t('estimate_exceeded_desc') || 'Smeta summasi shartnomadan katta',
      icon: DollarSign,
    });
  }

  if (project.planned_end_date && new Date(project.planned_end_date) < new Date()) {
    alerts.push({
      type: 'error',
      title: t('overdue') || "Muddati o'tgan",
      description: t('project_overdue_desc') || "Rejadagi tugash sanasi o'tib ketdi",
      icon: Clock,
    });
  }

  const unapprovedSections = sections.filter((s) => s.status !== 'approved');
  if (unapprovedSections.length > 0) {
    alerts.push({
      type: 'info',
      title: `${unapprovedSections.length} ${t('unapproved_sections') || 'tasdiqlanmagan bo\'lim'}`,
      description: t('sections_need_approval') || 'Smeta bo\'limlarini tasdiqlash kerak',
      icon: FileText,
    });
  }

  if (alerts.length === 0) {
    return (
      <Panel className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CircleCheck className="w-6 h-6 text-emerald-600" strokeWidth={2} />
          </div>
          <p className="text-sm font-medium text-slate-900 mb-0.5">
            {t('all_good') || 'Hammasi joyida'}
          </p>
          <p className="text-xs text-slate-500">
            {t('no_alerts') || "Hech qanday ogohlantirish yo'q"}
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('alerts') || 'Ogohlantirishlar'}
        icon={AlertTriangle}
        iconClass="text-amber-500"
        action={
          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700 tabular-nums">
            {alerts.length}
          </span>
        }
      />
      <div className="px-5 pb-5 space-y-2">
        {alerts.map((alert, index) => {
          const Icon = alert.icon;
          const tone = {
            error: 'bg-red-50 border-red-200 text-red-900',
            warning: 'bg-amber-50 border-amber-200 text-amber-900',
            info: 'bg-blue-50 border-blue-200 text-blue-900',
          };
          const iconTone = {
            error: 'text-red-600',
            warning: 'text-amber-600',
            info: 'text-blue-600',
          };
          return (
            <div key={index} className={cn('rounded-lg border px-3 py-2.5', tone[alert.type])}>
              <div className="flex items-start gap-2">
                <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', iconTone[alert.type])} strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs opacity-75 mt-0.5">{alert.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
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
