import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  History,
  User,
  Calendar,
  Search,
  Filter,
  Eye,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ArrowRight,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

// Audit action types
export const AUDIT_ACTIONS = {
  create: { label: "Yaratildi", color: "bg-green-100 text-green-800", icon: Plus },
  update: { label: "Yangilandi", color: "bg-blue-100 text-blue-800", icon: Pencil },
  delete: { label: "O'chirildi", color: "bg-red-100 text-red-800", icon: Trash2 },
  view: { label: "Ko'rildi", color: "bg-slate-100 text-slate-800", icon: Eye },
  status_change: { label: "Holat o'zgardi", color: "bg-purple-100 text-purple-800", icon: ArrowRight },
  approve: { label: "Tasdiqlandi", color: "bg-green-100 text-green-800", icon: FileText },
  reject: { label: "Rad etildi", color: "bg-red-100 text-red-800", icon: FileText },
  export: { label: "Eksport qilindi", color: "bg-yellow-100 text-yellow-800", icon: FileText },
  import: { label: "Import qilindi", color: "bg-yellow-100 text-yellow-800", icon: FileText },
  print: { label: "Chop etildi", color: "bg-slate-100 text-slate-800", icon: FileText },
};

// Audit Trail Storage Hook
export function useAuditTrail(entityType) {
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(`genix_audit_${entityType}`);
    if (stored) {
      setAuditLogs(JSON.parse(stored));
    }
  }, [entityType]);

  const addAuditLog = (action, entityId, entityName, changes = null, user = "Current User") => {
    const newLog = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entityId,
      entityName,
      user,
      changes,
    };

    setAuditLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 1000); // Keep last 1000 logs
      localStorage.setItem(`genix_audit_${entityType}`, JSON.stringify(updated));
      return updated;
    });

    return newLog;
  };

  const getEntityLogs = (entityId) => {
    return auditLogs.filter((log) => log.entityId === entityId);
  };

  const clearOldLogs = (daysToKeep = 90) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filtered = auditLogs.filter(
      (log) => new Date(log.timestamp) > cutoffDate
    );
    setAuditLogs(filtered);
    localStorage.setItem(`genix_audit_${entityType}`, JSON.stringify(filtered));
  };

  return {
    auditLogs,
    addAuditLog,
    getEntityLogs,
    clearOldLogs,
  };
}

// Audit Log Badge
export function AuditActionBadge({ action }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const config = AUDIT_ACTIONS[action] || AUDIT_ACTIONS.view;
  const Icon = config.icon;

  // Get translated label
  const getLabel = (actionType) => {
    const labels = {
      create: t('created') || 'Created',
      update: t('updated') || 'Updated',
      delete: t('deleted') || 'Deleted',
      view: t('viewed') || 'Viewed',
      status_change: t('status_changed') || 'Status Changed',
      approve: t('approved') || 'Approved',
      reject: t('rejected') || 'Rejected',
      export: t('exported') || 'Exported',
      import: t('imported') || 'Imported',
      print: t('printed') || 'Printed',
    };
    return labels[actionType] || actionType;
  };

  return (
    <Badge className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {getLabel(action)}
    </Badge>
  );
}

// Entity Audit History Component (for showing in entity detail views)
export function EntityAuditHistory({ logs = [], maxItems = 5 }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [showAll, setShowAll] = useState(false);
  const displayLogs = showAll ? logs : logs.slice(0, maxItems);

  if (logs.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">{t('no_history') || 'No history available'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayLogs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
        >
          <div className="flex-shrink-0">
            <AuditActionBadge action={log.action} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-3 h-3 text-slate-400" />
              <span className="font-medium">{log.user}</span>
              <span className="text-slate-400">|</span>
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">
                {format(new Date(log.timestamp), "dd.MM.yyyy HH:mm")}
              </span>
            </div>
            {log.changes && (
              <div className="mt-2 text-xs">
                {Object.entries(log.changes).map(([field, change]) => (
                  <div key={field} className="flex items-center gap-2 text-slate-600">
                    <span className="font-medium">{field}:</span>
                    {change.old !== undefined && (
                      <>
                        <span className="text-red-500 line-through">{String(change.old)}</span>
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                    <span className="text-green-600">{String(change.new)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {logs.length > maxItems && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (t('show_less') || 'Show less') : `${t('view_more') || 'View'} ${logs.length - maxItems} ${t('more') || 'more'}`}
        </Button>
      )}
    </div>
  );
}

// Full Audit Trail Panel Component
export function AuditTrailPanel({
  entityType,
  logs = [],
  title = "Audit Trail",
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  // Get translated audit action labels
  const getAuditActionLabel = (action) => {
    const labels = {
      create: t('created') || 'Created',
      update: t('updated') || 'Updated',
      delete: t('deleted') || 'Deleted',
      view: t('viewed') || 'Viewed',
      status_change: t('status_changed') || 'Status Changed',
      approve: t('approved') || 'Approved',
      reject: t('rejected') || 'Rejected',
      export: t('exported') || 'Exported',
      import: t('imported') || 'Imported',
      print: t('printed') || 'Printed',
    };
    return labels[action] || action;
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.entityName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    const matchesDateFrom = !dateFrom || new Date(log.timestamp) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(log.timestamp) <= new Date(dateTo + "T23:59:59");

    return matchesSearch && matchesAction && matchesDateFrom && matchesDateTo;
  });

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          {title}
          <Badge variant="outline" className="ml-2">
            {filteredLogs.length} {t('records') || 'records'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search') || 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('action_type') || 'Action Type'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all') || 'All'}</SelectItem>
              {Object.keys(AUDIT_ACTIONS).map((key) => (
                <SelectItem key={key} value={key}>
                  {getAuditActionLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
            placeholder="Dan"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
            placeholder="Gacha"
          />
        </div>

        {/* Table */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('no_audit_records') || 'No audit records found'}</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('date_time') || 'Date/Time'}</TableHead>
                  <TableHead>{t('action') || 'Action'}</TableHead>
                  <TableHead>{t('document') || 'Document'}</TableHead>
                  <TableHead>{t('user') || 'User'}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 100).map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {format(new Date(log.timestamp), "dd.MM.yyyy HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AuditActionBadge action={log.action} />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{log.entityName || log.entityId}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                          {log.user?.charAt(0) || "?"}
                        </div>
                        <span className="text-sm">{log.user}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.changes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Detail Modal */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('change_details') || 'Change Details'}</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">{t('date_time') || 'Date/Time'}</p>
                    <p className="font-medium">
                      {format(new Date(selectedLog.timestamp), "dd.MM.yyyy HH:mm:ss")}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t('user') || 'User'}</p>
                    <p className="font-medium">{selectedLog.user}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t('document') || 'Document'}</p>
                    <p className="font-medium">{selectedLog.entityName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t('action') || 'Action'}</p>
                    <AuditActionBadge action={selectedLog.action} />
                  </div>
                </div>

                {selectedLog.changes && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{t('field') || 'Field'}</TableHead>
                          <TableHead>{t('old_value') || 'Old Value'}</TableHead>
                          <TableHead>{t('new_value') || 'New Value'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(selectedLog.changes).map(([field, change]) => (
                          <TableRow key={field}>
                            <TableCell className="font-medium">{field}</TableCell>
                            <TableCell className="text-red-600">
                              {change.old !== undefined ? String(change.old) : "-"}
                            </TableCell>
                            <TableCell className="text-green-600">
                              {String(change.new)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default {
  AUDIT_ACTIONS,
  useAuditTrail,
  AuditActionBadge,
  EntityAuditHistory,
  AuditTrailPanel,
};
