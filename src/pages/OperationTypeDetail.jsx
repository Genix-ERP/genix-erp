import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Package, PackagePlus, ArrowRightLeft, Truck, Store,
  Search, List, LayoutGrid, Star, ChevronRight, ChevronLeft,
  Settings2, X
} from "lucide-react";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useTranslation } from "@/components/utils/translations";
import { inventoryService } from '@/api/services';

const getOperationIcon = (type, className = "w-5 h-5") => {
  switch (type) {
    case 'receipt': return <PackagePlus className={className} />;
    case 'internal': return <ArrowRightLeft className={className} />;
    case 'delivery': return <Truck className={className} />;
    case 'pos': return <Store className={className} />;
    default: return <Package className={className} />;
  }
};

// State badge colors (Odoo style - simple colored badges)
const stateBadgeConfig = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700' },
  waiting: { bg: 'bg-blue-100', text: 'text-blue-700' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700' },
  assigned: { bg: 'bg-green-500', text: 'text-white' },
  done: { bg: 'bg-green-700', text: 'text-white' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function OperationTypeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const initialState = searchParams.get('state') || 'all';

  const [operationType, setOperationType] = useState(null);
  const [pickings, setPickings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState(initialState);
  const [viewMode, setViewMode] = useState('list');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [groupBy, setGroupBy] = useState('none');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await inventoryService.getOperationType(id);
        setOperationType(data.operation_type);
        setPickings(data.pickings || []);
      } catch (err) {
        console.error('Error fetching operation type:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Filter
  const filteredPickings = pickings.filter(p => {
    const matchesSearch = !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.origin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'all'
      || (stateFilter === 'late'
        ? p.scheduled_date && new Date(p.scheduled_date) < new Date() && p.state !== 'done' && p.state !== 'cancelled'
        : p.state === stateFilter);
    return matchesSearch && matchesState;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPickings.length / pageSize);
  const paginatedPickings = filteredPickings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const startRecord = filteredPickings.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, filteredPickings.length);

  // Group
  const groupedPickings = groupBy === 'none'
    ? { all: paginatedPickings }
    : paginatedPickings.reduce((acc, p) => {
        const key = groupBy === 'state'
          ? (t(`state_${p.state}`) || p.state)
          : groupBy === 'priority'
            ? (p.priority || 'normal')
            : 'all';
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isLate = d < now;
    const formatted = d.toLocaleDateString(language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    return { formatted, isLate };
  };

  const toggleSelect = (pickingId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(pickingId)) next.delete(pickingId);
      else next.add(pickingId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedPickings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedPickings.map(p => p.id)));
    }
  };

  // Active filters display
  const activeFilters = [];
  if (stateFilter !== 'all') {
    activeFilters.push({
      key: 'state',
      label: t(`state_${stateFilter}`) || stateFilter,
      onRemove: () => setStateFilter('all')
    });
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--genix-blue)] mx-auto" />
        </div>
      </div>
    );
  }

  if (!operationType) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-4">
            {t('not_found') || "Topilmadi"}
          </h3>
          <Button variant="outline" onClick={() => navigate('/inventory?tab=operations')}>
            {t('back') || "Orqaga"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="space-y-3">

        {/* Top bar - Odoo style: breadcrumb left, pagination + view toggle right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Breadcrumb */}
            <button
              onClick={() => navigate('/inventory?tab=operations')}
              className="text-[var(--genix-blue)] text-sm font-medium hover:underline"
            >
              {t('inventory_overview') || "Inventory Overview"}
            </button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">
                {operationType.code}: {operationType.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pagination info */}
            {filteredPickings.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <span>{startRecord}-{endRecord} / {filteredPickings.length}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* View toggle */}
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 ${viewMode === 'kanban' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search bar with filter chips - Odoo style */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />

          {/* Active filter chips */}
          {activeFilters.map(f => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--genix-blue)] text-white text-xs font-medium"
            >
              {f.label}
              <button onClick={f.onRemove} className="hover:bg-white/20 rounded">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <Input
            placeholder={t('search') || "Search..."}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="border-0 shadow-none focus-visible:ring-0 h-7 text-sm px-1 flex-1"
          />

          {/* Filter dropdown on right side */}
          <Select
            value={stateFilter}
            onValueChange={(v) => { setStateFilter(v); setCurrentPage(1); }}
          >
            <SelectTrigger className="w-auto border-0 shadow-none h-7 text-xs gap-1 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all') || "All"}</SelectItem>
              <SelectItem value="draft">{t('state_draft') || "Draft"}</SelectItem>
              <SelectItem value="waiting">{t('state_waiting') || "Waiting"}</SelectItem>
              <SelectItem value="confirmed">{t('state_confirmed') || "Confirmed"}</SelectItem>
              <SelectItem value="assigned">{t('state_assigned') || "Ready"}</SelectItem>
              <SelectItem value="done">{t('state_done') || "Done"}</SelectItem>
              <SelectItem value="cancelled">{t('state_cancelled') || "Cancelled"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {filteredPickings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg text-center py-16">
            <Package className="w-16 h-16 mx-auto text-slate-200 mb-4" />
            <h3 className="text-base font-medium text-slate-500 mb-1">
              {pickings.length === 0
                ? (t('no_transfers') || "No transfers yet")
                : (t('no_matching_transfers') || "No matching transfers found")}
            </h3>
            <p className="text-sm text-slate-400">
              {pickings.length === 0
                ? (t('transfers_will_appear_here') || "Transfers will appear here")
                : (t('try_different_filters') || "Try different filters")}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* List View - Odoo style */
          Object.entries(groupedPickings).map(([group, items]) => (
            <div key={group}>
              {groupBy !== 'none' && (
                <div className="flex items-center gap-2 px-1 py-2 text-sm font-semibold text-slate-700">
                  <span>{group}</span>
                  <span className="text-slate-400">({items.length})</span>
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                      <TableHead className="w-10 px-3">
                        <Checkbox
                          checked={selectedIds.size === paginatedPickings.length && paginatedPickings.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-8" />
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        {t('reference') || "Reference"}
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        {t('contact') || "Contact"}
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        {t('scheduled_date') || "Scheduled Date"}
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        {t('source_document') || "Source Document"}
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wider text-right pr-4">
                        {t('status') || "Status"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((picking) => {
                      const dateInfo = formatDate(picking.scheduled_date);
                      const badgeStyle = stateBadgeConfig[picking.state] || stateBadgeConfig.draft;
                      const isUrgent = picking.priority === 'urgent' || picking.priority === 'high';

                      return (
                        <TableRow
                          key={picking.id}
                          className="hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(picking.id)}
                              onCheckedChange={() => toggleSelect(picking.id)}
                            />
                          </TableCell>
                          <TableCell className="px-0 w-8">
                            <Star
                              className={`w-4 h-4 cursor-pointer ${
                                isUrgent
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300 hover:text-amber-400'
                              }`}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-sm text-slate-900">
                              {picking.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {picking.user_name || ''}
                          </TableCell>
                          <TableCell>
                            {dateInfo && (
                              <span className={`text-sm ${dateInfo.isLate && picking.state !== 'done' ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                                {dateInfo.formatted}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {picking.origin || ''}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
                              {t(`state_${picking.state}`) || picking.state}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
        ) : (
          /* Kanban View - Odoo style */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedPickings.map((picking) => {
              const dateInfo = formatDate(picking.scheduled_date);
              const badgeStyle = stateBadgeConfig[picking.state] || stateBadgeConfig.draft;
              const isUrgent = picking.priority === 'urgent' || picking.priority === 'high';

              return (
                <div
                  key={picking.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm text-slate-900 group-hover:text-[var(--genix-blue)]">
                        {picking.name}
                      </p>
                      {picking.origin && (
                        <p className="text-xs text-slate-500 mt-0.5">{picking.origin}</p>
                      )}
                    </div>
                    <Star
                      className={`w-4 h-4 flex-shrink-0 ${
                        isUrgent
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5 text-xs mb-3">
                    {picking.user_name && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('contact') || "Contact"}</span>
                        <span className="text-slate-700">{picking.user_name}</span>
                      </div>
                    )}
                    {dateInfo && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('scheduled_date') || "Scheduled Date"}</span>
                        <span className={dateInfo.isLate && picking.state !== 'done' ? 'text-red-600 font-medium' : 'text-slate-700'}>
                          {dateInfo.formatted}
                        </span>
                      </div>
                    )}
                  </div>

                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
                    {t(`state_${picking.state}`) || picking.state}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom selection bar - Odoo style */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 z-50">
            <span className="text-sm font-medium">
              {selectedIds.size} {t('selected') || "selected"}
            </span>
            <div className="w-px h-5 bg-slate-600" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              {t('deselect_all') || "Deselect All"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
