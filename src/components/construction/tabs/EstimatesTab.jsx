import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { constructionService } from '@/api/services/construction';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  MoreHorizontal,
  FileSpreadsheet,
  Edit,
  Layers,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  Package,
} from 'lucide-react';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { useEmployeePermissions } from '@/components/contexts/EmployeePermissionsContext';
import { useTranslation } from '@/components/utils/translations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { ImportExportButtons } from '@/components/shared';
import SmetaImportModal from '@/components/construction/SmetaImportModal';
import SmetaExportModal from '@/components/construction/SmetaExportModal';
import SmetaSummaryView from '@/components/construction/SmetaSummaryView';
import Loader from '@/components/ui/loader';
import SublineModal from '@/components/construction/SublineModal';
import EstimateLineEditModal from '@/components/construction/EstimateLineEditModal';
import { getApiErrorMessage } from '@/utils/apiError';

const EstimatesTab = ({ project, wbsItems = [], buildings = [], scope, subcontracts = [] }) => {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  // Permission gating — backend already enforces construction.estimate.delete
  // via h.perm.Require() middleware (handler.go:2105), but we hide the UI
  // affordance for users without the right so they don't click and hit a
  // 403 toast. Admins / owners / site admins return true via the hook.
  const { canDelete } = useEmployeePermissions();
  const canDeleteEstimate = canDelete('construction');
  const { formatCurrency } = useCurrencyFormatter();

  const [estimates, setEstimates] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null); // building object or 'project' for unassigned
  const [expandedEstimate, setExpandedEstimate] = useState(null); // estimate id
  const [estimateLines, setEstimateLines] = useState({}); // { [estimateId]: lines[] }
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(null); // estimate id being loaded
  const [products, setProducts] = useState([]);
  // Client-side "projected" cost per estimate. Populated when the user
  // selects a building: we join the ВОР Miqdor (by parent-work name) with
  // each non-ВОР estimate's unit_rate × norm_rate to get a meaningful
  // total even when the Единич was imported in template mode (every
  // quantity = 0 → DB-side amount_total = 0). Backend persisted total
  // wins when it's already > 0 — this map only fills in the holes.
  // Shape: { [estimateId]: number }
  const [projectedAmounts, setProjectedAmounts] = useState({});

  // Modals
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showEditEstimateModal, setShowEditEstimateModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);

  // Sub-line modals (migration 332). `sublineParent` is the parent row when
  // adding a new sub-line; `lineToEdit` is the row being edited in the full
  // edit modal (can be parent or sub-line).
  const [sublineDialog, setSublineDialog] = useState({ open: false, parent: null, estimateId: null, nextSeq: 1, initial: null });
  const [editLineDialog, setEditLineDialog] = useState({ open: false, line: null, parent: null, estimateId: null });

  // Forms
  const [estimateForm, setEstimateForm] = useState({
    name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '', source_type: 'vor'
  });
  const [editEstimateForm, setEditEstimateForm] = useState({
    id: null, name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12', source_type: 'vor'
  });
  const [lineForm, setLineForm] = useState({
    id: null, estimate_id: null, product_id: '', name: '', uom: '', quantity: '',
    material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0'
  });
  const [addLines, setAddLines] = useState([{ product_id: '', quantity: '' }]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'default' });

  // Source type filter for estimates list
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Infinite-scroll window for the expanded estimate's line table. The
  // table is a hierarchy (parent line + its sub-lines/resources), and a
  // single estimate can carry thousands of rows (3611+ on real data), so
  // we only paint the first N ROOT (parent) lines and reveal more as the
  // user scrolls. Counting roots — never resources — means a parent always
  // renders together with all of its children; nothing gets split.
  const LINES_PER_PAGE = 20;
  const [visibleLineCount, setVisibleLineCount] = useState(LINES_PER_PAGE);
  const lineLoadMoreRef = React.useRef(null);

  // Import/Export
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // importColumns removed - SmetaImportModal handles parsing directly

  const handleImport = async ({ estimateName, buildingId, lines, sourceType, sectionNames, subcontractId, sourceFileName, budgetTotal, materialBudget, transportBudget }) => {
    try {
      // Find existing draft estimate with same name for this building, or create new
      let est = estimates.find(e =>
        e.name === estimateName &&
        e.state === 'draft' &&
        (buildingId === 0 ? !e.building_id : e.building_id === buildingId)
      );
      let estId;
      let isExisting = false;
      if (est) {
        estId = est.id;
        isExisting = true;
      } else {
        const createData = {
          name: estimateName,
          building_id: buildingId,
          overhead_pct: 0,
          profit_pct: 0,
          vat_pct: 12,
          source_type: sourceType || '',
        };
        if (subcontractId) createData.subcontract_id = subcontractId;
        const created = await constructionService.createEstimate(project.id, createData);
        estId = created.id;
      }

      // Bulk create all lines (replace existing if re-importing to same estimate).
      // `sourceFileName` lets the backend dedupe auto-created Forma 2 drafts —
      // multiple estimate types extracted from the same uploaded Excel file
      // will merge into one Forma 2 instead of producing one per type.
      const bulkResult = await constructionService.bulkCreateEstimateLines(estId, lines, {
        replace: isExisting,
        sourceType: sourceType || '',
        sourceFileName: sourceFileName || '',
        // Imported-budget capture (Ресурс sheet only — other types pass
        // 0 and the backend leaves the existing values alone). See
        // SmetaImportModal.parseResurs for the source rows.
        budgetTotal: Number(budgetTotal || 0),
        materialBudget: Number(materialBudget || 0),
        transportBudget: Number(transportBudget || 0),
      });

      // Show toast if products were auto-created from resource lines.
      // For Ресурс imports we ALWAYS announce the result (even when 0 new
      // products were added) because the most common confusion is "I
      // imported a resurs file but nothing showed up in inventory" — 0
      // here usually means the same-named products already exist.
      if (bulkResult?.products_created > 0) {
        toast.success(
          `${bulkResult.products_created} ${t('products_auto_created') || "ta mahsulot avtomatik yaratildi"}`,
          { description: t('products_auto_created_desc') || "Mahsulotlar bo'limida ko'rishingiz mumkin" }
        );
      } else if (sourceType === 'resurs') {
        toast.message(
          t('products_auto_create_zero') || "Yangi mahsulot qo'shilmadi",
          { description: t('products_auto_create_zero_desc') ||
            "Smetadagi materiallar Mahsulotlar ro'yxatida allaqachon mavjud bo'lishi mumkin." }
        );
      }

      // Show toast if Forma 2 was auto-created from VOR/Edinich estimate
      if (bulkResult?.forma2_created) {
        toast.success(t('forma2_auto_created') || "Forma 2 avtomatik yaratildi", {
          description: t('forma2_auto_created_desc') || "Smetadan barcha qatorlar bilan qoralama Forma 2 yaratildi",
        });
      }

      // Auto-create construction stages — ONLY for `edinich` imports.
      // ВОР sections are just block names ("Блок №1") and Ресурс sections
      // are resource-type buckets ("ТРУДОВЫЕ РЕСУРСЫ", "МАТЕРИАЛЬНЫЕ
      // РЕСУРСЫ", …) — neither maps to a real construction stage, and
      // both used to clutter the Bosqichlar tab with bogus stage rows.
      // Only the единич estimate carries genuine work-category headers
      // that should drive stages, so the auto-create is now scoped to it.
      //
      // Dedupe by (building_id, upper-cased name) so re-importing the
      // same единич file doesn't create duplicate stages, and so the same
      // section name in a different block is still allowed to produce
      // its own stage.
      if (sourceType === 'edinich' && sectionNames?.length > 0) {
        // Scope the existence check to this building — migration 333 made
        // stages building-aware, so "Блок №1" in building A and "Блок №1"
        // in building B are legitimately separate stages.
        let existingStages = [];
        try {
          existingStages = await constructionService.listStages(
            project.id,
            buildingId > 0 ? { buildingId } : undefined,
          );
        } catch (e) {
          // ignore — we'll attempt to create all stages
        }
        const existingNames = new Set(
          (existingStages || [])
            .filter(s => (buildingId > 0 ? Number(s.building_id) === Number(buildingId) : !s.building_id))
            .map(s => (s.name || '').toUpperCase())
        );

        for (let i = 0; i < sectionNames.length; i++) {
          const name = sectionNames[i];
          if (!name) continue;
          const key = name.toUpperCase();
          if (existingNames.has(key)) continue;
          try {
            await constructionService.createStage(project.id, {
              name,
              status: 'not_started',
              planned_budget: 0,
              // 0 = project-wide (backend maps to NULL via nullInt64FromVal).
              building_id: buildingId > 0 ? Number(buildingId) : 0,
            });
            // Remember in the local dedupe set so duplicate section names
            // within a single import (rare but possible) don't insert twice.
            existingNames.add(key);
          } catch (e) {
            console.error('Failed to create stage:', name, e);
          
            toast.error(getApiErrorMessage(e, 'Amalni bajarib bo\'lmadi'));
          }
        }
      }

      await loadEstimates();
    } catch (error) {
      console.error('Error importing estimates:', error);
      throw error;
    }
  };

  const [summaryKey, setSummaryKey] = useState(0);

  const handleImportSvod = async (rows) => {
    try {
      await constructionService.importEstimateSummary(project.id, rows);
      setSummaryKey((k) => k + 1);
    } catch (error) {
      console.error('Error importing svod:', error);
      throw error;
    }
  };

  const expandedLines = useMemo(
    () => (expandedEstimate ? (estimateLines[expandedEstimate] || []) : []),
    [expandedEstimate, estimateLines],
  );

  // Count of ROOT (parent) lines in the expanded estimate — mirrors the
  // root/sub-line classification the line table uses below. Drives the
  // infinite-scroll window (how many roots to paint) and the sentinel.
  const expandedRootCount = useMemo(() => {
    const itemNumToId = new Map();
    for (const ln of expandedLines) {
      if (!ln.parent_line_id && ln.item_number) itemNumToId.set(String(ln.item_number), ln.id);
    }
    let roots = 0;
    for (const ln of expandedLines) {
      if (ln.parent_line_id) continue;
      if (typeof ln.item_number === 'string') {
        const m = ln.item_number.match(/^(\d+)-(\d+)$/);
        if (m) {
          const resolved = itemNumToId.get(m[1]);
          if (resolved && resolved !== ln.id) continue; // it's a sub-line
        }
      }
      roots += 1;
    }
    return roots;
  }, [expandedLines]);

  // Reset the window each time a different estimate is expanded.
  useEffect(() => {
    setVisibleLineCount(LINES_PER_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEstimate]);

  // Grow the window as the sentinel below the table scrolls into view.
  useEffect(() => {
    const el = lineLoadMoreRef.current;
    if (!el) return undefined;
    if (visibleLineCount >= expandedRootCount) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleLineCount((n) => Math.min(n + LINES_PER_PAGE, expandedRootCount));
      }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedEstimate, expandedRootCount, visibleLineCount]);


  // Load estimates
  const loadEstimates = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      // Default (Smetalar) view loads BOTH in-house and subcontractor
      // estimates so subcontractor smetas appear here with their badge.
      const data = await constructionService.listEstimates(project.id, { scope: scope || 'all' });
      setEstimates(data || []);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoading(false);
    }
  }, [project?.id, scope]);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  // Auto-select first building
  useEffect(() => {
    if (!selectedBuilding && buildings.length > 0) {
      setSelectedBuilding(buildings[0]);
    }
  }, [buildings]);

  useEffect(() => {
    if (!project?.id) return;
    constructionService.listProjectMaterials(project.id)
      .then(data => setProducts(data || []))
      .catch(() => setProducts([]));
  }, [project?.id]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sourceTypeFilter]);

  // ── Projected totals per building ─────────────────────────────────
  // Triggered when the user selects a building (or the estimates list
  // changes). For every non-ВОР estimate whose backend amount_total is
  // 0, we fetch its lines and compute:
  //
  //   projected = Σ (vorQty(parent.name) × sub.norm_rate × sub.unit_rate)
  //
  // over every sub-line (parent_line_id != null) in the estimate. The
  // ВОР's Miqdor is keyed by lowercase-trimmed name, scoped to the
  // same building, so two blocks with identically-named works don't
  // contaminate each other. If the building has no ВОР, projection is
  // skipped (we honour the backend's 0 in that case).
  //
  // Estimates whose amount_total is already > 0 (e.g. Blok 1/2 imported
  // before template mode) are left alone — no extra fetch, no overlay.
  useEffect(() => {
    if (!selectedBuilding) return;
    let cancelled = false;
    const buildingId = selectedBuilding === 'project' ? 0 : selectedBuilding.id;
    const here = estimates.filter((e) =>
      buildingId === 0 ? !e.building_id : Number(e.building_id) === Number(buildingId)
    );
    if (here.length === 0) return;
    const vorEst = here.find((e) => String(e.source_type || '').toLowerCase() === 'vor');
    // Targets = estimates with a backend total of 0 that aren't ВОР
    // (ВОР itself naturally has 0 cost since it carries no prices, and
    // we don't want to overlay the source-of-truth there).
    const targets = here.filter((e) =>
      !(Number(e.amount_total || 0) > 0)
      && String(e.source_type || '').toLowerCase() !== 'vor',
    );
    if (!vorEst || targets.length === 0) {
      // Clear any stale projections from a previous building.
      setProjectedAmounts((prev) => {
        const next = { ...prev };
        for (const e of targets) delete next[e.id];
        return next;
      });
      return;
    }

    (async () => {
      try {
        // Fetch ВОР once, then every target estimate in parallel. Lines
        // are pulled with a high page_size since the cap on listEstimateLines
        // is 5000 and even the fattest blocks rarely cross that.
        const [vorRowsRaw, ...targetRowsRaw] = await Promise.all([
          constructionService.listEstimateLines(vorEst.id, { page_size: 5000 }),
          ...targets.map((e) =>
            constructionService.listEstimateLines(e.id, { page_size: 5000 })
              .catch(() => []),
          ),
        ]);
        if (cancelled) return;

        // ВОР map: parent-work name → planned project quantity. Only
        // top-level rows (no parent_line_id) carry a real Miqdor. The
        // key strips all whitespace so subtle Excel formatting
        // differences (e.g. "В7,5 / М-100/" vs "В7,5 /М-100/") between
        // the Единич and ВОР sheets don't break the match — a plain
        // trim+lowercase was missing real rows.
        const normKey = (s) => String(s || '').toLowerCase().replace(/[\s\u00A0]+/g, '');
        const vorList = Array.isArray(vorRowsRaw)
          ? vorRowsRaw
          : (vorRowsRaw?.data || vorRowsRaw?.items || []);
        const vorMap = new Map();
        for (const r of vorList) {
          if (r.parent_line_id) continue;
          const n = normKey(r.name);
          if (!n) continue;
          const q = Number(r.quantity || 0);
          if (q > 0) vorMap.set(n, q);
        }

        const updates = {};
        for (let i = 0; i < targets.length; i++) {
          const est = targets[i];
          const rowsRaw = targetRowsRaw[i];
          const lines = Array.isArray(rowsRaw)
            ? rowsRaw
            : (rowsRaw?.data || rowsRaw?.items || []);
          if (!lines.length) {
            updates[est.id] = 0;
            continue;
          }
          // Index parents by id so each sub-line can resolve its parent's name.
          const parentById = new Map();
          for (const l of lines) {
            if (!l.parent_line_id) parentById.set(Number(l.id), l);
          }
          let total = 0;
          for (const l of lines) {
            const pid = Number(l.parent_line_id || 0);
            if (!pid) continue; // skip parents (their cost is the sum of children)
            const parent = parentById.get(pid);
            if (!parent) continue;
            const vorQty = vorMap.get(normKey(parent.name)) || 0;
            if (vorQty <= 0) continue;
            const norm = Number(l.norm_rate || 0);
            const rate = Number(l.unit_rate || 0);
            total += vorQty * norm * rate;
          }
          updates[est.id] = total;
        }
        if (cancelled) return;
        setProjectedAmounts((prev) => ({ ...prev, ...updates }));
      } catch (e) {
        // Non-fatal — the smeta will keep showing the backend total
        // (likely 0) and the user can still navigate. Logging only
        // surfaces in the console for debugging.
        console.error('Failed to compute projected smeta totals:', e);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding, estimates]);

  // Helper: pick the cost a smeta card / building list should display.
  // Backend total wins when present; otherwise fall back to the ВОР
  // projection computed above.
  const displayAmount = useCallback((est) => {
    const persisted = Number(est?.amount_total || 0);
    if (persisted > 0) return persisted;
    const projected = projectedAmounts[est?.id];
    return Number.isFinite(projected) ? projected : 0;
  }, [projectedAmounts]);

  // Open/close cache (Smetalar tab) — keep a ref-backed set of estimate
  // ids whose lines have already been fetched in this session. The
  // existing `estimateLines[estId]` check covers the common case, but
  // the user reported that opening → closing → opening the same file
  // still triggered a network fetch. The ref makes the cache decision
  // independent of React's render cycle: even if a re-render somewhere
  // hands us a stale `estimateLines` reference, the ref tells us "this
  // id was already loaded — skip the round-trip." A successful mutation
  // path (Edit / Add subline / Delete) calls loadEstimateLines with
  // `{ force: true }` to drop and re-fetch.
  const linesLoadedRef = React.useRef(new Set());
  const linesInflightRef = React.useRef(new Map()); // estimateId → Promise — dedupes concurrent toggles
  const loadEstimateLines = async (estimateId, { force = false } = {}) => {
    if (!force) {
      if (linesLoadedRef.current.has(estimateId)) return; // already in estimateLines
      const existing = linesInflightRef.current.get(estimateId);
      if (existing) return existing;
    } else {
      linesLoadedRef.current.delete(estimateId);
    }
    setLinesLoading(estimateId);
    const promise = (async () => {
      try {
        // includeManual: false — hides lines added via the Smeta
        // boshqaruvi / Bosqichlar UI (migration 417). The Smetalar tab
        // is the read-only view of the file's original content; user
        // edits live on the editing tabs.
        const data = await constructionService.getEstimate(estimateId, { includeManual: false });
        setEstimateLines(prev => ({ ...prev, [estimateId]: data?.lines || [] }));
        linesLoadedRef.current.add(estimateId);
      } catch (error) {
        console.error('Error loading estimate lines:', error);
        setEstimateLines(prev => ({ ...prev, [estimateId]: [] }));
        // Don't add to loaded set on error — next toggle should retry.
      } finally {
        setLinesLoading(null);
        linesInflightRef.current.delete(estimateId);
      }
    })();
    linesInflightRef.current.set(estimateId, promise);
    return promise;
  };

  // Toggle estimate expansion
  const handleToggleEstimate = (estId) => {
    if (expandedEstimate === estId) {
      setExpandedEstimate(null);
    } else {
      setExpandedEstimate(estId);
      // Ref check first — handles the open/close/open replay where
      // estimateLines might be in transit, then a defensive
      // estimateLines fallback for cases where the ref was reset.
      if (!linesLoadedRef.current.has(estId) && !estimateLines[estId]) {
        loadEstimateLines(estId);
      }
    }
  };

  // Create estimate
  const handleCreateEstimate = async (e) => {
    e.preventDefault();
    try {
      const buildingId = estimateForm.building_id ? parseInt(estimateForm.building_id) : 0;
      const createData = {
        name: estimateForm.name,
        building_id: buildingId,
        overhead_pct: parseFloat(estimateForm.overhead_pct) || 0,
        profit_pct: parseFloat(estimateForm.profit_pct) || 0,
        vat_pct: parseFloat(estimateForm.vat_pct) || 0,
        source_type: estimateForm.source_type || '',
      };
      if (estimateForm.subcontract_id) {
        createData.subcontract_id = parseInt(estimateForm.subcontract_id);
      }
      await constructionService.createEstimate(project.id, createData);
      setShowEstimateModal(false);
      setEstimateForm({ name: '', building_id: '', overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '', source_type: 'vor' });
      await loadEstimates();
    } catch (error) {
      console.error('Error creating estimate:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  // Approve estimate
  const handleApprove = (est) => {
    setConfirmDialog({
      open: true,
      title: t('approve') || 'Tasdiqlash',
      description: t('confirm_approve_estimate') || "Smetani tasdiqlaysizmi? Oldingi smeta arxivlanadi.",
      variant: 'default',
      onConfirm: async () => {
        try {
          await constructionService.approveEstimate(est.id);
          await loadEstimates();
        } catch (error) {
          console.error('Error approving estimate:', error);
        
          toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
        }
      },
    });
  };

  // Duplicate estimate
  const handleDuplicate = async (est) => {
    try {
      await constructionService.duplicateEstimate(est.id);
      await loadEstimates();
    } catch (error) {
      console.error('Error duplicating estimate:', error);
    }
  };

  // Delete estimate
  const handleDeleteEstimate = (est) => {
    if (est.state !== 'draft') return;
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: t('confirm_delete') || "O'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await constructionService.deleteEstimate(est.id);
          if (expandedEstimate === est.id) {
            setExpandedEstimate(null);
          }
          await loadEstimates();
        } catch (error) {
          console.error('Error deleting estimate:', error);
        
          toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
        }
      },
    });
  };

  // Edit estimate (open modal pre-populated)
  const handleEditEstimate = (est) => {
    setEditEstimateForm({
      id: est.id,
      name: est.name || '',
      building_id: est.building_id ? String(est.building_id) : '',
      overhead_pct: String(est.overhead_pct || 0),
      profit_pct: String(est.profit_pct || 0),
      vat_pct: String(est.vat_pct || 0),
      source_type: est.source_type || 'vor',
    });
    setShowEditEstimateModal(true);
  };

  // Update estimate
  const handleUpdateEstimate = async (e) => {
    e.preventDefault();
    try {
      const buildingId = editEstimateForm.building_id ? parseInt(editEstimateForm.building_id) : 0;
      const data = {
        name: editEstimateForm.name,
        building_id: buildingId,
        overhead_pct: parseFloat(editEstimateForm.overhead_pct) || 0,
        profit_pct: parseFloat(editEstimateForm.profit_pct) || 0,
        vat_pct: parseFloat(editEstimateForm.vat_pct) || 0,
      };
      await constructionService.updateEstimate(editEstimateForm.id, data);
      setShowEditEstimateModal(false);
      await loadEstimates();
      // Reload lines if this estimate is expanded
      if (expandedEstimate === editEstimateForm.id) {
        await loadEstimateLines(editEstimateForm.id, { force: true });
      }
    } catch (error) {
      console.error('Error updating estimate:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  // Create/update line
  const handleSaveLine = async (e) => {
    e.preventDefault();
    const estId = lineForm.estimate_id;
    if (!estId) return;
    try {
      if (lineForm.id) {
        const data = {
          name: lineForm.name,
          uom: lineForm.uom || 'шт',
          quantity: parseFloat(lineForm.quantity) || 0,
          material_rate: parseFloat(parsePriceInput(lineForm.material_rate)) || 0,
          labor_rate: parseFloat(parsePriceInput(lineForm.labor_rate)) || 0,
          equipment_rate: parseFloat(parsePriceInput(lineForm.equipment_rate)) || 0,
          sort_order: parseInt(lineForm.sort_order) || 0,
        };
        await constructionService.updateEstimateLine(estId, lineForm.id, data);
      } else {
        const baseLaborRate = parseFloat(parsePriceInput(lineForm.labor_rate)) || 0;
        const baseEquipmentRate = parseFloat(parsePriceInput(lineForm.equipment_rate)) || 0;
        const currentLines = estimateLines[estId] || [];
        const baseSortOrder = currentLines.length;

        for (let i = 0; i < addLines.length; i++) {
          const row = addLines[i];
          if (!row.product_id) continue;
          const mat = products.find(p => String(p.product_id) === row.product_id);
          if (!mat) continue;
          const qty = parseFloat(row.quantity) || 0;
          if (qty <= 0) continue;
          await constructionService.createEstimateLine(estId, {
            name: mat.product_name,
            uom: mat.uom || 'шт',
            quantity: qty,
            material_rate: mat.unit_cost || 0,
            labor_rate: baseLaborRate,
            equipment_rate: baseEquipmentRate,
            sort_order: baseSortOrder + i,
          });
        }
      }

      await loadEstimateLines(estId, { force: true });
      await loadEstimates();
      setShowLineModal(false);
      setLineForm({ id: null, estimate_id: null, product_id: '', name: '', uom: '', quantity: '', material_rate: '', labor_rate: '', equipment_rate: '', sort_order: '0' });
      setAddLines([{ product_id: '', quantity: '' }]);
    } catch (error) {
      console.error('Error saving line:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
  };

  // Delete line
  const handleDeleteLine = (estId, lineId) => {
    setConfirmDialog({
      open: true,
      title: t('delete') || "O'chirish",
      description: t('confirm_delete') || "O'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.",
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await constructionService.deleteEstimateLine(estId, lineId);
          await loadEstimateLines(estId, { force: true });
          await loadEstimates();
        } catch (error) {
          console.error('Error deleting line:', error);
        
          toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
        }
      },
    });
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'archived': return 'bg-slate-100 text-slate-600';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStateLabel = (state) => {
    switch (state) {
      case 'approved': return t('approved') || 'Tasdiqlangan';
      case 'archived': return t('archived') || 'Arxivlangan';
      default: return t('draft') || 'Qoralama';
    }
  };

  // Get estimates for current building selection
  const getFilteredEstimates = () => {
    let filtered = [];
    if (selectedBuilding === 'project') {
      filtered = estimates.filter(e => !e.building_id);
    } else if (selectedBuilding?.id) {
      filtered = estimates.filter(e => e.building_id === selectedBuilding.id);
    }
    if (sourceTypeFilter !== 'all') {
      filtered = filtered.filter(e => (e.source_type || '') === sourceTypeFilter);
    }
    return filtered;
  };

  const filteredEstimates = getFilteredEstimates();

  // Build left sidebar items: buildings + "Butun loyiha" if there are unassigned estimates
  const unassignedCount = estimates.filter(e => !e.building_id).length;

  return (
    <div className="space-y-4">
      {/* Import/Export Header */}
      <div className="flex items-center justify-end">
        <ImportExportButtons
          onImport={() => setShowImportModal(true)}
          onExport={() => setShowExportModal(true)}
          importDisabled={false}
          exportDisabled={!selectedBuilding || filteredEstimates.length === 0}
        />
      </div>

      {/* Smaller fixed-width sidebar so the right-hand smeta table gets
         the lion's share of the row. Previously this was a 1:2 split
         (lg:grid-cols-3 + col-span-1/col-span-2) which gave the building
         list 33 % of the width even on wide monitors — that's far more
         than it needs (it just lists block names) and squeezed the
         smeta table into the remaining 66 %. Pinning the sidebar at
         240 px gives the table everything else. */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '240px 1fr' }}>
      {/* Left: Buildings List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('buildings_blocks') || 'Binolar / Bloklar'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {buildings.length === 0 && unassignedCount === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">{t('no_buildings') || "Binolar yo'q"}</p>
              </div>
            ) : (
              <div className="divide-y">
                {buildings.map((building) => {
                  const buildingEstimates = estimates.filter(e => e.building_id === building.id);
                  const totalAmount = buildingEstimates.reduce((sum, e) => sum + displayAmount(e), 0);
                  const isSelected = selectedBuilding?.id === building.id;
                  // Get unique subcontractor names for this building (subcontract mode)
                  // Show subcontractors linked to building via junction table + from estimates
                  const subNames = [...new Set([
                    ...subcontracts
                      .filter(sc => (sc.building_ids || []).includes(building.id))
                      .map(sc => sc.partner_name || sc.name),
                    ...buildingEstimates.map(e => e.subcontract_name).filter(Boolean),
                  ].filter(Boolean))];
                  return (
                    <div
                      key={building.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                      onClick={() => {
                        setSelectedBuilding(building);
                        setExpandedEstimate(null);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">
                          {building.name}
                        </span>
                      </div>
                      {subNames.length > 0 && (
                        <div className="ml-6 mt-0.5">
                          {subNames.map((name, i) => (
                            <span key={i} className="text-xs text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mr-1">{name}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1 ml-6">
                        <span className="text-xs text-slate-400">{buildingEstimates.length} {t('estimates_count') || 'smeta'}</span>
                        {totalAmount > 0 && (
                          <span className="text-xs font-medium text-slate-600">{formatCurrency(totalAmount)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* "Butun loyiha" for unassigned estimates */}
                {unassignedCount > 0 && (
                  <div
                    className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedBuilding === 'project' ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                    onClick={() => {
                      setSelectedBuilding('project');
                      setExpandedEstimate(null);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{t('entire_project') || "Butun loyiha"}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 ml-6">
                      <span className="text-xs text-slate-400">{unassignedCount} {t('estimates_count') || 'smeta'}</span>
                      <span className="text-xs font-medium text-slate-600">
                        {formatCurrency(estimates.filter(e => !e.building_id).reduce((s, e) => s + displayAmount(e), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right: Estimates with expandable lines. min-w-0 so the card
         can shrink below its natural content size, which lets the
         table inside use overflow-x-auto correctly instead of forcing
         the grid to grow beyond the viewport. */}
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {selectedBuilding === 'project'
              ? (t('entire_project') || "Butun loyiha")
              : selectedBuilding?.name
                ? selectedBuilding.name
                : (t('select_building_first') || "Avval bino tanlang")}
          </CardTitle>
          {selectedBuilding && (
            <Button size="sm" onClick={() => {
              setEstimateForm({
                name: '',
                building_id: selectedBuilding === 'project' ? '' : String(selectedBuilding.id),
                overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '',
                source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : 'vor'
              });
              setShowEstimateModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              {t('create_estimate') || "Smeta yaratish"}
            </Button>
          )}
        </CardHeader>
        {selectedBuilding && (
          <div className="flex items-center gap-1 px-6 pb-3 border-b">
            {[
              { key: 'all', label: t('all') || 'Barchasi' },
              { key: 'vor', label: 'ВОР' },
              { key: 'edinich', label: 'Единич' },
              { key: 'resurs', label: 'Ресурс' },
            ].map(tab => {
              const count = tab.key === 'all'
                ? (selectedBuilding === 'project' ? estimates.filter(e => !e.building_id) : estimates.filter(e => e.building_id === selectedBuilding?.id)).length
                : (selectedBuilding === 'project' ? estimates.filter(e => !e.building_id && e.source_type === tab.key) : estimates.filter(e => e.building_id === selectedBuilding?.id && e.source_type === tab.key)).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSourceTypeFilter(tab.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    sourceTypeFilter === tab.key
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab.label} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
        <CardContent className="p-0">
          {!selectedBuilding ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('select_building_first') || "Avval bino tanlang"}</p>
            </div>
          ) : loading ? (
            <Loader className="py-12" />
          ) : filteredEstimates.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('no_estimates') || "Smetalar yo'q"}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => {
                setEstimateForm({
                  name: '',
                  building_id: selectedBuilding === 'project' ? '' : String(selectedBuilding.id),
                  overhead_pct: '0', profit_pct: '0', vat_pct: '12', subcontract_id: '',
                  source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : 'vor'
                });
                setShowEstimateModal(true);
              }}>
                <Plus className="w-4 h-4 mr-1" />
                {t('create_estimate') || "Smeta yaratish"}
              </Button>
            </div>
          ) : (
            // Use a plain scrollable div instead of Radix <ScrollArea>: the
            // Radix viewport is `display: table`, which lets any descendant
            // with an intrinsic min-width (like the resurs table's
            // min-w-[1200px]) widen the viewport itself. That swallowed the
            // inner overflow-x-auto and made horizontal scrolling impossible.
            // A native block-level scroll container keeps the viewport
            // constrained so the table can overflow and scroll horizontally.
            <div className="h-[600px] overflow-y-auto">
              <div className="p-4 space-y-3">
                {(() => {
                  const totalCount = filteredEstimates.length;
                  const totalPages = Math.ceil(totalCount / pageSize);
                  const paginatedEstimates = filteredEstimates.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                  return paginatedEstimates.map((est) => {
                  const isExpanded = expandedEstimate === est.id;
                  const lines = estimateLines[est.id] || [];
                  const isLoadingLines = linesLoading === est.id;

                  return (
                    <div key={est.id} className={`border rounded-lg overflow-hidden ${isExpanded ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`}>
                      {/* Estimate card header */}
                      <div
                        className={`px-4 py-3 cursor-pointer group transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => handleToggleEstimate(est.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <Badge variant="outline" className="text-xs font-mono">v{est.version}</Badge>
                            <span className="font-medium">{est.name}</span>
                            {est.source_type && (() => {
                              const sourceLabels = {
                                vor: { uz: 'ВОР', ru: 'ВОР', color: 'bg-blue-100 text-blue-700' },
                                edinich: { uz: 'Единич', ru: 'Единич', color: 'bg-purple-100 text-purple-700' },
                                resurs: { uz: 'Ресурс', ru: 'Ресурс', color: 'bg-green-100 text-green-700' },
                              };
                              const info = sourceLabels[est.source_type];
                              if (!info) return null;
                              return <Badge className={`text-xs ${info.color}`}>{info[language] || info.ru}</Badge>;
                            })()}
                            {est.subcontract_name && <Badge className="bg-orange-100 text-orange-700 text-xs">{est.subcontract_name}</Badge>}
                            {est.is_current && <Badge className="bg-blue-500 text-white text-xs">{t('current') || 'Faol'}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* State badge ("Qoralama" / draft, etc.) removed
                               per product feedback — the source-type pills
                               (ВОР / Единич / Ресурс) on the left convey
                               enough; the draft/confirmed distinction is
                               more relevant on the editing surfaces
                               (Smeta boshqaruvi, Bosqichlar), not in this
                               read-only list. */}
                            {/* Per-estimate delete button — visible only when:
                                 (1) the user has construction.estimate.delete
                                     permission (admins/owners auto-pass), AND
                                 (2) the estimate is in draft state (backend
                                     also rejects non-draft delete with 400).
                               stopPropagation prevents the parent header's
                               onClick from toggling row expansion. The
                               confirm-dialog and i18n strings are wired up
                               in handleDeleteEstimate. The backend
                               middleware (h.perm.Require) is the actual
                               authority — this UI gate is just to hide the
                               button from users who'd hit a 403 if they
                               clicked. */}
                            {canDeleteEstimate && est.state === 'draft' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEstimate(est);
                                }}
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title={t('delete') || "O'chirish"}
                                aria-label={t('delete') || "O'chirish"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between ml-6">
                          <span className="text-sm text-slate-500">{est.lines_count || 0} {t('lines') || 'qator'}</span>
                          <span className="text-base font-semibold">{formatCurrency(displayAmount(est))}</span>
                        </div>
                      </div>

                      {/* Expanded: lines table */}
                      {isExpanded && (
                        <div className="border-t border-blue-200 bg-slate-50/70">
                          {/* Add line button */}
                          {/* "Qator qo'shish" toolbar removed — line creation lives in the
                             new Smeta boshqaruvi tab via the Yangi etap / Qo'shimcha resurs
                             flow, so this Smetalar table stays a read-only overview. */}

                          {isLoadingLines ? (
                            <Loader className="py-6" size="w-5 h-5" />
                          ) : lines.length === 0 ? (
                            <div className="text-center py-6">
                              <p className="text-slate-400 text-sm">{t('no_lines') || "Qatorlar yo'q"}</p>
                            </div>
                          ) : (
                            <div className="px-2 pb-2">
                              {/*
                                For resurs estimates the table has up to 10
                                columns (Nomi + 5 numeric rates + actions),
                                which don't fit on a typical desktop viewport
                                once sidebar + panel widths are taken out.
                                Give the table a minimum width so the
                                wrapping div's overflow-x-auto actually kicks
                                in and the user can scroll to the rightmost
                                columns (Material / Ish haqi / Jihozlar /
                                Birlik narxi / Jami) instead of having them
                                squeezed to 30-40px with the values wrapped
                                across two lines.
                              */}
                              {/* Ресурс tab is now a slim catalog view: Nomi /
                                  O'lchov / Birlik narxi only. The four numeric
                                  breakdown columns (Miqdor / Material / Ish /
                                  Jihozlar / Jami) were per-product noise on the
                                  resource catalog and have been hidden from the
                                  UI per UX request. ВОР/Единич keep the original
                                  Shifr / Nomi / O'lchov / Miqdor layout. */}
                              <div className="overflow-x-auto">
                                <table
                                  // No fixed min-width — the table now fills
                                  // the card's content width. The overflow-x-auto
                                  // wrapper around it (above) still catches the
                                  // edge case where the column widths legitimately
                                  // exceed the viewport (e.g. very long Russian
                                  // section names), but on normal screens the
                                  // table no longer leaves blank space to the
                                  // right of the last column.
                                  className="w-full text-sm table-fixed"
                                >
                                  <colgroup>
                                    {/* Column widths sized to fit the longest expected content
                                       without crowding the neighbouring column. Earlier sizing
                                       (Kod 120 / Resurs trailing 110+140+160 with min-w 640)
                                       squeezed the Nom column on real data — long Russian work
                                       names wrapped into 5+ lines and the Shifr text bled
                                       visually into Nom. Bumping the fixed widths and the
                                       table's overall min-width lets the user horizontally
                                       scroll instead of seeing crowded text. */}
                                    <col style={{ width: '56px' }} />
                                    {est.source_type !== 'resurs' && <col style={{ width: '200px' }} />}
                                    <col />{/* Nomi — absorbs remaining width */}
                                    <col style={{ width: '110px' }} />
                                    {/* Edinich / ВОР trailing columns:
                                          Norma (per-unit, "на. ед. измерения" = Excel col E)
                                          Miqdor (project total, "по проектным данным" = col F)
                                       Norma was previously only shown as an inline (Norma X.XX)
                                       label next to the resource name — small enough to miss.
                                       Promoting it to a real column keeps the Excel sheet's
                                       layout familiar. Display-only, mirrors norm_rate. */}
                                    {est.source_type !== 'resurs' && <col style={{ width: '110px' }} />}
                                    {est.source_type !== 'resurs' && <col style={{ width: '120px' }} />}
                                    {est.source_type === 'resurs' && (
                                      <>
                                        {/* Miqdor + Birlik narxi + Jami. The Miqdor (imported_quantity)
                                           and Jami (imported_total) columns are populated from the
                                           Ресурс XLSX "Количество" and "Сметная стоимость в базисном
                                           уровне" fields verbatim. They're DISPLAY-ONLY (migration
                                           413) — no cost, cascade, ledger, or budget code reads
                                           them. */}
                                        <col style={{ width: '140px' }} />
                                        <col style={{ width: '160px' }} />
                                        <col style={{ width: '180px' }} />
                                      </>
                                    )}
                                    {est.state === 'draft' && <col style={{ width: '96px' }} />}
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">№</th>
                                      {est.source_type !== 'resurs' && <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('code') || 'Shifr'}</th>}
                                      <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">{t('name') || 'Nomi'}</th>
                                      <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('unit') || "O'lchov"}</th>
                                      {est.source_type !== 'resurs' && (
                                        <>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('norm') || 'Norma'}</th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('quantity') || 'Miqdor'}</th>
                                        </>
                                      )}
                                      {est.source_type === 'resurs' && (
                                        <>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('quantity') || 'Miqdor'}</th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('unit_rate') || 'Birlik narxi'}</th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 whitespace-nowrap">{t('total') || 'Jami'}</th>
                                        </>
                                      )}
                                      {/* Inline +/edit/trash row actions removed — line editing is
                                         now done from the dedicated Smeta boshqaruvi tab so this
                                         table stays a read-only summary. */}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      // Group lines by parent. Two mechanisms, in order of precedence:
                                      //   1. Explicit FK (`parent_line_id`) set by the SublineModal flow.
                                      //   2. Implicit hierarchy detected from the item_number pattern
                                      //      `{base}-{seq}` (e.g. "3-1" is a child of "3"). This covers
                                      //      data imported from Excel/SNiP files where the numbering
                                      //      expresses the relationship but no FK was written.
                                      const byParent = new Map(); // parent_line_id -> children[]
                                      const roots = [];

                                      // Build an item_number -> line.id lookup for the implicit pass.
                                      // We only use top-level rows (no parent already set) as potential
                                      // parents so we don't stack 3-1-1 as child of 3-1.
                                      const itemNumToId = new Map();
                                      for (const ln of lines) {
                                        if (!ln.parent_line_id && ln.item_number) {
                                          itemNumToId.set(String(ln.item_number), ln.id);
                                        }
                                      }

                                      // Classify: a row is a sub-line if (a) it has parent_line_id,
                                      // or (b) its item_number looks like "N-M" (N, M both numeric)
                                      // AND an item_number "N" exists in this estimate.
                                      for (const ln of lines) {
                                        let effectiveParentId = null;
                                        if (ln.parent_line_id) {
                                          effectiveParentId = ln.parent_line_id;
                                        } else if (typeof ln.item_number === 'string') {
                                          // Only split on the LAST hyphen, and only when both sides are
                                          // plain integers. This avoids misinterpreting codes like
                                          // "E0102-057-02" (not all-numeric segments).
                                          const m = ln.item_number.match(/^(\d+)-(\d+)$/);
                                          if (m) {
                                            const base = m[1];
                                            const resolved = itemNumToId.get(base);
                                            if (resolved && resolved !== ln.id) {
                                              effectiveParentId = resolved;
                                            }
                                          }
                                        }

                                        if (effectiveParentId) {
                                          const arr = byParent.get(effectiveParentId) || [];
                                          arr.push(ln);
                                          byParent.set(effectiveParentId, arr);
                                        } else {
                                          roots.push(ln);
                                        }
                                      }
                                      const rows = [];
                                      // Subtotal row uses (colSpan - 2) for the content cell
                                      // which sits between the leftmost empty(es) and the
                                      // rightmost value cell. Visible cols per type:
                                      //   resurs:  №, Nomi, O'lchov, Miqdor, Birlik narxi, Jami → 6
                                      //   other:   №, Shifr, Nomi, O'lchov, Miqdor              → 5
                                      // The subtotal row is only rendered for resurs (see the
                                      // `est.source_type === 'resurs'` guard below), so we size
                                      // colSpan for that case:
                                      //   layout: [empty №] + content (cs-2) + [value under Jami]
                                      //   ⇒ 1 + (cs-2) + 1 = 6  ⇒  cs = 6
                                      // Migration 400 added the Miqdor / Jami columns; the old
                                      // value of 4 left the subtotal text leaking past the
                                      // intended Birlik narxi column.
                                      const colSpan = 6;

                                      const renderLine = (line, isSubline, parent) => {
                                        // Sub-lines (podkator) get a green tint + left accent border so they're
                                        // visually distinct from regular estimate rows.
                                        const rowClass = isSubline
                                          ? 'border-b border-slate-100 hover:bg-emerald-50/70 group bg-emerald-50/40 border-l-[3px] border-l-emerald-400'
                                          : 'border-b border-slate-100 hover:bg-white group';
                                        return (
                                          <tr key={line.id} className={rowClass}>
                                            <td className="py-2 px-2 text-xs whitespace-nowrap">
                                              {isSubline
                                                ? <span className="pl-6 font-mono text-emerald-700 whitespace-nowrap">{line.item_number}</span>
                                                : <span className="font-medium text-slate-500 whitespace-nowrap">{line.item_number}</span>}
                                            </td>
                                            {est.source_type !== 'resurs' && (
                                              // break-words lets a long shifr that still doesn't
                                              // fit in the wider 200px column break inside the
                                              // cell instead of leaking into the Nom column. The
                                              // text comes from imported XLSX where line breaks
                                              // get flattened into a single string ("E0101-197-14
                                              // ДОП. 11 ГОСАРХИТЕКТСТРОЙ РУЗ ПР. № 429 ОТ
                                              // 15.12.17 Г.") so we need word-level breaks for
                                              // wrapping to look right.
                                              <td className={`py-2 px-2 text-xs break-words ${isSubline ? 'text-emerald-700/80' : 'text-slate-500'}`}>{line.code}</td>
                                            )}
                                            <td className={`py-2 px-2 text-xs break-words ${isSubline ? 'text-emerald-900' : ''}`}>
                                              {isSubline && (
                                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
                                                  line.resource_type === 'labor' ? 'bg-blue-500' :
                                                  line.resource_type === 'equipment' ? 'bg-amber-500' :
                                                  line.resource_type === 'material' ? 'bg-emerald-600' : 'bg-emerald-400'
                                                }`} />
                                              )}
                                              {line.name}
                                              {/* Inline "(Norma X.XX)" label removed —
                                                 the per-unit norm now has its own
                                                 dedicated column (Norma) for non-resurs
                                                 estimates, so the inline label was
                                                 redundant and easy to miss. */}
                                            </td>
                                            <td className="py-2 px-2 text-right text-xs text-slate-600 whitespace-nowrap">{line.uom}</td>
                                            {est.source_type !== 'resurs' && (
                                              // Norma (per-unit, Excel col E) — DISPLAY-ONLY.
                                              // Sourced from norm_rate, which the Edinich
                                              // parser populates from "на. ед. измерения".
                                              // Empty for parent works (the norm only
                                              // applies to child resources), and rendered
                                              // as an em-dash when zero.
                                              <td className="py-2 px-2 text-right text-xs whitespace-nowrap">
                                                {isSubline && Number(line.norm_rate) > 0
                                                  ? <span className="text-emerald-700/80 font-medium">{Number(line.norm_rate)}</span>
                                                  : <span className="text-slate-300">—</span>}
                                              </td>
                                            )}
                                            {est.source_type !== 'resurs' && (
                                              // Fallback chain (most specific → least):
                                              //   1. imported_quantity — file's literal value.
                                              //   2. original_quantity — parent-only anchor.
                                              //   3. live `quantity` — last fallback.
                                              //
                                              // Use !== 0 instead of > 0 so NEGATIVE values
                                              // (subtraction positions like ВЫЧИТАЕТСЯ ПОЗИЦИЯ)
                                              // surface as -1.03 / -30.9 instead of falling
                                              // through to 0. The file legitimately stores
                                              // negative qtys for deductive rows.
                                              <td className="py-2 px-2 text-right text-xs whitespace-nowrap">
                                                {line.imported_quantity != null && Number(line.imported_quantity) !== 0
                                                  ? Number(line.imported_quantity)
                                                  : (Number(line.original_quantity) !== 0
                                                      ? line.original_quantity
                                                      : line.quantity)}
                                              </td>
                                            )}
                                            {est.source_type === 'resurs' && (
                                              <>
                                                {/* Miqdor — show the file's "Количество" verbatim.
                                                   Falls back to original_quantity / live quantity for
                                                   rows imported before migration 400 so older data
                                                   doesn't render as em-dashes.

                                                   imported_quantity is DISPLAY-ONLY: it never feeds
                                                   the cost cascade, NORMA pill, FAKT ledger, or Reja
                                                   vs Fakt budget. The user wanted the file figure
                                                   visible without altering any computed behaviour. */}
                                                <td className="py-2 px-2 text-right text-xs text-slate-700 whitespace-nowrap">
                                                  {line.imported_quantity != null
                                                    ? Number(line.imported_quantity)
                                                    : (Number(line.original_quantity) !== 0
                                                        ? line.original_quantity
                                                        : (Number(line.quantity) !== 0 ? line.quantity : '—'))}
                                                </td>
                                                <td className="py-2 px-2 text-right text-xs font-medium whitespace-nowrap">{formatCurrency(line.unit_rate)}</td>
                                                {/* Jami — show the file's "Сметная стоимость в базисном
                                                   уровне" verbatim. Same display-only contract as
                                                   Miqdor. Falls back to the computed total_amount so
                                                   pre-migration rows still render a useful figure.
                                                   Uses !== 0 so negative totals (deductions) display
                                                   instead of falling through to an em-dash. */}
                                                <td className="py-2 px-2 text-right text-xs font-semibold whitespace-nowrap">
                                                  {line.imported_total != null
                                                    ? formatCurrency(Number(line.imported_total))
                                                    : (Number(line.total_amount) !== 0
                                                        ? formatCurrency(line.total_amount)
                                                        : '—')}
                                                </td>
                                              </>
                                            )}
                                            {/* Per-row +/edit/trash actions removed — Smeta boshqaruvi tab
                                               is the single editing surface for estimate lines. */}
                                          </tr>
                                        );
                                      };

                                      // Only paint the first N roots; the rest
                                      // are revealed as the user scrolls the
                                      // sentinel below into view. Children ride
                                      // with their parent, so nothing is split.
                                      const visibleRoots = roots.slice(0, visibleLineCount);
                                      for (const parent of visibleRoots) {
                                        rows.push(renderLine(parent, false, null));
                                        const children = byParent.get(parent.id) || [];
                                        for (const c of children) {
                                          rows.push(renderLine(c, true, parent));
                                        }
                                        if (children.length > 0 && est.source_type === 'resurs') {
                                          const subTotal = children.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);
                                          rows.push(
                                            <tr key={`subtotal-${parent.id}`} className="bg-emerald-50/60 border-b border-slate-100 border-l-[3px] border-l-emerald-400">
                                              <td className="py-1.5 px-2" />
                                              {est.source_type !== 'resurs' && <td />}
                                              <td className="py-1.5 px-2 text-xs text-emerald-800 italic" colSpan={colSpan - 2}>
                                                {parent.item_number}-{t('subline_total_label') || "qator podkatorlar jami"}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-xs font-semibold text-emerald-700">
                                                {formatCurrency(subTotal)}
                                              </td>
                                              {est.state === 'draft' && <td />}
                                            </tr>
                                          );
                                        }
                                        // Also render any orphan lines that claim this as parent by item_number
                                        // (legacy rows linked via parent_item_number only)
                                      }

                                      // Render orphans (parent_line_id unset and parent_item_number points to nothing)
                                      return rows;
                                    })()}
                                  </tbody>
                                  {est.source_type === 'resurs' && (
                                    <tfoot>
                                      {/* resurs visible cols (post-migration 400):
                                          №, Nomi, O'lchov, Miqdor, Birlik narxi, Jami
                                          (+ optional Actions in draft state).
                                          Label cell spans cols 1–5, value cell sits in col 6
                                          (Jami), and the draft state appends an extra empty td. */}
                                      <tr className="font-semibold bg-white">
                                        <td colSpan={5} className="py-2 px-2 text-right text-xs">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}:</td>
                                        <td className="py-2 px-2 text-right text-xs">{formatCurrency(est.amount_direct || 0)}</td>
                                        {est.state === 'draft' && <td></td>}
                                      </tr>
                                    </tfoot>
                                  )}
                                </table>
                              </div>

                              {/* Infinite-scroll sentinel — reveals the next
                                  page of lines as it scrolls into view. Only
                                  while more root lines remain. */}
                              {visibleLineCount < expandedRootCount && (
                                <div ref={lineLoadMoreRef} className="py-4 flex items-center justify-center">
                                  <Loader className="py-0" size="w-4 h-4" />
                                </div>
                              )}

                              {/* Summary — only for resurs type */}
                              {est.source_type === 'resurs' && (
                              <div className="mt-2 mx-2 border-t pt-2 space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">{t('direct_cost') || "To'g'ridan-to'g'ri xarajat"}</span>
                                  <span className="font-medium">{formatCurrency(est.amount_direct || 0)}</span>
                                </div>
                                {est.overhead_pct > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">{t('overhead') || "Qo'shimcha xarajatlar"} ({est.overhead_pct}%)</span>
                                    <span>{formatCurrency((est.amount_direct || 0) * (est.overhead_pct / 100))}</span>
                                  </div>
                                )}
                                {est.profit_pct > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">{t('profit') || 'Foyda'} ({est.profit_pct}%)</span>
                                    <span>{formatCurrency((est.amount_direct || 0) * (1 + est.overhead_pct / 100) * (est.profit_pct / 100))}</span>
                                  </div>
                                )}
                                {est.vat_pct > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">QQS ({est.vat_pct}%)</span>
                                    <span>{formatCurrency(
                                      (est.amount_direct || 0) * (1 + est.overhead_pct / 100) * (1 + est.profit_pct / 100) * (est.vat_pct / 100)
                                    )}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-sm border-t pt-1">
                                  <span>{t('total') || 'Jami'}</span>
                                  <span>{formatCurrency(est.amount_total || 0)}</span>
                                </div>
                              </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
                {(() => {
                  const totalCount = filteredEstimates.length;
                  const totalPages = Math.ceil(totalCount / pageSize);
                  return totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-sm text-slate-500">
                        {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} / {totalCount}
                      </p>
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>1</button>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
                        <button className="px-2 py-1 text-sm border rounded disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Svod Summary (only in main estimates view) */}
      {!scope && <SmetaSummaryView key={summaryKey} projectId={project?.id} />}

      {/* Create Estimate Modal */}
      <Dialog open={showEstimateModal} onOpenChange={setShowEstimateModal}>
        <DialogContent aria-describedby={undefined} className="overflow-visible">
          <DialogHeader>
            <DialogTitle>{t('create_estimate') || "Yangi smeta yaratish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEstimate}>
            <div className="space-y-4">
              <div>
                <Label>{t('name') || 'Nomi'} *</Label>
                <Input
                  value={estimateForm.name}
                  onChange={(e) => setEstimateForm({ ...estimateForm, name: e.target.value })}
                  placeholder={t('estimate_name_placeholder') || "Asosiy smeta"}
                  required
                />
              </div>
              <div>
                <Label>Smeta turi *</Label>
                <Select
                  value={estimateForm.source_type}
                  onValueChange={(val) => setEstimateForm({ ...estimateForm, source_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vor">ВОР — Ishlar ro'yxati</SelectItem>
                    <SelectItem value="edinich">Единич — Batafsil miqdor</SelectItem>
                    <SelectItem value="resurs">Ресурс — Resurslar narxi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {buildings.length > 0 && (
                <div>
                  <Label>{t('buildings_blocks') || 'Bino / Blok'}</Label>
                  <Select
                    value={estimateForm.building_id || "none"}
                    onValueChange={(val) => setEstimateForm({ ...estimateForm, building_id: val === "none" ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_building') || "Bino tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('entire_project') || "Butun loyiha"}</SelectItem>
                      {buildings.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scope === 'subcontract' && subcontracts.length > 0 && (
                <div>
                  <Label>{t('subcontractor') || 'Pudratchi'} *</Label>
                  <Select
                    value={estimateForm.subcontract_id || "none"}
                    onValueChange={(val) => setEstimateForm({ ...estimateForm, subcontract_id: val === "none" ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_subcontractor') || "Pudratchi tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {subcontracts.map(sc => (
                        <SelectItem key={sc.id} value={String(sc.id)}>
                          {sc.name}{sc.partner_name ? ` - ${sc.partner_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {estimateForm.source_type === 'resurs' && (
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="text-xs">{t('overhead') || "Qo'shimcha"}, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={estimateForm.overhead_pct}
                      onChange={(e) => setEstimateForm({ ...estimateForm, overhead_pct: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('profit') || 'Foyda'}, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={estimateForm.profit_pct}
                      onChange={(e) => setEstimateForm({ ...estimateForm, profit_pct: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">QQS, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={estimateForm.vat_pct}
                      onChange={(e) => setEstimateForm({ ...estimateForm, vat_pct: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowEstimateModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('create') || 'Yaratish'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Estimate Modal */}
      <Dialog open={showEditEstimateModal} onOpenChange={setShowEditEstimateModal}>
        <DialogContent aria-describedby={undefined} className="overflow-visible">
          <DialogHeader>
            <DialogTitle>{t('edit_estimate') || "Smetani tahrirlash"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEstimate}>
            <div className="space-y-4">
              <div>
                <Label>{t('name') || 'Nomi'} *</Label>
                <Input
                  value={editEstimateForm.name}
                  onChange={(e) => setEditEstimateForm({ ...editEstimateForm, name: e.target.value })}
                  placeholder={t('estimate_name_placeholder') || "Asosiy smeta"}
                  required
                />
              </div>
              <div>
                <Label>Smeta turi</Label>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {editEstimateForm.source_type === 'vor' ? 'ВОР — Ishlar ro\'yxati' :
                   editEstimateForm.source_type === 'edinich' ? 'Единич — Batafsil miqdor' :
                   editEstimateForm.source_type === 'resurs' ? 'Ресурс — Resurslar narxi' : editEstimateForm.source_type}
                </p>
              </div>
              {buildings.length > 0 && (
                <div>
                  <Label>{t('buildings_blocks') || 'Bino / Blok'}</Label>
                  <Select
                    value={editEstimateForm.building_id || "none"}
                    onValueChange={(val) => setEditEstimateForm({ ...editEstimateForm, building_id: val === "none" ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_building') || "Bino tanlang"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('entire_project') || "Butun loyiha"}</SelectItem>
                      {buildings.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editEstimateForm.source_type === 'resurs' && (
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="text-xs">{t('overhead') || "Qo'shimcha"}, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editEstimateForm.overhead_pct}
                      onChange={(e) => setEditEstimateForm({ ...editEstimateForm, overhead_pct: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('profit') || 'Foyda'}, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editEstimateForm.profit_pct}
                      onChange={(e) => setEditEstimateForm({ ...editEstimateForm, profit_pct: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">QQS, %</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      value={editEstimateForm.vat_pct}
                      onChange={(e) => setEditEstimateForm({ ...editEstimateForm, vat_pct: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowEditEstimateModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit">{t('save') || 'Saqlash'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Line Modal */}
      <Dialog open={showLineModal} onOpenChange={setShowLineModal}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{lineForm.id ? (t('edit_line') || "Qatorni tahrirlash") : (t('add_line') || "Qator qo'shish")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLine}>
            {lineForm.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('name') || 'Nomi'}</Label>
                    <Input
                      value={lineForm.name}
                      onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                      placeholder={t('line_name') || 'Qator nomi'}
                    />
                  </div>
                  <div>
                    <Label>{t('unit') || "O'lchov birligi"}</Label>
                    <Input
                      value={lineForm.uom}
                      onChange={(e) => setLineForm({ ...lineForm, uom: e.target.value })}
                      placeholder={t('uom_placeholder') || "шт, м, кг..."}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('quantity') || 'Miqdor'}</Label>
                    <NumberInput
                      value={lineForm.quantity}
                      onChange={(raw) => setLineForm({ ...lineForm, quantity: raw })}
                    />
                  </div>
                  <div>
                    <Label>{t('material_rate') || 'Material'}</Label>
                    <Input
                      value={lineForm.material_rate}
                      onChange={(e) => setLineForm({ ...lineForm, material_rate: formatPriceInput(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('labor_rate') || 'Ish haqi'}</Label>
                    <Input
                      value={lineForm.labor_rate}
                      onChange={(e) => setLineForm({ ...lineForm, labor_rate: formatPriceInput(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>{t('equipment_rate') || 'Jihozlar'}</Label>
                    <Input
                      value={lineForm.equipment_rate}
                      onChange={(e) => setLineForm({ ...lineForm, equipment_rate: formatPriceInput(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-sm font-semibold">{t('products') || 'Mahsulotlar'}</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAddLines(prev => [...prev, { product_id: '', quantity: '' }])}>
                      <Plus className="w-3 h-3 mr-1" /> {t('add_line') || "Qo'shish"}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {addLines.map((row, idx) => {
                      const mat = row.product_id ? products.find(p => String(p.product_id) === row.product_id) : null;
                      return (
                        <div key={idx} className="flex gap-3 items-end bg-slate-50 p-2 rounded">
                          <div className="flex-[2] min-w-0">
                            {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('product') || 'Mahsulot'}</label>}
                            <Select
                              value={row.product_id || "none"}
                              onValueChange={(val) => {
                                setAddLines(prev => prev.map((r, i) => i === idx ? { ...r, product_id: val === "none" ? '' : val } : r));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('select_product') || "Tanlang"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-</SelectItem>
                                {products.map(p => (
                                  <SelectItem key={p.product_id} value={String(p.product_id)}>
                                    {p.product_name}{p.uom ? ` (${p.uom})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 flex-shrink-0">
                            {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('qty') || 'Miqdor'}</label>}
                            <NumberInput
                              placeholder="0"
                              value={row.quantity}
                              onChange={(raw) => {
                                setAddLines(prev => prev.map((r, i) => i === idx ? { ...r, quantity: raw } : r));
                              }}
                            />
                          </div>
                          <div className="w-32 flex-shrink-0 text-right">
                            {idx === 0 && <label className="text-xs text-slate-500 mb-1 block">{t('price') || 'Narxi'}</label>}
                            <p className="text-sm py-2 text-slate-600 whitespace-nowrap">{mat?.unit_cost ? formatCurrency(mat.unit_cost) : '—'}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {idx === 0 && <label className="text-xs text-transparent mb-1 block">.</label>}
                            <Button
                              type="button" size="sm" variant="ghost"
                              onClick={() => setAddLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                              disabled={addLines.length === 1}
                              className="text-red-500 h-9 w-9 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  let grandTotal = 0;
                  for (const row of addLines) {
                    if (!row.product_id) continue;
                    const mat = products.find(p => String(p.product_id) === row.product_id);
                    const qty = parseFloat(row.quantity) || 0;
                    const unitRate = mat?.unit_cost || 0;
                    grandTotal += qty * unitRate;
                  }
                  return grandTotal > 0 ? (
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="text-sm text-slate-500">{t('total') || 'Jami'}</span>
                      <span className="text-base font-semibold">{formatCurrency(grandTotal)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowLineModal(false)}>
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button type="submit" disabled={!lineForm.id && !addLines.some(r => r.product_id && parseFloat(r.quantity) > 0)}>
                {lineForm.id ? (t('save') || 'Saqlash') : (t('add') || "Qo'shish")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel') || 'Bekor qilish'}</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {confirmDialog.variant === 'destructive' ? (t('delete') || "O'chirish") : (t('confirm') || 'Tasdiqlash')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Modal */}
      <SmetaImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        onImportSvod={handleImportSvod}
        buildings={buildings}
        project={project}
        subcontracts={subcontracts}
        scope={scope}
      />

      {/* Export Modal */}
      <SmetaExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        estimates={getFilteredEstimates()}
        estimateLines={estimateLines}
        loadEstimateLines={loadEstimateLines}
        selectedBuilding={selectedBuilding}
        project={project}
      />

      {/* Sub-line add / edit modal (migration 332) */}
      <SublineModal
        open={sublineDialog.open}
        onClose={() => setSublineDialog({ open: false, parent: null, estimateId: null, nextSeq: 1, initial: null })}
        parent={sublineDialog.parent}
        estimateId={sublineDialog.estimateId}
        projectId={project?.id}
        nextSeq={sublineDialog.nextSeq}
        initial={sublineDialog.initial}
        onSaved={async () => {
          if (sublineDialog.estimateId) {
            await loadEstimateLines(sublineDialog.estimateId, { force: true });
            await loadEstimates();
          }
        }}
      />

      {/* Full edit modal — used by the pencil icon on any line */}
      <EstimateLineEditModal
        open={editLineDialog.open}
        onClose={() => setEditLineDialog({ open: false, line: null, parent: null, estimateId: null })}
        line={editLineDialog.line}
        parent={editLineDialog.parent}
        estimateId={editLineDialog.estimateId}
        onSaved={async () => {
          if (editLineDialog.estimateId) {
            await loadEstimateLines(editLineDialog.estimateId, { force: true });
            await loadEstimates();
          }
        }}
      />
    </div>
  );
};

export default EstimatesTab;
