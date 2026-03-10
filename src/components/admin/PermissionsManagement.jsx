
import React, { useState, useEffect } from 'react';
import { RolePermission } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Check, X, Eye, Edit3, Trash2, Plus, FileCheck, Download,
  Sparkles, Copy, RefreshCw, Search, AlertTriangle, Users, Lock
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { toast } from 'sonner';

const ENTITY_KEYS = [
  'Customer', 'Lead', 'Opportunity', 'InventoryItem', 'StockMovement',
  'FinancialTransaction', 'Invoice', 'JournalEntry', 'Employee', 'Payroll',
  'PurchaseOrder', 'SalesOrder', 'ProductionOrder', 'Project', 'Contract',
  'BillOfMaterials', 'WorkCenter', 'QualityCheck', 'FixedAsset', 'ExpenseClaim'
];

const ENTITY_TRANSLATION_MAP = {
  'Customer': 'entity_customer',
  'Lead': 'entity_lead',
  'Opportunity': 'entity_opportunity',
  'InventoryItem': 'entity_inventory_item',
  'StockMovement': 'entity_stock_movement',
  'FinancialTransaction': 'entity_financial_transaction',
  'Invoice': 'entity_invoice',
  'JournalEntry': 'entity_journal_entry',
  'Employee': 'entity_employee',
  'Payroll': 'entity_payroll',
  'PurchaseOrder': 'entity_purchase_order',
  'SalesOrder': 'entity_sales_order',
  'ProductionOrder': 'entity_production_order',
  'Project': 'entity_project',
  'Contract': 'entity_contract',
  'BillOfMaterials': 'entity_bill_of_materials',
  'WorkCenter': 'entity_work_center',
  'QualityCheck': 'entity_quality_check',
  'FixedAsset': 'entity_fixed_asset',
  'ExpenseClaim': 'entity_expense_claim'
};

export default function PermissionsManagement() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const getEntityLabel = (entityKey) => {
    const translationKey = ENTITY_TRANSLATION_MAP[entityKey];
    return translationKey ? t(translationKey) : entityKey;
  };

  const ROLES = [
    { value: 'system_admin', label: t('role_system_admin_short'), color: 'red' },
    { value: 'admin', label: t('role_administrator'), color: 'purple' },
    { value: 'manager', label: t('role_manager'), color: 'indigo' },
    { value: 'finance_manager', label: t('role_finance_manager'), color: 'emerald' },
    { value: 'sales_manager', label: t('role_sales_manager'), color: 'blue' },
    { value: 'inventory_manager', label: t('role_inventory_manager'), color: 'orange' },
    { value: 'hr_manager', label: t('role_hr_manager'), color: 'pink' },
    { value: 'user', label: t('role_user'), color: 'slate' },
    { value: 'limited_user', label: t('role_limited_user'), color: 'gray' }
  ];

  const ACCESS_LEVELS = [
    { value: 'none', label: t('access_level_none') },
    { value: 'own_only', label: t('access_level_own_only') },
    { value: 'department', label: t('access_level_department') },
    { value: 'all', label: t('access_level_all') }
  ];
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState([]);

  useEffect(() => {
    loadPermissions();
  }, [selectedRole]);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      const data = await RolePermission.filter({ role: selectedRole });
      setPermissions(data);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
    setIsLoading(false);
  };

  const getPermissionForEntity = (entityName) => {
    return permissions.find(p => p.entity_name === entityName) || {
      role: selectedRole,
      entity_name: entityName,
      can_create: false,
      can_read: false,
      can_update: false,
      can_delete: false,
      can_approve: false,
      can_export: false,
      access_level: 'own_only'
    };
  };

  const updatePermission = async (entityName, field, value) => {
    const existing = permissions.find(p => p.entity_name === entityName);

    try {
      const updateData = {
        role: selectedRole,
        entity_name: entityName,
        [field]: value
      };

      if (existing) {
        await RolePermission.update(existing.id, { [field]: value });
      } else {
        await RolePermission.create(updateData);
      }

      await loadPermissions();
    } catch (error) {
      console.error('Error updating permission:', error);
    }
  };

  const applyTemplate = async (templateName) => {
    setIsSaving(true);

    try {
      // AI-powered template application
      const prompt = `Generate optimal permissions for role "${selectedRole}" using ${templateName} best practices.
      Consider security, usability, and enterprise standards.
      Return JSON array with entity permissions.`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            permissions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity_name: { type: "string" },
                  can_create: { type: "boolean" },
                  can_read: { type: "boolean" },
                  can_update: { type: "boolean" },
                  can_delete: { type: "boolean" },
                  can_approve: { type: "boolean" },
                  can_export: { type: "boolean" },
                  access_level: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Apply AI-recommended permissions
      for (const perm of response.permissions) {
        const existing = permissions.find(p => p.entity_name === perm.entity_name);

        if (existing) {
          await RolePermission.update(existing.id, {
            ...perm,
            template_source: templateName,
            ai_recommended: true
          });
        } else {
          await RolePermission.create({
            role: selectedRole,
            ...perm,
            template_source: templateName,
            ai_recommended: true
          });
        }
      }

      await loadPermissions();
      toast.success(`${PERMISSION_TEMPLATES[templateName].name} template applied successfully!`);
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Failed to apply template');
    }

    setIsSaving(false);
  };

  const generateAIRecommendations = async () => {
    setShowAIRecommendations(true);

    try {
      const prompt = `Analyze current permissions for role "${selectedRole}" and suggest improvements based on:
      1. Security best practices (principle of least privilege)
      2. Common ERP patterns (Odoo, SAP, Oracle, Microsoft Dynamics)
      3. Role responsibilities and typical workflows
      4. Data segregation requirements

      Current permissions: ${JSON.stringify(permissions)}

      Provide specific recommendations with reasoning.`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  recommendation: { type: "string" },
                  reasoning: { type: "string" },
                  priority: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAiRecommendations(response.recommendations);
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
    }
  };

  const copyRolePermissions = async (fromRole) => {
    if (!confirm(`Copy permissions from ${fromRole} to ${selectedRole}?`)) return;

    setIsSaving(true);
    try {
      const sourcePermissions = await RolePermission.filter({ role: fromRole });

      for (const perm of sourcePermissions) {
        const existing = permissions.find(p => p.entity_name === perm.entity_name);
        const permData = {
          role: selectedRole,
          entity_name: perm.entity_name,
          can_create: perm.can_create,
          can_read: perm.can_read,
          can_update: perm.can_update,
          can_delete: perm.can_delete,
          can_approve: perm.can_approve,
          can_export: perm.can_export,
          access_level: perm.access_level
        };

        if (existing) {
          await RolePermission.update(existing.id, permData);
        } else {
          await RolePermission.create(permData);
        }
      }

      await loadPermissions();
      toast.success('Permissions copied successfully!');
    } catch (error) {
      console.error('Error copying permissions:', error);
      toast.error('Failed to copy permissions');
    }
    setIsSaving(false);
  };

  const filteredEntities = ENTITY_KEYS.filter(entity =>
    getEntityLabel(entity).toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role) => {
    return ROLES.find(r => r.value === role)?.color || 'slate';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{t('permissions_matrix')}</h3>
          <p className="text-sm text-slate-600 mt-1">
            {t('permissions_matrix_desc')}
          </p>
        </div>
        <Button
          onClick={generateAIRecommendations}
          className="bg-gradient-to-r from-purple-600 to-indigo-600"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {t('ai_recommendations')}
        </Button>
      </div>

      {/* Role Selection & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <Shield className={`w-4 h-4 text-${role.color}-600`} />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select onValueChange={copyRolePermissions}>
              <SelectTrigger className="w-[200px]">
                <Copy className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('copy_from_role')} />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter(r => r.value !== selectedRole).map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t('search_entities')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      {showAIRecommendations && aiRecommendations.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              {t('ai_security_recommendations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiRecommendations.map((rec, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <Badge className={
                      rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                      rec.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }>
                      {rec.priority}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1">{rec.entity}</p>
                      <p className="text-sm text-slate-700 mb-2">{rec.recommendation}</p>
                      <p className="text-xs text-slate-500">{rec.reasoning}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('entity_permissions_for')} {ROLES.find(r => r.value === selectedRole)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t('entity')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      <Plus className="w-4 h-4 mx-auto" />
                      <div className="text-[10px] mt-1">{t('create')}</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      <Eye className="w-4 h-4 mx-auto" />
                      <div className="text-[10px] mt-1">{t('read')}</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      <Edit3 className="w-4 h-4 mx-auto" />
                      <div className="text-[10px] mt-1">{t('update')}</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      <Trash2 className="w-4 h-4 mx-auto" />
                      <div className="text-[10px] mt-1">{t('delete')}</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      <FileCheck className="w-4 h-4 mx-auto" />
                      <div className="text-[10px] mt-1">{t('approve')}</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      <Download className="w-4 h-4 mx-auto" />
                      <div className="text-[10px] mt-1">{t('export')}</div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t('access_level')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntities.map((entity) => {
                    const perm = getPermissionForEntity(entity);
                    return (
                      <tr key={entity} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {getEntityLabel(entity)}
                          {perm.ai_recommended && (
                            <Badge className="ml-2 bg-purple-100 text-purple-700 text-[10px]">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={perm.can_create}
                            onCheckedChange={(checked) => updatePermission(entity, 'can_create', checked)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={perm.can_read}
                            onCheckedChange={(checked) => updatePermission(entity, 'can_read', checked)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={perm.can_update}
                            onCheckedChange={(checked) => updatePermission(entity, 'can_update', checked)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={perm.can_delete}
                            onCheckedChange={(checked) => updatePermission(entity, 'can_delete', checked)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={perm.can_approve}
                            onCheckedChange={(checked) => updatePermission(entity, 'can_approve', checked)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={perm.can_export}
                            onCheckedChange={(checked) => updatePermission(entity, 'can_export', checked)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={perm.access_level}
                            onValueChange={(value) => updatePermission(entity, 'access_level', value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCESS_LEVELS.map(level => (
                                <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Lock className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="font-semibold text-slate-900">{t('enterprise_grade_security')}</p>
              <p className="text-sm text-slate-600">
                {t('enterprise_grade_security_desc')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
