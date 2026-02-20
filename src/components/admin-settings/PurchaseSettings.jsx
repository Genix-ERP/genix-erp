import React, { useState, useEffect } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { SettingsSection, SettingsField, SettingsRow, SettingsToggle } from './SettingsSection';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Building, FileText, Clock, Shield, CheckCircle2, ArrowRight, Users, Percent } from 'lucide-react';
import ProcurementRules from '@/components/procurement/ProcurementRules';
import ApprovalWorkflows from '@/components/procurement/ApprovalWorkflows';
import { procurementService } from '@/api/services/procurement';
import financeService from "@/api/services/finance";

const PAYMENT_TERMS = [
  'Immediate',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90'
];

export default function PurchaseSettings() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { settings, updateSetting, resetSection } = useAdminSettings();

  const purchase = settings.purchase || {};

  const [taxRates, setTaxRates] = useState([]);
  useEffect(() => {
    financeService.listTaxRates().then(data => setTaxRates(data || [])).catch(() => {});
  }, []);

  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [showWorkflowsDialog, setShowWorkflowsDialog] = useState(false);
  const [ruleStats, setRuleStats] = useState({ total: 0, active: 0 });
  const [users, setUsers] = useState([]);

  // Load rule stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const rules = await procurementService.listProcurementRules();
        if (rules) {
          setRuleStats({
            total: rules.length,
            active: rules.filter(r => r.is_active).length
          });
        }
      } catch (error) {
        console.error('Failed to load rule stats:', error);
      }
    };
    loadStats();
  }, [showRulesDialog]); // Reload when dialog closes

  return (
    <div className="space-y-4">
      {/* Approval Workflow */}
      <SettingsSection
        title={t('approval_workflow')}
        description={t('approval_workflow_desc')}
        icon={ClipboardCheck}
        onReset={() => resetSection('purchase')}
        resetLabel={t('reset')}
      >
        <SettingsToggle
          label={t('enable_approval_workflow')}
          description={t('enable_approval_workflow_desc')}
          checked={purchase.approval?.workflow_enabled ?? false}
          onChange={(checked) => updateSetting('purchase.approval.workflow_enabled', checked)}
        />

        {purchase.approval?.workflow_enabled && (
          <div className="mt-4">
            <SettingsField label={t('approval_thresholds')} description={t('approval_thresholds_desc')}>
              <div className="space-y-3 mt-2">
                {(purchase.approval?.thresholds || []).map((threshold, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <span className="text-sm text-slate-600">{t('amount_above')}</span>
                      <Input
                        type="number"
                        min="0"
                        value={threshold.amount}
                        onChange={(e) => {
                          const newThresholds = [...(purchase.approval?.thresholds || [])];
                          newThresholds[index] = { ...newThresholds[index], amount: parseInt(e.target.value) || 0 };
                          updateSetting('purchase.approval.thresholds', newThresholds);
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-slate-600">{t('requires_approval_from')}</span>
                      <Select
                        value={threshold.approver_role}
                        onValueChange={(value) => {
                          const newThresholds = [...(purchase.approval?.thresholds || [])];
                          newThresholds[index] = { ...newThresholds[index], approver_role: value };
                          updateSetting('purchase.approval.thresholds', newThresholds);
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">{t('manager')}</SelectItem>
                          <SelectItem value="admin">{t('admin')}</SelectItem>
                          <SelectItem value="finance_manager">{t('finance_manager')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </SettingsField>
          </div>
        )}
      </SettingsSection>

      {/* Vendor Settings */}
      <SettingsSection
        title={t('vendor_settings')}
        description={t('vendor_settings_desc')}
        icon={Building}
      >
        <SettingsRow>
          <SettingsField label={t('default_vendor_payment_terms')}>
            <Select
              value={purchase.vendor?.default_payment_terms || 'Net 30'}
              onValueChange={(value) => updateSetting('purchase.vendor.default_payment_terms', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map(term => (
                  <SelectItem key={term} value={term}>{term}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>

        <div className="mt-4 space-y-3">
          <SettingsToggle
            label={t('enable_vendor_rating')}
            description={t('enable_vendor_rating_desc')}
            checked={purchase.vendor?.rating_enabled ?? true}
            onChange={(checked) => updateSetting('purchase.vendor.rating_enabled', checked)}
          />
          <SettingsToggle
            label={t('preferred_vendors_only')}
            description={t('preferred_vendors_only_desc')}
            checked={purchase.vendor?.preferred_vendors_only ?? false}
            onChange={(checked) => updateSetting('purchase.vendor.preferred_vendors_only', checked)}
          />
        </div>
      </SettingsSection>

      {/* Default Tax */}
      <SettingsSection
        title={t('default_tax_settings') || 'Default Tax'}
        description={t('default_purchase_tax_desc') || 'Default tax applied automatically to new purchase orders'}
        icon={Percent}
      >
        <SettingsRow>
          <SettingsField label={t('default_purchase_tax') || 'Default Purchase Tax'} description={t('default_purchase_tax_help') || 'This tax will be pre-filled when creating purchase orders'}>
            <Select
              value={purchase.tax?.default_tax_id || 'none'}
              onValueChange={(value) => updateSetting('purchase.tax.default_tax_id', value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select_tax') || 'Select tax'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('no_tax') || 'No tax'}</SelectItem>
                {taxRates.filter(tr => tr.tax_type === 'purchase' || !tr.tax_type).map(tr => (
                  <SelectItem key={tr.id} value={tr.id}>
                    {tr.name} ({tr.rate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* RFQ Settings */}
      <SettingsSection
        title={t('rfq_settings')}
        description={t('rfq_settings_desc')}
        icon={FileText}
      >
        <SettingsRow>
          <SettingsField label={t('rfq_validity_days')}>
            <Input
              type="number"
              min="1"
              max="90"
              value={purchase.rfq?.validity_days || 15}
              onChange={(e) => updateSetting('purchase.rfq.validity_days', parseInt(e.target.value) || 15)}
            />
          </SettingsField>
        </SettingsRow>

        <div className="mt-4">
          <SettingsToggle
            label={t('auto_create_po_from_rfq')}
            description={t('auto_create_po_from_rfq_desc')}
            checked={purchase.rfq?.auto_create_po ?? false}
            onChange={(checked) => updateSetting('purchase.rfq.auto_create_po', checked)}
          />
        </div>
      </SettingsSection>

      {/* Lead Time Settings */}
      <SettingsSection
        title={t('lead_time_settings')}
        description={t('lead_time_settings_desc')}
        icon={Clock}
      >
        <SettingsRow>
          <SettingsField label={t('default_lead_time_days')}>
            <Input
              type="number"
              min="1"
              max="365"
              value={purchase.lead_time?.default_days || 7}
              onChange={(e) => updateSetting('purchase.lead_time.default_days', parseInt(e.target.value) || 7)}
            />
          </SettingsField>
        </SettingsRow>
      </SettingsSection>

      {/* Blanket Orders */}
      <SettingsSection
        title={t('blanket_orders')}
        description={t('blanket_orders_desc')}
        icon={FileText}
      >
        <SettingsToggle
          label={t('enable_blanket_orders')}
          description={t('enable_blanket_orders_desc')}
          checked={purchase.blanket_orders?.enabled ?? false}
          onChange={(checked) => updateSetting('purchase.blanket_orders.enabled', checked)}
        />
      </SettingsSection>

      {/* Procurement Rules Engine */}
      <SettingsSection
        title={t('procurement_rules') || 'Procurement Rules'}
        description={t('procurement_rules_desc') || 'Configure approval rules, auto-approval thresholds, and routing'}
        icon={Shield}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{t('configured_rules') || 'Configured Rules'}</span>
              </div>
              <Badge variant="secondary">{ruleStats.total} {t('total') || 'total'}</Badge>
              <Badge variant="default">{ruleStats.active} {t('active') || 'active'}</Badge>
            </div>
            <Button onClick={() => setShowRulesDialog(true)}>
              {t('manage_rules') || 'Manage Rules'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                <span className="font-medium">{t('my_approvals') || 'My Pending Approvals'}</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowWorkflowsDialog(true)}>
              {t('view_approvals') || 'View Approvals'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{t('auto_approve') || 'Auto-Approve'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('auto_approve_desc') || 'Automatically approve orders below threshold'}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">{t('multi_level_routing') || 'Multi-Level Routing'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('multi_level_routing_desc') || 'Route to different approvers based on amount'}
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">{t('vendor_control') || 'Vendor Control'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('vendor_control_desc') || 'Enforce vendor approval requirements'}
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Procurement Rules Dialog */}
      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('procurement_rules') || 'Procurement Rules'}</DialogTitle>
          </DialogHeader>
          <ProcurementRules users={users} />
        </DialogContent>
      </Dialog>

      {/* Approval Workflows Dialog */}
      <Dialog open={showWorkflowsDialog} onOpenChange={setShowWorkflowsDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('my_approvals') || 'My Pending Approvals'}</DialogTitle>
          </DialogHeader>
          <ApprovalWorkflows />
        </DialogContent>
      </Dialog>
    </div>
  );
}
