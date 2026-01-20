import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock, Search, MapPin, Package, Plane, Ship, Truck, CheckCircle, AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { format } from 'date-fns';

export default function CargoTracking() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    shipments,
    updateShipmentStatus,
    SHIPMENT_STATUS
  } = useCargoContext();

  // Helper function to extract string from sql.NullString objects
  const extractString = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.String !== undefined) return value.String || '';
    return String(value);
  };

  // Helper function to safely format dates
  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    try {
      // Extract string from object if needed
      const dateStr = typeof dateValue === 'string' ? dateValue : (dateValue?.String || '');
      if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return '-';

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';

      return format(date, 'dd MMM yyyy, HH:mm');
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [newStatus, setNewStatus] = useState('');

  // Status configuration
  const statusConfig = {
    [SHIPMENT_STATUS.ORDERED]: {
      label: 'Buyurtma berildi',
      color: 'bg-blue-500',
      icon: Package,
      textColor: 'text-blue-700'
    },
    [SHIPMENT_STATUS.IN_TRANSIT]: {
      label: "Yo'lda",
      color: 'bg-orange-500',
      icon: Plane,
      textColor: 'text-orange-700'
    },
    [SHIPMENT_STATUS.IN_CUSTOMS]: {
      label: 'Bojxonada',
      color: 'bg-yellow-500',
      icon: AlertCircle,
      textColor: 'text-yellow-700'
    },
    [SHIPMENT_STATUS.RECEIVED]: {
      label: 'Qabul qilindi',
      color: 'bg-green-500',
      icon: CheckCircle,
      textColor: 'text-green-700'
    },
    [SHIPMENT_STATUS.DISTRIBUTED]: {
      label: 'Taqsimlandi',
      color: 'bg-purple-500',
      icon: Truck,
      textColor: 'text-purple-700'
    }
  };

  // Filter shipments
  const filteredShipments = shipments.filter(s => {
    const trackingNumber = extractString(s.tracking_number).toLowerCase();
    const supplierCompany = extractString(s.supplier_company).toLowerCase();
    const query = searchQuery.toLowerCase();
    return trackingNumber.includes(query) || supplierCompany.includes(query);
  });

  // Get status steps for timeline
  const getStatusSteps = () => {
    return [
      SHIPMENT_STATUS.ORDERED,
      SHIPMENT_STATUS.IN_TRANSIT,
      SHIPMENT_STATUS.IN_CUSTOMS,
      SHIPMENT_STATUS.RECEIVED,
      SHIPMENT_STATUS.DISTRIBUTED
    ];
  };

  // Check if status is completed
  const isStatusCompleted = (shipment, status) => {
    const steps = getStatusSteps();
    const currentIndex = steps.indexOf(shipment.status);
    const checkIndex = steps.indexOf(status);
    return checkIndex <= currentIndex;
  };

  // Handle status update
  const handleUpdateStatus = () => {
    if (selectedShipment && newStatus) {
      updateShipmentStatus(selectedShipment.id, newStatus, statusNote);
      setShowStatusModal(false);
      setStatusNote('');
      setNewStatus('');
      setSelectedShipment(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder={t('search_tracking') || 'Tracking raqam yoki kompaniya izlash...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shipments List */}
      <div className="grid gap-6">
        {filteredShipments.map((shipment) => {
          const config = statusConfig[shipment.status];
          const StatusIcon = config.icon;

          return (
            <Card key={shipment.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{extractString(shipment.tracking_number)}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      {extractString(shipment.supplier_company)} • {extractString(shipment.supplier_country)}
                    </p>
                  </div>
                  <Badge className={`${config.color} text-white`}>
                    {config.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Status Timeline */}
                <div className="relative px-2">
                  <div className="flex justify-between items-start relative">
                    {/* Connecting line - gray background */}
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200"></div>

                    {/* Connecting line - colored progress */}
                    {(() => {
                      const steps = getStatusSteps();
                      const currentIndex = steps.indexOf(shipment.status);
                      const progressPercent = currentIndex >= 0 ? (currentIndex / (steps.length - 1)) * 100 : 0;
                      return (
                        <div
                          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-orange-500 to-yellow-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      );
                    })()}

                    {getStatusSteps().map((status, index) => {
                      const stepConfig = statusConfig[status];
                      const StepIcon = stepConfig.icon;
                      const isCompleted = isStatusCompleted(shipment, status);
                      const isCurrent = shipment.status === status;

                      return (
                        <div key={status} className="flex flex-col items-center flex-1 relative z-10">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCompleted ? stepConfig.color : 'bg-slate-200'
                          } ${isCurrent ? 'ring-4 ring-offset-2' : ''}`}
                          style={isCurrent ? { boxShadow: `0 0 0 4px ${stepConfig.color}20` } : {}}>
                            <StepIcon className={`w-5 h-5 ${isCompleted ? 'text-white' : 'text-slate-400'}`} />
                          </div>
                          <p className={`text-xs mt-2 text-center ${
                            isCompleted ? stepConfig.textColor : 'text-slate-400'
                          }`}>
                            {stepConfig.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status History */}
                {shipment.status_history && shipment.status_history.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {t('status_history') || 'Holat tarixi'}
                    </h4>
                    <div className="space-y-2">
                      {[...shipment.status_history].reverse().slice(0, 3).map((history, idx) => {
                        const historyConfig = statusConfig[history.status];
                        return (
                          <div key={idx} className="flex items-start gap-3 text-sm">
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${historyConfig.color}`}></div>
                            <div className="flex-1">
                              <p className="font-medium">{historyConfig.label}</p>
                              {history.note && (
                                <p className="text-slate-500 text-xs">{extractString(history.note)}</p>
                              )}
                              <p className="text-slate-400 text-xs">
                                {formatDate(history.date)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {shipment.status !== SHIPMENT_STATUS.DISTRIBUTED && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedShipment(shipment);
                        const steps = getStatusSteps();
                        const currentIndex = steps.indexOf(shipment.status);
                        if (currentIndex < steps.length - 1) {
                          setNewStatus(steps[currentIndex + 1]);
                        }
                        setShowStatusModal(true);
                      }}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                    >
                      {t('update_status') || 'Holatni yangilash'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filteredShipments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_shipments') || 'Yuklar topilmadi'}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Update Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('update_status') || 'Holatni yangilash'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {newStatus && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">{t('new_status') || 'Yangi holat'}:</p>
                <Badge className={`${statusConfig[newStatus]?.color} text-white`}>
                  {statusConfig[newStatus]?.label}
                </Badge>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('note') || 'Izoh'} ({t('optional') || 'ixtiyoriy'})
              </label>
              <Textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder={t('enter_note') || 'Izoh kiriting...'}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusNote('');
                  setNewStatus('');
                }}
                className="flex-1"
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleUpdateStatus}
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {t('update') || 'Yangilash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
