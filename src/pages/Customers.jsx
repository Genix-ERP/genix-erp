
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Search,
  Plus,
  TrendingUp,
  Phone,
  PhoneCall,
  Mail,
  UserPlus,
  Building,
  Target,
  Trash2,
  Brain,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Lightbulb
} from "lucide-react";
import { analyzeCRM } from "@/api/services/aiAnalytics";
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
import LeadForm from "@/components/crm/LeadForm";
import OpportunityForm from "@/components/crm/OpportunityForm";
import CallInterface from "@/components/crm/CallInterface";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useCompany } from "@/components/contexts/CompanyContext";
import { pbxService } from "@/api/services";

export default function Customers() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
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
    deleteOpportunity
  } = useCustomers();

  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState("customers");
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

  // AI Analysis
  const crmAnalysis = useMemo(() => analyzeCRM(customers, leads, opportunities), [customers, leads, opportunities]);

  useEffect(() => {
    let filtered = customers;

    if (searchQuery) {
      filtered = filtered.filter(customer =>
        customer.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(customer => customer.status === statusFilter);
    }

    if (industryFilter !== "all") {
      filtered = filtered.filter(customer => customer.industry === industryFilter);
    }

    setFilteredCustomers(filtered);
  }, [customers, searchQuery, statusFilter, industryFilter]);

  const handleSave = (customerData) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, customerData);
    } else {
      createCustomer(customerData);
    }
    setShowForm(false);
    setEditingCustomer(null);
  };

  const handleOpportunityUpdate = (updatedOpportunity) => {
    console.log('Opportunity updated:', updatedOpportunity);
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

  const handleLeadSave = (leadData) => {
    if (editingLead) {
      updateLead(editingLead.id, leadData);
    } else {
      createLead(leadData);
    }
    setShowLeadForm(false);
    setEditingLead(null);
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

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--genix-navy)]">{t('crm_title')}</h1>
          </div>
        </div>

        {/* Metrics */}
        <CustomerMetrics customers={customers} leads={leads} opportunities={opportunities} language={language} />

        {/* AI Insights Panel */}
        {(crmAnalysis.insights.length > 0 || crmAnalysis.recommendations.length > 0) && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-indigo-600" />
                {t('ai_crm_insights')}
                <Badge className="bg-indigo-100 text-indigo-700 text-xs">{t('live')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Key Metrics */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('monthly_recurring')}</p>
                      <p className="text-lg font-bold text-slate-900">${crmAnalysis.metrics.totalMRR.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t('pipeline_value')}</p>
                      <p className="text-lg font-bold text-slate-900">${crmAnalysis.metrics.pipelineValue.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                {crmAnalysis.insights.slice(0, 2).map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                    <div className="flex items-start gap-3">
                      {insight.type === 'positive' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : insight.type === 'warning' || insight.type === 'negative' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900 text-sm">{insight.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
                        {insight.metric && (
                          <p className="text-lg font-bold text-indigo-600 mt-1">{insight.metric}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {crmAnalysis.recommendations.length > 0 && (
                <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900 text-sm mb-2">{t('ai_recommendations')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {crmAnalysis.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs bg-slate-50 rounded-full px-3 py-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              rec.impact === 'high' ? 'bg-red-400' : rec.impact === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                            }`} />
                            <span className="text-slate-700">{rec.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white/80 backdrop-blur-sm p-1 md:p-2 rounded-xl border border-slate-200/60 shadow-lg">
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
              value="analytics"
              className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--genix-blue)] data-[state=active]:to-[var(--genix-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
            >
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{t('analytics')}</span>
              <span className="sm:hidden">Analytics</span>
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
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder={t('status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')} {t('status')}</SelectItem>
                      <SelectItem value="prospect">{t('prospect')}</SelectItem>
                      <SelectItem value="active">{t('active')}</SelectItem>
                      <SelectItem value="inactive">{t('inactive')}</SelectItem>
                      <SelectItem value="churned">{t('churned')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={industryFilter} onValueChange={setIndustryFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder={t('industry')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')} {t('industry')}</SelectItem>
                      <SelectItem value="technology">{t('technology')}</SelectItem>
                      <SelectItem value="healthcare">{t('healthcare')}</SelectItem>
                      <SelectItem value="retail">{t('retail')}</SelectItem>
                      <SelectItem value="manufacturing">{t('manufacturing')}</SelectItem>
                      <SelectItem value="services">{t('services')}</SelectItem>
                    </SelectContent>
                  </Select>
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
                        <TableHead>{t('industry')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead>{t('value')}</TableHead>
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
                            <Badge variant="outline" className="capitalize">
                              {t(customer.industry) || t('other')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(customer.status)}>
                              {t(customer.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              {customer.monthly_value && (
                                <p className="font-medium text-green-600">
                                  ${customer.monthly_value.toLocaleString()}/mo
                                </p>
                              )}
                              {customer.annual_revenue && (
                                <p className="text-sm text-slate-500">
                                  ${customer.annual_revenue.toLocaleString()} annual
                                </p>
                              )}
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
                                onClick={() => {
                                  setEditingCustomer(customer);
                                  setShowForm(true);
                                }}
                              >
                                {t('edit')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                                onClick={() => setCustomerToDelete(customer)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <LeadsKanban
              leads={leads}
              onUpdateLead={handleLeadUpdate}
              onEditLead={handleLeadEdit}
              onDeleteLead={(lead) => setLeadToDelete(lead)}
              onCallLead={handleCallLead}
              onAddLead={() => {
                setEditingLead(null);
                setShowLeadForm(true);
              }}
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

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>{t('customer_analytics')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-center py-8">
                    <TrendingUp className="w-16 h-16 mx-auto text-slate-300" />
                    <p className="text-slate-600">{t('advanced_analytics_coming_soon')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>{t('sector_breakdown')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['technology', 'healthcare', 'retail', 'manufacturing', 'services'].map(industry => {
                      const count = customers.filter(c => c.industry === industry).length;
                      const percentage = customers.length > 0 ? (count / customers.length * 100) : 0;
                      return (
                        <div key={industry} className="flex items-center justify-between">
                          <span className="capitalize text-sm text-slate-600">{t(industry)}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-[var(--genix-blue)] h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
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
