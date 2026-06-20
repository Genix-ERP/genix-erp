// CRMLinkPanel — small reusable widget for wiring a Genix construction
// project (or building) to its counterpart in the Yuksalish CRM.
//
// Two modes:
//   <CRMLinkPanel mode="project" value={crmProjectId} onChange={fn} />
//   <CRMLinkPanel mode="block"   value={{crmBlockId, currentStage, autoSync}}
//                 crmProjectId={parentLink} onChange={fn} />
//
// The "project" mode just shows a dropdown of CRM projects. The "block"
// mode is filtered by the parent project's crmProjectId and additionally
// exposes the current-stage picker (which stage future photo reports go
// into) and the auto-sync on/off switch.
//
// All API calls go through Genix's own /construction/crm/* proxy
// endpoints — the browser never holds the CRM token.

import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { constructionService } from '@/api/services/construction';
import { Link as LinkIcon, AlertCircle } from 'lucide-react';

// Match the CRM's fixed 8-stage enum exactly. Keep in sync with the CRM's
// STAGE_ORDER constant in pages/BlockProgress.tsx.
const CRM_STAGES = [
  { value: 'foundation', label_uz: 'Poydevor', label_ru: 'Фундамент', label_en: 'Foundation' },
  { value: 'structural', label_uz: 'Karkas', label_ru: 'Каркас', label_en: 'Structural' },
  { value: 'roofing', label_uz: 'Tom', label_ru: 'Кровля', label_en: 'Roofing' },
  { value: 'facade', label_uz: 'Fasad', label_ru: 'Фасад', label_en: 'Facade' },
  { value: 'interior', label_uz: 'Ichki ishlar', label_ru: 'Внутренние работы', label_en: 'Interior' },
  { value: 'utilities', label_uz: 'Kommunikatsiya', label_ru: 'Коммуникации', label_en: 'Utilities' },
  { value: 'landscaping', label_uz: 'Hudud obodonlashtirish', label_ru: 'Благоустройство', label_en: 'Landscaping' },
  { value: 'completion', label_uz: 'Yakuniy', label_ru: 'Завершение', label_en: 'Completion' },
];

function stageLabel(stage, language) {
  const s = CRM_STAGES.find((x) => x.value === stage);
  if (!s) return stage;
  return s[`label_${language}`] || s.label_en;
}

export default function CRMLinkPanel({ mode = 'project', value, onChange, crmProjectId, language = 'uz' }) {
  const [projects, setProjects] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load CRM projects once when the panel mounts (project mode) or the
  // parent project's CRM id changes (block mode).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (mode === 'project') {
          const data = await constructionService.listCRMProjects();
          if (cancelled) return;
          setConfigured(!!data?.configured);
          setProjects(data?.projects || []);
        } else if (mode === 'block') {
          if (!crmProjectId) {
            setBlocks([]);
            return;
          }
          const data = await constructionService.listCRMBlocks(crmProjectId);
          if (cancelled) return;
          setConfigured(!!data?.configured);
          setBlocks(data?.blocks || []);
        }
      } catch (e) {
        if (!cancelled) {
          // Genix backend errors are {error: {code, message}}; some endpoints
          // return {error: "string"}. Extract a string either way so React
          // doesn't choke on rendering an object.
          const err = e?.response?.data?.error;
          const msg = typeof err === 'string'
            ? err
            : (err?.message || e?.response?.data?.message || e?.message || 'CRM fetch failed');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode, crmProjectId]);

  const t = (uz, ru, en) => (language === 'uz' ? uz : language === 'ru' ? ru : en);

  if (!configured) {
    return (
      <div className="border rounded-lg p-3 bg-slate-50 text-sm flex items-start gap-2 text-slate-600">
        <AlertCircle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
        <div>
          <p className="font-medium">{t('CRM ulanmagan', 'CRM не подключен', 'CRM not connected')}</p>
          <p className="text-xs text-slate-500">
            {t(
              'CRM_API_BASE va CRM_API_TOKEN sozlanmagan. Tizim adminstratoriga murojaat qiling.',
              'CRM_API_BASE и CRM_API_TOKEN не настроены. Обратитесь к администратору.',
              'CRM_API_BASE / CRM_API_TOKEN are unset. Ask your admin to configure them.'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'project') {
    return (
      <div className="border rounded-lg p-3 bg-blue-50/30 border-blue-200 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
          <LinkIcon className="w-4 h-4" />
          {t('CRM bilan ulash', 'Связать с CRM', 'Link to CRM')}
        </div>
        <p className="text-xs text-blue-700/80">
          {t(
            'Mos CRM loyihasini tanlang. Bog\'langandan keyin fotohisobotlar avtomatik CRM ga yuboriladi.',
            'Выберите проект в CRM. После связи фотоотчёты будут автоматически отправляться в CRM.',
            'Pick the matching CRM project. Once linked, photo reports auto-sync to CRM.'
          )}
        </p>
        <Select
          value={value ? String(value) : ''}
          onValueChange={(v) => onChange?.(v === '__none__' ? null : Number(v))}
          disabled={loading}
        >
          <SelectTrigger className="bg-white">
            <SelectValue placeholder={loading ? t('Yuklanmoqda…', 'Загрузка…', 'Loading…') : t('CRM loyihasini tanlang', 'Выберите проект CRM', 'Select CRM project')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— {t('Bog\'lanmagan', 'Не связано', 'Not linked')} —</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name} <span className="text-slate-400 text-xs">#{p.id}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Block mode
  const v = value || {};
  return (
    <div className="border rounded-lg p-3 bg-blue-50/30 border-blue-200 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
        <LinkIcon className="w-4 h-4" />
        {t('CRM blok bilan ulash', 'Связать с блоком CRM', 'Link to CRM block')}
      </div>

      {!crmProjectId && (
        <p className="text-xs text-amber-700">
          {t(
            'Avval loyihani CRM ga bog\'lang.',
            'Сначала свяжите проект с CRM.',
            'Link the parent project to CRM first.'
          )}
        </p>
      )}

      <div>
        <Label className="text-xs">{t('CRM bloki', 'Блок CRM', 'CRM block')}</Label>
        <Select
          value={v.crmBlockId ? String(v.crmBlockId) : ''}
          onValueChange={(val) => onChange?.({ ...v, crmBlockId: val === '__none__' ? null : Number(val) })}
          disabled={!crmProjectId || loading}
        >
          <SelectTrigger className="bg-white">
            <SelectValue placeholder={loading ? t('Yuklanmoqda…', 'Загрузка…', 'Loading…') : t('Blok tanlang', 'Выберите блок', 'Select block')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— {t('Bog\'lanmagan', 'Не связано', 'Not linked')} —</SelectItem>
            {blocks.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name} <span className="text-slate-400 text-xs">#{b.id}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">{t('Joriy bosqich', 'Текущий этап', 'Current stage')}</Label>
        <Select
          value={v.currentStage || 'foundation'}
          onValueChange={(val) => onChange?.({ ...v, currentStage: val })}
          disabled={!v.crmBlockId}
        >
          <SelectTrigger className="bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{stageLabel(s.value, language)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500 mt-1">
          {t(
            'Yangi fotohisobotlar shu bosqichga yuboriladi. Ish bosqichi o\'zgarganda yangilang.',
            'Новые фотоотчёты пойдут на этот этап. Обновите при смене этапа работ.',
            'New photo reports land in this stage. Update when work shifts phases.'
          )}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">{t('Avtomatik sinxronizatsiya', 'Авто-синхронизация', 'Auto-sync')}</Label>
        <Switch
          checked={v.autoSync !== false}
          onCheckedChange={(checked) => onChange?.({ ...v, autoSync: checked })}
          disabled={!v.crmBlockId}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
