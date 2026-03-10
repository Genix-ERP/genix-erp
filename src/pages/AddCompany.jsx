import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/components/contexts/CompanyContext";
import { useSubscription } from "@/components/contexts/SubscriptionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ArrowLeft,
  AlertTriangle,
  Crown,
  Check
} from "lucide-react";
import { Link } from "react-router-dom";

export default function AddCompany() {
  const navigate = useNavigate();
  const { addCompany, getCompanyCount } = useCompany();
  const { getPlanLimits } = useSubscription();

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    company_code: "",
    company_name: "",
    country: "Uzbekistan",
    currency: "UZS",
    accounting_standard: "LOCAL_GAAP",
    is_active: true
  });

  const navigateTimeoutRef = useRef(null);
  useEffect(() => {
    return () => { if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current); };
  }, []);

  const limits = getPlanLimits();
  const maxCompanies = limits.maxCompanies || 1;
  const companyCount = getCompanyCount();
  const canAddMore = maxCompanies === -1 || companyCount < maxCompanies;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    if (!canAddMore) {
      setError(`Kompaniya limiti (${maxCompanies}) ga yetildi. Tarifni yangilang.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await addCompany(formData, maxCompanies);
      if (!result || !result.success) {
        setError(result?.message || 'Xatolik yuz berdi');
        setIsSubmitting(false);
        return;
      }
      setSuccess(true);
      navigateTimeoutRef.current = setTimeout(() => {
        navigate('/settings?tab=companies');
      }, 1500);
    } catch (err) {
      console.error("Error saving company:", err);
      setError(err?.message || 'Kompaniyani saqlashda xatolik');
      setIsSubmitting(false);
    }
  };

  if (!canAddMore) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/settings?tab=companies" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Sozlamalarga qaytish
          </Link>

          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  <Crown className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Kompaniya limiti tugadi</h2>
                <p className="text-slate-600 max-w-md mx-auto">
                  Sizning {limits.name} tarifingiz {maxCompanies} ta kompaniyaga ruxsat beradi.
                  Ko'proq kompaniya qo'shish uchun tarifni yangilang.
                </p>
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {companyCount} / {maxCompanies}
                  </Badge>
                </div>
                <Link to="/settings?tab=subscription">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 mt-4">
                    <Crown className="w-4 h-4 mr-2" />
                    Tarifni yangilash
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Kompaniya yaratildi!</h2>
                <p className="text-slate-600">
                  "{formData.company_name}" muvaffaqiyatli qo'shildi.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/companies" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Kompaniyalarga qaytish
        </Link>

        {/* Usage Banner */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    Kompaniyalar: {companyCount} / {maxCompanies === -1 ? '∞' : maxCompanies}
                  </p>
                  <p className="text-sm text-slate-600">
                    {limits.name} tarifida {maxCompanies === -1 ? 'cheksiz' : maxCompanies + ' tagacha'} kompaniya
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Yangi kompaniya qo'shish
            </CardTitle>
            <CardDescription>
              Yangi kompaniya profili yarating. Keyinchalik tahrirlash mumkin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_code">Kompaniya kodi *</Label>
                  <Input
                    id="company_code"
                    value={formData.company_code}
                    onChange={(e) => setFormData({...formData, company_code: e.target.value.toUpperCase()})}
                    placeholder="COMP001"
                    required
                  />
                  <p className="text-xs text-slate-500">Noyob identifikator (ACME01)</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Link to="/companies">
                  <Button type="button" variant="outline">
                    Bekor qilish
                  </Button>
                </Link>
                <Button type="submit" className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]">
                  <Building2 className="w-4 h-4 mr-2" />
                  Kompaniya yaratish
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
