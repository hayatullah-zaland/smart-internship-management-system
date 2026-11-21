import { test, expect } from '@playwright/test'
import { fixtures, installMockApi } from './mockApi.js'

async function ready(page) {
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('main .loading')).toHaveCount(0)
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
}

async function signInAs(page, role) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email address', { exact: true }).fill(`${role}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await ready(page)
}

async function decide(page, status, reason = '') {
  await page.locator('summary').filter({ hasText: 'Review application' }).click()
  const form = page.getByRole('form', { name: 'Application decision', exact: true })
  await form.getByLabel('Decision', { exact: true }).selectOption(status)
  if (status === 'rejected') await form.getByLabel('Rejection reason', { exact: true }).fill(reason)
  await form.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: `Application marked as ${status}` })).toBeVisible()
  await ready(page)
}

test('admin can approve the same application after two explicit student resubmissions', async ({ context, page }) => {
  test.setTimeout(90000)
  const state = fixtures('admin')
  state.applications = state.applications.slice(0, 1)
  const record = state.applications[0]
  const originalId = record._id
  const originalDate = record.createdAt
  await installMockApi(context, state)
  await page.setViewportSize({ width: 375, height: 900 })
  for (let round = 1; round <= 2; round += 1) {
    await page.goto('/admin/applications')
    await ready(page)
    await decide(page, 'rejected', `Correct the requirements for round ${round}.`)
    await expect(page.locator('summary').filter({ hasText: 'Review application' })).toHaveCount(0)
    await signInAs(page, 'student')
    await page.goto('/applications')
    await ready(page)
    await expect(page.locator('main')).toContainText(`Correct the requirements for round ${round}.`)
    const apply = page.getByRole('button', { name: `Apply again for ${state.opportunities[0].title}`, exact: true })
    let release
    state.holdWrites = new Promise((resolve) => { release = resolve })
    try {
      await apply.click()
      await expect.poll(() => state.calls.filter((call) => call.method === 'POST' && call.path === '/applications').length).toBe(round)
      await expect(page.getByRole('button', { name: `Applying for ${state.opportunities[0].title}`, exact: true })).toBeDisabled()
      expect(record.status).toBe('rejected')
    } finally { release(); state.holdWrites = null }
    await ready(page)
    await expect(apply).toHaveCount(0)
    await expect(page.locator('main')).toContainText('Pending')
    await expect(page.locator('main')).not.toContainText('Rejection reason')
    expect(record).toMatchObject({ _id: originalId, status: 'pending', reviewedAt: null, reviewedBy: null, rejectionReason: '', createdAt: originalDate })
    expect(state.applications).toHaveLength(1)
    await signInAs(page, 'admin')
    await page.goto('/admin/applications?status=pending')
    await ready(page)
    await expect(page.getByRole('heading', { name: state.opportunities[0].title, exact: true })).toBeVisible()
  }
  await decide(page, 'approved')
  expect(record.status).toBe('approved')
  await signInAs(page, 'student')
  await page.goto('/applications')
  await ready(page)
  await expect(page.locator('main')).toContainText('Approved')
  await expect(page.getByRole('button', { name: /^Apply again for/ })).toHaveCount(0)
  expect(state.unexpected).toEqual([])
})

test('the ordinary opportunity Apply action also resubmits a rejection without creating another record', async ({ context, page }) => {
  const state = fixtures()
  state.applications = state.applications.slice(0, 1)
  Object.assign(state.applications[0], { status: 'rejected', rejectionReason: 'Please try again.', reviewedAt: new Date().toISOString(), reviewedBy: state.users[0]._id })
  await installMockApi(context, state)
  await page.goto('/opportunities')
  await ready(page)
  const opportunity = page.locator('details').filter({ hasText: state.opportunities[0].title })
  await opportunity.locator('summary').click()
  await opportunity.getByRole('button', { name: `Apply for ${state.opportunities[0].title}`, exact: true }).click()
  await expect(opportunity.getByRole('status')).toContainText('Application submitted successfully.')
  expect(state.applications).toHaveLength(1)
  expect(state.applications[0].status).toBe('pending')
  await page.reload()
  await ready(page)
  await opportunity.locator('summary').click()
  await opportunity.getByRole('button', { name: `Apply for ${state.opportunities[0].title}`, exact: true }).click()
  await expect(opportunity.getByRole('status')).toContainText('already applied')
  expect(state.applications).toHaveLength(1)
  expect(state.unexpected).toEqual([])
})

test('Apply again is limited to eligible rejections and handles closed, uncertain and expired responses', async ({ context, page }, testInfo) => {
  const state = fixtures()
  const base = { ...state.applications[0], status: 'rejected', rejectionReason: 'Check the requirements.' }
  const id = (number) => number.toString(16).padStart(24, '0')
  state.opportunities.push(...['closed', 'open', 'archived'].map((status, index) => ({ ...state.opportunities[0], _id: id(130 + index), status,
    deadline: index === 1 ? '2020-01-01T00:00:00.000Z' : state.opportunities[0].deadline })))
  state.applications = [base, ...['pending', 'under_review', 'approved', 'withdrawn'].map((status, index) => ({ ...base, _id: id(140 + index), status })),
    ...[id(130), id(131), id(132), id(999)].map((opportunity, index) => ({ ...base, _id: id(150 + index), opportunity }))]
  await installMockApi(context, state)
  await page.goto('/applications')
  await ready(page)
  const apply = page.getByRole('button', { name: `Apply again for ${state.opportunities[0].title}`, exact: true })
  await expect(page.getByRole('button', { name: /^Apply again for/ })).toHaveCount(1)
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(apply).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.locator('main li').filter({ has: apply }).screenshot({ path: testInfo.outputPath(`reapplication-${width}-${theme}.png`) })
    }
  }
  state.opportunities[0].status = 'closed'
  await apply.click()
  await expect(page.locator('main [role="alert"]')).toContainText('closed or its deadline has passed')
  expect(base.status).toBe('rejected')
  state.opportunities[0].status = 'open'
  state.failures.push({ path: '/applications', method: 'POST', status: 500 })
  await apply.click()
  await expect(page.locator('main [role="alert"]')).toContainText('Submission could not be confirmed')
  expect(base.status).toBe('rejected')
  expect(state.calls.filter((call) => call.path === '/applications' && call.method === 'POST')).toHaveLength(2)
  state.failures.push({ path: '/applications', method: 'POST', status: 401 })
  await apply.click()
  await expect(page).toHaveURL(/\/login$/)
  expect(base.status).toBe('rejected')
  expect(state.unexpected).toEqual([])
})

test('the assigned teacher can approve after two actual student correction and resubmission rounds', async ({ context, page }) => {
  test.setTimeout(90000)
  const state = fixtures('academic_supervisor')
  Object.assign(state.dailyReports[0], { status: 'submitted', submittedAt: new Date().toISOString() })
  await installMockApi(context, state)
  for (let round = 1; round <= 2; round += 1) {
    await page.goto('/daily-reports')
    await ready(page)
    await page.locator('main summary').click()
    let form = page.getByRole('form', { name: 'Daily report review', exact: true })
    await form.getByLabel('Decision', { exact: true }).selectOption('changes_requested')
    await form.getByLabel('Feedback', { exact: true }).fill(`Add the test results for round ${round}.`)
    await form.getByRole('button', { name: 'Save review', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'returned for changes' })).toBeVisible()
    await ready(page)
    await signInAs(page, 'student')
    await page.goto('/daily-reports')
    await ready(page)
    await page.getByRole('button', { name: 'Edit report', exact: true }).click()
    form = page.getByRole('form', { name: 'Edit daily report', exact: true })
    await form.getByLabel('Tasks completed', { exact: true }).fill(`Corrected tasks and test results for round ${round}.`)
    await form.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Daily report saved' })).toBeVisible()
    await ready(page)
    await page.getByRole('button', { name: 'Submit report', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Daily report submitted' })).toBeVisible()
    await ready(page)
    expect(state.dailyReports[0].status).toBe('submitted')
    await signInAs(page, 'academic_supervisor')
  }
  await page.goto('/daily-reports')
  await ready(page)
  await page.locator('main summary').click()
  const form = page.getByRole('form', { name: 'Daily report review', exact: true })
  await form.getByLabel('Decision', { exact: true }).selectOption('approved')
  await form.getByRole('button', { name: 'Save review', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Daily report approved' })).toBeVisible()
  expect(state.dailyReports[0].status).toBe('approved')
  expect(state.calls.filter((call) => call.path.endsWith('/request-changes'))).toHaveLength(2)
  expect(state.calls.filter((call) => call.path.endsWith('/submit'))).toHaveLength(2)
  await signInAs(page, 'student')
  await page.goto('/daily-reports')
  await ready(page)
  await page.locator('main summary').click()
  await expect(page.locator('main')).toContainText('Approved')
  await expect(page.getByRole('button', { name: 'Edit report', exact: true })).toHaveCount(0)
  expect(state.unexpected).toEqual([])
})
