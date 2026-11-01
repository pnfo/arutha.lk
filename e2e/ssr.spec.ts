import { expect, test } from '@playwright/test'

test.use({ javaScriptEnabled: false })

test('pages are readable without JS (crawlers)', async ({ page }) => {
  await page.goto('/love')
  await expect(page.locator('#ssr h1')).toHaveText('love')
  await expect(page.locator('#ssr')).toContainText('ආදරය')
  await expect(page).toHaveTitle(/love meaning in Sinhala/)
  await page.goto('/bookpage/sankshiptha/1')
  await expect(page.locator('#ssr h1')).toContainText('සංක්ෂිප්ත')
})

test('v1 links redirect', async ({ page }) => {
  await page.goto('/search/love.')
  await expect(page).toHaveURL(/\/love$/)
  await page.goto('/bookpage/akshara/7')
  await expect(page).toHaveURL(/\/bookpage\/akshara_vinyasa\/7$/)
})
