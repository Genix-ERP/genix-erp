import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { useCompany } from '@/components/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package, Building2, FileText, DollarSign
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

export default function CargoDistribution() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    shipments,
    distributeGoods,
    calculateShipmentCosts,
    calculateCostCoefficient,
    SHIPMENT_STATUS
  } = useCargoContext();
  const { companies } = useCompany();

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributions, setDistributions] = useState([]);

  // Get only received shipments that haven't been distributed
  const availableShipments = shipments.filter(s =>
    s.status === SHIPMENT_STATUS.RECEIVED
  );

  // Handle start distribution
  const handleStartDistribution = (shipment) => {
    setSelectedShipment(shipment);
    setDistributions([]);
    setShowDistributionModal(true);
  };

  // Add distribution entry
  const addDistribution = () => {
    setDistributions([...distributions, {
      company_id: '',
      company_name: '',
      company_type: 'B2B',
      items: []
    }]);
  };

  // Update distribution
  const updateDistribution = (index, field, value) => {
    const updated = [...distributions];
    updated[index][field] = value;

    // If company selected, get company name
    if (field === 'company_id') {
      const company = companies.find(c => c.id === parseInt(value));
      if (company) {
        updated[index].company_name = company.company_name;
      }
    }

    setDistributions(updated);
  };

  // Add item to distribution
  const addItemToDistribution = (distIndex, item, quantity) => {
    const updated = [...distributions];
    const costs = calculateShipmentCosts(selectedShipment);
    const coefficient = calculateCostCoefficient(selectedShipment);

    updated[distIndex].items.push({
      item_name: item.name,
      quantity: parseFloat(quantity),
      unit_price: item.price,
      allocated_cost: parseFloat(quantity) * item.price * coefficient
    });

    setDistributions(updated);
  };

  // Calculate total for distribution
  const calculateDistributionTotal = (dist) => {
    return dist.items.reduce((sum, item) => sum + (item.quantity * item.unit_price) + item.allocated_cost, 0);
  };

  // Handle submit distribution
  const handleSubmitDistribution = () => {
    if (!selectedShipment || distributions.length === 0) return;

    const distributionData = distributions.map(dist => ({
      ...dist,
      total_cost: calculateDistributionTotal(dist)
    }));

    distributeGoods(selectedShipment.id, distributionData);
    setShowDistributionModal(false);
    setSelectedShipment(null);
    setDistributions([]);
  };

  return (
    <div className="space-y-6">
      {/* Available Shipments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t('received_shipments') || 'Qabul qilingan yuklar'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableShipments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {t('no_received_shipments') || 'Taqsimlash uchun yuklar yo\'q'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableShipments.map((shipment) => {
                const costs = calculateShipmentCosts(shipment);
                const itemsTotal = shipment.items?.reduce((sum, item) => sum + item.total, 0) || 0;

                return (
                  <div key={shipment.id} className="p-4 border rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{shipment.tracking_number}</h4>
                          <Badge variant="outline">{shipment.supplier_country}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{shipment.supplier_company}</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Tovarlar:</span>
                            <span className="font-semibold ml-1">${itemsTotal.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Xarajatlar:</span>
                            <span className="font-semibold ml-1">${costs.total.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Jami:</span>
                            <span className="font-semibold ml-1">${(itemsTotal + costs.total).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleStartDistribution(shipment)}
                        className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                      >
                        {t('distribute') || 'Taqsimlash'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution Modal */}
      <Dialog open={showDistributionModal} onOpenChange={setShowDistributionModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('distribute_goods') || 'Tovarlarni taqsimlash'}</DialogTitle>
          </DialogHeader>

          {selectedShipment && (
            <div className="space-y-6">
              {/* Shipment Info */}
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Tracking:</span>
                      <span className="font-semibold ml-2">{selectedShipment.tracking_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Yetkazib beruvchi:</span>
                      <span className="font-semibold ml-2">{selectedShipment.supplier_company}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Distributions */}
              {distributions.map((dist, distIndex) => (
                <Card key={distIndex}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Taqsimlash #{distIndex + 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Kompaniya</Label>
                        <Select
                          value={dist.company_id}
                          onValueChange={(v) => updateDistribution(distIndex, 'company_id', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tanlang" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Turi</Label>
                        <Select
                          value={dist.company_type}
                          onValueChange={(v) => updateDistribution(distIndex, 'company_type', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="B2B">B2B</SelectItem>
                            <SelectItem value="B2C">B2C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {dist.items.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tovar</TableHead>
                            <TableHead>Miqdor</TableHead>
                            <TableHead>Narx</TableHead>
                            <TableHead>Jami</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dist.items.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.item_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>${item.unit_price}</TableCell>
                              <TableCell>${((item.quantity * item.unit_price) + item.allocated_cost).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    <div className="text-right font-semibold">
                      Jami: ${calculateDistributionTotal(dist).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={addDistribution}
                  className="flex-1"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {t('add_company') || 'Kompaniya qo\'shish'}
                </Button>
                <Button
                  onClick={handleSubmitDistribution}
                  disabled={distributions.length === 0}
                  className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {t('complete_distribution') || 'Taqsimlashni tugatish'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
