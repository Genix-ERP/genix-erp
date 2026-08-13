import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Lock, Unlock, Calendar, CalendarRange, AlertTriangle, Loader2
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { financeService } from "@/api/services/finance";
import { format } from "date-fns";
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

export default function AccountingPeriods() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [periods, setPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-create modal
  const [showAutoCreateModal, setShowAutoCreateModal] = useState(false);
  const [autoCreateYear, setAutoCreateYear] = useState(new Date().getFullYear());

  // Create single period modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });

  // Lock/unlock confirmation
  const [confirmAction, setConfirmAction] = useState(null); // { period, action: 'lock' | 'unlock' }

  const loadPeriods = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await financeService.listAccountingPeriods();
      setPeriods(data || []);
    } catch (error) {
      console.error('Failed to load accounting periods:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const handleAutoCreate = async () => {
    setIsSaving(true);
    try {
      await financeService.autoCreatePeriods(autoCreateYear);
      await loadPeriods();
      setShowAutoCreateModal(false);
    } catch (error) {
      console.error('Failed to auto-create periods:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePeriod = async () => {
    setIsSaving(true);
    try {
      await financeService.createAccountingPeriod(createFormData);
      await loadPeriods();
      setShowCreateModal(false);
      setCreateFormData({ name: '', start_date: '', end_date: '' });
    } catch (error) {
      console.error('Failed to create period:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLockUnlock = async () => {
    if (!confirmAction) return;
    setIsSaving(true);
    try {
      if (confirmAction.action === 'lock') {
        await financeService.lockAccountingPeriod(confirmAction.period.id);
      } else {
        await financeService.unlockAccountingPeriod(confirmAction.period.id);
      }
      await loadPeriods();
      setConfirmAction(null);
    } catch (error) {
      console.error('Failed to lock/unlock period:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy');
    } catch {
      return dateStr;
    }
  };

  const lockedCount = periods.filter(p => p.is_locked).length;
  const openCount = periods.filter(p => !p.is_locked).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <CalendarRange className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Jami davrlar</p>
                <p className="text-2xl font-bold">{periods.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Unlock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Ochiq davrlar</p>
                <p className="text-2xl font-bold">{openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Yopilgan davrlar</p>
                <p className="text-2xl font-bold">{lockedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Hisob davrlari
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAutoCreateModal(true)}
            >
              <CalendarRange className="h-4 w-4 mr-2" />
              Avtomatik yaratish
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Yangi davr
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarRange className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Hisob davrlari topilmadi</p>
              <p className="text-sm mt-1">Avtomatik yaratish tugmasini bosib 12 oylik davrlarni yarating</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomi</TableHead>
                  <TableHead>Boshlanish sanasi</TableHead>
                  <TableHead>Tugash sanasi</TableHead>
                  <TableHead>Holati</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.name}</TableCell>
                    <TableCell>{formatDate(period.start_date)}</TableCell>
                    <TableCell>{formatDate(period.end_date)}</TableCell>
                    <TableCell>
                      {period.is_locked ? (
                        <Badge variant="destructive" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Yopilgan
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                          <Unlock className="h-3 w-3" />
                          Ochiq
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {period.is_locked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmAction({ period, action: 'unlock' })}
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Ochish
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmAction({ period, action: 'lock' })}
                        >
                          <Lock className="h-4 w-4 mr-1" />
                          Yopish
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Auto-create Modal */}
      <Dialog open={showAutoCreateModal} onOpenChange={setShowAutoCreateModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Avtomatik davrlar yaratish</DialogTitle>
            <DialogDescription>
              Tanlangan yil uchun 12 oylik hisob davrlari avtomatik yaratiladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Yil</label>
              <Input
                type="number"
                value={autoCreateYear}
                onChange={(e) => setAutoCreateYear(parseInt(e.target.value) || new Date().getFullYear())}
                min={2000}
                max={2100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoCreateModal(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleAutoCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Single Period Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yangi hisob davri</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nomi</label>
              <Input
                value={createFormData.name}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Yanvar 2026"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Boshlanish sanasi</label>
              <Input
                type="date"
                value={createFormData.start_date}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tugash sanasi</label>
              <Input
                type="date"
                value={createFormData.end_date}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={handleCreatePeriod}
              disabled={isSaving || !createFormData.name || !createFormData.start_date || !createFormData.end_date}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock/Unlock Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {confirmAction?.action === 'lock' ? 'Davrni yopish' : 'Davrni ochish'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === 'lock'
                ? `"${confirmAction?.period?.name}" davrini yopmoqchimisiz? Yopilgan davrda hech qanday jurnal yozuvi kiritib bo'lmaydi.`
                : `"${confirmAction?.period?.name}" davrini qayta ochmoqchimisiz?`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Bekor qilish
            </Button>
            <Button
              variant={confirmAction?.action === 'lock' ? 'destructive' : 'default'}
              onClick={handleLockUnlock}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction?.action === 'lock' ? 'Yopish' : 'Ochish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
