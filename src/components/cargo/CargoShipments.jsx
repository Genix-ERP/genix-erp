import React, { useState } from 'react';
import { useCargoContext } from '@/components/contexts/CargoContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Search, Eye, Pencil, Trash2, Ship, Plane, Truck, Train, Globe
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { format } from 'date-fns';

export default function CargoShipments() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const {
    shipments,
    createShipment,
    updateShipment,
    deleteShipment,
    SHIPMENT_STATUS,
    TRANSPORT_TYPES,
    calculateShipmentCosts
  } = useCargoContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);

  // Form state for new shipment
  const [formData, setFormData] = useState({
    supplier_country: '',
    supplier_company: '',
    tracking_number: '',
    expected_date: '',
    transport_type: '',
    items: [],
    costs: {
      transport: 0,
      customs: 0,
      insurance: 0,
      other: 0
    }
  });

  const [currentItem, setCurrentItem] = useState({
    name: '',
    quantity: 0,
    price: 0,
    currency: 'USD'
  });

  // Countries list
  const countries = [
    { value: 'dubai', label: 'Dubai (UAE)' },
    { value: 'korea', label: 'Korea' },
    { value: 'china', label: 'China' },
    { value: 'turkey', label: 'Turkey' },
    { value: 'other', label: 'Other' }
  ];

  // Transport type icons
  const getTransportIcon = (type) => {
    switch (type) {
      case TRANSPORT_TYPES.AIR: return <Plane className="w-4 h-4" />;
      case TRANSPORT_TYPES.AUTO: return <Truck className="w-4 h-4" />;
      case TRANSPORT_TYPES.RAIL: return <Train className="w-4 h-4" />;
      case TRANSPORT_TYPES.SEA: return <Ship className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  // Status badge color
  const getStatusBadge = (status) => {
    const statusConfig = {
      [SHIPMENT_STATUS.ORDERED]: { label: 'Buyurtma berildi', color: 'bg-blue-100 text-blue-700' },
      [SHIPMENT_STATUS.IN_TRANSIT]: { label: "Yo'lda", color: 'bg-orange-100 text-orange-700' },
      [SHIPMENT_STATUS.IN_CUSTOMS]: { label: 'Bojxonada', color: 'bg-yellow-100 text-yellow-700' },
      [SHIPMENT_STATUS.RECEIVED]: { label: 'Qabul qilindi', color: 'bg-green-100 text-green-700' },
      [SHIPMENT_STATUS.DISTRIBUTED]: { label: 'Taqsimlandi', color: 'bg-purple-100 text-purple-700' }
    };

    const config = statusConfig[status] || statusConfig[SHIPMENT_STATUS.ORDERED];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  // Add item to shipment
  const handleAddItem = () => {
    if (!currentItem.name || currentItem.quantity <= 0 || currentItem.price <= 0) {
      alert('Please fill all item fields');
      return;
    }

    const newItem = {
      ...currentItem,
      total: currentItem.quantity * currentItem.price
    };

    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    });

    setCurrentItem({ name: '', quantity: 0, price: 0, currency: 'USD' });
  };

  // Remove item
  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  // Calculate total
  const calculateTotal = () => {
    const itemsTotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const costsTotal = Object.values(formData.costs).reduce((sum, cost) => sum + Number(cost), 0);
    return { itemsTotal, costsTotal, total: itemsTotal + costsTotal };
  };

  // Submit new shipment
  const handleSubmit = () => {
    if (!formData.supplier_country || !formData.tracking_number || formData.items.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    createShipment(formData);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      supplier_country: '',
      supplier_company: '',
      tracking_number: '',
      expected_date: '',
      transport_type: '',
      items: [],
      costs: { transport: 0, customs: 0, insurance: 0, other: 0 }
    });
  };

  // Filter shipments
  const filteredShipments = shipments.filter(s =>
    s.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.supplier_company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t('search_tracking') || 'Tracking raqam yoki kompaniya izlash...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('new_shipment') || 'Yangi yuk'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('shipments_list') || 'Yuklar ro\'yxati'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tracking') || 'Tracking'}</TableHead>
                <TableHead>{t('supplier') || 'Yetkazib beruvchi'}</TableHead>
                <TableHead>{t('transport') || 'Transport'}</TableHead>
                <TableHead>{t('expected_date') || 'Kutilayotgan sana'}</TableHead>
                <TableHead>{t('status') || 'Holat'}</TableHead>
                <TableHead>{t('total_cost') || 'Jami summa'}</TableHead>
                <TableHead className="text-right">{t('actions') || 'Amallar'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShipments.map((shipment) => {
                const costs = calculateShipmentCosts(shipment);
                const itemsTotal = shipment.items?.reduce((sum, item) => sum + item.total, 0) || 0;
                const total = itemsTotal + costs.total;

                return (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-medium">{shipment.tracking_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{shipment.supplier_company}</p>
                        <p className="text-xs text-slate-500">{shipment.supplier_country}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransportIcon(shipment.transport_type)}
                        <span className="text-sm">{shipment.transport_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {shipment.expected_date ? format(new Date(shipment.expected_date), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                    <TableCell className="font-semibold">${total.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedShipment(shipment);
                            setShowViewModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredShipments.length === 0 && (
            <div className="text-center py-12">
              <Ship className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t('no_shipments') || 'Yuklar topilmadi'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Shipment Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('new_shipment') || 'Yangi yuk buyurtmasi'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('supplier_country') || 'Yetkazib beruvchi davlat'} *</Label>
                <Select value={formData.supplier_country} onValueChange={(v) => setFormData({...formData, supplier_country: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Davlatni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('supplier_company') || 'Kompaniya nomi'}</Label>
                <Input
                  value={formData.supplier_company}
                  onChange={(e) => setFormData({...formData, supplier_company: e.target.value})}
                />
              </div>

              <div>
                <Label>{t('tracking_number') || 'Tracking raqami'} *</Label>
                <Input
                  value={formData.tracking_number}
                  onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                  placeholder="ABC123456789"
                />
              </div>

              <div>
                <Label>{t('expected_date') || 'Kutilayotgan sana'}</Label>
                <Input
                  type="date"
                  value={formData.expected_date}
                  onChange={(e) => setFormData({...formData, expected_date: e.target.value})}
                />
              </div>

              <div>
                <Label>{t('transport_type') || 'Transport turi'}</Label>
                <Select value={formData.transport_type} onValueChange={(v) => setFormData({...formData, transport_type: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Transport turini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TRANSPORT_TYPES.AIR}>Avia</SelectItem>
                    <SelectItem value={TRANSPORT_TYPES.AUTO}>Avtomobil</SelectItem>
                    <SelectItem value={TRANSPORT_TYPES.RAIL}>Temir yo'l</SelectItem>
                    <SelectItem value={TRANSPORT_TYPES.SEA}>Dengiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items Section */}
            <div>
              <Label className="text-lg font-semibold">{t('goods_list') || 'Tovarlar ro\'yxati'}</Label>

              {/* Add Item Form */}
              <Card className="mt-2 bg-slate-50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    <Input
                      placeholder="Tovar nomi"
                      value={currentItem.name}
                      onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})}
                    />
                    <Input
                      type="number"
                      placeholder="Miqdor"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({...currentItem, quantity: Number(e.target.value)})}
                    />
                    <Input
                      type="number"
                      placeholder="Narx"
                      value={currentItem.price}
                      onChange={(e) => setCurrentItem({...currentItem, price: Number(e.target.value)})}
                    />
                    <Select value={currentItem.currency} onValueChange={(v) => setCurrentItem({...currentItem, currency: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="UZS">UZS</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddItem} size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Qo'shish
                    </Button>
                  </div>

                  {/* Items Table */}
                  {formData.items.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nomi</TableHead>
                          <TableHead>Miqdor</TableHead>
                          <TableHead>Narx</TableHead>
                          <TableHead>Jami</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.currency} {item.price}</TableCell>
                            <TableCell className="font-semibold">{item.currency} {item.total.toLocaleString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Costs Section */}
            <div>
              <Label className="text-lg font-semibold">{t('costs') || 'Xarajatlar'}</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label>{t('transport_cost') || 'Transport xarajati'}</Label>
                  <Input
                    type="number"
                    value={formData.costs.transport}
                    onChange={(e) => setFormData({
                      ...formData,
                      costs: {...formData.costs, transport: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label>{t('customs_cost') || 'Bojxona to\'lovi'}</Label>
                  <Input
                    type="number"
                    value={formData.costs.customs}
                    onChange={(e) => setFormData({
                      ...formData,
                      costs: {...formData.costs, customs: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label>{t('insurance_cost') || 'Sug\'urta'}</Label>
                  <Input
                    type="number"
                    value={formData.costs.insurance}
                    onChange={(e) => setFormData({
                      ...formData,
                      costs: {...formData.costs, insurance: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label>{t('other_cost') || 'Boshqa xarajatlar'}</Label>
                  <Input
                    type="number"
                    value={formData.costs.other}
                    onChange={(e) => setFormData({
                      ...formData,
                      costs: {...formData.costs, other: Number(e.target.value)}
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Total Summary */}
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50">
              <CardContent className="p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Tovarlar summasi:</span>
                  <span className="font-semibold">${calculateTotal().itemsTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Xarajatlar summasi:</span>
                  <span className="font-semibold">${calculateTotal().costsTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Jami:</span>
                  <span>${calculateTotal().total.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
              >
                {t('create') || 'Yaratish'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
