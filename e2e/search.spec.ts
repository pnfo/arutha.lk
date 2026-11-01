import { expect, test } from '@playwright/test'

const enc = encodeURIComponent

test('suggestions lead to the word page', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('search-input').fill('lo')
  const menu = page.getByTestId('search-menu')
  const love = menu.getByRole('option', { name: 'love Eng', exact: true })
  await expect(love).toBeVisible()
  await love.click()
  await expect(page).toHaveURL(/\/love$/)
  await expect(page.getByTestId('word-title')).toHaveText('love')
  await expect(page.getByTestId('dict-entries').first()).toContainText('ආදරය')
})

test('Enter searches; a Pali inflected form finds its headword with DPD', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('search-input').fill('buddhassa')
  await page.getByTestId('search-input').press('Enter')
  await expect(page).toHaveURL(/\/search\/buddhassa$/)
  await expect(page.getByTestId('dpd-analysis')).toContainText('dat sg')
  const first = page.getByTestId('result').first()
  await expect(first).toContainText('බුද්ධ')
  await expect(first).toContainText('පාලි විභක්ති රූපය')
})

test('cross references open the word, back returns', async ({ page }) => {
  await page.goto('/love')
  await page.getByTestId('dict-entries').locator('a[data-dict]').first().click()
  await expect(page).toHaveURL(new RegExp(enc('ආදරය')))
  await expect(page.getByTestId('word-title')).toHaveText('ආදරය')
  await page.goBack()
  await expect(page.getByTestId('word-title')).toHaveText('love')
})

test('abbreviations explain themselves', async ({ page }) => {
  await page.goto('/love')
  await page.locator('abbr[data-a="n."]').first().click()
  await expect(page.getByTestId('abbr-popover')).toContainText('Noun')
})

test('Singlish and the reverse lookup in meanings', async ({ page }) => {
  await page.goto('/search/akuru')
  await expect(page.getByTestId('result').first()).toContainText('අකුරු')
  await page.goto('/search/' + enc('අම්මා'))
  await expect(page.getByText('තේරුමේ ඇති වචනය').first()).toBeVisible()
})

test('bookmarks and history', async ({ page }) => {
  await page.goto('/' + enc('ධර්මය'))
  await page.getByTestId('bookmark').click()
  await page.goto('/bookmarks')
  await expect(page.getByTestId('bookmarks-page')).toContainText('ධර්මය')
  await page.goto('/history')
  await expect(page.getByTestId('history-page')).toContainText('ධර්මය')
})

test('book pages and the Pali dictionary page', async ({ page }) => {
  await page.goto('/bookpage/sankshiptha/2')
  await expect(page.getByTestId('browse-page')).toContainText('පිටුව 2')
  await page.goto('/dict/pali')
  await expect(page.getByTestId('dict-page')).toContainText('Pali Sinhala Dictionary')
  await expect(page.getByTestId('dict-about')).toContainText('පුණ්‍යානුමෝදනා')
  await page.goto('/dict/si-buddhadatta')
  await page.getByTestId('dict-about').locator('summary').click()
  await expect(page.getByTestId('dict-about')).toContainText('1 මැයි 1950')
})
