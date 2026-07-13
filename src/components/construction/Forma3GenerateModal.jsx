import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { constructionService } from '@/api/services/construction';

// Works-driven Forma 3 (КС-3) generator.
//
// Builds the справка-счёт-фактура from engineer-confirmed (YAKUNIY) works of a
// single subcontractor and splits them into the three КС-3 windows
// (с начала строительства / с начала года / за отчетный месяц) by each work's
// confirmation date relative to the chosen reporting month. Forma 3 is
// subcontractor-only — ЗАКАЗЧИК is the active company, ПОДРЯДЧИК is the picked
// subcontractor. Object name / contract / cert № are left blank for the user.
//
// Props:
//   open, onOpenChange   — dialog control
//   project              — { id }
//   subcontractors       — [{ id, name }]
//   language             — 'uz' | 'ru' | 'en'
//
// The certificate always covers ALL of the subcontractor's works across the
// whole project (building_id = 0) — there is no per-block scoping.
export default function Forma3GenerateModal({
  open,
  onOpenChange,
  project,
  subcontractors = [],
  language = 'uz',
}) {
  const tr = (m) => m[language] || m.uz;
  const now = new Date();
  const [sub, setSub] = useState(0);
  const [certDate, setCertDate] = useState(now.toISOString().slice(0, 10));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);

  // Default the subcontractor picker to the first available one whenever the
  // modal opens or the list changes.
  useEffect(() => {
    if (!open) return;
    const exists = subcontractors.some((s) => Number(s.id) === Number(sub));
    if (!exists) setSub(subcontractors[0]?.id || 0);
  }, [open, subcontractors]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthNames = {
    uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };

  const handleGenerate = async () => {
    if (!project?.id || !sub) return;
    setBusy(true);
    try {
      const blob = await constructionService.generateForma3FromWorks(project.id, {
        subcontract_id: Number(sub),
        building_id: 0, // always whole project — all of the subcontractor's works
        cert_date: certDate,
        period_month: Number(month),
        period_year: Number(year),
        lang: language,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forma3_${project.id}_${year}_${String(month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(tr({
        uz: 'Forma 3 yuklab olindi',
        ru: 'Форма 3 загружена',
        en: 'Forma 3 downloaded',
      }));
      onOpenChange(false);
    } catch (e) {
      console.error('Forma 3 generation failed', e);
      // The xlsx comes back as a blob, so an error body is a Blob too — try to
      // surface the server's message when present.
      let msg = '';
      try {
        const data = e?.response?.data;
        if (data instanceof Blob) {
          const parsed = JSON.parse(await data.text());
          msg = parsed?.error?.message || parsed?.message || '';
        } else {
          msg = data?.error?.message || data?.message || '';
        }
      } catch (_) { /* ignore parse errors */ }
      toast.error(msg || tr({
        uz: 'Forma 3 yaratishda xatolik yuz berdi',
        ru: 'Ошибка при формировании Формы 3',
        en: 'Failed to generate Forma 3',
      }));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-md text-sm border border-slate-300 bg-white text-slate-900';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] w-[92vw] max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {tr({ uz: 'Forma 3 ni yaratish', ru: 'Создать Форму 3', en: 'Create Forma 3' })}
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            {tr({
              uz: 'Bosh muhandis yakunlagan (YAKUNIY) ishlardan КС-3 tuziladi.',
              ru: 'КС-3 формируется из работ, принятых главным инженером (YAKUNIY).',
              en: 'КС-3 is built from works confirmed by the chief engineer (YAKUNIY).',
            })}
          </p>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>
                {tr({ uz: 'Pudratchi', ru: 'Подрядчик', en: 'Contractor' })}
              </label>
              {subcontractors.length === 0 ? (
                <div className="text-xs text-amber-600 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                  {tr({
                    uz: "Pudratchi smetasi yo'q. Forma 3 faqat pudratchi uchun tuziladi.",
                    ru: 'Нет смет подрядчиков. КС-3 формируется только для подрядчика.',
                    en: 'No subcontractor estimates. Forma 3 is for subcontractors only.',
                  })}
                </div>
              ) : (
                <select value={sub} onChange={(e) => setSub(Number(e.target.value))} className={inputCls}>
                  {subcontractors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={labelCls}>
                {tr({ uz: 'Tuzilgan sana', ru: 'Дата составления', en: 'Date of issue' })}
              </label>
              <input type="date" value={certDate} onChange={(e) => setCertDate(e.target.value)} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {tr({ uz: 'Hisobot oyi', ru: 'Отчетный месяц', en: 'Reporting month' })}
                </label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>{monthNames[language] ? monthNames[language][m - 1] : monthNames.uz[m - 1]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  {tr({ uz: 'Yil', ru: 'Год', en: 'Year' })}
                </label>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 border border-slate-300 bg-white"
            >
              {tr({ uz: 'Bekor qilish', ru: 'Отмена', en: 'Cancel' })}
            </button>
            <button
              onClick={handleGenerate}
              disabled={busy || !sub}
              className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
              style={{ background: '#0d9488' }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {tr({ uz: 'Yuklab olish', ru: 'Скачать', en: 'Download' })}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
