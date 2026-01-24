import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCompany } from "@/components/contexts/CompanyContext";
import { useSubscription } from "@/components/contexts/SubscriptionContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const {
    companies,
    activeCompany,
    addCompany,
    updateCompany,
    deleteCompany,
    setActiveCompany,
    getCompanyCount
  } = useCompany();

  const { getPlanLimits, hasFeature } = useSubscription();

  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [addError, setAddError] = useState(null);
  const [formData, setFormData] = useState({
    company_code: "",
    company_name: "",
    legal_name: "",
    tax_id: "",
    registration_number: "",
    email: "",
    phone: "",
    website: "",
    street: "",
    city: "",
    state: "",
    postal_code: "",
    country: "Uzbekistan",
    currency: "UZS",
    accounting_standard: "LOCAL_GAAP",
    is_active: true
  });

  const [addFormData, setAddFormData] = useState({
    company_code: "",
    company_name: "",
    legal_name: "",
    tax_id: "",
    registration_number: "",
    email: "",
    phone: "",
    website: "",
    street: "",
    city: "",
    state: "",
    postal_code: "",
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
      legal_name: company.legal_name || "",
      tax_id: company.tax_id || "",
      registration_number: company.registration_number || "",
      email: company.email || "",
      phone: company.phone || "",
      website: company.website || "",
      street: company.street || "",
      city: company.city || "",
      state: company.state || "",
      postal_code: company.postal_code || "",
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
      const result = await updateCompany(editingCompany.id, formData);
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

  const handleDeleteClick = (company) => {
    setCompanyToDelete(company);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;

    try {
      const result = await deleteCompany(companyToDelete.id);
      if (!result.success) {
        setError(result.message || t('error_deleting_company') || "O'chirishda xatolik");
      }
    } catch (err) {
      console.error("Error deleting company:", err);
      setError(t('error_deleting_company') || "O'chirishda xatolik");
    } finally {
      setShowDeleteConfirm(false);
      setCompanyToDelete(null);
    }
  };

  const handleSetActive = (company) => {
    setActiveCompany(company.id);
  };

  const handleAddClick = () => {
    if (!canAddMore) {
      setAddError(`Kompaniya limiti (${maxCompanies}) ga yetildi. Tarifni yangilash kerak.`);
      return;
    }
    setAddFormData({
      company_code: "",
      company_name: "",
      legal_name: "",
      tax_id: "",
      registration_number: "",
      email: "",
      phone: "",
      website: "",
      street: "",
      city: "",
      state: "",
      postal_code: "",
      country: "Uzbekistan",
      currency: "UZS",
      accounting_standard: "LOCAL_GAAP",
      is_active: true
    });
    setAddError(null);
    setShowAddForm(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError(null);

    if (!canAddMore) {
      setAddError(`Kompaniya limiti (${maxCompanies}) ga yetildi.`);
      return;
    }

    try {
      const result = await addCompany(addFormData, maxCompanies);
      if (!result.success) {
        setAddError(result.message || 'Xatolik yuz berdi');
        return;
      }
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding company:", err);
      setAddError('Kompaniyani qo\'shishda xatolik');
    }
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
                {t('companies')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('companies_description')}
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
                placeholder={t('search_company_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleAddClick}
              disabled={!canAddMore}
              className={canAddMore
                ? "bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)] whitespace-nowrap"
                : "bg-slate-300 cursor-not-allowed whitespace-nowrap"
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('new_company')}
            </Button>
          </div>

          {/* Companies Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('company')}</TableHead>
                  <TableHead>{t('code')}</TableHead>
                  <TableHead>{t('currency')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      {searchQuery ? t('company_not_found') : t('no_companies_yet')}
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
                                {t('current')}
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
                            {t('active')}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            {t('inactive')}
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
                                  {t('set_active') || 'Faol qilish'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(company)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {t('edit') || 'Tahrirlash'}
                            </DropdownMenuItem>
                            {companies.length > 1 && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(company)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('delete') || "O'chirish"}
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              {t('edit_company')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('basic_information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('company_code')} *</Label>
                  <Input
                    value={formData.company_code}
                    onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                    placeholder="MAIN"
                    required
                    disabled
                  />
                  <p className="text-xs text-slate-500">{t('company_code_not_editable')}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t('company_name')} *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder={t('my_company_placeholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('legal_name')}</Label>
                  <Input
                    value={formData.legal_name}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    placeholder={t('legal_name_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('tax_id_inn')}</Label>
                  <Input
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder="123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('registration_number')}</Label>
                  <Input
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="REG-123456"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('contact_information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="company@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('phone')}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('website')}</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('address')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('street')}</Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder={t('street_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('city')}</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder={t('city_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('state_region')}</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder={t('state_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('postal_code')}</Label>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="100000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('country')}</Label>
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
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('settings')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('currency')}</Label>
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
                  <Label>{t('accounting_standard')}</Label>
                  <Select
                    value={formData.accounting_standard}
                    onValueChange={(value) => setFormData({ ...formData, accounting_standard: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOCAL_GAAP">{t('local_standard')}</SelectItem>
                      <SelectItem value="IFRS">IFRS</SelectItem>
                      <SelectItem value="US_GAAP">US GAAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    {t('company_active')}
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditForm(false)}
                className="flex-1"
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {t('save') || 'Saqlash'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Company Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('add_new_company')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-6 py-4">
            {addError && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('basic_information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('company_code')} *</Label>
                  <Input
                    value={addFormData.company_code}
                    onChange={(e) => setAddFormData({ ...addFormData, company_code: e.target.value })}
                    placeholder="COMP001"
                    required
                  />
                  <p className="text-xs text-slate-500">{t('unique_identifier_hint')}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t('company_name')} *</Label>
                  <Input
                    value={addFormData.company_name}
                    onChange={(e) => setAddFormData({ ...addFormData, company_name: e.target.value })}
                    placeholder={t('my_company_placeholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('legal_name')}</Label>
                  <Input
                    value={addFormData.legal_name}
                    onChange={(e) => setAddFormData({ ...addFormData, legal_name: e.target.value })}
                    placeholder={t('legal_name_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('tax_id_inn')}</Label>
                  <Input
                    value={addFormData.tax_id}
                    onChange={(e) => setAddFormData({ ...addFormData, tax_id: e.target.value })}
                    placeholder="123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('registration_number')}</Label>
                  <Input
                    value={addFormData.registration_number}
                    onChange={(e) => setAddFormData({ ...addFormData, registration_number: e.target.value })}
                    placeholder="REG-123456"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('contact_information')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input
                    type="email"
                    value={addFormData.email}
                    onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                    placeholder="company@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('phone')}</Label>
                  <Input
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('website')}</Label>
                  <Input
                    value={addFormData.website}
                    onChange={(e) => setAddFormData({ ...addFormData, website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('address')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('street')}</Label>
                  <Input
                    value={addFormData.street}
                    onChange={(e) => setAddFormData({ ...addFormData, street: e.target.value })}
                    placeholder={t('street_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('city')}</Label>
                  <Input
                    value={addFormData.city}
                    onChange={(e) => setAddFormData({ ...addFormData, city: e.target.value })}
                    placeholder={t('city_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('state_region')}</Label>
                  <Input
                    value={addFormData.state}
                    onChange={(e) => setAddFormData({ ...addFormData, state: e.target.value })}
                    placeholder={t('state_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('postal_code')}</Label>
                  <Input
                    value={addFormData.postal_code}
                    onChange={(e) => setAddFormData({ ...addFormData, postal_code: e.target.value })}
                    placeholder="100000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('country')}</Label>
                  <Select
                    value={addFormData.country}
                    onValueChange={(value) => setAddFormData({ ...addFormData, country: value })}
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
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('settings')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('currency')}</Label>
                  <Select
                    value={addFormData.currency}
                    onValueChange={(value) => setAddFormData({ ...addFormData, currency: value })}
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
                  <Label>{t('accounting_standard')}</Label>
                  <Select
                    value={addFormData.accounting_standard}
                    onValueChange={(value) => setAddFormData({ ...addFormData, accounting_standard: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOCAL_GAAP">{t('local_standard')}</SelectItem>
                      <SelectItem value="IFRS">IFRS</SelectItem>
                      <SelectItem value="US_GAAP">US GAAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="add_is_active"
                    checked={addFormData.is_active}
                    onChange={(e) => setAddFormData({ ...addFormData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="add_is_active" className="cursor-pointer">
                    {t('company_active')}
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="flex-1"
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
              >
                {t('add') || "Qo'shish"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              {t('delete_company') || "Kompaniyani o'chirish"}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {t('delete_company_confirm') || "Haqiqatan ham"} <strong>"{companyToDelete?.company_name}"</strong> {t('delete_company_confirm_suffix') || "kompaniyasini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setCompanyToDelete(null);
              }}
            >
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('delete') || "O'chirish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
