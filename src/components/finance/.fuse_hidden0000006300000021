import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Download, Loader2, CheckCircle, AlertTriangle, Printer } from "lucide-react";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from "@/api/services/finance";

/**
 * Aylanma-saldo qaydnomasi (ASQ) — Trial Balance with Opening/Turnover/Closing
 * per TT Buxgalteriya ERP §6.1.
 *
 * Shows: opening balance (Dt/Kt), period turnover (Dt/Kt), closing balance (Dt/Kt),
 * plus the invariant check sum(turnover Dt) = sum(turnover Kt).
 * Has an Excel export button that streams a .xlsx back from the backend.
 */
export default function TrialBalanceASQ() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { formatCurrency } = useCurrencyFormatter();

  const [periodFrom, setPeriodFrom] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [periodTo, setPeriodTo] = useState(now.toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await financeService.getTrialBalanceWithTurnover({
        period_from: periodFrom,
        period_to: periodTo,
      });
      setReport(data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load ASQ');
    } finally {
      setIsLoading(false);
    }
  }, [periodFrom, periodTo]);

  const downloadExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await financeService.exportTrialBalanceExcel({
        period_from: periodFrom,
        period_to: periodTo,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ASQ_${periodFrom}_${periodTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Failed to export Excel');
    } finally {
      setIsExporting(false);
    }
  }, [periodFrom, periodTo]);

  const fmt = (v) => {
    if (v === 0 || v == null) return '—';
    return formatCurrency(v);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Aylanma-saldo qaydnomasi (ASQ)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm font-medium block mb-1">Davr boshi</label>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Davr oxiri</label>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={loadReport} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Shakllantirish
            </Button>
            <Button
              variant="outline"
              onClick={downloadExcel}
              disabled={isExporting || !report}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Excel'ga yuklash
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              disabled={!report}
            >
              <Printer className="w-4 h-4 mr-2" />
              Chop etish
            </Button>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <>
          {/* Invariant banner */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                {report.turnover_is_balanced ? (
                  <Badge className="bg-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Balans: Dt aylanma = Kt aylanma
                  </Badge>
                ) : (
                  <Badge className="bg-red-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    BALANS BUZILGAN — aylanma Dt ≠ Kt
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {report.period_from} — {report.period_to}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="border-r align-bottom">Kod</TableHead>
                    <TableHead rowSpan={2} className="border-r align-bottom">Hisob nomi</TableHead>
                    <TableHead colSpan={2} className="border-r text-center">Boshi saldosi</TableHead>
                    <TableHead colSpan={2} className="border-r text-center">Aylanma (davr)</TableHead>
                    <TableHead colSpan={2} className="text-center">Oxiri saldosi</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-right">Dt</TableHead>
                    <TableHead className="text-right border-r">Kt</TableHead>
                    <TableHead className="text-right">Dt</TableHead>
                    <TableHead className="text-right border-r">Kt</TableHead>
                    <TableHead className="text-right">Dt</TableHead>
                    <TableHead className="text-right">Kt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.accounts || []).map((row) => (
                    <TableRow key={row.account_id}>
                      <TableCell className="font-mono border-r">{row.code}</TableCell>
                      <TableCell className="border-r">{row.name}</TableCell>
                      <TableCell className="text-right">{fmt(row.opening_debit)}</TableCell>
                      <TableCell className="text-right border-r">{fmt(row.opening_credit)}</TableCell>
                      <TableCell className="text-right">{fmt(row.turnover_debit)}</TableCell>
                      <TableCell className="text-right border-r">{fmt(row.turnover_credit)}</TableCell>
                      <TableCell className="text-right">{fmt(row.closing_debit)}</TableCell>
                      <TableCell className="text-right">{fmt(row.closing_credit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/40">
                    <TableCell colSpan={2} className="border-r">JAMI</TableCell>
                    <TableCell className="text-right">{fmt(report.total_opening_debit)}</TableCell>
                    <TableCell className="text-right border-r">{fmt(report.total_opening_credit)}</TableCell>
                    <TableCell className="text-right">{fmt(report.total_turnover_debit)}</TableCell>
                    <TableCell className="text-right border-r">{fmt(report.total_turnover_credit)}</TableCell>
                    <TableCell className="text-right">{fmt(report.total_closing_debit)}</TableCell>
                    <TableCell className="text-right">{fmt(report.total_closing_credit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
