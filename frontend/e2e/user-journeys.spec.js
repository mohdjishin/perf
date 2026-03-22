import { test, expect } from '@playwright/test';

// Roles and Credentials
const SUPER_ADMIN = { email: 'superadmin@perfume.store', password: 'superadmin123' };
const JOURNEY_CUSTOMER = {
    email: `journey_user_${Date.now()}@perfume.store`,
    password: 'password123',
    firstName: 'John',
    lastName: 'Journey'
};

test.describe('E2E User Journeys: Real-world Stories', () => {

    test('1. The Explorer (Guest Journey)', async ({ page }) => {
        console.log('[Journey] Starting Guest Explorer journey.');
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const shopNow = page.getByRole('link', { name: /shop|explore|collection/i }).first();
        await shopNow.click();

        await expect(page).toHaveURL(/.*shop/);
        const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('Perfume');
            await searchInput.press('Enter');
        }

        const firstProduct = page.locator('a[href*="/product/"]').first();
        await expect(firstProduct).toBeVisible();
        await firstProduct.click();

        await expect(page.locator('h1')).toBeVisible();
        const loginToAdd = page.getByRole('link', { name: /login to add/i }).first();
        await expect(loginToAdd).toBeVisible();

        await page.goto('/checkout');
        await expect(page).toHaveURL(/.*login/);
        console.log('[Journey] Guest Explorer journey concluded correctly.');
    });

    test('2. The Shopper (Customer Journey)', async ({ page }) => {
        console.log('[Journey] Starting Customer Shopper journey.');

        // Registration
        await page.goto('/register');
        await page.fill('input[name="firstName"]', JOURNEY_CUSTOMER.firstName);
        await page.fill('input[name="lastName"]', JOURNEY_CUSTOMER.lastName);
        await page.fill('input[name="email"]', JOURNEY_CUSTOMER.email);
        await page.fill('input[name="password"]', JOURNEY_CUSTOMER.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        await page.waitForURL('**/');

        // Shop - Find in-stock product
        await page.goto('/shop');
        await page.waitForLoadState('networkidle');

        // Find links to products as they might have "Out of Stock" badges nearby
        const productLinks = page.locator('a[href*="/product/"]');
        const count = await productLinks.count();
        let foundStock = false;

        for (let i = 0; i < Math.min(count, 5); i++) {
            await productLinks.nth(i).click();
            await page.waitForLoadState('domcontentloaded');

            const addToCartBtn = page.getByRole('button', { name: /add to cart/i }).first();
            if (await addToCartBtn.isVisible() && await addToCartBtn.isEnabled()) {
                await addToCartBtn.click();
                foundStock = true;
                break;
            } else {
                console.log(`[QA] Product ${i} is out of stock or button not clickable, returning to shop.`);
                await page.goto('/shop');
            }
        }

        if (foundStock) {
            await page.goto('/cart');
            const checkoutBtn = page.getByRole('button', { name: /checkout/i }).first();
            await expect(checkoutBtn).toBeVisible();
            await checkoutBtn.click();
            await expect(page).toHaveURL(/.*checkout/);
        } else {
            console.log('[QA] Warning: No in-stock products found to complete shopper journey.');
        }

        await page.goto('/orders');
        await expect(page.getByText(/Order History|My Orders/i).first()).toBeVisible();
        console.log('[Journey] Customer Shopper journey completed.');
    });

    test('3. The Merchant (Admin Journey)', async ({ page }) => {
        console.log('[Journey] Starting Merchant Admin journey.');
        await page.goto('/login');
        await page.fill('input[type="email"]', SUPER_ADMIN.email);
        await page.fill('input[type="password"]', SUPER_ADMIN.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/');

        await page.goto('/admin');
        await expect(page.getByText(/Dashboard|Admin Panel/i).first()).toBeVisible();

        await page.goto('/admin/products');
        const addBtn = page.getByRole('button', { name: /add product/i }).first();
        await addBtn.click();

        // Form field presence (IDs as seen in source)
        await expect(page.locator('#product-name')).toBeVisible();
        await expect(page.locator('#product-price')).toBeVisible();

        await page.goto('/superadmin/features');
        await expect(page.locator('h2').first()).toBeVisible();
        console.log('[Journey] Merchant Admin journey completed.');
    });

});
