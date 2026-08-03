/** @vitest-environment jsdom */
// Render smoke test for the rebuilt Savdo dashboard (SalesDashboard.jsx).
// Catches first-render crashes with the real translation table — only the
// stats endpoint and currency formatter are mocked.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { sampleStats } = vi.hoisted(() => ({
  sampleStats: {
    period: { from: '2026-08-01', to: '2026-08-03' },
    totals: {
      orders_count: 12,
      orders_sum: 48000000,
      revenue_paid: 31000000,
      unpaid_total: 17000000,
      unpaid_over_30d: 5000000,
      overdue_invoices: 2,
      undelivered_orders: 4,
    },
    monthly_series: [
      { month: '2026-03', orders_sum: 10000000, paid_sum: 8000000 },
      { month: '2026-04', orders_sum: 12000000, paid_sum: 9000000 },
      { month: '2026-05', orders_sum: 9000000, paid_sum: 9000000 },
      { month: '2026-06', orders_sum: 15000000, paid_sum: 11000000 },
      { month: '2026-07', orders_sum: 13000000, paid_sum: 10000000 },
      { month: '2026-08', orders_sum: 48000000, paid_sum: 31000000 },
    ],
    top_customers: [
      { customer_id: 'c-1', name: 'Yuksalish Qurilish', total: 26000000 },
      { customer_id: 'c-2', name: 'Baraka Savdo', total: 14000000 },
      { name: 'Boshqa', total: 8000000 },
    ],
    recent_orders: [
      {
        id: 'so-1',
        order_number: 'SO-2026-0042',
        customer_name: 'Yuksalish Qurilish',
        status: 'confirmed',
        payment_status: 'partial',
        total_amount: 26000000,
        order_date: '2026-08-02',
      },
    ],
    overdue_invoices: [
      {
        id: 'inv-1',
        invoice_number: 'INV-2026-0031',
        customer_name: 'Baraka Savdo',
        amount_due: 5000000,
        due_date: '2026-06-20',
        days_overdue: 44,
      },
    ],
  },
}));

vi.mock('@/api/services/sales', () => ({
  salesService: {
    getStats: vi.fn().mockResolvedValue(sampleStats),
  },
}));

vi.mock('@/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    formatCurrency: (v) => `${v} so'm`,
    formatCurrencyCompact: (v) => `${Math.round(v / 1000000)} mln`,
  }),
}));

import { useTranslation } from '@/components/utils/translations';
import SalesDashboard from '../SalesDashboard';

const renderDashboard = (onOpenTab = vi.fn()) => {
  const { t } = useTranslation('uz');
  return render(<SalesDashboard t={t} language="uz" onOpenTab={onOpenTab} />);
};

describe('Savdo dashboard render smoke', () => {
  it('renders stat tiles, charts and the chase lists (uz)', async () => {
    renderDashboard();

    // Stat tiles
    await waitFor(() => {
      expect(screen.getByText('Buyurtmalar')).toBeTruthy();
    });
    expect(screen.getByText("Daromad (to'langan)")).toBeTruthy();
    expect(screen.getByText("To'lanmagan")).toBeTruthy();
    expect(screen.getByText('Yetkazilmagan buyurtmalar')).toBeTruthy();
    // 30+ day sub-label appears because unpaid_over_30d > 0
    expect(screen.getByText(/30\+ kun/)).toBeTruthy();

    // Chart card titles
    expect(screen.getByText('Savdo dinamikasi')).toBeTruthy();
    expect(screen.getByText('Top mijozlar')).toBeTruthy();

    // Recent orders list — number, customer, translated status chip.
    // (uz has duplicate "confirmed" entries; the literal's last one wins,
    // so accept either "Tasdiqlangan" or "Tasdiqlandi".)
    expect(screen.getByText('SO-2026-0042')).toBeTruthy();
    expect(screen.getByText(/Tasdiqlan/)).toBeTruthy();

    // Overdue invoices mini-table — the daily chase list
    expect(screen.getByText("Muddati o'tgan hisob-fakturalar")).toBeTruthy();
    expect(screen.getByText('INV-2026-0031')).toBeTruthy();
    expect(screen.getByText(/\+44/)).toBeTruthy();

    // No raw translation keys leaked into the page
    expect(document.body.textContent).not.toMatch(/sales_dashboard_|sales_dynamics|days_overdue_short/);
  });

  it('shows the empty-state CTA when there is no data and routes it to the orders tab', async () => {
    const { salesService } = await import('@/api/services/sales');
    salesService.getStats.mockResolvedValueOnce({
      period: {},
      totals: {},
      monthly_series: [],
      top_customers: [],
      recent_orders: [],
      overdue_invoices: [],
    });

    const onOpenTab = vi.fn();
    renderDashboard(onOpenTab);

    await waitFor(() => {
      expect(screen.getByText('Birinchi buyurtmani yaratish')).toBeTruthy();
    });
    screen.getByText('Birinchi buyurtmani yaratish').click();
    expect(onOpenTab).toHaveBeenCalledWith('orders');
  });
});
