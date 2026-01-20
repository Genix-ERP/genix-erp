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
  Plus, Search, Eye, Trash2, Upload, Download, Ship, Pencil
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
    calculateShipmentCosts
  } = useCargoContext();

  // Helper function to extract string from sql.NullString objects
  const extractString = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.String !== undefined) return value.String || '';
    return String(value);
  };

  // Helper function to safely format dates
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return format(date, 'dd MMM yyyy');
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state for new shipment
  const [formData, setFormData] = useState({
    supplier_company: '',
    tracking_number: '',
    expected_date: '',
    items: [],
    costs: {
      transport: 0,
      customs: 0,
      other: 0
    }
  });

  const [currentItem, setCurrentItem] = useState({
    name: '',
    quantity: 0,
    price: 0,
    currency: 'USD',
    customFields: [] // Array of {key: '', value: ''} objects
  });

  const [showExcelImport, setShowExcelImport] = useState(false);

  // Countries list
  const countries = [
    { value: 'dubai', label: 'Dubai (UAE)' },
    { value: 'korea', label: 'Korea' },
    { value: 'china', label: 'China' },
    { value: 'turkey', label: 'Turkey' },
    { value: 'other', label: 'Other' }
  ];


  // Status badge color
  const getStatusBadge = (status) => {
    // Convert status to string if it's an object
    const statusStr = typeof status === 'string' ? status : (status?.String || status?.toString?.() || 'ordered');

    const statusConfig = {
      [SHIPMENT_STATUS.ORDERED]: { label: 'Buyurtma berildi', color: 'bg-blue-100 text-blue-700' },
      [SHIPMENT_STATUS.IN_TRANSIT]: { label: "Yo'lda", color: 'bg-orange-100 text-orange-700' },
      [SHIPMENT_STATUS.IN_CUSTOMS]: { label: 'Bojxonada', color: 'bg-yellow-100 text-yellow-700' },
      [SHIPMENT_STATUS.RECEIVED]: { label: 'Qabul qilindi', color: 'bg-green-100 text-green-700' },
      [SHIPMENT_STATUS.DISTRIBUTED]: { label: 'Taqsimlandi', color: 'bg-purple-100 text-purple-700' }
    };

    const config = statusConfig[statusStr] || statusConfig[SHIPMENT_STATUS.ORDERED];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  // Add item to shipment
  const handleAddItem = () => {
    if (!currentItem.name || currentItem.quantity <= 0) {
      alert('Iltimos tovar nomi va miqdorini kiriting');
      return;
    }

    const newItem = {
      ...currentItem,
      total: currentItem.quantity * (currentItem.price || 0)
    };

    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    });

    setCurrentItem({ name: '', quantity: 0, price: 0, currency: 'USD', customFields: [] });
  };

  // Add custom field to current item
  const addCustomField = () => {
    setCurrentItem({
      ...currentItem,
      customFields: [...currentItem.customFields, { key: '', value: '' }]
    });
  };

  // Remove custom field
  const removeCustomField = (index) => {
    setCurrentItem({
      ...currentItem,
      customFields: currentItem.customFields.filter((_, i) => i !== index)
    });
  };

  // Update custom field
  const updateCustomField = (index, field, value) => {
    const updated = [...currentItem.customFields];
    updated[index][field] = value;
    setCurrentItem({ ...currentItem, customFields: updated });
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
    const itemsTotal = formData.items.reduce((sum, item) => {
      const itemTotal = typeof item.total === 'number' ? item.total : (Number(item.quantity || 0) * Number(item.price || 0));
      return sum + itemTotal;
    }, 0);
    const costsTotal = Object.values(formData.costs).reduce((sum, cost) => sum + Number(cost), 0);
    return { itemsTotal, costsTotal, total: itemsTotal + costsTotal };
  };

  // Submit new shipment
  const handleSubmit = () => {
    if (formData.items.length === 0) {
      alert('Iltimos kamida bitta tovar qo\'shing');
      return;
    }

    // Transform data to match backend expected format
    const backendData = {
      tracking_number: formData.tracking_number || '',
      supplier_country: '',
      supplier_company: formData.supplier_company || '',
      expected_date: formData.expected_date ? new Date(formData.expected_date).toISOString() : null,
      transport_cost: Number(formData.costs?.transport || 0),
      customs_cost: Number(formData.costs?.customs || 0),
      insurance_cost: 0,
      other_cost: Number(formData.costs?.other || 0),
      notes: '',
      items: formData.items.map(item => ({
        item_name: item.name,
        quantity: Number(item.quantity),
        unit_price: Number(item.price),
        currency: item.currency || 'USD',
        hs_code: '',
        description: ''
      }))
    };

    if (isEditMode && selectedShipment) {
      updateShipment(selectedShipment.id, backendData);
    } else {
      createShipment(backendData);
    }
    setShowAddModal(false);
    setIsEditMode(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      supplier_company: '',
      tracking_number: '',
      expected_date: '',
      items: [],
      costs: { transport: 0, customs: 0, other: 0 }
    });
  };

  // Open edit modal with shipment data
  const handleEditShipment = (shipment) => {
    setSelectedShipment(shipment);
    setIsEditMode(true);

    // Safely extract expected_date from object or string
    let expectedDateStr = '';
    if (shipment.expected_date) {
      const dateValue = typeof shipment.expected_date === 'string'
        ? shipment.expected_date
        : (shipment.expected_date?.String || '');
      if (dateValue && dateValue !== '0001-01-01T00:00:00Z') {
        expectedDateStr = dateValue.split('T')[0];
      }
    }

    setFormData({
      supplier_company: shipment.supplier_company || '',
      tracking_number: shipment.tracking_number || '',
      expected_date: expectedDateStr,
      items: shipment.items?.map(item => ({
        name: item.item_name,
        quantity: item.quantity,
        price: item.unit_price,
        currency: item.currency,
        customFields: item.customFields || [],
        total: item.total_price
      })) || [],
      costs: {
        transport: shipment.transport_cost || 0,
        customs: shipment.customs_cost || 0,
        other: shipment.other_cost || 0
      }
    });
    setShowAddModal(true);
  };

  // Download Excel template
  const downloadExcelTemplate = () => {
    const template = [
      {
        'Tracking Raqami': 'ABC123456789',
        'Kompaniya': 'Samsung Electronics',
        'Kutilayotgan Sana': '2024-02-15',
        'Tovar Nomi': 'iPhone 15 Pro Max',
        'Miqdor': 10,
        'Birlik Narxi': 1200,
        'Valyuta': 'USD',
        'IMEI/Serial': '352099001761481',
        'Transport Xarajati': 5000,
        'Bojxona': 1200,
        'Boshqa Xarajat': 500
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Yuklar');
    XLSX.writeFile(wb, 'cargo_template.xlsx');
  };

  // Import from Excel
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        // Group rows by tracking number
        const shipmentsMap = {};
        data.forEach(row => {
          const trackingNumber = row['Tracking Raqami'];
          if (!trackingNumber) return;

          if (!shipmentsMap[trackingNumber]) {
            shipmentsMap[trackingNumber] = {
              tracking_number: trackingNumber,
              supplier_company: row['Kompaniya'] || '',
              expected_date: row['Kutilayotgan Sana'] || '',
              items: [],
              costs: {
                transport: Number(row['Transport Xarajati']) || 0,
                customs: Number(row['Bojxona']) || 0,
                other: Number(row['Boshqa Xarajat']) || 0
              }
            };
          }

          // Add item
          shipmentsMap[trackingNumber].items.push({
            name: row['Tovar Nomi'],
            quantity: Number(row['Miqdor']),
            price: Number(row['Birlik Narxi']),
            currency: row['Valyuta'] || 'USD',
            imei: row['IMEI/Serial'] || '',
            total: Number(row['Miqdor']) * Number(row['Birlik Narxi'])
          });
        });

        // Create shipments
        Object.values(shipmentsMap).forEach(shipment => {
          createShipment(shipment);
        });

        alert(`${Object.keys(shipmentsMap).length} ta yuk muvaffaqiyatli yuklandi!`);
        e.target.value = ''; // Reset file input
      } catch (error) {
        console.error('Excel import error:', error);
        alert('Excel faylini yuklashda xatolik yuz berdi');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Filter shipments
  const filteredShipments = shipments.filter(s => {
    const trackingNumber = extractString(s.tracking_number).toLowerCase();
    const supplierCompany = extractString(s.supplier_company).toLowerCase();
    const query = searchQuery.toLowerCase();
    return trackingNumber.includes(query) || supplierCompany.includes(query);
  });

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

            {/* Excel Import Button */}
            <input
              type="file"
              id="excel-import"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('excel-import').click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Excel yuklash
            </Button>

            {/* Download Template */}
            <Button
              variant="outline"
              onClick={downloadExcelTemplate}
            >
              <Download className="w-4 h-4 mr-2" />
              Shablon
            </Button>

            {/* New Shipment Button */}
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
                <TableHead>{t('expected_date') || 'Kutilayotgan sana'}</TableHead>
                <TableHead>{t('status') || 'Holat'}</TableHead>
                <TableHead>{t('total_cost') || 'Jami summa'}</TableHead>
                <TableHead className="text-right">{t('actions') || 'Amallar'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShipments.map((shipment) => {
                const costs = calculateShipmentCosts(shipment);
                const itemsTotal = shipment.items?.reduce((sum, item) => {
                  const itemTotal = typeof item.total === 'number' ? item.total : ((item.quantity || 0) * (item.unit_price || item.price || 0));
                  return sum + itemTotal;
                }, 0) || 0;
                const total = itemsTotal + costs.total;

                return (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-medium">{extractString(shipment.tracking_number)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{extractString(shipment.supplier_company)}</p>
                        <p className="text-xs text-slate-500">{extractString(shipment.supplier_country)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(shipment.expected_date)}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditShipment(shipment)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            if (window.confirm('Bu yukni o\'chirmoqchimisiz?')) {
                              deleteShipment(shipment.id);
                            }
                          }}
                        >
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
      <Dialog open={showAddModal} onOpenChange={(open) => {
        setShowAddModal(open);
        if (!open) {
          setIsEditMode(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? (t('edit_shipment') || 'Yukni tahrirlash') : (t('new_shipment') || 'Yangi yuk buyurtmasi')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('supplier_company') || 'Kompaniya nomi'}</Label>
                <Input
                  placeholder="Kompaniya nomini kiriting"
                  value={formData.supplier_company}
                  onChange={(e) => setFormData({...formData, supplier_company: e.target.value})}
                />
              </div>

              <div>
                <Label>{t('tracking_number') || 'Tracking raqami'}</Label>
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

            </div>

            {/* Items Section */}
            <div>
              <Label className="text-lg font-semibold">{t('goods_list') || 'Tovarlar ro\'yxati'}</Label>
              <p className="text-sm text-slate-500 mt-1 mb-3">Yukdagi har bir tovar turini qo'shing (masalan: iPhone 15, Samsung TV, va h.k.)</p>

              {/* Add Item Form */}
              <Card className="mt-2 bg-slate-50">
                <CardContent className="p-4">
                  {/* Main Fields */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-3">
                    <div>
                      <Label className="text-xs text-slate-600 mb-1">Tovar nomi *</Label>
                      <Input
                        placeholder="iPhone 15 Pro Max"
                        value={currentItem.name}
                        onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1">Miqdori *</Label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({...currentItem, quantity: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1">Birlik narxi</Label>
                      <Input
                        type="number"
                        placeholder="1200"
                        value={currentItem.price}
                        onChange={(e) => setCurrentItem({...currentItem, price: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1">Valyuta</Label>
                      <Select value={currentItem.currency} onValueChange={(v) => setCurrentItem({...currentItem, currency: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="UZS">UZS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddItem} size="sm" className="w-full">
                        <Plus className="w-4 h-4 mr-1" />
                        Qo'shish
                      </Button>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {currentItem.customFields.length > 0 && (
                    <div className="space-y-2 mb-3 p-3 bg-white rounded-lg border border-slate-200">
                      <Label className="text-xs font-semibold text-slate-700">Qo'shimcha ma'lumotlar</Label>
                      {currentItem.customFields.map((field, index) => (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          <Input
                            placeholder="Maydon nomi (masalan: IMEI, Rang, Razmer)"
                            value={field.key}
                            onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Qiymat"
                            value={field.value}
                            onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                            className="text-xs"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomField(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Custom Field Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addCustomField}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Qo'shimcha maydon qo'shish (IMEI, Rang, va h.k.)
                  </Button>

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
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.customFields && item.customFields.length > 0 && (
                                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                    {item.customFields.map((field, i) => (
                                      field.key && field.value && (
                                        <p key={i}>{field.key}: {field.value}</p>
                                      )
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{String(item.currency || 'USD')} {item.price}</TableCell>
                            <TableCell className="font-semibold">{String(item.currency || 'USD')} {(typeof item.total === 'number' ? item.total : (item.quantity * item.price)).toLocaleString()}</TableCell>
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
              <p className="text-sm text-slate-500 mt-1 mb-3">Yuk tashish bilan bog'liq barcha xarajatlarni kiriting (USD hisobida)</p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className="flex items-center gap-2">
                    {t('transport_cost') || 'Transport xarajati'}
                    <span className="text-xs text-slate-400">(ixtiyoriy)</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={formData.costs.transport}
                    onChange={(e) => setFormData({
                      ...formData,
                      costs: {...formData.costs, transport: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    {t('customs_cost') || 'Bojxona to\'lovi'}
                    <span className="text-xs text-slate-400">(ixtiyoriy)</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="1200"
                    value={formData.costs.customs}
                    onChange={(e) => setFormData({
                      ...formData,
                      costs: {...formData.costs, customs: Number(e.target.value)}
                    })}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    {t('other_cost') || 'Boshqa xarajatlar'}
                    <span className="text-xs text-slate-400">(ixtiyoriy)</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="500"
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
                {isEditMode ? (t('save') || 'Saqlash') : (t('create') || 'Yaratish')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Shipment Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yuk ma'lumotlari</DialogTitle>
          </DialogHeader>

          {selectedShipment && (
            <div className="space-y-6">
              {/* Shipment Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Asosiy ma'lumotlar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">Tracking raqami</Label>
                      <p className="font-semibold">{extractString(selectedShipment.tracking_number)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Kompaniya</Label>
                      <p className="font-semibold">{extractString(selectedShipment.supplier_company)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Kutilayotgan sana</Label>
                      <p className="font-semibold">
                        {formatDate(selectedShipment.expected_date)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Holat</Label>
                      <div className="mt-1">
                        {getStatusBadge(selectedShipment.status)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tovarlar</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nomi</TableHead>
                        <TableHead>Miqdor</TableHead>
                        <TableHead>Narx</TableHead>
                        <TableHead>Jami</TableHead>
                        <TableHead>IMEI/Serial</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.name || item.item_name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{String(item.currency || 'USD')} {item.price || item.unit_price}</TableCell>
                          <TableCell className="font-semibold">
                            {String(item.currency || 'USD')} {((item.price || item.unit_price) * item.quantity).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {item.imei || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Costs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Xarajatlar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">Transport</Label>
                      <p className="font-semibold">${Number(selectedShipment.costs?.transport || selectedShipment.transport_cost || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Bojxona</Label>
                      <p className="font-semibold">${Number(selectedShipment.costs?.customs || selectedShipment.customs_cost || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Boshqa</Label>
                      <p className="font-semibold">${Number(selectedShipment.costs?.other || selectedShipment.other_cost || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Jami xarajatlar</Label>
                      <p className="font-semibold text-lg">
                        ${Number(calculateShipmentCosts(selectedShipment).total || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Summary */}
              <Card className="bg-gradient-to-br from-blue-50 to-purple-50">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-slate-600">Tovarlar qiymati</Label>
                      <p className="text-2xl font-bold text-slate-800">
                        ${(selectedShipment.items?.reduce((sum, item) => sum + ((item.price || item.unit_price) * item.quantity), 0) || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Jami summa (xarajatlar bilan)</Label>
                      <p className="text-3xl font-bold text-blue-900">
                        ${(
                          (selectedShipment.items?.reduce((sum, item) => sum + ((item.price || item.unit_price) * item.quantity), 0) || 0) +
                          calculateShipmentCosts(selectedShipment).total
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  Yopish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
