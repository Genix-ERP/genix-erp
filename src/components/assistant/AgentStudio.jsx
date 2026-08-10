import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { X, Loader2, Eye, FileEdit, Zap, Ban, ShieldCheck, ChevronDown, ChevronRight, Bot } from 'lucide-react';
import { aiService } from '@/api/services/ai';
import { toast } from 'sonner';
import { AGENT_ICONS } from './agentIcons';

// "AI sozlamalari" — tenant configuration of the SINGLE assistant (the
// orchestrator) in plain Uzbek, no code: ko'rsatmalar (instructions), the
// huquqlar matritsasi grouped by module, and the auto-limit. Hard ceiling
// stays server-side: configured rights ∩ the invoking user's rights —
// configuration can narrow, never widen.

const TIERS = [
  { value: 'off', icon: Ban, uz: 'O‘chiq', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'read', icon: Eye, uz: 'O‘qish', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  { value: 'draft', icon: FileEdit, uz: 'Qoralama', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'auto', icon: Zap, uz: 'Avto', color: 'text-amber-600 bg-amber-50 border-amber-200' },
];

export default function AgentStudio({ agent, catalog = [], onClose, onSaved, lang = 'uz' }) {
  const tr = (uz, ru, en) => (lang === 'ru' ? ru : lang === 'en' ? en : uz);
  const [enabled, setEnabled] = useState(agent.enabled !== false);
  const [instructions, setInstructions] = useState(agent.instructions || '');
  const [overrides, setOverrides] = useState(() => {
    const o = {};
    (agent.tools || []).forEach((t) => { o[t.name] = t.state || 'draft'; });
    return o;
  });
  const [autoLimit, setAutoLimit] = useState(agent.auto_limit_amount ?? '');
  const [collapsed, setCollapsed] = useState({});
  const [saving, setSaving] = useState(false);

  // Group the orchestrator's full tool list under the module agent whose
  // tools[] contains each tool (first match wins); leftovers go to "Boshqa".
  const groups = useMemo(() => {
    const tools = agent.tools || [];
    const claimed = new Set();
    const out = [];
    for (const m of catalog) {
      if (m.key === agent.key || !Array.isArray(m.tools) || !m.tools.length) continue;
      const names = new Set(m.tools.map((t) => t.name));
      const mine = tools.filter((t) => names.has(t.name) && !claimed.has(t.name));
      if (!mine.length) continue;
      mine.forEach((t) => claimed.add(t.name));
      out.push({
        key: m.key,
        name: m.name?.[lang] || m.name?.uz || m.key,
        icon: m.icon,
        writes: mine.filter((t) => t.kind === 'write'),
        reads: mine.filter((t) => t.kind === 'read'),
      });
    }
    const rest = tools.filter((t) => !claimed.has(t.name));
    if (rest.length) {
      out.push({
        key: '_other',
        name: tr('Boshqa', 'Прочее', 'Other'),
        icon: 'bot',
        writes: rest.filter((t) => t.kind === 'write'),
        reads: rest.filter((t) => t.kind === 'read'),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, catalog, lang]);

  const hasAuto = Object.values(overrides).includes('auto');

  const setTier = (tool, tier, kind) => {
    // Read tools only toggle between off/read; write tools use the full ladder.
    if (kind === 'read' && tier !== 'off') tier = 'read';
    setOverrides((o) => ({ ...o, [tool]: tier }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        enabled,
        instructions,
        tool_overrides: overrides,
      };
      if (hasAuto && autoLimit !== '' && !Number.isNaN(Number(autoLimit))) {
        payload.auto_limit_amount = Number(autoLimit);
      } else {
        payload.clear_auto_limit = true;
      }
      await aiService.updateAgentSettings(agent.key, payload);
      toast.success(tr('Saqlandi. O‘zgarishlar darhol kuchga kirdi.', 'Сохранено.', 'Saved.'));
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message;
      toast.error(typeof msg === 'string' ? msg : tr('Saqlab bo‘lmadi', 'Не сохранилось', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-sm text-slate-900 flex-1">
            {tr('AI sozlamalari', 'Настройки ИИ', 'AI settings')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">{tr('AI yordamchi yoqilgan', 'ИИ-помощник включён', 'AI assistant enabled')}</p>
              <p className="text-[11px] text-slate-400">
                {agent.description_uz || tr('Bitta yordamchi — barcha modullar bo‘yicha savollarni o‘zi yo‘naltiradi.',
                  'Один помощник — сам маршрутизирует вопросы по модулям.',
                  'One assistant — it routes questions across modules itself.')}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-800 mb-1">{tr("Ko'rsatmalar", 'Инструкции', 'Instructions')}</p>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} maxLength={4000}
              placeholder={tr("Masalan: javoblarni qisqa yoz; chegirma faqat direktor ruxsati bilan…", 'Например: пиши кратко…', 'e.g. keep answers short…')} />
            <p className="text-[10px] text-slate-400 mt-1">
              {tr('Platforma bazaviy prompti o‘zgarmaydi — bu matn unga qo‘shiladi va hech qachon huquq bermaydi.',
                  'Базовый промпт платформы неизменен — этот текст добавляется поверх.',
                  'The platform base prompt is fixed — this text layers on top and never grants rights.')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-800 mb-1">{tr('Huquqlar', 'Права', 'Permissions')}</p>
            <p className="text-[10px] text-slate-400 mb-2">
              {tr('Amaldagi huquq = shu sozlama ∩ so‘rov yuborgan foydalanuvchining o‘z huquqi (serverda tekshiriladi). Sozlash huquqni faqat toraytiradi, hech qachon kengaytirmaydi.',
                  'Эффективное право = настройка ∩ права пользователя (проверяется на сервере). Настройка может только сузить права, но не расширить.',
                  'Effective right = this setting ∩ the invoking user’s own right (enforced server-side). Configuration can only narrow rights, never widen them.')}
            </p>

            {hasAuto && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 mb-3">
                <p className="text-[11px] font-medium text-amber-800 mb-1">
                  {tr('Avto limit (so‘m)', 'Автолимит (сум)', 'Auto limit (so‘m)')}
                </p>
                <Input type="number" value={autoLimit} onChange={(e) => setAutoLimit(e.target.value)} placeholder="10000000" className="h-8 bg-white" />
                <p className="text-[10px] text-amber-700 mt-1">
                  {tr('Shu summagacha bo‘lgan amallarni yordamchi o‘zi bajaradi; hammasi audit jurnalida qoladi.',
                      'До этой суммы помощник действует сам; всё в журнале аудита.',
                      'Up to this amount the assistant acts on its own; everything lands in the audit log.')}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {groups.map((g) => {
                const Icon = AGENT_ICONS[g.icon] || Bot;
                const isOpen = !collapsed[g.key];
                const count = g.writes.length + g.reads.length;
                return (
                  <div key={g.key} className="rounded-xl border border-slate-100 overflow-hidden">
                    <button onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50/60 hover:bg-slate-50 transition-colors text-left">
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="flex-1 text-xs font-semibold text-slate-800">{g.name}</span>
                      <span className="text-[10px] text-slate-400">{count} {tr('amal', 'действ.', 'tools')}</span>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-300" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                    </button>
                    {isOpen && (
                      <div className="px-3 py-2 space-y-2">
                        {g.writes.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-1">
                              {tr('Yozish amallari', 'Записи', 'Writes')}
                            </p>
                            <div className="space-y-1">
                              {g.writes.map((t) => (
                                <ToolRow key={t.name} tool={t} tier={overrides[t.name] || 'draft'} tiers={TIERS}
                                  onSelect={(tier) => setTier(t.name, tier, 'write')} />
                              ))}
                            </div>
                          </div>
                        )}
                        {g.reads.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 mb-1">
                              {tr('O‘qish amallari', 'Чтение', 'Reads')}
                            </p>
                            <div className="space-y-1">
                              {g.reads.map((t) => (
                                <ToolRow key={t.name} tool={t} tier={overrides[t.name] === 'off' ? 'off' : 'read'}
                                  tiers={TIERS.slice(0, 2)} onSelect={(tier) => setTier(t.name, tier, 'read')} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">
                  {tr('Amal ro‘yxati topilmadi', 'Список действий не найден', 'No tools found')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>{tr('Yopish', 'Закрыть', 'Close')}</Button>
          <Button size="sm" onClick={save} disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            {tr('Saqlash', 'Сохранить', 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolRow({ tool, tier, tiers, onSelect }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`flex-1 text-[11px] truncate ${tool.rbac === false ? 'text-slate-300 line-through' : 'text-slate-700'}`}
        title={tool.rbac === false ? 'Sizning rolingiz bu amalga ruxsat bermaydi' : tool.name}>
        {tool.name}
      </span>
      <div className="flex gap-0.5">
        {tiers.map((t) => {
          const Icon = t.icon;
          const active = tier === t.value;
          return (
            <button key={t.value} onClick={() => onSelect(t.value)} title={t.uz}
              className={`px-1.5 py-0.5 rounded-md border text-[9px] font-medium inline-flex items-center gap-0.5 transition-colors ${
                active ? t.color : 'text-slate-300 border-transparent hover:border-slate-200'}`}>
              <Icon className="w-2.5 h-2.5" />{t.uz}
            </button>
          );
        })}
      </div>
    </div>
  );
}
