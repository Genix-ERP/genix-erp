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
import { ImportModal } from "@/components/shared/ImportExport";
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
  MoreHorizontal,
  Upload,
  Download,
  FileSpreadsheet,
  ChevronsUpDown,
  Check
} from "lucide-react";
import * as XLSX from 'xlsx';
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
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
  const { toast } = useToast();

  const {
    companies,
    activeCompany,
    addCompany,
    updateCompany,
    deleteCompany,
    setActiveCompany,
    getCompanyCount,
    importCompanies,
    exportCompanies,
    refreshCompanies
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
  // Simplified form matching Excel template for Uzbekistan business requirements
  const [formData, setFormData] = useState({
    company_name: "",
    tax_id: "",           // INN (STIR)
    oked: "",             // OKED code
    bank_account: "",     // Bank hisob raqami
    bank_mfo: "",         // Bank MFO
    bank_name: "",        // Bank nomi
    is_vat_payer: false,  // QQS to'lovchimi?
    tax_regime: "",       // Soliq rejimi
    activity_status: "active", // Faoliyat holati
    business_group: "",   // Guruh/Klaster
    intercompany_relations: "", // Intercompany aloqa
    intercompany_vendor_ids: [],
    director_name: "",    // Direktor F.I.O.
    director_phone: "",   // Direktor telefon
    phone: "",            // Kompaniya telefon
    email: "",
    legal_address: "",    // Yuridik manzil
    notes: "",            // Izoh
    currency: "UZS",
    is_active: true
  });

  const [addFormData, setAddFormData] = useState({
    company_name: "",
    tax_id: "",
    oked: "",
    bank_account: "",
    bank_mfo: "",
    bank_name: "",
    is_vat_payer: false,
    tax_regime: "",
    activity_status: "active",
    business_group: "",
    intercompany_relations: "",
    intercompany_vendor_ids: [],
    director_name: "",
    director_phone: "",
    phone: "",
    email: "",
    legal_address: "",
    notes: "",
    currency: "UZS",
    is_active: true
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [editVendorDropdownOpen, setEditVendorDropdownOpen] = useState(false);
  const [addVendorDropdownOpen, setAddVendorDropdownOpen] = useState(false);

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
      company_name: company.company_name || "",
      tax_id: company.tax_id || "",
      oked: company.oked || "",
      bank_account: company.bank_account || "",
      bank_mfo: company.bank_mfo || "",
      bank_name: company.bank_name || "",
      is_vat_payer: company.is_vat_payer || false,
      tax_regime: company.tax_regime || "",
      activity_status: company.activity_status || "active",
      business_group: company.business_group || "",
      intercompany_relations: company.intercompany_relations || "",
      intercompany_vendor_ids: company.intercompany_vendor_ids || [],
      director_name: company.director_name || "",
      director_phone: company.director_phone || "",
      phone: company.phone || "",
      email: company.email || "",
      legal_address: company.legal_address || "",
      notes: company.notes || "",
      currency: company.currency || "UZS",
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
      toast({ variant: "success", title: t('company_updated') || "Muvaffaqiyatli o'zgartirildi", description: formData.company_name });
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
      } else {
        toast({ variant: "success", title: t('company_deleted') || "Muvaffaqiyatli o'chirildi", description: companyToDelete.company_name });
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
      company_name: "",
      tax_id: "",
      oked: "",
      bank_account: "",
      bank_mfo: "",
      bank_name: "",
      is_vat_payer: false,
      tax_regime: "",
      activity_status: "active",
      business_group: "",
      intercompany_relations: "",
      intercompany_vendor_ids: [],
      director_name: "",
      director_phone: "",
      phone: "",
      email: "",
      legal_address: "",
      notes: "",
      currency: "UZS",
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
      toast({ variant: "success", title: t('company_added') || "Muvaffaqiyatli qo'shildi", description: addFormData.company_name });
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding company:", err);
      setAddError('Kompaniyani qo\'shishda xatolik');
    }
  };

  // Import columns definition for the modal
  const importColumns = [
    { key: 'company_name', label: t('company_name') || 'Firma nomi', required: true },
    { key: 'tax_id', label: 'INN (STIR)' },
    { key: 'oked', label: 'OKED' },
    { key: 'bank_account', label: t('bank_account') || 'Hisob raqami' },
    { key: 'bank_mfo', label: 'MFO' },
    { key: 'bank_name', label: t('bank_name') || 'Bank nomi' },
    { key: 'is_vat_payer', label: t('vat_payer') || "QQS to'lovchimi?" },
    { key: 'tax_regime', label: t('tax_regime') || 'Soliq rejimi' },
    { key: 'activity_status', label: t('activity_status') || 'Faoliyat holati' },
    { key: 'business_group', label: t('business_group') || 'Guruh/Klaster' },
    { key: 'intercompany_relations', label: t('intercompany_relations') || 'Intercompany aloqa' },
    { key: 'director_name', label: t('director_name') || 'Direktor F.I.O.' },
    { key: 'director_phone', label: t('director_phone') || 'Direktor telefon' },
    { key: 'phone', label: t('company_phone') || 'Kompaniya telefon' },
    { key: 'email', label: t('email') || 'Email' },
    { key: 'legal_address', label: t('legal_address') || 'Yuridik manzil' },
    { key: 'currency', label: t('currency') || 'Valyuta' },
    { key: 'notes', label: t('notes') || 'Izoh' },
  ];

  // Handle import from ImportModal
  const handleImportData = async (data) => {
    try {
      // Transform data to match API format (auto-generate code from name)
      const mappedData = data.map((row, index) => ({
        code: `ORG-${Date.now()}-${index}`,  // Auto-generate unique code
        name: row.company_name || '',
        tax_id: row.tax_id || '',
        oked: row.oked || '',
        bank_account: row.bank_account || '',
        bank_mfo: row.bank_mfo || '',
        bank_name: row.bank_name || '',
        is_vat_payer: row.is_vat_payer === 'Ha' || row.is_vat_payer === 'Yes' || row.is_vat_payer === true,
        tax_regime: row.tax_regime || '',
        activity_status: row.activity_status || 'active',
        business_group: row.business_group || '',
        intercompany_relations: row.intercompany_relations || '',
        director_name: row.director_name || '',
        director_phone: row.director_phone || '',
        legal_address: row.legal_address || '',
        notes: row.notes || '',
        currency: row.currency || 'UZS',
        country: 'Uzbekistan',
        contact_info: {
          email: row.email || '',
          phone: row.phone || ''
        }
      })).filter(org => org.name); // Filter out empty rows

      if (mappedData.length === 0) {
        throw new Error('Excel faylda ma\'lumot topilmadi');
      }

      const result = await importCompanies(mappedData);
      if (result.success) {
        alert(`Import muvaffaqiyatli: ${result.data.imported} ta qo'shildi, ${result.data.skipped} ta o'tkazib yuborildi`);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Import error:', err);
      throw err;
    }
  };

  // Handle Excel Export
  const handleExport = () => {
    const exportData = companies.map(company => ({
      'Firma nomi': company.company_name,
      'INN (STIR)': company.tax_id || '',
      'OKED': company.oked || '',
      'Hisob raqami': company.bank_account || '',
      'MFO': company.bank_mfo || '',
      'Bank nomi': company.bank_name || '',
      'QQS to\'lovchimi?': company.is_vat_payer ? 'Ha' : 'Yo\'q',
      'Soliq rejimi': company.tax_regime || '',
      'Faoliyat holati': company.activity_status || 'active',
      'Guruh/Klaster': company.business_group || '',
      'Intercompany aloqa': company.intercompany_relations || '',
      'Direktor F.I.O.': company.director_name || '',
      'Direktor telefon': company.director_phone || '',
      'Kompaniya telefon': company.phone || '',
      'Email': company.email || '',
      'Yuridik manzil': company.legal_address || '',
      'Valyuta': company.currency || 'UZS',
      'Izoh': company.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kompaniyalar');
    XLSX.writeFile(workbook, `kompaniyalar_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Download import template
  const handleDownloadTemplate = () => {
    const templateData = [{
      'Firma nomi': 'ACME Corporation',
      'INN (STIR)': '123456789',
      'OKED': '46900',
      'Hisob raqami': '20208000123456789012',
      'MFO': '00440',
      'Bank nomi': 'Kapitalbank',
      'QQS to\'lovchimi?': 'Ha',
      'Soliq rejimi': 'Umumiy',
      'Faoliyat holati': 'Faol',
      'Guruh/Klaster': 'Qurilish',
      'Intercompany aloqa': '',
      'Direktor F.I.O.': 'Abdullayev Alisher',
      'Direktor telefon': '+998901234567',
      'Kompaniya telefon': '+998712345678',
      'Email': 'info@acme.uz',
      'Yuridik manzil': 'Toshkent shahri, Chilonzor tumani',
      'Valyuta': 'UZS',
      'Izoh': ''
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Add instructions sheet
    const instructions = [
      { 'TO\'LDIRISH YO\'RIQNOMASI': '' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Maydon' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Firma nomi', 'Izoh': 'Rasmiy nomi (majburiy)' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'INN (STIR)', 'Izoh': 'Identifikatsiya raqami / Soliq to\'lovchi raqami (9 raqam)' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'OKED', 'Izoh': 'Iqtisodiy faoliyat klassifikatori' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Hisob raqami', 'Izoh': 'Bank hisob raqami (20 raqam)' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'MFO', 'Izoh': 'Bank MFO raqami (5 raqam)' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Bank nomi', 'Izoh': 'Kapitalbank, NBU, Ipoteka bank, va h.k.' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'QQS to\'lovchimi?', 'Izoh': 'Ha / Yo\'q' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Soliq rejimi', 'Izoh': 'Umumiy / Aylanmadan / Yagona' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Faoliyat holati', 'Izoh': 'Faol / To\'xtatilgan / Tugatish / Dormant' },
      { 'TO\'LDIRISH YO\'RIQNOMASI': 'Guruh/Klaster', 'Izoh': 'Qurilish / Mebel / Avtosalon / va h.k.' },
    ];

    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kompaniyalar');
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Yo\'riqnoma');
    XLSX.writeFile(workbook, 'kompaniyalar_shablon.xlsx');
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
          {/* Import/Export Buttons */}
          <div className="flex items-center justify-end gap-2 pb-2 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {t('download_template') || 'Shablon'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              disabled={!canAddMore}
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('import') || 'Import'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={companies.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              {t('export') || 'Eksport'}
            </Button>
          </div>

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
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('basic_information') || 'Asosiy ma\'lumotlar'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('company_name') || 'Firma nomi'} *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="ACME Corporation"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>INN (STIR) *</Label>
                  <Input
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder="123456789"
                    maxLength={9}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>OKED</Label>
                  <Input
                    value={formData.oked}
                    onChange={(e) => setFormData({ ...formData, oked: e.target.value })}
                    placeholder="46900"
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('currency') || 'Valyuta'}</Label>
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
              </div>
            </div>

            {/* Bank Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('bank_info') || 'Bank ma\'lumotlari'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('bank_account') || 'Hisob raqami'}</Label>
                  <Input
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                    placeholder="20208000123456789012"
                    maxLength={30}
                  />
                </div>

                <div className="space-y-2">
                  <Label>MFO</Label>
                  <Input
                    value={formData.bank_mfo}
                    onChange={(e) => setFormData({ ...formData, bank_mfo: e.target.value })}
                    placeholder="00440"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('bank_name') || 'Bank nomi'}</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder={t('bank_name_placeholder') || "Kapitalbank, NBU, Ipoteka bank..."}
                  />
                </div>
              </div>
            </div>

            {/* Tax Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('tax_info') || 'Soliq ma\'lumotlari'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_vat_payer"
                    checked={formData.is_vat_payer}
                    onChange={(e) => setFormData({ ...formData, is_vat_payer: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_vat_payer" className="cursor-pointer">
                    {t('vat_payer') || "QQS to'lovchimi?"}
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>{t('tax_regime') || 'Soliq rejimi'}</Label>
                  <Select
                    value={formData.tax_regime}
                    onValueChange={(value) => setFormData({ ...formData, tax_regime: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select') || 'Tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{t('tax_general') || 'Umumiy'}</SelectItem>
                      <SelectItem value="simplified">{t('tax_simplified') || 'Aylanmadan'}</SelectItem>
                      <SelectItem value="single">{t('tax_single') || 'Yagona'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('activity_status') || 'Faoliyat holati'}</Label>
                  <Select
                    value={formData.activity_status}
                    onValueChange={(value) => setFormData({ ...formData, activity_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('status_active') || 'Faol'}</SelectItem>
                      <SelectItem value="suspended">{t('status_suspended') || "To'xtatilgan"}</SelectItem>
                      <SelectItem value="liquidating">{t('status_liquidating') || 'Tugatish'}</SelectItem>
                      <SelectItem value="dormant">{t('status_dormant') || 'Dormant'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('business_group') || 'Guruh/Klaster'}</Label>
                  <Input
                    value={formData.business_group}
                    onChange={(e) => setFormData({ ...formData, business_group: e.target.value })}
                    placeholder={t('business_group_placeholder') || "Qurilish, Mebel, Avtosalon..."}
                  />
                </div>

                {companies.filter(c => c.id !== editingCompany?.id).length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t('intercompany_vendors') || 'Intercompany vendorlar'}</Label>
                    <p className="text-xs text-slate-500">{t('intercompany_vendors_desc') || "Tanlangan kompaniyalarda vendor va mijoz sifatida avtomatik yaratiladi"}</p>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                        onClick={() => setEditVendorDropdownOpen(!editVendorDropdownOpen)}
                      >
                        <span className="truncate">
                          {formData.intercompany_vendor_ids.length > 0
                            ? companies.filter(c => formData.intercompany_vendor_ids.includes(c.id)).map(c => c.company_name).join(', ')
                            : t('select_companies') || 'Kompaniyalarni tanlang'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      {editVendorDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white p-2 shadow-md">
                          <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {companies.filter(c => c.id !== editingCompany?.id).map(company => {
                              const isSelected = formData.intercompany_vendor_ids.includes(company.id);
                              return (
                                <div
                                  key={company.id}
                                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-100"
                                  onClick={() => {
                                    const ids = isSelected
                                      ? formData.intercompany_vendor_ids.filter(id => id !== company.id)
                                      : [...formData.intercompany_vendor_ids, company.id];
                                    setFormData({ ...formData, intercompany_vendor_ids: ids });
                                  }}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    {isSelected && <Check className="h-4 w-4" />}
                                  </div>
                                  <span className="text-sm">{company.company_name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('contact_information') || 'Aloqa ma\'lumotlari'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('director_name') || 'Direktor F.I.O.'}</Label>
                  <Input
                    value={formData.director_name}
                    onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                    placeholder="Abdullayev Alisher Karimovich"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('director_phone') || 'Direktor telefon'}</Label>
                  <Input
                    value={formData.director_phone}
                    onChange={(e) => setFormData({ ...formData, director_phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('company_phone') || 'Kompaniya telefon'}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 71 234 56 78"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('email') || 'Email'}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@company.uz"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('legal_address') || 'Yuridik manzil'}</Label>
                  <Input
                    value={formData.legal_address}
                    onChange={(e) => setFormData({ ...formData, legal_address: e.target.value })}
                    placeholder={t('legal_address_placeholder') || "Toshkent shahri, Chilonzor tumani, ..."}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('notes') || 'Izoh'}</h3>
              <div className="space-y-2">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('notes_placeholder') || 'Qo\'shimcha izohlar...'}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  {t('company_active') || 'Kompaniya faol'}
                </Label>
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
              {t('add_new_company') || "Yangi kompaniya qo'shish"}
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
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('basic_information') || 'Asosiy ma\'lumotlar'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('company_name') || 'Firma nomi'} *</Label>
                  <Input
                    value={addFormData.company_name}
                    onChange={(e) => setAddFormData({ ...addFormData, company_name: e.target.value })}
                    placeholder="ACME Corporation"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>INN (STIR) *</Label>
                  <Input
                    value={addFormData.tax_id}
                    onChange={(e) => setAddFormData({ ...addFormData, tax_id: e.target.value })}
                    placeholder="123456789"
                    maxLength={9}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>OKED</Label>
                  <Input
                    value={addFormData.oked}
                    onChange={(e) => setAddFormData({ ...addFormData, oked: e.target.value })}
                    placeholder="46900"
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('currency') || 'Valyuta'}</Label>
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
              </div>
            </div>

            {/* Bank Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('bank_info') || 'Bank ma\'lumotlari'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('bank_account') || 'Hisob raqami'}</Label>
                  <Input
                    value={addFormData.bank_account}
                    onChange={(e) => setAddFormData({ ...addFormData, bank_account: e.target.value })}
                    placeholder="20208000123456789012"
                    maxLength={30}
                  />
                </div>

                <div className="space-y-2">
                  <Label>MFO</Label>
                  <Input
                    value={addFormData.bank_mfo}
                    onChange={(e) => setAddFormData({ ...addFormData, bank_mfo: e.target.value })}
                    placeholder="00440"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('bank_name') || 'Bank nomi'}</Label>
                  <Input
                    value={addFormData.bank_name}
                    onChange={(e) => setAddFormData({ ...addFormData, bank_name: e.target.value })}
                    placeholder={t('bank_name_placeholder') || "Kapitalbank, NBU, Ipoteka bank..."}
                  />
                </div>
              </div>
            </div>

            {/* Tax Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('tax_info') || 'Soliq ma\'lumotlari'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="add_is_vat_payer"
                    checked={addFormData.is_vat_payer}
                    onChange={(e) => setAddFormData({ ...addFormData, is_vat_payer: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="add_is_vat_payer" className="cursor-pointer">
                    {t('vat_payer') || "QQS to'lovchimi?"}
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>{t('tax_regime') || 'Soliq rejimi'}</Label>
                  <Select
                    value={addFormData.tax_regime}
                    onValueChange={(value) => setAddFormData({ ...addFormData, tax_regime: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select') || 'Tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{t('tax_general') || 'Umumiy'}</SelectItem>
                      <SelectItem value="simplified">{t('tax_simplified') || 'Aylanmadan'}</SelectItem>
                      <SelectItem value="single">{t('tax_single') || 'Yagona'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('activity_status') || 'Faoliyat holati'}</Label>
                  <Select
                    value={addFormData.activity_status}
                    onValueChange={(value) => setAddFormData({ ...addFormData, activity_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('status_active') || 'Faol'}</SelectItem>
                      <SelectItem value="suspended">{t('status_suspended') || "To'xtatilgan"}</SelectItem>
                      <SelectItem value="liquidating">{t('status_liquidating') || 'Tugatish'}</SelectItem>
                      <SelectItem value="dormant">{t('status_dormant') || 'Dormant'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('business_group') || 'Guruh/Klaster'}</Label>
                  <Input
                    value={addFormData.business_group}
                    onChange={(e) => setAddFormData({ ...addFormData, business_group: e.target.value })}
                    placeholder={t('business_group_placeholder') || "Qurilish, Mebel, Avtosalon..."}
                  />
                </div>

                {companies.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t('intercompany_vendors') || 'Intercompany vendorlar'}</Label>
                    <p className="text-xs text-slate-500">{t('intercompany_vendors_desc') || "Tanlangan kompaniyalarda vendor va mijoz sifatida avtomatik yaratiladi"}</p>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                        onClick={() => setAddVendorDropdownOpen(!addVendorDropdownOpen)}
                      >
                        <span className="truncate">
                          {addFormData.intercompany_vendor_ids.length > 0
                            ? companies.filter(c => addFormData.intercompany_vendor_ids.includes(c.id)).map(c => c.company_name).join(', ')
                            : t('select_companies') || 'Kompaniyalarni tanlang'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                      {addVendorDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white p-2 shadow-md">
                          <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {companies.map(company => {
                              const isSelected = addFormData.intercompany_vendor_ids.includes(company.id);
                              return (
                                <div
                                  key={company.id}
                                  className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-100"
                                  onClick={() => {
                                    const ids = isSelected
                                      ? addFormData.intercompany_vendor_ids.filter(id => id !== company.id)
                                      : [...addFormData.intercompany_vendor_ids, company.id];
                                    setAddFormData({ ...addFormData, intercompany_vendor_ids: ids });
                                  }}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    {isSelected && <Check className="h-4 w-4" />}
                                  </div>
                                  <span className="text-sm">{company.company_name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('contact_information') || 'Aloqa ma\'lumotlari'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('director_name') || 'Direktor F.I.O.'}</Label>
                  <Input
                    value={addFormData.director_name}
                    onChange={(e) => setAddFormData({ ...addFormData, director_name: e.target.value })}
                    placeholder="Abdullayev Alisher Karimovich"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('director_phone') || 'Direktor telefon'}</Label>
                  <Input
                    value={addFormData.director_phone}
                    onChange={(e) => setAddFormData({ ...addFormData, director_phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('company_phone') || 'Kompaniya telefon'}</Label>
                  <Input
                    value={addFormData.phone}
                    onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    placeholder="+998 71 234 56 78"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('email') || 'Email'}</Label>
                  <Input
                    type="email"
                    value={addFormData.email}
                    onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                    placeholder="info@company.uz"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('legal_address') || 'Yuridik manzil'}</Label>
                  <Input
                    value={addFormData.legal_address}
                    onChange={(e) => setAddFormData({ ...addFormData, legal_address: e.target.value })}
                    placeholder={t('legal_address_placeholder') || "Toshkent shahri, Chilonzor tumani, ..."}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{t('notes') || 'Izoh'}</h3>
              <div className="space-y-2">
                <textarea
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })}
                  placeholder={t('notes_placeholder') || 'Qo\'shimcha izohlar...'}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="add_is_active"
                  checked={addFormData.is_active}
                  onChange={(e) => setAddFormData({ ...addFormData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="add_is_active" className="cursor-pointer">
                  {t('company_active') || 'Kompaniya faol'}
                </Label>
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

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportData}
        columns={importColumns}
        entityName={t('companies') || 'Kompaniyalar'}
      />
    </div>
  );
}
