/** @vitest-environment jsdom */
// Render smoke tests for the Shartnomalar module. These exist to catch the
// class of bug that shipped the `useMemo is not defined` white-screen: a
// page that crashes on its very first render (missing import, undefined
// identifier, broken hook order). They render the real components with the
// real translation table — only the network layer and auth are mocked.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/api/services/contracts', () => ({
  default: {
    list: vi.fn().mockResolvedValue({ items: [], meta: null }),
    getStats: vi.fn().mockResolvedValue({ total: 2, active: 1, expiring_soon: 1, active_total_value: 250000000, outstanding: 100 }),
    getNextNumber: vi.fn().mockResolvedValue({ contract_number: 'CNT-2026-0005' }),
    get: vi.fn().mockResolvedValue({
      id: 'c-1',
      contract_number: 'CNT-2026-0001',
      title: 'Bosh pudrat shartnomasi',
      vendor_name: 'Toshkent Savdo LLC',
      direction: 'income',
      contract_type: 'project',
      status: 'active',
      allowed_transitions: ['completed', 'cancelled'],
      start_date: '2026-06-01T00:00:00Z',
      end_date: '2026-09-01T00:00:00Z',
      value: 250000000,
      effective_amount: 275000000,
      paid_total: 50000000,
      outstanding: 225000000,
      currency: 'UZS',
      days_to_expiry: 31,
      amendment_count: 1,
      file_count: 0,
    }),
    listFiles: vi.fn().mockResolvedValue([]),
    listAmendments: vi.fn().mockResolvedValue([]),
    listInvoices: vi.fn().mockResolvedValue({ invoices: [], paid_total: 0, effective_amount: 275000000, outstanding: 275000000 }),
    listLinks: vi.fn().mockResolvedValue([]),
    listTasks: vi.fn().mockResolvedValue([]),
    listActivity: vi.fn().mockResolvedValue([]),
    aiExtract: vi.fn(),
    create: vi.fn(),
    attachInvoice: vi.fn(),
  },
}));

vi.mock('@/api/services', () => ({
  contactsService: { list: vi.fn().mockResolvedValue([]) },
  salesService: { listInvoices: vi.fn().mockResolvedValue([]), listOrders: vi.fn().mockResolvedValue([]) },
  financeService: { listPurchaseInvoices: vi.fn().mockResolvedValue({ data: [] }) },
  procurementService: { listOrders: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/api/services/crm', () => ({
  opportunitiesService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/api/services/construction', () => ({
  default: { listProjects: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/api/services/taskBoards', () => ({
  default: {
    listBoards: vi.fn().mockResolvedValue([]),
    createTask: vi.fn(),
    addTaskLink: vi.fn(),
  },
}));

vi.mock('@/api/entities', () => ({
  Employee: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/components/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
    canRead: () => true,
    MODULES: { CONTRACTS: 'contracts', FINANCIALS: 'finance' },
  }),
}));

vi.mock('@/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({ formatCurrency: (v) => `${v} UZS` }),
}));

import { LanguageProvider } from '@/components/contexts/LanguageContext';
import Contracts from '../Contracts';
import ContractDetail from '../ContractDetail';
import ErrorBoundary from '@/components/ErrorBoundary';

const renderPage = (ui, { route = '/' } = {}) => render(
  <LanguageProvider>
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  </LanguageProvider>,
);

describe('Shartnomalar render smoke', () => {
  it('registry page renders stats and empty state without crashing', async () => {
    renderPage(
      <Routes>
        <Route path="/" element={<Contracts />} />
      </Routes>,
    );
    // Stat card label (uz default) appears once loaded
    await waitFor(() => {
      expect(screen.getByText('Muddati tugayotgan (30 kun)')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText("Hali shartnomalar yo'q")).toBeTruthy();
    });
  });

  it('detail page renders a loaded contract without crashing', async () => {
    renderPage(
      <Routes>
        <Route path="/contracts/:contractId" element={<ContractDetail />} />
      </Routes>,
      { route: '/contracts/c-1' },
    );
    await waitFor(() => {
      expect(screen.getByText('Bosh pudrat shartnomasi')).toBeTruthy();
    });
    expect(screen.getByText('CNT-2026-0001')).toBeTruthy();
    // Status chip translated (uz)
    expect(screen.getAllByText('Amalda').length).toBeGreaterThan(0);
  });

  it('error boundary shows a translated (non-English default) fallback', () => {
    const Boom = () => { throw new Error('boom'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    expect(screen.getByText('Xatolik yuz berdi')).toBeTruthy();
    expect(screen.getByText('Qayta urinish')).toBeTruthy();
  });
});
