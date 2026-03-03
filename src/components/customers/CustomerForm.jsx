import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelWithHelp } from "@/components/ui/field-help";
import { X } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";

export default function CustomerForm({ customer, onSave, onCancel, language = 'en' }) {
  const { t } = useTranslation(language);

  const [formData, setFormData] = useState({
    company_name: customer?.company_name || "",
    contact_name: customer?.contact_name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    industry: customer?.industry || "technology",
    annual_revenue: customer?.annual_revenue || 0,
    employee_count: customer?.employee_count || 0,
    address: customer?.address || {
      street: "",
      city: "",
      state: "",
      country: "Uzbekistan"
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      annual_revenue: Number(formData.annual_revenue),
      employee_count: Number(formData.employee_count)
    });
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                  <LabelWithHelp htmlFor="industry" label={t('industry')} helpText={t('help_customer_industry')} />
                  <Select value={formData.industry} onValueChange={(value) => handleChange("industry", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">{t('technology')}</SelectItem>
                      <SelectItem value="healthcare">{t('healthcare')}</SelectItem>
                      <SelectItem value="retail">{t('retail')}</SelectItem>
                      <SelectItem value="manufacturing">{t('manufacturing')}</SelectItem>
                      <SelectItem value="services">{t('services')}</SelectItem>
                      <SelectItem value="logistics">{t('logistics')}</SelectItem>
                      <SelectItem value="e-commerce">{t('e_commerce')}</SelectItem>
                      <SelectItem value="other">{t('other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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