import React, { useState, useEffect, useCallback } from 'react';
import { constructionService } from '@/api/services/construction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Trash2, Loader2, BarChart3 } from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { formatDate } from '@/utils/formatDate';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiError';

export default function SmetaSummaryView({ projectId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { formatCurrency } = useCurrencyFormatter();

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const items = await constructionService.listEstimateSummary(projectId);
      setData(items || []);
    } catch (error) {
      console.error('Failed to load summary:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (data.length === 0) {
    return null;
  }

  // Group data by batch, then pivot into cross-tab
  const batches = {};
  for (const row of data) {
    if (!batches[row.batch_id]) {
      batches[row.batch_id] = { batch_id: row.batch_id, created_date: row.created_date, rows: [] };
    }
    batches[row.batch_id].rows.push(row);
  }

  const handleDeleteBatch = async (batchId) => {
    try {
      await constructionService.deleteEstimateSummaryBatch(batchId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete batch:', error);
    
      toast.error(getApiErrorMessage(error, 'Amalni bajarib bo\'lmadi'));
    }
    setDeleteConfirm(null);
  };

  return (
    <>
      {Object.values(batches).map((batch) => {
        // Extract unique buildings and categories preserving order
        const buildingSet = new Map();
        const categoryMap = new Map();

        for (const row of batch.rows) {
          if (!buildingSet.has(row.building_column)) {
            buildingSet.set(row.building_column, true);
          }
          // Key by row_number to handle duplicate category names
          if (!categoryMap.has(row.row_number)) {
            categoryMap.set(row.row_number, { row_number: row.row_number, name: row.category_name, amounts: {} });
          }
          categoryMap.get(row.row_number).amounts[row.building_column] = row.amount;
        }

        const buildings = [...buildingSet.keys()];
        const categories = [...categoryMap.values()].sort((a, b) => a.row_number - b.row_number);

        return (
          <Card key={batch.batch_id} className="mb-4">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Smeta svodi
                  <Badge variant="outline" className="text-xs font-normal">
                    {formatDate(batch.created_date)}
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 h-7 px-2"
                  onClick={() => setDeleteConfirm(batch.batch_id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="border rounded-lg overflow-auto max-h-[70vh]">
                <Table style={{ minWidth: `${300 + 160 * (buildings.length + 1)}px` }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">№</TableHead>
                      <TableHead className="min-w-[250px]">Xarajat turi</TableHead>
                      <TableHead className="w-40 text-right whitespace-nowrap">Jami</TableHead>
                      {buildings.map((b) => (
                        <TableHead key={b} className="w-40 text-right text-xs whitespace-nowrap">{b}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat, idx) => {
                      const isTotal = cat.name.toUpperCase().includes('ИТОГО') || cat.name.toUpperCase().includes('ВСЕГО');
                      const total = buildings.reduce((sum, b) => sum + (cat.amounts[b] || 0), 0);
                      return (
                        <TableRow key={idx} className={isTotal ? 'bg-slate-50 font-medium' : ''}>
                          <TableCell className="text-xs text-slate-500">
                            {cat.row_number}
                          </TableCell>
                          <TableCell className="text-xs">{cat.name}</TableCell>
                          <TableCell className="text-xs text-right font-medium whitespace-nowrap">
                            {total ? formatCurrency(total) : '—'}
                          </TableCell>
                          {buildings.map((b) => (
                            <TableCell key={b} className="text-xs text-right whitespace-nowrap">
                              {cat.amounts[b] ? formatCurrency(cat.amounts[b]) : '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smeta svodini o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              Ushbu smeta svodi ma'lumotlarini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => handleDeleteBatch(deleteConfirm)}
            >
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
