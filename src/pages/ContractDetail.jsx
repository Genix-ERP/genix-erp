import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, FileText, Upload, Download, Trash2, Plus, Pencil,
  Sparkles, Link2, ListTodo, History, ChevronDown,
  Archive, ArchiveRestore, FilePlus2, CircleDollarSign,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useTranslation } from '@/components/utils/translations';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import contractsService from '@/api/services/contracts';
import taskBoardsService from '@/api/services/taskBoards';
import { contactsService, salesService, financeService, procurementService } from '@/api/services';
import { opportunitiesService } from '@/api/services/crm';
import constructionService from '@/api/services/construction';
import { Employee } from '@/api/entities';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { CONTRACT_STATUSES, CONTRACT_DIRECTIONS, CONTRACT_TYPES, LINK_MODULES } from '@/components/contracts/constants';

export default function ContractDetail() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { canUpdate, canDelete, canRead, MODULES } = usePermissions();
  const { formatCurrency } = useCurrencyFormatter();

  const [contract, setContract] = useState(null);
  const [files, setFiles] = useState([]);
  const [amendments, setAmendments] = useState([]);
  const [invoicesData, setInvoicesData] = useState(null);
  const [links, setLinks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [contacts, setContacts] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Inline edit
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dialogs
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [summaryDialog, setSummaryDialog] = useState(null); // {fileName, summary, loading}
  const [amendmentDialog, setAmendmentDialog] = useState(false);
  const [amendmentForm, setAmendmentForm] = useState({ number: '', date: '', amount_delta: '', description: '', file: null });
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ module: 'crm_deal', linked_id: '' });
  const [linkOptions, setLinkOptions] = useState([]);
  const [linkOptionsLoading, setLinkOptionsLoading] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ board_id: '', title: '', due_date: '' });
  const [boards, setBoards] = useState([]);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [invoiceOptions, setInvoiceOptions] = useState([]);
  const [invoiceToAttach, setInvoiceToAttach] = useState('');
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  const fmtDate = (d) => formatDate(d) || '—';

  // Financial rollups are visible only to roles that can read Moliyaviy
  // ma'lumotlar (finance module).
  const canSeeFinancials = canRead(MODULES.FINANCIALS ?? 'finance');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const c = await contractsService.get(contractId);
      setContract(c);
      const [f, a, inv, l, tk, act] = await Promise.all([
        contractsService.listFiles(contractId).catch(() => []),
        contractsService.listAmendments(contractId).catch(() => []),
        canSeeFinancials ? contractsService.listInvoices(contractId).catch(() => null) : Promise.resolve(null),
        contractsService.listLinks(contractId).catch(() => []),
        contractsService.listTasks(contractId).catch(() => []),
        contractsService.listActivity(contractId).catch(() => []),
      ]);
      setFiles(f);
      setAmendments(a);
      setInvoicesData(inv);
      setLinks(l);
      setTasks(tk);
      setActivity(act);
    } catch (e) {
      if (e?.response?.status === 404) setNotFound(true);
      else {
        console.error('Failed to load contract:', e);
        toast.error(t('loading_error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [contractId, canSeeFinancials]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    contactsService.list().then((d) => setContacts(Array.isArray(d) ? d : [])).catch(() => {});
    Employee.list().then((d) => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const statusCfg = CONTRACT_STATUSES[contract?.status] || CONTRACT_STATUSES.draft;
  const dirCfg = CONTRACT_DIRECTIONS[contract?.direction] || CONTRACT_DIRECTIONS.expense;

  // ── Status transitions ──
  const doTransition = async (target) => {
    if (target === 'cancelled') {
      setConfirmCancel(true);
      return;
    }
    try {
      const updated = await contractsService.changeStatus(contractId, target);
      setContract(updated);
      toast.success(t('status_updated'));
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error?.message || t('status_update_failed'));
    }
  };

  const confirmCancelContract = async () => {
    try {
      const updated = await contractsService.changeStatus(contractId, 'cancelled');
      setContract(updated);
      toast.success(t('status_updated'));
    } catch {
      toast.error(t('status_update_failed'));
    } finally {
      setConfirmCancel(false);
    }
  };

  // ── Inline edit ──
  const startEdit = () => {
    setEditForm({
      contract_number: contract.contract_number || '',
      title: contract.title || '',
      vendor_id: contract.vendor_id || '',
      direction: contract.direction || 'expense',
      contract_type: contract.contract_type || 'fixed',
      start_date: contract.start_date?.split('T')[0] || '',
      end_date: contract.end_date?.split('T')[0] || '',
      signed_date: contract.signed_date?.split('T')[0] || '',
      value: contract.value ?? '',
      currency: contract.currency || 'UZS',
      responsible_employee_id: contract.responsible_employee_id || '',
      description: contract.description || '',
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const updated = await contractsService.update(contractId, {
        contract_number: editForm.contract_number,
        title: editForm.title,
        vendor_id: editForm.vendor_id || undefined,
        direction: editForm.direction,
        contract_type: editForm.contract_type,
        start_date: editForm.start_date,
        end_date: editForm.end_date, // "" clears → muddatsiz
        signed_date: editForm.signed_date,
        value: parseFloat(editForm.value) || 0,
        currency: editForm.currency,
        responsible_employee_id: editForm.responsible_employee_id,
        description: editForm.description,
      });
      setContract(updated);
      setEditMode(false);
      toast.success(t('changes_saved'));
      contractsService.listActivity(contractId).then(setActivity).catch(() => {});
    } catch (e) {
      console.error(e);
      const msg = e?.response?.status === 409 ? t('contract_number_taken') : t('save_failed');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Files ──
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFile(true);
    try {
      await contractsService.uploadFile(contractId, file);
      setFiles(await contractsService.listFiles(contractId));
      toast.success(t('file_uploaded'));
    } catch (err) {
      console.error(err);
      toast.error(t('upload_failed'));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownload = async (f) => {
    try {
      const blob = await contractsService.downloadFile(contractId, f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('download_failed'));
    }
  };

  const handleSummarize = async (f) => {
    setSummaryDialog({ fileName: f.original_name, summary: null, loading: true });
    try {
      const res = await contractsService.summarizeFile(contractId, f.id);
      setSummaryDialog({ fileName: f.original_name, summary: res.summary, loading: false });
      if (!f.has_ai_summary) setFiles(await contractsService.listFiles(contractId));
    } catch (e) {
      const code = e?.response?.data?.error?.code;
      setSummaryDialog({
        fileName: f.original_name,
        summary: null,
        loading: false,
        error: code === 'AI_NOT_CONFIGURED' ? t('ai_not_configured') : t('ai_summary_failed'),
      });
    }
  };

  const handleDeleteFile = async (f) => {
    try {
      await contractsService.deleteFile(contractId, f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      toast.success(t('file_deleted'));
    } catch {
      toast.error(t('delete_failed'));
    }
  };

  // ── Amendments ──
  const submitAmendment = async () => {
    if (!amendmentForm.number || !amendmentForm.date) return;
    setDialogSubmitting(true);
    try {
      await contractsService.createAmendment(contractId, amendmentForm);
      setAmendmentDialog(false);
      setAmendmentForm({ number: '', date: '', amount_delta: '', description: '', file: null });
      const [a, c] = await Promise.all([
        contractsService.listAmendments(contractId),
        contractsService.get(contractId),
      ]);
      setAmendments(a);
      setContract(c);
      toast.success(t('amendment_added'));
    } catch (e) {
      const msg = e?.response?.status === 409 ? t('amendment_number_taken') : t('save_failed');
      toast.error(msg);
    } finally {
      setDialogSubmitting(false);
    }
  };

  const deleteAmendment = async (a) => {
    try {
      await contractsService.deleteAmendment(contractId, a.id);
      const [list, c] = await Promise.all([
        contractsService.listAmendments(contractId),
        contractsService.get(contractId),
      ]);
      setAmendments(list);
      setContract(c);
    } catch {
      toast.error(t('delete_failed'));
    }
  };

  // ── Links ──
  const loadLinkOptions = async (module) => {
    setLinkOptionsLoading(true);
    setLinkOptions([]);
    try {
      let opts = [];
      if (module === 'crm_deal') {
        const deals = await opportunitiesService.list();
        opts = (deals || []).map((d) => ({ id: d.id, label: d.name }));
      } else if (module === 'construction_object') {
        const projects = await constructionService.listProjects();
        const arr = Array.isArray(projects) ? projects : projects?.projects || [];
        opts = arr.map((p) => ({ id: p.id, label: p.name || p.project_name || p.code }));
      } else if (module === 'sale_order') {
        const res = await salesService.listOrders({ limit: 100 });
        const arr = Array.isArray(res) ? res : res?.data || [];
        opts = arr.map((o) => ({ id: o.id, label: o.order_number }));
      } else if (module === 'purchase_order') {
        const res = await procurementService.listOrders({ limit: 100 });
        const arr = Array.isArray(res) ? res : res?.data || res?.orders || [];
        opts = arr.map((o) => ({ id: o.id, label: o.order_number }));
      }
      setLinkOptions(opts.filter((o) => o.id && o.label));
    } catch (e) {
      console.error('Failed to load link options:', e);
    } finally {
      setLinkOptionsLoading(false);
    }
  };

  const submitLink = async () => {
    if (!linkForm.linked_id) return;
    setDialogSubmitting(true);
    try {
      await contractsService.createLink(contractId, linkForm.module, linkForm.linked_id);
      setLinks(await contractsService.listLinks(contractId));
      setLinkDialog(false);
      setLinkForm({ module: 'crm_deal', linked_id: '' });
      toast.success(t('link_added'));
    } catch (e) {
      const msg = e?.response?.status === 409 ? t('already_linked') : t('save_failed');
      toast.error(msg);
    } finally {
      setDialogSubmitting(false);
    }
  };

  const removeLink = async (l) => {
    try {
      await contractsService.deleteLink(contractId, l.id);
      setLinks((prev) => prev.filter((x) => x.id !== l.id));
    } catch {
      toast.error(t('delete_failed'));
    }
  };

  // ── Tasks ──
  const openTaskDialog = async () => {
    setTaskDialog(true);
    if (boards.length === 0) {
      try {
        const b = await taskBoardsService.listBoards();
        setBoards(Array.isArray(b) ? b : []);
      } catch (e) { console.error(e); }
    }
  };

  const submitTask = async () => {
    if (!taskForm.board_id || !taskForm.title) return;
    setDialogSubmitting(true);
    try {
      const created = await taskBoardsService.createTask(taskForm.board_id, {
        title: taskForm.title,
        due_date: taskForm.due_date || undefined,
      });
      const taskId = created?.id || created?.task?.id;
      if (taskId) {
        await taskBoardsService.addTaskLink(taskForm.board_id, taskId, 'contract', contractId);
      }
      setTasks(await contractsService.listTasks(contractId));
      setTaskDialog(false);
      setTaskForm({ board_id: '', title: '', due_date: '' });
      toast.success(t('task_created'));
    } catch (e) {
      console.error(e);
      toast.error(t('save_failed'));
    } finally {
      setDialogSubmitting(false);
    }
  };

  // ── Attach invoice ──
  const openInvoiceDialog = async () => {
    setInvoiceDialog(true);
    setInvoiceOptions([]);
    setInvoiceToAttach('');
    try {
      let arr = [];
      if (contract.direction === 'income') {
        const res = await salesService.listInvoices({ limit: 100 });
        arr = (Array.isArray(res) ? res : res?.data || []).map((i) => ({
          id: i.id, label: `${i.invoice_number} — ${formatCurrency(i.total_amount || 0)}`, linked: !!i.contract_id,
        }));
      } else {
        const res = await financeService.listPurchaseInvoices({ limit: 100 });
        const list = res?.data || res || [];
        arr = (Array.isArray(list) ? list : []).map((i) => ({
          id: i.id, label: `${i.invoice_number} — ${formatCurrency(i.total_amount || 0)}`, linked: !!i.contract_id,
        }));
      }
      setInvoiceOptions(arr.filter((i) => !i.linked));
    } catch (e) {
      console.error('Failed to load invoices:', e);
    }
  };

  const submitInvoiceAttach = async () => {
    if (!invoiceToAttach) return;
    setDialogSubmitting(true);
    try {
      const kind = contract.direction === 'income' ? 'sales' : 'purchase';
      await contractsService.attachInvoice(contractId, invoiceToAttach, kind);
      setInvoicesData(await contractsService.listInvoices(contractId));
      setInvoiceDialog(false);
      toast.success(t('invoice_attached'));
    } catch {
      toast.error(t('save_failed'));
    } finally {
      setDialogSubmitting(false);
    }
  };

  // ── Rendering ──
  if (notFound) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-4">{t('contract_not_found')}</p>
        <Button variant="outline" onClick={() => navigate('/contracts')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('back_to_contracts')}
        </Button>
      </div>
    );
  }

  if (isLoading || !contract) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const activityLabel = (a) => {
    const key = `activity_${a.action}`;
    const label = t(key);
    return label === key ? a.action : label;
  };

  const infoRow = (label, value) => (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value || '—'}</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm text-slate-500">{contract.contract_number}</span>
              <Badge variant="outline" className={statusCfg.chip}>{t(statusCfg.labelKey)}</Badge>
              <Badge variant="outline" className={dirCfg.chip}>{t(dirCfg.labelKey)}</Badge>
              {contract.archived_at && (
                <Badge variant="outline" className="bg-slate-100 text-slate-500">{t('archived')}</Badge>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{contract.title}</h1>
          </div>

          {canUpdate(MODULES.CONTRACTS) && contract.allowed_transitions?.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {t('change_status')} <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {contract.allowed_transitions.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => doTransition(s)}>
                    <Badge variant="outline" className={`${(CONTRACT_STATUSES[s] || {}).chip} mr-2`}>
                      {t((CONTRACT_STATUSES[s] || {}).labelKey || s)}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canDelete(MODULES.CONTRACTS) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><ChevronDown className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {contract.archived_at ? (
                  <DropdownMenuItem onClick={async () => { setContract(await contractsService.unarchive(contractId)); }}>
                    <ArchiveRestore className="w-4 h-4 mr-2" /> {t('unarchive')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={async () => { setContract(await contractsService.archive(contractId)); }}>
                    <Archive className="w-4 h-4 mr-2" /> {t('archive')}
                  </DropdownMenuItem>
                )}
                {['draft', 'cancelled'].includes(contract.status) && (
                  <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="w-4 h-4 mr-2" /> {t('delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Asosiy ma'lumotlar */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                <CardTitle className="text-base">{t('main_info')}</CardTitle>
                {canUpdate(MODULES.CONTRACTS) && !editMode && (
                  <Button size="sm" variant="ghost" onClick={startEdit}>
                    <Pencil className="w-4 h-4 mr-1.5" /> {t('edit')}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {!editMode ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {infoRow(t('counterparty'), contract.vendor_name)}
                    {infoRow(t('contract_value'), `${formatCurrency(contract.value)} ${contract.currency !== 'UZS' ? contract.currency : ''}`)}
                    {infoRow(t('effective_amount'), formatCurrency(contract.effective_amount))}
                    {infoRow(t('start_date'), fmtDate(contract.start_date))}
                    {infoRow(t('end_date'), contract.end_date ? fmtDate(contract.end_date) : t('contract_open_ended'))}
                    {infoRow(t('signed_date'), fmtDate(contract.signed_date))}
                    {infoRow(t('responsible'), contract.responsible_employee_name)}
                    {infoRow(t('contract_type'), t(contract.contract_type) !== contract.contract_type ? t(contract.contract_type) : contract.contract_type)}
                    {contract.days_to_expiry != null && contract.status === 'active' && (
                      infoRow(t('days_until_expiry'), `${contract.days_to_expiry} ${t('days')}`)
                    )}
                    {contract.description && (
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-xs text-slate-500">{t('description')}</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{contract.description}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-1 block">{t('contract_number_label')}</Label>
                        <Input value={editForm.contract_number} onChange={(e) => setEditForm({ ...editForm, contract_number: e.target.value })} />
                      </div>
                      <div>
                        <Label className="mb-1 block">{t('direction')}</Label>
                        <Select value={editForm.direction} onValueChange={(v) => setEditForm({ ...editForm, direction: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">{t('direction_income')}</SelectItem>
                            <SelectItem value="expense">{t('direction_expense')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block">{t('contract_name')}</Label>
                      <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1 block">{t('counterparty')}</Label>
                      <Select value={editForm.vendor_id} onValueChange={(v) => setEditForm({ ...editForm, vendor_id: v })}>
                        <SelectTrigger><SelectValue placeholder={contract.vendor_name} /></SelectTrigger>
                        <SelectContent>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.company_name || c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="mb-1 block">{t('start_date')}</Label>
                        <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                      </div>
                      <div>
                        <Label className="mb-1 block">{t('end_date')}</Label>
                        <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
                      </div>
                      <div>
                        <Label className="mb-1 block">{t('signed_date')}</Label>
                        <Input type="date" value={editForm.signed_date} onChange={(e) => setEditForm({ ...editForm, signed_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="mb-1 block">{t('contract_value')}</Label>
                        <Input
                          type="text" inputMode="decimal"
                          value={formatPriceInput(editForm.value)}
                          onChange={(e) => setEditForm({ ...editForm, value: parsePriceInput(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block">{t('currency')}</Label>
                        <Select value={editForm.currency} onValueChange={(v) => setEditForm({ ...editForm, currency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['UZS', 'USD', 'EUR', 'RUB'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1 block">{t('contract_type')}</Label>
                        <Select value={editForm.contract_type} onValueChange={(v) => setEditForm({ ...editForm, contract_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONTRACT_TYPES.map((ct) => (
                              <SelectItem key={ct} value={ct}>{t(ct) !== ct ? t(ct) : ct}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block">{t('responsible')}</Label>
                      <Select value={editForm.responsible_employee_id} onValueChange={(v) => setEditForm({ ...editForm, responsible_employee_id: v })}>
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
                      <Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>{t('cancel')}</Button>
                      <Button className="flex-1" disabled={isSaving} onClick={saveEdit}>
                        {isSaving ? t('saving') : t('save_changes')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* To'lovlar */}
            {canSeeFinancials && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-slate-400" /> {t('payments_section')}
                  </CardTitle>
                  {canUpdate(MODULES.CONTRACTS) && (
                    <Button size="sm" variant="outline" onClick={openInvoiceDialog}>
                      <Plus className="w-4 h-4 mr-1.5" /> {t('attach_invoice')}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">{t('effective_amount')}</p>
                      <p className="font-bold text-slate-900">{formatCurrency(invoicesData?.effective_amount ?? contract.effective_amount)}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-xs text-green-700">{t('paid_total')}</p>
                      <p className="font-bold text-green-700">{formatCurrency(invoicesData?.paid_total ?? contract.paid_total)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-xs text-amber-700">{t('outstanding')}</p>
                      <p className="font-bold text-amber-700">{formatCurrency(invoicesData?.outstanding ?? contract.outstanding)}</p>
                    </div>
                  </div>

                  {(invoicesData?.invoices?.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">{t('no_linked_invoices')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('invoice_number')}</TableHead>
                            <TableHead>{t('date')}</TableHead>
                            <TableHead className="text-right">{t('amount')}</TableHead>
                            <TableHead className="text-right">{t('paid_short')}</TableHead>
                            <TableHead>{t('status')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoicesData.invoices.map((inv) => (
                            <TableRow key={`${inv.kind}-${inv.id}`}>
                              <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                              <TableCell>{fmtDate(inv.invoice_date)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(inv.total_amount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(inv.amount_paid)}</TableCell>
                              <TableCell><Badge variant="outline">{t(inv.status) !== inv.status ? t(inv.status) : inv.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fayllar */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" /> {t('files_section')}
                </CardTitle>
                {canUpdate(MODULES.CONTRACTS) && (
                  <>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
                    <Button size="sm" variant="outline" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1.5" />
                      {uploadingFile ? t('uploading') : t('upload_new_version')}
                    </Button>
                  </>
                )}
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {files.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">{t('no_documents')}</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                        <Badge variant="outline" className="font-mono shrink-0">v{f.version}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.original_name}</p>
                          <p className="text-xs text-slate-400">
                            {(f.file_size / 1024).toFixed(0)} KB · {fmtDate(f.uploaded_at)}
                          </p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title={t('ai_summary')} onClick={() => handleSummarize(f)}>
                          <Sparkles className={`w-4 h-4 ${f.has_ai_summary ? 'text-indigo-500' : 'text-slate-400'}`} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title={t('download')} onClick={() => handleDownload(f)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        {canDelete(MODULES.CONTRACTS) && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteFile(f)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ilovalar / qo'shimcha kelishuvlar */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FilePlus2 className="w-4 h-4 text-slate-400" /> {t('amendments_section')}
                </CardTitle>
                {canUpdate(MODULES.CONTRACTS) && (
                  <Button size="sm" variant="outline" onClick={() => setAmendmentDialog(true)}>
                    <Plus className="w-4 h-4 mr-1.5" /> {t('add_amendment')}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {amendments.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">{t('no_amendments')}</p>
                ) : (
                  <div className="space-y-2">
                    {amendments.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.number} · {fmtDate(a.date)}</p>
                          {a.description && <p className="text-xs text-slate-500 truncate">{a.description}</p>}
                        </div>
                        {a.amount_delta != null && (
                          <span className={`text-sm font-semibold ${a.amount_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {a.amount_delta >= 0 ? '+' : ''}{formatCurrency(a.amount_delta)}
                          </span>
                        )}
                        {canUpdate(MODULES.CONTRACTS) && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => deleteAmendment(a)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 text-sm border-t mt-3">
                      <span className="text-slate-500">{t('effective_amount')}</span>
                      <span className="font-bold">{formatCurrency(contract.effective_amount)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Bog'langan yozuvlar */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-400" /> {t('linked_records')}
                </CardTitle>
                {canUpdate(MODULES.CONTRACTS) && (
                  <Button size="sm" variant="ghost" onClick={() => { setLinkDialog(true); loadLinkOptions(linkForm.module); }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4">
                {links.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">{t('no_linked_records')}</p>
                ) : (
                  <div className="space-y-2">
                    {links.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {t((LINK_MODULES.find((m) => m.value === l.linked_module) || {}).labelKey || l.linked_module)}
                        </Badge>
                        <span className="flex-1 truncate">{l.linked_title || l.linked_id}</span>
                        {canUpdate(MODULES.CONTRACTS) && (
                          <button className="text-slate-300 hover:text-red-500" onClick={() => removeLink(l)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vazifalar */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-slate-400" /> {t('tasks_section')}
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={openTaskDialog}>
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">{t('no_linked_tasks')}</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        className="w-full text-left rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50"
                        onClick={() => navigate(`/tasks/${task.board_id}`)}
                      >
                        <p className={`text-sm font-medium ${task.completed_at ? 'line-through text-slate-400' : ''}`}>{task.title}</p>
                        <p className="text-xs text-slate-400">
                          {task.board_name} · {task.column_name}
                          {task.due_date ? ` · ${fmtDate(task.due_date)}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Faoliyat tarixi */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" /> {t('activity_history')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">{t('no_activity')}</p>
                ) : (
                  <div className="space-y-3">
                    {activity.map((a) => (
                      <div key={a.id} className="text-sm border-l-2 border-slate-200 pl-3">
                        <p className="font-medium text-slate-800">{activityLabel(a)}</p>
                        <p className="text-xs text-slate-400">
                          {a.user_name || t('system')} · {formatDateTime(a.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Dialogs ── */}

        {/* AI summary */}
        <Dialog open={!!summaryDialog} onOpenChange={(o) => { if (!o) setSummaryDialog(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" /> {t('ai_summary')}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-slate-400 -mt-2">{summaryDialog?.fileName}</p>
            {summaryDialog?.loading ? (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">{t('ai_summarizing')}</p>
              </div>
            ) : summaryDialog?.error ? (
              <p className="text-sm text-red-600 py-4">{summaryDialog.error}</p>
            ) : (
              <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{summaryDialog?.summary}</div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add amendment */}
        <Dialog open={amendmentDialog} onOpenChange={setAmendmentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('add_amendment')}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">{t('amendment_number')} *</Label>
                  <Input placeholder={t('amendment_number_placeholder')} value={amendmentForm.number}
                    onChange={(e) => setAmendmentForm({ ...amendmentForm, number: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1 block">{t('date')} *</Label>
                  <Input type="date" value={amendmentForm.date}
                    onChange={(e) => setAmendmentForm({ ...amendmentForm, date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="mb-1 block">{t('amount_delta')}</Label>
                <Input type="text" inputMode="decimal" placeholder="+/-"
                  value={amendmentForm.amount_delta}
                  onChange={(e) => setAmendmentForm({ ...amendmentForm, amount_delta: e.target.value.replace(/[^\d.-]/g, '') })} />
                <p className="text-xs text-slate-400 mt-1">{t('amount_delta_hint')}</p>
              </div>
              <div>
                <Label className="mb-1 block">{t('description')}</Label>
                <Textarea rows={2} value={amendmentForm.description}
                  onChange={(e) => setAmendmentForm({ ...amendmentForm, description: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">{t('file')}</Label>
                <Input type="file" onChange={(e) => setAmendmentForm({ ...amendmentForm, file: e.target.files?.[0] || null })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAmendmentDialog(false)}>{t('cancel')}</Button>
              <Button disabled={!amendmentForm.number || !amendmentForm.date || dialogSubmitting} onClick={submitAmendment}>
                {dialogSubmitting ? t('saving') : t('add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add link */}
        <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('link_record')}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1 block">{t('module')}</Label>
                <Select value={linkForm.module} onValueChange={(v) => { setLinkForm({ module: v, linked_id: '' }); loadLinkOptions(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LINK_MODULES.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">{t('record')}</Label>
                <Select value={linkForm.linked_id} onValueChange={(v) => setLinkForm({ ...linkForm, linked_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={linkOptionsLoading ? t('loading') : t('select_record')} />
                  </SelectTrigger>
                  <SelectContent>
                    {linkOptions.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialog(false)}>{t('cancel')}</Button>
              <Button disabled={!linkForm.linked_id || dialogSubmitting} onClick={submitLink}>
                {dialogSubmitting ? t('saving') : t('add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create task */}
        <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('create_task_from_contract')}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1 block">{t('board')} *</Label>
                <Select value={taskForm.board_id} onValueChange={(v) => setTaskForm({ ...taskForm, board_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('select_board')} /></SelectTrigger>
                  <SelectContent>
                    {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">{t('task_title')} *</Label>
                <Input placeholder={t('task_title_placeholder')} value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">{t('due_date')}</Label>
                <Input type="date" value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskDialog(false)}>{t('cancel')}</Button>
              <Button disabled={!taskForm.board_id || !taskForm.title || dialogSubmitting} onClick={submitTask}>
                {dialogSubmitting ? t('saving') : t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Attach invoice */}
        <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('attach_invoice')}</DialogTitle></DialogHeader>
            <div className="py-2">
              <Label className="mb-1 block">{t('invoice')}</Label>
              <Select value={invoiceToAttach} onValueChange={setInvoiceToAttach}>
                <SelectTrigger><SelectValue placeholder={t('select_invoice')} /></SelectTrigger>
                <SelectContent>
                  {invoiceOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {invoiceOptions.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">{t('no_unlinked_invoices')}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvoiceDialog(false)}>{t('cancel')}</Button>
              <Button disabled={!invoiceToAttach || dialogSubmitting} onClick={submitInvoiceAttach}>
                {dialogSubmitting ? t('saving') : t('add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm cancel */}
        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('cancel_contract_title')}</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">{t('cancel_contract_confirm')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmCancel(false)}>{t('cancel')}</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmCancelContract}>
                {t('cstatus_cancelled')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm delete */}
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('delete_contract')}</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">{t('delete_contract_confirm_message')?.replace('{name}', contract.title)}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>{t('cancel')}</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  try {
                    await contractsService.remove(contractId);
                    toast.success(t('contract_deleted'));
                    navigate('/contracts');
                  } catch {
                    toast.error(t('delete_failed'));
                  }
                }}
              >
                {t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
