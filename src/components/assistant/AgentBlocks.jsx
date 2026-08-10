import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ArrowUpDown, Download } from 'lucide-react';

// Generative UI: renders the typed `blocks` payload the agent produces via the
// render_blocks tool (docs/ai-yordamchi/conventions.md §2). Falls back to
// nothing when a block is malformed — prose still carries the answer.

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const fmtCell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
  return String(v);
};

function TableBlock({ block }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);

  const columns = Array.isArray(block.columns) ? block.columns.filter((c) => c && c.key) : [];
  const rows = Array.isArray(block.rows) ? block.rows.filter((r) => r && typeof r === 'object') : [];
  if (!columns.length || !rows.length) return null;

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'uz') * sortDir;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const exportCsv = () => {
    const head = columns.map((c) => `"${(c.label || c.key).replaceAll('"', '""')}"`).join(',');
    const body = sorted.map((r) =>
      columns.map((c) => `"${String(r[c.key] ?? '').replaceAll('"', '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([`﻿${head}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(block.title || 'jadval').replace(/[^\w\d-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/60">
        <span className="text-xs font-semibold text-slate-700">{block.title || 'Jadval'}</span>
        <button onClick={exportCsv} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600" title="CSV yuklab olish">
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr>
              {columns.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                    className="text-left px-3 py-1.5 font-medium text-slate-500 border-b border-slate-100 cursor-pointer select-none hover:text-slate-800 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">{c.label || c.key}<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((r, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{fmtCell(r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartBlock({ block }) {
  const categories = Array.isArray(block.categories) ? block.categories : [];
  const series = Array.isArray(block.series) ? block.series.filter((s) => s && Array.isArray(s.data)) : [];
  if (!series.length) return null;

  const data = categories.length
    ? categories.map((cat, i) => {
        const row = { name: String(cat) };
        series.forEach((s) => { row[s.name || 'qiymat'] = Number(s.data[i]) || 0; });
        return row;
      })
    : series[0].data.map((v, i) => ({ name: String(i + 1), [series[0].name || 'qiymat']: Number(v) || 0 }));

  const kind = block.kind === 'line' ? 'line' : block.kind === 'pie' ? 'pie' : 'bar';

  return (
    <div className="rounded-xl border border-slate-200 bg-white my-2 p-3">
      {block.title && <p className="text-xs font-semibold text-slate-700 mb-2">{block.title}</p>}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey={series[0].name || 'qiymat'} nameKey="name" outerRadius={80} label>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtCell(v)} />
            </PieChart>
          ) : kind === 'line' ? (
            <LineChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCell} width={70} />
              <Tooltip formatter={(v) => fmtCell(v)} />
              {series.length > 1 && <Legend />}
              {series.map((s, i) => (
                <Line key={i} type="monotone" dataKey={s.name || 'qiymat'} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtCell} width={70} />
              <Tooltip formatter={(v) => fmtCell(v)} />
              {series.length > 1 && <Legend />}
              {series.map((s, i) => (
                <Bar key={i} dataKey={s.name || 'qiymat'} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AgentBlocks({ blocks }) {
  if (!Array.isArray(blocks) || !blocks.length) return null;
  return (
    <div>
      {blocks.map((b, i) => {
        if (!b || typeof b !== 'object') return null;
        if (b.type === 'table') return <TableBlock key={i} block={b} />;
        if (b.type === 'chart') return <ChartBlock key={i} block={b} />;
        return null;
      })}
    </div>
  );
}
