import { test, expect } from '@playwright/test';

const ADMIN = { email: 'admin@genixerp.com', password: 'admin123' };

async function login(page, { email, password } = ADMIN) {
  await page.goto('/login');
  await page.fill('#identifier', email);
  await page.fill('#password', password);
  await page.click('.login-form__submit');
  // Wait for dashboard or any authenticated page to load
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

// ─── AUTH ────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#identifier')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('.login-form__submit')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await login(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── DASHBOARD ───────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard renders without 429 errors', async ({ page }) => {
    const errors429 = [];
    page.on('response', (res) => {
      if (res.status() === 429) errors429.push(res.url());
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(5000); // Let all API calls settle

    expect(errors429.length).toBe(0);
  });

  test('dashboard shows content (no permanent loading spinner)', async ({ page }) => {
    await page.goto('/dashboard');
    // Wait for the loading spinner to disappear
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('.animate-spin');
      return spinners.length === 0;
    }, { timeout: 20000 });
  });
});

// ─── SIDEBAR NAVIGATION ─────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sidebar contains core navigation links', async ({ page }) => {
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/aiassistant"]').first()).toBeVisible();
  });

  test('navigate to Inventory page', async ({ page }) => {
    await page.click('a[href="/inventory"]');
    await expect(page).toHaveURL(/\/inventory/);
    await page.waitForTimeout(2000);
  });

  test('navigate to Customers page', async ({ page }) => {
    await page.click('a[href="/customers"]');
    await expect(page).toHaveURL(/\/customers/);
  });

  test('navigate to Financials page', async ({ page }) => {
    await page.click('a[href="/financials"]');
    await expect(page).toHaveURL(/\/financials/);
  });

  test('navigate to Sales Orders page', async ({ page }) => {
    await page.click('a[href="/salesorders"]');
    await expect(page).toHaveURL(/\/salesorders/);
  });

  test('navigate to Projects page', async ({ page }) => {
    const link = page.locator('a[href="/projects"]');
    if (await link.count() === 0) {
      test.skip();
      return;
    }
    await link.click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('navigate to HR page', async ({ page }) => {
    const link = page.locator('a[href="/hr"]');
    if (await link.count() === 0) {
      test.skip();
      return;
    }
    await link.click();
    await expect(page).toHaveURL(/\/hr/);
  });

  test('navigate to Settings page (admin)', async ({ page }) => {
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(/\/settings/);
  });
});

// ─── NO 429 ERRORS ON PAGE NAVIGATION ───────────────────────────

test.describe('No 429 errors on page loads', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const pages = [
    { name: 'Dashboard', url: '/dashboard' },
    { name: 'Inventory', url: '/inventory' },
    { name: 'Customers', url: '/customers' },
    { name: 'Financials', url: '/financials' },
    { name: 'Sales Orders', url: '/salesorders' },
    { name: 'Projects', url: '/projects' },
    { name: 'HR', url: '/hr' },
    { name: 'Settings', url: '/settings' },
  ];

  for (const p of pages) {
    test(`${p.name} page loads without 429 errors`, async ({ page }) => {
      const errors429 = [];
      page.on('response', (res) => {
        if (res.status() === 429) errors429.push(res.url());
      });

      await page.goto(p.url);
      await page.waitForTimeout(5000);

      expect(errors429).toEqual([]);
    });
  }
});

// ─── CONSOLE ERRORS CHECK ────────────────────────────────────────

test.describe('No critical console errors', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard has no uncaught exceptions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/dashboard');
    await page.waitForTimeout(5000);

    // Filter out known non-critical errors
    const critical = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(critical).toEqual([]);
  });

  test('inventory page has no uncaught exceptions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/inventory');
    await page.waitForTimeout(5000);

    const critical = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(critical).toEqual([]);
  });
});
