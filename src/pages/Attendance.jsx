import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  Search,
  LogIn,
  LogOut,
  Users,
  Calendar,
  Timer,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Coffee,
  MoreHorizontal,
  Play,
  Square,
  TrendingUp,
  Filter,
  Download,
  MapPin,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useHR } from '@/components/contexts/HRContext';
import { AttendanceRecord } from '@/api/entities';
import { format, differenceInMinutes, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, isSameDay } from 'date-fns';

const ATTENDANCE_STATUS = {
  present: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  absent: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  late: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  half_day: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  on_leave: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Calendar },
};

export default function Attendance() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { employees } = useHR();

  const [activeTab, setActiveTab] = useState('today');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [clockingEmployee, setClockingEmployee] = useState(null);

  // Work hours configuration
  const workConfig = {
    startTime: '09:00',
    endTime: '18:00',
    breakDuration: 60, // minutes
    lateThreshold: 15, // minutes grace period
    workHoursPerDay: 8,
  };

  // Load attendance records from database
  useEffect(() => {
    loadAttendanceRecords();
  }, [employees]);

  const loadAttendanceRecords = async () => {
    try {
      const records = await AttendanceRecord.list();
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error loading attendance records:', error);
      setAttendanceRecords([]);
    }
  };

  // Generate sample attendance records
  const generateSampleRecords = () => {
    if (employees.length === 0) return [];

    const today = new Date().toISOString().split('T')[0];
    const records = [];

    employees.forEach((emp, index) => {
      // Random attendance for today
      const statuses = ['present', 'present', 'present', 'late', 'absent'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      if (status !== 'absent') {
        const clockIn = new Date();
        clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);

        const clockOut = Math.random() > 0.3 ? new Date() : null;
        if (clockOut) {
          clockOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);
        }

        records.push({
          id: `ATT-${today}-${emp.id}`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          department: emp.department,
          date: today,
          clock_in: clockIn.toISOString(),
          clock_out: clockOut?.toISOString() || null,
          status: clockIn.getHours() > 9 || (clockIn.getHours() === 9 && clockIn.getMinutes() > 15) ? 'late' : 'present',
          break_duration: 60,
          notes: '',
        });
      } else {
        records.push({
          id: `ATT-${today}-${emp.id}`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          department: emp.department,
          date: today,
          clock_in: null,
          clock_out: null,
          status: 'absent',
          break_duration: 0,
          notes: '',
        });
      }
    });

    return records;
  };

  // Removed localStorage persistence - using database instead

  // Get today's attendance
  const todayRecords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceRecords.filter(r => r.date === today);
  }, [attendanceRecords]);

  // Filter records
  const filteredRecords = useMemo(() => {
    let records = activeTab === 'today'
      ? todayRecords
      : attendanceRecords.filter(r => r.date === selectedDate);

    if (searchQuery) {
      records = records.filter(r =>
        r.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (departmentFilter !== 'all') {
      records = records.filter(r => r.department === departmentFilter);
    }
    if (statusFilter !== 'all') {
      records = records.filter(r => r.status === statusFilter);
    }

    return records;
  }, [attendanceRecords, todayRecords, activeTab, selectedDate, searchQuery, departmentFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const present = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    const absent = todayRecords.filter(r => r.status === 'absent').length;
    const late = todayRecords.filter(r => r.status === 'late').length;
    const onLeave = todayRecords.filter(r => r.status === 'on_leave').length;

    const avgWorkHours = todayRecords
      .filter(r => r.clock_in && r.clock_out)
      .reduce((sum, r) => {
        const mins = differenceInMinutes(parseISO(r.clock_out), parseISO(r.clock_in)) - (r.break_duration || 0);
        return sum + mins;
      }, 0) / Math.max(1, todayRecords.filter(r => r.clock_in && r.clock_out).length);

    return {
      present,
      absent,
      late,
      onLeave,
      total: employees.length,
      avgWorkHours: (avgWorkHours / 60).toFixed(1),
      attendanceRate: employees.length > 0 ? ((present / employees.length) * 100).toFixed(0) : 0,
    };
  }, [todayRecords, employees]);

  // Calculate work hours for a record
  const calculateWorkHours = (record) => {
    if (!record.clock_in) return { hours: 0, minutes: 0, formatted: '-' };

    const clockIn = parseISO(record.clock_in);
    const clockOut = record.clock_out ? parseISO(record.clock_out) : new Date();
    const totalMinutes = differenceInMinutes(clockOut, clockIn) - (record.break_duration || 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      hours,
      minutes,
      formatted: `${hours}h ${minutes}m`,
      progress: Math.min(100, (totalMinutes / (workConfig.workHoursPerDay * 60)) * 100),
    };
  };

  // Handle clock in
  const handleClockIn = async (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > workConfig.lateThreshold);

    const existingRecord = attendanceRecords.find(r => r.employee_id === employeeId && r.date === today);

    try {
      if (existingRecord) {
        // Update existing record
        await AttendanceRecord.update(existingRecord.id, {
          ...existingRecord,
          clock_in: now.toISOString(),
          status: isLate ? 'late' : 'present'
        });
      } else {
        // Create new record
        const newRecord = {
          employee_id: employeeId,
          employee_name: employee.full_name,
          department: employee.department,
          date: today,
          clock_in: now.toISOString(),
          clock_out: null,
          status: isLate ? 'late' : 'present',
          break_duration: 0,
          notes: '',
        };
        await AttendanceRecord.create(newRecord);
      }
      await loadAttendanceRecords();
    } catch (error) {
      console.error('Error clocking in:', error);
    }

    setShowClockInModal(false);
    setClockingEmployee(null);
  };

  // Handle clock out
  const handleClockOut = async (recordId) => {
    const now = new Date();
    const record = attendanceRecords.find(r => r.id === recordId);
    if (!record) return;

    try {
      await AttendanceRecord.update(recordId, {
        ...record,
        clock_out: now.toISOString()
      });
      await loadAttendanceRecords();
    } catch (error) {
      console.error('Error clocking out:', error);
    }
  };

  // Get employees who haven't clocked in today
  const employeesNotClockedIn = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const clockedInIds = attendanceRecords
      .filter(r => r.date === today && r.clock_in)
      .map(r => r.employee_id);
    return employees.filter(e => !clockedInIds.includes(e.id));
  }, [employees, attendanceRecords]);

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{t('attendance') || "Davomad"}</h1>
            <p className="text-slate-600 mt-1">{t('attendance_desc') || "Xodimlar davomadini kuzating"}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowClockInModal(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {t('clock_in') || "Kirish"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.present}</p>
                  <p className="text-sm text-slate-500">{t('present') || "Kelgan"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.absent}</p>
                  <p className="text-sm text-slate-500">{t('absent') || "Kelmagan"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.late}</p>
                  <p className="text-sm text-slate-500">{t('late') || "Kechikkan"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Timer className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.avgWorkHours}h</p>
                  <p className="text-sm text-slate-500">{t('avg_hours') || "O'rtacha"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stats.attendanceRate}%</p>
                  <p className="text-sm text-slate-500">{t('attendance_rate') || "Davomad"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-lg flex flex-wrap justify-start gap-1 h-auto">
            <TabsTrigger value="today" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('today') || "Bugun"}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('history') || "Tarix"}</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-slate-100">
              <span>{t('summary') || "Xulosa"}</span>
            </TabsTrigger>
          </TabsList>

          {/* Today's Attendance */}
          <TabsContent value="today" className="mt-4">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-500" />
                    <span className="font-medium">{format(new Date(), 'EEEE, dd MMMM yyyy')}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder={t('search_employee') || "Qidirish..."}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder={t('all_statuses') || "Barchasi"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('all') || "Barchasi"}</SelectItem>
                        <SelectItem value="present">{t('present') || "Kelgan"}</SelectItem>
                        <SelectItem value="late">{t('late') || "Kechikkan"}</SelectItem>
                        <SelectItem value="absent">{t('absent') || "Kelmagan"}</SelectItem>
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
                      <TableHead>{t('department') || "Bo'lim"}</TableHead>
                      <TableHead>{t('clock_in') || "Kirish"}</TableHead>
                      <TableHead>{t('clock_out') || "Chiqish"}</TableHead>
                      <TableHead>{t('work_hours') || "Ish soati"}</TableHead>
                      <TableHead>{t('status') || "Holat"}</TableHead>
                      <TableHead className="text-right">{t('actions') || "Amallar"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          {t('no_attendance_records') || "Davomad yozuvlari topilmadi"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map(record => {
                        const workHours = calculateWorkHours(record);
                        const StatusIcon = ATTENDANCE_STATUS[record.status]?.icon || Clock;

                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                  {record.employee_name?.charAt(0)}
                                </div>
                                <span className="font-medium">{record.employee_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{t(record.department) || record.department}</Badge>
                            </TableCell>
                            <TableCell>
                              {record.clock_in ? (
                                <div className="flex items-center gap-2">
                                  <LogIn className="w-4 h-4 text-green-500" />
                                  <span>{format(parseISO(record.clock_in), 'HH:mm')}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.clock_out ? (
                                <div className="flex items-center gap-2">
                                  <LogOut className="w-4 h-4 text-red-500" />
                                  <span>{format(parseISO(record.clock_out), 'HH:mm')}</span>
                                </div>
                              ) : record.clock_in ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <Play className="w-3 h-3 mr-1" />
                                  {t('working') || "Ishlayapti"}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.clock_in && (
                                <div className="w-32">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>{workHours.formatted}</span>
                                    <span className="text-slate-400">/ 8h</span>
                                  </div>
                                  <Progress value={workHours.progress} className="h-1.5" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ATTENDANCE_STATUS[record.status]?.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {t(record.status) || record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {record.clock_in && !record.clock_out && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleClockOut(record.id)}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <LogOut className="w-4 h-4 mr-1" />
                                  {t('clock_out') || "Chiqish"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Employees not clocked in */}
            {employeesNotClockedIn.length > 0 && (
              <Card className="bg-amber-50/80 backdrop-blur-sm border-amber-200/60 mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-800 flex items-center gap-2 text-base">
                    <AlertTriangle className="w-5 h-5" />
                    {t('not_clocked_in') || "Hali kirmagan xodimlar"} ({employeesNotClockedIn.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {employeesNotClockedIn.map(emp => (
                      <Badge
                        key={emp.id}
                        variant="outline"
                        className="bg-white border-amber-300 cursor-pointer hover:bg-amber-100"
                        onClick={() => { setClockingEmployee(emp); setShowClockInModal(true); }}
                      >
                        {emp.full_name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Label>{t('select_date') || "Sana tanlang"}</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-48"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee') || "Xodim"}</TableHead>
                      <TableHead>{t('clock_in') || "Kirish"}</TableHead>
                      <TableHead>{t('clock_out') || "Chiqish"}</TableHead>
                      <TableHead>{t('work_hours') || "Ish soati"}</TableHead>
                      <TableHead>{t('status') || "Holat"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                          {t('no_records_for_date') || "Bu sana uchun yozuvlar topilmadi"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map(record => {
                        const workHours = calculateWorkHours(record);
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.employee_name}</TableCell>
                            <TableCell>
                              {record.clock_in ? format(parseISO(record.clock_in), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {record.clock_out ? format(parseISO(record.clock_out), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>{workHours.formatted}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ATTENDANCE_STATUS[record.status]?.color}>
                                {t(record.status) || record.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <CardTitle>{t('monthly_summary') || "Oylik xulosa"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {employees.slice(0, 5).map(emp => {
                      const empRecords = attendanceRecords.filter(r => r.employee_id === emp.id);
                      const presentDays = empRecords.filter(r => r.status === 'present' || r.status === 'late').length;
                      const lateDays = empRecords.filter(r => r.status === 'late').length;

                      return (
                        <div key={emp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                              {emp.full_name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{emp.full_name}</p>
                              <p className="text-sm text-slate-500">{emp.job_title}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">{presentDays} {t('days') || "kun"}</p>
                            {lateDays > 0 && (
                              <p className="text-sm text-amber-600">{lateDays} {t('late') || "kechikish"}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <CardTitle>{t('department_stats') || "Bo'limlar statistikasi"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['engineering', 'sales', 'marketing', 'finance', 'operations'].map(dept => {
                      const deptEmployees = employees.filter(e => e.department === dept);
                      const deptRecords = todayRecords.filter(r => r.department === dept);
                      const presentCount = deptRecords.filter(r => r.status === 'present' || r.status === 'late').length;
                      const rate = deptEmployees.length > 0 ? (presentCount / deptEmployees.length) * 100 : 0;

                      return (
                        <div key={dept} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{t(dept) || dept}</span>
                            <span className="text-slate-500">{presentCount}/{deptEmployees.length} ({rate.toFixed(0)}%)</span>
                          </div>
                          <Progress value={rate} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Clock In Modal */}
        <Dialog open={showClockInModal} onOpenChange={setShowClockInModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-green-600" />
                {t('clock_in') || "Kirishni qayd etish"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {clockingEmployee ? (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium">{clockingEmployee.full_name}</p>
                  <p className="text-sm text-slate-500">{clockingEmployee.job_title}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t('select_employee') || "Xodimni tanlang"}</Label>
                  <Select
                    value={selectedEmployee?.id || ''}
                    onValueChange={id => setSelectedEmployee(employees.find(e => e.id === id))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_employee') || "Xodimni tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesNotClockedIn.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{format(new Date(), 'HH:mm:ss')}</p>
                <p className="text-sm text-blue-500">{format(new Date(), 'dd MMMM yyyy')}</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => { setShowClockInModal(false); setClockingEmployee(null); }}>
                  {t('cancel') || "Bekor qilish"}
                </Button>
                <Button
                  onClick={() => handleClockIn(clockingEmployee?.id || selectedEmployee?.id)}
                  disabled={!clockingEmployee && !selectedEmployee}
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {t('confirm_clock_in') || "Kirishni tasdiqlash"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
