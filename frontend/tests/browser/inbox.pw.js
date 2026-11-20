import { test, expect } from '@playwright/test'
import { fixtures, installMockApi } from './mockApi.js'

const stamp = () => new Date(Date.now() - 1000).toISOString()
function feedback(state, text = 'Please explain how you tested the login form.') {
  Object.assign(state.dailyReports[0], { status: 'changes_requested', feedback: text, reviewedAt: stamp(),
    reviewedBy: state.users.find((user) => user.role === 'academic_supervisor')._id, submittedAt: stamp() })
}
async function open(context, page, state = fixtures()) {
  await installMockApi(context, state)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.locator('#messages-count')).not.toContainText('Loading')
  return state
}
const icon = (page, name) => page.getByRole('button', { name, exact: true })
const panel = (page, name) => page.getByRole('dialog', { name, exact: true })

test('student feedback appears in Messages, stays unread on opening, saves read state and links to reports', async ({ context, page }) => {
  const state = fixtures(); feedback(state)
  await open(context, page, state)
  await expect(page.locator('#messages-count')).toHaveText('1 unread messages')
  await icon(page, 'Messages').click()
  await expect(panel(page, 'Messages').getByText('Teacher: Please explain how you tested the login form.', { exact: true })).toBeVisible()
  expect(state.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  await icon(page, 'Mark all read').click()
  await expect(page.locator('#messages-count')).toHaveText('0 unread messages')
  await icon(page, 'Close inbox').click()
  await page.reload()
  await expect(page.locator('#messages-count')).toHaveText('0 unread messages')
  await icon(page, 'Messages').click()
  await panel(page, 'Messages').getByRole('link').click()
  await expect(page).toHaveURL(/\/daily-reports$/)
  await expect(page.getByRole('dialog', { name: 'Messages', exact: true })).toHaveCount(0)
  expect(state.inboxRead[state.signedInUserId].messages).toBeTruthy()
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => /inbox|feedback|message/.test(key)))).toBe(false)
  expect(state.unexpected).toEqual([])
})

for (const kind of ['daily', 'weekly']) test(`${kind} report submission immediately refreshes Notifications without a page reload`, async ({ context, page }) => {
  const state = await open(context, page)
  await expect(page.locator('#notifications-count')).toHaveText('0 unread notifications')
  await page.goto(`/${kind}-reports`)
  await expect(page.getByRole('button', { name: 'Submit report', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Submit report', exact: true }).click()
  await expect(page.locator('#notifications-count')).toHaveText('1 unread notifications')
  await icon(page, 'Notifications').click()
  await expect(panel(page, 'Notifications').getByRole('heading', { name: `${kind === 'daily' ? 'Daily' : 'Weekly'} report submitted`, exact: true })).toBeVisible()
  expect(state.unexpected).toEqual([])
})

test('teacher sees assigned submitted daily reports, not student feedback or weekly notifications', async ({ context, page }) => {
  const state = fixtures('academic_supervisor')
  Object.assign(state.dailyReports[0], { status: 'submitted', submittedAt: stamp() })
  Object.assign(state.weeklyReports[0], { status: 'submitted', submittedAt: stamp() })
  await open(context, page, state)
  await expect(page.locator('#messages-count')).toHaveText('0 unread messages')
  await expect(page.locator('#notifications-count')).toHaveText('1 unread notifications')
  await icon(page, 'Notifications').click()
  await expect(panel(page, 'Notifications').getByRole('link')).toHaveCount(1)
  await panel(page, 'Notifications').getByRole('link').click()
  await expect(page).toHaveURL(/\/daily-reports$/)
  expect(state.unexpected).toEqual([])
})

test('visible accounts poll for new teacher feedback and account switching never retains the previous inbox', async ({ context, page }) => {
  await page.clock.install()
  const state = await open(context, page)
  await expect(page.locator('#messages-count')).toHaveText('0 unread messages')
  feedback(state, 'New feedback from your teacher.')
  await page.clock.fastForward(31000)
  await expect(page.locator('#messages-count')).toHaveText('1 unread messages')
  state.signedInUserId = state.users.find((user) => user.role === 'academic_supervisor')._id
  state.role = 'academic_supervisor'
  await page.reload()
  await expect(page.locator('#messages-count')).toHaveText('0 unread messages')
  await icon(page, 'Messages').click()
  await expect(panel(page, 'Messages').getByText('No messages yet.', { exact: true })).toBeVisible()
  await expect(panel(page, 'Messages')).not.toContainText('New feedback from your teacher.')
  expect(state.unexpected).toEqual([])
})

test('marking a displayed snapshot read does not clear feedback arriving during the request', async ({ context, page }) => {
  const state = fixtures(); feedback(state)
  await open(context, page, state)
  await icon(page, 'Messages').click()
  await expect(icon(page, 'Mark all read')).toBeEnabled()
  let release
  state.holdWrites = new Promise((resolve) => { release = resolve })
  await icon(page, 'Mark all read').click()
  await expect.poll(() => state.calls.filter((call) => call.path === '/inbox/read').length).toBe(1)
  await expect(icon(page, 'Mark all read')).toBeDisabled()
  state.dailyReports.push({ ...state.dailyReports[0], _id: '000000000000000000000061', feedback: 'Newer feedback during the request.', reviewedAt: new Date().toISOString() })
  release(); state.holdWrites = null
  await expect(page.locator('#messages-count')).toHaveText('1 unread messages')
  await expect(panel(page, 'Messages')).toContainText('Newer feedback during the request.')
  expect(state.unexpected).toEqual([])
})

test('read failures retain unread badges and retryable load errors never pretend the inbox is empty', async ({ context, page }) => {
  const state = fixtures(); feedback(state)
  await open(context, page, state)
  await icon(page, 'Messages').click()
  state.failures.push({ method: 'PATCH', path: '/inbox/read', status: 500, message: 'Read status unavailable.' })
  await icon(page, 'Mark all read').click()
  await expect(panel(page, 'Messages').getByRole('alert')).toContainText('Read status unavailable.')
  await expect(page.locator('#messages-count')).toHaveText('1 unread messages')
  state.failures.push({ method: 'GET', path: '/inbox', status: 500, message: 'Inbox is unavailable.' })
  await icon(page, 'Refresh inbox').click()
  await expect(panel(page, 'Messages')).toContainText('Inbox is unavailable.')
  await expect(panel(page, 'Messages')).not.toContainText('No messages yet.')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(panel(page, 'Messages')).toContainText('Please explain how you tested the login form.')
  expect(state.unexpected).toEqual([])
})

test('expired inbox sessions sign out instead of keeping private activity visible', async ({ context, page }) => {
  const state = fixtures(); feedback(state)
  await open(context, page, state)
  state.failures.push({ method: 'GET', path: '/inbox', status: 401 })
  await icon(page, 'Messages').click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('dialog', { name: 'Messages', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
})

test('inbox panels fit mobile and desktop in both themes, scroll internally and support keyboard dismissal', async ({ context, page }, testInfo) => {
  const state = fixtures(); feedback(state, 'LongFeedback'.repeat(80))
  const occurredAt = stamp()
  state.inboxFeeds = { [state.signedInUserId]: { messages: [], notifications: Array.from({ length: 8 }, (_, index) => ({
    id: `evaluation-recorded:${(index + 100).toString(16).padStart(24, '0')}:${Date.parse(occurredAt)}`, title: 'Academic evaluation recorded',
    body: 'A final evaluation is available. '.repeat(12), href: '/evaluations', occurredAt,
  })) } }
  await open(context, page, state)
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = icon(page, 'Dark mode')
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      for (const title of ['Messages', 'Notifications']) {
        await icon(page, title).click()
        const dialog = panel(page, title)
        await expect(dialog.getByRole('link').first()).toBeVisible()
        const bounds = await dialog.boundingBox()
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.y).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(width === 320 ? 568 : 1000)
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
        for (let count = 0; count < 7; count++) {
          await page.keyboard.press('Tab')
          // Native modal focus may move to browser chrome, but never to the inert page.
          expect(await dialog.evaluate((element) => document.activeElement === document.body || element.contains(document.activeElement))).toBe(true)
        }
        await page.mouse.move(0, 0)
        await page.screenshot({ path: testInfo.outputPath(`inbox-${title.toLowerCase()}-${width}-${theme}.png`), animations: 'disabled' })
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expect(icon(page, title)).toBeFocused()
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
      }
    }
  }
  expect(state.unexpected).toEqual([])
})
