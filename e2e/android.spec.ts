/**
 * The offline app build (web/dist-app, hash routing, relative paths) with a simulated native bridge:
 * window.AruthaNative.query(id, request) is answered asynchronously through window.__aruthaResolve, here by
 * forwarding the request to the engine over HTTP from the test runner (dev-docs/native-bridge.md).
 */
import { expect, test, type Page } from '@playwright/test'
import { APP, SERVER } from './playwright.config'

async function withBridge(page: Page) {
  const apiCalls: string[] = []
  page.on('request', r => { if (r.url().includes('/api/')) apiCalls.push(r.url()) })
  await page.exposeFunction('__nativeQuery', async (request: string) => {
    const { op, ...params } = JSON.parse(request)
    const res = await fetch(`${SERVER}/api/${op}?${new URLSearchParams(params)}`)
    const body = await res.json()
    return JSON.stringify(res.ok ? { ok: body } : body)
  })
  await page.addInitScript(() => {
    const w = window as unknown as { AruthaNative: unknown; __nativeQuery: (r: string) => Promise<string>; __aruthaResolve: (id: string, r: string) => void }
    w.AruthaNative = { query: (id: string, request: string) => { w.__nativeQuery(request).then(r => setTimeout(() => w.__aruthaResolve(id, r), 5)) } }
  })
  return apiCalls
}

test('searches and opens words through the bridge', async ({ page }) => {
  const apiCalls = await withBridge(page)
  await page.goto(`${APP}/index.html#/search/buddhassa`)
  await expect(page.getByTestId('result').first()).toContainText('බුද්ධ')
  await page.goto(`${APP}/index.html#/love`)
  await expect(page.getByTestId('word-title')).toHaveText('love')
  await page.getByTestId('search-input').fill('lo')
  await expect(page.getByTestId('search-menu')).toBeVisible()
  expect(apiCalls).toEqual([]) // the page itself never used the network api
})
