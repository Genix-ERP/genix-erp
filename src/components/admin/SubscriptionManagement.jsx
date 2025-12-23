import React, { useState, useEffect } from "react";
import { Subscription, Company } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Plus, Search, Edit, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionManagement({ onUpdate }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [formData, setFormData] = useState({
    company_id: "",
    plan_name: "starter",
    status: "trial",
    billing_cycle: "monthly",
    monthly_price: 0,
    start_date: new Date().toISOString().split('T')[0],
    max_users: 10
  });

  useEffect(() => {
    loadSubscriptions();
    loadCompanies();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [subscriptions, searchQuery]);

  const loadSubscriptions = async () => {
    try {
      const data = await Subscription.list('-created_date');
      setSubscriptions(data);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await Company.list();
      setCompanies(data);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const filterSubscriptions = () => {
    if (searchQuery) {
      setFilteredSubscriptions(subscriptions.filter(sub =>
        sub.company_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.plan_name?.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredSubscriptions(subscriptions);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSubscription) {
        await Subscription.update(editingSubscription.id, formData);
      } else {
        await Subscription.create(formData);
      }
      loadSubscriptions();
      setShowForm(false);
      setEditingSubscription(null);
      resetForm();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error saving subscription:", error);
    }
  };

  const handleEdit = (subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      company_id: subscription.company_id || "",
      plan_name: subscription.plan_name || "starter",
      status: subscription.status || "trial",
      billing_cycle: subscription.billing_cycle || "monthly",
      monthly_price: subscription.monthly_price || 0,
      start_date: subscription.start_date || new Date().toISOString().split('T')[0],
      max_users: subscription.max_users || 10
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      company_id: "",
      plan_name: "starter",
      status: "trial",
      billing_cycle: "monthly",
      monthly_price: 0,
      start_date: new Date().toISOString().split('T')[0],
      max_users: 10
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      trial: { icon: Clock, color: "bg-blue-100 text-blue-800", label: "Trial" },
      suspended: { icon: AlertTriangle, color: "bg-yellow-100 text-yellow-800", label: "Suspended" },
      cancelled: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Cancelled" },
      expired: { icon: XCircle, color: "bg-gray-100 text-gray-800", label: "Expired" }
    };
    const badge = badges[status] || badges.trial;
    const Icon = badge.icon;
    return (
      <Badge className={badge.color}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  const getPlanBadge = (plan) => {
    const colors = {
      free: "bg-gray-100 text-gray-800",
      starter: "bg-blue-100 text-blue-800",
      professional: "bg-purple-100 text-purple-800",
      enterprise: "bg-indigo-100 text-indigo-800",
      custom: "bg-pink-100 text-pink-800"
    };
    return <Badge className={colors[plan] || colors.starter}>{plan}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscriptions Management
            </CardTitle>
            <Button
              onClick={() => {
                setEditingSubscription(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Subscription
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search subscriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell className="font-medium">{subscription.company_id}</TableCell>
                    <TableCell>{getPlanBadge(subscription.plan_name)}</TableCell>
                    <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                    <TableCell>{subscription.billing_cycle}</TableCell>
                    <TableCell>${subscription.monthly_price}/mo</TableCell>
                    <TableCell>
                      {subscription.current_users || 0} / {subscription.max_users || 'unlimited'}
                    </TableCell>
                    <TableCell>
                      {subscription.start_date ? format(new Date(subscription.start_date), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(subscription)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSubscription ? 'Edit Subscription' : 'Add New Subscription'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_id">Company *</Label>
              <Select value={formData.company_id} onValueChange={(value) => setFormData({...formData, company_id: value})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan_name">Plan</Label>
                <Select value={formData.plan_name} onValueChange={(value) => setFormData({...formData, plan_name: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing_cycle">Billing Cycle</Label>
                <Select value={formData.billing_cycle} onValueChange={(value) => setFormData({...formData, billing_cycle: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_price">Monthly Price ($)</Label>
                <Input
                  id="monthly_price"
                  type="number"
                  value={formData.monthly_price}
                  onChange={(e) => setFormData({...formData, monthly_price: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_users">Max Users</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={formData.max_users}
                  onChange={(e) => setFormData({...formData, max_users: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                {editingSubscription ? 'Update Subscription' : 'Create Subscription'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}