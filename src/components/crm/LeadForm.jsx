import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelWithHelp } from "@/components/ui/field-help";
import { X } from "lucide-react";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from "@/components/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/components/contexts/CompanyContext";
import apiClient from "@/api/client";
import { pipelineStagesService } from "@/api/services/crm";
import { leadsService } from "@/api/services/leads";
import { Phone, CalendarDays, Mail, Bell, Sparkles, Loader2 } from "lucide-react";
import { formatDate, formatDateTime } from '@/utils/formatDate';

// English defaults — if name matches, show translation; otherwise show custom name
const DEFAULT_STAGE_NAMES = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In Progress',
  qualified: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export default function LeadForm({ lead, onSave, onCancel, language = 'en' }) {
  const { t } = useTranslation(language);
  const { user } = useAuth();
  const { MODULES, canDelete } = usePermissions();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;
  // canDelete on CUSTOMERS = "grant" level = sales head / admin
  const canChangeAssignment = canDelete(MODULES.CUSTOMERS);

  const [users, setUsers] = useState([]);
  const [leadStages, setLeadStages] = useState([]);

  const [formData, setFormData] = useState({
    contact_name: lead?.contact_name || "",
    company_name: lead?.company_name || "",
    email: lead?.email || "",
    phone: lead?.phone || "+998",
    status: lead?.status || "new",
    source: lead?.source || "website",
    expected_value: lead?.expected_value ?? "",
    currency: lead?.currency || "UZS",
    // Notes always open empty — they're treated as a per-update
    // comment, captured in the change-history audit log of THIS edit.
    // Showing the previous note would imply it's the lead's "current
    // note" which isn't the intent (and would trick users into editing
    // an old comment instead of writing a fresh one for this change).
    notes: "",
    assigned_to: lead?.assigned_to || user?.id || ""
  });

  // AI enrichment: paste a Telegram message / free text → field suggestions.
  const [aiText, setAiText] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);

  const runAiExtract = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const res = await leadsService.aiExtract(aiText.trim());
      const s = res?.suggestions;
      if (res?.ai_configured === false || !s) {
        setAiFilled(false);
        setAiOpen(false);
        return;
      }
      const pick = (key) => {
        const f = s[key];
        return f && f.value != null && f.value !== '' && (f.confidence ?? 0) >= 0.4 ? f.value : null;
      };
      setFormData(prev => ({
        ...prev,
        contact_name: pick('contact_name') || prev.contact_name,
        company_name: pick('company_name') || prev.company_name,
        phone: pick('phone') || prev.phone,
        email: pick('email') || prev.email,
        expected_value: pick('amount') ?? prev.expected_value,
        currency: pick('currency') || prev.currency,
        source: pick('source') || prev.source,
      }));
      const need = pick('need');
      if (need) setFollowup(prev => ({ ...prev, comment: prev.comment || need }));
      setAiFilled(true);
    } catch (err) {
      console.warn('AI extract failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Structured follow-up: a separate scheduled activity that fires a
  // notification at the chosen time. All fields optional — if nothing
  // is filled, no activity is created.
  const [followup, setFollowup] = useState({
    action_type: "call",      // call | meeting | email | follow_up
    date: "",                 // YYYY-MM-DD
    time: "",                 // HH:MM (24h)
    comment: "",              // becomes activity.description
  });

  const handleFollowupChange = (field, value) => {
    setFollowup(prev => ({ ...prev, [field]: value }));
  };

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

  // Load pipeline stages for the status dropdown
  useEffect(() => {
    pipelineStagesService.list(companyId, 'lead')
      .then(data => { if (data && data.length > 0) setLeadStages(data); })
      .catch(() => {});
  }, [companyId]);

  // Subjects shown in the activity list / notification title.
  const ACTION_SUBJECT_PREFIX = {
    call: t('action_call') || 'Call',
    meeting: t('action_meeting') || 'Meeting',
    email: t('action_email') || 'Email',
    follow_up: t('action_other') || 'Follow-up',
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build follow-up payload in two modes:
    //   1. Date + time filled  → scheduled activity (call/meeting/email)
    //      with start_datetime + reminder_datetime → notification fires.
    //   2. Only comment filled → note-type activity with no datetime,
    //      no reminder. Shows up in the detail modal as a plain note.
    // If neither comment nor date/time is filled, we send nothing.
    let followupPayload = null;
    const hasSchedule = !!(followup.date && followup.time);
    const hasComment = !!(followup.comment && followup.comment.trim());

    if (hasSchedule) {
      // Scheduled follow-up. Combine local date+time into an ISO
      // string with the user's timezone offset so the backend stores
      // the exact wall-clock moment the user picked.
      const local = new Date(`${formatDate(followup.date)}T${followup.time}:00`);
      if (!isNaN(local.getTime())) {
        const isoDatetime = local.toISOString();
        followupPayload = {
          activity_type: followup.action_type,
          subject: `${ACTION_SUBJECT_PREFIX[followup.action_type] || ''} ${formData.contact_name || formData.company_name || ''}`.trim(),
          description: followup.comment || "",
          start_datetime: isoDatetime,
          // Reminder fires at the same moment as the scheduled activity
          // unless we add a "remind X minutes before" control later.
          reminder_datetime: isoDatetime,
          assigned_to: formData.assigned_to || user?.id || "",
          status: "planned",
          priority: "medium",
        };
      }
    } else if (hasComment) {
      // Note-only path. activity_type='note' so the detail modal can
      // visually distinguish it from scheduled follow-ups. No
      // reminder_datetime → background worker won't pick it up.
      followupPayload = {
        activity_type: "note",
        subject: `${t('action_note') || 'Note'} ${formData.contact_name || formData.company_name || ''}`.trim(),
        description: followup.comment.trim(),
        assigned_to: formData.assigned_to || user?.id || "",
        status: "completed",  // notes don't need to be "done" — they just exist
        priority: "low",
      };
    }

    const payload = {
      ...formData,
      expected_value:
        formData.expected_value === "" || formData.expected_value == null
          ? undefined
          : Number(formData.expected_value),
    };
    onSave(payload, followupPayload);
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
            {/* AI enrichment — paste a Telegram message, AI fills the form.
                Suggestions only; the user reviews before saving. */}
            {!lead && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
                {!aiOpen ? (
                  <button
                    type="button"
                    onClick={() => setAiOpen(true)}
                    className="flex w-full items-center gap-2 text-sm font-medium text-purple-700"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('crm_ai_fill') || "AI bilan to'ldirish — xabar matnini joylashtiring"}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                      <Sparkles className="h-4 w-4" />
                      {t('crm_ai_fill_title') || 'Telegram xabari yoki matnni joylashtiring'}
                    </div>
                    <Textarea
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      rows={3}
                      placeholder={t('crm_ai_fill_placeholder') || "Masalan: Assalomu alaykum, men Alisher, uy ta'miri kerak, byudjet 50 mln, tel 90 123 45 67"}
                      className="bg-white text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={runAiExtract} disabled={aiLoading || !aiText.trim()}>
                        {aiLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                        {t('crm_ai_extract') || "To'ldirish"}
                      </Button>
                      {aiFilled && (
                        <span className="text-xs text-emerald-600">
                          {t('crm_ai_filled') || 'Maydonlar to‘ldirildi — tekshirib chiqing'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>

            {/* Amount — the pipeline's money dimension. Without it the board
                is a contact list, not a sales tool. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="expected_value"
                  label={t('crm_deal_amount') || 'Bitim summasi'}
                  helpText={t('help_lead_amount')}
                />
                <Input
                  id="expected_value"
                  type="number"
                  min="0"
                  step="any"
                  value={formData.expected_value}
                  onChange={(e) => handleChange("expected_value", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="currency"
                  label={t('currency') || 'Valyuta'}
                  helpText={t('help_lead_currency')}
                />
                <Select value={formData.currency} onValueChange={(value) => handleChange("currency", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS (so&apos;m)</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <LabelWithHelp
                  htmlFor="status"
                  label={t('crm_stage') || t('status')}
                  helpText={t('help_lead_status')}
                />
                <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStages.length > 0 ? (
                      // terminal stages go through the win/loss flows, not the form
                      leadStages.filter(s => !s.is_won && !s.is_lost).map(stage => {
                        const isDefault = DEFAULT_STAGE_NAMES[stage.code] && stage.name === DEFAULT_STAGE_NAMES[stage.code];
                        return (
                          <SelectItem key={stage.id} value={stage.code}>
                            {stage.custom_name || (isDefault ? (t(`crm_stage_${stage.code}`) || stage.name) : stage.name)}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <>
                        <SelectItem value="new">{t('crm_stage_new') || t('new')}</SelectItem>
                        <SelectItem value="contacted">{t('crm_stage_contacted') || t('contacted')}</SelectItem>
                        <SelectItem value="in_progress">{t('crm_stage_in_progress') || t('in_progress')}</SelectItem>
                        <SelectItem value="qualified">{t('crm_stage_qualified') || t('qualified')}</SelectItem>
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
                    <SelectItem value="telegram">Telegram</SelectItem>
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

            {/* Schedule follow-up: a structured replacement for the
                old free-text notes textarea. If the user fills in
                date+time, a CRM activity is created on save and a
                notification fires at that moment. The comment field
                here is the activity's description, NOT the lead's
                notes column. */}
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Bell className="w-4 h-4 text-[var(--genix-blue)]" />
                {t('schedule_followup') || 'Schedule follow-up'}
                <span className="text-xs font-normal text-slate-500">
                  ({t('optional') || 'optional'})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <LabelWithHelp
                    htmlFor="followup_action"
                    label={t('action_type') || 'Action'}
                    helpText={t('help_followup_action_type')}
                  />
                  <Select
                    value={followup.action_type}
                    onValueChange={(v) => handleFollowupChange('action_type', v)}
                  >
                    <SelectTrigger id="followup_action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">
                        <span className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" />
                          {t('action_call') || 'Call'}
                        </span>
                      </SelectItem>
                      <SelectItem value="meeting">
                        <span className="flex items-center gap-2">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {t('action_meeting') || 'Meeting'}
                        </span>
                      </SelectItem>
                      <SelectItem value="email">
                        <span className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          {t('action_email') || 'Email'}
                        </span>
                      </SelectItem>
                      <SelectItem value="follow_up">
                        {t('action_other') || 'Other'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <LabelWithHelp
                    htmlFor="followup_date"
                    label={t('followup_date') || 'Date'}
                    helpText={t('help_followup_date')}
                  />
                  <Input
                    id="followup_date"
                    type="date"
                    value={followup.date}
                    onChange={(e) => handleFollowupChange('date', e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <LabelWithHelp
                    htmlFor="followup_time"
                    label={t('followup_time') || 'Time'}
                    helpText={t('help_followup_time')}
                  />
                  <Input
                    id="followup_time"
                    type="time"
                    value={followup.time}
                    onChange={(e) => handleFollowupChange('time', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <LabelWithHelp
                  htmlFor="followup_comment"
                  label={t('followup_comment') || 'Comment'}
                  helpText={t('help_followup_comment')}
                />
                <Textarea
                  id="followup_comment"
                  value={followup.comment}
                  onChange={(e) => handleFollowupChange('comment', e.target.value)}
                  placeholder={t('followup_comment_placeholder') || 'What do you want to discuss?'}
                  rows={2}
                />
              </div>

              {followup.date && followup.time && (
                <div className="text-xs text-slate-600 bg-white rounded px-3 py-2 border border-slate-200">
                  {t('reminder_will_fire') || 'A reminder will fire on'}{' '}
                  <span className="font-semibold">
                    {formatDateTime(`${formatDate(followup.date)}T${followup.time}:00`)}
                  </span>
                </div>
              )}
            </div>

            {/* Change history was moved to the Lead Detail modal
                (read-only view) so users see edit history before
                making changes rather than after opening the editor. */}

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
