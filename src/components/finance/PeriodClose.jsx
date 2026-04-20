import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Loader2, CheckCircle, AlertTriangle, Lock, Unlock } from "lucide-react";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from "@/api/services/finance";

/**
 * Davrni yopish (Period close) UI per TT Buxgalteriya §4.3.
 * Runs the atomic close procedure, shows invariant checks, supports reopen.
 */
export default function PeriodClose() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { formatCurrency } = useCurrencyFormatter();
  const [periodStart, setPeriodStart] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth.toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [closings, setClosings] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const list = await financeService.listPeriodClosings();
      setClosings(list || []);
    } catch (_) {}
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const runClose = useCallback(async () => {
    setIsClosing(true);
    try {
      const r = await financeService.closePeriod({
        period_start: periodStart,
        period_end: periodEnd,
        notes,
      });
      setLastResult(r);
      await refresh();
    } catch (err) {
      setLastResult({ status: 'failed', error: err?.response?.data?.message || err.message });
    } finally {
      setIsClosing(false);
    }
  }, [periodStart, periodEnd, notes, refresh]);

  const reopen = useCallback(async (id) => {
    const reason = prompt("Qayta ochish sababini kiriting:");
    if (!reason) return;
    await financeService.reopenPeriod(id, reason);
    await refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Davrni yopish (TT §4.3)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm font-medium block mb-1">Davr boshi</label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Davr oxiri</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-40" />
            </div>
            <div className="flex-1 min-w-64">
              <label className="text-sm font-medium block mb-1">Izoh</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ixtiyoriy" />
            </div>
            <Button onClick={runClose} disabled={isClosing}>
              {isClosing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Davrni yopish
            </Button>
          </div>

          {lastResult && (
            <div className="mt-4 border rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                {lastResult.status === 'closed' ? (
                  <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Yopildi</Badge>
                ) : (
                  <Badge className="bg-red-600"><AlertTriangle className="w-3 h-3 mr-1" />{lastResult.status}</Badge>
                )}
                <span className="text-sm">
                  Dt: {formatCurrency(lastResult.total_debit || 0)} / Kt: {formatCurrency(lastResult.total_credit || 0)}
                </span>
                <span className="text-sm">
                  Sof foyda: {formatCurrency(lastResult.net_profit || 0)}
                </span>
              </div>
              {Array.isArray(lastResult.checks) && lastResult.checks.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Tekshiruv</TableHead><TableHead>Natija</TableHead><TableHead>Izoh</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastResult.checks.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{c.check_name}</TableCell>
                        <TableCell>{c.passed ? '✅' : '❌'}</TableCell>
                        <TableCell>{c.message || ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Oxirgi yopilishlar</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Davr</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dt</TableHead>
                <TableHead className="text-right">Kt</TableHead>
                <TableHead className="text-right">Sof foyda</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closings.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.period_start} — {c.period_end}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'closed' ? 'default' : 'outline'}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(c.total_debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.total_credit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.net_profit)}</TableCell>
                  <TableCell>{c.completed_at || '—'}</TableCell>
                  <TableCell>
                    {c.status === 'closed' && (
                      <Button variant="outline" size="sm" onClick={() => reopen(c.id)}>
                        <Unlock className="w-3 h-3 mr-1" /> Qayta ochish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
