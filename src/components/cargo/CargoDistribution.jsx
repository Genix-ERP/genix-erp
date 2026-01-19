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
  Package, Building2, Plus, Trash2, ArrowRight
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { format } from 'date-fns';

export default function CargoDistribution() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    shipments,
    distributeGoods,
    calculateShipmentCosts,
    calculateCostCoefficient
  } = useCargoContext();
  const { companies } = useCompany();

  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);

  // Distribution form state
  const [recipientCompanyName, setRecipientCompanyName] = useState('');
  const [recipientCompanyType, setRecipientCompanyType] = useState('B2B');
  const [selectedItems, setSelectedItems] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Handle open distribution modal
  const handleOpenDistribution = (shipment) => {
    setSelectedShipment(shipment);
    setRecipientCompanyName('');
    setRecipientCompanyType('B2B');
    setSelectedItems([]);
    setInvoiceNumber('');
    setWaybillNumber('');
    setNotes('');
    setShowDistributionModal(true);
  };

  // Handle add item to distribution
  const handleAddItemToDistribution = (shipmentItem) => {
    const existing = selectedItems.find(i => i.shipment_item_id === shipmentItem.id);
    if (existing) return; // Already added

    setSelectedItems([...selectedItems, {
      shipment_item_id: shipmentItem.id,
      item_name: shipmentItem.item_name,
      available_quantity: shipmentItem.quantity,
      quantity: 1,
      unit_cost: shipmentItem.unit_price
    }]);
  };

  // Update item quantity
  const updateItemQuantity = (index, quantity) => {
    const updated = [...selectedItems];
    const maxQty = updated[index].available_quantity;
    updated[index].quantity = Math.min(parseFloat(quantity) || 0, maxQty);
    setSelectedItems(updated);
  };

  // Remove item from distribution
  const removeItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // Calculate totals
  const calculateTotals = () => {
    const itemsTotal = selectedItems.reduce((sum, item) =>
      sum + (item.quantity * item.unit_cost), 0
    );

    // Calculate allocated costs (proportional share of shipment costs)
    const shipmentCosts = selectedShipment ? calculateShipmentCosts(selectedShipment) : { total: 0 };
    const coefficient = selectedShipment ? calculateCostCoefficient(selectedShipment) : 0;
    const allocatedCosts = itemsTotal * coefficient;

    return {
      itemsTotal,
      allocatedCosts,
      total: itemsTotal + allocatedCosts
    };
  };

  // Handle submit distribution
  const handleSubmitDistribution = () => {
    if (!selectedShipment || !recipientCompanyName || selectedItems.length === 0) {
      alert('Barcha maydonlarni to\'ldiring va kamida bitta tovar qo\'shing');
      return;
    }

    const totals = calculateTotals();

    const distributionData = [{
      recipient_company_name: recipientCompanyName,
      recipient_company_type: recipientCompanyType,
      invoice_number: invoiceNumber,
      waybill_number: waybillNumber,
      notes: notes,
      items: selectedItems.map(item => ({
        shipment_item_id: item.shipment_item_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost
      })),
      total_items_cost: totals.itemsTotal,
      allocated_costs: totals.allocatedCosts,
      total_cost: totals.total
    }];

    distributeGoods(selectedShipment.id, distributionData);
    setShowDistributionModal(false);
    setSelectedShipment(null);
  };

  // Get all shipments that have items (not just received)
  const availableShipments = shipments.filter(s =>
    s.items && s.items.length > 0
  );

  // Get distributed shipments for history
  const distributedShipments = shipments.filter(s =>
    s.distributions && s.distributions.length > 0
  );

  const totals = selectedShipment ? calculateTotals() : { itemsTotal: 0, allocatedCosts: 0, total: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Tovarlarni taqsimlash</h2>
              <p className="text-slate-600 mt-1">
                Yukdagi tovarlarni B2B yoki B2C kompaniyalarga taqsimlang
              </p>
            </div>
            <Package className="w-12 h-12 text-purple-600 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Available Shipments for Distribution */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Yuklar ro'yxati
            </CardTitle>
            <Badge variant="secondary">
              {availableShipments.length} ta yuk mavjud
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {availableShipments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Hozircha yuklar yo'q</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableShipments.map((shipment) => (
                <Card key={shipment.id} className="border-2 hover:border-blue-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{shipment.tracking_number}</h3>
                          <Badge className={
                            shipment.status === 'received' ? 'bg-green-500' :
                            shipment.status === 'in_transit' ? 'bg-blue-500' :
                            shipment.status === 'distributed' ? 'bg-purple-500' :
                            'bg-slate-500'
                          }>
                            {shipment.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Davlat:</span>
                            <span className="font-semibold ml-1">{shipment.supplier_country}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Tovarlar:</span>
                            <span className="font-semibold ml-1">{shipment.items?.length || 0} xil</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Jami summa:</span>
                            <span className="font-semibold ml-1">
                              ${shipment.total_cost?.toLocaleString() || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleOpenDistribution(shipment)}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Taqsimlash
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution History */}
      {distributedShipments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Taqsimlash tarixi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Kompaniya</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead>Tovarlar</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead>Sana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributedShipments.flatMap(shipment =>
                  (shipment.distributions || []).map((dist, idx) => (
                    <TableRow key={`${shipment.id}-${idx}`}>
                      <TableCell className="font-medium">{shipment.tracking_number}</TableCell>
                      <TableCell>{dist.recipient_company_name}</TableCell>
                      <TableCell>
                        <Badge variant={dist.recipient_company_type === 'B2B' ? 'default' : 'secondary'}>
                          {dist.recipient_company_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{dist.items?.length || 0} xil</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${dist.total_cost?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {dist.distribution_date ? format(new Date(dist.distribution_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Distribution Modal */}
      <Dialog open={showDistributionModal} onOpenChange={setShowDistributionModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Tovarlarni taqsimlash
              {selectedShipment && (
                <span className="text-sm font-normal text-slate-500">
                  - {selectedShipment.tracking_number}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Recipient Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kompaniya nomi *</Label>
                <Input
                  placeholder="Kompaniya nomini kiriting"
                  value={recipientCompanyName}
                  onChange={(e) => setRecipientCompanyName(e.target.value)}
                />
              </div>
              <div>
                <Label>Kompaniya turi *</Label>
                <Select value={recipientCompanyType} onValueChange={setRecipientCompanyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2B">B2B (Korxona)</SelectItem>
                    <SelectItem value="B2C">B2C (Chakana)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Invoice & Waybill */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  Invoice raqami
                  <span className="text-xs text-slate-400">(ixtiyoriy)</span>
                </Label>
                <Input
                  placeholder="INV-2024-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  TTN raqami
                  <span className="text-xs text-slate-400">(ixtiyoriy)</span>
                </Label>
                <Input
                  placeholder="TTN-2024-001"
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Available Items */}
            <div>
              <Label className="text-lg font-semibold mb-3 block">Mavjud tovarlar</Label>
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {selectedShipment?.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex-1">
                          <div className="font-semibold">{item.item_name}</div>
                          <div className="text-sm text-slate-600">
                            Miqdor: {item.quantity} | Narx: ${item.unit_price}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddItemToDistribution(item)}
                          disabled={selectedItems.some(si => si.shipment_item_id === item.id)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Qo'shish
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Selected Items */}
            {selectedItems.length > 0 && (
              <div>
                <Label className="text-lg font-semibold mb-3 block">Taqsimlanayotgan tovarlar</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tovar</TableHead>
                      <TableHead>Miqdor</TableHead>
                      <TableHead>Narx</TableHead>
                      <TableHead>Jami</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            max={item.available_quantity}
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(idx, e.target.value)}
                            className="w-24"
                          />
                          <span className="text-xs text-slate-500 ml-2">
                            / {item.available_quantity}
                          </span>
                        </TableCell>
                        <TableCell>${item.unit_cost}</TableCell>
                        <TableCell className="font-semibold">
                          ${(item.quantity * item.unit_cost).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Cost Summary */}
            {selectedItems.length > 0 && (
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tovarlar qiymati:</span>
                      <span className="font-semibold">${totals.itemsTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Taqsimlangan xarajatlar:</span>
                      <span className="font-semibold">${totals.allocatedCosts.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Jami:</span>
                      <span>${totals.total.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <div>
              <Label className="flex items-center gap-2">
                Izoh
                <span className="text-xs text-slate-400">(ixtiyoriy)</span>
              </Label>
              <Input
                placeholder="Qo'shimcha ma'lumot kiriting..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDistributionModal(false)}
                className="flex-1"
              >
                Bekor qilish
              </Button>
              <Button
                onClick={handleSubmitDistribution}
                disabled={!recipientCompanyName || selectedItems.length === 0}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
              >
                Taqsimlashni tasdiqlash
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
