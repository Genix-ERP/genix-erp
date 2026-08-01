/** @vitest-environment jsdom */
// Render smoke tests for the Xarajatlar module (v2). Same rationale as
// contracts.smoke.test.jsx: catch first-render crashes (missing import,
// undefined identifier, broken hook order) with the real translation
// table — only the network layer, permissions and contexts are mocked.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks —
// without the stub the async effect throws and React unmounts the tree.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// vi.mock factories are hoisted above imports/consts — vi.hoisted keeps
// this fixture visible inside the factory below.
const { sampleExpense } = vi.hoisted(() => ({ sampleExpense: {
  id: 'e-1',
  expense_number: 'EXP-2026-0018',
  category: 'Transport',
  category_id: 'cat-1',
  category_color: '#185FA5',
  employee_id: 'emp-1',
  employee_name: 'Dilshod Rahimov',
  date: '2026-08-01',
  description: "Yoqilg'i xarajati",
  amount: 250000,
  tax_amount: 0,
  total_amount: 250000,
  currency: 'UZS',
  status: 'submitted',
  is_recognized: true,
  created_at: '2026-08-01T09:00:00Z',
  submitted_at: '2026-08-01T09:05:00Z',
} }));

vi.mock('@/api/services/finance', () => ({
  financeService: {
    listExpenses: vi.fn().mockResolvedValue([sampleExpense]),
    getExpenseStats: vi.fn().mockResolvedValue({
      total: { count: 3, amount: 3600000 },
      draft: { count: 0, amount: 0 },
      pending_approval: { count: 1, amount: 250000 },
      pending_payment: { count: 1, amount: 150000 },
      paid: { count: 1, amount: 3200000 },
      rejected: { count: 0, amount: 0 },
      by_category: [
        { category_id: 'cat-1', name: 'Transport', color: '#185FA5', count: 2, amount: 2400000 },
        { category_id: 'cat-2', name: 'Ijara', color: '#534AB7', count: 1, amount: 1200000 },
      ],
      by_month: [{ month: '2026-08', amount: 3600000 }],
    }),
    listExpenseCategories: vi.fn().mockResolvedValue([
      { id: 'cat-1', code: 'TRANSPORT', name: 'Transport', color: '#185FA5', is_active: true },
    ]),
    listAccounts: vi.fn().mockResolvedValue([]),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    submitExpense: vi.fn(),
    approveExpense: vi.fn(),
    rejectExpense: vi.fn(),
    payExpense: vi.fn(),
    recognizeExpense: vi.fn(),
  },
}));

vi.mock('@/components/contexts/ModulesContext', () => ({
  useModules: () => ({
    employees: [{ id: 'emp-1', first_name: 'Dilshod', last_name: 'Rahimov' }],
  }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
    canRead: () => true,
    MODULES: { EXPENSES: 'expenses', FINANCIALS: 'finance' },
  }),
}));

vi.mock('@/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    formatCurrency: (v) => `${v} so'm`,
    formatCurrencyCompact: (v) => `${Math.round(v / 1000000)} mln so'm`,
  }),
}));

import { LanguageProvider } from '@/components/contexts/LanguageContext';
import Expenses from '../Expenses';

const renderPage = () => render(
  <LanguageProvider>
    <MemoryRouter>
      <Expenses />
    </MemoryRouter>
  </LanguageProvider>,
);

describe('Xarajatlar render smoke', () => {
  it('renders stats, charts and the table without crashing (uz default)', async () => {
    renderPage();
    // Stat tile label
    await waitFor(() => {
      expect(screen.getAllByText('Jami xarajatlar').length).toBeGreaterThan(0);
    });
    // Chart card titles
    await waitFor(() => {
      expect(screen.getByText("Kategoriya bo'yicha")).toBeTruthy();
      expect(screen.getByText("Oylar bo'yicha")).toBeTruthy();
    });
    // Table row from the mocked list — number, employee, status chip
    await waitFor(() => {
      expect(screen.getByText('EXP-2026-0018')).toBeTruthy();
    });
    expect(screen.getByText('Dilshod Rahimov')).toBeTruthy();
    expect(screen.getAllByText('Tasdiqlashda').length).toBeGreaterThan(0);
    // No "ariza" vocabulary anywhere on the rendered page
    expect(document.body.textContent.toLowerCase()).not.toContain('ariza');
  });

  it('opens the detail sheet on row click with lifecycle actions', async () => {
    const { getByText } = renderPage();
    await waitFor(() => {
      expect(getByText('EXP-2026-0018')).toBeTruthy();
    });
    getByText('EXP-2026-0018').click();
    await waitFor(() => {
      // Timeline header + approve action for a submitted expense
      expect(screen.getByText('Tarix')).toBeTruthy();
      expect(screen.getAllByText('Tasdiqlash').length).toBeGreaterThan(0);
    });
  });
});
