import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  CalendarDays,
  Plane,
  Heart,
  Baby,
  Briefcase,
  MoreHorizontal,
  Eye,
  Check,
  X,
  Filter,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from "@/hooks/usePermissions";
import { LeaveRequest, LeaveBalance } from '@/api/entities';
import { useHR } from '@/components/contexts/HRContext';
import { format, differenceInDays, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

// Leave types with icons and colors
const LEAVE_TYPES = {
  annual: { icon: Plane, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'annual_leave' },
  sick: { icon: Heart, color: 'bg-red-100 text-red-700 border-red-200', label: 'sick_leave' },
  personal: { icon: Briefcase, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'personal_leave' },
  maternity: { icon: Baby, color: 'bg-pink-100 text-pink-700 border-pink-200', label: 'maternity_leave' },
  paternity: { icon: Baby, color: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'paternity_leave' },
  unpaid: { icon: Calendar, color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'unpaid_leave' },
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
};

// Sample leave balances per employee
const getDefaultLeaveBalances = () => ({
  annual: { total: 24, used: 0, pending: 0 },
  sick: { total: 10, used: 0, pending: 0 },
  personal: { total: 5, used: 0, pending: 0 },
  maternity: { total: 126, used: 0, pending: 0 },
  paternity: { total: 14, used: 0, pending: 0 },
  unpaid: { total: 30, used: 0, pending: 0 },
});

export default function LeaveManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { employees } = useHR();
  const { canCreate, canUpdate, canDelete, MODULES } = usePermissions();

  const activeTab = searchParams.get("tab") || "requests";
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [newRequest, setNewRequest] = useState({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
    half_day: false,
    half_day_period: 'morning',
  });

  // Load data from database
  useEffect(() => {
    loadLeaveData();
  }, [employees]);

  const loadLeaveData = async () => {
    try {
      const [requests, balances] = await Promise.all([
        LeaveRequest.list(),
        LeaveBalance.list()
      ]);
      setLeaveRequests(requests);

      // Convert balance array to object keyed by employee_id
      const balanceObj = {};
      balances.forEach(balance => {
        balanceObj[balance.employee_id] = balance;
      });
      setLeaveBalances(balanceObj);
    } catch (error) {
      console.error('Error loading leave data:', error);
      setLeaveRequests([]);
      setLeaveBalances({});
    }
  };

  // Generate sample leave requests
  const generateSampleRequests = () => {
    if (employees.length === 0) return [];

    const statuses = ['pending', 'approved', 'rejected'];
    const types = ['annual', 'sick', 'personal'];
    const requests = [];

    for (let i = 0; i < Math.min(5, employees.length); i++) {
      const emp = employees[i];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);

      requests.push({
        id: `LR-${Date.now()}-${i}`,
        employee_id: emp.id,
        employee_name: emp.full_name,
        leave_type: types[Math.floor(Math.random() * types.length)],
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        days: differenceInDays(endDate, startDate) + 1,
        reason: 'Personal matters',
        status: statuses[Math.floor(Math.random() * statuses.length)],
        created_at: new Date().toISOString(),
        half_day: false,
      });
    }

    return requests;
  };

  // Removed localStorage persistence - using database instead

  // Filter requests
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      const matchesSearch = !searchQuery ||
        req.employee_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchesType = typeFilter === 'all' || req.leave_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [leaveRequests, searchQuery, statusFilter, typeFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const pending = leaveRequests.filter(r => r.status === 'pending').length;
    const approved = leaveRequests.filter(r => r.status === 'approved').length;
    const thisMonth = leaveRequests.filter(r => {
      const start = parseISO(r.start_date);
      return isWithinInterval(start, { start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
    }).length;
    const totalDays = leaveRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.days || 1), 0);

    return { pending, approved, thisMonth, totalDays };
  }, [leaveRequests]);

  // Handle create request
  const handleCreateRequest = async () => {
    const employee = employees.find(e => e.id === newRequest.employee_id);
    if (!employee) return;

    const startDate = parseISO(newRequest.start_date);
    const endDate = parseISO(newRequest.end_date);
    const days = newRequest.half_day ? 0.5 : differenceInDays(endDate, startDate) + 1;

    const request = {
      employee_id: newRequest.employee_id,
      employee_name: employee.full_name,
      leave_type: newRequest.leave_type,
      start_date: newRequest.start_date,
      end_date: newRequest.end_date,
      days,
      reason: newRequest.reason,
      status: 'pending',
      half_day: newRequest.half_day,
      half_day_period: newRequest.half_day_period,
    };

    try {
      await LeaveRequest.create(request);

      // Update pending balance
      const empBalances = leaveBalances[newRequest.employee_id] || getDefaultLeaveBalances();
      const updatedBalance = {
        employee_id: newRequest.employee_id,
        ...empBalances,
        [newRequest.leave_type]: {
          ...empBalances[newRequest.leave_type],
          pending: (empBalances[newRequest.leave_type]?.pending || 0) + days,
        }
      };

      if (empBalances.id) {
        await LeaveBalance.update(empBalances.id, updatedBalance);
      } else {
        await LeaveBalance.create(updatedBalance);
      }

      await loadLeaveData();
    } catch (error) {
      console.error('Error creating leave request:', error);
    }

    setShowCreateModal(false);
    setNewRequest({
      employee_id: '',
      leave_type: 'annual',
      start_date: '',
      end_date: '',
      reason: '',
      half_day: false,
      half_day_period: 'morning',
    });
  };

  // Handle approve request
  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await LeaveRequest.update(selectedRequest.id, {
        ...selectedRequest,
        status: 'approved',
        approved_at: new Date().toISOString()
      });

      // Update balances
      const empBalances = leaveBalances[selectedRequest.employee_id] || getDefaultLeaveBalances();
      const leaveType = selectedRequest.leave_type;
      const updatedBalance = {
        employee_id: selectedRequest.employee_id,
        ...empBalances,
        [leaveType]: {
          ...empBalances[leaveType],
          used: (empBalances[leaveType]?.used || 0) + selectedRequest.days,
          pending: Math.max(0, (empBalances[leaveType]?.pending || 0) - selectedRequest.days),
        }
      };

      if (empBalances.id) {
        await LeaveBalance.update(empBalances.id, updatedBalance);
      }

      await loadLeaveData();
    } catch (error) {
      console.error('Error approving leave request:', error);
    }

    setShowApproveDialog(false);
    setSelectedRequest(null);
  };

  // Handle reject request
  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      await LeaveRequest.update(selectedRequest.id, {
        ...selectedRequest,
        status: 'rejected',
        reject_reason: rejectReason,
        rejected_at: new Date().toISOString()
      });

      // Remove from pending
      const empBalances = leaveBalances[selectedRequest.employee_id] || getDefaultLeaveBalances();
      const leaveType = selectedRequest.leave_type;
      const updatedBalance = {
        employee_id: selectedRequest.employee_id,
        ...empBalances,
        [leaveType]: {
          ...empBalances[leaveType],
          pending: Math.max(0, (empBalances[leaveType]?.pending || 0) - selectedRequest.days),
        }
      };

      if (empBalances.id) {
        await LeaveBalance.update(empBalances.id, updatedBalance);
      }

      await loadLeaveData();
    } catch (error) {
      console.error('Error rejecting leave request:', error);
    }

    setShowRejectDialog(false);
    setSelectedRequest(null);
    setRejectReason('');
  };

  const getLeaveTypeIcon = (type) => {
    const LeaveIcon = LEAVE_TYPES[type]?.icon || Calendar;
    return <LeaveIcon className="w-4 h-4" />;
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Action Button */}
        <div className="flex justify-end">
          {canCreate(MODULES.HR) && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('new_leave_request') || "Yangi so'rov"}
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
                  <p className="text-sm text-slate-500">{t('pending_requests') || "Kutilmoqda"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.approved}</p>
                  <p className="text-sm text-slate-500">{t('approved') || "Tasdiqlangan"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.thisMonth}</p>
                  <p className="text-sm text-slate-500">{t('this_month') || "Bu oy"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Plane className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.totalDays}</p>
                  <p className="text-sm text-slate-500">{t('total_days_off') || "Jami kun"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="requests" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('leave_requests') || "So'rovlar"}</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('leave_balances') || "Balanslar"}</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('calendar') || "Kalendar"}</span>
            </TabsTrigger>
          </TabsList>

          {/* Leave Requests Tab */}
          <TabsContent value="requests" className="mt-4">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={t('search_employee') || "Xodim qidirish..."}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t('all_statuses') || "Barcha holatlar"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('all_statuses') || "Barchasi"}</SelectItem>
                        <SelectItem value="pending">{t('pending') || "Kutilmoqda"}</SelectItem>
                        <SelectItem value="approved">{t('approved') || "Tasdiqlangan"}</SelectItem>
                        <SelectItem value="rejected">{t('rejected') || "Rad etilgan"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t('all_types') || "Barcha turlar"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('all_types') || "Barchasi"}</SelectItem>
                        <SelectItem value="annual">{t('annual_leave') || "Yillik ta'til"}</SelectItem>
                        <SelectItem value="sick">{t('sick_leave') || "Kasallik"}</SelectItem>
                        <SelectItem value="personal">{t('personal_leave') || "Shaxsiy"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee') || "Xodim"}</TableHead>
                      <TableHead>{t('leave_type') || "Turi"}</TableHead>
                      <TableHead>{t('period') || "Davr"}</TableHead>
                      <TableHead>{t('days') || "Kunlar"}</TableHead>
                      <TableHead>{t('status') || "Holat"}</TableHead>
                      <TableHead>{t('submitted') || "Yuborilgan"}</TableHead>
                      <TableHead className="text-right">{t('actions') || "Amallar"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          {t('no_leave_requests') || "Ta'til so'rovlari topilmadi"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map(request => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.employee_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={LEAVE_TYPES[request.leave_type]?.color}>
                              {getLeaveTypeIcon(request.leave_type)}
                              <span className="ml-1">{t(LEAVE_TYPES[request.leave_type]?.label) || request.leave_type}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(parseISO(request.start_date), 'dd.MM')} - {format(parseISO(request.end_date), 'dd.MM.yyyy')}
                            </span>
                          </TableCell>
                          <TableCell>{request.days} {t('days') || "kun"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[request.status]}>
                              {t(request.status) || request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {format(parseISO(request.created_at), 'dd.MM.yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedRequest(request); setShowViewModal(true); }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  {t('view') || "Ko'rish"}
                                </DropdownMenuItem>
                                {request.status === 'pending' && canUpdate(MODULES.HR) && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => { setSelectedRequest(request); setShowApproveDialog(true); }}
                                      className="text-green-600"
                                    >
                                      <Check className="w-4 h-4 mr-2" />
                                      {t('approve') || "Tasdiqlash"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => { setSelectedRequest(request); setShowRejectDialog(true); }}
                                      className="text-red-600"
                                    >
                                      <X className="w-4 h-4 mr-2" />
                                      {t('reject') || "Rad etish"}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Balances Tab */}
          <TabsContent value="balances" className="mt-4">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle>{t('employee_leave_balances') || "Xodimlar ta'til balanslari"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee') || "Xodim"}</TableHead>
                      <TableHead className="text-center">{t('annual_leave') || "Yillik"}</TableHead>
                      <TableHead className="text-center">{t('sick_leave') || "Kasallik"}</TableHead>
                      <TableHead className="text-center">{t('personal_leave') || "Shaxsiy"}</TableHead>
                      <TableHead className="text-center">{t('total_remaining') || "Jami qolgan"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map(emp => {
                      const balances = leaveBalances[emp.id] || getDefaultLeaveBalances();
                      const totalRemaining =
                        (balances.annual?.total - balances.annual?.used - balances.annual?.pending) +
                        (balances.sick?.total - balances.sick?.used - balances.sick?.pending) +
                        (balances.personal?.total - balances.personal?.used - balances.personal?.pending);

                      return (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{emp.full_name}</p>
                              <p className="text-sm text-slate-500">{emp.job_title}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-sm">
                              <span className="font-medium text-green-600">
                                {balances.annual?.total - balances.annual?.used - balances.annual?.pending}
                              </span>
                              <span className="text-slate-400"> / {balances.annual?.total}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-sm">
                              <span className="font-medium text-red-600">
                                {balances.sick?.total - balances.sick?.used - balances.sick?.pending}
                              </span>
                              <span className="text-slate-400"> / {balances.sick?.total}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-sm">
                              <span className="font-medium text-purple-600">
                                {balances.personal?.total - balances.personal?.used - balances.personal?.pending}
                              </span>
                              <span className="text-slate-400"> / {balances.personal?.total}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={totalRemaining > 10 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                              {totalRemaining} {t('days') || "kun"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-4">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle>{t('leave_calendar') || "Ta'til kalendari"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="text-center py-12 text-slate-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>{t('calendar_coming_soon') || "Kalendar ko'rinishi tez orada qo'shiladi"}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Request Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('new_leave_request') || "Yangi ta'til so'rovi"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('employee') || "Xodim"} *</Label>
                <Select
                  value={newRequest.employee_id}
                  onValueChange={value => setNewRequest({ ...newRequest, employee_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_employee') || "Xodimni tanlang"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('leave_type') || "Ta'til turi"} *</Label>
                <Select
                  value={newRequest.leave_type}
                  onValueChange={value => setNewRequest({ ...newRequest, leave_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{t(label) || label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('start_date') || "Boshlanish sanasi"} *</Label>
                  <Input
                    type="date"
                    value={newRequest.start_date}
                    onChange={e => setNewRequest({ ...newRequest, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('end_date') || "Tugash sanasi"} *</Label>
                  <Input
                    type="date"
                    value={newRequest.end_date}
                    onChange={e => setNewRequest({ ...newRequest, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('reason') || "Sabab"}</Label>
                <Textarea
                  value={newRequest.reason}
                  onChange={e => setNewRequest({ ...newRequest, reason: e.target.value })}
                  placeholder={t('enter_reason') || "Sababni kiriting..."}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  {t('cancel') || "Bekor qilish"}
                </Button>
                <Button
                  onClick={handleCreateRequest}
                  disabled={!newRequest.employee_id || !newRequest.start_date || !newRequest.end_date}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  {t('submit_request') || "So'rov yuborish"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Request Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('leave_request_details') || "So'rov tafsilotlari"}</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t('employee') || "Xodim"}</p>
                    <p className="font-medium">{selectedRequest.employee_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('leave_type') || "Turi"}</p>
                    <Badge variant="outline" className={LEAVE_TYPES[selectedRequest.leave_type]?.color}>
                      {t(LEAVE_TYPES[selectedRequest.leave_type]?.label) || selectedRequest.leave_type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('period') || "Davr"}</p>
                    <p className="font-medium">
                      {format(parseISO(selectedRequest.start_date), 'dd.MM.yyyy')} - {format(parseISO(selectedRequest.end_date), 'dd.MM.yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('days') || "Kunlar"}</p>
                    <p className="font-medium">{selectedRequest.days} {t('days') || "kun"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-500">{t('reason') || "Sabab"}</p>
                    <p className="font-medium">{selectedRequest.reason || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t('status') || "Holat"}</p>
                    <Badge variant="outline" className={STATUS_COLORS[selectedRequest.status]}>
                      {t(selectedRequest.status) || selectedRequest.status}
                    </Badge>
                  </div>
                  {selectedRequest.reject_reason && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500">{t('reject_reason') || "Rad etish sababi"}</p>
                      <p className="font-medium text-red-600">{selectedRequest.reject_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Approve Dialog */}
        <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('approve_leave_request') || "Ta'til so'rovini tasdiqlash"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('approve_leave_confirm') || `${selectedRequest?.employee_name} ning ${selectedRequest?.days} kunlik ta'til so'rovini tasdiqlaysizmi?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                {t('approve') || "Tasdiqlash"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reject Dialog */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('reject_leave_request') || "Ta'til so'rovini rad etish"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('reject_leave_confirm') || "Iltimos, rad etish sababini kiriting."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder={t('enter_reject_reason') || "Sababni kiriting..."}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel') || "Bekor qilish"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">
                {t('reject') || "Rad etish"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
