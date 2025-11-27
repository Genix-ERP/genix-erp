import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Search
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Customer360({ customers, selectedCustomer, onSelectCustomer, communications, callLogs }) {
  const getCustomerCommunications = (customerId) => {
    return communications.filter(comm => comm.customer_id === customerId);
  };

  const getCustomerCalls = (customerId) => {
    return callLogs.filter(call => call.customer_id === customerId);
  };

  const getCustomerHealth = (customer) => {
    // Simple customer health calculation
    const recentComms = getCustomerCommunications(customer.id).length;
    const monthlyValue = customer.monthly_value || 0;
    
    if (monthlyValue > 1000 && recentComms > 3) return { status: 'healthy', color: 'bg-green-100 text-green-800' };
    if (monthlyValue > 500 || recentComms > 1) return { status: 'stable', color: 'bg-yellow-100 text-yellow-800' };
    return { status: 'at-risk', color: 'bg-red-100 text-red-800' };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Customer List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Customer Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search customers..." className="pl-9" />
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {customers.map((customer) => {
              const health = getCustomerHealth(customer);
              const isSelected = selectedCustomer?.id === customer.id;
              
              return (
                <div
                  key={customer.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--genix-light-blue)]/50 border-[var(--genix-blue)]' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onSelectCustomer(customer)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{customer.company_name}</h4>
                    <Badge className={health.color}>
                      {health.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{customer.contact_name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600">
                      ${(customer.monthly_value || 0).toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customer Details */}
      <div className="lg:col-span-2">
        {selectedCustomer ? (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {selectedCustomer.company_name}
                  </CardTitle>
                  <p className="text-slate-600 mt-1">{selectedCustomer.contact_name}</p>
                </div>
                <div className="text-right">
                  <Badge className={getCustomerHealth(selectedCustomer).color}>
                    {getCustomerHealth(selectedCustomer).status}
                  </Badge>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    ${(selectedCustomer.monthly_value || 0).toLocaleString()}/mo
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="communications">Communications</TabsTrigger>
                  <TabsTrigger value="calls">Call History</TabsTrigger>
                  <TabsTrigger value="insights">AI Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{selectedCustomer.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm capitalize">{selectedCustomer.industry}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">
                          Annual Revenue: ${(selectedCustomer.annual_revenue || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">
                          {selectedCustomer.employee_count || 'Unknown'} employees
                        </span>
                      </div>
                      <Badge className="capitalize">
                        {selectedCustomer.subscription_tier}
                      </Badge>
                    </div>
                  </div>

                  {selectedCustomer.address && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <h5 className="font-medium mb-2">Address</h5>
                      <p className="text-sm text-slate-600">
                        {[selectedCustomer.address.street, selectedCustomer.address.city, selectedCustomer.address.state, selectedCustomer.address.zip]
                          .filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="communications">
                  <div className="space-y-3">
                    {getCustomerCommunications(selectedCustomer.id).map((comm) => (
                      <div key={comm.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span className="capitalize">{comm.communication_type}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(comm.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <h5 className="font-medium">{comm.subject}</h5>
                        <p className="text-sm text-slate-600 mt-1">{comm.content}</p>
                        {comm.ai_sentiment && (
                          <Badge className="mt-2" variant="outline">
                            {comm.ai_sentiment} sentiment
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="calls">
                  <div className="space-y-3">
                    {getCustomerCalls(selectedCustomer.id).map((call) => (
                      <div key={call.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span className="capitalize">{call.call_type} call</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(call.call_start_time).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm">Duration: {Math.round(call.call_duration / 60)}m</span>
                          {call.call_outcome && (
                            <Badge variant="outline">{call.call_outcome}</Badge>
                          )}
                          {call.customer_satisfaction && (
                            <div className="flex items-center gap-1">
                              <span className="text-sm">Rating:</span>
                              <span className="text-yellow-600">{'★'.repeat(call.customer_satisfaction)}</span>
                            </div>
                          )}
                        </div>
                        {call.summary && (
                          <p className="text-sm text-slate-600 mt-2">{call.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="insights">
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-[var(--genix-blue)]/5 to-[var(--genix-purple)]/5 rounded-lg">
                      <h5 className="font-semibold mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Customer Intelligence
                      </h5>
                      <div className="space-y-2 text-sm">
                        <p>• High-value customer with consistent communication patterns</p>
                        <p>• Last interaction shows positive sentiment</p>
                        <p>• Potential for upselling based on usage patterns</p>
                        <p>• Renewal date approaching in 60 days</p>
                      </div>
                    </div>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h5 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        Recommended Actions
                      </h5>
                      <div className="space-y-2">
                        <Button size="sm" className="w-full justify-start">
                          Schedule renewal discussion call
                        </Button>
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          Send premium feature demo
                        </Button>
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          Check satisfaction survey
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-12 text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">Select a Customer</h3>
              <p className="text-slate-500">Choose a customer from the list to view their 360° profile</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}