import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, CheckCircle, AlertTriangle, Banknote, Plus, Search,
  Sparkles, ChevronLeft, ChevronRight, ArrowUpDown, Users, Bell,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAuth } from '@/components/contexts/AuthContext';
import contractsService from '@/api/services/contracts';
import { contactsService } from '@/api/services';
import { Employee } from '@/api/entities';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { CONTRACT_STATUSES, CONTRACT_DIRECTIONS } from '@/components/contracts/constants';

const EMPTY_FORM = {
  contract_number: '',
  title: '',
  vendor_id: '',
  direction: 'expense',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  signed_date: '',
  value: '',
  currency: 'UZS',
  responsible_employee_id: '',
  description: '',
};

// Saved views — each maps to server-side list params.
const VIEWS = [
  { key: 'all', labelKey: 'view_all_contracts', params: {} },
  { key: 'active', labelKey: 'view_active_contracts', params: { status: 'active' } },
  { key: 'expiring', labelKey: 'view_expiring_contracts', params: { expiring_within: 30 } },
  { key: 'mine', labelKey: 'view_my_contracts', params: {} }, // responsible added at runtime
  { key: 'archived', labelKey: 'view_archived_contracts', params: { archived: 'true' } },
];

export default function Contracts() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [contacts, setContacts] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDealLink, setPendingDealLink] = useState(null);
  // AI extraction state
  const [aiFile, setAiFile] = useState(null); // { file_id, file_name }
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiFields, setAiFields] = useState(null); // suggestions for the hint chip
  const aiInputRef = useRef(null);

  const myEmployeeId = useMemo(() => {
    const me = employees.find((e) => e.user_id && user?.id && e.user_id === user.id);
    return me?.id || null;
  }, [employees, user]);

  const debounceRef = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await contractsService.getStats());
    } catch (e) {
      console.error('Failed to load contract stats:', e);
    }
  }, []);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = { page, limit: 20, sort_by: sortBy, sort_order: sortOrder };
      const viewDef = VIEWS.find((v) => v.key === view) || VIEWS[0];
      Object.assign(params, viewDef.params);
      if (view === 'mine' && myEmployeeId) params.responsible_employee_id = myEmployeeId;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== 'all' && !params.status) params.status = statusFilter;
      if (directionFilter !== 'all') params.direction = directionFilter;
      if (responsibleFilter !== 'all' && view !== 'mine') params.responsible_employee_id = responsibleFilter;
      const { items, meta: m } = await contractsService.list(params);
      setRows(items);
      setMeta(m);
    } catch (e) {
      console.error('Failed to load contracts:', e);
      toast.error(t('loading_error'));
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortOrder, view, searchQuery, statusFilter, directionFilter, responsibleFilter, myEmployeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadList, searchQuery ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [loadList, searchQuery]);

  useEffect(() => {
    contactsService.list().then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => setContacts([]));
    Employee.list().then((d) => setEmployees(Array.isArray(d) ? d : [])).catch(() => setEmployees([]));
  }, []);

  // CRM "Bitim yutildi" entry: /contracts?create=1&counterparty_id=..&title=..&value=..&deal_id=..
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setForm((f) => ({
        ...f,
        title: searchParams.get('title') || f.title,
        vendor_id: searchParams.get('counterparty_id') || f.vendor_id,
        value: searchParams.get('value') || f.value,
        direction: searchParams.get('direction') || 'income',
      }));
      if (searchParams.get('deal_id')) setPendingDealLink(searchParams.get('deal_id'));
      setShowCreateModal(true);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = async () => {
    setForm(EMPTY_FORM);
    setAiFile(null);
    setAiFields(null);
    setShowCreateModal(true);
    try {
      const { contract_number } = await contractsService.getNextNumber();
      setForm((f) => (f.contract_number ? f : { ...f, contract_number }));
    } catch { /* suggestion only */ }
  };

  const handleAiExtract = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAiExtracting(true);
    try {
      const res = await contractsService.aiExtract(file);
      setAiFile({ file_id: res.file_id, file_name: res.file_name });
      const s = res.suggestions;
      if (!s) {
        toast.info(t('ai_extract_unavailable'));
        return;
      }
      const val = (k) => s[k]?.value ?? null;
      const matchedContact = val('counterparty_name')
        ? contacts.find((c) => (c.name || '').toLowerCase().includes(String(val('counterparty_name')).toLowerCase())
          || String(val('counterparty_name')).toLowerCase().includes((c.name || '').toLowerCase()))
        : null;
      setForm((f) => ({
        ...f,
        contract_number: val('contract_number') || f.contract_number,
        title: val('title') || val('subject') || f.title,
        vendor_id: matchedContact?.id || f.vendor_id,
        value: val('value') != null ? String(val('value')) : f.value,
        currency: val('currency') || f.currency,
        start_date: val('start_date') || f.start_date,
        end_date: val('end_date') || f.end_date,
        signed_date: val('signed_date') || f.signed_date,
        description: val('subject') || f.description,
      }));
      setAiFields(s);
      toast.success(t('ai_extract_done'));
    } catch (err) {
      console.error('AI extract failed:', err);
      toast.error(t('ai_extract_failed'));
    } finally {
      setAiExtracting(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.vendor_id || !form.start_date) return;
    setIsSubmitting(true);
    try {
      const created = await contractsService.create({
        contract_number: form.contract_number || undefined,
        title: form.title,
        vendor_id: form.vendor_id,
        direction: form.direction,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        signed_date: form.signed_date || undefined,
        value: parseFloat(form.value) || 0,
        currency: form.currency,
        responsible_employee_id: form.responsible_employee_id || undefined,
        description: form.description || undefined,
      });
      // Attach the AI-extracted document as file version 1.
      if (aiFile?.file_id && created?.id) {
        try { await contractsService.attachFile(created.id, aiFile.file_id); } catch (e) { console.error(e); }
      }
      if (pendingDealLink && created?.id) {
        try { await contractsService.createLink(created.id, 'crm_deal', pendingDealLink); } catch (e) { console.error(e); }
        setPendingDealLink(null);
      }
      toast.success(t('contract_created'));
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      setAiFile(null);
      setAiFields(null);
      loadStats();
      if (created?.id) navigate(`/contracts/${created.id}`);
      else loadList();
    } catch (err) {
      console.error('Failed to create contract:', err);
      const msg = err?.response?.status === 409 ? t('contract_number_taken') : t('contract_create_failed');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'created_at' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const selectView = (key) => {
    setView(key);
    setPage(1);
    if (key !== 'all') {
      setStatusFilter('all');
    }
  };

  const statusChip = (status) => {
    const cfg = CONTRACT_STATUSES[status] || CONTRACT_STATUSES.draft;
    return <Badge variant="outline" className={cfg.chip}>{t(cfg.labelKey)}</Badge>;
  };

  const expiryCell = (row) => {
    if (!row.end_date) return <span className="text-slate-400">{t('contract_open_ended')}</span>;
    const dateStr = formatDate(row.end_date);
    const d = row.days_to_expiry;
    if (row.status === 'active' && d != null && d >= 0 && d <= 30) {
      return (
        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
          <Bell className="w-3.5 h-3.5" />
          {dateStr}
          <span className="text-xs">({d} {t('days')})</span>
        </span>
      );
    }
    return <span>{dateStr}</span>;
  };

  const statCards = [
    { icon: FileText, tint: 'bg-blue-100 text-blue-600', label: t('total_contracts'), value: stats?.total ?? '—' },
    { icon: CheckCircle, tint: 'bg-green-100 text-green-600', label: t('active_contracts'), value: stats?.active ?? '—' },
    {
      icon: AlertTriangle,
      tint: (stats?.expiring_soon ?? 0) > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500',
      label: t('expiring_30_days'),
      value: stats?.expiring_soon ?? '—',
      valueClass: (stats?.expiring_soon ?? 0) > 0 ? 'text-amber-600' : '',
    },
    { icon: Banknote, tint: 'bg-violet-100 text-violet-600', label: t('active_contracts_value'), value: stats ? formatCurrency(stats.active_total_value) : '—' },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((c, i) => (
            <Card key={i} className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.tint}`}>
                    <c.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-600 truncate">{c.label}</p>
                    <p className={`text-xl font-bold text-slate-900 truncate ${c.valueClass || ''}`}>{c.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Registry */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6 space-y-4">
            {/* Saved views + actions */}
            <div className="flex flex-wrap items-center gap-2">
              {VIEWS.filter((v) => v.key !== 'mine' || myEmployeeId).map((v) => (
                <Button
                  key={v.key}
                  size="sm"
                  variant={view === v.key ? 'default' : 'outline'}
                  onClick={() => selectView(v.key)}
                >
                  {t(v.labelKey)}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => navigate('/employee-contracts')}>
                <Users className="w-4 h-4 mr-1.5" />
                {t('employee_contracts_link')}
              </Button>
              <div className="flex-1" />
              {canCreate(MODULES.CONTRACTS) && (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('new_contract')}
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t('search_contracts')}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                />
              </div>
              {view === 'all' && (
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_status')}</SelectItem>
                    {Object.entries(CONTRACT_STATUSES).map(([k, cfg]) => (
                      <SelectItem key={k} value={k}>{t(cfg.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={directionFilter} onValueChange={(v) => { setDirectionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_directions')}</SelectItem>
                  <SelectItem value="income">{t('direction_income')}</SelectItem>
                  <SelectItem value="expense">{t('direction_expense')}</SelectItem>
                </SelectContent>
              </Select>
              {view !== 'mine' && (
                <Select value={responsibleFilter} onValueChange={(v) => { setResponsibleFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[190px]"><SelectValue placeholder={t('responsible')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_responsibles')}</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.full_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">{t('no_contracts_yet')}</p>
                {canCreate(MODULES.CONTRACTS) && view === 'all' && !searchQuery && (
                  <Button onClick={openCreate} className="mt-4">{t('create_first_contract')}</Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('contract_number')}>
                        <span className="flex items-center gap-1">{t('contract_number')} <ArrowUpDown className="w-3 h-3" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('title')}>
                        <span className="flex items-center gap-1">{t('contract_name')} <ArrowUpDown className="w-3 h-3" /></span>
                      </TableHead>
                      <TableHead>{t('counterparty')}</TableHead>
                      <TableHead>{t('direction')}</TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('value')}>
                        <span className="flex items-center gap-1 justify-end">{t('contract_amount_col')} <ArrowUpDown className="w-3 h-3" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('end_date')}>
                        <span className="flex items-center gap-1">{t('end_date')} <ArrowUpDown className="w-3 h-3" /></span>
                      </TableHead>
                      <TableHead>{t('responsible')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/contracts/${row.id}`)}
                      >
                        <TableCell className="font-mono font-medium whitespace-nowrap">{row.contract_number}</TableCell>
                        <TableCell className="max-w-[260px]">
                          <span className="font-medium text-slate-900 line-clamp-1">{row.title}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px]"><span className="line-clamp-1">{row.vendor_name}</span></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={(CONTRACT_DIRECTIONS[row.direction] || CONTRACT_DIRECTIONS.expense).chip}>
                            {t((CONTRACT_DIRECTIONS[row.direction] || CONTRACT_DIRECTIONS.expense).labelKey)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="font-semibold">{formatCurrency(row.effective_amount)}</div>
                          {row.paid_total > 0 && (
                            <div className="text-xs text-slate-500">
                              {t('paid_short')}: {formatCurrency(row.paid_total)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{expiryCell(row)}</TableCell>
                        <TableCell className="max-w-[160px]"><span className="line-clamp-1">{row.responsible_employee_name || '—'}</span></TableCell>
                        <TableCell>{statusChip(row.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {meta && meta.total_pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-slate-500">
                  {t('total')}: {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!meta.has_prev} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-slate-600">{meta.page} / {meta.total_pages}</span>
                  <Button size="sm" variant="outline" disabled={!meta.has_next} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) { setShowCreateModal(false); setPendingDealLink(null); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('create_contract')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">

              {/* AI prefill */}
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-indigo-900">{t('ai_fill_from_document')}</p>
                  <p className="text-xs text-indigo-600 truncate">
                    {aiFile ? aiFile.file_name : t('ai_fill_hint')}
                  </p>
                </div>
                <input ref={aiInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleAiExtract} />
                <Button size="sm" variant="outline" disabled={aiExtracting} onClick={() => aiInputRef.current?.click()}>
                  {aiExtracting ? t('ai_extracting') : t('upload_document')}
                </Button>
              </div>
              {aiFields && (
                <p className="text-xs text-slate-500">
                  {t('ai_review_hint')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">{t('contract_number_label')}</Label>
                  <Input
                    value={form.contract_number}
                    placeholder="CNT-2026-0001"
                    onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">{t('direction')} *</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">{t('direction_income')}</SelectItem>
                      <SelectItem value="expense">{t('direction_expense')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-1 block">{t('contract_name')} *</Label>
                <Input
                  placeholder={t('contract_name_placeholder')}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1 block">{t('counterparty')} *</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('select_party')} /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name || c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1 block">{t('start_date')} *</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1 block">{t('end_date')}</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">{t('open_ended_hint')}</p>
                </div>
                <div>
                  <Label className="mb-1 block">{t('signed_date')}</Label>
                  <Input type="date" value={form.signed_date} onChange={(e) => setForm({ ...form, signed_date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">{t('contract_value')}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={formatPriceInput(form.value)}
                    onChange={(e) => setForm({ ...form, value: parsePriceInput(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">{t('currency')}</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['UZS', 'USD', 'EUR', 'RUB'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-1 block">{t('responsible')}</Label>
                <Select value={form.responsible_employee_id} onValueChange={(v) => setForm({ ...form, responsible_employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('select_employee')} /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">{t('description')}</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={!form.title || !form.vendor_id || !form.start_date || isSubmitting}
                >
                  {isSubmitting ? t('creating') : t('create_contract')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
