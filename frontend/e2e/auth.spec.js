// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Auth pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
  })

  test('register page loads', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })
})
