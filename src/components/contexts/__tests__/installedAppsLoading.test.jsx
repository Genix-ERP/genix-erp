/** @vitest-environment jsdom */
// InstalledAppsContext must not wipe the cache-hydrated app list while the
// company list is still loading (activeCompany === null, isLoading === true).
// Before the fix it cleared to [] immediately, which made sidebar modules
// disappear/appear late on every reload.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

let companyState = {
  activeCompany: null,
  companies: [],
  refreshCompanies: () => {},
  isLoading: true,
};

vi.mock('../CompanyContext', () => ({
  useCompany: () => companyState,
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

import { InstalledAppsProvider, useInstalledApps } from '../InstalledAppsContext';

function Probe() {
  const { isAppInstalled, isLoading } = useInstalledApps();
  return (
    <div>
      <span data-testid="crm">{String(isAppInstalled('crm'))}</span>
      <span data-testid="loading">{String(isLoading)}</span>
    </div>
  );
}

describe('InstalledAppsContext while companies are loading', () => {
  beforeEach(() => {
    localStorage.clear();
    companyState = {
      activeCompany: null,
      companies: [],
      refreshCompanies: () => {},
      isLoading: true,
    };
    // Base (no-company) cache key used by the initial state when the
    // active company id is not known yet.
    localStorage.setItem(
      'genix_installed_apps',
      JSON.stringify([{ app_id: 'crm', status: 'active' }])
    );
  });

  it('keeps hydrated apps and stays loading until companies resolve', async () => {
    const view = render(
      <InstalledAppsProvider>
        <Probe />
      </InstalledAppsProvider>
    );

    // While companies load: nothing cleared, still loading
    expect(screen.getByTestId('crm').textContent).toBe('true');
    expect(screen.getByTestId('loading').textContent).toBe('true');

    // Companies finished loading and there is genuinely no company → clear
    companyState = { ...companyState, isLoading: false };
    view.rerender(
      <InstalledAppsProvider>
        <Probe />
      </InstalledAppsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('crm').textContent).toBe('false');
  });
});
