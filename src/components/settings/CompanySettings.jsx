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

export default function CompanySettings() {
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
      {/* Plan Limitations Warning */}
      {!hasMultiCompany && (
        <Alert className="bg-purple-50 border-purple-200">
          <Crown className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-purple-900">
            <strong>Ko'p kompaniya funksiyasi mavjud emas.</strong><br />
            Bir nechta kompaniya bilan ishlash uchun Professional yoki Enterprise tarifiga o'ting.
            <Link to="/settings?tab=subscription">
              <Button variant="link" className="text-purple-600 p-0 h-auto ml-2">
                Tarifni yangilash →
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {hasMultiCompany && !canAddMore && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Kompaniya limiti tugadi!</strong><br />
            Siz {companyCount} / {maxCompanies} kompaniya qo'shdingiz. Ko'proq kompaniya qo'shish uchun tarifingizni yangilang.
            <Link to="/settings?tab=subscription">
              <Button variant="link" className="text-amber-600 p-0 h-auto ml-2">
                Tarifni yangilash →
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Companies Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Kompaniyalar
              </CardTitle>
              <CardDescription className="mt-1">
                Barcha kompaniyalarni boshqaring va yangilarini qo'shing
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              {companyCount} / {maxCompanies === -1 ? '∞' : maxCompanies}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Add Button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Kompaniya nomini qidiring..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Link to="/addcompany">
              <Button
                disabled={!canAddMore}
                className={canAddMore
                  ? "bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] whitespace-nowrap"
                  : "bg-slate-300 cursor-not-allowed whitespace-nowrap"
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Yangi kompaniya
              </Button>
            </Link>
          </div>

          {/* Companies Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Kompaniya</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Valyuta</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      {searchQuery ? "Kompaniya topilmadi" : "Hali kompaniya qo'shilmagan"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--genix-blue)] to-[var(--genix-purple)] flex items-center justify-center text-white text-xs font-bold">
                            {company.company_name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{company.company_name}</p>
                            {activeCompany?.id === company.id && (
                              <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                                <Star className="w-3 h-3 mr-1" />
                                Faol
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                          {company.company_code}
                        </code>
                      </TableCell>
                      <TableCell>{company.currency}</TableCell>
                      <TableCell>
                        {company.is_active !== false ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Noaktiv
                          </Badge>
                        )}
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
                              <>
                                <DropdownMenuItem onClick={() => handleSetActive(company)}>
                                  <Star className="w-4 h-4 mr-2" />
                                  Faol qilish
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(company)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Tahrirlash
                            </DropdownMenuItem>
                            {companies.length > 1 && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(company)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                O'chirish
                              </DropdownMenuItem>
                            )}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Kompaniyani tahrirlash
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Kompaniya kodi *</Label>
              <Input
                value={formData.company_code}
                onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                placeholder="MAIN"
                required
                disabled
              />
              <p className="text-xs text-slate-500">Kompaniya kodi o'zgartirilmaydi</p>
            </div>

            <div className="space-y-2">
              <Label>Kompaniya nomi *</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Mening kompaniyam"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Mamlakat</Label>
              <Select
                value={formData.country}
                onValueChange={(value) => setFormData({ ...formData, country: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Uzbekistan">Uzbekistan</SelectItem>
                  <SelectItem value="Kazakhstan">Kazakhstan</SelectItem>
                  <SelectItem value="Kyrgyzstan">Kyrgyzstan</SelectItem>
                  <SelectItem value="Tajikistan">Tajikistan</SelectItem>
                  <SelectItem value="Turkmenistan">Turkmenistan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valyuta</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS - O'zbek so'mi</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="RUB">RUB - Russian Ruble</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Buxgalteriya standarti</Label>
              <Select
                value={formData.accounting_standard}
                onValueChange={(value) => setFormData({ ...formData, accounting_standard: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCAL_GAAP">Mahalliy standart</SelectItem>
                  <SelectItem value="IFRS">IFRS</SelectItem>
                  <SelectItem value="US_GAAP">US GAAP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Kompaniya aktiv
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditForm(false)}
                className="flex-1"
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                Saqlash
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
