import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function CompanyManagement({ onUpdate }) {
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    company_code: "",
    company_name: "",
    country: "USA",
    currency: "USD",
    accounting_standard: "IFRS",
    is_active: true
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchQuery]);

  const loadCompanies = async () => {
    try {
      const data = await base44.entities.Company.list('-created_date');
      setCompanies(data);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const filterCompanies = () => {
    if (searchQuery) {
      setFilteredCompanies(companies.filter(company =>
        company.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.company_code?.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredCompanies(companies);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await base44.entities.Company.update(editingCompany.id, formData);
      } else {
        await base44.entities.Company.create(formData);
      }
      loadCompanies();
      setShowForm(false);
      setEditingCompany(null);
      resetForm();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error saving company:", error);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      company_code: company.company_code || "",
      company_name: company.company_name || "",
      country: company.country || "USA",
      currency: company.currency || "USD",
      accounting_standard: company.accounting_standard || "IFRS",
      is_active: company.is_active !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (company) => {
    if (confirm(`Are you sure you want to delete ${company.company_name}?`)) {
      try {
        await base44.entities.Company.delete(company.id);
        loadCompanies();
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error("Error deleting company:", error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      company_code: "",
      company_name: "",
      country: "USA",
      currency: "USD",
      accounting_standard: "IFRS",
      is_active: true
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Companies Management
            </CardTitle>
            <Button
              onClick={() => {
                setEditingCompany(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Company
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search companies..."
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
                  <TableHead>Company Code</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.company_code}</TableCell>
                    <TableCell>{company.company_name}</TableCell>
                    <TableCell>{company.country}</TableCell>
                    <TableCell>{company.currency}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.accounting_standard}</Badge>
                    </TableCell>
                    <TableCell>
                      {company.is_active !== false ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.created_date ? format(new Date(company.created_date), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(company)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(company)} className="text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Company Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Edit Company' : 'Add New Company'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_code">Company Code *</Label>
                <Input
                  id="company_code"
                  value={formData.company_code}
                  onChange={(e) => setFormData({...formData, company_code: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accounting_standard">Accounting Standard</Label>
                <Select value={formData.accounting_standard} onValueChange={(value) => setFormData({...formData, accounting_standard: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IFRS">IFRS</SelectItem>
                    <SelectItem value="US_GAAP">US GAAP</SelectItem>
                    <SelectItem value="LOCAL_GAAP">Local GAAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active">Status</Label>
                <Select value={formData.is_active ? "active" : "inactive"} onValueChange={(value) => setFormData({...formData, is_active: value === "active"})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                {editingCompany ? 'Update Company' : 'Create Company'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}