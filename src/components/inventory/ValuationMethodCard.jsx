import { useState, useEffect } from 'react';
import { Calculator, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import inventoryService from '@/api/services/inventory';

// "Tannarx usuli (AVECO/FIFO)" — tenant-darajali sozlama karta.
// Usul o'zgarishi tarixni QAYTA YOZMAYDI: faqat shu kundan keyingi
// postinglar yangi usulda baholanadi (backend effective_from + history).
const METHODS = [
  { key: 'aveco', tKey: 'inv_val_aveco', descKey: 'inv_val_aveco_desc' },
  { key: 'fifo', tKey: 'inv_val_fifo', descKey: 'inv_val_fifo_desc' },
];

export default function ValuationMethodCard({ t }) {
  const { toast } = useToast();
  const [setting, setSetting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await inventoryService.getValuationSettings();
        if (alive) setSetting(data);
      } catch {
        if (alive) setSetting({ method: 'aveco' });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const select = async (method) => {
    if (saving || method === setting?.method) return;
    setSaving(true);
    try {
      const next = await inventoryService.updateValuationSettings(method);
      setSetting(next);
      toast({ description: t('inv_val_saved') });
    } catch {
      toast({ variant: 'destructive', description: t('inv_val_save_failed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{t('inv_val_title')}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">{t('inv_val_note')}</p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-[88px] rounded-xl" />
          <Skeleton className="h-[88px] rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METHODS.map(({ key, tKey, descKey }) => {
            const active = setting?.method === key;
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => select(key)}
                className={`h-auto items-start justify-start text-left rounded-xl border p-4 transition-colors ${
                  active
                    ? 'border-[var(--genix-blue)] bg-sky-50/60 hover:bg-sky-50/60'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{t(tKey)}</span>
                    {active && <Check className="w-4 h-4 text-[var(--genix-blue)]" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 whitespace-normal">{t(descKey)}</p>
                </div>
              </Button>
            );
          })}
        </div>
      )}

      {setting?.effective_from && (
        <p className="text-[11px] text-slate-400 mt-3">
          {t('inv_val_effective_from')}: {setting.effective_from}
        </p>
      )}
    </div>
  );
}
