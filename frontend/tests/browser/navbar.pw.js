import { test, expect } from '@playwright/test'
import { fixtures, installMockApi, roles } from './mockApi.js'

const search = (page) => page.getByRole('combobox', { name: 'Search workspace pages', exact: true })
async function open(context, page, role = 'student') {
  const state = fixtures(role)
  await installMockApi(context, state)
  await page.goto('/dashboard')
  await expect(page.locator('main h1')).toHaveText('Dashboard')
  return state
}

for (const role of roles) test(`${role}: navbar searches only accessible pages and opens the selected destination`, async ({ context, page }) => {
  const state = await open(context, page, role)
  const input = search(page)
  await input.fill('reports')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  const labels = role === 'company_representative' ? [] : role === 'academic_supervisor' ? ['Daily reports'] : ['Daily reports', 'Weekly reports']
  await expect(page.getByRole('option')).toHaveText(labels)
  if (!labels.length) await expect(page.getByRole('status').filter({ hasText: 'No matching pages.' })).toBeVisible()
  await input.fill('users')
  await expect(page.getByRole('option', { name: 'Users', exact: true })).toHaveCount(role === 'admin' ? 1 : 0)
  await input.fill('password')
  await expect(page.getByRole('option', { name: 'Settings', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.locator('main h1')).toHaveText('Settings')
  await expect(search(page)).toHaveValue('')
  expect(state.unexpected).toEqual([])
  expect(state.calls.every((call) => call.method === 'GET')).toBe(true)
})

test('search supports arrows, Enter, Escape, clear and outside dismissal without saving queries', async ({ context, page }) => {
  const state = await open(context, page, 'admin')
  const input = search(page)
  await input.fill('reports')
  await input.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Daily reports', exact: true })).toHaveAttribute('aria-selected', 'true')
  await input.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'Weekly reports', exact: true })).toHaveAttribute('aria-selected', 'true')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/weekly-reports$/)
  await expect(page.locator('main h1')).toHaveText('Weekly reports')
  await search(page).fill('settings')
  await search(page).press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(search(page)).toHaveValue('settings')
  await search(page).click()
  await expect(page.getByRole('option', { name: 'Settings', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await expect(search(page)).toHaveValue('')
  await expect(search(page)).toBeFocused()
  await search(page).fill('Nothing matches this query')
  await search(page).press('Enter')
  await expect(page).toHaveURL(/\/weekly-reports$/)
  await expect(page.getByRole('status').filter({ hasText: 'No matching pages.' })).toBeVisible()
  await page.locator('main h1').click()
  await expect(search(page)).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) => /Nothing matches this query/.test(value)))).toBe(false)
  expect(state.unexpected).toEqual([])
})

test('keyboard selection scrolls the last result into view and a changed account discards its search', async ({ context, page }) => {
  const state = await open(context, page, 'admin')
  await search(page).fill('e')
  const count = await page.getByRole('option').count()
  expect(count).toBeGreaterThan(6)
  for (let index = 0; index < count; index++) await search(page).press('ArrowDown')
  const last = page.getByRole('option').last()
  await expect(last).toHaveAttribute('aria-selected', 'true')
  const list = await page.getByRole('listbox').boundingBox()
  const row = await last.boundingBox()
  expect(row.y).toBeGreaterThanOrEqual(list.y)
  expect(row.y + row.height).toBeLessThanOrEqual(list.y + list.height)
  state.role = 'student'
  state.signedInUserId = state.users.find((user) => user.role === 'student')._id
  await page.reload()
  await expect(search(page)).toHaveValue('')
  await search(page).fill('users')
  await expect(page.getByRole('option')).toHaveCount(0)
  expect(state.unexpected).toEqual([])
})

for (const role of roles) test(`${role}: refreshed navbar fits all breakpoints and both themes with a long identity`, async ({ context, page }, testInfo) => {
  test.setTimeout(90000)
  const state = await open(context, page, role)
  const user = state.users.find((record) => record._id === state.signedInUserId)
  user.name = 'LongAccountName'.repeat(6)
  await page.reload()
  const profile = page.getByRole('link', { name: 'Open my account', exact: true })
  for (const width of [320, 375, 640, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      await expect(profile).toContainText(user.name)
      await expect(profile).toHaveAttribute('title', new RegExp(user.name))
      await expect(profile.locator('span[aria-hidden="true"] > span').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const boxes = await page.locator('.navbar-heading, .navbar-search, .navbar-clock, .navbar-tools, .navbar-account').evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width }
      }))
      expect(boxes.every((box) => box.width > 0 && box.x >= 0 && box.right <= width)).toBe(true)
      for (let first = 0; first < boxes.length; first++) for (let second = first + 1; second < boxes.length; second++) {
        const a = boxes[first], b = boxes[second]
        expect(a.x < b.right - 1 && a.right > b.x + 1 && a.y < b.bottom - 1 && a.bottom > b.y + 1).toBe(false)
      }
      expect((await page.locator('header').boundingBox()).height).toBeLessThanOrEqual(176)
      expect((await search(page).boundingBox()).width).toBeGreaterThan(100)
      await search(page).fill('e')
      const results = await page.locator('.navbar-search-results').boundingBox()
      expect(results.x).toBeGreaterThanOrEqual(0)
      expect(results.x + results.width).toBeLessThanOrEqual(width)
      if ([320, 1440, 1920].includes(width)) {
        await page.mouse.move(0, 0)
        await page.screenshot({ path: testInfo.outputPath(`navbar-${role}-${width}-${theme}.png`), animations: 'disabled', timeout: 20000 })
      }
      await search(page).press('Escape')
      await search(page).fill('')
    }
  }
  await profile.click()
  await expect(page).toHaveURL(/\/account$/)
  expect(state.unexpected).toEqual([])
})
