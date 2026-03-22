import { test, expect } from '@playwright/test';

// Fixed credentials — stable across isolated and full runs
const SUPER_ADMIN = { email: 'superadmin@perfume.store', password: 'superadmin123' };
const TEST_CUSTOMER = {
    email: 'e2e_fixed_customer@perfume.store',
    password: 'password123',
    firstName: 'E2E',
    lastName: 'Tester'
};

/**
 * Login helper — uses networkidle to handle different redirect targets
 */
async function login(page, { email, password }) {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Wait for navigation to settle (handles redirect to '/' or staying on login for wrong creds)
    await page.waitForLoadState('networkidle', { timeout: 15000 });
}

/**
 * Register helper — silently handles "already exists" case
 */
async function ensureRegistered(page, { email, password, firstName, lastName }) {
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[name="firstName"]', firstName);
    await page.fill('input[name="lastName"]', lastName);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    // If already registered, go login instead
    if (page.url().includes('/register')) {
        await login(page, { email, password });
    }
}

// ─────────────────────────────────────────
// GUEST ROLE
// ─────────────────────────────────────────
test.describe('Expert QA Audit: Guest Role', () => {

    test('1. Guest: Visual & Discovery Audit', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        // Nav may be lazy — use a generous timeout
        await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });

        const shopLink = page.getByRole('link', { name: /shop|explore|collection/i }).first();
        await expect(shopLink).toBeVisible({ timeout: 10000 });
        await shopLink.click();
        await expect(page).toHaveURL(/.*shop/);

        const product = page.locator('a[href*="/product/"]').first();
        await expect(product).toBeVisible({ timeout: 10000 });
        await product.click();
        await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    });

    test('2. Guest: Security Check', async ({ page }) => {
        const protectedRoutes = ['/admin', '/superadmin', '/profile'];
        for (const route of protectedRoutes) {
            await page.goto(route);
            await page.waitForTimeout(1500);
            // Should be redirected away
            expect(page.url()).not.toContain(route.replace('/', ''));
        }
    });
});

// ─────────────────────────────────────────
// CUSTOMER ROLE
// ─────────────────────────────────────────
test.describe('Expert QA Audit: Customer Role', () => {

    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await ensureRegistered(page, TEST_CUSTOMER);
        await context.close();
    });

    test.beforeEach(async ({ page }) => {
        await login(page, TEST_CUSTOMER);
    });

    test('1. Customer: Lifecycle Audit', async ({ page }) => {
        // Profile check
        await page.goto('/profile');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByText(/Profile|Settings|My Account/i).first()).toBeVisible({ timeout: 10000 });

        // Stock-aware shopping
        await page.goto('/shop');
        await page.waitForLoadState('networkidle');

        const productLinks = page.locator('a[href*="/product/"]');
        const count = await productLinks.count();
        let added = false;

        for (let i = 0; i < Math.min(count, 10); i++) {
            const href = await productLinks.nth(i).getAttribute('href');
            if (!href) continue;
            await page.goto(href);
            await page.waitForLoadState('domcontentloaded');
            const addBtn = page.getByRole('button', { name: /add to cart/i }).first();
            if (await addBtn.isVisible() && await addBtn.isEnabled()) {
                await addBtn.click();
                added = true;
                break;
            }
            await page.goto('/shop');
        }

        if (added) {
            await page.goto('/cart');
            await expect(
                page.getByRole('button', { name: /checkout/i }).first()
            ).toBeVisible({ timeout: 10000 });
            console.log('[QA] ✔ Customer lifecycle: cart & checkout verified.');
        } else {
            console.log('[QA] ⚠ No in-stock products found — lifecycle check skipped for cart step.');
        }

        // Orders page — heading is "My Orders" (h1)
        await page.goto('/orders');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    });
});

// ─────────────────────────────────────────
// ADMIN / SUPER ADMIN ROLE
// ─────────────────────────────────────────
test.describe('Expert QA Audit: Admin Role', () => {

    test.beforeEach(async ({ page }) => {
        await login(page, SUPER_ADMIN);
    });

    test('1. Admin: Dashboard & Management', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByText(/Dashboard|Admin Panel/i).first()).toBeVisible({ timeout: 10000 });

        await page.goto('/superadmin/features');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('h2').first()).toBeVisible({ timeout: 10000 });
        console.log('[QA] ✔ Admin dashboard and features panel verified.');
    });

    test('2. Security: RBAC Enforcement', async ({ browser }) => {
        // Register / ensure the fixed customer exists
        const setupContext = await browser.newContext();
        const setupPage = await setupContext.newPage();
        await ensureRegistered(setupPage, TEST_CUSTOMER);
        await setupContext.close();

        // Attempt to access admin as customer
        const customerContext = await browser.newContext();
        const customerPage = await customerContext.newPage();
        await login(customerPage, TEST_CUSTOMER);

        await customerPage.goto('/admin');
        await customerPage.waitForTimeout(2000);
        // Must be redirected away from /admin
        expect(customerPage.url()).not.toContain('/admin');
        console.log('[QA] ✔ RBAC: customer blocked from /admin.');

        await customerContext.close();
    });
});
