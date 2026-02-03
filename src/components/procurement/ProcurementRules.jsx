import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  ArrowRight,
  GripVertical,
} from "lucide-react";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { procurementService } from "@/api/services/procurement";
import { useToast } from "@/components/ui/use-toast";

const RULE_TYPES = [
  { value: "auto_approve", label: "Auto Approve", icon: CheckCircle2, color: "green" },
  { value: "require_approval", label: "Require Approval", icon: Users, color: "blue" },
  { value: "route_to_approver", label: "Route to Approver", icon: ArrowRight, color: "purple" },
  { value: "budget_check", label: "Budget Check", icon: AlertTriangle, color: "yellow" },
  { value: "vendor_check", label: "Vendor Check", icon: Shield, color: "orange" },
];

const DOCUMENT_TYPES = [
  { value: "both", label: "Both PO & PR" },
  { value: "purchase_order", label: "Purchase Orders Only" },
  { value: "purchase_requisition", label: "Purchase Requisitions Only" },
];

const ACTION_TYPES = [
  { value: "auto_approve", label: "Auto Approve" },
  { value: "route", label: "Route to Approvers" },
  { value: "block", label: "Block" },
  { value: "warn", label: "Warn" },
];

const APPROVAL_TYPES = [
  { value: "sequential", label: "Sequential (One after another)" },
  { value: "parallel", label: "Parallel (All at once)" },
  { value: "any_one", label: "Any One (First to approve)" },
];

export default function ProcurementRules({ users = [] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rule_type: "auto_approve",
    document_type: "both",
    priority: 100,
    is_active: true,
    // Conditions
    amount_min: "",
    amount_max: "",
    vendor_ids: [],
    // Actions
    action: "auto_approve",
    approver_ids: [],
    approval_type: "sequential",
    message: "",
  });

  // Load rules
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const data = await procurementService.listProcurementRules();
      setRules(data || []);
    } catch (error) {
      toast({
        title: t("error"),
        description: t("failedToLoadRules") || "Failed to load rules",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const matchesSearch =
        rule.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || rule.rule_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [rules, searchQuery, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: rules.length,
      active: rules.filter((r) => r.is_active).length,
      autoApprove: rules.filter((r) => r.rule_type === "auto_approve").length,
      routing: rules.filter((r) => r.rule_type === "route_to_approver").length,
    };
  }, [rules]);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({
        title: t("error"),
        description: t("ruleNameRequired") || "Rule name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build conditions object
      const conditions = {};
      if (formData.amount_min) conditions.amount_min = parseFloat(formData.amount_min);
      if (formData.amount_max) conditions.amount_max = parseFloat(formData.amount_max);
      if (formData.vendor_ids?.length > 0) conditions.vendor_ids = formData.vendor_ids;

      // Build actions object
      const actions = {
        action: formData.action,
      };
      if (formData.action === "route" && formData.approver_ids?.length > 0) {
        actions.approver_ids = formData.approver_ids;
        actions.approval_type = formData.approval_type;
      }
      if (formData.message) actions.message = formData.message;

      const ruleData = {
        name: formData.name,
        description: formData.description || "",
        rule_type: formData.rule_type,
        document_type: formData.document_type,
        priority: parseInt(formData.priority) || 100,
        is_active: formData.is_active,
        conditions: conditions,
        actions: actions,
      };

      if (editingRule) {
        await procurementService.updateProcurementRule(editingRule.id, ruleData);
        toast({
          title: t("success"),
          description: t("ruleUpdated") || "Rule updated successfully",
        });
      } else {
        await procurementService.createProcurementRule(ruleData);
        toast({
          title: t("success"),
          description: t("ruleCreated") || "Rule created successfully",
        });
      }

      await loadRules();
      resetForm();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("failedToSaveRule") || "Failed to save rule",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    const conditions = rule.conditions || {};
    const actions = rule.actions || {};

    setFormData({
      name: rule.name || "",
      description: rule.description || "",
      rule_type: rule.rule_type || "auto_approve",
      document_type: rule.document_type || "both",
      priority: rule.priority || 100,
      is_active: rule.is_active !== false,
      amount_min: conditions.amount_min?.toString() || "",
      amount_max: conditions.amount_max?.toString() || "",
      vendor_ids: conditions.vendor_ids || [],
      action: actions.action || "auto_approve",
      approver_ids: actions.approver_ids || [],
      approval_type: actions.approval_type || "sequential",
      message: actions.message || "",
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;

    try {
      await procurementService.deleteProcurementRule(ruleToDelete.id);
      toast({
        title: t("success"),
        description: t("ruleDeleted") || "Rule deleted successfully",
      });
      await loadRules();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("failedToDeleteRule") || "Failed to delete rule",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirm(false);
      setRuleToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      rule_type: "auto_approve",
      document_type: "both",
      priority: 100,
      is_active: true,
      amount_min: "",
      amount_max: "",
      vendor_ids: [],
      action: "auto_approve",
      approver_ids: [],
      approval_type: "sequential",
      message: "",
    });
    setEditingRule(null);
    setShowForm(false);
  };

  const getRuleTypeInfo = (type) => {
    return RULE_TYPES.find((rt) => rt.value === type) || RULE_TYPES[0];
  };

  const formatAmount = (amount) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("uz-UZ").format(amount) + " UZS";
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalRules") || "Total Rules"}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("activeRules") || "Active Rules"}</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("autoApproveRules") || "Auto-Approve"}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.autoApprove}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("routingRules") || "Routing Rules"}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.routing}</p>
              </div>
              <ArrowRight className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchRules") || "Search rules..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("allTypes") || "All Types"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allTypes") || "All Types"}</SelectItem>
                  {RULE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(type.value) || type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("addRule") || "Add Rule"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">{t("priority") || "Priority"}</TableHead>
                <TableHead>{t("name") || "Name"}</TableHead>
                <TableHead>{t("type") || "Type"}</TableHead>
                <TableHead>{t("documentType") || "Applies To"}</TableHead>
                <TableHead>{t("conditions") || "Conditions"}</TableHead>
                <TableHead>{t("action") || "Action"}</TableHead>
                <TableHead>{t("status") || "Status"}</TableHead>
                <TableHead className="text-right">{t("actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t("noRulesFound") || "No rules found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => {
                  const typeInfo = getRuleTypeInfo(rule.rule_type);
                  const TypeIcon = typeInfo.icon;
                  const conditions = rule.conditions || {};
                  const actions = rule.actions || {};

                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge variant="outline">{rule.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {rule.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className={`h-4 w-4 text-${typeInfo.color}-500`} />
                          <span>{t(rule.rule_type) || typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {rule.document_type === "both"
                            ? t("bothPOPR") || "Both"
                            : rule.document_type === "purchase_order"
                            ? t("purchaseOrders") || "PO"
                            : t("purchaseRequisitions") || "PR"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {conditions.amount_min != null && (
                            <span>Min: {formatAmount(conditions.amount_min)}</span>
                          )}
                          {conditions.amount_min != null && conditions.amount_max != null && " - "}
                          {conditions.amount_max != null && (
                            <span>Max: {formatAmount(conditions.amount_max)}</span>
                          )}
                          {!conditions.amount_min && !conditions.amount_max && (
                            <span className="text-muted-foreground">{t("noConditions") || "No conditions"}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            actions.action === "auto_approve"
                              ? "default"
                              : actions.action === "block"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {t(actions.action) || actions.action}
                        </Badge>
                        {actions.approver_ids?.length > 0 && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({actions.approver_ids.length} {t("approvers") || "approvers"})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? t("active") || "Active" : t("inactive") || "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRule(rule);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRuleToDelete(rule);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? t("editRule") || "Edit Rule" : t("createRule") || "Create Rule"}
            </DialogTitle>
            <DialogDescription>
              {t("ruleFormDescription") || "Configure procurement rule conditions and actions"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("ruleName") || "Rule Name"} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("enterRuleName") || "Enter rule name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("priority") || "Priority"}</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("priorityHint") || "Lower number = higher priority"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("description") || "Description"}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("enterDescription") || "Enter description"}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("ruleType") || "Rule Type"}</Label>
                  <Select
                    value={formData.rule_type}
                    onValueChange={(value) => setFormData({ ...formData, rule_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {t(type.value) || type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("documentType") || "Document Type"}</Label>
                  <Select
                    value={formData.document_type}
                    onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {t(type.value) || type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">{t("ruleActive") || "Rule is active"}</Label>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-4">
              <h3 className="font-semibold">{t("conditions") || "Conditions"}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("minimumAmount") || "Minimum Amount (UZS)"}</Label>
                  <Input
                    type="number"
                    value={formData.amount_min}
                    onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("maximumAmount") || "Maximum Amount (UZS)"}</Label>
                  <Input
                    type="number"
                    value={formData.amount_max}
                    onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })}
                    placeholder={t("unlimited") || "Unlimited"}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <h3 className="font-semibold">{t("actions") || "Actions"}</h3>
              <div className="space-y-2">
                <Label>{t("actionType") || "Action Type"}</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value) => setFormData({ ...formData, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(type.value) || type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.action === "route" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("approvalType") || "Approval Type"}</Label>
                    <Select
                      value={formData.approval_type}
                      onValueChange={(value) => setFormData({ ...formData, approval_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPROVAL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {t(type.value) || type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("selectApprovers") || "Select Approvers"}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("approversHint") || "Select users who can approve documents matching this rule"}
                    </p>
                    {users.length > 0 ? (
                      <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                        {users.map((user) => (
                          <label
                            key={user.id}
                            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.approver_ids.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    approver_ids: [...formData.approver_ids, user.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    approver_ids: formData.approver_ids.filter((id) => id !== user.id),
                                  });
                                }
                              }}
                              className="rounded"
                            />
                            <span>{user.full_name || user.email}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t("noUsersAvailable") || "No users available. Users will be loaded from admin settings."}
                      </p>
                    )}
                  </div>
                </>
              )}

              {(formData.action === "block" || formData.action === "warn") && (
                <div className="space-y-2">
                  <Label>{t("message") || "Message"}</Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t("enterMessage") || "Enter message to display"}
                    rows={2}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              {t("cancel") || "Cancel"}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : null}
              {editingRule ? t("update") || "Update" : t("create") || "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("ruleDetails") || "Rule Details"}</DialogTitle>
          </DialogHeader>
          {selectedRule && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t("name") || "Name"}</Label>
                  <p className="font-medium">{selectedRule.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("priority") || "Priority"}</Label>
                  <p className="font-medium">{selectedRule.priority}</p>
                </div>
              </div>
              {selectedRule.description && (
                <div>
                  <Label className="text-muted-foreground">{t("description") || "Description"}</Label>
                  <p>{selectedRule.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t("ruleType") || "Rule Type"}</Label>
                  <p className="font-medium">{t(selectedRule.rule_type) || selectedRule.rule_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("documentType") || "Document Type"}</Label>
                  <p className="font-medium">{t(selectedRule.document_type) || selectedRule.document_type}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">{t("conditions") || "Conditions"}</Label>
                <pre className="bg-muted p-2 rounded text-sm mt-1 overflow-auto">
                  {JSON.stringify(selectedRule.conditions, null, 2)}
                </pre>
              </div>
              <div>
                <Label className="text-muted-foreground">{t("actions") || "Actions"}</Label>
                <pre className="bg-muted p-2 rounded text-sm mt-1 overflow-auto">
                  {JSON.stringify(selectedRule.actions, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete") || "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteRuleConfirmation") ||
                `Are you sure you want to delete the rule "${ruleToDelete?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t("delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
