/** @vitest-environment jsdom */
// EmployeePermissionsContext must hydrate the converted permission state
// from the per-user localStorage cache on the first render, so employee
// sidebars don't flip from "no modules" to "modules" after the permissions
// request. The backend stays the enforcement point.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    isAuthenticated: true,
    isSiteAdmin: () => false,
    isOwner: () => false,
    backendAvailable: false,
  }),
}));

vi.mock('@/api/services/auth', () => ({
  default: { getCurrentUserPermissions: vi.fn() },
}));

vi.mock('@/api/services', () => ({
  hrService: {},
}));

import { EmployeePermissionsProvider, useEmployeePermissions } from '../EmployeePermissionsContext';

function Probe() {
  const { canAccessModule, isAdmin, organizationIds, employeeId } = useEmployeePermissions();
  return (
    <div>
      <span data-testid="finance">{String(canAccessModule('finance'))}</span>
      <span data-testid="hr">{String(canAccessModule('hr'))}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="orgs">{organizationIds.join(',')}</span>
      <span data-testid="emp">{employeeId || 'none'}</span>
    </div>
  );
}

describe('EmployeePermissionsContext cache hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('genixerp_user', JSON.stringify({ id: 'u1' }));
  });

  it('hydrates employee permissions synchronously from cache', async () => {
    localStorage.setItem(
      'genix_permissions_cache_user_u1',
      JSON.stringify({
        isAdmin: false,
        employeeId: 'emp-9',
        organizationIds: ['org-1'],
        permissions: {
          finance: { create: false, read: true, update: false, delete: false },
        },
      })
    );

    render(
      <EmployeePermissionsProvider>
        <Probe />
      </EmployeePermissionsProvider>
    );

    expect(screen.getByTestId('finance').textContent).toBe('true');
    expect(screen.getByTestId('hr').textContent).toBe('false');
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('orgs').textContent).toBe('org-1');
    expect(screen.getByTestId('emp').textContent).toBe('emp-9');

    await act(async () => {});
  });

  it('hydrates admin flag synchronously from cache', async () => {
    localStorage.setItem(
      'genix_permissions_cache_user_u1',
      JSON.stringify({ isAdmin: true, employeeId: null, organizationIds: [], permissions: {} })
    );

    render(
      <EmployeePermissionsProvider>
        <Probe />
      </EmployeePermissionsProvider>
    );

    expect(screen.getByTestId('admin').textContent).toBe('true');
    expect(screen.getByTestId('finance').textContent).toBe('true');

    await act(async () => {});
  });

  it('starts empty without a cache (unchanged cold behavior)', async () => {
    render(
      <EmployeePermissionsProvider>
        <Probe />
      </EmployeePermissionsProvider>
    );

    expect(screen.getByTestId('finance').textContent).toBe('false');
    expect(screen.getByTestId('admin').textContent).toBe('false');

    await act(async () => {});
  });
});
