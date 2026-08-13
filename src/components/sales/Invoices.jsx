import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Receipt,
  Send,
  CheckCircle,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  CreditCard,
  Banknote,
  AlertTriangle,
  FileText,
  RotateCcw,
  Globe,
  ChevronDown,
  ChevronUp,
  Printer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, differenceInDays, startOfDay } from "date-fns";
import { useSales } from "@/components/contexts/SalesContext";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES } from "@/config/permissions";
import { inventoryService } from "@/api/services/inventory";
import { salesService } from "@/api/services/sales";
import apiClient from "@/api/client";
import { useCompany } from "@/components/contexts/CompanyContext";
import { getPrintCompanyConfig } from "./printConfig";
import { useFinancials } from "@/components/contexts/FinancialsContext";
import { useAdminSettings } from "@/components/contexts/AdminSettingsContext";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

export default function Invoices({ openInvoiceId = null, onInvoiceOpened = null }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { activeCompany } = useCompany();
  const { formatCurrency, formatCurrencyCompact } = useCurrencyFormatter();
  const { getSetting } = useAdminSettings();
  const { taxRates = [], journals = [], paymentJournals = [], currencies = [], exchangeRates = [], getLatestExchangeRate } = useFinancials();
  const bankCashJournals = paymentJournals.length > 0 ? paymentJournals : journals.filter(j => j.type === 'bank' || j.type === 'cash');

  // Helper to get translated journal name
  const getJournalName = (journal) => {
    if (!journal) return '-';
    if (language === 'uz' && journal.name_uz) return journal.name_uz;
    if (language === 'en' && journal.name_en) return journal.name_en;
    return journal.name || '-';
  };

  // Get default tax from settings
  const defaultSalesTaxId = getSetting('sales.tax.default_tax_id', '');
  const salesTaxRates = taxRates.filter(tr => tr.tax_type === 'sales' || !tr.tax_type);
  // Prefer the explicitly configured default, fall back to first active sales tax
  const defaultSalesTax = defaultSalesTaxId
    ? taxRates.find(tr => String(tr.id) === String(defaultSalesTaxId))
    : salesTaxRates.find(tr => tr.is_active !== false) || null;

  const {
    invoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
    isLoading,
    refreshData,
  } = useSales();

  const { customers } = useCustomers();
  const { canCreate, isSuperAdmin } = usePermissions();

  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedInvoices, setPaginatedInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const pageSize = 20;

  // Fetch invoices with server-side pagination
  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const params = { page: currentPage, page_size: pageSize };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.type = typeFilter;

      const response = await apiClient.get('/sales-invoices', { params });
      const data = response.data?.data || [];
      const meta = response.data?.meta;
      setPaginatedInvoices(data);
      if (meta) {
        setTotalInvoices(meta.total || 0);
        setTotalPages(meta.total_pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setPaginatedInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter]);

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await inventoryService.listProducts();
        setProducts(data || []);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };
    loadProducts();
  }, []);

  // Auto-open invoice when openInvoiceId is provided (e.g. after creating from order)
  useEffect(() => {
    if (openInvoiceId) {
      const openInvoice = async () => {
        try {
          const fullInvoice = await getInvoice(openInvoiceId);
          setSelectedInvoice(fullInvoice);
          setShowDetails(true);
        } catch (error) {
          console.error('Failed to open invoice:', error);
          // Try from list
          const inv = invoices.find(i => i.id === openInvoiceId);
          if (inv) {
            setSelectedInvoice(inv);
            setShowDetails(true);
          }
        }
        if (onInvoiceOpened) onInvoiceOpened();
      };
      openInvoice();
    }
  }, [openInvoiceId]);

  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [creditNoteReason, setCreditNoteReason] = useState("");
  const [creditNoteInvoice, setCreditNoteInvoice] = useState(null);
  const [expandedDiffs, setExpandedDiffs] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const baseCurrency = currencies.find(c => c.is_base) || { code: 'UZS' };
  const foreignCurrencies = currencies.filter(c => !c.is_base && c.is_active);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    currency_code: "UZS",
    exchange_rate: 1,
    items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }],
    discount_amount: 0,
    tax_percent: defaultSalesTax?.rate || 0,
    notes: "",
  });

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    journal_id: '',
    date: new Date().toISOString().split("T")[0],
    write_off: false,
    write_off_amount: 0,
  });

  // Server-side filtering is done in fetchInvoices; just use paginatedInvoices directly
  const filteredInvoices = paginatedInvoices;

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const paid = invoices
      .filter((inv) => inv.payment_status === "paid")
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const outstanding = invoices
      .filter((inv) => inv.payment_status !== "paid")
      .reduce((sum, inv) => sum + (inv.balance || inv.amount_due || 0), 0);
    const overdue = invoices
      .filter((inv) => {
        if (inv.payment_status === "paid") return false;
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today; // Only overdue if BEFORE today
      })
      .reduce((sum, inv) => sum + (inv.balance || inv.amount_due || 0), 0);
    return { total, paid, outstanding, overdue };
  }, [invoices]);

  const calculateTotals = (items, discountAmount, taxPercent) => {
    const rawSubtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const rate = parseFloat(taxPercent) || 0;
    const isInclusive = defaultSalesTax?.price_include && rate > 0;
    if (isInclusive) {
      const taxAmount = rawSubtotal * rate / (100 + rate);
      const subtotal = rawSubtotal - taxAmount;
      const afterDiscount = subtotal - discountAmount;
      const total = afterDiscount + taxAmount;
      return { subtotal, taxAmount, total, isInclusive: true };
    }
    const afterDiscount = rawSubtotal - discountAmount;
    const taxAmount = (afterDiscount * rate) / 100;
    const total = afterDiscount + taxAmount;
    return { subtotal: rawSubtotal, taxAmount, total, isInclusive: false };
  };

  // Handle currency selection — auto-fill exchange rate from latest MB rate
  const handleCurrencyChange = (code) => {
    if (code === baseCurrency.code) {
      setFormData(prev => ({ ...prev, currency_code: code, exchange_rate: 1 }));
      return;
    }
    const latestRate = getLatestExchangeRate(code);
    setFormData(prev => ({
      ...prev,
      currency_code: code,
      exchange_rate: latestRate?.rate || prev.exchange_rate || 1,
    }));
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0 }],
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = field === "product_name" || field === "product_id" ? value : parseFloat(value) || 0;
    setFormData({ ...formData, items: newItems });
  };

  const handleProductSelect = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const newItems = [...formData.items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        product_name: product.name,
        unit_price: product.list_price || product.price || 0,
      };
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: customer.company_name,
      });
    }
  };

  const handleSubmit = async () => {
    const { subtotal, taxAmount, total } = calculateTotals(
      formData.items,
      formData.discount_amount,
      formData.tax_percent
    );

    // Backend expects 'lines' not 'items', and 'description' is required
    const currencyObj = currencies.find(c => c.code === formData.currency_code);
    const data = {
      customer_id: formData.customer_id,
      organization_id: activeCompany?.id,
      invoice_date: formData.invoice_date,
      // due_date is optional — when omitted, the backend derives it from the
      // customer's payment term (fallback NET30).
      ...(formData.due_date ? { due_date: formData.due_date } : {}),
      notes: formData.notes,
      currency_id: currencyObj?.id || undefined,
      exchange_rate: formData.exchange_rate || 1,
      // The backend derives VAT only from line tax_id → tax_rates; the typed
      // percent alone never reached the server, so invoices stored 0 tax
      // (soliq audit 2026-08-13). Resolve the entered percent to a catalog
      // rate (preferring the configured default).
      lines: formData.items.map((item) => {
        const pct = parseFloat(formData.tax_percent) || 0;
        const matchedTax = pct > 0
          ? (parseFloat(defaultSalesTax?.rate) === pct
              ? defaultSalesTax
              : salesTaxRates.find(tr => parseFloat(tr.rate) === pct))
          : null;
        return {
          product_id: item.product_id,
          description: item.product_name || "Product",
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: 0,
          tax_id: matchedTax?.id || undefined,
        };
      }),
    };

    if (editMode && selectedInvoice) {
      await updateInvoice(selectedInvoice.id, data);
    } else {
      // Pass customer_name so it appears immediately in the list
      await createInvoice(data, formData.customer_name);
    }
    await fetchInvoices();
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditMode(false);
    setSelectedInvoice(null);
    setFormData({
      customer_id: "",
      customer_name: "",
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      currency_code: "UZS",
      exchange_rate: 1,
      items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }],
      discount_amount: 0,
      tax_percent: defaultSalesTax?.rate || 0,
      notes: "",
    });
  };

  const handleEdit = async (invoice) => {
    try {
      // Fetch full invoice details with lines
      const fullInvoice = await getInvoice(invoice.id);
      setSelectedInvoice(fullInvoice);

      // Convert lines to items format for the form
      const items = (fullInvoice.lines || fullInvoice.items || []).map(line => ({
        product_id: line.product_id || "",
        product_name: line.description || line.product_name || "",
        quantity: line.quantity || 1,
        unit_price: line.unit_price || 0,
      }));

      setFormData({
        customer_id: fullInvoice.customer_id || "",
        customer_name: fullInvoice.customer_name || "",
        invoice_date: fullInvoice.invoice_date || "",
        due_date: fullInvoice.due_date || "",
        currency_code: fullInvoice.currency_code || currencies.find(c => c.id === fullInvoice.currency_id)?.code || "UZS",
        exchange_rate: fullInvoice.exchange_rate || 1,
        items: items.length > 0 ? items : [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }],
        discount_amount: fullInvoice.discount_amount || 0,
        tax_percent: fullInvoice.tax_percent || defaultSalesTax?.rate || 0,
        notes: fullInvoice.notes || "",
      });
      setEditMode(true);
      setShowForm(true);
    } catch (error) {
      console.error('Failed to fetch invoice for editing:', error);
      // Fallback to list data
      setSelectedInvoice(invoice);
      setFormData({
        customer_id: invoice.customer_id || "",
        customer_name: invoice.customer_name || "",
        invoice_date: invoice.invoice_date || "",
        due_date: invoice.due_date || "",
        currency_code: invoice.currency_code || currencies.find(c => c.id === invoice.currency_id)?.code || "UZS",
        exchange_rate: invoice.exchange_rate || 1,
        items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }],
        discount_amount: invoice.discount_amount || 0,
        tax_percent: invoice.tax_percent || defaultSalesTax?.rate || 0,
        notes: invoice.notes || "",
      });
      setEditMode(true);
      setShowForm(true);
    }
  };

  const handleView = async (invoice) => {
    try {
      // Fetch full invoice details with lines
      const fullInvoice = await getInvoice(invoice.id);
      setSelectedInvoice(fullInvoice);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to fetch invoice details:', error);
      // Fallback to list data if fetch fails
      setSelectedInvoice(invoice);
      setShowDetails(true);
    }
  };

  const handleSend = async (invoice) => {
    try {
      await salesService.sendInvoice(invoice.id);
      // Refresh the invoice list
      await fetchInvoices();
    } catch (err) {
      console.error("Failed to send invoice:", err);
    }
  };

  const handlePayment = (invoice) => {
    setSelectedInvoice(invoice);
    const defaultJournal = bankCashJournals.find(j => j.type === 'bank') || bankCashJournals[0];
    setPaymentData({
      amount: invoice.balance || 0,
      journal_id: defaultJournal?.id || '',
      date: new Date().toISOString().split("T")[0],
      write_off: false,
      write_off_amount: 0,
    });
    setShowPaymentModal(true);
  };

  const handlePrintAllocationReceipt = (invoice, alloc) => {
    if (!invoice || !alloc) return;
    const paymentDate = alloc.payment_date
      ? format(new Date(alloc.payment_date), 'dd.MM.yyyy')
      : format(new Date(), 'dd.MM.yyyy');
    const methodLabels = {
      bank_transfer: language === 'ru' ? 'Банковский перевод' : language === 'uz' ? 'Bank o\'tkazmasi' : 'Bank Transfer',
      cash: language === 'ru' ? 'Наличные' : language === 'uz' ? 'Naqd' : 'Cash',
    };
    const journalName = (language === 'uz' && alloc.journal_name_uz ? alloc.journal_name_uz : language === 'en' && alloc.journal_name_en ? alloc.journal_name_en : alloc.journal_name) || '-';
    const method = journalName.toLowerCase().includes('kassa') || journalName.toLowerCase().includes('cash') || journalName.toLowerCase().includes('нал') ? 'cash' : 'bank_transfer';

    const html = `
      <html>
      <head>
        <title>${t('payment_receipt')} - ${alloc.payment_number}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; font-size: 13px; max-width: 700px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .header h1 { font-size: 20px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
          .header .receipt-number { font-size: 14px; color: #555; }
          .receipt-body { margin: 20px 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ccc; }
          .row .label { color: #555; font-weight: bold; width: 40%; }
          .row .value { text-align: right; width: 58%; }
          .amount-row { background: #f5f5f5; padding: 12px; margin: 15px 0; border: 1px solid #ddd; }
          .amount-row .label { font-size: 15px; font-weight: bold; }
          .amount-row .value { font-size: 20px; font-weight: bold; color: #16a34a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .signatures div { width: 45%; }
          .sig-line { border-bottom: 1px solid #000; margin-top: 35px; margin-bottom: 4px; }
          .sig-label { font-size: 11px; color: #666; }
          .footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; color: #888; font-size: 11px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t('payment_receipt')}</h1>
          <div class="receipt-number">
            ${t('receipt_number') || 'Receipt No'}: <strong>${alloc.payment_number}</strong>
          </div>
        </div>

        <div class="receipt-body">
          <div class="row">
            <span class="label">${t('receipt_date')}:</span>
            <span class="value">${paymentDate}</span>
          </div>

          <div class="row">
            <span class="label">${t('receipt_received_from')}:</span>
            <span class="value"><strong>${invoice.customer_name || '-'}</strong></span>
          </div>

          <div class="row amount-row">
            <span class="label">${t('receipt_amount')}:</span>
            <span class="value">${formatCurrency(parseFloat(alloc.amount) || 0)}</span>
          </div>

          <div class="row">
            <span class="label">${t('receipt_payment_method')}:</span>
            <span class="value">${methodLabels[method] || method}</span>
          </div>

          <div class="row">
            <span class="label">${t('receipt_journal')}:</span>
            <span class="value">${journalName}</span>
          </div>

          <div class="row">
            <span class="label">${t('receipt_invoice')}:</span>
            <span class="value">${invoice.invoice_number}</span>
          </div>

          <div class="row">
            <span class="label">${t('total_amount')}:</span>
            <span class="value">${formatCurrency(invoice.total_amount || 0)}</span>
          </div>

          <div class="row">
            <span class="label">${t('balance')}:</span>
            <span class="value">${formatCurrency(invoice.balance || 0)}</span>
          </div>
        </div>

        <div class="signatures">
          <div>
            <p><strong>${t('receipt_accountant')}:</strong></p>
            <div class="sig-line"></div>
            <p class="sig-label">${t('receipt_signature')}</p>
          </div>
          <div>
            <p><strong>${t('receipt_director')}:</strong></p>
            <div class="sig-line"></div>
            <p class="sig-label">${t('receipt_signature')} / ${t('receipt_stamp_place')}</p>
          </div>
        </div>

        <div class="footer">
          ${t('receipt_thank_you')}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handlePrintPaymentReceipt = (invoice, payment) => {
    if (!invoice || !payment) return;
    const paymentDate = payment.date
      ? format(new Date(payment.date), 'dd.MM.yyyy')
      : format(new Date(), 'dd.MM.yyyy');
    const selectedJournal = bankCashJournals.find(j => j.id === payment.journal_id);
    const methodLabels = {
      bank_transfer: language === 'ru' ? 'Банковский перевод' : language === 'uz' ? 'Bank o\'tkazmasi' : 'Bank Transfer',
      cash: language === 'ru' ? 'Наличные' : language === 'uz' ? 'Naqd' : 'Cash',
    };
    const method = selectedJournal?.type === 'cash' ? 'cash' : 'bank_transfer';

    const html = `
      <html>
      <head>
        <title>${t('payment_receipt')} - ${invoice.invoice_number}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; font-size: 13px; max-width: 700px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .header h1 { font-size: 20px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
          .header .receipt-number { font-size: 14px; color: #555; }
          .receipt-body { margin: 20px 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ccc; }
          .row .label { color: #555; font-weight: bold; width: 40%; }
          .row .value { text-align: right; width: 58%; }
          .amount-row { background: #f5f5f5; padding: 12px; margin: 15px 0; border: 1px solid #ddd; }
          .amount-row .label { font-size: 15px; font-weight: bold; }
          .amount-row .value { font-size: 20px; font-weight: bold; color: #16a34a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .signatures div { width: 45%; }
          .sig-line { border-bottom: 1px solid #000; margin-top: 35px; margin-bottom: 4px; }
          .sig-label { font-size: 11px; color: #666; }
          .footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; color: #888; font-size: 11px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t('payment_receipt')}</h1>
          <div class="receipt-number">
            ${t('receipt_invoice')}: <strong>${invoice.invoice_number}</strong>
          </div>
        </div>

        <div class="receipt-body">
          <div class="row">
            <span class="label">${t('receipt_date')}:</span>
            <span class="value">${paymentDate}</span>
          </div>

          <div class="row">
            <span class="label">${t('receipt_received_from')}:</span>
            <span class="value"><strong>${invoice.customer_name || '-'}</strong></span>
          </div>

          <div class="row amount-row">
            <span class="label">${t('receipt_amount')}:</span>
            <span class="value">${formatCurrency(parseFloat(payment.amount) || 0)}</span>
          </div>

          <div class="row">
            <span class="label">${t('receipt_payment_method')}:</span>
            <span class="value">${methodLabels[method] || method}</span>
          </div>

          ${selectedJournal ? `
          <div class="row">
            <span class="label">${t('receipt_journal')}:</span>
            <span class="value">${getJournalName(selectedJournal)}</span>
          </div>` : ''}

          <div class="row">
            <span class="label">${t('receipt_invoice')}:</span>
            <span class="value">${invoice.invoice_number}</span>
          </div>

          <div class="row">
            <span class="label">${t('total_amount')}:</span>
            <span class="value">${formatCurrency(invoice.total_amount || 0)}</span>
          </div>

          <div class="row">
            <span class="label">${t('balance')}:</span>
            <span class="value">${formatCurrency(Math.max(0, (invoice.balance || invoice.total_amount || 0) - (parseFloat(payment.amount) || 0)))}</span>
          </div>
        </div>

        <div class="signatures">
          <div>
            <p><strong>${t('receipt_accountant')}:</strong></p>
            <div class="sig-line"></div>
            <p class="sig-label">${t('receipt_signature')}</p>
          </div>
          <div>
            <p><strong>${t('receipt_director')}:</strong></p>
            <div class="sig-line"></div>
            <p class="sig-label">${t('receipt_signature')} / ${t('receipt_stamp_place')}</p>
          </div>
        </div>

        <div class="footer">
          ${t('receipt_thank_you')}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  // "Chop etish" — A4 hisob-faktura print form (O'zbek standard):
  // seller rekvizitlari (INN, address, bank), buyer block, lines table
  // with per-line QQS, totals, Rahbar / Bosh buxgalter signature lines.
  const handlePrintInvoice = async (invoice) => {
    if (!invoice) return;
    // List rows don't carry lines — fetch the full invoice first.
    let inv = invoice;
    if (!Array.isArray(inv.lines) && !Array.isArray(inv.items)) {
      try {
        inv = await getInvoice(invoice.id);
      } catch (error) {
        console.error('Failed to fetch invoice for printing:', error);
      }
    }
    const company = getPrintCompanyConfig(activeCompany);
    const lines = inv.lines || inv.items || [];
    const lineNet = (line) => line.line_total || line.total || (line.quantity || 0) * (line.unit_price || 0);
    const linesNetTotal = lines.reduce((sum, line) => sum + lineNet(line), 0);
    const subtotal = inv.subtotal ?? linesNetTotal;
    const taxAmount = inv.tax_amount || 0;
    const grandTotal = inv.total_amount ?? subtotal + taxAmount;
    const invoiceDate = inv.invoice_date
      ? format(new Date(inv.invoice_date), 'dd.MM.yyyy')
      : format(new Date(), 'dd.MM.yyyy');
    const dueDate = inv.due_date ? format(new Date(inv.due_date), 'dd.MM.yyyy') : '-';

    // Header VAT allocated proportionally across lines for the QQS column.
    const lineRows = lines.length > 0
      ? lines.map((line, i) => {
          const net = lineNet(line);
          const vat = linesNetTotal > 0 ? taxAmount * (net / linesNetTotal) : 0;
          return `
            <tr>
              <td class="c">${i + 1}</td>
              <td>${line.description || line.product_name || '-'}</td>
              <td class="c">${line.quantity || 0}</td>
              <td class="r">${formatCurrency(line.unit_price || 0)}</td>
              <td class="r">${formatCurrency(vat)}</td>
              <td class="r">${formatCurrency(net + vat)}</td>
            </tr>`;
        }).join('')
      : `<tr><td class="c">1</td><td colspan="5">-</td></tr>`;

    const reqRow = (label, value) => value
      ? `<div class="req"><span>${label}:</span> <strong>${value}</strong></div>`
      : '';

    const html = `
      <html>
      <head>
        <title>${t('receipt_invoice')} № ${inv.invoice_number || ''}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', serif; color: #000; font-size: 12px; padding: 24px; max-width: 800px; margin: 0 auto; }
          .seller { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
          .seller .name { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
          .req { padding: 1px 0; }
          .req span { color: #444; }
          h1 { text-align: center; font-size: 17px; margin: 18px 0 4px 0; text-transform: uppercase; letter-spacing: 1px; }
          .doc-dates { text-align: center; margin-bottom: 16px; color: #333; }
          .buyer { border: 1px solid #000; padding: 8px 10px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 14px 0; }
          th, td { border: 1px solid #000; padding: 5px 7px; }
          th { background: #f0f0f0; text-align: center; font-size: 11px; }
          td.c { text-align: center; }
          td.r { text-align: right; white-space: nowrap; }
          .totals { width: 45%; margin-left: auto; }
          .totals .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .totals .grand { font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 5px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 55px; }
          .signatures div { width: 45%; }
          .sig-line { border-bottom: 1px solid #000; margin-top: 30px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="seller">
          <div class="name">${t('print_seller')}: ${company.name}</div>
          ${reqRow(t('tax_id') || 'INN', company.inn)}
          ${reqRow(t('address'), company.address)}
          ${reqRow(t('phone'), company.phone)}
          ${reqRow(t('bank_name'), company.bank_name)}
          ${reqRow('MFO', company.bank_mfo)}
          ${reqRow(t('bank_account'), company.bank_account)}
        </div>

        <h1>${t('receipt_invoice')} № ${inv.invoice_number || ''}</h1>
        <div class="doc-dates">
          ${t('date')}: <strong>${invoiceDate}</strong>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          ${t('print_due')}: <strong>${dueDate}</strong>
        </div>

        <div class="buyer">
          <strong>${t('print_buyer')}:</strong> ${inv.customer_name || '-'}<br/>
          ${t('tax_id') || 'INN'}: ${inv.customer_inn || inv.customer_tax_id || '____________'}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:6%">№</th>
              <th>${t('name')}</th>
              <th style="width:11%">${t('quantity')}</th>
              <th style="width:16%">${t('price')}</th>
              <th style="width:15%">${t('print_vat')}</th>
              <th style="width:18%">${t('receipt_amount')}</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>

        <div class="totals">
          <div class="row"><span>${t('print_total')}:</span> <span>${formatCurrency(subtotal)}</span></div>
          <div class="row"><span>${t('print_vat')}:</span> <span>${formatCurrency(taxAmount)}</span></div>
          <div class="row grand"><span>${t('print_grand_total')}:</span> <span>${formatCurrency(grandTotal)}</span></div>
        </div>

        <div class="signatures">
          <div>
            <p><strong>${t('print_director')}:</strong></p>
            <div class="sig-line"></div>
          </div>
          <div>
            <p><strong>${t('print_chief_accountant')}:</strong></p>
            <div class="sig-line"></div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const [paymentError, setPaymentError] = useState('');

  const handlePaymentSubmit = async () => {
    if (!selectedInvoice || !(parseFloat(paymentData.amount) > 0)) return;
    // Derive payment method from selected journal type
    const selectedJournal = bankCashJournals.find(j => j.id === paymentData.journal_id);
    const method = selectedJournal?.type === 'cash' ? 'cash' : 'bank_transfer';
    setPaymentError('');
    try {
      await recordPayment(
        selectedInvoice.id,
        paymentData.amount,
        method,
        paymentData.date,
        paymentData.write_off ? paymentData.write_off_amount : 0,
        // The journal the user chose, rather than leaving the server to guess.
        paymentData.journal_id
      );
      await fetchInvoices();
      // Store for receipt printing before clearing
      const invoiceForReceipt = { ...selectedInvoice };
      const paymentForReceipt = { ...paymentData };
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      // Auto-open print receipt
      handlePrintPaymentReceipt(invoiceForReceipt, paymentForReceipt);
    } catch (err) {
      // This used to be an unhandled promise rejection. The server returns a
      // precise, actionable 400 — an unconfigured account, a locked period, an
      // overpayment — and every one of them reached the console and nowhere
      // else, so the button simply appeared dead.
      const msg = getApiErrorMessage(err, "To'lovni qayd etib bo'lmadi");
      setPaymentError(msg);
      toast.error(msg);
    }
  };

  const handleDelete = (invoice) => {
    setInvoiceToDelete(invoice);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (invoiceToDelete) {
      await deleteInvoice(invoiceToDelete.id);
      await fetchInvoices();
      setShowDeleteConfirm(false);
      setInvoiceToDelete(null);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: { color: "bg-slate-100 text-slate-800", label: t("draft") },
      sent: { color: "bg-blue-100 text-blue-800", label: t("sent") },
      paid: { color: "bg-green-100 text-green-800", label: t("paid") },
      partial: { color: "bg-yellow-100 text-yellow-800", label: t("partial_paid") },
      unpaid: { color: "bg-red-100 text-red-800", label: t("unpaid") },
      overdue: { color: "bg-red-100 text-red-800", label: t("overdue") },
    };
    const variant = variants[status] || variants.unpaid;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const handleCreateCreditNote = (invoice) => {
    setCreditNoteInvoice(invoice);
    setCreditNoteReason("");
    setShowCreditNoteModal(true);
  };

  const handleCreditNoteSubmit = async () => {
    if (!creditNoteInvoice || !creditNoteReason.trim()) return;
    setIsSaving(true);
    try {
      await salesService.createCreditNote(creditNoteInvoice.id, {
        reason: creditNoteReason,
      });
      setShowCreditNoteModal(false);
      setCreditNoteInvoice(null);
      setCreditNoteReason("");
      // Refresh the paginated list and the shared sales context in place
      // (a full page reload here used to dump the user's tab/filter state).
      await fetchInvoices();
      refreshData?.();
    } catch (error) {
      console.error("Failed to create credit note:", error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCreditNote = async (creditNoteId) => {
    try {
      await salesService.confirmCreditNote(creditNoteId);
      await fetchInvoices();
      refreshData?.();
    } catch (error) {
      console.error("Failed to confirm credit note:", error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  const getPaymentStatusBadge = (invoice) => {
    if (invoice.payment_status === "paid") {
      return getStatusBadge("paid");
    }
    // Only mark as overdue if due date is BEFORE today (not including today)
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    // Set both to start of day for accurate comparison
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      return getStatusBadge("overdue");
    }
    return getStatusBadge(invoice.payment_status);
  };

  const getDaysUntilDue = (dueDate) => {
    // Parse due_date as local date (YYYY-MM-DD) to avoid timezone issues
    const [y, m, d] = String(dueDate).split('T')[0].split('-').map(Number);
    const due = startOfDay(new Date(y, m - 1, d));
    const today = startOfDay(new Date());
    const days = differenceInDays(due, today);
    if (days < 0) return { text: `${Math.abs(days)} ${t("days_ago")}`, isOverdue: true };
    if (days === 0) return { text: t("today"), isOverdue: false };
    return { text: `${days} ${t("days_left")}`, isOverdue: false };
  };

  const { subtotal, taxAmount, total, isInclusive } = calculateTotals(
    formData.items,
    formData.discount_amount,
    formData.tax_percent
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">{t("total")}</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrencyCompact(stats.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">{t("paid")}</p>
                <p className="text-lg font-bold text-green-900">
                  {formatCurrencyCompact(stats.paid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-yellow-600 font-medium">{t("pending")}</p>
                <p className="text-lg font-bold text-yellow-900">
                  {formatCurrencyCompact(stats.outstanding)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-red-600 font-medium">{t("overdue")}</p>
                <p className="text-lg font-bold text-red-900">
                  {formatCurrencyCompact(stats.overdue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--genix-navy)]">{t("invoices")}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t("customer_invoices")}
          </p>
        </div>
        {canCreate(MODULES.SALES) && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("new_invoice")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={t("search_invoices")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="invoice">{t("invoices")}</SelectItem>
            <SelectItem value="credit_note">{t("credit_notes")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
            <SelectItem value="partial">{t("partial_paid")}</SelectItem>
            <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices List */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardContent className="p-0">
          {(isLoading || invoicesLoading) ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_invoices_found')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>{t('invoice_number')}</TableHead>
                    <TableHead>{t('customer')}</TableHead>
                    <TableHead>{t('due_date')}</TableHead>
                    <TableHead className="text-right">{t('amount')}</TableHead>
                    <TableHead className="text-right">{t('paid') || 'Paid'}</TableHead>
                    <TableHead className="text-right">{t('balance')}</TableHead>
                    <TableHead>{t('payment_method') || 'Payment Method'}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const dueInfo = getDaysUntilDue(invoice.due_date);
                    return (
                      <TableRow key={invoice.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {invoice.invoice_type === "credit_note" ? (
                              <RotateCcw className="w-4 h-4 text-red-500" />
                            ) : (
                              <Receipt className="w-4 h-4 text-slate-400" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">{invoice.invoice_number}</span>
                              {invoice.order_number && (
                                <span className="text-xs text-slate-500">
                                  {t('order') || 'Buyurtma'}: {invoice.order_number}
                                </span>
                              )}
                            </div>
                            {invoice.invoice_type === "credit_note" && (
                              <Badge className="bg-red-100 text-red-700 text-xs">{t("credit_note")}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{invoice.customer_name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <div>
                              <div className="text-sm">
                                {format(new Date(invoice.due_date), "dd.MM.yyyy")}
                              </div>
                              <div
                                className={`text-xs ${
                                  dueInfo.isOverdue ? "text-red-500" : "text-slate-500"
                                }`}
                              >
                                {dueInfo.text}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${(invoice.amount_paid || 0) > 0 ? "text-green-600" : "text-slate-400"}`}>
                            {formatCurrency(invoice.amount_paid || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-medium ${
                              (invoice.balance || invoice.amount_due || 0) > 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {formatCurrency(invoice.balance || invoice.amount_due || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const pj = language === 'uz' ? (invoice.payment_journals_uz || invoice.payment_journals)
                              : language === 'en' ? (invoice.payment_journals_en || invoice.payment_journals)
                              : invoice.payment_journals;
                            return pj ? (
                              <span className="text-sm text-slate-700">{pj}</span>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(invoice)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(invoice)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('view')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintInvoice(invoice)}>
                                <Printer className="w-4 h-4 mr-2" />
                                {t('invoice_print_action')}
                              </DropdownMenuItem>
                              {invoice.payment_status !== "paid" && (invoice.invoice_type || "invoice") === "invoice" && (
                                <DropdownMenuItem onClick={() => handlePayment(invoice)}>
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  {t('make_payment')}
                                </DropdownMenuItem>
                              )}
                              {invoice.invoice_type === "credit_note" && invoice.status === "draft" && (
                                <DropdownMenuItem onClick={() => handleConfirmCreditNote(invoice.id)}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                  {t('confirm_credit_note')}
                                </DropdownMenuItem>
                              )}
                              {invoice.status === "draft" && (
                                <>
                                  {(invoice.invoice_type || "invoice") === "invoice" && (
                                    <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      {t('edit')}
                                    </DropdownMenuItem>
                                  )}
                                  {(invoice.invoice_type || "invoice") === "invoice" && (
                                    <DropdownMenuItem onClick={() => handleSend(invoice)}>
                                      <Send className="w-4 h-4 mr-2" />
                                      {t('send')}
                                    </DropdownMenuItem>
                                  )}
                                  {isSuperAdmin && (
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(invoice)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      {t('delete')}
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <span className="text-sm text-slate-600">
                {t('showing') || 'Showing'} {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalInvoices)} {t('of') || 'of'} {totalInvoices}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? t('edit_invoice') : t('new_invoice')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Customer & Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('customer')} *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={handleCustomerSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_customer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('invoice_date')} *</Label>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('due_date')}</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                />
                <p className="text-xs text-slate-400">
                  {t('due_date_auto_hint') || "Bo'sh qoldirilsa — to'lov shartidan"}
                </p>
              </div>
            </div>

            {/* Currency & Exchange Rate */}
            {foreignCurrencies.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('currency') || 'Valyuta'}</Label>
                  <Select value={formData.currency_code} onValueChange={handleCurrencyChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={baseCurrency.code}>{baseCurrency.code} ({t('base') || 'Asosiy'})</SelectItem>
                      {foreignCurrencies.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.currency_code !== baseCurrency.code && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('exchange_rate') || 'Valyuta kursi'} (1 {formData.currency_code} = ? {baseCurrency.code})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.exchange_rate}
                        onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 0 })}
                        disabled={editMode && selectedInvoice?.status !== 'draft'}
                      />
                      {editMode && selectedInvoice?.status !== 'draft' && (
                        <p className="text-xs text-amber-600">{t('rate_locked') || 'Kurs qotib qolgan'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{baseCurrency.code} {t('equivalent') || 'ekvivalent'}</Label>
                      <div className="px-3 py-2 bg-slate-50 rounded-md border text-sm font-medium text-slate-700">
                        {formatCurrency(total * (formData.exchange_rate || 1))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">{t('products')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('add')}
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="w-24">{t('quantity')}</TableHead>
                      <TableHead className="w-36">{t('price')}</TableHead>
                      <TableHead className="w-36 text-right">{t('total')}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.product_id}
                            onValueChange={(value) => handleProductSelect(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('select_product')} />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, "quantity", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={formatPriceInput(item.unit_price)}
                            onChange={(e) =>
                              handleItemChange(index, "unit_price", parsePriceInput(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                        <TableCell>
                          {formData.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('discount_amount')}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatPriceInput(formData.discount_amount)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_amount: parsePriceInput(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('tax')} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.tax_percent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tax_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('subtotal')}:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {formData.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t('discount')}:</span>
                  <span>-{formatCurrency(formData.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>{t('tax')} ({formData.tax_percent}%{isInclusive ? ` ${t('incl') || 'incl.'}` : ''}):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>{t('total')}:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('additional_info')}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !formData.customer_id ||
                  formData.items.length === 0
                }
              >
                {editMode ? t('save') : t('create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => { setShowPaymentModal(open); if (!open) setPaymentError(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {t('make_payment')}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">{t('invoice')}:</span>
                  <span className="font-medium">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">{t('total_amount')}:</span>
                  <span className="font-medium">
                    {formatCurrency(selectedInvoice.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('balance')}:</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(selectedInvoice.balance)}
                  </span>
                </div>
              </div>

              {selectedInvoice.early_discount_amount > 0 && selectedInvoice.early_discount_date &&
               new Date(selectedInvoice.early_discount_date) >= new Date() && selectedInvoice.amount_paid === 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm space-y-1">
                  <div className="font-medium text-green-700">
                    {t('early_payment_discount') || 'Early Payment Discount'}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">{t('discount_amount') || 'Discount'}:</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.early_discount_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">{t('pay_before') || 'Pay before'}:</span>
                    <span className="font-medium">{format(new Date(selectedInvoice.early_discount_date), 'dd.MM.yyyy')}</span>
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {t('early_discount_hint') || 'Discount will be applied automatically when payment is recorded before the deadline'}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('payment_amount')} *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatPriceInput(paymentData.amount)}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      amount: parsePriceInput(e.target.value),
                    })
                  }
                />
              </div>


              <div className="space-y-2">
                <Label>{t('journal') || 'Journal'} *</Label>
                <Select
                  value={paymentData.journal_id}
                  onValueChange={(value) =>
                    setPaymentData({ ...paymentData, journal_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_journal') || 'Select journal'} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankCashJournals.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        {t('no_journals_available') || 'No journals available'}
                      </SelectItem>
                    ) : (
                      bankCashJournals.map(j => (
                        <SelectItem key={j.id} value={j.id}>
                          <div className="flex items-center gap-2">
                            {j.type === 'cash'
                              ? <Banknote className="w-4 h-4 text-green-600" />
                              : <CreditCard className="w-4 h-4 text-blue-600" />}
                            {getJournalName(j)}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('payment_date')}</Label>
                <Input
                  type="date"
                  value={paymentData.date}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, date: e.target.value })
                  }
                />
              </div>

              {/* Shown in the dialog, not only as a toast: the reason a
                  payment was refused belongs next to the form that will have
                  to be corrected. */}
              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{paymentError}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handlePaymentSubmit}
                  disabled={!(parseFloat(paymentData.amount) > 0) || !paymentData.journal_id}
                >
                  {t('record_payment')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedInvoice.customer_name}
                  </h3>
                </div>
                {getPaymentStatusBadge(selectedInvoice)}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">{t('invoice_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.invoice_date), "dd.MM.yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t('due_date')}:</span>
                  <p className="font-medium">
                    {format(new Date(selectedInvoice.due_date), "dd.MM.yyyy")}
                  </p>
                </div>
                {selectedInvoice.payment_date && (
                  <div>
                    <span className="text-slate-500">{t('payment_date')}:</span>
                    <p className="font-medium">
                      {format(new Date(selectedInvoice.payment_date), "dd.MM.yyyy")}
                    </p>
                  </div>
                )}
              </div>

              {/* Currency info for foreign currency invoices */}
              {selectedInvoice.exchange_rate && selectedInvoice.exchange_rate !== 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Globe className="w-4 h-4" />
                    <span className="font-medium">
                      {currencies.find(c => c.id === selectedInvoice.currency_id)?.code || 'USD'}
                    </span>
                    <span>— {t('exchange_rate') || 'Valyuta kursi'}:</span>
                    <span className="font-semibold">{Number(selectedInvoice.exchange_rate).toLocaleString()} {baseCurrency.code}</span>
                  </div>
                  <div className="text-xs text-blue-500">
                    {selectedInvoice.status !== 'draft' && (t('rate_locked') || 'Kurs qotib qolgan')}
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-center">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('price')}</TableHead>
                      <TableHead className="text-right">{t('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedInvoice.lines || selectedInvoice.items || []).map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{line.description || line.product_name}</TableCell>
                        <TableCell className="text-center">{line.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.line_total || line.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('subtotal')}:</span>
                  <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>{t('discount')}:</span>
                    <span>-{formatCurrency(selectedInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>{t('tax')}:</span>
                  <span>{formatCurrency(selectedInvoice.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>{t('total')}:</span>
                  <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
                {(() => {
                  const allocations = selectedInvoice.payment_allocations || [];
                  const confirmedTotal = allocations
                    .filter(a => a.status === 'confirmed')
                    .reduce((sum, a) => sum + (a.amount || 0), 0);
                  const draftTotal = allocations
                    .filter(a => a.status === 'draft')
                    .reduce((sum, a) => sum + (a.amount || 0), 0);
                  const remainingDebt = selectedInvoice.total_amount - confirmedTotal;
                  return (
                    <>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          {t('confirmed_payments') || "To'langan"}:
                        </span>
                        <span className="text-green-600 font-medium">
                          {formatCurrency(confirmedTotal)}
                        </span>
                      </div>
                      {draftTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            {t('pending_payments') || 'Kutilmoqda'}:
                          </span>
                          <span className="text-amber-600 font-medium">
                            {formatCurrency(draftTotal)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold">
                        <span>{t('remaining_debt') || 'Qoldiq qarz'}:</span>
                        <span className={remainingDebt > 0 ? "text-red-600" : "text-green-600"}>
                          {formatCurrency(remainingDebt)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Payment History */}
              {(selectedInvoice.payment_allocations || []).length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-medium">{t('payment_history') || "To'lovlar tarixi"}</h4>
                  </div>
                  <div className="divide-y">
                    {(selectedInvoice.payment_allocations || []).map((alloc) => (
                      <div key={alloc.id} className="px-4 py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={alloc.status === 'confirmed' ? 'default' : 'secondary'}
                            className={alloc.status === 'confirmed'
                              ? 'bg-green-100 text-green-700 hover:bg-green-100'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                            }>
                            {alloc.status === 'confirmed' ? t('confirmed') || 'Tasdiqlangan' : t('draft') || 'Qoralama'}
                          </Badge>
                          <span className="text-slate-600">{alloc.payment_number}</span>
                          {alloc.journal_name && (
                            <span className="text-slate-400 text-xs">({language === 'uz' && alloc.journal_name_uz ? alloc.journal_name_uz : language === 'en' && alloc.journal_name_en ? alloc.journal_name_en : alloc.journal_name})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs">
                            {format(new Date(alloc.payment_date), 'dd.MM.yyyy')}
                          </span>
                          <span className={`font-medium ${alloc.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'}`}>
                            {formatCurrency(alloc.amount)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-sm gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintAllocationReceipt(selectedInvoice, alloc);
                            }}
                          >
                            <Printer className="w-4 h-4" />
                            {t('print_receipt')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exchange Differences */}
              {(selectedInvoice.exchange_diffs || []).length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-purple-50 px-4 py-2 border-b">
                    <h4 className="text-sm font-medium text-purple-800">{t('exchange_difference') || 'Kurs farqi'}</h4>
                  </div>
                  <div className="divide-y">
                    {selectedInvoice.exchange_diffs.map((ed) => (
                      <div key={ed.id} className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={ed.type === 'positive' ? 'default' : 'destructive'}
                              className={ed.type === 'positive'
                                ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                : 'bg-red-100 text-red-700 hover:bg-red-100'
                              }>
                              {ed.type === 'positive' ? (t('exchange_profit') || 'Foyda') : (t('exchange_loss') || 'Zarar')}
                            </Badge>
                            <span className="text-slate-600 text-xs">{ed.document_number || ed.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${ed.type === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                              {ed.type === 'positive' ? '+' : '-'}{formatCurrency(ed.amount)}
                            </span>
                            {(ed.initial_rate || ed.final_rate) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                onClick={() => setExpandedDiffs(prev => ({ ...prev, [ed.id]: !prev[ed.id] }))}
                              >
                                {expandedDiffs[ed.id] ? (
                                  <>{t('hide') || 'Yopish'} <ChevronUp className="w-3 h-3 ml-1" /></>
                                ) : (
                                  <>{t('details') || 'Batafsil'} <ChevronDown className="w-3 h-3 ml-1" /></>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        {expandedDiffs[ed.id] && (ed.initial_rate || ed.final_rate) && (
                          <div className="mt-2 grid grid-cols-4 gap-2 text-xs bg-slate-50 rounded p-2">
                            <div>
                              <span className="text-slate-500">{t('invoice_rate') || 'HF kursi'}:</span>
                              <span className="ml-1 font-mono font-medium">{Number(ed.initial_rate).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{t('payment_rate') || "To'lov kursi"}:</span>
                              <span className="ml-1 font-mono font-medium">{Number(ed.final_rate).toLocaleString()}</span>
                            </div>
                            {ed.foreign_amount > 0 && (
                              <div>
                                <span className="text-slate-500">{t('foreign_amount') || 'Valyuta summa'}:</span>
                                <span className="ml-1 font-mono font-medium">{Number(ed.foreign_amount).toLocaleString()}</span>
                              </div>
                            )}
                            {ed.date && (
                              <div>
                                <span className="text-slate-500">{t('date') || 'Sana'}:</span>
                                <span className="ml-1 font-mono font-medium">{format(new Date(ed.date), 'dd.MM.yyyy')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.early_discount_amount > 0 && selectedInvoice.early_discount_date && (
                <div className={`p-3 rounded-lg border text-sm space-y-1 ${
                  new Date(selectedInvoice.early_discount_date) >= new Date()
                    ? 'bg-green-50 border-green-200'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <div className="font-medium text-green-700">
                    {t('early_payment_discount') || 'Early Payment Discount'}
                  </div>
                  <div className="flex justify-between">
                    <span>{t('discount_amount') || 'Discount'}:</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.early_discount_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('pay_before') || 'Pay before'}:</span>
                    <span className="font-medium">{format(new Date(selectedInvoice.early_discount_date), 'dd.MM.yyyy')}</span>
                  </div>
                  {new Date(selectedInvoice.early_discount_date) < new Date() && (
                    <div className="text-xs text-slate-500 italic">{t('discount_expired') || 'Discount period has expired'}</div>
                  )}
                </div>
              )}

              {selectedInvoice.notes && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Print Last Payment Receipt - big prominent button */}
              {(selectedInvoice.amount_paid > 0 || (selectedInvoice.payment_allocations || []).length > 0) && (
                <Button
                  onClick={() => {
                    const allocs = selectedInvoice.payment_allocations || [];
                    const lastAlloc = allocs.length > 0 ? allocs[allocs.length - 1] : null;
                    if (lastAlloc) {
                      handlePrintAllocationReceipt(selectedInvoice, lastAlloc);
                    } else {
                      handlePrintPaymentReceipt(selectedInvoice, {
                        amount: selectedInvoice.amount_paid || 0,
                        date: selectedInvoice.payment_date || new Date().toISOString().split('T')[0],
                        journal_id: '',
                      });
                    }
                  }}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                >
                  <Printer className="w-5 h-5 mr-3" />
                  {t('print_receipt')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit Note Modal */}
      <Dialog open={showCreditNoteModal} onOpenChange={setShowCreditNoteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-500" />
              {t('create_credit_note')}
            </DialogTitle>
          </DialogHeader>
          {creditNoteInvoice && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('invoice_number')}:</span>
                  <span className="font-medium">{creditNoteInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('customer')}:</span>
                  <span className="font-medium">{creditNoteInvoice.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('amount')}:</span>
                  <span className="font-semibold">{formatCurrency(creditNoteInvoice.total_amount)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('credit_note_reason')} *</Label>
                <Textarea
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  placeholder={t('credit_note_reason_placeholder') || "Enter reason for credit note..."}
                  rows={3}
                />
              </div>
              <p className="text-xs text-slate-500">
                {t('credit_note_description') || "A full credit note will be created for the total invoice amount. You can confirm it later to post the GL entries."}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreditNoteModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleCreditNoteSubmit}
                  disabled={!creditNoteReason.trim() || isSaving}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSaving ? t('creating') || "Creating..." : t('create_credit_note')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('confirm_deletion')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              {t('delete_invoice_confirm')}
            </p>
            {invoiceToDelete && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="font-semibold">{invoiceToDelete.invoice_number}</p>
                <p className="text-sm text-slate-500">{invoiceToDelete.customer_name}</p>
                <p className="text-sm font-medium mt-1">
                  {formatCurrency(invoiceToDelete.total_amount)}
                </p>
              </div>
            )}
            <p className="text-sm text-red-500 mt-3">
              {t('this_action_cannot_be_undone')}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
