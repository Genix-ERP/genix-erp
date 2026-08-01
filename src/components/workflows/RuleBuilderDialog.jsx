import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Zap, Filter, Play, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import workflowsService from '@/api/services/workflows';
import taskBoardsService from '@/api/services/taskBoards';
import { hrService } from '@/api/services/hr';
import {
  TRIGGER_EVENTS, EVENT_BY_VALUE, EVENT_CATEGORIES, CATEGORY_LABEL_KEYS,
  OPERATORS, ACTION_TYPES, NOTIFICATION_ROLES,
} from './ruleCatalog';

const EMPTY_ACTION = { type: 'create_notification', config: { message: '', recipient_type: 'all' } };

// Hoisted so re-renders don't remount the section subtree (inputs keep focus)
function BuilderSection({ badge, title, hint, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--genix-navy)] text-white">
          {badge}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// Normalizes legacy stored shapes into the builder's editing state
function loadRuleState(rule) {
  let conditionRows = [];
  let logic = 'and';
  try {
    const c = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
    if (c && Array.isArray(c.conditions)) {
      logic = c.logic === 'or' ? 'or' : 'and';
      conditionRows = c.conditions
        .filter((row) => row && row.field)
        .map((row) => ({ field: row.field, operator: row.operator || 'eq', value: row.value ?? '' }));
    } else if (c && typeof c === 'object') {
      // legacy {field: value} / {field: {$op: value}}
      const legacyOps = { $eq: 'eq', $ne: 'neq', $gt: 'gt', $gte: 'gte', $lt: 'lt', $lte: 'lte' };
      conditionRows = Object.entries(c).map(([field, v]) => {
        if (v && typeof v === 'object') {
          const [op, val] = Object.entries(v)[0] || ['$eq', ''];
          return { field, operator: legacyOps[op] || 'eq', value: val };
        }
        return { field, operator: 'eq', value: v };
      });
    }
  } catch { /* start clean */ }

  let actions = [];
  try {
    const parsed = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
    actions = (parsed || []).map((a) => {
      // migrate legacy action types into the v2 set
      if (a.type === 'update_status') {
        return { type: 'update_field', config: { target: a.config?.table || '', field: 'status', value: a.config?.status || '' } };
      }
      if (a.type === 'update_task_priority') {
        return { type: 'update_field', config: { target: 'tasks', field: 'priority', value: a.config?.priority || 'high' } };
      }
      if (a.type === 'create_followup_task') {
        return { type: 'create_task', config: { board_id: '', title: a.config?.title || '', priority: 'normal' } };
      }
      if (a.type === 'create_record') {
        return { ...EMPTY_ACTION, config: { ...EMPTY_ACTION.config } };
      }
      return { type: a.type, config: { ...(a.config || {}) } };
    });
  } catch { /* start clean */ }
  if (actions.length === 0) actions = [{ ...EMPTY_ACTION, config: { ...EMPTY_ACTION.config } }];

  return {
    name: rule.name || '',
    description: rule.description || '',
    trigger_event: rule.trigger_event || '',
    is_active: rule.is_active !== false,
    logic,
    conditionRows,
    actions,
  };
}

export default function RuleBuilderDialog({ open, onOpenChange, rule, onSaved, t }) {
  const [form, setForm] = useState(() => loadRuleState(rule || {}));
  const [saving, setSaving] = useState(false);
  const [boards, setBoards] = useState([]);
  const [columnsByBoard, setColumnsByBoard] = useState({});
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (open) setForm(loadRuleState(rule || {}));
  }, [open, rule]);

  useEffect(() => {
    if (!open) return;
    taskBoardsService.listBoards().then((data) => setBoards(data || [])).catch(() => setBoards([]));
    hrService.listEmployees({ limit: 200 }).then((data) => setEmployees(data || [])).catch(() => setEmployees([]));
  }, [open]);

  const loadColumns = useCallback((boardId) => {
    if (!boardId || columnsByBoard[boardId]) return;
    taskBoardsService.getBoard(boardId)
      .then((data) => setColumnsByBoard((prev) => ({ ...prev, [boardId]: data?.columns || [] })))
      .catch(() => setColumnsByBoard((prev) => ({ ...prev, [boardId]: [] })));
  }, [columnsByBoard]);

  const event = EVENT_BY_VALUE[form.trigger_event];
  const eventFields = event?.fields || [];

  const groupedEvents = useMemo(() => EVENT_CATEGORIES
    .map((cat) => ({ category: cat, events: TRIGGER_EVENTS.filter((e) => e.category === cat) }))
    .filter((g) => g.events.length > 0), []);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // ── Conditions ──
  const addCondition = () => {
    const first = eventFields[0];
    set({ conditionRows: [...form.conditionRows, { field: first?.key || '', operator: 'eq', value: '' }] });
  };
  const updateCondition = (idx, patch) => {
    const rows = form.conditionRows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    set({ conditionRows: rows });
  };
  const removeCondition = (idx) => set({ conditionRows: form.conditionRows.filter((_, i) => i !== idx) });

  // ── Actions ──
  const addAction = () => set({ actions: [...form.actions, { ...EMPTY_ACTION, config: { ...EMPTY_ACTION.config } }] });
  const removeAction = (idx) => set({ actions: form.actions.filter((_, i) => i !== idx) });
  const moveAction = (idx, dir) => {
    const next = [...form.actions];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    set({ actions: next });
  };
  const updateAction = (idx, patch) => {
    set({ actions: form.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)) });
  };
  const updateActionConfig = (idx, patch) => {
    set({
      actions: form.actions.map((a, i) => (i === idx ? { ...a, config: { ...a.config, ...patch } } : a)),
    });
  };

  const insertVariable = (idx, key, variable) => {
    const current = form.actions[idx].config[key] || '';
    updateActionConfig(idx, { [key]: `${current}{{${variable}}}` });
  };

  // ── Save ──
  const buildPayload = () => {
    const conditions = form.conditionRows.length > 0
      ? {
        logic: form.logic,
        conditions: form.conditionRows.map((row) => {
          const fieldDef = eventFields.find((f) => f.key === row.field);
          const value = fieldDef?.type === 'number' && row.value !== '' && !Number.isNaN(Number(row.value))
            ? Number(row.value) : row.value;
          return { field: row.field, operator: row.operator, value };
        }),
      }
      : {};

    const actions = form.actions.map((a) => {
      const config = { ...a.config };
      if (a.type === 'create_task' && config.due_in_days !== undefined && config.due_in_days !== '') {
        config.due_in_days = Number(config.due_in_days) || 0;
      }
      return { type: a.type, config };
    });

    return {
      name: form.name.trim(),
      description: form.description.trim(),
      trigger_event: form.trigger_event,
      conditions,
      actions,
      is_active: form.is_active,
    };
  };

  const validate = () => {
    if (!form.name.trim()) return t('wf_err_name_required');
    if (!form.trigger_event) return t('wf_err_event_required');
    for (const row of form.conditionRows) {
      if (!row.field || row.value === '') return t('wf_err_condition_incomplete');
    }
    for (const a of form.actions) {
      if (a.type === 'create_notification' && !a.config.message?.trim()) return t('wf_err_message_required');
      if (a.type === 'create_task' && (!a.config.board_id || !a.config.title?.trim())) return t('wf_err_task_config');
      if (a.type === 'update_field' && (!a.config.field || a.config.value === undefined || a.config.value === '')) {
        return t('wf_err_field_config');
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (rule?.id) {
        await workflowsService.updateRule(rule.id, payload);
      } else {
        await workflowsService.createRule(payload);
      }
      toast.success(t('wf_rule_saved'));
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.message || t('wf_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const renderVariableChips = (idx, targetKey) => eventFields.length > 0 && (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {eventFields.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => insertVariable(idx, targetKey, f.key)}
          className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-mono"
        >
          {'{{'}{f.key}{'}}'}
        </button>
      ))}
    </div>
  );

  const renderActionConfig = (action, idx) => {
    switch (action.type) {
      case 'create_notification':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('wf_recipients')}</Label>
                <Select
                  value={action.config.recipient_type || 'all'}
                  onValueChange={(v) => updateActionConfig(idx, { recipient_type: v, roles: [], employee_ids: [] })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('wf_recipients_all')}</SelectItem>
                    <SelectItem value="roles">{t('wf_recipients_roles')}</SelectItem>
                    <SelectItem value="employees">{t('wf_recipients_employees')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('wf_notification_title')} ({t('optional')})</Label>
                <Input
                  className="mt-1"
                  value={action.config.title || ''}
                  onChange={(e) => updateActionConfig(idx, { title: e.target.value })}
                  placeholder={t('wf_notification_title_ph')}
                />
              </div>
            </div>

            {action.config.recipient_type === 'roles' && (
              <div className="flex flex-wrap gap-3 p-2 rounded-lg bg-slate-50">
                {NOTIFICATION_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={(action.config.roles || []).includes(role)}
                      onCheckedChange={(checked) => {
                        const current = action.config.roles || [];
                        updateActionConfig(idx, {
                          roles: checked ? [...current, role] : current.filter((r) => r !== role),
                        });
                      }}
                    />
                    {t(`wf_role_${role}`)}
                  </label>
                ))}
              </div>
            )}

            {action.config.recipient_type === 'employees' && (
              <div className="max-h-36 overflow-y-auto p-2 rounded-lg bg-slate-50 space-y-1.5">
                {employees.length === 0 && <div className="text-xs text-slate-400">{t('no_employees_found')}</div>}
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={(action.config.employee_ids || []).includes(emp.id)}
                      onCheckedChange={(checked) => {
                        const current = action.config.employee_ids || [];
                        updateActionConfig(idx, {
                          employee_ids: checked ? [...current, emp.id] : current.filter((id) => id !== emp.id),
                        });
                      }}
                    />
                    {emp.first_name} {emp.last_name}
                  </label>
                ))}
              </div>
            )}

            <div>
              <Label className="text-xs">{t('wf_message')}</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={action.config.message || ''}
                onChange={(e) => updateActionConfig(idx, { message: e.target.value })}
                placeholder={t('wf_message_ph')}
              />
              {renderVariableChips(idx, 'message')}
            </div>
          </div>
        );

      case 'create_task': {
        const boardColumns = columnsByBoard[action.config.board_id] || [];
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('wf_task_board')}</Label>
                <Select
                  value={action.config.board_id || ''}
                  onValueChange={(v) => {
                    updateActionConfig(idx, { board_id: v, column_id: '' });
                    loadColumns(v);
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('wf_select_board')} /></SelectTrigger>
                  <SelectContent>
                    {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('wf_task_column')} ({t('optional')})</Label>
                <Select
                  value={action.config.column_id || ''}
                  onValueChange={(v) => updateActionConfig(idx, { column_id: v })}
                  disabled={!action.config.board_id}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('wf_first_column')} /></SelectTrigger>
                  <SelectContent>
                    {boardColumns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('wf_task_title')}</Label>
              <Input
                className="mt-1"
                value={action.config.title || ''}
                onChange={(e) => updateActionConfig(idx, { title: e.target.value })}
                placeholder={t('wf_task_title_ph')}
              />
              {renderVariableChips(idx, 'title')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t('wf_f_priority')}</Label>
                <Select
                  value={action.config.priority || 'normal'}
                  onValueChange={(v) => updateActionConfig(idx, { priority: v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['low', 'normal', 'high', 'urgent'].map((p) => (
                      <SelectItem key={p} value={p}>{t(`priority_${p}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('wf_due_in_days')}</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  value={action.config.due_in_days ?? ''}
                  onChange={(e) => updateActionConfig(idx, { due_in_days: e.target.value })}
                  placeholder="2"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('wf_task_assignees')} ({t('optional')})</Label>
              <div className="max-h-32 overflow-y-auto p-2 mt-1 rounded-lg bg-slate-50 space-y-1.5">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={(action.config.assignee_employee_ids || []).includes(emp.id)}
                      onCheckedChange={(checked) => {
                        const current = action.config.assignee_employee_ids || [];
                        updateActionConfig(idx, {
                          assignee_employee_ids: checked ? [...current, emp.id] : current.filter((id) => id !== emp.id),
                        });
                      }}
                    />
                    {emp.first_name} {emp.last_name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'update_field': {
        const updatable = event?.updatable;
        if (!updatable) {
          return <div className="text-xs text-amber-600">{t('wf_update_field_unavailable')}</div>;
        }
        const fieldDef = updatable.fields.find((f) => f.field === action.config.field);
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('wf_field_to_update')}</Label>
              <Select
                value={action.config.field || ''}
                onValueChange={(v) => updateActionConfig(idx, { target: updatable.target, field: v, value: '' })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder={t('wf_select_field')} /></SelectTrigger>
                <SelectContent>
                  {updatable.fields.map((f) => (
                    <SelectItem key={f.field} value={f.field}>{t(f.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('wf_new_value')}</Label>
              {fieldDef?.options ? (
                <Select
                  value={action.config.value || ''}
                  onValueChange={(v) => updateActionConfig(idx, { target: updatable.target, value: v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {fieldDef.options.map((o) => (
                      <SelectItem key={o} value={o}>{t(`priority_${o}`) !== `priority_${o}` ? t(`priority_${o}`) : o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="mt-1"
                  value={action.config.value || ''}
                  onChange={(e) => updateActionConfig(idx, { target: updatable.target, value: e.target.value })}
                />
              )}
            </div>
          </div>
        );
      }

      case 'send_telegram':
        return <div className="text-xs text-slate-500 italic">{t('wf_telegram_coming_soon')}</div>;

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--genix-blue)]" />
            {rule?.id ? t('wf_edit_rule') : t('wf_new_rule')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name + active toggle */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs">{t('rule_name')}</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={t('rule_name_placeholder')}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
              {t('active')}
            </label>
          </div>

          {/* QACHON — trigger */}
          <BuilderSection badge={t('wf_when')} title={t('wf_when_title')} hint={t('wf_when_hint')}>
            <Select
              value={form.trigger_event}
              onValueChange={(v) => set({ trigger_event: v, conditionRows: [] })}
            >
              <SelectTrigger><SelectValue placeholder={t('select_event')} /></SelectTrigger>
              <SelectContent>
                {groupedEvents.map((group) => (
                  <React.Fragment key={group.category}>
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {t(CATEGORY_LABEL_KEYS[group.category])}
                    </div>
                    {group.events.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        <span className="flex items-center gap-2">
                          {t(e.labelKey)}
                          {e.scheduled && (
                            <span className="text-[10px] text-slate-400">({t('wf_scheduled_badge')})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
            {event && <p className="text-xs text-slate-500">{t(event.descKey)}</p>}
          </BuilderSection>

          {/* AGAR — conditions */}
          <BuilderSection badge={t('wf_if')} title={t('wf_if_title')} hint={t('wf_if_hint')}>
            {form.conditionRows.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{t('wf_logic')}:</span>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {['and', 'or'].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => set({ logic: l })}
                      className={`px-3 py-1 text-xs font-medium ${form.logic === l
                        ? 'bg-[var(--genix-navy)] text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t(`wf_logic_${l}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.conditionRows.map((row, idx) => {
              const fieldDef = eventFields.find((f) => f.key === row.field);
              const ops = OPERATORS.filter((o) => o.types.includes(fieldDef?.type || 'text'));
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={row.field} onValueChange={(v) => updateCondition(idx, { field: v, value: '' })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={t('wf_condition_field')} /></SelectTrigger>
                    <SelectContent>
                      {eventFields.map((f) => <SelectItem key={f.key} value={f.key}>{t(f.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={row.operator} onValueChange={(v) => updateCondition(idx, { operator: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ops.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {fieldDef?.options ? (
                    <Select value={String(row.value)} onValueChange={(v) => updateCondition(idx, { value: v })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fieldDef.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="flex-1"
                      type={fieldDef?.type === 'number' ? 'number' : 'text'}
                      value={row.value}
                      onChange={(e) => updateCondition(idx, { value: e.target.value })}
                      placeholder={t('wf_value')}
                    />
                  )}
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => removeCondition(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addCondition} disabled={!event} className="gap-1.5">
              <Filter className="w-3.5 h-3.5" /> {t('wf_add_condition')}
            </Button>
            {form.conditionRows.length === 0 && (
              <p className="text-xs text-slate-400">{t('wf_no_conditions_hint')}</p>
            )}
          </BuilderSection>

          {/* UNDA — actions */}
          <BuilderSection badge={t('wf_then')} title={t('wf_then_title')} hint={t('wf_then_hint')}>
            {form.actions.map((action, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-3 bg-slate-50/40">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <Select
                    value={action.type}
                    onValueChange={(v) => updateAction(idx, {
                      type: v,
                      config: v === 'create_notification' ? { message: '', recipient_type: 'all' } : {},
                    })}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value} disabled={a.disabled}>
                          <span className="flex items-center gap-2">
                            {t(a.labelKey)}
                            {a.disabled && <span className="text-[10px] text-slate-400">({t('wf_coming_soon')})</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" disabled={idx === 0} onClick={() => moveAction(idx, -1)}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" disabled={idx === form.actions.length - 1} onClick={() => moveAction(idx, 1)}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      disabled={form.actions.length === 1}
                      onClick={() => removeAction(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {renderActionConfig(action, idx)}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addAction} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> {t('add_action')}
            </Button>
          </BuilderSection>

          {/* Description */}
          <div>
            <Label className="text-xs">{t('description')} ({t('optional')})</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder={t('rule_desc_placeholder')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white gap-1.5"
          >
            <Play className="w-4 h-4" />
            {saving ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
