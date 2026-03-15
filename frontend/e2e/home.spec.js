// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Home', () => {
  test('loads and shows hero and shop link', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1').filter({ hasText: 'BLUE MIST PERFUMES' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /explore collection/i })).toBeVisible()
  })

  test('navigates to shop from hero button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /explore collection/i }).click()
    await expect(page).toHaveURL(/\/shop/)
  })
})
