import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

// Shared brak-sababi capture used by the shop-floor complete dialog and the
// kiosk TOPSHIRISH dialog. Chips + optional free text; the composed human
// string goes into POST /work-orders/:id/quality-check as defect_reason.
export const QC_REASONS = [
  { id: 'scratch', key: 'qc_reason_scratch' },
  { id: 'dimension', key: 'qc_reason_dimension' },
  { id: 'material', key: 'qc_reason_material' },
  { id: 'other', key: 'qc_reason_other' },
];

// Compose the defect_reason string sent to the backend from the picked chip
// (localized label) and the optional free text.
export function composeDefectReason(t, reason, text) {
  const chip = QC_REASONS.find((r) => r.id === reason);
  const label = chip ? t(chip.key) : '';
  const free = (text || '').trim();
  if (label && free) return `${label}: ${free}`;
  return label || free;
}

export default function QCReasonPicker({ reason, text, onChange, big = false }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const chipCls = (active) => [
    big ? 'px-5 py-3 text-base rounded-xl min-h-[52px]' : 'px-3 py-1.5 text-xs rounded-lg',
    'font-medium border transition-colors',
    active
      ? 'bg-red-600 text-white border-red-600'
      : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600',
  ].join(' ');

  return (
    <div className="space-y-2">
      <p className={`${big ? 'text-base' : 'text-sm'} font-medium text-slate-700`}>
        {t('qc_reason_label')}
      </p>
      <div className="flex flex-wrap gap-2">
        {QC_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={chipCls(reason === r.id)}
            onClick={() => onChange({ reason: reason === r.id ? '' : r.id, text })}
          >
            {t(r.key)}
          </button>
        ))}
      </div>
      <Input
        value={text || ''}
        onChange={(e) => onChange({ reason, text: e.target.value })}
        placeholder={t('qc_reason_free_placeholder')}
        className={big ? 'h-12 text-base' : ''}
      />
    </div>
  );
}
