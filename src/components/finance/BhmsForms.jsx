import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CheckCircle, AlertTriangle } from "lucide-react";
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import financeService from "@/api/services/finance";

/**
 * BHMS №21 Reglamentlashtirilgan hisobotlar (regulated reports):
 *   - Forma 1: Buxgalteriya balansi
 *   - Forma 2: Moliyaviy natijalar
 *   - Forma 3: Pul mablag'lari harakati
 *
 * TT Buxgalteriya ERP §6.4.
 */
export default function BhmsForms() {
  const now = new Date();
  const firstOfYear = new Date(now.getFullYear(), 0, 1);

  const { formatCurrency } = useCurrencyFormatter();

  const [asOfDate, setAsOfDate] = useState(now.toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState(firstOfYear.toISOString().split('T')[0]);
  const [periodTo, setPeriodTo] = useState(now.toISOString().split('T')[0]);

  const [forma1, setForma1] = useState(null);
  const [forma2, setForma2] = useState(null);
  const [forma3, setForma3] = useState(null);
  const [loading, setLoading] = useState({});

  const loadForma1 = useCallback(async () => {
    setLoading((p) => ({ ...p, f1: true }));
    try {
      const data = await financeService.getForma1({ as_of_date: asOfDate });
      setForma1(data);
    } finally {
      setLoading((p) => ({ ...p, f1: false }));
    }
  }, [asOfDate]);

  const loadForma2 = useCallback(async () => {
    setLoading((p) => ({ ...p, f2: true }));
    try {
      const data = await financeService.getForma2({
        period_from: periodFrom,
        period_to: periodTo,
      });
      setForma2(data);
    } finally {
      setLoading((p) => ({ ...p, f2: false }));
    }
  }, [periodFrom, periodTo]);

  const loadForma3 = useCallback(async () => {
    setLoading((p) => ({ ...p, f3: true }));
    try {
      const data = await financeService.getForma3({
        period_from: periodFrom,
        period_to: periodTo,
      });
      setForma3(data);
    } finally {
      setLoading((p) => ({ ...p, f3: false }));
    }
  }, [periodFrom, periodTo]);

  const downloadAll = useCallback(async () => {
    const blob = await financeService.exportFormasExcel({
      as_of_date: asOfDate,
      period_from: periodFrom,
      period_to: periodTo,
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BHMS_Forma_1_2_3_${periodFrom}_${periodTo}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }, [asOfDate, periodFrom, periodTo]);

  const fmt = (v) => (v === 0 ? '—' : formatCurrency(v));

  const renderForma = (data) => {
    if (!data) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{data.title}</span>
            {data.is_balanced !== undefined && (
              data.is_balanced
                ? <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Balansda</Badge>
                : <Badge className="bg-red-600"><AlertTriangle className="w-3 h-3 mr-1" />Balans yo'q</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Kod</TableHead>
                <TableHead>Nomi</TableHead>
                <TableHead className="w-32">Hisob</TableHead>
                <TableHead className="text-right w-40">Summa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.sections || []).map((sec) => (
                <React.Fragment key={sec.section_code}>
                  <TableRow className="bg-muted/40 font-bold">
                    <TableCell>{sec.section_code}</TableCell>
                    <TableCell colSpan={3}>{sec.name_uz}</TableCell>
                  </TableRow>
                  {(sec.lines || []).map((l) => (
                    <TableRow key={l.line_code}>
                      <TableCell className="font-mono">{l.line_code}</TableCell>
                      <TableCell>
                        {l.name_uz}
                        {l.name_ru && <div className="text-xs text-muted-foreground">{l.name_ru}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.account_match}</TableCell>
                      <TableCell className="text-right">{fmt(l.current)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell colSpan={3}>Jami {sec.section_code}</TableCell>
                    <TableCell className="text-right">{fmt(sec.subtotal)}</TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              <TableRow className="font-bold bg-yellow-50">
                <TableCell colSpan={3}>UMUMIY</TableCell>
                <TableCell className="text-right">{fmt(data.total_current)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>BHMS №21 — Forma 1, 2, 3</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm font-medium block mb-1">Forma 1 (sana)</label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Davr boshi (F2, F3)</label>
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Davr oxiri</label>
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={downloadAll}>
              <Download className="w-4 h-4 mr-2" /> Excel (F1+F2+F3)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="f1" className="w-full">
        <TabsList>
          <TabsTrigger value="f1">Forma 1 — Balans</TabsTrigger>
          <TabsTrigger value="f2">Forma 2 — Moliyaviy natijalar</TabsTrigger>
          <TabsTrigger value="f3">Forma 3 — Pul oqimlari</TabsTrigger>
        </TabsList>
        <TabsContent value="f1" className="space-y-3">
          <Button onClick={loadForma1} disabled={loading.f1}>
            {loading.f1 ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Shakllantirish
          </Button>
          {renderForma(forma1)}
        </TabsContent>
        <TabsContent value="f2" className="space-y-3">
          <Button onClick={loadForma2} disabled={loading.f2}>
            {loading.f2 ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Shakllantirish
          </Button>
          {renderForma(forma2)}
        </TabsContent>
        <TabsContent value="f3" className="space-y-3">
          <Button onClick={loadForma3} disabled={loading.f3}>
            {loading.f3 ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Shakllantirish
          </Button>
          {renderForma(forma3)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
