// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Shop', () => {
  test('loads shop page', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByPlaceholder(/search/i)).toBeVisible({ timeout: 15000 })
  })

  test('has refine or filter', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByRole('button', { name: /refine/i })).toBeVisible({ timeout: 15000 })
  })
})
