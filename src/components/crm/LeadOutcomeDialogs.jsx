import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trophy, XCircle, FileText, Users, Loader2, Check } from 'lucide-react';
import { useTranslation } from '@/components/utils/translations';
import { useToast } from '@/components/ui/use-toast';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { leadsService } from '@/api/services/leads';
import { lostReasonsService } from '@/api/services/crm';

// Win + loss flows (Pipedrive-style): loss requires a reason from the tenant
// catalog; winning creates-or-links the unified partner server-side (phone
// dedupe) and then offers the ERP handoff — contract, customer card.
export default function LeadOutcomeDialogs({ wonLead, lostLead, onClose, onDone, language = 'uz' }) {
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const { formatCurrency } = useCurrencyFormatter();
  const navigate = useNavigate();

  // ── won ──
  const [winning, setWinning] = useState(false);
  const [winResult, setWinResult] = useState(null); // {partner_id, partner_name, partner_created}

  // ── lost ──
  const [reasons, setReasons] = useState([]);
  const [reasonId, setReasonId] = useState(null);
  const [note, setNote] = useState('');
  const [losing, setLosing] = useState(false);

  useEffect(() => {
    if (lostLead) {
      setReasonId(null);
      setNote('');
      lostReasonsService.list().then(setReasons).catch(() => setReasons([]));
    }
  }, [lostLead]);

  useEffect(() => {
    if (!wonLead) setWinResult(null);
  }, [wonLead]);

  const confirmWin = async () => {
    if (!wonLead) return;
    setWinning(true);
    try {
      const res = await leadsService.win(wonLead.id, {});
      setWinResult(res);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error') || 'Error',
        description: err.response?.data?.error?.message || t('crm_win_failed') || 'Failed',
      });
    } finally {
      setWinning(false);
    }
  };

  const confirmLose = async () => {
    if (!lostLead || !reasonId) return;
    setLosing(true);
    try {
      await leadsService.lose(lostLead.id, reasonId, note);
      toast({
        title: t('crm_lead_lost_title') || "Lid yo'qotilgan deb belgilandi",
        description: reasons.find((r) => r.id === reasonId)?.name || '',
      });
      onDone?.();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error') || 'Error',
        description: err.response?.data?.error?.message || '',
      });
    } finally {
      setLosing(false);
    }
  };

  const amount = Number(wonLead?.expected_value) || 0;

  const goToContract = () => {
    const params = new URLSearchParams({
      create: '1',
      lead_id: wonLead.id,
      title: `${wonLead.company_name || wonLead.contact_name || ''}`.trim(),
      direction: 'income',
    });
    if (amount > 0) params.set('value', String(amount));
    if (winResult?.partner_id) params.set('counterparty_id', winResult.partner_id);
    onDone?.();
    navigate(`/contracts?${params.toString()}`);
  };

  const goToPartner = () => {
    onDone?.();
    navigate('/customers?tab=customers');
  };

  return (
    <>
      {/* ── WIN ── */}
      <Dialog open={!!wonLead} onOpenChange={(open) => { if (!open) { winResult ? onDone?.() : onClose?.(); } }}>
        <DialogContent className="sm:max-w-md">
          {!winResult ? (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <Trophy className="h-6 w-6 text-emerald-600" />
                </div>
                <DialogTitle className="text-center">
                  {t('crm_win_title') || 'Bitim yutildimi?'}
                </DialogTitle>
                <DialogDescription className="text-center">
                  <span className="font-semibold text-slate-900">{wonLead?.contact_name}</span>
                  {wonLead?.company_name ? ` · ${wonLead.company_name}` : ''}
                  {amount > 0 && (
                    <span className="mt-1 block text-lg font-bold text-emerald-600">
                      {formatCurrency ? formatCurrency(amount) : amount.toLocaleString()}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t('crm_win_partner_hint') || "Mijoz avtomatik yaratiladi yoki telefon raqami bo'yicha mavjud mijozga bog'lanadi."}
              </p>
              <DialogFooter className="gap-2 sm:justify-center">
                <Button variant="outline" onClick={onClose}>{t('cancel') || 'Bekor qilish'}</Button>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirmWin} disabled={winning}>
                  {winning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                  {t('crm_confirm_win') || 'Yutildi'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <DialogTitle className="text-center">
                  {t('crm_win_done_title') || 'Tabriklaymiz — bitim yutildi!'}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {winResult.partner_created
                    ? `${t('crm_partner_created') || 'Yangi mijoz yaratildi'}: ${winResult.partner_name || ''}`
                    : `${t('crm_partner_linked') || 'Mavjud mijozga bog’landi'}: ${winResult.partner_name || ''}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={goToContract}>
                  <FileText className="mr-2 h-4 w-4 text-[var(--genix-purple)]" />
                  {t('crm_create_contract') || 'Shartnoma yaratish'}
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={goToPartner}>
                  <Users className="mr-2 h-4 w-4 text-[var(--genix-blue)]" />
                  {t('crm_open_partner') || "Mijozlar ro'yxatiga o'tish"}
                </Button>
              </div>
              <DialogFooter>
                <Button className="w-full" onClick={onDone}>{t('done') || 'Tayyor'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── LOSE ── */}
      <Dialog open={!!lostLead} onOpenChange={(open) => !open && onClose?.()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center">
              {t('crm_lose_title') || "Nega yo'qotildi?"}
            </DialogTitle>
            <DialogDescription className="text-center">
              <span className="font-semibold text-slate-900">{lostLead?.contact_name}</span>
              {lostLead?.company_name ? ` · ${lostLead.company_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {reasons.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReasonId(r.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${reasonId === r.id ? 'border-red-400 bg-red-50 font-medium text-red-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {r.name}
                {reasonId === r.id && <Check className="h-4 w-4" />}
              </button>
            ))}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('crm_lose_note_placeholder') || "Izoh (ixtiyoriy)"}
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={onClose}>{t('cancel') || 'Bekor qilish'}</Button>
            <Button
              variant="destructive"
              onClick={confirmLose}
              disabled={!reasonId || losing}
            >
              {losing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              {t('crm_confirm_lose') || "Yo'qotildi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
