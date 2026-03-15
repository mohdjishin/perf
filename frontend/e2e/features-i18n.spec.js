// @ts-check
/**
 * E2E: Multi-language feature toggle (Super Admin).
 * Requires backend and frontend running. Uses super admin: superadmin@perfume.store / superadmin123
 */
import { test, expect } from '@playwright/test'

const SUPER_ADMIN_EMAIL = 'superadmin@perfume.store'
const SUPER_ADMIN_PASSWORD = 'superadmin123'

async function loginAsSuperAdmin(page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(SUPER_ADMIN_EMAIL)
  await page.getByPlaceholder(/password/i).fill(SUPER_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await expect(page).toHaveURL(/\/(admin|superadmin)?$/, { timeout: 10000 })
}

test.describe('Multi-language feature (i18n)', () => {
  test('super admin can turn i18n off and language switcher hides', async ({ page }) => {
    await loginAsSuperAdmin(page)
    await page.goto('/superadmin/features')
    await expect(page.getByRole('heading', { name: /features/i })).toBeVisible({ timeout: 10000 })

    // Multi-language section: uncheck "Show language switcher..."
    const i18nCheckbox = page.getByRole('checkbox', { name: /show language switcher|arabic.*rtl/i })
    await expect(i18nCheckbox).toBeVisible()
    if (await i18nCheckbox.isChecked()) {
      await i18nCheckbox.click()
    }
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/settings saved|saved/i)).toBeVisible({ timeout: 5000 })

    // Navbar: language switcher should be gone (no EN / عربي)
    await page.goto('/')
    await expect(page.getByRole('link', { name: /explore collection/i })).toBeVisible({ timeout: 10000 })
    const enButton = page.getByRole('button', { name: 'English' })
    const arButton = page.getByRole('button', { name: /العربية|arabic/i })
    await expect(enButton).not.toBeVisible()
    await expect(arButton).not.toBeVisible()
  })

  test('super admin can turn i18n on and language switcher appears', async ({ page }) => {
    await loginAsSuperAdmin(page)
    await page.goto('/superadmin/features')
    await expect(page.getByRole('heading', { name: /features/i })).toBeVisible({ timeout: 10000 })

    const i18nCheckbox = page.getByRole('checkbox', { name: /show language switcher|arabic.*rtl/i })
    await expect(i18nCheckbox).toBeVisible()
    if (!(await i18nCheckbox.isChecked())) {
      await i18nCheckbox.click()
    }
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/settings saved|saved/i)).toBeVisible({ timeout: 5000 })

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible({ timeout: 10000 })
  })

  test('when i18n is off, admin product form does not show Arabic fields', async ({ page }) => {
    await loginAsSuperAdmin(page)
    // Ensure i18n is off
    await page.goto('/superadmin/features')
    const i18nCheckbox = page.getByRole('checkbox', { name: /show language switcher|arabic.*rtl/i })
    if (await i18nCheckbox.isChecked()) {
      await i18nCheckbox.click()
      await page.getByRole('button', { name: /save/i }).click()
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 })
    }

    await page.goto('/admin/products')
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /add product|new product/i }).click()
    await expect(page.getByLabel(/name.*english|product name/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/name.*arabic/i)).not.toBeVisible()
    await expect(page.getByLabel(/description.*arabic/i)).not.toBeVisible()
  })

  test('when i18n is on, admin product form shows Arabic fields', async ({ page }) => {
    await loginAsSuperAdmin(page)
    await page.goto('/superadmin/features')
    const i18nCheckbox = page.getByRole('checkbox', { name: /show language switcher|arabic.*rtl/i })
    if (!(await i18nCheckbox.isChecked())) {
      await i18nCheckbox.click()
      await page.getByRole('button', { name: /save/i }).click()
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 })
    }

    await page.goto('/admin/products')
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /add product|new product/i }).click()
    await expect(page.getByLabel(/name.*arabic/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/description.*arabic/i)).toBeVisible()
  })
})
