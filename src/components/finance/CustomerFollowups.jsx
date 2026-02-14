import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import {
  Search, Mail, Phone, MessageSquare, FileText, Clock, AlertTriangle,
  DollarSign, Users, Send, Plus, Calendar, CheckCircle, XCircle,
  Settings, Loader2, ChevronRight, History, Handshake
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { followupsService, followupLevelsService } from '@/api/services/followups';

export default function CustomerFollowups() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [activeTab, setActiveTab] = useState('customers');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Data
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [levels, setLevels] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);

  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSendReminderModal, setShowSendReminderModal] = useState(false);
  const [showPromiseModal, setShowPromiseModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);

  // Form states
  const [reminderForm, setReminderForm] = useState({
    level_id: '',
    send_email: true,
    send_sms: false
  });
  const [promiseForm, setPromiseForm] = useState({
    promised_date: '',
    promised_amount: '',
    notes: ''
  });
  const [noteForm, setNoteForm] = useState({ description: '' });
  const [levelForm, setLevelForm] = useState({
    name: '',
    sequence: 1,
    delay_days: 7,
    send_email: true,
    send_sms: false,
    send_letter: false,
    email_subject: '',
    email_body: '',
    block_sales: false,
    add_late_fee: false,
    late_fee_type: 'percentage',
    late_fee_value: 0,
    is_active: true
  });

  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, customersRes, levelsRes] = await Promise.all([
        followupsService.getSummary(),
        followupsService.listCustomerFollowups({ status: statusFilter !== 'all' ? statusFilter : undefined, search: searchQuery || undefined }),
        followupLevelsService.list()
      ]);
      setSummary(summaryRes);
      setCustomers(customersRes || []);
      setLevels(levelsRes || []);
    } catch (error) {
      console.error('Failed to fetch followup data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchCustomerDetails = async (customerId) => {
    try {
      const details = await followupsService.getCustomerDetails(customerId);
      setCustomerDetails(details);
    } catch (error) {
      console.error('Failed to fetch customer details:', error);
    }
  };

  const handleViewDetails = (customer) => {
    setSelectedCustomer(customer);
    fetchCustomerDetails(customer.customer_id);
    setShowDetailsModal(true);
  };

  const handleSendReminder = async () => {
    if (!selectedCustomer || !reminderForm.level_id) return;
    setIsSaving(true);
    try {
      await followupsService.sendReminder({
        customer_id: selectedCustomer.customer_id,
        level_id: reminderForm.level_id,
        send_email: reminderForm.send_email,
        send_sms: reminderForm.send_sms
      });
      setShowSendReminderModal(false);
      fetchData();
      if (showDetailsModal) {
        fetchCustomerDetails(selectedCustomer.customer_id);
      }
    } catch (error) {
      console.error('Failed to send reminder:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePromise = async () => {
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      await followupsService.createPromise({
        customer_id: selectedCustomer.customer_id,
        promised_date: promiseForm.promised_date,
        promised_amount: parseFloat(promiseForm.promised_amount),
        notes: promiseForm.notes || undefined
      });
      setShowPromiseModal(false);
      setPromiseForm({ promised_date: '', promised_amount: '', notes: '' });
      fetchData();
      if (showDetailsModal) {
        fetchCustomerDetails(selectedCustomer.customer_id);
      }
    } catch (error) {
      console.error('Failed to create promise:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      await followupsService.createAction({
        customer_id: selectedCustomer.customer_id,
        action_type: 'note',
        description: noteForm.description
      });
      setShowAddNoteModal(false);
      setNoteForm({ description: '' });
      if (showDetailsModal) {
        fetchCustomerDetails(selectedCustomer.customer_id);
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLevel = async () => {
    setIsSaving(true);
    try {
      if (editingLevel) {
        await followupLevelsService.update(editingLevel.id, levelForm);
      } else {
        await followupLevelsService.create(levelForm);
      }
      setShowLevelModal(false);
      setEditingLevel(null);
      resetLevelForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save level:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLevel = async (id) => {
    if (!confirm(t('confirm_delete') || 'Are you sure you want to delete this level?')) return;
    try {
      await followupLevelsService.delete(id);
      fetchData();
    } catch (error) {
      console.error('Failed to delete level:', error);
    }
  };

  const resetLevelForm = () => {
    setLevelForm({
      name: '',
      sequence: levels.length + 1,
      delay_days: 7,
      send_email: true,
      send_sms: false,
      send_letter: false,
      email_subject: '',
      email_body: '',
      block_sales: false,
      add_late_fee: false,
      late_fee_type: 'percentage',
      late_fee_value: 0,
      is_active: true
    });
  };

  const openEditLevel = (level) => {
    setEditingLevel(level);
    setLevelForm({
      name: level.name,
      sequence: level.sequence,
      delay_days: level.delay_days,
      send_email: level.send_email,
      send_sms: level.send_sms,
      send_letter: level.send_letter,
      email_subject: level.email_subject || '',
      email_body: level.email_body || '',
      block_sales: level.block_sales,
      add_late_fee: level.add_late_fee,
      late_fee_type: level.late_fee_type || 'percentage',
      late_fee_value: level.late_fee_value || 0,
      is_active: level.is_active
    });
    setShowLevelModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ok: { color: 'bg-green-100 text-green-800', label: t('status_ok') || 'OK' },
      in_followup: { color: 'bg-yellow-100 text-yellow-800', label: t('in_followup') || 'In Follow-up' },
      blocked: { color: 'bg-red-100 text-red-800', label: t('blocked') || 'Blocked' }
    };
    const config = statusConfig[status] || statusConfig.ok;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getActionTypeBadge = (type) => {
    const types = {
      email_sent: { color: 'bg-blue-100 text-blue-800', icon: Mail, label: t('email_sent') || 'Email Sent' },
      sms_sent: { color: 'bg-purple-100 text-purple-800', icon: MessageSquare, label: t('sms_sent') || 'SMS Sent' },
      manual_call: { color: 'bg-green-100 text-green-800', icon: Phone, label: t('manual_call') || 'Call' },
      note: { color: 'bg-slate-100 text-slate-800', icon: FileText, label: t('note') || 'Note' },
      payment_promise: { color: 'bg-yellow-100 text-yellow-800', icon: Handshake, label: t('payment_promise') || 'Promise' },
      level_escalation: { color: 'bg-red-100 text-red-800', icon: AlertTriangle, label: t('escalation') || 'Escalation' }
    };
    const config = types[type] || types.note;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPromiseStatusBadge = (status) => {
    const statuses = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: t('pending') || 'Pending' },
      kept: { color: 'bg-green-100 text-green-800', label: t('kept') || 'Kept' },
      broken: { color: 'bg-red-100 text-red-800', label: t('broken') || 'Broken' },
      cancelled: { color: 'bg-slate-100 text-slate-800', label: t('cancelled') || 'Cancelled' }
    };
    const config = statuses[status] || statuses.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('customers_overdue') || 'Customers Overdue'}</p>
                <p className="text-2xl font-bold text-slate-900">{summary?.total_customers_overdue || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('total_overdue') || 'Total Overdue'}</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(summary?.total_overdue_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('overdue_invoices') || 'Overdue Invoices'}</p>
                <p className="text-2xl font-bold text-slate-900">{summary?.overdue_invoice_count || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Handshake className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('pending_promises') || 'Pending Promises'}</p>
                <p className="text-2xl font-bold text-slate-900">{summary?.pending_promises || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="bg-slate-100/80">
                <TabsTrigger value="customers" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('customers') || 'Customers'}
                </TabsTrigger>
                <TabsTrigger value="levels" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {t('followup_levels') || 'Follow-up Levels'}
                </TabsTrigger>
              </TabsList>

              {activeTab === 'customers' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder={t('search_customers') || 'Search customers...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_statuses') || 'All Statuses'}</SelectItem>
                      <SelectItem value="in_followup">{t('in_followup') || 'In Follow-up'}</SelectItem>
                      <SelectItem value="blocked">{t('blocked') || 'Blocked'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeTab === 'levels' && (
                <Button onClick={() => { resetLevelForm(); setShowLevelModal(true); }} className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_level') || 'New Level'}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Customers Tab */}
            <TabsContent value="customers" className="m-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">{t('no_overdue_customers') || 'No customers with overdue payments'}</p>
                  <p className="text-slate-400 text-sm">{t('all_caught_up') || 'All caught up!'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('customer') || 'Customer'}</TableHead>
                        <TableHead>{t('contact') || 'Contact'}</TableHead>
                        <TableHead className="text-right">{t('total_overdue') || 'Total Overdue'}</TableHead>
                        <TableHead className="text-center">{t('days_overdue') || 'Days Overdue'}</TableHead>
                        <TableHead>{t('current_level') || 'Current Level'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleViewDetails(customer)}>
                          <TableCell>
                            <div className="font-medium">{customer.customer_name}</div>
                            <div className="text-sm text-slate-500">{customer.overdue_invoice_count} {t('invoices') || 'invoices'}</div>
                          </TableCell>
                          <TableCell>
                            {customer.customer_email && (
                              <div className="text-sm flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {customer.customer_email}
                              </div>
                            )}
                            {customer.customer_phone && (
                              <div className="text-sm flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {customer.customer_phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(customer.total_overdue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={customer.days_overdue > 30 ? 'bg-red-100 text-red-800' : customer.days_overdue > 14 ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                              {customer.days_overdue} {t('days') || 'days'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {customer.current_level_name || '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(customer.status)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setReminderForm({ level_id: '', send_email: true, send_sms: false });
                                  setShowSendReminderModal(true);
                                }}
                                title={t('send_reminder') || 'Send Reminder'}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setPromiseForm({ promised_date: '', promised_amount: String(customer.total_overdue), notes: '' });
                                  setShowPromiseModal(true);
                                }}
                                title={t('record_promise') || 'Record Promise'}
                              >
                                <Handshake className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleViewDetails(customer)}>
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Levels Tab */}
            <TabsContent value="levels" className="m-0">
              {levels.length === 0 ? (
                <div className="text-center py-16">
                  <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t('no_followup_levels') || 'No follow-up levels configured'}</p>
                  <Button onClick={() => { resetLevelForm(); setShowLevelModal(true); }} className="mt-4">
                    {t('create_first_level') || 'Create First Level'}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>{t('name') || 'Name'}</TableHead>
                        <TableHead>{t('delay_days') || 'Delay (Days)'}</TableHead>
                        <TableHead>{t('channels') || 'Channels'}</TableHead>
                        <TableHead>{t('actions_on_level') || 'Actions'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead>{t('actions') || 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levels.map((level) => (
                        <TableRow key={level.id}>
                          <TableCell className="font-mono">{level.sequence}</TableCell>
                          <TableCell className="font-medium">{level.name}</TableCell>
                          <TableCell>{level.delay_days} {t('days_after_due') || 'days after due'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {level.send_email && <Badge className="bg-blue-100 text-blue-800"><Mail className="w-3 h-3" /></Badge>}
                              {level.send_sms && <Badge className="bg-purple-100 text-purple-800"><MessageSquare className="w-3 h-3" /></Badge>}
                              {level.send_letter && <Badge className="bg-slate-100 text-slate-800"><FileText className="w-3 h-3" /></Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {level.block_sales && <Badge className="bg-red-100 text-red-800">{t('block_sales') || 'Block Sales'}</Badge>}
                              {level.add_late_fee && <Badge className="bg-orange-100 text-orange-800">{t('late_fee') || 'Late Fee'}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={level.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}>
                              {level.is_active ? (t('active') || 'Active') : (t('inactive') || 'Inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEditLevel(level)}>
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteLevel(level.id)}>
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Customer Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedCustomer?.customer_name} - {t('followup_details') || 'Follow-up Details'}
            </DialogTitle>
          </DialogHeader>

          {customerDetails ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600">{t('total_overdue') || 'Total Overdue'}</p>
                  <p className="text-xl font-bold text-red-800">{formatCurrency(customerDetails.status?.total_overdue)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600">{t('days_overdue') || 'Days Overdue'}</p>
                  <p className="text-xl font-bold text-orange-800">{customerDetails.status?.days_overdue}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">{t('current_level') || 'Current Level'}</p>
                  <p className="text-xl font-bold text-blue-800">{customerDetails.status?.current_level_name || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">{t('last_followup') || 'Last Follow-up'}</p>
                  <p className="text-sm font-medium text-slate-800">
                    {customerDetails.status?.last_followup_date
                      ? formatDistanceToNow(new Date(customerDetails.status.last_followup_date), { addSuffix: true })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={() => {
                  setReminderForm({ level_id: '', send_email: true, send_sms: false });
                  setShowSendReminderModal(true);
                }}>
                  <Send className="w-4 h-4 mr-2" />
                  {t('send_reminder') || 'Send Reminder'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setPromiseForm({ promised_date: '', promised_amount: String(customerDetails.status?.total_overdue || 0), notes: '' });
                  setShowPromiseModal(true);
                }}>
                  <Handshake className="w-4 h-4 mr-2" />
                  {t('record_promise') || 'Record Promise'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setNoteForm({ description: '' });
                  setShowAddNoteModal(true);
                }}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t('add_note') || 'Add Note'}
                </Button>
              </div>

              {/* Overdue Invoices */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('overdue_invoices') || 'Overdue Invoices'}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('invoice_number') || 'Invoice #'}</TableHead>
                      <TableHead>{t('due_date') || 'Due Date'}</TableHead>
                      <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                      <TableHead className="text-right">{t('paid') || 'Paid'}</TableHead>
                      <TableHead className="text-right">{t('balance') || 'Balance'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(customerDetails.overdue_invoices || []).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                        <TableCell>{format(new Date(inv.due_date), 'dd.MM.yyyy')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.paid_amount)}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">{formatCurrency(inv.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Action History */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {t('action_history') || 'Action History'}
                </h3>
                {(customerDetails.actions || []).length === 0 ? (
                  <p className="text-slate-500 text-sm">{t('no_actions_yet') || 'No actions recorded yet'}</p>
                ) : (
                  <div className="space-y-2">
                    {(customerDetails.actions || []).map((action) => (
                      <div key={action.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        {getActionTypeBadge(action.action_type)}
                        <div className="flex-1">
                          {action.description && <p className="text-sm">{action.description}</p>}
                          {action.level_name && <p className="text-xs text-slate-500">Level: {action.level_name}</p>}
                          {action.total_amount && <p className="text-xs text-slate-500">Amount: {formatCurrency(action.total_amount)}</p>}
                        </div>
                        <span className="text-xs text-slate-400">
                          {format(new Date(action.performed_at), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Promises */}
              {(customerDetails.promises || []).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Handshake className="w-4 h-4" />
                    {t('payment_promises') || 'Payment Promises'}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>{t('promised_date') || 'Promised Date'}</TableHead>
                        <TableHead className="text-right">{t('amount') || 'Amount'}</TableHead>
                        <TableHead>{t('status') || 'Status'}</TableHead>
                        <TableHead>{t('notes') || 'Notes'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(customerDetails.promises || []).map((promise) => (
                        <TableRow key={promise.id}>
                          <TableCell>{format(new Date(promise.promised_date), 'dd.MM.yyyy')}</TableCell>
                          <TableCell className="text-right">{formatCurrency(promise.promised_amount)}</TableCell>
                          <TableCell>{getPromiseStatusBadge(promise.status)}</TableCell>
                          <TableCell className="text-sm text-slate-500">{promise.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Reminder Modal */}
      <Dialog open={showSendReminderModal} onOpenChange={setShowSendReminderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('send_reminder') || 'Send Reminder'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('select_level') || 'Select Level'}</Label>
              <Select value={reminderForm.level_id} onValueChange={(v) => setReminderForm(prev => ({ ...prev, level_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_level') || 'Select level'} />
                </SelectTrigger>
                <SelectContent>
                  {levels.filter(l => l.is_active).map(level => (
                    <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reminderForm.send_email}
                  onChange={(e) => setReminderForm(prev => ({ ...prev, send_email: e.target.checked }))}
                  className="rounded"
                />
                <Mail className="w-4 h-4" />
                {t('send_email') || 'Send Email'}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reminderForm.send_sms}
                  onChange={(e) => setReminderForm(prev => ({ ...prev, send_sms: e.target.checked }))}
                  className="rounded"
                />
                <MessageSquare className="w-4 h-4" />
                {t('send_sms') || 'Send SMS'}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendReminderModal(false)}>{t('cancel') || 'Cancel'}</Button>
            <Button onClick={handleSendReminder} disabled={!reminderForm.level_id || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {t('send') || 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Promise Modal */}
      <Dialog open={showPromiseModal} onOpenChange={setShowPromiseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('record_payment_promise') || 'Record Payment Promise'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('promised_date') || 'Promised Date'}</Label>
              <Input
                type="date"
                value={promiseForm.promised_date}
                onChange={(e) => setPromiseForm(prev => ({ ...prev, promised_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('promised_amount') || 'Promised Amount'}</Label>
              <Input
                type="number"
                value={promiseForm.promised_amount}
                onChange={(e) => setPromiseForm(prev => ({ ...prev, promised_amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('notes') || 'Notes'}</Label>
              <Textarea
                value={promiseForm.notes}
                onChange={(e) => setPromiseForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromiseModal(false)}>{t('cancel') || 'Cancel'}</Button>
            <Button onClick={handleCreatePromise} disabled={!promiseForm.promised_date || !promiseForm.promised_amount || isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('save') || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={showAddNoteModal} onOpenChange={setShowAddNoteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('add_note') || 'Add Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('note') || 'Note'}</Label>
              <Textarea
                value={noteForm.description}
                onChange={(e) => setNoteForm({ description: e.target.value })}
                rows={4}
                placeholder={t('enter_note') || 'Enter note...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNoteModal(false)}>{t('cancel') || 'Cancel'}</Button>
            <Button onClick={handleAddNote} disabled={!noteForm.description || isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('save') || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Level Modal */}
      <Dialog open={showLevelModal} onOpenChange={(open) => { setShowLevelModal(open); if (!open) setEditingLevel(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLevel ? (t('edit_level') || 'Edit Level') : (t('new_level') || 'New Level')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('name') || 'Name'} *</Label>
                <Input
                  value={levelForm.name}
                  onChange={(e) => setLevelForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="First Reminder"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('sequence') || 'Sequence'}</Label>
                <Input
                  type="number"
                  value={levelForm.sequence}
                  onChange={(e) => setLevelForm(prev => ({ ...prev, sequence: parseInt(e.target.value) || 1 }))}
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('delay_days') || 'Days After Due Date'}</Label>
              <Input
                type="number"
                value={levelForm.delay_days}
                onChange={(e) => setLevelForm(prev => ({ ...prev, delay_days: parseInt(e.target.value) || 0 }))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('notification_channels') || 'Notification Channels'}</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levelForm.send_email}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, send_email: e.target.checked }))}
                    className="rounded"
                  />
                  <Mail className="w-4 h-4" /> Email
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levelForm.send_sms}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, send_sms: e.target.checked }))}
                    className="rounded"
                  />
                  <MessageSquare className="w-4 h-4" /> SMS
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levelForm.send_letter}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, send_letter: e.target.checked }))}
                    className="rounded"
                  />
                  <FileText className="w-4 h-4" /> Letter
                </label>
              </div>
            </div>

            {levelForm.send_email && (
              <>
                <div className="space-y-2">
                  <Label>{t('email_subject') || 'Email Subject'}</Label>
                  <Input
                    value={levelForm.email_subject}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, email_subject: e.target.value }))}
                    placeholder="Payment Reminder - Invoice Overdue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('email_body') || 'Email Body'}</Label>
                  <Textarea
                    value={levelForm.email_body}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, email_body: e.target.value }))}
                    rows={4}
                    placeholder="Use {customer_name}, {total_amount}, {days_overdue}, {company_name} as placeholders"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{t('escalation_actions') || 'Escalation Actions'}</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levelForm.block_sales}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, block_sales: e.target.checked }))}
                    className="rounded"
                  />
                  {t('block_new_sales') || 'Block New Sales'}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levelForm.add_late_fee}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, add_late_fee: e.target.checked }))}
                    className="rounded"
                  />
                  {t('add_late_fee') || 'Add Late Fee'}
                </label>
              </div>
            </div>

            {levelForm.add_late_fee && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('late_fee_type') || 'Late Fee Type'}</Label>
                  <Select value={levelForm.late_fee_type} onValueChange={(v) => setLevelForm(prev => ({ ...prev, late_fee_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t('percentage') || 'Percentage'}</SelectItem>
                      <SelectItem value="fixed">{t('fixed_amount') || 'Fixed Amount'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('late_fee_value') || 'Late Fee Value'}</Label>
                  <Input
                    type="number"
                    value={levelForm.late_fee_value}
                    onChange={(e) => setLevelForm(prev => ({ ...prev, late_fee_value: parseFloat(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={levelForm.is_active}
                onChange={(e) => setLevelForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded"
              />
              <Label>{t('is_active') || 'Active'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLevelModal(false); setEditingLevel(null); }}>{t('cancel') || 'Cancel'}</Button>
            <Button onClick={handleSaveLevel} disabled={!levelForm.name || isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('save') || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
