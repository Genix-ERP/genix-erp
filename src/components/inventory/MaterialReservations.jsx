import React, { useState, useEffect, useCallback } from 'react';
import inventoryService from '@/api/services/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Search, Loader2, Package, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function MaterialReservations() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve'|'reject'|'delete', id, name }
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await inventoryService.listReservations(params);
      setReservations(data || []);
    } catch (e) {
      console.error('Failed to load reservations', e);
      toast.error('Error loading reservations');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  const handleApprove = async (id) => {
    try {
      await inventoryService.approveReservation(id);
      toast.success(t('reservation_approved') || 'Reservation approved');
      loadReservations();
    } catch (e) {
      console.error('Failed to approve', e);
      toast.error(e?.response?.data?.message || t('error_occurred') || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    try {
      await inventoryService.rejectReservation(id);
      toast.success(t('reservation_rejected') || 'Reservation rejected');
      loadReservations();
    } catch (e) {
      console.error('Failed to reject', e);
      toast.error(t('error_occurred') || 'Failed to reject');
    }
  };

  const handleDelete = async (id) => {
    try {
      await inventoryService.deleteReservation(id);
      toast.success(t('deleted') || 'Deleted');
      loadReservations();
    } catch (e) {
      console.error('Failed to delete', e);
      toast.error(t('error_occurred') || 'Failed to delete');
    }
  };

  const executeConfirmAction = () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setConfirmAction(null);
    if (type === 'approve') handleApprove(id);
    else if (type === 'reject') handleReject(id);
    else if (type === 'delete') handleDelete(id);
  };

  const filtered = reservations.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.project_name || '').toLowerCase().includes(q) ||
      (r.stage_name || '').toLowerCase().includes(q) ||
      (r.substage_name || '').toLowerCase().includes(q) ||
      (r.requested_by_name || '').toLowerCase().includes(q)
    );
  });

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pendingCount = reservations.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">{t('material_reservations') || 'Material zaxiralari'}</CardTitle>
              {pendingCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  {pendingCount} {t('pending') || 'kutilmoqda'}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search') || 'Qidirish...'}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all') || 'Hammasi'}</SelectItem>
                <SelectItem value="pending">{t('pending') || 'Kutilmoqda'}</SelectItem>
                <SelectItem value="approved">{t('approved') || 'Tasdiqlangan'}</SelectItem>
                <SelectItem value="rejected">{t('rejected') || 'Rad etilgan'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin w-8 h-8 text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Package className="mx-auto w-12 h-12 mb-4 text-slate-300" />
            <p>{t('no_reservations') || 'Zaxiralar mavjud emas'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-slate-600 text-xs">
                    <th className="text-left px-4 py-3">{t('product') || 'Mahsulot'}</th>
                    <th className="text-left px-3 py-3">{t('project') || 'Loyiha'}</th>
                    <th className="text-left px-3 py-3">{t('stage') || 'Bosqich'}</th>
                    <th className="text-left px-3 py-3">{t('substage') || 'Kichik bosqich'}</th>
                    <th className="text-right px-3 py-3">{t('quantity') || 'Miqdor'}</th>
                    <th className="text-center px-3 py-3">{t('unit') || 'Birlik'}</th>
                    <th className="text-right px-3 py-3">{t('unit_price') || 'Narx'}</th>
                    <th className="text-right px-3 py-3">{t('total') || 'Jami'}</th>
                    <th className="text-center px-3 py-3">{t('status') || 'Holat'}</th>
                    <th className="text-left px-3 py-3">{t('requested_by') || "So'ragan"}</th>
                    <th className="text-left px-3 py-3">{t('date') || 'Sana'}</th>
                    <th className="text-center px-3 py-3">{t('actions') || 'Amallar'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(res => (
                    <tr key={res.id} className="border-t hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{res.product_name}</td>
                      <td className="px-3 py-3 text-slate-600">{res.project_name}</td>
                      <td className="px-3 py-3 text-slate-600">{res.stage_name}</td>
                      <td className="px-3 py-3 text-slate-600">{res.substage_name}</td>
                      <td className="px-3 py-3 text-right">{res.quantity}</td>
                      <td className="px-3 py-3 text-center text-slate-500">{res.unit}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(res.unit_cost)}</td>
                      <td className="px-3 py-3 text-right font-medium">{formatCurrency(res.total_cost)}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge className={`text-xs ${STATUS_COLORS[res.status] || ''}`}>
                          {t(res.status) || res.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{res.requested_by_name}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">
                        {new Date(res.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {res.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title={t('approve') || 'Tasdiqlash'}
                                onClick={() => setConfirmAction({ type: 'approve', id: res.id, name: res.product_name })}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                title={t('reject') || 'Rad etish'}
                                onClick={() => setConfirmAction({ type: 'reject', id: res.id, name: res.product_name })}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {res.status !== 'approved' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                              title={t('delete') || "O'chirish"}
                              onClick={() => setConfirmAction({ type: 'delete', id: res.id, name: res.product_name })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {res.status === 'approved' && (
                            <span className="text-xs text-green-600">{res.approved_by_name || '✓'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.ceil(filtered.length / pageSize) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-slate-500">
                  {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} / {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-medium px-2">{currentPage} / {Math.ceil(filtered.length / pageSize)}</span>
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= Math.ceil(filtered.length / pageSize)} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                  <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= Math.ceil(filtered.length / pageSize)} onClick={() => setCurrentPage(Math.ceil(filtered.length / pageSize))}>{Math.ceil(filtered.length / pageSize)}</button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'approve' && (t('confirm_approve') || 'Tasdiqlashni xohlaysizmi?')}
              {confirmAction?.type === 'reject' && (t('confirm_reject') || 'Rad etishni xohlaysizmi?')}
              {confirmAction?.type === 'delete' && (t('confirm_delete') || "O'chirishni xohlaysizmi?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'approve' && (
                t('approve_reservation_desc') || `"${confirmAction?.name}" zaxirasini tasdiqlash inventorydan chiqariladi va xarajat yaratiladi.`
              )}
              {confirmAction?.type === 'reject' && (
                t('reject_reservation_desc') || `"${confirmAction?.name}" zaxirasi rad etiladi va zaxiralangan miqdor qaytariladi.`
              )}
              {confirmAction?.type === 'delete' && (
                t('delete_reservation_desc') || `"${confirmAction?.name}" zaxirasi o'chiriladi.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirmAction}
              className={
                confirmAction?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                confirmAction?.type === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                'bg-red-600 hover:bg-red-700'
              }
            >
              {confirmAction?.type === 'approve' && (t('approve') || 'Tasdiqlash')}
              {confirmAction?.type === 'reject' && (t('reject') || 'Rad etish')}
              {confirmAction?.type === 'delete' && (t('delete') || "O'chirish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
