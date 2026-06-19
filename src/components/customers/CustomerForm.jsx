import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LabelWithHelp } from "@/components/ui/field-help";
import { X } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";
import { formatPhoneInput, parsePhoneInput, formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { financeService } from '@/api/services/finance';
import { inventoryService } from '@/api/services/inventory';

export default function CustomerForm({ customer, onSave, onCancel, language = 'en' }) {
  const { t } = useTranslation(language);

  const [formData, setFormData] = useState({
    company_name: customer?.company_name || "",
    contact_name: customer?.contact_name || "",
    email: customer?.email || "",
    phone: customer?.phone || "+998",
    tags: customer?.tags || [],
    notes: customer?.notes || "",
    expected_revenue: customer?.expected_revenue || "",
    annual_revenue: customer?.annual_revenue || 0,
    employee_count: customer?.employee_count || 0,
    default_receivable_account_id: customer?.default_receivable_account_id || "",
    default_payable_account_id: customer?.default_payable_account_id || "",
    address: customer?.address || {
      street: "",
      city: "",
      state: "",
      country: "Uzbekistan"
    }
  });

  const [tagInput, setTagInput] = useState("");
  const [accounts, setAccounts] = useState([]);

  // --- Inline order / cost-calculator (new customers only) ---
  const isNew = !customer;
  const [orderEnabled, setOrderEnabled] = useState(false);
  const [order, setOrder] = useState({ product_id: '', product_name: '', quantity: 1, profit_percent: 45, paid_amount: '' });
  const [components, setComponents] = useState([]);
  const [newComp, setNewComp] = useState({ product_id: '', product_name: '', quantity: 1, unit: 'pcs', unit_price: 0 });
  const [prodSearch, setProdSearch] = useState('');
  const [prodResults, setProdResults] = useState([]);
  const [searchTarget, setSearchTarget] = useState(null); // 'main' | 'component'
  const prodTimer = useRef(null);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await financeService.listAccounts({ limit: 500 });
        setAccounts(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };
    loadAccounts();
  }, []);

  // Debounced product search (shared between the main product and component pickers).
  useEffect(() => {
    if (!prodSearch || prodSearch.length < 2) { setProdResults([]); return; }
    if (prodTimer.current) clearTimeout(prodTimer.current);
    prodTimer.current = setTimeout(async () => {
      try {
        const data = await inventoryService.listProducts({ search: prodSearch, limit: 20 });
        setProdResults(Array.isArray(data) ? data : (data?.items || data?.data || []));
      } catch (e) { /* silent */ }
    }, 300);
    return () => { if (prodTimer.current) clearTimeout(prodTimer.current); };
  }, [prodSearch]);

  const componentsCost = components.reduce((s, c) => s + (Number(c.quantity) || 0) * (Number(c.unit_price) || 0), 0);
  const estTotal = componentsCost * (1 + (Number(order.profit_percent) || 0) / 100);
  const remaining = estTotal - (Number(order.paid_amount) || 0);

  const pickProduct = (p) => {
    const price = Number(p.cost_price || p.unit_cost || p.price || 0);
    if (searchTarget === 'main') {
      setOrder(o => ({ ...o, product_id: p.id, product_name: p.name }));
    } else {
      setNewComp(c => ({ ...c, product_id: p.id, product_name: p.name, unit: p.uom || c.unit, unit_price: price }));
    }
    setProdSearch(''); setProdResults([]); setSearchTarget(null);
  };
  const addComponent = () => {
    if (!newComp.product_name) return;
    setComponents(cs => [...cs, newComp]);
    setNewComp({ product_id: '', product_name: '', quantity: 1, unit: 'pcs', unit_price: 0 });
  };
  const removeComponent = (i) => setComponents(cs => cs.filter((_, idx) => idx !== i));

  const handleTagKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,$/, '');
      if (newTag && !formData.tags.includes(newTag)) {
        setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      }
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      annual_revenue: Number(formData.annual_revenue),
      employee_count: Number(formData.employee_count),
      expected_revenue: formData.expected_revenue !== "" ? Number(formData.expected_revenue) : undefined,
    };
    // When the inline order section is enabled on a NEW customer, attach the order
    // so the page submits the combined "customer + sales order + manufacture order".
    if (isNew && orderEnabled && order.product_id) {
      payload.__order = {
        product_id: order.product_id,
        quantity: Number(order.quantity) || 1,
        profit_percent: Number(order.profit_percent) || 0,
        paid_amount: Number(order.paid_amount) || 0,
        components: components.map(c => ({
          product_id: c.product_id || undefined,
          name: c.product_name,
          quantity: Number(c.quantity) || 0,
          unit: c.unit,
          unit_price: Number(c.unit_price) || 0,
        })),
      };
    }
    onSave(payload);
  };

  const handleChange = (field, value) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [addressField]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 border-0">
      <Card className="w-full max-w-[95vw] sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{customer ? `${t('edit')} ${t('customer')}` : t('add_customer')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('basic_information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="company_name" label={t('company_name')} helpText={t('help_customer_company')} required />
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleChange("company_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="contact_name" label={t('contact_name')} helpText={t('help_customer_contact')} required />
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => handleChange("contact_name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="email" label={t('email')} helpText={t('help_customer_email')} />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="phone" label={t('phone')} helpText={t('help_customer_phone')} />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="tags" label={t('tags') || 'Tags'} helpText={t('help_customer_tags') || 'Press Enter or comma to add a tag'} />
                  <div className="flex flex-wrap gap-1 min-h-[38px] items-center border rounded-md px-3 py-1.5 focus-within:ring-1 focus-within:ring-ring">
                    {formData.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder={formData.tags.length === 0 ? (t('add_tags') || 'Add tags...') : ''}
                      className="flex-1 min-w-[80px] outline-none bg-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="expected_revenue" label={t('expected_revenue') || 'Expected Revenue'} helpText={t('help_customer_expected_revenue') || 'Estimated annual revenue from this customer'} />
                  <Input
                    id="expected_revenue"
                    type="text"
                    inputMode="decimal"
                    value={formatPriceInput(formData.expected_revenue)}
                    onChange={(e) => handleChange("expected_revenue", parsePriceInput(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <LabelWithHelp htmlFor="notes" label={t('note') || 'Note'} helpText={t('help_customer_note') || 'Internal notes about this customer'} />
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('address')}</h3>
              <div className="space-y-2">
                <LabelWithHelp htmlFor="street" label={t('street_address')} helpText={t('help_customer_street')} />
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => handleChange("address.street", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="city" label={t('city')} helpText={t('help_customer_city')} />
                  <Input
                    id="city"
                    value={formData.address.city}
                    onChange={(e) => handleChange("address.city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="state" label={t('state')} helpText={t('help_customer_state')} />
                  <Input
                    id="state"
                    value={formData.address.state}
                    onChange={(e) => handleChange("address.state", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <LabelWithHelp htmlFor="country" label={t('country')} helpText={t('help_customer_country')} />
                  <Input
                    id="country"
                    value={formData.address.country}
                    onChange={(e) => handleChange("address.country", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Inline order + cost calculator (new customers only) */}
            {isNew && (
              <div className="space-y-4 border-t pt-4">
                <label className="flex items-center gap-2 text-lg font-medium cursor-pointer">
                  <input type="checkbox" checked={orderEnabled} onChange={(e) => setOrderEnabled(e.target.checked)} />
                  {t('create_order_with_customer') || "Buyurtma yaratish (mahsulot + komponentlar)"}
                </label>

                {orderEnabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2 relative">
                        <LabelWithHelp label={t('product') || 'Mahsulot'} required />
                        <Input
                          value={order.product_name || (searchTarget === 'main' ? prodSearch : '')}
                          onChange={(e) => { setSearchTarget('main'); setProdSearch(e.target.value); setOrder(o => ({ ...o, product_id: '', product_name: '' })); }}
                          onFocus={() => setSearchTarget('main')}
                          placeholder={t('search_product') || 'Mahsulot qidirish...'}
                        />
                        {searchTarget === 'main' && prodResults.length > 0 && (
                          <div className="absolute z-20 bg-white border rounded-md shadow w-full max-h-48 overflow-y-auto">
                            {prodResults.map(p => (
                              <button type="button" key={p.id} onClick={() => pickProduct(p)} className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">{p.name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <LabelWithHelp label={t('quantity') || 'Miqdor'} />
                        <Input type="number" min="1" value={order.quantity} onChange={(e) => setOrder(o => ({ ...o, quantity: e.target.value }))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <LabelWithHelp label={(t('profit') || 'Foyda') + ' %'} />
                        <Input type="number" value={order.profit_percent} onChange={(e) => setOrder(o => ({ ...o, profit_percent: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <LabelWithHelp label={t('paid_amount') || "Oldindan to'lov"} />
                        <Input type="text" inputMode="decimal" value={formatPriceInput(order.paid_amount)} onChange={(e) => setOrder(o => ({ ...o, paid_amount: parsePriceInput(e.target.value) }))} />
                      </div>
                    </div>

                    {/* Components */}
                    <div className="space-y-2">
                      <LabelWithHelp label={t('components') || 'Komponentlar'} />
                      <div className="grid grid-cols-12 gap-2 items-end relative">
                        <div className="col-span-5">
                          <Input
                            value={newComp.product_name || (searchTarget === 'component' ? prodSearch : '')}
                            onChange={(e) => { setSearchTarget('component'); setProdSearch(e.target.value); setNewComp(c => ({ ...c, product_id: '', product_name: '' })); }}
                            onFocus={() => setSearchTarget('component')}
                            placeholder={t('search_product') || 'Mahsulot/Material...'}
                          />
                          {searchTarget === 'component' && prodResults.length > 0 && (
                            <div className="absolute z-20 bg-white border rounded-md shadow w-72 max-h-48 overflow-y-auto">
                              {prodResults.map(p => (
                                <button type="button" key={p.id} onClick={() => pickProduct(p)} className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm">{p.name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2"><Input type="number" value={newComp.quantity} onChange={(e) => setNewComp(c => ({ ...c, quantity: e.target.value }))} placeholder={t('quantity') || 'Miqdor'} /></div>
                        <div className="col-span-2"><Input value={newComp.unit} onChange={(e) => setNewComp(c => ({ ...c, unit: e.target.value }))} placeholder={t('unit') || 'Birlik'} /></div>
                        <div className="col-span-2"><Input type="number" value={newComp.unit_price} onChange={(e) => setNewComp(c => ({ ...c, unit_price: e.target.value }))} placeholder={t('price') || 'Narxi'} /></div>
                        <div className="col-span-1"><Button type="button" variant="outline" size="sm" onClick={addComponent}>+</Button></div>
                      </div>
                      {components.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                          <span>{c.product_name} — {c.quantity} {c.unit} × {formatPriceInput(c.unit_price)}</span>
                          <button type="button" onClick={() => removeComponent(i)} className="text-destructive"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>

                    {/* Live preview (server adds BOM cost to the final total) */}
                    <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span>{t('components_cost') || 'Komponentlar'}</span><span>{formatPriceInput(componentsCost)}</span></div>
                      <div className="flex justify-between text-slate-400"><span>+ BOM ({t('server_side') || 'serverda'})</span><span>—</span></div>
                      <div className="flex justify-between font-medium"><span>{(t('est_total') || 'Taxminiy jami')} (+{order.profit_percent || 0}%)</span><span>{formatPriceInput(estTotal)}</span></div>
                      <div className="flex justify-between"><span>{t('remaining') || 'Qoldiq'}</span><span>{formatPriceInput(remaining)}</span></div>
                      <p className="text-xs text-slate-400">{t('bom_note') || "Yakuniy jami serverda mahsulot BOM narxi qo'shilgan holda hisoblanadi."}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                {customer ? t('update') + ' ' + t('customer') : t('add_customer')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}