import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCompany } from "@/components/contexts/CompanyContext";
import { useSubscription } from "@/components/contexts/SubscriptionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Crown,
  AlertTriangle,
  Star,
  MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Companies() {
  const {
    companies,
    activeCompany,
    updateCompany,
    deleteCompany,
    setActiveCompany,
    getCompanyCount
  } = useCompany();

  const { getPlanLimits, hasFeature } = useSubscription();

  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    company_code: "",
    company_name: "",
    country: "Uzbekistan",
    currency: "UZS",
    accounting_standard: "LOCAL_GAAP",
    is_active: true
  });

  const limits = getPlanLimits();
  const maxCompanies = limits.maxCompanies || 1;
  const companyCount = getCompanyCount();
  const canAddMore = maxCompanies === -1 || companyCount < maxCompanies;
  const hasMultiCompany = hasFeature('multi_company');

  useEffect(() => {
    filterCompanies();
  }, [companies, searchQuery]);

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

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      company_code: company.company_code || "",
      company_name: company.company_name || "",
      country: company.country || "Uzbekistan",
      currency: company.currency || "UZS",
      accounting_standard: company.accounting_standard || "LOCAL_GAAP",
      is_active: company.is_active !== false
    });
    setError(null);
    setShowEditForm(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const result = updateCompany(editingCompany.id, formData);
      if (!result.success) {
        setError(result.message || 'Xatolik yuz berdi');
        return;
      }
      setShowEditForm(false);
      setEditingCompany(null);
    } catch (err) {
      console.error("Error saving company:", err);
      setError('Kompaniyani saqlashda xatolik');
    }
  };

  const handleDelete = async (company) => {
    if (confirm(`"${company.company_name}" kompaniyasini o'chirishni xohlaysizmi?`)) {
      const result = deleteCompany(company.id);
      if (!result.success) {
        setError(result.message || 'O\'chirishda xatolik');
      }
    }
  };

  const handleSetActive = (company) => {
    setActiveCompany(company.id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7" />
            Kompaniyalar
          </h1>
          <p className="text-slate-600 mt-1">Barcha kompaniyalarni boshqaring va yangilarini qo'shing</p>
        </div>
        <Link to="/addcompany">
          <Button
            disabled={!canAddMore}
            className={canAddMore
              ? "bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              : "bg-slate-300 cursor-not-allowed"
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Yangi kompaniya
          </Button>
        </Link>
      </div>

      {/* Plan Limit Banner */}
      <Card className={`${canAddMore ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-gradient-to-r from-amber-50 to-orange-50'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${canAddMore ? 'bg-blue-100' : 'bg-amber-100'}`}>
                <Building2 className={`w-5 h-5 ${canAddMore ? 'text-blue-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  Kompaniyalar: {companyCount} / {maxCompanies === -1 ? '∞' : maxCompanies}
                </p>
                <p className="text-sm text-slate-600">
                  {hasMultiCompany
                    ? `${limits.name} tarifida ${maxCompanies === -1 ? 'cheksiz' : maxCompanies + ' tagacha'} kompaniya`
                    : 'Bitta kompaniya profili mavjud'
                  }
                </p>
              </div>
            </div>
            {!canAddMore && (
              <Link to="/settings?tab=subscription">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  <Crown className="w-4 h-4 mr-2" />
                  Tarifni yangilash
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Companies List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kompaniyalar ro'yxati</CardTitle>
              <CardDescription>Barcha kompaniyalarni ko'ring va boshqaring</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Kompaniyalarni qidirish..."
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
                  <TableHead>Kompaniya</TableHead>
                  <TableHead>Mamlakat</TableHead>
                  <TableHead>Valyuta</TableHead>
                  <TableHead>Standart</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead>Yaratilgan</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Building2 className="w-12 h-12 text-slate-300" />
                        <p className="text-slate-500">Kompaniyalar topilmadi</p>
                        {canAddMore && (
                          <Link to="/addcompany">
                            <Button variant="outline" size="sm">
                              <Plus className="w-4 h-4 mr-2" />
                              Kompaniya qo'shish
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow
                      key={company.id}
                      className={activeCompany?.id === company.id ? 'bg-blue-50/50' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
                            {company.company_name?.substring(0, 2).toUpperCase() || 'CO'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{company.company_name}</span>
                              {activeCompany?.id === company.id && (
                                <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                                  <Star className="w-3 h-3 mr-1" />
                                  Faol
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-slate-500">{company.company_code}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{company.country}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.currency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{company.accounting_standard}</Badge>
                      </TableCell>
                      <TableCell>
                        {company.is_active !== false ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Faol
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Nofaol
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.created_date ? format(new Date(company.created_date), 'dd.MM.yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {activeCompany?.id !== company.id && (
                              <DropdownMenuItem onClick={() => handleSetActive(company)}>
                                <Star className="w-4 h-4 mr-2 text-blue-600" />
                                Faol qilish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(company)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(company)}
                              disabled={companies.length <= 1}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Company Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kompaniyani tahrirlash</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_code">Kompaniya kodi *</Label>
                <Input
                  id="company_code"
                  value={formData.company_code}
                  onChange={(e) => setFormData({...formData, company_code: e.target.value.toUpperCase()})}
                  placeholder="COMP001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Kompaniya nomi *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  placeholder="Mening kompaniyam"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Mamlakat</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Valyuta</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UZS">UZS - O'zbek so'mi</SelectItem>
                    <SelectItem value="USD">USD - AQSH dollari</SelectItem>
                    <SelectItem value="EUR">EUR - Yevro</SelectItem>
                    <SelectItem value="RUB">RUB - Rossiya rubli</SelectItem>
                    <SelectItem value="GBP">GBP - Britaniya funt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accounting_standard">Buxgalteriya standarti</Label>
                <Select value={formData.accounting_standard} onValueChange={(value) => setFormData({...formData, accounting_standard: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL_GAAP">Mahalliy standart (O'zbekiston)</SelectItem>
                    <SelectItem value="IFRS">IFRS (Xalqaro)</SelectItem>
                    <SelectItem value="US_GAAP">US GAAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active">Holat</Label>
                <Select value={formData.is_active ? "active" : "inactive"} onValueChange={(value) => setFormData({...formData, is_active: value === "active"})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Faol</SelectItem>
                    <SelectItem value="inactive">Nofaol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditForm(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                Saqlash
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
