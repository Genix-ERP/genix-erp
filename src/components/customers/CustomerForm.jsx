import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    tags: customer?.tags || [],
    notes: customer?.notes || "",
    expected_revenue: customer?.expected_revenue || "",
    annual_revenue: customer?.annual_revenue || 0,
    employee_count: customer?.employee_count || 0,
    address: customer?.address || {
      street: "",
      city: "",
      state: "",
      country: "Uzbekistan"
    }
  });

  const [tagInput, setTagInput] = useState("");

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
    onSave({
      ...formData,
      annual_revenue: Number(formData.annual_revenue),
      employee_count: Number(formData.employee_count),
      expected_revenue: formData.expected_revenue !== "" ? Number(formData.expected_revenue) : undefined,
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
                    type="number"
                    value={formData.expected_revenue}
                    onChange={(e) => handleChange("expected_revenue", e.target.value)}
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