
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Search,
  TrendingUp,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Mail,
  UserPlus,
  Building,
  Target,
  Trash2,
  ShoppingCart,
  FileText,
  Globe,
  ArrowUpDown,
  Clock,
  Play,
  Pause,
  Download,
  Filter,
  X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import CustomerForm from "@/components/customers/CustomerForm";
import CustomerMetrics from "@/components/customers/CustomerMetrics";
import DragDropKanban from "@/components/crm/DragDropKanban";
import LeadsKanban from "@/components/crm/LeadsKanban";
import WebsiteScript from "@/components/crm/WebsiteScript";
import LeadForm from "@/components/crm/LeadForm";
import OpportunityForm from "@/components/crm/OpportunityForm";
import CallInterface from "@/components/crm/CallInterface";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useCompany } from "@/components/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { pbxService, apiClient } from "@/api/services";
import { useToast } from "@/components/ui/use-toast";
import { useSales } from "@/components/contexts/SalesContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

function CustomerReports({ customers, salesOrders, invoices, leads, callLogs, formatCurrency, language, t }) {
  const [sortField, setSortField] = useState('totalSales');
  const [sortDir, setSortDir] = useState('desc');
  const [callViewMode, setCallViewMode] = useState('daily'); // 'daily' | 'monthly'

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [users, setUsers] = useState([]);

  // Audio playback state
  const audioRef = useRef(null);
  const [playingAudio, setPlayingAudio] = useState(null);

  // Fetch users for employee filter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiClient.get('/users', { params: { limit: 100 } });
        setUsers(response.data?.data || response.data || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, []);

  const hasActiveFilters = dateFrom || dateTo || selectedAgent !== 'all';

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedAgent('all');
  };

  // Helper: check if a date string falls within the filter range
  const isInDateRange = (dateStr) => {
    if (!dateStr) return true;
    const d = dateStr.split('T')[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  // Filter data based on active filters
  const filteredSalesOrders = useMemo(() => {
    let filtered = salesOrders || [];
    if (dateFrom || dateTo) {
      filtered = filtered.filter(o => isInDateRange(o.created_at || o.date));
    }
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(o => o.sales_rep_id === selectedAgent || o.created_by === selectedAgent);
    }
    return filtered;
  }, [salesOrders, dateFrom, dateTo, selectedAgent]);

  const filteredInvoices = useMemo(() => {
    let filtered = invoices || [];
    if (dateFrom || dateTo) {
      filtered = filtered.filter(inv => isInDateRange(inv.created_at || inv.date || inv.invoice_date));
    }
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(inv => inv.created_by === selectedAgent);
    }
    return filtered;
  }, [invoices, dateFrom, dateTo, selectedAgent]);

  const filteredLeads = useMemo(() => {
    let filtered = leads || [];
    if (dateFrom || dateTo) {
      filtered = filtered.filter(l => isInDateRange(l.created_at));
    }
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(l => l.assigned_to === selectedAgent);
    }
    return filtered;
  }, [leads, dateFrom, dateTo, selectedAgent]);

  const filteredCallLogs = useMemo(() => {
    let filtered = callLogs || [];
    if (dateFrom || dateTo) {
      filtered = filtered.filter(l => isInDateRange(l.call_start_time || l.created_at));
    }
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(l => l.agent_id === selectedAgent);
    }
    return filtered;
  }, [callLogs, dateFrom, dateTo, selectedAgent]);

  const customerStats = useMemo(() => {
    const stats = {};

    // Initialize all customers
    customers.forEach(c => {
      stats[c.id] = {
        id: c.id,
        name: c.company_name || c.contact_name || '-',
        contact: c.contact_name || '',
        phone: c.phone || '',
        orderCount: 0,
        totalSales: 0,
        invoiceCount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        totalDebt: 0,
        lastOrderDate: null,
      };
    });

    // Aggregate sales orders
    filteredSalesOrders.forEach(order => {
      const cid = order.customer_id;
      if (!cid || !stats[cid]) return;
      stats[cid].orderCount += 1;
      stats[cid].totalSales += (order.total_amount || 0);
      const orderDate = order.created_at || order.date;
      if (orderDate && (!stats[cid].lastOrderDate || orderDate > stats[cid].lastOrderDate)) {
        stats[cid].lastOrderDate = orderDate;
      }
    });

    // Aggregate invoices
    filteredInvoices.forEach(inv => {
      const cid = inv.customer_id;
      if (!cid || !stats[cid]) return;
      stats[cid].invoiceCount += 1;
      stats[cid].totalInvoiced += (inv.total_amount || 0);
      stats[cid].totalPaid += (inv.paid_amount || 0);
      stats[cid].totalDebt += ((inv.total_amount || 0) - (inv.paid_amount || 0));
    });

    return Object.values(stats);
  }, [customers, filteredSalesOrders, filteredInvoices]);

  const sortedStats = useMemo(() => {
    return [...customerStats].sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [customerStats, sortField, sortDir]);

  const totals = useMemo(() => {
    return customerStats.reduce((acc, c) => ({
      orderCount: acc.orderCount + c.orderCount,
      totalSales: acc.totalSales + c.totalSales,
      totalInvoiced: acc.totalInvoiced + c.totalInvoiced,
      totalPaid: acc.totalPaid + c.totalPaid,
      totalDebt: acc.totalDebt + c.totalDebt,
    }), { orderCount: 0, totalSales: 0, totalInvoiced: 0, totalPaid: 0, totalDebt: 0 });
  }, [customerStats]);

  // Daily leads chart data (last 30 days)
  const dailyLeadsData = useMemo(() => {
    const days = 30;
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = filteredLeads.filter(l => {
        const created = l.created_at?.split('T')[0];
        return created === dateStr;
      }).length;
      data.push({
        date: dateStr,
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        count,
      });
    }
    return data;
  }, [filteredLeads]);

  // Call statistics data
  const callStatsData = useMemo(() => {
    const logs = filteredCallLogs;
    if (callViewMode === 'daily') {
      const days = 30;
      const data = [];
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayLogs = logs.filter(l => (l.call_start_time || l.created_at)?.split('T')[0] === dateStr);
        data.push({
          date: dateStr,
          label: `${date.getDate()}/${date.getMonth() + 1}`,
          inbound: dayLogs.filter(l => l.call_type === 'inbound').length,
          outbound: dayLogs.filter(l => l.call_type === 'outbound').length,
          missed: dayLogs.filter(l => l.call_type === 'missed').length,
        });
      }
      return data;
    } else {
      // Monthly view - last 12 months
      const monthNames = {
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
        ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
      };
      const names = monthNames[language] || monthNames.en;
      const data = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthLogs = logs.filter(l => {
          const d = new Date(l.call_start_time || l.created_at);
          return d.getFullYear() === year && d.getMonth() === month;
        });
        data.push({
          label: `${names[month]} ${year}`,
          inbound: monthLogs.filter(l => l.call_type === 'inbound').length,
          outbound: monthLogs.filter(l => l.call_type === 'outbound').length,
          missed: monthLogs.filter(l => l.call_type === 'missed').length,
        });
      }
      return data;
    }
  }, [filteredCallLogs, callViewMode, language]);

  // Call duration data (hours per day, last 30 days)
  const callDurationData = useMemo(() => {
    const logs = filteredCallLogs;
    const days = 30;
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => (l.call_start_time || l.created_at)?.split('T')[0] === dateStr);
      const inboundSecs = dayLogs.filter(l => l.call_type === 'inbound').reduce((s, l) => s + (l.call_duration || 0), 0);
      const outboundSecs = dayLogs.filter(l => l.call_type === 'outbound').reduce((s, l) => s + (l.call_duration || 0), 0);
      data.push({
        date: dateStr,
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        inboundHours: +(inboundSecs / 3600).toFixed(2),
        outboundHours: +(outboundSecs / 3600).toFixed(2),
      });
    }
    return data;
  }, [filteredCallLogs]);

  // Recent calls for table (limited to 50)
  const recentCalls = useMemo(() => {
    return [...filteredCallLogs]
      .sort((a, b) => new Date(b.call_start_time || b.created_at) - new Date(a.call_start_time || a.created_at))
      .slice(0, 50);
  }, [filteredCallLogs]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handlePlayRecording = (url, callId) => {
    if (playingAudio === callId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    audioRef.current = audio;
    setPlayingAudio(callId);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getCallTypeBadge = (type) => {
    switch (type) {
      case 'inbound': return <Badge className="bg-green-100 text-green-700">{t('incoming_calls') || 'Kiruvchi'}</Badge>;
      case 'outbound': return <Badge className="bg-blue-100 text-blue-700">{t('outgoing_calls') || 'Chiquvchi'}</Badge>;
      case 'missed': return <Badge className="bg-red-100 text-red-700">{t('missed_calls') || 'Javobsiz'}</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const SortHeader = ({ field, children }) => (
    <TableHead
      className="cursor-pointer hover:bg-slate-50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-600' : 'text-slate-400'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />

      {/* Filter Bar */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="w-4 h-4" />
              {t('filters') || 'Filtrlar'}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">{t('date_from') || 'Dan'}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">{t('date_to') || 'Gacha'}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder={t('all_employees') || 'Barcha xodimlar'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_employees') || 'Barcha xodimlar'}</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-sm text-slate-500">
                <X className="w-3 h-3 mr-1" />
                {t('reset_filters') || 'Tozalash'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-5">
            <p className="text-sm text-slate-600 mb-1">{t('total_orders') || 'Jami buyurtmalar'}</p>
            <p className="text-2xl font-bold text-slate-900">{totals.orderCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-5">
            <p className="text-sm text-slate-600 mb-1">{t('total_sales') || 'Jami sotuvlar'}</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalSales)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-5">
            <p className="text-sm text-slate-600 mb-1">{t('total_paid') || "To'langan"}</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-5">
            <p className="text-sm text-slate-600 mb-1">{t('total_debt') || 'Qarzdorlik'}</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalDebt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Leads Chart */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            {t('daily_leads')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyLeadsData.some(d => d.count > 0) ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyLeadsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                  />
                  <Bar dataKey="count" name={t('leads_per_day')} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>{t('no_leads_data')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Statistics Chart */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-blue-600" />
              {t('call_statistics')}
            </CardTitle>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setCallViewMode('daily')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  callViewMode === 'daily' ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('daily_view')}
              </button>
              <button
                onClick={() => setCallViewMode('monthly')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  callViewMode === 'monthly' ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('monthly_view')}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {callStatsData.some(d => d.inbound > 0 || d.outbound > 0 || d.missed > 0) ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callStatsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={callViewMode === 'daily' ? 2 : 0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="inbound" name={t('incoming_calls')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outbound" name={t('outgoing_calls')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="missed" name={t('missed_calls')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <PhoneCall className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>{t('no_calls_data')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Duration Report */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            {t('call_duration_report')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callDurationData.some(d => d.inboundHours > 0 || d.outboundHours > 0) ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callDurationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    formatter={(value) => [`${value} ${t('hours_spent')}`, undefined]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
                  />
                  <Legend />
                  <Bar dataKey="inboundHours" name={t('incoming_hours')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outboundHours" name={t('outgoing_hours')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>{t('no_calls_data')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Recordings Table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-indigo-600" />
            {t('calls_table') || "Qo'ng'iroqlar jadvali"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('date') || 'Sana'}</TableHead>
                    <TableHead>{t('contact') || 'Kontakt'}</TableHead>
                    <TableHead>{t('agent') || 'Xodim'}</TableHead>
                    <TableHead>{t('type') || 'Turi'}</TableHead>
                    <TableHead>{t('duration') || 'Davomiyligi'}</TableHead>
                    <TableHead>{t('recording') || 'Yozuv'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCalls.map((call, idx) => (
                    <TableRow key={call.id} className="hover:bg-slate-50/80">
                      <TableCell className="text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="text-sm">
                        {call.call_start_time
                          ? new Date(call.call_start_time).toLocaleString(language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US', {
                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">
                            {call.contact_name || (call.call_type === 'outbound' ? call.receiver_number : call.caller_number) || '-'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {call.call_type === 'outbound' ? call.receiver_number : call.caller_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {call.agent_name || '-'}
                      </TableCell>
                      <TableCell>{getCallTypeBadge(call.call_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="tabular-nums text-sm">{formatDuration(call.call_duration || 0)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.recording_url ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => handlePlayRecording(call.recording_url, call.id)}
                            >
                              {playingAudio === call.id ? (
                                <Pause className="w-3 h-3 text-blue-600" />
                              ) : (
                                <Play className="w-3 h-3 text-blue-600" />
                              )}
                            </Button>
                            <a
                              href={call.recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex"
                            >
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <Download className="w-3 h-3 text-slate-500" />
                              </Button>
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <PhoneCall className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>{t('no_calls_data')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer report table */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle>{t('customer_report') || 'Mijozlar bo\'yicha hisobot'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{t('customer') || 'Mijoz'}</TableHead>
                  <SortHeader field="orderCount">{t('orders') || 'Buyurtmalar'}</SortHeader>
                  <SortHeader field="totalSales">{t('total_sales') || 'Sotuvlar'}</SortHeader>
                  <SortHeader field="totalInvoiced">{t('invoiced') || 'Hisob-faktura'}</SortHeader>
                  <SortHeader field="totalPaid">{t('paid') || "To'langan"}</SortHeader>
                  <SortHeader field="totalDebt">{t('debt') || 'Qarzdorlik'}</SortHeader>
                  <TableHead>{t('last_order') || 'Oxirgi buyurtma'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStats.map((c, idx) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/80">
                    <TableCell className="text-slate-500">{idx + 1}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">{c.name}</p>
                        {c.contact && c.contact !== c.name && (
                          <p className="text-xs text-slate-500">{c.contact}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{c.orderCount}</TableCell>
                    <TableCell className="tabular-nums font-medium">{formatCurrency(c.totalSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(c.totalInvoiced)}</TableCell>
                    <TableCell className="tabular-nums text-green-600">{formatCurrency(c.totalPaid)}</TableCell>
                    <TableCell className={`tabular-nums font-medium ${c.totalDebt > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {formatCurrency(c.totalDebt)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'en-US') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      {t('no_data') || "Ma'lumot topilmadi"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { toast } = useToast();
  const { salesOrders, invoices } = useSales();
  const { formatCurrency } = useCurrencyFormatter();
  const {
    customers,
    leads,
    opportunities,
    isLoading,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createLead,
    updateLead,
    deleteLead,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    refreshData,
  } = useCustomers();

  // Refresh data when navigating to this page
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const rawTab = searchParams.get("tab") || "customers";
  const activeTab = rawTab === "analytics" ? "reports" : rawTab;
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [opportunityToDelete, setOpportunityToDelete] = useState(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [customerToCall, setCustomerToCall] = useState(null);
  const [callLogs, setCallLogs] = useState([]);

  // Load call logs
  useEffect(() => {
    const loadCallLogs = async () => {
      try {
        const logs = await pbxService.getCallLogs(activeCompany?.id);
        setCallLogs(Array.isArray(logs) ? logs : []);
      } catch (error) {
        console.error('Failed to load call logs:', error);
        setCallLogs([]);
      }
    };
    loadCallLogs();
  }, [activeCompany]);

  // Handle call customer
  const handleCallCustomer = async (customer) => {
    if (customer.phone) {
      setCustomerToCall(customer);
      setActiveTab("calls");
    }
  };

  useEffect(() => {
    let filtered = customers;

    if (searchQuery) {
      filtered = filtered.filter(customer =>
        customer.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }


    setFilteredCustomers(filtered);
  }, [customers, searchQuery]);

  const handleSave = async (customerData) => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, customerData);
      } else {
        await createCustomer(customerData);
      }
      setShowForm(false);
      setEditingCustomer(null);
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.error?.code === 'DUPLICATE_DETECTED') {
        const duplicates = error.response.data.error.data?.duplicates || [];
        const names = duplicates.map(d => d.name).join(', ');
        const fields = [...new Set(duplicates.flatMap(d => d.matched_fields))].join(', ');
        toast({
          variant: "destructive",
          title: t('duplicate_detected') || "Duplicate Detected",
          description: `${t('duplicate_contact_found') || 'Similar contact(s) already exist'}: ${names} (${fields})`,
        });
      } else {
        toast({
          variant: "destructive",
          title: t('error') || "Error",
          description: error.response?.data?.error?.message || error.message || 'Failed to save',
        });
      }
    }
  };

  const handleOpportunityUpdate = (updatedOpportunity) => {
    updateOpportunity(updatedOpportunity.id, updatedOpportunity);
  };

  const handleOpportunitySave = (opportunityData) => {
    if (editingOpportunity) {
      updateOpportunity(editingOpportunity.id, opportunityData);
    } else {
      createOpportunity(opportunityData);
    }
    setShowOpportunityForm(false);
    setEditingOpportunity(null);
  };

  const handleOpportunityEdit = (opportunity) => {
    setEditingOpportunity(opportunity);
    setShowOpportunityForm(true);
  };

  const handleOpportunityDeleteConfirm = () => {
    if (opportunityToDelete) {
      deleteOpportunity(opportunityToDelete.id);
      setOpportunityToDelete(null);
    }
  };

  // Lead handlers
  const handleLeadUpdate = (updatedLead) => {
    updateLead(updatedLead.id, updatedLead);
  };

  const handleLeadEdit = (lead) => {
    setEditingLead(lead);
    setShowLeadForm(true);
  };

  const handleLeadSave = async (leadData) => {
    try {
      if (editingLead) {
        await updateLead(editingLead.id, leadData);
      } else {
        await createLead(leadData);
      }
      setShowLeadForm(false);
      setEditingLead(null);
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.error?.code === 'DUPLICATE_DETECTED') {
        const duplicates = error.response.data.error.data?.duplicates || [];
        const names = duplicates.map(d => d.name).join(', ');
        const fields = [...new Set(duplicates.flatMap(d => d.matched_fields))].join(', ');
        toast({
          variant: "destructive",
          title: t('duplicate_detected') || "Duplicate Detected",
          description: `${t('duplicate_lead_found') || 'Similar lead(s) already exist'}: ${names} (${fields})`,
        });
      } else {
        toast({
          variant: "destructive",
          title: t('error') || "Error",
          description: error.response?.data?.error?.message || error.message || 'Failed to save',
        });
      }
    }
  };

  const handleLeadDeleteConfirm = () => {
    if (leadToDelete) {
      deleteLead(leadToDelete.id);
      setLeadToDelete(null);
    }
  };

  const handleCallLead = (lead) => {
    if (lead.phone) {
      setCustomerToCall({
        id: lead.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name || lead.name,
        phone: lead.phone,
        email: lead.email
      });
      setActiveTab("calls");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      prospect: "bg-yellow-100 text-yellow-800 border-yellow-200",
      active: "bg-green-100 text-green-800 border-green-200",
      inactive: "bg-gray-100 text-gray-800 border-gray-200",
      churned: "bg-red-100 text-red-800 border-red-200"
    };
    return colors[status] || colors.prospect;
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Metrics */}
        <CustomerMetrics customers={customers} leads={leads} opportunities={opportunities} language={language} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full flex-wrap sm:flex-nowrap bg-white/80 backdrop-blur-sm p-1 md:p-2 rounded-xl border border-slate-200/60 shadow-lg gap-1 h-auto overflow-x-auto">
            <TabsTrigger
              value="customers"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('customers')}</span>
              <span className="sm:hidden">Customers</span>
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Target className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('leads_pipeline')}</span>
              <span className="sm:hidden">Pipeline</span>
            </TabsTrigger>
            <TabsTrigger
              value="calls"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <PhoneCall className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('calls')}</span>
              <span className="sm:hidden">Calls</span>
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <FileText className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('reports') || 'Hisobotlar'}</span>
              <span className="sm:hidden">{t('reports') || 'Hisobotlar'}</span>
            </TabsTrigger>
            <TabsTrigger
              value="website-script"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Globe className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              <span className="hidden md:inline">{language === 'uz' ? 'Skript' : 'Script'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-6">
            {/* Filters */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={`${t('search')} ${t('customers').toLowerCase()}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {canCreate(MODULES.CUSTOMERS) && (
                    <Button
                      onClick={() => {
                        setEditingCustomer(null);
                        setShowForm(true);
                      }}
                      className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t('add_customer') || t('add')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customers Table */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle>{t('customers_directory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('company_name')}</TableHead>
                        <TableHead>{t('contact')}</TableHead>
                        <TableHead>{t('tags') || 'Tags'}</TableHead>
                        <TableHead>{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow key={customer.id} className="hover:bg-slate-50/80">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] rounded-full flex items-center justify-center">
                                <Building className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{customer.company_name}</p>
                                <p className="text-sm text-slate-500">{customer.contact_name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{customer.email}</span>
                              </div>
                              {customer.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {customer.tags?.length > 0
                                ? customer.tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                  ))
                                : <span className="text-slate-400 text-sm">—</span>
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {customer.phone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 hover:border-green-200"
                                  onClick={() => handleCallCustomer(customer)}
                                  title={t('call')}
                                >
                                  <PhoneCall className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200"
                                onClick={() => navigate('/salesorders', { state: { createOrderForCustomer: customer } })}
                                title={t('create_sales_order') || 'Create Sales Order'}
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </Button>
                              {canUpdate(MODULES.CUSTOMERS) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingCustomer(customer);
                                    setShowForm(true);
                                  }}
                                >
                                  {t('edit')}
                                </Button>
                              )}
                              {canDelete(MODULES.CUSTOMERS) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                                  onClick={() => setCustomerToDelete(customer)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredCustomers.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">{t('no_customers_found')}</h3>
                    <p className="text-slate-500 mb-4">{t('get_started_message')}</p>
                    {canCreate(MODULES.CUSTOMERS) && (
                      <Button
                        onClick={() => {
                          setEditingCustomer(null);
                          setShowForm(true);
                        }}
                        className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {t('add_first_customer')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <LeadsKanban
              leads={leads}
              onUpdateLead={canUpdate(MODULES.CUSTOMERS) ? handleLeadUpdate : undefined}
              onEditLead={canUpdate(MODULES.CUSTOMERS) ? handleLeadEdit : undefined}
              onDeleteLead={canDelete(MODULES.CUSTOMERS) ? (lead) => setLeadToDelete(lead) : undefined}
              onCallLead={handleCallLead}
              onAddLead={canCreate(MODULES.CUSTOMERS) ? () => {
                setEditingLead(null);
                setShowLeadForm(true);
              } : undefined}
              language={language}
            />
          </TabsContent>

          <TabsContent value="calls">
            <CallInterface
              callLogs={callLogs}
              customer={customerToCall}
              language={language}
              companyId={activeCompany?.id}
              onUpdate={async () => {
                try {
                  const logs = await pbxService.getCallLogs(activeCompany?.id);
                  setCallLogs(logs || []);
                } catch (error) {
                  console.error('Failed to refresh call logs:', error);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="reports">
            <CustomerReports
              customers={customers}
              salesOrders={salesOrders}
              invoices={invoices}
              leads={leads}
              callLogs={callLogs}
              formatCurrency={formatCurrency}
              language={language}
              t={t}
            />
          </TabsContent>

          <TabsContent value="website-script" className="space-y-6">
            <WebsiteScript />
          </TabsContent>
        </Tabs>

        {/* Form Modal */}
        {showForm && (
          <CustomerForm
            customer={editingCustomer}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingCustomer(null);
            }}
            language={language}
          />
        )}

        {/* Lead Form Modal */}
        {showLeadForm && (
          <LeadForm
            lead={editingLead}
            onSave={handleLeadSave}
            onCancel={() => {
              setShowLeadForm(false);
              setEditingLead(null);
            }}
            language={language}
          />
        )}

        {/* Delete Confirmation Modal */}
        <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-900">
                Delete Customer
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600 mt-2">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{customerToDelete?.company_name}</span>?
                This action cannot be undone and all associated data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 sm:justify-center gap-3">
              <AlertDialogCancel
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                onClick={() => {
                  deleteCustomer(customerToDelete.id);
                  setCustomerToDelete(null);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Customer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Opportunity Form Modal */}
        {showOpportunityForm && (
          <OpportunityForm
            opportunity={editingOpportunity}
            onSave={handleOpportunitySave}
            onCancel={() => {
              setShowOpportunityForm(false);
              setEditingOpportunity(null);
            }}
            language={language}
          />
        )}

        {/* Opportunity Delete Confirmation Modal */}
        <AlertDialog open={!!opportunityToDelete} onOpenChange={(open) => !open && setOpportunityToDelete(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-900">
                {t('delete_opportunity')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600 mt-2">
                {t('delete_opportunity_confirm')} <span className="font-semibold text-slate-900">{opportunityToDelete?.name}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 sm:justify-center gap-3">
              <AlertDialogCancel
                onClick={() => setOpportunityToDelete(null)}
                className="flex-1 sm:flex-none"
              >
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                onClick={handleOpportunityDeleteConfirm}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lead Delete Confirmation Modal */}
        <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-900">
                {t('delete_lead')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600 mt-2">
                {t('delete_lead_confirm')} <span className="font-semibold text-slate-900">{leadToDelete?.contact_name || leadToDelete?.name}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 sm:justify-center gap-3">
              <AlertDialogCancel
                onClick={() => setLeadToDelete(null)}
                className="flex-1 sm:flex-none"
              >
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                onClick={handleLeadDeleteConfirm}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
