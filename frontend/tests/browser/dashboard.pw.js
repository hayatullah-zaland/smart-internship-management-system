import { expect, test } from '@playwright/test'
import { dashboardFields } from '../../src/context/dashboardApi.js'
import { fixtures, installMockApi, roles, routes } from './mockApi.js'

const values = (role, number) => Object.fromEntries(dashboardFields[role].map((key) => [key, number]))
async function ready(page) {
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'At a glance', exact: true })).toHaveAttribute('aria-busy', 'false')
}

for (const role of roles) {
  test(role + ': dashboard fits both themes, shows actual counts and opens a permitted shortcut', async ({ context, page }, testInfo) => {
    const state = fixtures(role)
    state.dashboardStats = values(role, 12)
    if (role === 'student') state.dashboardStats.weeklyReports = 3
    else if (role === 'academic_supervisor') state.dashboardStats.submittedWeeklyReports = 3
    else state.dashboardStats.completedInternships = 3
    await installMockApi(context, state)
    await page.goto('/dashboard')
    await ready(page)
    await expect(page.locator('.dashboard-stat')).toHaveCount(dashboardFields[role].length)
    const quickAccess = page.getByRole('navigation', { name: 'Quick access', exact: true })
    for (const link of await quickAccess.getByRole('link').all()) {
      expect(routes[role]).toContain(await link.getAttribute('href'))
    }
    const bars = page.locator('.dashboard-meter')
    expect(await bars.nth(0).getAttribute('style')).toContain('width: 100%')
    expect(await bars.nth(1).getAttribute('style')).toContain('width: 25%')
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
        if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
        await page.mouse.move(0, 0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
        const invalid = await page.locator('main').evaluate((main) => [...main.querySelectorAll('*')].filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width && (rect.left < -1 || rect.right > innerWidth + 1)
        }).map((element) => element.tagName + '.' + element.className))
        expect(invalid).toEqual([])
        await page.screenshot({ path: testInfo.outputPath(role + '-' + width + '-' + theme + '.png'), fullPage: true, animations: 'disabled' })
      }
    }
    await quickAccess.getByRole('link').first().click()
    await expect(page).not.toHaveURL(/\/dashboard$/)
    expect(state.unexpected).toEqual([])
  })
}

test('refresh replaces all values, failures never leave stale charts and retry recovers', async ({ context, page }) => {
  const state = fixtures('admin')
  state.dashboardStats = values('admin', 20)
  await installMockApi(context, state)
  await page.goto('/dashboard')
  await ready(page)
  await expect(page.locator('.dashboard-stat dd').first()).toHaveText('20')
  state.dashboardStats = values('admin', 0)
  await page.getByRole('button', { name: 'Refresh dashboard statistics', exact: true }).click()
  await expect(page.locator('.dashboard-stat dd').first()).toHaveText('0')
  await expect(page.getByText('No active or completed internships yet.', { exact: true })).toBeVisible()
  for (const bar of await page.locator('.dashboard-meter').all()) expect(await bar.getAttribute('style')).toContain('width: 0%')
  state.failures.push({ path: '/dashboard/stats', status: 503, persistent: true })
  await page.getByRole('button', { name: 'Refresh dashboard statistics', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load summary')
  await expect(page.locator('.dashboard-stat, .dashboard-meter')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Quick access', exact: true })).toBeVisible()
  state.failures = []
  state.dashboardStats = values('admin', 7)
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.dashboard-stat dd').first()).toHaveText('7')
  await expect(page.locator('.dashboard-meter')).toHaveCount(2)
  state.failures.push({ path: '/dashboard/stats', status: 401 })
  await page.getByRole('button', { name: 'Refresh dashboard statistics', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
})

test('slow loading has no fake zeros and animations respect reduced motion', async ({ context, page }) => {
  const state = fixtures()
  let release
  state.holdDashboard = new Promise((resolve) => { release = resolve })
  await installMockApi(context, state)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  try {
    await page.goto('/dashboard')
    await expect(page.getByRole('status').filter({ hasText: 'Loading dashboard statistics' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh dashboard statistics', exact: true })).toBeDisabled()
    await expect(page.locator('.dashboard-stat dd, .dashboard-meter')).toHaveCount(0)
  } finally { release() }
  await ready(page)
  await expect(page.locator('.dashboard-stat').first()).toHaveCSS('animation-name', 'dashboard-enter')
  await expect(page.locator('.dashboard-meter').first()).toHaveCSS('animation-name', 'dashboard-meter')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const element of await page.locator('.dashboard-enter, .dashboard-meter').all()) {
    await expect(element).toHaveCSS('animation-name', 'none')
    await expect(element).toHaveCSS('transform', 'none')
  }
  await expect(page.locator('.dashboard-stat').first()).toHaveCSS('transition-duration', '0s')
})

test('long names, maximum counters and account anchor remain usable on narrow screens', async ({ context, page }) => {
  const state = fixtures('company_representative')
  const user = state.users.find((user) => user.role === state.role)
  user.name = 'LongName'.repeat(12)
  user.email = 'a'.repeat(64) + '@' + 'company'.repeat(8) + '.test'
  state.dashboardStats = values(state.role, Number.MAX_SAFE_INTEGER)
  await installMockApi(context, state)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/dashboard#account')
  await ready(page)
  await expect(page.locator('#account')).toBeFocused()
  await expect(page.locator('.dashboard-stat dd').first()).toHaveAttribute('aria-label', '9,007,199,254,740,991')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await page.getByRole('link', { name: 'Edit account', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(user.name)
})
