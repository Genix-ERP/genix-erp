import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Building2, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { inventoryService } from '@/api/services/inventory';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

const EMPTY_CARRIER = {
  code: '',
  name: '',
  tracking_url: '',
  phone: '+998',
  email: '',
  website: '',
  notes: '',
  is_active: true,
};

/**
 * Carriers CRUD — extracted from SalesOrders.jsx (was an inline top-level
 * tab). Self-contained: list, create/edit modal, toggle active, delete
 * with AlertDialog. Lives under Savdo → Sozlamalar → Tashuvchilar.
 */
export default function Carriers() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [newCarrier, setNewCarrier] = useState(EMPTY_CARRIER);
  const [carrierToDelete, setCarrierToDelete] = useState(null);

  const fetchCarriers = async () => {
    setLoading(true);
    try {
      // Management surface — list all carriers, inactive ones included.
      const data = await inventoryService.listCarriers();
      setCarriers(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      console.error('Failed to fetch carriers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCarriers(); }, []);

  const resetForm = () => setNewCarrier(EMPTY_CARRIER);

  const handleCreate = async () => {
    try {
      const created = await inventoryService.createCarrier(newCarrier);
      setCarriers(prev => [...prev, created]);
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create carrier:', error);
      toast.error(t('error_creating_carrier') || 'Failed to create carrier');
    }
  };

  const handleUpdate = async () => {
    if (!editingCarrier) return;
    try {
      const updated = await inventoryService.updateCarrier(editingCarrier.id, editingCarrier);
      setCarriers(prev => prev.map(c => (c.id === editingCarrier.id ? updated : c)));
      setShowModal(false);
      setEditingCarrier(null);
    } catch (error) {
      console.error('Failed to update carrier:', error);
      toast.error(t('error_updating_carrier') || 'Failed to update carrier');
    }
  };

  const handleToggleStatus = async (carrier) => {
    try {
      const updated = await inventoryService.updateCarrier(carrier.id, { is_active: !carrier.is_active });
      setCarriers(prev => prev.map(c => (c.id === carrier.id ? updated : c)));
    } catch (error) {
      console.error('Failed to toggle carrier status:', error);
    
      toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!carrierToDelete) return;
    try {
      await inventoryService.deleteCarrier(carrierToDelete.id);
      setCarriers(prev => prev.filter(c => c.id !== carrierToDelete.id));
    } catch (error) {
      console.error('Failed to delete carrier:', error);
      toast.error(t('error_deleting_carrier') || 'Failed to delete carrier');
    }
    setCarrierToDelete(null);
  };

  const formValue = (field) => (editingCarrier ? (editingCarrier[field] ?? '') : newCarrier[field]);
  const setFormValue = (field, value) => (editingCarrier
    ? setEditingCarrier({ ...editingCarrier, [field]: value })
    : setNewCarrier({ ...newCarrier, [field]: value }));

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">{t('carriers') || 'Tashuvchilar'}</CardTitle>
            <Button onClick={() => setShowModal(true)} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
              <Plus className="w-4 h-4 mr-2" /> {t('new_carrier') || 'New Carrier'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : carriers.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_carriers_found') || 'No carriers found'}</p>
              <Button onClick={() => setShowModal(true)} className="mt-4">{t('create_first_carrier') || 'Create First Carrier'}</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('code') || 'Code'}</TableHead>
                    <TableHead>{t('name') || 'Name'}</TableHead>
                    <TableHead>{t('phone') || 'Phone'}</TableHead>
                    <TableHead>{t('website') || 'Website'}</TableHead>
                    <TableHead>{t('status') || 'Status'}</TableHead>
                    <TableHead>{t('actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carriers.map((carrier) => (
                    <TableRow key={carrier.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">{carrier.code}</TableCell>
                      <TableCell className="font-medium">{carrier.name}</TableCell>
                      <TableCell className="text-sm">{carrier.phone || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {carrier.website ? (
                          <a href={carrier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {carrier.website}
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={carrier.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                          {carrier.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCarrier({ ...carrier }); setShowModal(true); }} title={t('edit') || 'Edit'}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(carrier)} title={carrier.is_active ? (t('deactivate') || 'Deactivate') : (t('activate') || 'Activate')}>
                            {carrier.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setCarrierToDelete(carrier)} title={t('delete') || 'Delete'}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) { setEditingCarrier(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCarrier ? (t('edit_carrier') || 'Edit Carrier') : (t('create_carrier') || 'Create Carrier')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('code') || 'Code'} *</Label>
                <Input
                  placeholder="e.g. DHL"
                  value={formValue('code')}
                  onChange={(e) => setFormValue('code', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('name') || 'Name'} *</Label>
                <Input
                  placeholder="e.g. DHL Express"
                  value={formValue('name')}
                  onChange={(e) => setFormValue('name', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('phone') || 'Phone'}</Label>
                <Input
                  placeholder="+998 90 123 45 67"
                  value={formValue('phone')}
                  onChange={(e) => setFormValue('phone', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('email') || 'Email'}</Label>
                <Input
                  type="email"
                  placeholder="support@carrier.com"
                  value={formValue('email')}
                  onChange={(e) => setFormValue('email', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>{t('website') || 'Website'}</Label>
              <Input
                placeholder="https://www.carrier.com"
                value={formValue('website')}
                onChange={(e) => setFormValue('website', e.target.value)}
              />
            </div>

            <div>
              <Label>{t('tracking_url') || 'Tracking URL'}</Label>
              <Input
                placeholder="https://track.carrier.com/?id={tracking_number}"
                value={formValue('tracking_url')}
                onChange={(e) => setFormValue('tracking_url', e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">{t('tracking_url_hint') || 'Use {tracking_number} as placeholder'}</p>
            </div>

            <div>
              <Label>{t('notes') || 'Notes'}</Label>
              <Input
                placeholder={t('notes_placeholder') || 'Additional notes...'}
                value={formValue('notes')}
                onChange={(e) => setFormValue('notes', e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowModal(false); setEditingCarrier(null); resetForm(); }} className="flex-1">
                {t('cancel')}
              </Button>
              <Button
                onClick={editingCarrier ? handleUpdate : handleCreate}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                disabled={editingCarrier ? (!editingCarrier.code || !editingCarrier.name) : (!newCarrier.code || !newCarrier.name)}
              >
                {editingCarrier ? (t('save_changes') || 'Save Changes') : (t('create') || 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — AlertDialog instead of native confirm() */}
      <AlertDialog open={!!carrierToDelete} onOpenChange={(open) => { if (!open) setCarrierToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete') || 'Delete?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_delete_carrier') || 'Are you sure you want to delete this carrier?'}
              {carrierToDelete && <strong className="ml-1">{carrierToDelete.name}</strong>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
