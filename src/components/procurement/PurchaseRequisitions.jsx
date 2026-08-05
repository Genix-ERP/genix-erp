import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  ArrowRight,
  Loader2,
  RefreshCw,
  HardHat,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/config/permissions';
import { getApiErrorMessage } from '@/utils/apiError';
import { procurementService } from '@/api/services/procurement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const PR_STATUS_META = {
  draft: { key: 'pr_status_draft', fallback: 'Qoralama', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  pending_approval: { key: 'pr_status_pending', fallback: 'Tasdiq kutilmoqda', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  approved: { key: 'pr_status_approved', fallback: 'Tasdiqlangan', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { key: 'pr_status_rejected', fallback: 'Rad etilgan', cls: 'bg-red-50 text-red-700 border-red-200' },
  converted: { key: 'pr_status_converted', fallback: 'PO yaratilgan', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { key: 'pr_status_cancelled', fallback: 'Bekor qilingan', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// Xarid so'rovlari (purchase requisitions) — material zayavkalaridan va
// MRP'dan avto-yaratilgan ichki so'rovlar. Ta'minotchi shu yerda yetkazib
// beruvchini tanlab, buyurtma (PO) ochadi.
export default function PurchaseRequisitions() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canCreate } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const [convertPR, setConvertPR] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [converting, setConverting] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [lines, setLines] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = { page_size: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await procurementService.listRequisitions(params);
      setRequisitions(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError(getApiErrorMessage(e, t('pr_load_failed') || "So'rovlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
    // `t` ataylab deps'da EMAS: useTranslation har renderda yangi closure
    // qaytaradi — deps'ga qo'shilsa cheksiz so'rov tsikli (429) bo'ladi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const openConvert = async (pr) => {
    setConvertPR(pr);
    setSupplierId('');
    if (suppliers.length === 0) {
      try {
        const data = await procurementService.listSuppliers({ limit: 200 });
        const list = Array.isArray(data) ? data : (data?.items || []);
        setSuppliers(list);
      } catch {
        setSuppliers([]);
      }
    }
  };

  const handleConvert = async () => {
    if (!convertPR || !supplierId || converting) return;
    setConverting(true);
    try {
      const po = await procurementService.convertRequisitionToPO(convertPR.id, { supplier_id: supplierId });
      toast.success(`${t('pr_po_created') || 'Buyurtma yaratildi'}: ${po?.po_number || ''}`);
      setConvertPR(null);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('pr_convert_failed') || "PO yaratib bo'lmadi"));
    } finally {
      setConverting(false);
    }
  };

  const toggleLines = async (pr) => {
    if (expandedId === pr.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(pr.id);
    if (!lines[pr.id]) {
      try {
        const detail = await procurementService.getRequisition(pr.id);
        setLines((prev) => ({ ...prev, [pr.id]: detail?.lines || [] }));
      } catch {
        setLines((prev) => ({ ...prev, [pr.id]: [] }));
      }
    }
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>{t('pr_title') || "Xarid so'rovlari"}</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_statuses') || 'Barcha holatlar'}</SelectItem>
              {Object.entries(PR_STATUS_META).map(([value, meta]) => (
                <SelectItem key={value} value={value}>{t(meta.key) || meta.fallback}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : loadError ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-3">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              {t('retry') || 'Qayta urinish'}
            </Button>
          </div>
        ) : requisitions.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {t('pr_empty') || "Hozircha xarid so'rovlari yo'q"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requisitions.map((pr) => {
              const meta = PR_STATUS_META[pr.status] || PR_STATUS_META.draft;
              return (
                <li key={pr.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleLines(pr)}
                      className="font-semibold text-sm text-slate-900 hover:text-[var(--genix-blue)]"
                    >
                      {pr.pr_number}
                    </button>
                    {/* Manba: material zayavkasi (6.5-bo'lim — kontekst) */}
                    {pr.material_request_number && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        <HardHat className="w-3 h-3" />
                        {pr.material_request_number}
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                      {t(meta.key) || meta.fallback}
                    </span>
                    {pr.po_number && (
                      <span className="text-xs text-slate-500">
                        → {pr.po_number} {pr.po_status ? `(${pr.po_status})` : ''}
                      </span>
                    )}
                    <span className="ml-auto text-sm font-medium text-slate-700 tabular-nums">
                      {formatCurrency ? formatCurrency(pr.total_amount || 0) : (pr.total_amount || 0)}
                    </span>
                    {pr.status === 'approved' && canCreate(MODULES.PURCHASES) && (
                      <Button size="sm" onClick={() => openConvert(pr)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                        {t('pr_create_po') || 'PO yaratish'}
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {pr.purpose || pr.department || ''}
                    {pr.required_date ? ` · ${t('mr_needed_by') || 'Kerak sana'}: ${pr.required_date}` : ''}
                  </p>
                  {expandedId === pr.id && (
                    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                      {!lines[pr.id] ? (
                        <div className="p-3 text-sm text-slate-400 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> {t('loading') || 'Yuklanmoqda...'}
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-400">
                              <th className="px-3 py-1.5 text-left font-semibold">{t('mr_material') || 'Material'}</th>
                              <th className="px-3 py-1.5 text-right font-semibold">{t('quantity') || 'Miqdor'}</th>
                              <th className="px-3 py-1.5 text-right font-semibold">{t('pr_est_price') || 'Baholangan narx'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(lines[pr.id] || []).map((l, i) => (
                              <tr key={i}>
                                <td className="px-3 py-1.5">{l.product_name}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{l.quantity} {l.unit || ''}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {formatCurrency ? formatCurrency(l.estimated_price || 0) : (l.estimated_price || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* PO yaratish — yetkazib beruvchi tanlash */}
      <Dialog open={!!convertPR} onOpenChange={(v) => { if (!v) setConvertPR(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(t('pr_create_po') || 'PO yaratish')}: {convertPR?.pr_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">
              {t('supplier') || 'Yetkazib beruvchi'} *
            </label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder={t('pr_select_supplier') || 'Yetkazib beruvchini tanlang'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertPR(null)}>
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button disabled={!supplierId || converting} onClick={handleConvert}>
              {converting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {t('pr_create_po') || 'PO yaratish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
