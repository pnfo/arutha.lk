import { expect, test } from '@playwright/test'

test('theme and text size', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/) // index.html sets it before the app
  await page.getByTestId('text-size').fill('24')
  await expect(page.locator('html')).toHaveAttribute('style', /--text-size: 24px/)
})

test('a dictionary can be hidden', async ({ page }) => {
  await page.goto('/settings')
  const es = page.getByTestId('dict-setting').filter({ hasText: 'ඉංග්‍රීසි සිංහල' })
  await es.getByRole('checkbox').uncheck()
  await page.goto('/love')
  // love is only in the hidden dictionary: the page says so
  await expect(page.getByTestId('hidden-dicts')).toBeVisible()
  await expect(page.locator('[data-dict="english-sinhala"]')).toHaveCount(0)
})

test('v1 bookmarks and settings are migrated', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('arutha-migrated-1')) return
    localStorage.setItem('bookmarks', JSON.stringify({ '0-ධර්මය': { time: 1, coll: 'dict', entry: { dict: 0, word: 'ධර්මය' } } }))
    localStorage.setItem('settings', JSON.stringify({ darkMode: true, fontSize: 2, dicts: [0, 1] }))
    localStorage.setItem('theme', 'dark')
  })
  await page.goto('/bookmarks')
  await expect(page.getByTestId('bookmarks-page')).toContainText('ධර්මය')
  await expect(page.locator('html')).toHaveClass(/dark/)
})
