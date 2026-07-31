/** @vitest-environment jsdom */
// Sidebar hydration regression tests: the dynamic module list must be
// available on the FIRST render (from localStorage caches), not only after
// the /organizations and installed-apps requests resolve. Covers the
// "sidebar menus open with a delay" bug.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

const permsMock = {
  isAdmin: true,
  organizationIds: [],
  canAccessOrganization: () => true,
  isLoading: true,
};

vi.mock('../EmployeePermissionsContext', () => ({
  useEmployeePermissions: () => permsMock,
}));

vi.mock('@/api/client', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/config/dataMode', () => ({
  checkBackendHealth: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/api/services/installedApps', () => ({
  installedAppsService: { getInstalledApps: vi.fn().mockResolvedValue([]) },
}));

import apiClient from '@/api/client';
import { CompanyProvider, useCompany } from '../CompanyContext';
import { InstalledAppsProvider, useInstalledApps } from '../InstalledAppsContext';

function Probe() {
  const { activeCompany, companies, isLoading } = useCompany();
  const { isAppInstalled, isAppHiddenInActiveCompany } = useInstalledApps();
  return (
    <div>
      <span data-testid="active">{activeCompany ? activeCompany.company_name : 'none'}</span>
      <span data-testid="count">{companies.length}</span>
      <span data-testid="company-loading">{String(isLoading)}</span>
      <span data-testid="crm">{String(isAppInstalled('crm'))}</span>
      <span data-testid="finance">{String(isAppInstalled('finance'))}</span>
      <span data-testid="hidden-construction">{String(isAppHiddenInActiveCompany('construction'))}</span>
    </div>
  );
}

const renderProbe = () =>
  render(
    <CompanyProvider>
      <InstalledAppsProvider>
        <Probe />
      </InstalledAppsProvider>
    </CompanyProvider>
  );

describe('sidebar data hydrates synchronously from cache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    permsMock.isLoading = true;

    localStorage.setItem('genixerp_user', JSON.stringify({ id: 'u1', email: 'u1@x.uz' }));
    localStorage.setItem('genix_active_company_user_u1', 'org-2');
    localStorage.setItem(
      'genix_companies_cache_user_u1',
      JSON.stringify([
        { id: 'org-1', company_code: 'MAIN', company_name: 'Asosiy Kompaniya', hidden_apps: [] },
        { id: 'org-2', company_code: 'HQ', company_name: 'Bosh ofis', hidden_apps: ['construction'] },
      ])
    );
    localStorage.setItem(
      'genix_installed_apps_org-2',
      JSON.stringify([
        { app_id: 'crm', status: 'active' },
        { app_id: 'finance', status: 'active' },
        { app_id: 'construction', status: 'active' },
      ])
    );
  });

  it('renders active company and installed apps on first paint, before any request resolves', async () => {
    // /organizations never resolves — everything shown must come from cache
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderProbe();

    expect(screen.getByTestId('active').textContent).toBe('Bosh ofis');
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('crm').textContent).toBe('true');
    expect(screen.getByTestId('finance').textContent).toBe('true');
    // Per-org hidden app is filtered from the very first render too
    expect(screen.getByTestId('hidden-construction').textContent).toBe('true');

    await act(async () => {});
  });

  it('keeps cache-hydrated companies when /organizations fails transiently', async () => {
    permsMock.isLoading = false;
    apiClient.get.mockRejectedValue(new Error('network down'));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('company-loading').textContent).toBe('false'));

    expect(apiClient.get).toHaveBeenCalledWith('/organizations');
    expect(screen.getByTestId('active').textContent).toBe('Bosh ofis');
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('crm').textContent).toBe('true');
  });

  it('still clears state on failure when there is no cache (first-ever load)', async () => {
    localStorage.removeItem('genix_companies_cache_user_u1');
    permsMock.isLoading = false;
    apiClient.get.mockRejectedValue(new Error('unauthorized'));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('company-loading').textContent).toBe('false'));

    expect(screen.getByTestId('active').textContent).toBe('none');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
