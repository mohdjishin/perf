import { test, expect } from '@playwright/test';

test.describe('Edge Cases & Error Handling Audit', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test.describe('Authentication Edge Cases', () => {
        test('1. Login: Invalid Credentials', async ({ page }) => {
            console.log('[Edge Case] Testing login with wrong password.');
            await page.goto('/login');
            await page.fill('input[type="email"]', 'wrong@user.com');
            await page.fill('input[type="password"]', 'wrongpassword');
            await page.click('button[type="submit"]');

            // Expect exact backend error message
            const errorMsg = page.getByText('Invalid email or password').first();
            await expect(errorMsg).toBeVisible();
            console.log('✔ Correct error message displayed for invalid login.');
        });

        test('2. Registration: Duplicate Email', async ({ page }) => {
            console.log('[Edge Case] Testing registration with existing email.');
            await page.goto('/register');
            await page.fill('input[name="firstName"]', 'Duplicate');
            await page.fill('input[name="lastName"]', 'User');
            await page.fill('input[name="email"]', 'superadmin@perfume.store');
            await page.fill('input[name="password"]', 'password123');
            await page.click('button[type="submit"]');

            const errorMsg = page.getByText('Email already registered').first();
            await expect(errorMsg).toBeVisible();
            console.log('✔ Correct error message displayed for duplicate registration.');
        });
    });

    test.describe('Shop & Discovery Edge Cases', () => {
        test('1. Search: No Results', async ({ page }) => {
            console.log('[Edge Case] Testing search with zero results.');
            await page.goto('/shop');
            const searchInput = page.locator('input[placeholder*="Search"]').first();
            if (await searchInput.isVisible()) {
                await searchInput.fill('XYZNONEXISTENTPRODUCT123');
                await searchInput.press('Enter');
                await page.waitForTimeout(1000);
                // Look for common empty state indicators
                const noResults = page.getByText(/no products|nothing found|empty/i).first();
                await expect(noResults).toBeVisible();
                console.log('✔ Empty state verified for search.');
            }
        });
    });

    test.describe('Transactional Edge Cases', () => {
        test('1. Checkout: Empty Cart Prevention', async ({ page }) => {
            console.log('[Edge Case] Testing checkout with empty cart.');
            await page.goto('/checkout');
            // Should redirect away or show empty message
            await page.waitForTimeout(1000);
            const url = page.url();
            if (url.includes('/checkout')) {
                // If still on checkout, check for empty cart message
                const emptyMsg = page.getByText(/empty|no items/i).first();
                await expect(emptyMsg).toBeVisible();
            } else {
                console.log(`✔ Redirected away from checkout (current: ${url})`);
            }
        });
    });

    test.describe('Admin Form Validation', () => {
        test('1. Product Creation: Incomplete Form', async ({ page }) => {
            console.log('[Edge Case] Testing admin product creation with missing fields.');
            await page.goto('/login');
            await page.fill('input[type="email"]', 'superadmin@perfume.store');
            await page.fill('input[type="password"]', 'superadmin123');
            await page.click('button[type="submit"]');
            await page.waitForURL('**/');

            await page.goto('/admin/products');
            const addBtn = page.getByRole('button', { name: /add product/i }).first();
            if (await addBtn.isVisible()) {
                await addBtn.click();
                await page.getByRole('button', { name: /save|create|submit/i }).first().click();

                // Native validation check
                const nameInput = page.locator('input[name="name"]').first();
                const isInvalid = await nameInput.evaluate(el => !el.checkValidity());
                expect(isInvalid).toBeTruthy();
                console.log('✔ Form validation confirmed.');
            }
        });
    });

});
