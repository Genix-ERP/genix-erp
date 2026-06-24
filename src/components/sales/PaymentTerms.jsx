import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  CreditCard,
  Search,
  Plus,
  Edit,
  Trash2,
  Star,
  Clock,
  Calendar,
  Percent,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { paymentTermsService } from "@/api/services/paymentTerms";
import { useToast } from "@/components/ui/use-toast";

const TERM_TYPES = [
  { value: "immediate", label: "Due Immediately", description: "Payment is due upon receipt" },
  { value: "fixed", label: "Fixed Days", description: "Due in a specific number of days" },
  { value: "end_of_month", label: "End of Month", description: "Due at the end of the month" },
  { value: "end_of_next_month", label: "End of Next Month", description: "Due at the end of the following month" },
];

export default function PaymentTerms() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const [terms, setTerms] = useState([]);
  const [stats, setStats] = useState({ total_terms: 0, active_terms: 0, terms_with_orders: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [termToDelete, setTermToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    term_type: "fixed",
    due_days: 30,
    has_early_discount: false,
    discount_percentage: 0,
    discount_days: 0,
    end_of_month_day: null,
    display_order: 100,
    is_default: false,
    is_active: true,
  });

  // Load terms and stats
  useEffect(() => {
    loadTerms();
    loadStats();
  }, []);

  const loadTerms = async () => {
    setIsLoading(true);
    try {
      const data = await paymentTermsService.list();
      setTerms(data || []);
    } catch (error) {
      toast({
        title: t("error"),
        description: t("failedToLoadPaymentTerms") || "Failed to load payment terms",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await paymentTermsService.getStats();
      setStats(data || { total_terms: 0, active_terms: 0, terms_with_orders: 0 });
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  // Filter terms
  const filteredTerms = useMemo(() => {
    return terms.filter((term) => {
      const matchesSearch =
        term.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || term.term_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [terms, searchQuery, typeFilter]);

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      toast({
        title: t("error"),
        description: t("codeAndNameRequired") || "Code and name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const termData = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || null,
        term_type: formData.term_type,
        due_days: parseInt(formData.due_days) || 0,
        has_early_discount: formData.has_early_discount,
        discount_percentage: formData.has_early_discount ? parseFloat(formData.discount_percentage) || 0 : 0,
        discount_days: formData.has_early_discount ? parseInt(formData.discount_days) || 0 : 0,
        end_of_month_day: formData.end_of_month_day ? parseInt(formData.end_of_month_day) : null,
        display_order: parseInt(formData.display_order) || 100,
        is_default: formData.is_default,
        is_active: formData.is_active,
      };

      if (editingTerm) {
        await paymentTermsService.update(editingTerm.id, termData);
        toast({
          title: t("success"),
          description: t("paymentTermUpdated") || "Payment term updated successfully",
        });
      } else {
        await paymentTermsService.create(termData);
        toast({
          title: t("success"),
          description: t("paymentTermCreated") || "Payment term created successfully",
        });
      }

      await loadTerms();
      await loadStats();
      resetForm();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("failedToSavePaymentTerm") || "Failed to save payment term",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (term) => {
    setEditingTerm(term);
    setFormData({
      code: term.code || "",
      name: term.name || "",
      description: term.description || "",
      term_type: term.term_type || "fixed",
      due_days: term.due_days || 0,
      has_early_discount: term.has_early_discount || false,
      discount_percentage: term.discount_percentage || 0,
      discount_days: term.discount_days || 0,
      end_of_month_day: term.end_of_month_day || null,
      display_order: term.display_order || 100,
      is_default: term.is_default || false,
      is_active: term.is_active !== false,
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!termToDelete) return;

    try {
      await paymentTermsService.delete(termToDelete.id);
      toast({
        title: t("success"),
        description: t("paymentTermDeleted") || "Payment term deleted successfully",
      });
      await loadTerms();
      await loadStats();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("failedToDeletePaymentTerm") || "Failed to delete payment term",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirm(false);
      setTermToDelete(null);
    }
  };

  const handleSetDefault = async (term) => {
    try {
      await paymentTermsService.setDefault(term.id);
      toast({
        title: t("success"),
        description: t("defaultPaymentTermSet") || "Default payment term set successfully",
      });
      await loadTerms();
    } catch (error) {
      toast({
        title: t("error"),
        description: error.message || t("failedToSetDefault") || "Failed to set default",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      term_type: "fixed",
      due_days: 30,
      has_early_discount: false,
      discount_percentage: 0,
      discount_days: 0,
      end_of_month_day: null,
      display_order: 100,
      is_default: false,
      is_active: true,
    });
    setEditingTerm(null);
    setShowForm(false);
  };

  const getTermTypeLabel = (type) => {
    const termType = TERM_TYPES.find((t) => t.value === type);
    return termType ? termType.label : type;
  };

  const formatDueDays = (term) => {
    if (term.term_type === "immediate") return t("immediately") || "Immediately";
    if (term.term_type === "end_of_month") {
      return term.due_days > 0
        ? `${t("endOfMonth") || "End of Month"} + ${term.due_days} ${t("days") || "days"}`
        : t("endOfMonth") || "End of Month";
    }
    if (term.term_type === "end_of_next_month") {
      return term.due_days > 0
        ? `${t("endOfNextMonth") || "End of Next Month"} + ${term.due_days} ${t("days") || "days"}`
        : t("endOfNextMonth") || "End of Next Month";
    }
    return `${term.due_days} ${t("days") || "days"}`;
  };

  const formatDiscount = (term) => {
    if (!term.has_early_discount) return "-";
    return `${term.discount_percentage}% / ${term.discount_days} ${t("days") || "days"}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalTerms") || "Total Terms"}</p>
                <p className="text-2xl font-bold">{stats.total_terms}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("activeTerms") || "Active Terms"}</p>
                <p className="text-2xl font-bold text-green-600">{stats.active_terms}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("termsWithOrders") || "In Use"}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.terms_with_orders}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchPaymentTerms") || "Search payment terms..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("allTypes") || "All Types"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allTypes") || "All Types"}</SelectItem>
                  {TERM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(type.value) || type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("addPaymentTerm") || "Add Payment Term"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terms Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">{t("code") || "Code"}</TableHead>
                <TableHead>{t("name") || "Name"}</TableHead>
                <TableHead>{t("type") || "Type"}</TableHead>
                <TableHead>{t("dueDays") || "Due"}</TableHead>
                <TableHead>{t("earlyDiscount") || "Early Discount"}</TableHead>
                <TableHead>{t("order") || "Order"}</TableHead>
                <TableHead>{t("status") || "Status"}</TableHead>
                <TableHead className="text-right">{t("actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTerms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t("noPaymentTermsFound") || "No payment terms found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTerms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell>
                      <Badge variant="outline">{term.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{term.name}</span>
                        {term.is_default && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      {term.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {term.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t(term.term_type) || getTermTypeLabel(term.term_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDueDays(term)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {term.has_early_discount ? (
                        <div className="flex items-center gap-1">
                          <Percent className="h-4 w-4 text-green-500" />
                          <span className="text-green-600">{formatDiscount(term)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{term.display_order}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={term.is_active ? "default" : "secondary"}>
                        {term.is_active ? t("active") || "Active" : t("inactive") || "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!term.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSetDefault(term)}
                            title={t("setAsDefault") || "Set as default"}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(term)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTermToDelete(term);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTerm ? t("editPaymentTerm") || "Edit Payment Term" : t("createPaymentTerm") || "Create Payment Term"}
            </DialogTitle>
            <DialogDescription>
              {t("paymentTermFormDescription") || "Configure payment term settings including due date calculation and early payment discounts"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("code") || "Code"} *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="NET30"
                    maxLength={30}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("name") || "Name"} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Net 30"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("description") || "Description"}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("paymentTermDescriptionPlaceholder") || "e.g., Payment is due within 30 days"}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("termType") || "Term Type"}</Label>
                  <Select
                    value={formData.term_type}
                    onValueChange={(value) => setFormData({ ...formData, term_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERM_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{t(type.value) || type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.term_type !== "immediate" && (
                  <div className="space-y-2">
                    <Label>
                      {formData.term_type === "fixed"
                        ? t("dueDays") || "Due Days"
                        : t("additionalDays") || "Additional Days"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="365"
                      value={formData.due_days}
                      onChange={(e) => setFormData({ ...formData, due_days: e.target.value })}
                    />
                    {formData.term_type !== "fixed" && (
                      <p className="text-xs text-muted-foreground">
                        {t("additionalDaysHint") || "Days added after the end of month"}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("displayOrder") || "Display Order"}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("displayOrderHint") || "Lower numbers appear first in lists"}
                  </p>
                </div>
              </div>
            </div>

            {/* Early Payment Discount */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="has_early_discount"
                  checked={formData.has_early_discount}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_early_discount: checked })}
                />
                <Label htmlFor="has_early_discount" className="font-semibold">
                  {t("enableEarlyPaymentDiscount") || "Enable Early Payment Discount"}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("earlyDiscountHint") || 'e.g., "2/10 Net 30" means 2% discount if paid within 10 days'}
              </p>

              {formData.has_early_discount && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>{t("discountPercentage") || "Discount Percentage"}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("discountDays") || "Discount Days"}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="365"
                      value={formData.discount_days}
                      onChange={(e) => setFormData({ ...formData, discount_days: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("discountDaysHint") || "Days within which discount applies"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Options */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">{t("termIsActive") || "Payment term is active"}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label htmlFor="is_default">{t("setAsDefaultTerm") || "Set as default payment term"}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              {t("cancel") || "Cancel"}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : null}
              {editingTerm ? t("update") || "Update" : t("create") || "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete") || "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deletePaymentTermConfirmation") ||
                `Are you sure you want to delete "${termToDelete?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t("delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
