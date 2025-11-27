
import React, { useState, useEffect, useCallback } from "react";
import { Customer, Lead, Opportunity, CallLog } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
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
  Mail,
  DollarSign,
  Target,
  Brain,
  UserPlus,
  Building
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import CustomerForm from "@/components/customers/CustomerForm";
import CustomerMetrics from "@/components/customers/CustomerMetrics";
import CustomerInsights from "@/components/customers/CustomerInsights";
import DragDropKanban from "@/components/crm/DragDropKanban";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";

export default function Customers() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [insights, setInsights] = useState(null);
  const [activeTab, setActiveTab] = useState("customers");
  const [isLoading, setIsLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await Customer.list("-created_date");
      setCustomers(data);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
    setIsLoading(false);
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const data = await Lead.list("-created_date", 50);
      setLeads(data);
    } catch (error) {
      console.error("Error loading leads:", error);
    }
  }, []);

  const loadOpportunities = useCallback(async () => {
    try {
      const data = await Opportunity.list("-created_date", 50);
      console.log('Loaded opportunities:', data);
      setOpportunities(data);
    } catch (error) {
      console.error("Error loading opportunities:", error);
    }
  }, []);

  const generateInsights = useCallback(async () => {
    try {
      const customerData = await Customer.list();
      const leadData = await Lead.list();
      const oppData = await Opportunity.list();

      const totalRevenue = customerData.reduce((sum, c) => sum + (c.monthly_value || 0), 0) * 12;
      const conversionRate = leadData.length > 0 ? (customerData.length / leadData.length * 100) : 0;
      const avgDealSize = oppData.length > 0 ? oppData.reduce((sum, o) => sum + (o.expected_value || 0), 0) / oppData.length : 0;

      const result = await InvokeLLM({
        prompt: `You are the CRM AI of Genix. Analyze this sales and customer data:

        Customer Data:
        - Total customers: ${customerData.length}
        - Active customers: ${customerData.filter(c => c.status === 'active').length}
        - Total annual revenue: $${totalRevenue.toLocaleString()}
        - Industry breakdown: ${JSON.stringify(customerData.reduce((acc, c) => { acc[c.industry] = (acc[c.industry] || 0) + 1; return acc; }, {}))}

        Lead & Sales Data:
        - Total leads: ${leadData.length}
        - Qualified leads: ${leadData.filter(l => l.status === 'qualified').length}
        - Conversion rate: ${conversionRate.toFixed(1)}%
        - Active opportunities: ${oppData.filter(o => !['closed_won', 'closed_lost'].includes(o.stage)).length}
        - Average deal size: $${avgDealSize.toLocaleString()}

        Provide 3 strategic CRM insights focusing on:
        1. Customer retention and expansion opportunities
        2. Lead qualification and conversion optimization
        3. Sales pipeline health and forecasting accuracy`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                  impact: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        }
      });
      setInsights(result.insights);
    } catch (error) {
      console.error("Error generating insights:", error);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    loadLeads();
    loadOpportunities();
    generateInsights();
  }, [loadCustomers, loadLeads, loadOpportunities, generateInsights]);

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

  const handleSave = async (customerData) => {
    try {
      if (editingCustomer) {
        await Customer.update(editingCustomer.id, customerData);
      } else {
        await Customer.create(customerData);
      }
      loadCustomers();
      setShowForm(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error("Error saving customer:", error);
    }
  };

  const handleOpportunityUpdate = (updatedOpportunity) => {
    console.log('Opportunity updated:', updatedOpportunity);
    setOpportunities(prev =>
      prev.map(opp => opp.id === updatedOpportunity.id ? updatedOpportunity : opp)
    );
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
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--genix-navy)] mb-2">{t('crm_title')}</h1>
            <p className="text-base md:text-lg text-slate-600">{t('crm_subtitle')}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button
              onClick={() => {
                setEditingCustomer(null);
                setShowForm(true);
              }}
              className="flex-1 md:flex-none bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] hover:from-[var(--genix-blue)]/90 hover:to-[var(--genix-purple)]/90 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t('add_customer')}</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <CustomerMetrics customers={customers} leads={leads} opportunities={opportunities} language={language} />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm p-1 md:p-2 rounded-xl border border-slate-200/60 shadow-lg">
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
                      <SelectItem value="all">All {t('status')}</SelectItem>
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
                      <SelectItem value="all">All {t('industry')}</SelectItem>
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
                <CardTitle>{t('customers')} Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('company_name')}</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>{t('industry')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead>{t('value')}</TableHead>
                        <TableHead>Actions</TableHead>
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
            <DragDropKanban
              opportunities={opportunities}
              leads={leads}
              onUpdateOpportunity={handleOpportunityUpdate}
              language={language}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>Customer {t('analytics')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-center py-8">
                    <TrendingUp className="w-16 h-16 mx-auto text-slate-300" />
                    <p className="text-slate-600">Advanced analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardHeader>
                  <CardTitle>{t('industry')} Breakdown</CardTitle>
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

        {/* AI Insights - Moved to bottom */}
        {insights && insights.length > 0 && (
          <CustomerInsights insights={insights} language={language} />
        )}
      </div>
    </div>
  );
}
