import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Clock,
  Send,
  FileCheck,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  User,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

// Universal Document Status Configuration
export const DOCUMENT_STATUSES = {
  // Generic statuses
  draft: { label: "Qoralama", color: "bg-slate-100 text-slate-800", icon: Clock },
  pending_approval: { label: "Tasdiqlash kutilmoqda", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "Tasdiqlangan", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "Rad etilgan", color: "bg-red-100 text-red-800", icon: XCircle },
  sent: { label: "Yuborilgan", color: "bg-blue-100 text-blue-800", icon: Send },
  confirmed: { label: "Tasdiqlangan", color: "bg-green-100 text-green-800", icon: FileCheck },
  cancelled: { label: "Bekor qilingan", color: "bg-red-100 text-red-800", icon: XCircle },
  completed: { label: "Yakunlangan", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  reversed: { label: "Qaytarilgan", color: "bg-orange-100 text-orange-800", icon: RotateCcw },

  // Finance specific
  posted: { label: "Kiritilgan", color: "bg-green-100 text-green-800", icon: FileCheck },
  paid: { label: "To'langan", color: "bg-green-100 text-green-800", icon: CheckCircle },
  partial: { label: "Qisman to'langan", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  overdue: { label: "Muddati o'tgan", color: "bg-red-100 text-red-800", icon: AlertTriangle },

  // Procurement specific
  rfq: { label: "So'rov", color: "bg-purple-100 text-purple-800", icon: Send },
  quotation: { label: "Taklif", color: "bg-blue-100 text-blue-800", icon: FileCheck },
  ordered: { label: "Buyurtma qilingan", color: "bg-indigo-100 text-indigo-800", icon: CheckCircle },
  received: { label: "Qabul qilingan", color: "bg-green-100 text-green-800", icon: CheckCircle },

  // Manufacturing specific
  planned: { label: "Rejalashtirilgan", color: "bg-slate-100 text-slate-800", icon: Clock },
  released: { label: "Chiqarilgan", color: "bg-blue-100 text-blue-800", icon: Send },
  in_progress: { label: "Jarayonda", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  quality_check: { label: "Sifat nazorati", color: "bg-purple-100 text-purple-800", icon: FileCheck },

  // HR specific
  active: { label: "Faol", color: "bg-green-100 text-green-800", icon: CheckCircle },
  on_leave: { label: "Ta'tilda", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  terminated: { label: "Ishdan bo'shatilgan", color: "bg-red-100 text-red-800", icon: XCircle },
};

// Document workflow transitions
export const WORKFLOW_TRANSITIONS = {
  // Generic document workflow
  generic: {
    draft: ["pending_approval", "cancelled"],
    pending_approval: ["approved", "rejected"],
    approved: ["confirmed", "cancelled"],
    rejected: ["draft"],
    confirmed: ["completed", "cancelled"],
    completed: ["reversed"],
    reversed: [],
    cancelled: ["draft"],
  },

  // Finance workflow
  finance: {
    draft: ["pending_approval", "cancelled"],
    pending_approval: ["posted", "rejected"],
    posted: ["paid", "partial", "reversed"],
    paid: ["reversed"],
    partial: ["paid", "reversed"],
    rejected: ["draft"],
    reversed: [],
    cancelled: [],
  },

  // Sales workflow
  sales: {
    draft: ["sent", "cancelled"],
    sent: ["confirmed", "rejected", "cancelled"],
    confirmed: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: ["reversed"],
    rejected: ["draft"],
    reversed: [],
    cancelled: ["draft"],
  },

  // Procurement workflow
  procurement: {
    draft: ["rfq", "cancelled"],
    rfq: ["quotation", "cancelled"],
    quotation: ["pending_approval", "cancelled"],
    pending_approval: ["approved", "rejected"],
    approved: ["ordered"],
    ordered: ["received", "cancelled"],
    received: ["completed"],
    rejected: ["draft"],
    completed: [],
    cancelled: ["draft"],
  },

  // Manufacturing workflow
  manufacturing: {
    planned: ["released", "cancelled"],
    released: ["in_progress", "cancelled"],
    in_progress: ["quality_check", "cancelled"],
    quality_check: ["completed", "in_progress"],
    completed: ["reversed"],
    reversed: [],
    cancelled: ["planned"],
  },
};

// Status Badge Component
export function StatusBadge({ status, size = "default" }) {
  const config = DOCUMENT_STATUSES[status] || DOCUMENT_STATUSES.draft;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}>
      <Icon className={`${size === "sm" ? "w-3 h-3" : "w-4 h-4"} mr-1`} />
      {config.label}
    </Badge>
  );
}

// Workflow Timeline Component
export function WorkflowTimeline({ history = [] }) {
  if (history.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-700">Hujjat tarixi</h4>
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
        <div className="space-y-4">
          {history.map((entry, index) => {
            const config = DOCUMENT_STATUSES[entry.status] || DOCUMENT_STATUSES.draft;
            const Icon = config.icon;

            return (
              <div key={index} className="flex items-start gap-3 relative">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${config.color}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{config.label}</span>
                    {entry.user && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {entry.user}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(entry.timestamp), "dd.MM.yyyy HH:mm")}
                  </div>
                  {entry.comment && (
                    <p className="text-sm text-slate-600 mt-1 bg-slate-50 rounded p-2">
                      {entry.comment}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Workflow Actions Component
export function WorkflowActions({
  currentStatus,
  workflowType = "generic",
  onStatusChange,
  disabled = false,
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [comment, setComment] = useState("");

  const transitions = WORKFLOW_TRANSITIONS[workflowType] || WORKFLOW_TRANSITIONS.generic;
  const availableActions = transitions[currentStatus] || [];

  if (availableActions.length === 0) return null;

  const handleAction = (action) => {
    setSelectedAction(action);
    setShowModal(true);
  };

  const confirmAction = () => {
    if (onStatusChange && selectedAction) {
      onStatusChange(selectedAction, comment);
    }
    setShowModal(false);
    setSelectedAction(null);
    setComment("");
  };

  const getActionButton = (action) => {
    const config = DOCUMENT_STATUSES[action];
    const variants = {
      approved: "bg-green-600 hover:bg-green-700 text-white",
      confirmed: "bg-green-600 hover:bg-green-700 text-white",
      completed: "bg-emerald-600 hover:bg-emerald-700 text-white",
      posted: "bg-green-600 hover:bg-green-700 text-white",
      rejected: "bg-red-600 hover:bg-red-700 text-white",
      cancelled: "bg-red-600 hover:bg-red-700 text-white",
      reversed: "bg-orange-600 hover:bg-orange-700 text-white",
      pending_approval: "bg-blue-600 hover:bg-blue-700 text-white",
      sent: "bg-blue-600 hover:bg-blue-700 text-white",
    };

    return (
      <Button
        key={action}
        size="sm"
        disabled={disabled}
        className={variants[action] || ""}
        onClick={() => handleAction(action)}
      >
        {config?.icon && <config.icon className="w-4 h-4 mr-1" />}
        {config?.label || action}
      </Button>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {availableActions.map(getActionButton)}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Holatni o'zgartirish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <StatusBadge status={currentStatus} />
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <StatusBadge status={selectedAction} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Izoh (ixtiyoriy)</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O'zgartirish sababi..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Bekor qilish
              </Button>
              <Button onClick={confirmAction}>
                Tasdiqlash
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Approval Chain Component
export function ApprovalChain({ approvers = [], currentApprover, onApprove, onReject }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-slate-700">Tasdiqlash zanjiri</h4>
      <div className="flex items-center gap-2">
        {approvers.map((approver, index) => (
          <React.Fragment key={approver.id}>
            <div
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                approver.status === "approved"
                  ? "bg-green-50 border-green-200"
                  : approver.status === "rejected"
                  ? "bg-red-50 border-red-200"
                  : approver.id === currentApprover
                  ? "bg-blue-50 border-blue-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                {approver.name?.charAt(0) || "?"}
              </div>
              <div>
                <p className="text-sm font-medium">{approver.name}</p>
                <p className="text-xs text-slate-500">{approver.role}</p>
              </div>
              {approver.status === "approved" && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              {approver.status === "rejected" && (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            {index < approvers.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </React.Fragment>
        ))}
      </div>

      {currentApprover && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={onApprove}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Tasdiqlash
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onReject}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Rad etish
          </Button>
        </div>
      )}
    </div>
  );
}

// Document Info Panel Component
export function DocumentInfoPanel({ document, fields = [] }) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
      {fields.map((field) => (
        <div key={field.key}>
          <p className="text-xs text-slate-500">{field.label}</p>
          <p className="font-medium">
            {field.render ? field.render(document[field.key]) : document[field.key] || "-"}
          </p>
        </div>
      ))}
    </div>
  );
}

export default {
  DOCUMENT_STATUSES,
  WORKFLOW_TRANSITIONS,
  StatusBadge,
  WorkflowTimeline,
  WorkflowActions,
  ApprovalChain,
  DocumentInfoPanel,
};
