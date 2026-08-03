/** @vitest-environment jsdom */
// Render smoke tests for the Xodimlar (HR) module (2026-08-03 rebuild).
// Same rationale as assets.smoke.test.jsx: catch first-render crashes with
// the real translation table — network, auth and permissions are mocked.
// Guards the P0 fixes: KPI tiles come from /employees/stats (not the page),
// and the raw 'other' department fallback never reaches the DOM.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { sampleEmployees, sampleStats } = vi.hoisted(() => ({
  sampleEmployees: [
    {
      id: 'e-1', first_name: 'Dilshod', last_name: 'Rahimov', full_name: 'Dilshod Rahimov',
      job_title: 'Bosh muhandis', job_position_name: 'Bosh muhandis',
      department_id: 'd-const', department: "Qurilish bo'limi",
      hire_date: '2024-09-03', salary: 8000000, status: 'active',
    },
    {
      id: 'e-2', first_name: 'Kamola', last_name: 'Berdiyeva', full_name: 'Kamola Berdiyeva',
      job_title: 'Buxgalter', job_position_name: 'Buxgalter',
      department_id: '', department: '',
      hire_date: '2026-07-03', salary: 4000000, status: 'active',
    },
  ],
  sampleStats: {
    total: 13, active: 10, on_leave: 1, terminated: 2,
    hired_this_month: 1, hired_prev_month: 0, exits_this_month: 1,
    salary_fund: 46900000, avg_salary: 4690000,
    headcount_by_month: Array.from({ length: 12 }, (_, i) => ({
      month: `2025-${String(i + 1).padStart(2, '0')}`, hires: i % 3 === 0 ? 1 : 0, exits: 0, headcount: 8 + i,
    })),
    departments: [
      { id: 'd-const', name: "Qurilish bo'limi", count: 3 },
      { id: null, name: '', count: 1 },
    ],
    tenure_buckets: [{ bucket: '0-1', count: 5 }, { bucket: '1-3', count: 5 }],
    probation_ending: [{ id: 'e-2', name: 'Kamola Berdiyeva', date: '2026-08-23' }],
    upcoming_birthdays: [{ id: 'e-1', name: 'Dilshod Rahimov', date: '08-15' }],
  },
}));

vi.mock('@/api/client', () => {
  const get = vi.fn((url) => {
    if (url === '/employees') {
      return Promise.resolve({ data: { data: sampleEmployees, meta: { total: 13, total_pages: 1 } } });
    }
    if (url === '/departments') {
      return Promise.resolve({ data: { data: [{ id: 'd-const', name: "Qurilish bo'limi" }] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  const apiClient = { get, post: vi.fn().mockResolvedValue({ data: {} }), put: vi.fn(), delete: vi.fn() };
  return { default: apiClient, apiClient };
});

vi.mock('@/api/services/hr', () => ({
  hrService: {
    listEmployees: vi.fn().mockResolvedValue(sampleEmployees),
    getEmployeeStats: vi.fn().mockResolvedValue(sampleStats),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
    listEmployeeDeductions: vi.fn().mockResolvedValue([]),
    calculateSalary: vi.fn().mockResolvedValue(null),
    cancelDeduction: vi.fn(),
  },
}));

vi.mock('@/api/services/taskBoards', () => ({
  default: { listEmployeeTasks: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/api/services/fixedAssetsV2', () => {
  const svc = { listEmployeeAssets: vi.fn().mockResolvedValue([]) };
  return { default: svc, fixedAssetsV2Service: svc };
});

vi.mock('@/components/shared', () => ({
  ImportModal: () => null,
  ExportModal: () => null,
  PrintPreviewModal: () => null,
  ImportExportButtons: () => <div data-testid="import-export" />,
  useAuditTrail: () => ({ addAuditLog: vi.fn() }),
}));

vi.mock('@/components/contexts/ModulesContext', () => ({
  useModules: () => ({ coreModules: [], appModules: [] }),
}));
vi.mock('@/components/contexts/CompanyContext', () => ({
  useCompany: () => ({ activeCompany: { id: 'org-1' }, companies: [] }),
}));
vi.mock('@/components/contexts/InstalledAppsContext', () => ({
  useInstalledApps: () => ({ isAppInstalled: () => true }),
}));
vi.mock('@/components/contexts/EmployeePermissionsContext', () => ({
  useEmployeePermissions: () => ({
    getEmployeePermissions: vi.fn().mockResolvedValue({}),
    updateEmployeePermissions: vi.fn(),
  }),
  AVAILABLE_MODULES: [],
}));
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
    canRead: () => true,
    MODULES: { HR: 'hr' },
  }),
}));
vi.mock('@/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    formatCurrency: (v) => `${v} so'm`,
    formatCurrencyCompact: (v) => `${(v / 1e6).toFixed(1)} mln so'm`,
  }),
}));

import { LanguageProvider } from '@/components/contexts/LanguageContext';
import HR from '../HR';

const renderPage = (initialEntries = ['/hr']) => render(
  <LanguageProvider>
    <MemoryRouter initialEntries={initialEntries}>
      <HR />
    </MemoryRouter>
  </LanguageProvider>,
);

describe('Xodimlar render smoke', () => {
  it('renders KPI tiles from server stats, not the page rows', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Jami xodimlar')).toBeTruthy();
    });
    // 13 comes ONLY from /employees/stats (the page holds 2 rows)
    expect(screen.getByText('13')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('46.9 mln so\'m')).toBeTruthy();
  });

  it('renders the table with resolved department badge and no raw fallback', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Dilshod Rahimov')).toBeTruthy();
    });
    expect(screen.getAllByText("Qurilish bo'limi").length).toBeGreaterThan(0);
    // The old `|| 'other'` fallback must never reach the DOM
    expect(document.body.textContent).not.toContain('other');
    // Unassigned department renders an em-dash, not a badge
    expect(screen.getByText('Kamola Berdiyeva')).toBeTruthy();
  });

  it('shows the Tahlillar tab (via ?tab=analytics URL) with chart cards and widgets', async () => {
    renderPage(['/hr?tab=analytics']);
    await waitFor(() => {
      expect(screen.getByText('Xodimlar soni dinamikasi (12 oy)')).toBeTruthy();
      expect(screen.getByText("Bo'limlar bo'yicha taqsimot")).toBeTruthy();
      expect(screen.getByText('Sinov muddati tugayotganlar (30 kun)')).toBeTruthy();
      expect(screen.getByText("Yaqin tug'ilgan kunlar (30 kun)")).toBeTruthy();
    });
  });
});
