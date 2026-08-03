/** @vitest-environment jsdom */
// Render smoke tests for the Aktivlar module (2026-08-03 rebuild). Same
// rationale as expenses.smoke.test.jsx: catch first-render crashes with the
// real translation table — only the network layer, auth and permissions are
// mocked.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { sampleAsset, sampleStats, sampleMapping } = vi.hoisted(() => ({
  sampleAsset: {
    id: 'a-1',
    inventory_number: 'FA-000001',
    name: 'Ekskavator CAT 320',
    status: 'in_service',
    cost: 768000000,
    salvage_value: 0,
    useful_life_months: 96,
    accumulated_depreciation: 24000000,
    book_value: 744000000,
    category_id: 'cat-mach',
    category_name: 'Mashina va uskunalar',
    department_name: 'Ishlab chiqarish',
    serial_number: 'CAT320-2211',
    purchase_date: '2026-04-10',
    commissioning_date: '2026-04-10',
    assigned_employee_name: 'Dilshod Rahimov',
    construction_object_name: 'Yunusobod obyekt',
  },
  sampleStats: {
    total_count: 1,
    total_cost: 768000000,
    total_book_value: 744000000,
    month_depreciation: 8000000,
    month_period: '2026-08',
    fully_depreciated: 0,
    by_status: [{ status: 'in_service', count: 1, cost: 768000000, book_value: 744000000 }],
    nbv_trend: Array.from({ length: 12 }, (_, i) => ({
      period: `2026-${String(i + 1).padStart(2, '0')}`,
      nbv: i < 4 ? 0 : 768000000 - (i - 3) * 8000000,
    })),
  },
  sampleMapping: {
    categories: [{
      id: 'cat-mach', code: 'machinery', name_uz: 'Mashina va uskunalar',
      asset_account: '0130', depreciation_account: '0230', depreciable: true,
      is_active: true, default_useful_life_months: 96,
    }],
    departments: [{ id: 'dep-prod', code: 'production', name_uz: 'Ishlab chiqarish', expense_account: '2010', is_active: true }],
    settings: { auto_post: false, cron_enabled: true, rounding: 2 },
  },
}));

vi.mock('@/api/services/fixedAssetsV2', () => {
  const fixedAssetsV2Service = {
    listAssets: vi.fn().mockResolvedValue([sampleAsset]),
    getAsset: vi.fn().mockResolvedValue(sampleAsset),
    getStats: vi.fn().mockResolvedValue(sampleStats),
    getMapping: vi.fn().mockResolvedValue(sampleMapping),
    getSchedule: vi.fn().mockResolvedValue([
      { period: '2026-09', amount: 8000000, accumulated: 32000000, book_value: 736000000 },
    ]),
    getEntries: vi.fn().mockResolvedValue([
      { id: 'e-1', period: '2026-05', amount: 8000000, status: 'active', debit_account: '2010', credit_account: '0230' },
    ]),
    listMaintenance: vi.fn().mockResolvedValue([]),
    listRuns: vi.fn().mockResolvedValue({
      runs: [{
        id: 'r-1', period: '2026-07', status: 'posted', total: 8000000,
        line_count: 1, skipped_count: 0, created_at: '2026-08-01T09:00:00Z',
        posted_at: '2026-08-01T09:05:00Z', posted_by_name: 'Admin', journal_entry_id: 'je-1',
      }],
      unposted_gaps: ['2026-06'],
      suggested_period: '2026-07',
    }),
    createAsset: vi.fn(),
    createRun: vi.fn(),
    getRun: vi.fn(),
    postRun: vi.fn(),
    reverseRun: vi.fn(),
    commissionAsset: vi.fn(),
    conserveAsset: vi.fn(),
    reactivateAsset: vi.fn(),
    disposeAsset: vi.fn(),
    updateAsset: vi.fn(),
    recordMaintenance: vi.fn(),
    reconcile: vi.fn(),
    createFromPO: vi.fn(),
    listEmployeeAssets: vi.fn().mockResolvedValue([]),
  };
  return { fixedAssetsV2Service, default: fixedAssetsV2Service };
});

vi.mock('@/api/services/hr', () => ({
  hrService: { listEmployees: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/api/services/construction', () => ({
  constructionService: { listProjects: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/api/services/ai', () => ({
  aiService: { extractInvoice: vi.fn() },
}));

vi.mock('@/components/contexts/AuthContext', () => ({
  useAuth: () => ({ isOwner: () => true, isSiteAdmin: () => false }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
    canRead: () => true,
    MODULES: { ASSETS: 'assets' },
  }),
}));

vi.mock('@/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    formatCurrency: (v) => `${v} so'm`,
  }),
}));

import { LanguageProvider } from '@/components/contexts/LanguageContext';
import Assets from '../Assets';

const renderPage = () => render(
  <LanguageProvider>
    <MemoryRouter>
      <Assets />
    </MemoryRouter>
  </LanguageProvider>,
);

describe('Aktivlar render smoke', () => {
  it('renders the stat strip, chart card and registry row (uz default)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Jami aktivlar').length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Qoldiq qiymat dinamikasi (12 oy)")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('FA-000001')).toBeTruthy();
    });
    expect(screen.getByText('Ekskavator CAT 320')).toBeTruthy();
    expect(screen.getByText('Dilshod Rahimov')).toBeTruthy();
    // Status chip is translated — never the raw enum
    expect(screen.getAllByText('Foydalanishda').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('in_service');
    // The untranslated-key leak from the old page must never come back
    expect(document.body.textContent).not.toContain('classic');
  });

  it('opens the asset card panel on row click', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('FA-000001')).toBeTruthy();
    });
    screen.getByText('FA-000001').click();
    await waitFor(() => {
      // Schedule preview + lifecycle action from the panel
      expect(screen.getByText('Kelgusi jadval (prognoz)')).toBeTruthy();
      expect(screen.getAllByText('Texnik xizmat').length).toBeGreaterThan(0);
    });
  });

  it('shows the run journal with gap warning on the Amortizatsiya tab', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Amortizatsiya')).toBeTruthy();
    });
    screen.getByText('Amortizatsiya').click();
    await waitFor(() => {
      expect(screen.getByText('Amortizatsiya reglamentlari')).toBeTruthy();
      expect(screen.getByText("O'tkazilmagan davrlar bor")).toBeTruthy();
      expect(screen.getByText('2026-07')).toBeTruthy();
    });
  });
});
