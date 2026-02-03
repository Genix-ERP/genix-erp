import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Search,
  Eye,
  RefreshCw,
  AlertTriangle,
  User,
  Building2,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { procurementService } from "@/api/services/procurement";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
};

const DOCUMENT_TYPE_LABELS = {
  purchase_order: "Purchase Order",
  purchase_requisition: "Purchase Requisition",
};

export default function ApprovalWorkflows() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [showDetails, setShowDetails] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowDetails, setWorkflowDetails] = useState(null);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load pending approvals
  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    setIsLoading(true);
    try {
      const data = await procurementService.getMyPendingApprovals();
      setPendingApprovals(data || []);
    } catch (error) {
      toast({
        title: t("error"),
        description: t("failedToLoadApprovals") || "Failed to load pending approvals",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter approvals
  const filteredApprovals = useMemo(() => {
    return pendingApprovals.filter((approval) => {
      const matchesSearch =
        approval.document_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        approval.rule_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        documentTypeFilter === "all" || approval.document_type === documentTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [pendingApprovals, searchQuery, documentTypeFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: pendingApprovals.length,
      purchaseOrders: pendingApprovals.filter((a) => a.document_type === "purchase_order").length,
      purchaseRequisitions: pendingApprovals.filter((a) => a.document_type === "purchase_requisition").length,
    };
  }, [pendingApprovals]);

  const handleViewDetails = async (workflow) => {
    setSelectedWorkflow(workflow);
    try {
      const details = await procurementService.getApprovalWorkflow(workflow.id);
      setWorkflowDetails(details);
      setShowDetails(true);
    } catch (error) {
      toast({
        title: t("error"),
        description: t("failedToLoadWorkflow") || "Failed to load workflow details",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!selectedWorkflow) return;

    setIsSubmitting(true);
    try {
      await procurementService.approveWorkflowStep(selectedWorkflow.id, comments);
      toast({
        title: t("success"),
        description: t("approvalSuccess") || "Approved successfully",
      });
      setShowApproveDialog(false);
      setComments("");
      await loadPendingApprovals();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("approvalFailed") || "Failed to approve",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedWorkflow || !comments.trim()) {
      toast({
        title: t("error"),
        description: t("commentsRequired") || "Comments are required for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await procurementService.rejectWorkflowStep(selectedWorkflow.id, comments);
      toast({
        title: t("success"),
        description: t("rejectionSuccess") || "Rejected successfully",
      });
      setShowRejectDialog(false);
      setComments("");
      await loadPendingApprovals();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("rejectionFailed") || "Failed to reject",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentTypeLabel = (type) => {
    return t(type) || DOCUMENT_TYPE_LABELS[type] || type;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("pendingApprovals") || "Pending Approvals"}</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("purchaseOrders") || "Purchase Orders"}</p>
                <p className="text-2xl font-bold text-blue-600">{stats.purchaseOrders}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("purchaseRequisitions") || "Purchase Requisitions"}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.purchaseRequisitions}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchApprovals") || "Search by document number..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("allDocuments") || "All Documents"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allDocuments") || "All Documents"}</SelectItem>
                  <SelectItem value="purchase_order">{t("purchaseOrders") || "Purchase Orders"}</SelectItem>
                  <SelectItem value="purchase_requisition">{t("purchaseRequisitions") || "Purchase Requisitions"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadPendingApprovals}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("refresh") || "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("myPendingApprovals") || "My Pending Approvals"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("document") || "Document"}</TableHead>
                <TableHead>{t("documentNumber") || "Document Number"}</TableHead>
                <TableHead>{t("rule") || "Rule"}</TableHead>
                <TableHead>{t("step") || "Step"}</TableHead>
                <TableHead>{t("submittedAt") || "Submitted"}</TableHead>
                <TableHead className="text-right">{t("actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredApprovals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                      <p>{t("noPendingApprovals") || "No pending approvals"}</p>
                      <p className="text-sm">{t("allCaughtUp") || "You're all caught up!"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredApprovals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {getDocumentTypeLabel(approval.document_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{approval.document_number}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {approval.rule_name || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {t("step") || "Step"} {approval.current_step} / {approval.total_steps}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(approval.started_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(approval)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setSelectedWorkflow(approval);
                            setComments("");
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {t("approve") || "Approve"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedWorkflow(approval);
                            setComments("");
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t("reject") || "Reject"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Workflow Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("workflowDetails") || "Workflow Details"}</DialogTitle>
          </DialogHeader>
          {workflowDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentType") || "Document Type"}</p>
                  <p className="font-medium">{getDocumentTypeLabel(workflowDetails.document_type)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("documentNumber") || "Document Number"}</p>
                  <p className="font-medium">{workflowDetails.document_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("rule") || "Rule"}</p>
                  <p className="font-medium">{workflowDetails.rule_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("status") || "Status"}</p>
                  <Badge variant={workflowDetails.status === "pending" ? "secondary" : "default"}>
                    {t(workflowDetails.status) || workflowDetails.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("approvalType") || "Approval Type"}</p>
                <p className="font-medium">{t(workflowDetails.approval_type) || workflowDetails.approval_type}</p>
              </div>

              {/* Steps */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t("approvalSteps") || "Approval Steps"}</p>
                <div className="space-y-2">
                  {workflowDetails.steps?.map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        step.status === "approved"
                          ? "bg-green-50 border-green-200"
                          : step.status === "rejected"
                          ? "bg-red-50 border-red-200"
                          : step.step_number === workflowDetails.current_step
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {step.status === "approved" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : step.status === "rejected" ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {t("step") || "Step"} {step.step_number}: {step.approver_name}
                        </p>
                        {step.comments && (
                          <p className="text-sm text-muted-foreground">{step.comments}</p>
                        )}
                        {step.action_date && (
                          <p className="text-xs text-muted-foreground">
                            {formatDate(step.action_date)}
                          </p>
                        )}
                      </div>
                      <Badge variant={step.status === "pending" ? "secondary" : "default"}>
                        {t(step.status) || step.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmApproval") || "Confirm Approval"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("approvalConfirmation") ||
                `Are you sure you want to approve ${selectedWorkflow?.document_number}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={t("optionalComments") || "Optional comments..."}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {t("approve") || "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmRejection") || "Confirm Rejection"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rejectionConfirmation") ||
                `Are you sure you want to reject ${selectedWorkflow?.document_number}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={t("reasonForRejection") || "Reason for rejection (required)..."}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isSubmitting || !comments.trim()}
              className="bg-destructive text-destructive-foreground"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {t("reject") || "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
