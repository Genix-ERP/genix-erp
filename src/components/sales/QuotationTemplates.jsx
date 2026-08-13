import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Edit, Trash2, FileText, Copy, Loader2,
  Package, Layers, Gift, Settings, ArrowUpDown
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { quotationTemplatesService } from '@/api/services/quotationTemplates';
import { paymentTermsService } from '@/api/services/paymentTerms';
import { pricelistsService } from '@/api/services/pricelists';
import { inventoryService } from '@/api/services/inventory';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

export default function QuotationTemplates() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { formatCurrency } = useCurrencyFormatter();

  const [templates, setTemplates] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [pricelists, setPricelists] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    validity_days: 30,
    payment_term_id: '',
    pricelist_id: '',
    terms_and_conditions: '',
    header_note: '',
    footer_note: '',
    require_signature: false,
    require_payment: false,
    payment_percentage: 0,
    show_line_subtotals: true,
    show_line_discounts: true,
    group_by_section: true,
    is_active: true,
    sections: [],
    lines: [],
    optionals: []
  });

  const [newSection, setNewSection] = useState({
    name: '',
    description: '',
    sequence: 10
  });

  const [newLine, setNewLine] = useState({
    section_id: '',
    product_id: '',
    product_name: '',
    description: '',
    quantity: 1,
    unit_price: null,
    discount_type: '',
    discount_value: 0,
    sequence: 10,
    display_type: 'product'
  });

  const [newOptional, setNewOptional] = useState({
    product_id: '',
    product_name: '',
    description: '',
    quantity: 1,
    unit_price: null,
    discount_type: '',
    discount_value: 0,
    sequence: 10
  });

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await quotationTemplatesService.listTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch quotation templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    try {
      const [termsData, pricelistsData, productsData] = await Promise.all([
        paymentTermsService.list().catch(() => []),
        pricelistsService.list().catch(() => []),
        inventoryService.listProducts({ limit: 500 }).catch(() => [])
      ]);
      setPaymentTerms(Array.isArray(termsData) ? termsData : []);
      setPricelists(Array.isArray(pricelistsData) ? pricelistsData : []);
      setProducts(Array.isArray(productsData) ? productsData : productsData?.items || []);
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchReferenceData();
  }, [fetchTemplates, fetchReferenceData]);

  // Filter templates
  const filteredTemplates = templates.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      validity_days: 30,
      payment_term_id: '',
      pricelist_id: '',
      terms_and_conditions: '',
      header_note: '',
      footer_note: '',
      require_signature: false,
      require_payment: false,
      payment_percentage: 0,
      show_line_subtotals: true,
      show_line_discounts: true,
      group_by_section: true,
      is_active: true,
      sections: [],
      lines: [],
      optionals: []
    });
    setNewSection({ name: '', description: '', sequence: 10 });
    setNewLine({
      section_id: '',
      product_id: '',
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: null,
      discount_type: '',
      discount_value: 0,
      sequence: 10,
      display_type: 'product'
    });
    setNewOptional({
      product_id: '',
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: null,
      discount_type: '',
      discount_value: 0,
      sequence: 10
    });
  };

  // Handle create
  const handleCreate = async () => {
    if (!formData.name) return;

    setIsSaving(true);
    try {
      await quotationTemplatesService.createTemplate(formData);
      await fetchTemplates();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create template:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit
  const handleEdit = async () => {
    if (!selectedTemplate || !formData.name) return;

    setIsSaving(true);
    try {
      await quotationTemplatesService.updateTemplate(selectedTemplate.id, formData);
      await fetchTemplates();
      setShowEditModal(false);
      setSelectedTemplate(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update template:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedTemplate) return;

    try {
      await quotationTemplatesService.deleteTemplate(selectedTemplate.id);
      await fetchTemplates();
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  // Handle duplicate
  const handleDuplicate = async (template) => {
    try {
      await quotationTemplatesService.duplicateTemplate(template.id);
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  // Open edit modal
  const openEditModal = async (template) => {
    try {
      const fullTemplate = await quotationTemplatesService.getTemplate(template.id);
      setSelectedTemplate(fullTemplate);
      setFormData({
        name: fullTemplate.name || '',
        code: fullTemplate.code || '',
        description: fullTemplate.description || '',
        validity_days: fullTemplate.validity_days || 30,
        payment_term_id: fullTemplate.payment_term_id || '',
        pricelist_id: fullTemplate.pricelist_id || '',
        terms_and_conditions: fullTemplate.terms_and_conditions || '',
        header_note: fullTemplate.header_note || '',
        footer_note: fullTemplate.footer_note || '',
        require_signature: fullTemplate.require_signature ?? false,
        require_payment: fullTemplate.require_payment ?? false,
        payment_percentage: fullTemplate.payment_percentage || 0,
        show_line_subtotals: fullTemplate.show_line_subtotals ?? true,
        show_line_discounts: fullTemplate.show_line_discounts ?? true,
        group_by_section: fullTemplate.group_by_section ?? true,
        is_active: fullTemplate.is_active ?? true,
        sections: fullTemplate.sections || [],
        lines: fullTemplate.lines || [],
        optionals: fullTemplate.optionals || []
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  // Add section
  const addSection = () => {
    if (!newSection.name) return;
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, { ...newSection, id: `new-${Date.now()}` }]
    }));
    setNewSection({ name: '', description: '', sequence: 10 });
  };

  // Remove section
  const removeSection = (index) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  // Add line
  const addLine = () => {
    if (!newLine.product_id && !newLine.product_name) return;
    const product = products.find(p => p.id === newLine.product_id);
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, {
        ...newLine,
        id: `new-${Date.now()}`,
        product_name: product?.name || newLine.product_name,
        unit_price: newLine.unit_price || product?.sale_price || null
      }]
    }));
    setNewLine({
      section_id: '',
      product_id: '',
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: null,
      discount_type: '',
      discount_value: 0,
      sequence: 10,
      display_type: 'product'
    });
  };

  // Remove line
  const removeLine = (index) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  // Add optional
  const addOptional = () => {
    if (!newOptional.product_id && !newOptional.product_name) return;
    const product = products.find(p => p.id === newOptional.product_id);
    setFormData(prev => ({
      ...prev,
      optionals: [...prev.optionals, {
        ...newOptional,
        id: `new-${Date.now()}`,
        product_name: product?.name || newOptional.product_name,
        unit_price: newOptional.unit_price || product?.sale_price || null
      }]
    }));
    setNewOptional({
      product_id: '',
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: null,
      discount_type: '',
      discount_value: 0,
      sequence: 10
    });
  };

  // Remove optional
  const removeOptional = (index) => {
    setFormData(prev => ({
      ...prev,
      optionals: prev.optionals.filter((_, i) => i !== index)
    }));
  };

  // Render template form
  const renderForm = () => (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="general">{t('general') || 'General'}</TabsTrigger>
        <TabsTrigger value="lines">{t('products') || 'Products'}</TabsTrigger>
        <TabsTrigger value="optionals">{t('optionals') || 'Optionals'}</TabsTrigger>
        <TabsTrigger value="settings">{t('settings') || 'Settings'}</TabsTrigger>
      </TabsList>

      {/* General Tab */}
      <TabsContent value="general" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('name') || 'Name'} *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('template_name') || 'Template name'}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('code') || 'Code'}</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., IT-SERVICES"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('description') || 'Description'}</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('template_description') || 'Template description'}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t('validity_days') || 'Validity (Days)'}</Label>
            <Input
              type="number"
              value={formData.validity_days}
              onChange={(e) => setFormData(prev => ({ ...prev, validity_days: parseInt(e.target.value) || 30 }))}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('payment_term') || 'Payment Term'}</Label>
            <Select
              value={formData.payment_term_id || '__none__'}
              onValueChange={(value) => setFormData(prev => ({ ...prev, payment_term_id: value === '__none__' ? '' : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select') || 'Select'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('none') || 'None'}</SelectItem>
                {paymentTerms.map(term => (
                  <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('pricelist') || 'Pricelist'}</Label>
            <Select
              value={formData.pricelist_id || '__none__'}
              onValueChange={(value) => setFormData(prev => ({ ...prev, pricelist_id: value === '__none__' ? '' : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select') || 'Select'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('none') || 'None'}</SelectItem>
                {pricelists.map(pl => (
                  <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('header_note') || 'Header Note'}</Label>
          <Textarea
            value={formData.header_note}
            onChange={(e) => setFormData(prev => ({ ...prev, header_note: e.target.value }))}
            placeholder={t('note_displayed_at_top') || 'Note displayed at the top of quotation'}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('footer_note') || 'Footer Note'}</Label>
          <Textarea
            value={formData.footer_note}
            onChange={(e) => setFormData(prev => ({ ...prev, footer_note: e.target.value }))}
            placeholder={t('note_displayed_at_bottom') || 'Note displayed at the bottom of quotation'}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('terms_and_conditions') || 'Terms and Conditions'}</Label>
          <Textarea
            value={formData.terms_and_conditions}
            onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
            placeholder={t('terms_placeholder') || 'Terms and conditions for the quotation'}
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
          />
          <Label>{t('active') || 'Active'}</Label>
        </div>
      </TabsContent>

      {/* Products/Lines Tab */}
      <TabsContent value="lines" className="space-y-4 mt-4">
        {/* Sections */}
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {t('sections') || 'Sections'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('section_name') || 'Section Name'}</Label>
                <Input
                  value={newSection.name}
                  onChange={(e) => setNewSection(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('section_name') || 'Section name'}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('description') || 'Description'}</Label>
                <Input
                  value={newSection.description}
                  onChange={(e) => setNewSection(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('description') || 'Description'}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('sequence') || 'Sequence'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={newSection.sequence}
                    onChange={(e) => setNewSection(prev => ({ ...prev, sequence: parseInt(e.target.value) || 10 }))}
                    min={1}
                  />
                  <Button onClick={addSection} disabled={!newSection.name}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {formData.sections.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('name') || 'Name'}</TableHead>
                    <TableHead>{t('description') || 'Description'}</TableHead>
                    <TableHead>{t('sequence') || 'Seq'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.sections.map((section, index) => (
                    <TableRow key={section.id || index}>
                      <TableCell className="font-medium">{section.name}</TableCell>
                      <TableCell>{section.description || '-'}</TableCell>
                      <TableCell>{section.sequence}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Product Lines */}
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('product_lines') || 'Product Lines'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t('product') || 'Product'}</Label>
                <Select
                  value={newLine.product_id}
                  onValueChange={(value) => {
                    const product = products.find(p => p.id === value);
                    setNewLine(prev => ({
                      ...prev,
                      product_id: value,
                      product_name: product?.name || '',
                      unit_price: product?.sale_price || null
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_product') || 'Select product'} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(prod => (
                      <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('quantity') || 'Quantity'}</Label>
                <Input
                  type="number"
                  value={newLine.quantity}
                  onChange={(e) => setNewLine(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('section') || 'Section'}</Label>
                <Select
                  value={newLine.section_id || '__none__'}
                  onValueChange={(value) => setNewLine(prev => ({ ...prev, section_id: value === '__none__' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('no_section') || 'No section'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('no_section') || 'No section'}</SelectItem>
                    {formData.sections.map(section => (
                      <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={addLine} className="w-full" disabled={!newLine.product_id}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add') || 'Add'}
                </Button>
              </div>
            </div>

            {formData.lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead>{t('quantity') || 'Qty'}</TableHead>
                    <TableHead>{t('price') || 'Price'}</TableHead>
                    <TableHead>{t('section') || 'Section'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.lines.map((line, index) => (
                    <TableRow key={line.id || index}>
                      <TableCell className="font-medium">{line.product_name || line.product?.name}</TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell>{line.unit_price ? formatCurrency(line.unit_price) : '-'}</TableCell>
                      <TableCell>
                        {line.section_id ? (
                          formData.sections.find(s => s.id === line.section_id)?.name || '-'
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Optionals Tab */}
      <TabsContent value="optionals" className="space-y-4 mt-4">
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gift className="w-4 h-4" />
              {t('optional_products') || 'Optional Products (Upsells)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              {t('optional_products_description') || 'Optional products that customers can add to their quotation.'}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('product') || 'Product'}</Label>
                <Select
                  value={newOptional.product_id}
                  onValueChange={(value) => {
                    const product = products.find(p => p.id === value);
                    setNewOptional(prev => ({
                      ...prev,
                      product_id: value,
                      product_name: product?.name || '',
                      unit_price: product?.sale_price || null
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_product') || 'Select product'} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(prod => (
                      <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('quantity') || 'Quantity'}</Label>
                <Input
                  type="number"
                  value={newOptional.quantity}
                  onChange={(e) => setNewOptional(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={addOptional} className="w-full" disabled={!newOptional.product_id}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add') || 'Add'}
                </Button>
              </div>
            </div>

            {formData.optionals.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('product') || 'Product'}</TableHead>
                    <TableHead>{t('quantity') || 'Qty'}</TableHead>
                    <TableHead>{t('price') || 'Price'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.optionals.map((opt, index) => (
                    <TableRow key={opt.id || index}>
                      <TableCell className="font-medium">{opt.product_name || opt.product?.name}</TableCell>
                      <TableCell>{opt.quantity}</TableCell>
                      <TableCell>{opt.unit_price ? formatCurrency(opt.unit_price) : '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOptional(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-4 mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('confirmation_settings') || 'Confirmation Settings'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('require_signature') || 'Require Signature'}</Label>
                <p className="text-sm text-slate-500">{t('require_signature_desc') || 'Customer must sign to confirm'}</p>
              </div>
              <Switch
                checked={formData.require_signature}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_signature: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('require_payment') || 'Require Payment'}</Label>
                <p className="text-sm text-slate-500">{t('require_payment_desc') || 'Require down payment to confirm'}</p>
              </div>
              <Switch
                checked={formData.require_payment}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_payment: checked }))}
              />
            </div>

            {formData.require_payment && (
              <div className="space-y-2">
                <Label>{t('payment_percentage') || 'Payment Percentage'}</Label>
                <Input
                  type="number"
                  value={formData.payment_percentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_percentage: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  max={100}
                  placeholder="e.g., 30"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              {t('display_settings') || 'Display Settings'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('show_line_subtotals') || 'Show Line Subtotals'}</Label>
                <p className="text-sm text-slate-500">{t('show_line_subtotals_desc') || 'Display subtotal for each line'}</p>
              </div>
              <Switch
                checked={formData.show_line_subtotals}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_line_subtotals: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('show_line_discounts') || 'Show Line Discounts'}</Label>
                <p className="text-sm text-slate-500">{t('show_line_discounts_desc') || 'Display discount for each line'}</p>
              </div>
              <Switch
                checked={formData.show_line_discounts}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_line_discounts: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('group_by_section') || 'Group by Section'}</Label>
                <p className="text-sm text-slate-500">{t('group_by_section_desc') || 'Group products by section'}</p>
              </div>
              <Switch
                checked={formData.group_by_section}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, group_by_section: checked }))}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t('search_templates') || 'Search templates...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="bg-gradient-to-r from-[var(--genix-blue)] to-[var(--genix-purple)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('new_template') || 'New Template'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.length}</p>
                <p className="text-sm text-slate-500">{t('total_templates') || 'Total Templates'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.reduce((sum, t) => sum + (t.line_count || 0), 0)}</p>
                <p className="text-sm text-slate-500">{t('product_lines') || 'Product Lines'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Gift className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.reduce((sum, t) => sum + (t.optional_count || 0), 0)}</p>
                <p className="text-sm text-slate-500">{t('optional_products') || 'Optional Products'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Layers className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.filter(t => t.is_active).length}</p>
                <p className="text-sm text-slate-500">{t('active') || 'Active'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                {t('no_templates') || 'No Templates'}
              </h3>
              <p className="text-sm text-slate-500">
                {t('create_first_template') || 'Create your first quotation template to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name') || 'Name'}</TableHead>
                  <TableHead>{t('code') || 'Code'}</TableHead>
                  <TableHead>{t('products') || 'Products'}</TableHead>
                  <TableHead>{t('optionals') || 'Optionals'}</TableHead>
                  <TableHead>{t('validity') || 'Validity'}</TableHead>
                  <TableHead>{t('status') || 'Status'}</TableHead>
                  <TableHead className="text-right">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <span className="font-medium">{template.name}</span>
                    </TableCell>
                    <TableCell>
                      {template.code ? (
                        <Badge variant="outline">{template.code}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{template.line_count || 0}</TableCell>
                    <TableCell>{template.optional_count || 0}</TableCell>
                    <TableCell>{template.validity_days} {t('days') || 'days'}</TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}
                        className={template.is_active ? 'bg-green-100 text-green-700' : ''}>
                        {template.is_active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(template)}
                          title={t('duplicate') || 'Duplicate'}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(template)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedTemplate(template); setShowDeleteDialog(true); }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('create_template') || 'Create Quotation Template'}</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('create') || 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_template') || 'Edit Quotation Template'}</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              {t('cancel') || 'Cancel'}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('save') || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_template') || 'Delete Template'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_template_confirm') || 'Are you sure you want to delete this template? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {t('delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
