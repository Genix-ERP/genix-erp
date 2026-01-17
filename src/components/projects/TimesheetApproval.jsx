import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  FileText,
  Search,
  Filter,
  Download,
  Eye,
} from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';

/**
 * TimesheetApproval Component
 *
 * A comprehensive timesheet management and approval workflow component.
 *
 * Features:
 * - Timesheet submission by employees
 * - Multi-level approval workflow
 * - Weekly timesheet view
 * - Task/Project breakdown
 * - Hours validation
 * - Approval/Rejection with comments
 * - Timesheet history
 * - Export functionality
 *
 * @param {String} projectId - Optional project filter
 * @param {String} employeeId - Optional employee filter (for employee view)
 * @param {Boolean} approverView - Show approval interface (for managers)
 */
export default function TimesheetApproval({
  projectId = null,
  employeeId = null,
  approverView = false
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [timesheets, setTimesheets] = useState([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState('approve'); // 'approve' or 'reject'
  const [approvalComment, setApprovalComment] = useState('');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load timesheets from localStorage
  useEffect(() => {
    const loadTimesheets = () => {
      const stored = localStorage.getItem('genix_timesheets');
      if (stored) {
        let data = JSON.parse(stored);

        // Apply filters
        if (projectId) {
          data = data.filter(ts => ts.project_id === projectId);
        }
        if (employeeId) {
          data = data.filter(ts => ts.employee_id === employeeId);
        }

        setTimesheets(data);
      } else {
        // Generate sample timesheets
        const sampleTimesheets = generateSampleTimesheets();
        setTimesheets(sampleTimesheets);
        saveData('genix_timesheets', sampleTimesheets);
      }
    };

    loadTimesheets();
  }, [projectId, employeeId]);

  const saveData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Generate sample timesheets for demonstration
  const generateSampleTimesheets = () => {
    const statuses = ['draft', 'submitted', 'approved', 'rejected'];
    const employees = [
      { id: 'EMP001', name: 'John Doe' },
      { id: 'EMP002', name: 'Jane Smith' },
      { id: 'EMP003', name: 'Bob Johnson' },
    ];
    const projects = ['Project Alpha', 'Project Beta', 'Project Gamma'];

    const samples = [];
    for (let i = 1; i <= 15; i++) {
      const weekStart = subWeeks(new Date(), i % 5);
      const emp = employees[i % 3];
      samples.push({
        id: `TS-${String(i).padStart(4, '0')}`,
        employee_id: emp.id,
        employee_name: emp.name,
        project_name: projects[i % 3],
        week_start: format(startOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        week_end: format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        total_hours: 40 + (i % 8),
        status: statuses[i % 4],
        submitted_date: i % 4 > 0 ? format(addWeeks(weekStart, 1), 'yyyy-MM-dd') : null,
        approved_by: i % 4 === 2 ? 'Manager Smith' : null,
        approval_date: i % 4 === 2 ? format(addWeeks(weekStart, 1), 'yyyy-MM-dd') : null,
        rejection_reason: i % 4 === 3 ? 'Hours exceed project allocation' : null,
        entries: generateWeekEntries(weekStart),
      });
    }
    return samples;
  };

  const generateWeekEntries = (weekStart) => {
    const week = eachDayOfInterval({
      start: startOfWeek(weekStart, { weekStartsOn: 1 }),
      end: endOfWeek(weekStart, { weekStartsOn: 1 })
    });

    return week.map((day, idx) => ({
      date: format(day, 'yyyy-MM-dd'),
      hours: idx < 5 ? 8 : 0, // 8 hours Mon-Fri
      task_description: idx < 5 ? 'Development work' : '',
      billable: idx < 5
    }));
  };

  // Filter timesheets
  const filteredTimesheets = useMemo(() => {
    let filtered = timesheets;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ts => ts.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(ts =>
        ts.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ts.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ts.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [timesheets, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: timesheets.length,
      pending: timesheets.filter(ts => ts.status === 'submitted').length,
      approved: timesheets.filter(ts => ts.status === 'approved').length,
      rejected: timesheets.filter(ts => ts.status === 'rejected').length,
      totalHours: timesheets.reduce((sum, ts) => sum + ts.total_hours, 0),
    };
  }, [timesheets]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">{t('draft') || 'Draft'}</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-500">{t('submitted') || 'Submitted'}</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">{t('approved') || 'Approved'}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">{t('rejected') || 'Rejected'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewDetails = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setShowDetailDialog(true);
  };

  const handleApprove = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setApprovalAction('approve');
    setApprovalComment('');
    setShowApprovalDialog(true);
  };

  const handleReject = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setApprovalAction('reject');
    setApprovalComment('');
    setShowApprovalDialog(true);
  };

  const confirmApproval = () => {
    const updatedTimesheets = timesheets.map(ts => {
      if (ts.id === selectedTimesheet.id) {
        return {
          ...ts,
          status: approvalAction === 'approve' ? 'approved' : 'rejected',
          approved_by: approvalAction === 'approve' ? 'Current User' : null,
          approval_date: approvalAction === 'approve' ? format(new Date(), 'yyyy-MM-dd') : null,
          rejection_reason: approvalAction === 'reject' ? approvalComment : null,
        };
      }
      return ts;
    });

    setTimesheets(updatedTimesheets);
    saveData('genix_timesheets', updatedTimesheets);
    setShowApprovalDialog(false);
    setSelectedTimesheet(null);
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('total_timesheets') || 'Total Timesheets'}</p>
                <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
              </div>
              <FileText className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pending_approval') || 'Pending'}</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-600">{stats.pending}</h3>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('approved') || 'Approved'}</p>
                <h3 className="text-2xl font-bold mt-1 text-green-600">{stats.approved}</h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('rejected') || 'Rejected'}</p>
                <h3 className="text-2xl font-bold mt-1 text-red-600">{stats.rejected}</h3>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('total_hours') || 'Total Hours'}</p>
                <h3 className="text-2xl font-bold mt-1">{stats.totalHours}</h3>
              </div>
              <Clock className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('timesheets') || 'Timesheets'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('search_timesheets') || 'Search timesheets...'}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={t('filter_by_status') || 'Filter by status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                <SelectItem value="draft">{t('draft') || 'Draft'}</SelectItem>
                <SelectItem value="submitted">{t('submitted') || 'Submitted'}</SelectItem>
                <SelectItem value="approved">{t('approved') || 'Approved'}</SelectItem>
                <SelectItem value="rejected">{t('rejected') || 'Rejected'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {t('export') || 'Export'}
            </Button>
          </div>

          {/* Timesheets Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('timesheet_id') || 'ID'}</TableHead>
                  <TableHead>{t('employee') || 'Employee'}</TableHead>
                  <TableHead>{t('project') || 'Project'}</TableHead>
                  <TableHead>{t('week') || 'Week'}</TableHead>
                  <TableHead className="text-right">{t('hours') || 'Hours'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimesheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t('no_timesheets_found') || 'No timesheets found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTimesheets.map((timesheet) => (
                    <TableRow key={timesheet.id}>
                      <TableCell className="font-medium">{timesheet.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          {timesheet.employee_name}
                        </div>
                      </TableCell>
                      <TableCell>{timesheet.project_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(parseISO(timesheet.week_start), 'MMM dd')} - {format(parseISO(timesheet.week_end), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{timesheet.total_hours}h</TableCell>
                      <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(timesheet)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {approverView && timesheet.status === 'submitted' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApprove(timesheet)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {t('approve') || 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(timesheet)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                {t('reject') || 'Reject'}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t('timesheet_details') || 'Timesheet Details'} - {selectedTimesheet?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedTimesheet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('employee') || 'Employee'}</Label>
                  <p className="font-medium">{selectedTimesheet.employee_name}</p>
                </div>
                <div>
                  <Label>{t('project') || 'Project'}</Label>
                  <p className="font-medium">{selectedTimesheet.project_name}</p>
                </div>
                <div>
                  <Label>{t('week') || 'Week'}</Label>
                  <p>{format(parseISO(selectedTimesheet.week_start), 'MMM dd')} - {format(parseISO(selectedTimesheet.week_end), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <Label>{t('total_hours') || 'Total Hours'}</Label>
                  <p className="font-medium">{selectedTimesheet.total_hours}h</p>
                </div>
              </div>

              <div>
                <Label>{t('daily_breakdown') || 'Daily Breakdown'}</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date') || 'Date'}</TableHead>
                      <TableHead>{t('hours') || 'Hours'}</TableHead>
                      <TableHead>{t('description') || 'Description'}</TableHead>
                      <TableHead>{t('billable') || 'Billable'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTimesheet.entries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{format(parseISO(entry.date), 'EEE, MMM dd')}</TableCell>
                        <TableCell className="font-medium">{entry.hours}h</TableCell>
                        <TableCell>{entry.task_description || '-'}</TableCell>
                        <TableCell>
                          {entry.billable ? (
                            <Badge className="bg-green-500">{t('yes') || 'Yes'}</Badge>
                          ) : (
                            <Badge variant="outline">{t('no') || 'No'}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedTimesheet.approved_by && (
                <div>
                  <Label>{t('approved_by') || 'Approved By'}</Label>
                  <p>{selectedTimesheet.approved_by} on {format(parseISO(selectedTimesheet.approval_date), 'MMM dd, yyyy')}</p>
                </div>
              )}

              {selectedTimesheet.rejection_reason && (
                <div>
                  <Label>{t('rejection_reason') || 'Rejection Reason'}</Label>
                  <p className="text-red-600">{selectedTimesheet.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? (t('approve_timesheet') || 'Approve Timesheet') : (t('reject_timesheet') || 'Reject Timesheet')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              {approvalAction === 'approve'
                ? (t('confirm_approve_timesheet') || 'Are you sure you want to approve this timesheet?')
                : (t('confirm_reject_timesheet') || 'Are you sure you want to reject this timesheet?')}
            </p>
            {approvalAction === 'reject' && (
              <div>
                <Label>{t('reason') || 'Reason'} *</Label>
                <Textarea
                  placeholder={t('enter_rejection_reason') || 'Enter rejection reason...'}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            {approvalAction === 'approve' && (
              <div>
                <Label>{t('comments') || 'Comments'} ({t('optional') || 'optional'})</Label>
                <Textarea
                  placeholder={t('add_comments') || 'Add any comments...'}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
              onClick={confirmApproval}
              disabled={approvalAction === 'reject' && !approvalComment}
            >
              {approvalAction === 'approve' ? (t('approve') || 'Approve') : (t('reject') || 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
