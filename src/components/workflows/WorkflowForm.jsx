import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";

export default function WorkflowForm({ workflow, onSave, onCancel }) {
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
          <CardTitle>{workflow ? "Edit Workflow" : "Create New Workflow"}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--genix-navy)]">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Workflow Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="procurement">Procurement</SelectItem>
                      <SelectItem value="customer_support">Customer Support</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  placeholder="Describe what this workflow does..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trigger">Trigger</Label>
                  <Select value={formData.trigger} onValueChange={(value) => handleChange("trigger", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="event_based">Event Based</SelectItem>
                      <SelectItem value="ai_triggered">AI Triggered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="automation_level">Automation Level</Label>
                  <Select value={formData.automation_level} onValueChange={(value) => handleChange("automation_level", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="semi_automated">Semi Automated</SelectItem>
                      <SelectItem value="fully_automated">Fully Automated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--genix-navy)]">Workflow Steps</h3>
                <Button type="button" onClick={addStep} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              </div>
              
              <div className="space-y-4">
                {formData.steps.map((step, index) => (
                  <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Step {index + 1}</h4>
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
                        <Label>Step Name</Label>
                        <Input
                          value={step.step_name}
                          onChange={(e) => handleStepChange(index, "step_name", e.target.value)}
                          placeholder="e.g., Send welcome email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Assignee</Label>
                        <Input
                          value={step.assignee}
                          onChange={(e) => handleStepChange(index, "assignee", e.target.value)}
                          placeholder="e.g., AI Assistant, Sales Team"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>Action Description</Label>
                        <Input
                          value={step.action}
                          onChange={(e) => handleStepChange(index, "action", e.target.value)}
                          placeholder="Describe the action to be taken"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estimated Duration (hours)</Label>
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
              <h3 className="text-lg font-semibold text-[var(--genix-navy)]">Performance Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="success_rate">Success Rate (%)</Label>
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
                  <Label htmlFor="avg_completion_time">Avg Completion Time (hours)</Label>
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
                  <Label htmlFor="cost_savings">Monthly Cost Savings ($)</Label>
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
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                {workflow ? "Update Workflow" : "Create Workflow"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}