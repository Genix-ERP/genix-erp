
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Search,
  Phone,
  PhoneCall,
  Mail,
  UserPlus,
  Building,
  Target,
  Trash2,
  ShoppingCart,
  FileText,
  Globe,
} from "lucide-react";
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
import PipelineBoard from "@/components/crm/PipelineBoard";
import CrmReports from "@/components/crm/CrmReports";
import WebsiteScript from "@/components/crm/WebsiteScript";
import LeadForm from "@/components/crm/LeadForm";
import CallInterface from "@/components/crm/CallInterface";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { contactsService } from "@/api/services/contacts";
import { useCompany } from "@/components/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { pbxService } from "@/api/services";
import { activitiesService } from "@/api/services/crm";
import { leadsService } from "@/api/services/leads";
import { useToast } from "@/components/ui/use-toast";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatDate, formatDateTime } from '@/utils/formatDate';


export default function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { toast } = useToast();
  const { formatCurrency } = useCurrencyFormatter();
  const {
    customers,
    leads,
    isLoading,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createLead,
    updateLead,
    deleteLead,
    refreshData,
  } = useCustomers();

  // Refresh data when navigating to this page
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Header stats (GET /leads/stats) — refreshed whenever the lead list changes
  const [leadStats, setLeadStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    leadsService.getStats(activeCompany?.id)
      .then((s) => { if (!cancelled) setLeadStats(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeCompany?.id, leads]);

  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const rawTab = searchParams.get("tab") || "leads";
  const activeTab = rawTab === "analytics" ? "reports" : rawTab;
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [customerToCall, setCustomerToCall] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [salesHistoryCustomer, setSalesHistoryCustomer] = useState(null);
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);

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
      } else if (customerData.__order) {
        // Combined "customer + sales order + manufacture order (+ upfront payment)" in one save.
        const o = customerData.__order;
        const res = await contactsService.createFullOrder({
          customer: {
            name: customerData.company_name,
            contact_name: customerData.contact_name,
            email: customerData.email,
            phone: customerData.phone,
            address: customerData.address?.street,
            city: customerData.address?.city,
            country: customerData.address?.country,
            notes: customerData.notes,
          },
          product_id: o.product_id,
          quantity: o.quantity,
          profit_percent: o.profit_percent,
          paid_amount: o.paid_amount,
          components: o.components,
          notes: customerData.notes,
        });
        toast({
          title: t('success') || 'Success',
          description: `${t('customer_order_created') || 'Mijoz va buyurtma yaratildi'}${res?.order_number ? ` (${res.order_number})` : ''}`,
        });
        if (typeof refreshData === 'function') await refreshData();
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

  const openSalesHistory = async (customer) => {
    setSalesHistoryCustomer(customer);
    setSalesHistory([]);
    setSalesHistoryLoading(true);
    try {
      const data = await contactsService.getSales(customer.id);
      setSalesHistory(Array.isArray(data) ? data : []);
    } catch {
      setSalesHistory([]);
    } finally {
      setSalesHistoryLoading(false);
    }
  };

  // Lead handlers
  const handleLeadEdit = (lead) => {
    setEditingLead(lead);
    setShowLeadForm(true);
  };

  const handleLeadSave = async (leadData, followupPayload) => {
    try {
      // Save the lead first so we have an ID for the activity link
      // (especially important when creating a brand-new lead).
      let savedLead;
      if (editingLead) {
        savedLead = await updateLead(editingLead.id, leadData);
        // updateLead may not return the entity in some implementations.
        if (!savedLead || !savedLead.id) savedLead = { ...editingLead, ...leadData };
      } else {
        savedLead = await createLead(leadData);
      }

      // If the user scheduled a follow-up, create the activity now.
      // We swallow individual activity errors with a toast so the
      // lead save itself isn't rolled back — the lead is the source
      // of truth, the reminder is a nice-to-have layered on top.
      if (followupPayload && savedLead?.id) {
        try {
          await activitiesService.create({
            ...followupPayload,
            lead_id: savedLead.id,
          });
          toast({
            title: t('followup_scheduled') || 'Follow-up scheduled',
            description:
              followupPayload.start_datetime
                ? formatDateTime(followupPayload.start_datetime)
                : '',
          });
        } catch (activityErr) {
          console.warn('Failed to create follow-up activity:', activityErr);
          toast({
            variant: 'destructive',
            title: t('followup_failed') || 'Could not save follow-up',
            description:
              activityErr.response?.data?.error?.message ||
              activityErr.message ||
              '',
          });
        }
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

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Metrics */}
        <CustomerMetrics customers={customers} stats={leadStats} language={language} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white/80 backdrop-blur-sm p-1 md:p-2 rounded-xl border border-slate-200/60 shadow-lg">
            <TabsTrigger
              value="leads"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Target className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('leads_pipeline')}</span>
              <span className="sm:hidden">{t('crm_pipeline') || 'Voronka'}</span>
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('customers')}</span>
              <span className="sm:hidden">{t('customers')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="calls"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <PhoneCall className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('calls')}</span>
              <span className="sm:hidden">{t('calls')}</span>
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
              <span className="hidden md:inline">{t('crm_web_script') || 'Skript'}</span>
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openSalesHistory(customer)}
                                title={t('sales') || 'Sotuvlar'}
                              >
                                {t('sales') || 'Sotuvlar'}
                              </Button>
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
            <PipelineBoard
              leads={leads}
              onRefresh={refreshData}
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
            <CrmReports language={language} />
          </TabsContent>

          <TabsContent value="website-script" className="space-y-6">
            <WebsiteScript />
          </TabsContent>
        </Tabs>

      </div>

      {/* Form Modal - outside space-y-8 container to avoid margin-top interference with fixed positioning */}
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

      {/* Customer sales history */}
      {salesHistoryCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSalesHistoryCustomer(null)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{(salesHistoryCustomer.company_name || salesHistoryCustomer.name)} — {t('sales') || 'Sotuvlar'}</h3>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none" onClick={() => setSalesHistoryCustomer(null)}>✕</button>
            </div>
            {salesHistoryLoading ? (
              <p className="text-slate-500 text-sm py-8 text-center">{t('loading') || 'Yuklanmoqda...'}</p>
            ) : salesHistory.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">{t('no_sales_yet') || "Sotuvlar yo'q"}</p>
            ) : (
              <div className="divide-y">
                {salesHistory.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate('/salesorders', { state: { openOrderId: s.id } })}
                    className="w-full flex items-center justify-between py-2.5 px-2 text-left hover:bg-slate-50 rounded"
                  >
                    <div>
                      <div className="font-medium text-sm">{s.order_number}</div>
                      <div className="text-xs text-slate-500">
                        {formatDate(s.order_date || s.created_at)} · {s.status} · {s.payment_status}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{formatCurrency ? formatCurrency(s.total_amount) : s.total_amount}</div>
                      <div className="text-xs text-slate-500">{t('remaining') || 'Qoldiq'}: {formatCurrency ? formatCurrency(s.remaining) : s.remaining}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
  );
}
