import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Workflow as WorkflowIcon, ShieldAlert, Zap, Plus, History, MoreHorizontal,
  Pencil, Copy, FlaskConical, Trash2, PauseCircle, CheckCircle2, XCircle, MinusCircle, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useAuth } from "@/components/contexts/AuthContext";
import workflowsService from "@/api/services/workflows";
import RuleBuilderDialog from "@/components/workflows/RuleBuilderDialog";
import ExecutionLog from "@/components/workflows/ExecutionLog";
import {
  TRIGGER_EVENTS, EVENT_BY_VALUE, EVENT_CATEGORIES, CATEGORY_LABEL_KEYS, ruleSummary, ACTION_TYPES,
} from "@/components/workflows/ruleCatalog";

const LAST_STATUS_DOT = {
  success: "bg-emerald-500",
  partial: "bg-amber-500",
  failed: "bg-red-500",
  skipped_conditions: "bg-slate-300",
};

export default function Workflows() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { user, isSiteAdmin, isOwner } = useAuth();
  const navigate = useNavigate();

  const hasAdminAccess = useMemo(() => {
    if (!user) return false;
    return isSiteAdmin() || isOwner() || user.role === "admin" || user.role === "system_admin";
  }, [user, isSiteAdmin, isOwner]);

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rules");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testingRule, setTestingRule] = useState(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const data = await workflowsService.listRules();
      setRules(data || []);
    } catch {
      toast.error(t("loading_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!hasAdminAccess) {
      navigate("/");
      return;
    }
    fetchRules();
  }, [hasAdminAccess, navigate, fetchRules]);

  const handleToggle = async (rule, isActive) => {
    // optimistic switch
    setRules((prev) => prev.map((r) => (r.id === rule.id
      ? { ...r, is_active: isActive, auto_paused_at: null, paused_reason: null }
      : r)));
    try {
      await workflowsService.toggleRule(rule.id, isActive);
    } catch {
      toast.error(t("wf_save_failed"));
      fetchRules();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await workflowsService.deleteRule(deleteTarget.id);
      toast.success(t("wf_rule_deleted"));
      setDeleteTarget(null);
      fetchRules();
    } catch {
      toast.error(t("wf_delete_failed"));
    }
  };

  const handleDuplicate = async (rule) => {
    try {
      await workflowsService.duplicateRule(rule.id);
      toast.success(t("wf_rule_duplicated"));
      fetchRules();
    } catch {
      toast.error(t("wf_save_failed"));
    }
  };

  const handleTest = async (rule) => {
    setTestingRule(rule);
    setTestResult(null);
    try {
      const result = await workflowsService.testRule(rule.id);
      setTestResult(result);
    } catch {
      toast.error(t("wf_test_failed"));
      setTestingRule(null);
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setBuilderOpen(true);
  };
  const openEdit = (rule) => {
    setEditingRule(rule);
    setBuilderOpen(true);
  };

  if (!hasAdminAccess) {
    return (
      <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-md mx-auto mt-20">
          <Card className="border-red-200">
            <CardContent className="p-8 text-center">
              <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">{t("access_denied")}</h2>
              <p className="text-slate-600 mb-6">{t("workflows_admin_only")}</p>
              <Button onClick={() => navigate("/")} variant="outline">
                {t("go_to_dashboard")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const groupedCatalog = EVENT_CATEGORIES
    .map((cat) => ({ category: cat, events: TRIGGER_EVENTS.filter((e) => e.category === cat) }))
    .filter((g) => g.events.length > 0);

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] flex items-center justify-center flex-shrink-0 shadow-lg">
              <WorkflowIcon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[var(--genix-navy)]">{t("automation_rules")}</h1>
              <p className="text-sm text-slate-500 mt-1">{t("automation_rules_desc")}</p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> {t("add_rule")}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="rules" className="gap-1.5">
              <Zap className="w-4 h-4" /> {t("automation_rules")}
              {rules.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">{rules.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <History className="w-4 h-4" /> {t("execution_logs")}
            </TabsTrigger>
          </TabsList>

          {/* ── Rules tab ── */}
          <TabsContent value="rules" className="mt-4 space-y-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : rules.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Zap className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-700 font-medium">{t("no_rules_yet")}</p>
                  <p className="text-sm text-slate-400 mt-1 mb-6">{t("no_rules_desc")}</p>
                  <Button onClick={openCreate} variant="outline" className="gap-1.5">
                    <Plus className="w-4 h-4" /> {t("wf_create_first_rule")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => {
                  const event = EVENT_BY_VALUE[rule.trigger_event];
                  const EventIcon = event?.icon || Zap;
                  const autoPaused = !!rule.auto_paused_at && !rule.is_active;
                  return (
                    <div
                      key={rule.id}
                      className={`rounded-xl border bg-white px-4 py-3.5 flex items-center gap-4 transition-all hover:shadow-sm ${autoPaused ? "border-amber-300 bg-amber-50/40" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rule.is_active ? "bg-blue-50 text-[var(--genix-blue)]" : "bg-slate-100 text-slate-400"}`}>
                        <EventIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openEdit(rule)}
                            className="font-semibold text-slate-800 hover:text-[var(--genix-blue)] truncate text-left"
                          >
                            {rule.name}
                          </button>
                          {event?.scheduled && (
                            <Badge variant="outline" className="text-[10px] h-5 text-slate-500">
                              {t("wf_scheduled_badge")}
                            </Badge>
                          )}
                          {autoPaused && (
                            <Badge variant="outline" className="text-[10px] h-5 gap-1 border-amber-300 text-amber-700 bg-amber-50">
                              <PauseCircle className="w-3 h-3" /> {t("wf_auto_paused")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{ruleSummary(rule, t)}</p>
                      </div>

                      <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 shrink-0 w-36 justify-end">
                        {rule.last_status && (
                          <span className={`w-2 h-2 rounded-full ${LAST_STATUS_DOT[rule.last_status] || "bg-slate-300"}`} />
                        )}
                        <span>
                          {rule.trigger_count > 0
                            ? `${rule.trigger_count}× · ${rule.last_triggered_at ? format(new Date(rule.last_triggered_at), "dd.MM HH:mm") : ""}`
                            : t("wf_never_run")}
                        </span>
                      </div>

                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(v) => handleToggle(rule, v)}
                        className="shrink-0"
                      />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(rule)} className="gap-2">
                            <Pencil className="w-4 h-4" /> {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTest(rule)} className="gap-2">
                            <FlaskConical className="w-4 h-4" /> {t("wf_test_rule")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(rule)} className="gap-2">
                            <Copy className="w-4 h-4" /> {t("wf_duplicate")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(rule)}
                            className="gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" /> {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Trigger-event catalog reference */}
            <Card>
              <button
                type="button"
                onClick={() => setCatalogOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{t("available_events")}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t("available_events_desc")}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${catalogOpen ? "rotate-180" : ""}`} />
              </button>
              {catalogOpen && (
                <CardContent className="pt-0 pb-5">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {groupedCatalog.flatMap((group) => group.events.map((e) => {
                      const Icon = e.icon;
                      return (
                        <div key={e.value} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                          <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">{t(e.labelKey)}</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {t(CATEGORY_LABEL_KEYS[group.category])}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{t(e.descKey)}</div>
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* ── Logs tab ── */}
          <TabsContent value="logs" className="mt-4">
            <ExecutionLog rules={rules} t={t} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Rule builder */}
      <RuleBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        rule={editingRule}
        onSaved={fetchRules}
        t={t}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_rule_confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test (dry-run) result */}
      <Dialog open={!!testingRule} onOpenChange={(o) => { if (!o) { setTestingRule(null); setTestResult(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[var(--genix-purple)]" />
              {t("wf_test_rule")}: {testingRule?.name}
            </DialogTitle>
          </DialogHeader>
          {!testResult ? (
            <div className="py-8 text-center text-sm text-slate-400">{t("loading")}...</div>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-slate-500">{t("wf_test_hint")}</p>

              <div className={`rounded-lg px-3 py-2.5 flex items-center gap-2 text-sm font-medium ${testResult.matched ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {testResult.matched
                  ? <><CheckCircle2 className="w-4 h-4" /> {t("wf_test_would_run")}</>
                  : <><MinusCircle className="w-4 h-4" /> {t("wf_test_would_skip")}</>}
              </div>

              {(testResult.condition_results || []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("wf_if_title")}</div>
                  {testResult.condition_results.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-slate-50 px-3 py-2">
                      {c.passed
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      <span className="font-mono text-slate-700">{c.field} {c.operator} {JSON.stringify(c.expected)}</span>
                      <span className="text-slate-400 ml-auto">{t("wf_actual")}: {JSON.stringify(c.actual)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("wf_then_title")}</div>
                {(testResult.actions || []).map((a, i) => {
                  const def = ACTION_TYPES.find((d) => d.value === a.type);
                  return (
                    <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <div className="font-medium text-slate-700">{def ? t(def.labelKey) : a.type}</div>
                      {a.preview && <div className="text-slate-500 mt-0.5">{a.preview}</div>}
                      {a.error && <div className="text-red-600 font-mono mt-0.5">{a.error}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
