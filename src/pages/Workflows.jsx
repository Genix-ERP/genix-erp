
import React, { useState, useEffect } from "react";
import { Workflow } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Zap, 
  Search, 
  Plus, 
  DollarSign,
  TrendingUp,
  Bot
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import WorkflowForm from "@/components/workflows/WorkflowForm";
import WorkflowInsights from "@/components/workflows/WorkflowInsights";
import WorkflowCard from "@/components/workflows/WorkflowCard";
import WorkflowAIChat from "@/components/workflows/WorkflowAIChat";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState(null);

  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    loadWorkflows();
    generateInsights();
  }, []);

  useEffect(() => {
    filterWorkflows();
  }, [workflows, searchQuery, categoryFilter, statusFilter]);

  const filterWorkflows = () => {
    let filtered = workflows;

    if (searchQuery) {
      filtered = filtered.filter(workflow =>
        workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(workflow => workflow.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(workflow => workflow.status === statusFilter);
    }

    setFilteredWorkflows(filtered);
  };

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const data = await Workflow.list("-created_date");
      setWorkflows(data);
    } catch (error) {
      console.error("Error loading workflows:", error);
    }
    setIsLoading(false);
  };

  const generateInsights = async () => {
    try {
      const workflowData = await Workflow.list();
      const totalSavings = workflowData.reduce((sum, w) => sum + (w.cost_savings || 0), 0);
      const avgCompletionTime = workflowData.reduce((sum, w) => sum + (w.avg_completion_time || 0), 0) / (workflowData.length || 1); // Avoid division by zero
      const avgSuccessRate = workflowData.reduce((sum, w) => sum + (w.success_rate || 0), 0) / (workflowData.length || 1); // Avoid division by zero

      const insights = await InvokeLLM({
        prompt: `Analyze workflow automation data and provide strategic insights:
        - Total workflows: ${workflowData.length}
        - Total monthly savings: $${totalSavings.toLocaleString()}
        - Average completion time: ${avgCompletionTime.toFixed(1)} hours
        - Average success rate: ${avgSuccessRate.toFixed(1)}%
        - Active workflows: ${workflowData.filter(w => w.status === 'active').length}
        - Workflow categories: ${[...new Set(workflowData.map(w => w.category))].join(', ')}
        
        Provide 3 actionable insights for workflow optimization, automation opportunities, and efficiency improvements.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        }
      });
      setInsights(insights.insights);
    } catch (error) {
      console.error("Error generating insights:", error);
    }
  };

  const handleSave = async (workflowData) => {
    try {
      if (editingWorkflow) {
        await Workflow.update(editingWorkflow.id, workflowData);
      } else {
        await Workflow.create(workflowData);
      }
      loadWorkflows();
      setShowForm(false);
      setEditingWorkflow(null);
    } catch (error) {
      console.error("Error saving workflow:", error);
    }
  };

  const handleStatusToggle = async (workflow) => {
    try {
      const newStatus = workflow.status === "active" ? "paused" : "active";
      await Workflow.update(workflow.id, { ...workflow, status: newStatus });
      loadWorkflows();
    } catch (error) {
      console.error("Error updating workflow status:", error);
    }
  };

  const handleDeleteClick = (workflow) => {
    setWorkflowToDelete(workflow);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!workflowToDelete) return;

    try {
      await Workflow.delete(workflowToDelete.id);
      loadWorkflows();
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    } catch (error) {
      console.error("Error deleting workflow:", error);
    }
  };

  const calculateMetrics = () => {
    const totalSavings = workflows.reduce((sum, w) => sum + (w.cost_savings || 0), 0);
    const activeWorkflows = workflows.filter(w => w.status === "active").length;
    const avgSuccessRate = workflows.length > 0 
      ? workflows.reduce((sum, w) => sum + (w.success_rate || 0), 0) / workflows.length 
      : 0;
    const totalAutomations = workflows.filter(w => w.automation_level === "fully_automated").length;
    
    return {
      totalSavings,
      activeWorkflows,
      avgSuccessRate,
      totalAutomations
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header with Action Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditingWorkflow(null);
              setShowForm(true);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{t('create_workflow')}</span>
          </Button>
        </div>

        {/* Metrics Cards - Fully Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 truncate">{t('monthly_savings')}</p>
                  <p className="text-2xl font-bold text-green-600 truncate">${metrics.totalSavings.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 truncate">{t('active_workflows')}</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.activeWorkflows}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 truncate">{t('success_rate')}</p>
                  <p className="text-2xl font-bold text-purple-600">{metrics.avgSuccessRate.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 truncate">{t('fully_automated')}</p>
                  <p className="text-2xl font-bold text-orange-600">{metrics.totalAutomations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search - Fully Responsive */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder={t('search_workflows_placeholder') || "Search workflows..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder={t('category_filter_placeholder') || "Filter by category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_categories') || "All Categories"}</SelectItem>
                    <SelectItem value="hr">{t('category_hr') || "HR"}</SelectItem>
                    <SelectItem value="procurement">{t('category_procurement') || "Procurement"}</SelectItem>
                    <SelectItem value="customer_support">{t('category_customer_support') || "Customer Support"}</SelectItem>
                    <SelectItem value="sales">{t('category_sales') || "Sales"}</SelectItem>
                    <SelectItem value="inventory">{t('category_inventory') || "Inventory"}</SelectItem>
                    <SelectItem value="finance">{t('category_finance') || "Finance"}</SelectItem>
                    <SelectItem value="marketing">{t('category_marketing') || "Marketing"}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder={t('status_filter_placeholder') || "Filter by status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status') || "All Status"}</SelectItem>
                    <SelectItem value="active">{t('status_active') || "Active"}</SelectItem>
                    <SelectItem value="paused">{t('status_paused') || "Paused"}</SelectItem>
                    <SelectItem value="draft">{t('status_draft') || "Draft"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Grid - Fully Responsive */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onEdit={(workflow) => {
                setEditingWorkflow(workflow);
                setShowForm(true);
              }}
              onToggleStatus={handleStatusToggle}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>

        {filteredWorkflows.length === 0 && !isLoading && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-8 sm:p-12 text-center">
              <Zap className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg sm:text-xl font-semibold text-slate-600 mb-2">{t('no_workflows_found') || "No workflows found"}</h3>
              <p className="text-sm sm:text-base text-slate-500 mb-6">{t('no_workflows_message') || "Start automating your processes by creating your first workflow"}</p>
              <Button
                onClick={() => {
                  setEditingWorkflow(null);
                  setShowForm(true);
                }}
                className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('create_first_workflow') || "Create First Workflow"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Workflow Form */}
        {showForm && (
          <WorkflowForm
            workflow={editingWorkflow}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingWorkflow(null);
            }}
          />
        )}
        
        {/* AI Insights - Moved to bottom */}
        {insights && <WorkflowInsights insights={insights} />}
      </div>

      {/* AI Chat Assistant */}
      <WorkflowAIChat onWorkflowUpdate={loadWorkflows} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_workflow') || 'Delete Workflow'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_workflow_confirmation') || 'Are you sure you want to delete this workflow? This action cannot be undone.'}
              {workflowToDelete && (
                <span className="block mt-2 font-medium text-slate-900">
                  {workflowToDelete.name}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
