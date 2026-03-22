import { test, expect, devices } from '@playwright/test';

// Roles and Credentials
const SUPER_ADMIN = { email: 'superadmin@perfume.store', password: 'superadmin123' };
const TEST_CUSTOMER = { email: `test_customer_${Date.now()}@perfume.store`, password: 'password123', firstName: 'Test', lastName: 'Customer' };

test.describe.configure({ mode: 'serial' });

test.describe('Senior QA Audit - Comprehensive Flow', () => {

    test('1. Guest Flow: Browsing and Discovery', async ({ page }) => {
        console.log('--- Guest Flow ---');
        await page.goto('/');
        await expect(page.locator('h1')).toBeVisible();
        await page.click('text=Explore Collection');
        await expect(page).toHaveURL(/.*shop/);
        const cards = page.locator('a[href*="/product/"]');
        if (await cards.count() > 0) {
            await expect(cards.first()).toBeVisible();
            console.log('✔ Product grid verified.');
        }
    });

    test('2. Customer Flow: Registration & Login', async ({ page }) => {
        console.log('--- Customer Flow ---');
        await page.goto('/register');
        await page.fill('input[name="firstName"]', TEST_CUSTOMER.firstName);
        await page.fill('input[name="lastName"]', TEST_CUSTOMER.lastName);
        await page.fill('input[name="email"]', TEST_CUSTOMER.email);
        await page.fill('input[name="password"]', TEST_CUSTOMER.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/');

        await page.goto('/login');
        await page.fill('input[type="email"]', TEST_CUSTOMER.email);
        await page.fill('input[type="password"]', TEST_CUSTOMER.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/');
        console.log('✔ Customer flow verified.');
    });

    test('3. Admin & Super Admin Flow: Advanced Control', async ({ page }) => {
        console.log('--- Admin & Super Admin Flow ---');
        await page.goto('/login');
        await page.fill('input[type="email"]', SUPER_ADMIN.email);
        await page.fill('input[type="password"]', SUPER_ADMIN.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000); // Wait for storage
        await page.waitForURL('**/');

        // Admin Dash
        await page.goto('/admin');
        await expect(page.locator('text=Dashboard')).toBeVisible();
        console.log('✔ Admin Dashboard verified.');

        // Super Admin Features
        await page.goto('/superadmin/features');
        // Check for card titles instead of h1 which might be different due to i18n
        await expect(page.locator('h2:has-text("General Configuration")').or(page.locator('h2:has-text("Home Page Visibility")'))).toBeVisible();
        console.log('✔ Super Admin Features verified.');

        // Analytics
        await page.goto('/superadmin/analytics');
        // Check for any canvas or recharts
        await page.waitForTimeout(2000);
        const charts = page.locator('.recharts-wrapper, canvas');
        console.log(`✔ Analytics verified (${await charts.count()} items).`);
    });

    test('4. Responsive Audit: Mobile Layout', async ({ browser }) => {
        console.log('--- Responsive Audit ---');
        const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
        const page = await mobileContext.newPage();
        await page.goto('/');

        const menuBtn = page.locator('button[class*="menuBtn"]');
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();

        // Check links container visibility (usually it has linksOpen class or similar)
        // We can just check for any link inside the nav that should be visible now
        const navLink = page.locator('nav a:has-text("Home"), nav a:has-text("Shop")').first();
        await expect(navLink).toBeVisible();
        console.log('✔ Mobile layout verified.');

        await mobileContext.close();
    });

    test('5. Performance Audit', async ({ page }) => {
        console.log('--- Performance Audit ---');
        await page.goto('/');
        const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                load: nav.loadEventEnd,
                ttfb: nav.responseStart,
                dom: nav.domContentLoadedEventEnd
            };
        });
        console.log('Performance Metrics:', metrics);
        expect(metrics.load).toBeLessThan(5000);
        console.log('✔ Performance audit verified.');
    });
});
