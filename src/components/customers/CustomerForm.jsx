import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    status: customer?.status || "prospect",
    annual_revenue: customer?.annual_revenue || 0,
    employee_count: customer?.employee_count || 0,
    monthly_value: customer?.monthly_value || 0,
    subscription_tier: customer?.subscription_tier || "freemium",
    address: customer?.address || {
      street: "",
      city: "",
      state: "",
      zip: "",
      country: "USA"
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      annual_revenue: Number(formData.annual_revenue),
      employee_count: Number(formData.employee_count),
      monthly_value: Number(formData.monthly_value)
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
                  <Label htmlFor="company_name">{t('company_name')} *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleChange("company_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">{t('contact_name')} *</Label>
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
                  <Label htmlFor="email">{t('email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">{t('industry')}</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="status">{t('status')}</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">{t('prospect')}</SelectItem>
                      <SelectItem value="active">{t('active')}</SelectItem>
                      <SelectItem value="inactive">{t('inactive')}</SelectItem>
                      <SelectItem value="churned">{t('churned')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('business_details')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="annual_revenue">{t('annual_revenue_field')}</Label>
                  <Input
                    id="annual_revenue"
                    type="number"
                    min="0"
                    value={formData.annual_revenue}
                    onChange={(e) => handleChange("annual_revenue", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_count">{t('employee_count')}</Label>
                  <Input
                    id="employee_count"
                    type="number"
                    min="0"
                    value={formData.employee_count}
                    onChange={(e) => handleChange("employee_count", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_value">{t('monthly_value')}</Label>
                  <Input
                    id="monthly_value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.monthly_value}
                    onChange={(e) => handleChange("monthly_value", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription_tier">{t('subscription_tier')}</Label>
                <Select value={formData.subscription_tier} onValueChange={(value) => handleChange("subscription_tier", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freemium">{t('freemium')}</SelectItem>
                    <SelectItem value="basic">{t('basic')}</SelectItem>
                    <SelectItem value="professional">{t('professional')}</SelectItem>
                    <SelectItem value="enterprise">{t('enterprise')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('address')}</h3>
              <div className="space-y-2">
                <Label htmlFor="street">{t('street_address')}</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => handleChange("address.street", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('city')}</Label>
                  <Input
                    id="city"
                    value={formData.address.city}
                    onChange={(e) => handleChange("address.city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t('state')}</Label>
                  <Input
                    id="state"
                    value={formData.address.state}
                    onChange={(e) => handleChange("address.state", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">{t('zip_code')}</Label>
                  <Input
                    id="zip"
                    value={formData.address.zip}
                    onChange={(e) => handleChange("address.zip", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">{t('country')}</Label>
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