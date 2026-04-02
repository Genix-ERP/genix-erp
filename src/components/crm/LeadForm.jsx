import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelWithHelp } from "@/components/ui/field-help";
import { X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from "@/components/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import apiClient from "@/api/client";
import { leadsService } from "@/api/services/leads";
import { formatPhoneInput, parsePhoneInput } from '@/utils/formatCurrency';
import { pipelineStagesService } from "@/api/services/crm";
import { useCompany } from "@/components/contexts/CompanyContext";

export default function LeadForm({ lead, onSave, onCancel, language = 'en' }) {
  const { t } = useTranslation(language);
  const { user } = useAuth();
  const { MODULES, canDelete } = usePermissions();
  const { activeCompany } = useCompany();
  // canDelete on CUSTOMERS = "grant" level = sales head / admin
  const canChangeAssignment = canDelete(MODULES.CUSTOMERS);

  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [leadStages, setLeadStages] = useState([]);

  const [formData, setFormData] = useState({
    contact_name: lead?.contact_name || "",
    company_name: lead?.company_name || "",
    email: lead?.email || "",
    phone: lead?.phone || "+998",
    status: lead?.status || "new",
    source: lead?.source || "website",
    notes: lead?.notes || "",
    assigned_to: lead?.assigned_to || user?.id || ""
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiClient.get('/users', { params: { limit: 100 } });
        const data = response.data.data;
        setUsers(Array.isArray(data) ? data : data?.users || []);
      } catch (err) {
        console.warn('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  // Load lead pipeline stages from API
  useEffect(() => {
    const fetchStages = async () => {
      try {
        const stages = await pipelineStagesService.list(activeCompany?.id, 'lead');
        if (stages && stages.length > 0) {
          setLeadStages(stages.sort((a, b) => a.sequence - b.sequence));
        }
      } catch (err) {
        console.warn('Failed to fetch lead stages:', err);
      }
    };
    fetchStages();
  }, [activeCompany?.id]);

  useEffect(() => {
    if (lead?.id) {
      leadsService.getAuditLogs(lead.id).then(setAuditLogs).catch(() => {});
    }
  }, [lead?.id]);

  const fieldLabels = {
    contact_name: t('contact_name'),
    company_name: t('company_name'),
    email: t('email'),
    phone: t('phone'),
    status: t('status'),
    source: t('source'),
    notes: t('notes'),
    assigned_to: t('sales_person'),
    expected_value: t('expected_value'),
  };

  const formatFieldValue = (field, value) => {
    if (!value && value !== 0) return '—';
    if (field === 'status') return t(value) || value;
    if (field === 'source') return t(value) || value;
    return String(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const assignedUser = users.find(u => u.id === formData.assigned_to);
  const assignedName = assignedUser
    ? (assignedUser.full_name || `${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim())
    : lead?.assigned_to_name || '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{lead ? `${t('edit')} ${t('lead')}` : t('add_lead')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <LabelWithHelp
                htmlFor="contact_name"
                label={t('contact_name')}
                helpText={t('help_lead_contact_name')}
                required
              />
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => handleChange("contact_name", e.target.value)}
                placeholder={t('enter_name')}
                required
              />
            </div>

            <div className="space-y-2">
              <LabelWithHelp
                htmlFor="company_name"
                label={t('company_name')}
                helpText={t('help_lead_company_name')}
              />
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleChange("company_name", e.target.value)}
                placeholder={t('enter_company')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="email"
                  label={t('email')}
                  helpText={t('help_lead_email')}
                />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="phone"
                  label={t('phone')}
                  helpText={t('help_lead_phone')}
                />
                <Input
                  id="phone"
                  value={formatPhoneInput(formData.phone)}
                  onChange={(e) => handleChange("phone", parsePhoneInput(e.target.value))}
                  placeholder="+998 XX XXX XXXX"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="status"
                  label={t('status')}
                  helpText={t('help_lead_status')}
                />
                <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStages.length > 0 ? (
                      leadStages.map(stage => (
                        <SelectItem key={stage.id} value={stage.code}>{stage.name}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="new">{t('new')}</SelectItem>
                        <SelectItem value="contacted">{t('contacted')}</SelectItem>
                        <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                        <SelectItem value="qualified">{t('qualified')}</SelectItem>
                        <SelectItem value="lost">{t('lost')}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="source"
                  label={t('source')}
                  helpText={t('help_lead_source')}
                />
                <Select value={formData.source} onValueChange={(value) => handleChange("source", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">{t('website')}</SelectItem>
                    <SelectItem value="referral">{t('referral')}</SelectItem>
                    <SelectItem value="social_media">{t('social_media')}</SelectItem>
                    <SelectItem value="cold_call">{t('cold_call')}</SelectItem>
                    <SelectItem value="advertisement">{t('advertisement')}</SelectItem>
                    <SelectItem value="other">{t('other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sales Person / Assigned To */}
            <div className="space-y-2">
              <LabelWithHelp
                htmlFor="assigned_to"
                label={t('sales_person')}
                helpText={t('help_sales_person')}
              />
              {canChangeAssignment ? (
                <Select
                  value={formData.assigned_to || ""}
                  onValueChange={(value) => handleChange("assigned_to", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_sales_person')} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.is_active !== false).map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="assigned_to"
                  value={assignedName || user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
                  disabled
                  className="bg-slate-50"
                />
              )}
            </div>

            <div className="space-y-2">
              <LabelWithHelp
                htmlFor="notes"
                label={t('notes')}
                helpText={t('help_lead_notes')}
              />
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder={t('add_notes')}
                rows={3}
              />
            </div>

            {/* Change History */}
            {lead && auditLogs.length > 0 && (
              <div className="border-t pt-4">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 w-full"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <Clock className="w-4 h-4" />
                  {t('change_history') || "O'zgarishlar tarixi"} ({auditLogs.length})
                  {showHistory ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                    {auditLogs.map((log) => {
                      const oldVals = typeof log.old_values === 'string' ? JSON.parse(log.old_values || '{}') : (log.old_values || {});
                      const newVals = typeof log.new_values === 'string' ? JSON.parse(log.new_values || '{}') : (log.new_values || {});
                      const changedFields = Object.keys(newVals).filter(
                        k => !['updated_at', 'id', 'company_id', 'tenant_id', 'created_at'].includes(k) && JSON.stringify(oldVals[k]) !== JSON.stringify(newVals[k])
                      );
                      if (changedFields.length === 0) return null;
                      return (
                        <div key={log.id} className="border rounded-lg p-3 bg-slate-50 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-800">{log.user_name || log.user_email}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {changedFields.map(field => (
                              <div key={field} className="flex flex-wrap gap-1 text-xs">
                                <span className="font-medium text-slate-600">{fieldLabels[field] || field}:</span>
                                <span className="text-red-600 line-through">{formatFieldValue(field, oldVals[field])}</span>
                                <span className="text-slate-400">&rarr;</span>
                                <span className="text-green-600">{formatFieldValue(field, newVals[field])}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                {lead ? t('update') : t('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
