import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function WorkflowForm({ workflow, onSave, onCancel }) {
  const { language } = useLanguage();
  const t = useTranslation(language);

  const [formData, setFormData] = useState({
    name: workflow?.name || "",
    description: workflow?.description || "",
    category: workflow?.category || "hr",
    trigger: workflow?.trigger || "manual",
    status: workflow?.status || "draft",
    automation_level: workflow?.automation_level || "manual",
    steps: workflow?.steps || [
      {
        step_name: "",
        action: "",
        assignee: "",
        estimated_duration: 1
      }
    ],
    success_rate: workflow?.success_rate || 85,
    avg_completion_time: workflow?.avg_completion_time || 2,
    cost_savings: workflow?.cost_savings || 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      success_rate: Number(formData.success_rate),
      avg_completion_time: Number(formData.avg_completion_time),
      cost_savings: Number(formData.cost_savings),
      steps: formData.steps.map(step => ({
        ...step,
        estimated_duration: Number(step.estimated_duration)
      }))
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, {
        step_name: "",
        action: "",
        assignee: "",
        estimated_duration: 1
      }]
    }));
  };

  const removeStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{workflow ? t('edit_workflow') : t('create_new_workflow')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--genix-navy)]">{t('basic_information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('workflow_name')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">{t('category')} *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">{t('category_hr')}</SelectItem>
                      <SelectItem value="procurement">{t('category_procurement')}</SelectItem>
                      <SelectItem value="customer_support">{t('category_customer_support')}</SelectItem>
                      <SelectItem value="sales">{t('category_sales')}</SelectItem>
                      <SelectItem value="inventory">{t('category_inventory')}</SelectItem>
                      <SelectItem value="finance">{t('category_finance')}</SelectItem>
                      <SelectItem value="marketing">{t('category_marketing')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  placeholder={t('describe_workflow_placeholder')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trigger">{t('trigger')}</Label>
                  <Select value={formData.trigger} onValueChange={(value) => handleChange("trigger", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t('manual')}</SelectItem>
                      <SelectItem value="scheduled">{t('scheduled')}</SelectItem>
                      <SelectItem value="event_based">{t('event_based')}</SelectItem>
                      <SelectItem value="ai_triggered">{t('ai_triggered')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="automation_level">{t('automation_level')}</Label>
                  <Select value={formData.automation_level} onValueChange={(value) => handleChange("automation_level", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t('manual')}</SelectItem>
                      <SelectItem value="semi_automated">{t('semi_automated')}</SelectItem>
                      <SelectItem value="fully_automated">{t('fully_automated')}</SelectItem>
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
                      <SelectItem value="active">{t('status_active')}</SelectItem>
                      <SelectItem value="paused">{t('status_paused')}</SelectItem>
                      <SelectItem value="draft">{t('status_draft')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--genix-navy)]">{t('workflow_steps')}</h3>
                <Button type="button" onClick={addStep} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_step')}
                </Button>
              </div>

              <div className="space-y-4">
                {formData.steps.map((step, index) => (
                  <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{t('step')} {index + 1}</h4>
                      {formData.steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('step_name')}</Label>
                        <Input
                          value={step.step_name}
                          onChange={(e) => handleStepChange(index, "step_name", e.target.value)}
                          placeholder={t('step_name_placeholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('assignee')}</Label>
                        <Input
                          value={step.assignee}
                          onChange={(e) => handleStepChange(index, "assignee", e.target.value)}
                          placeholder={t('assignee_placeholder')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>{t('action_description')}</Label>
                        <Input
                          value={step.action}
                          onChange={(e) => handleStepChange(index, "action", e.target.value)}
                          placeholder={t('action_placeholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('estimated_duration_hours')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={step.estimated_duration}
                          onChange={(e) => handleStepChange(index, "estimated_duration", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--genix-navy)]">{t('performance_metrics')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="success_rate">{t('success_rate_percent')}</Label>
                  <Input
                    id="success_rate"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.success_rate}
                    onChange={(e) => handleChange("success_rate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avg_completion_time">{t('avg_completion_time_hours')}</Label>
                  <Input
                    id="avg_completion_time"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.avg_completion_time}
                    onChange={(e) => handleChange("avg_completion_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_savings">{t('monthly_cost_savings')}</Label>
                  <Input
                    id="cost_savings"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost_savings}
                    onChange={(e) => handleChange("cost_savings", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                {workflow ? t('update_workflow') : t('create_workflow')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}