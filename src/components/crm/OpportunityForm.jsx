import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, DollarSign, Percent, Calendar, X } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";

const stages = [
  { id: 'qualification', label: 'qualification' },
  { id: 'needs_analysis', label: 'needs_analysis' },
  { id: 'proposal', label: 'proposal' },
  { id: 'negotiation', label: 'negotiation' },
  { id: 'closed_won', label: 'closed_won' },
  { id: 'closed_lost', label: 'closed_lost' }
];

export default function OpportunityForm({ opportunity, onSave, onCancel, language = 'en' }) {
  const { t } = useTranslation(language);

  const [formData, setFormData] = useState({
    name: '',
    stage: 'qualification',
    expected_value: '',
    probability: '',
    expected_close_date: ''
  });

  useEffect(() => {
    if (opportunity) {
      setFormData({
        name: opportunity.name || '',
        stage: opportunity.stage || 'qualification',
        expected_value: opportunity.expected_value?.toString() || '',
        probability: opportunity.probability?.toString() || '',
        expected_close_date: opportunity.expected_close_date?.split('T')[0] || ''
      });
    }
  }, [opportunity]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const opportunityData = {
      ...formData,
      expected_value: parseFloat(formData.expected_value) || 0,
      probability: parseInt(formData.probability) || 0
    };

    onSave(opportunityData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--genix-blue)]" />
            {opportunity ? t('edit_opportunity') : t('add_opportunity')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-2">
            <LabelWithHelp htmlFor="name" label={t('name')} helpText={t('help_opportunity_name')} required />
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('opportunity_name_placeholder')}
              required
            />
          </div>

          {/* Stage */}
          <div className="space-y-2">
            <LabelWithHelp htmlFor="stage" label={t('stage')} helpText={t('help_opportunity_stage')} required />
            <Select value={formData.stage} onValueChange={(value) => handleChange('stage', value)}>
              <SelectTrigger id="stage">
                <SelectValue placeholder={t('select_stage')} />
              </SelectTrigger>
              <SelectContent>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {t(stage.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expected Value */}
          <div className="space-y-2">
            <LabelWithHelp htmlFor="expected_value" label={t('expected_value')} helpText={t('help_opportunity_value')} />
            <Input
              id="expected_value"
              type="number"
              min="0"
              step="0.01"
              value={formData.expected_value}
              onChange={(e) => handleChange('expected_value', e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Probability */}
          <div className="space-y-2">
            <LabelWithHelp htmlFor="probability" label={`${t('probability')} (%)`} helpText={t('help_opportunity_probability')} />
            <Input
              id="probability"
              type="number"
              min="0"
              max="100"
              value={formData.probability}
              onChange={(e) => handleChange('probability', e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Expected Close Date */}
          <div className="space-y-2">
            <LabelWithHelp htmlFor="expected_close_date" label={t('expected_close_date')} helpText={t('help_opportunity_close_date')} />
            <Input
              id="expected_close_date"
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => handleChange('expected_close_date', e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              {opportunity ? t('update') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
