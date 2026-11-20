import { expect, test } from '@playwright/test'
import { fixtures, installMockApi, roles, routes } from './mockApi.js'

async function ready(page) {
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('main .loading')).toHaveCount(0)
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
}

async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll('body *')].filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1)
    }).slice(0, 8).map((element) => `${element.tagName}.${element.className}`),
  }))
  expect(dimensions.content, `${page.url()}: ${JSON.stringify(dimensions)}`).toBe(dimensions.width)
}

for (const role of roles) {
  test(`${role}: loaded pages fit mobile, tablet and desktop in both themes`, async ({ context, page }, testInfo) => {
    test.setTimeout(180000)
    const state = fixtures(role)
    state.opportunities[0].description = `LongUnbrokenDescription${'x'.repeat(200)}\nReadable tasks and learning outcomes.`
    state.companies[0].name = `Browser ${'LongCompanyName'.repeat(8)}`
    state.evaluations = [{ _id: '000000000000000000000050', internship: state.internships[1]._id,
      student: state.users[1]._id, evaluator: state.users[role === 'company_representative' ? 3 : 2]._id,
      type: role === 'company_representative' ? 'company' : 'academic', score: 88,
      comments: 'Completed the placement and final assessment.', createdAt: new Date().toISOString() }]
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await installMockApi(context, state)
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const path of routes[role]) {
        await page.goto(path)
        await ready(page)
        const details = page.locator('main summary')
        if (await details.count()) await details.first().click()
        for (const theme of ['light', 'dark']) {
          const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
          if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
          await expect(page.locator('main [role="alert"]')).toHaveCount(0)
          await expect(page.locator('main h1')).toHaveCount(1)
          await noOverflow(page)
          if (path === (role === 'admin' ? '/admin/students' : role === 'student' ? '/daily-reports' : '/evaluations')) {
            await page.evaluate(() => window.scrollTo(0, 0))
            await page.screenshot({ path: testInfo.outputPath(`${role}-${width}-${theme}.png`), fullPage: true })
          }
        }
      }
    }
    expect(state.unexpected).toEqual([])
    expect(state.calls.every((call) => call.method === 'GET')).toBe(true)
    expect(errors).toEqual([])
  })
}

test('signup, login, refresh, theme persistence and logout', async ({ context, page }) => {
  const state = fixtures()
  await installMockApi(context, state, { signedIn: false })
  await page.goto('/signup')
  await page.getByLabel('Full name', { exact: true }).fill('Browser New Student')
  await page.getByLabel('Email address', { exact: true }).fill('new-student@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123')
  await page.getByLabel('Confirm password', { exact: true }).fill('Test-password-123')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Account created' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
  await page.getByRole('link', { name: 'Go to sign in' }).click()
  await page.getByLabel('Email address', { exact: true }).fill('new-student@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await ready(page)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.reload()
  await ready(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
  expect(state.unexpected).toEqual([])
})

test('public forms fit mobile and desktop in both themes', async ({ context, page }, testInfo) => {
  const state = fixtures()
  await installMockApi(context, state, { signedIn: false })
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/login', '/signup']) {
      await page.goto(path)
      await ready(page)
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click()
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await toggle.click()
        await toggle.hover()
        await noOverflow(page)
        await page.screenshot({ path: testInfo.outputPath(`${path.slice(1)}-${width}-${theme}.png`), fullPage: true })
      }
    }
  }
  expect(state.calls).toEqual([])
})

test('failed session restoration keeps the token for retry and an expired session clears it', async ({ context, page }) => {
  const state = fixtures()
  state.failures.push({ path: '/auth/me', status: 503, persistent: true })
  await installMockApi(context, state)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Connection problem', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBe('browser-test-token')
  expect(state.calls.every((call) => call.path === '/auth/me')).toBe(true)
  state.failures = []
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await ready(page)
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  state.failures.push({ path: '/auth/me', status: 401, persistent: true })
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
  expect(state.unexpected).toEqual([])
})

test('opportunity pagination and empty pages show current records without stale data', async ({ context, page }) => {
  const state = fixtures()
  state.opportunities = Array.from({ length: 12 }, (_, index) => ({ ...state.opportunities[0], _id: (200 + index).toString(16).padStart(24, '0'), title: `Paginated internship ${index + 1}` }))
  await installMockApi(context, state)
  await page.goto('/opportunities')
  await ready(page)
  await expect(page.locator('main summary')).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page).toHaveURL(/page=2$/)
  await ready(page)
  await expect(page.locator('main summary')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
  state.opportunities = []
  await page.getByRole('button', { name: 'Refresh opportunities', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('No opportunities on this page.')
  await expect(page.locator('main summary')).toHaveCount(0)
  expect(state.unexpected).toEqual([])
})

test('mobile navigation traps focus, closes on Escape/navigation and clears scroll lock', async ({ context, page }) => {
  const state = fixtures()
  await installMockApi(context, state)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard')
  await ready(page)
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await opener.click()
  await expect(dialog).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  for (let index = 0; index < 15; index++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((element) => document.activeElement === document.body || element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()
  await opener.click()
  await dialog.getByRole('link', { name: 'Opportunities', exact: true }).click()
  await expect(page).toHaveURL(/\/opportunities$/)
  await expect(dialog).not.toBeVisible()
  await ready(page)
  await opener.click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  expect(state.unexpected).toEqual([])
})

test('header tooltips stay within the viewport in both themes and all responsive layouts', async ({ context, page }, testInfo) => {
  const state = fixtures('student')
  await installMockApi(context, state)
  await page.goto('/dashboard')
  await ready(page)
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      const tips = page.locator('header .tooltip[data-tip]')
      for (const tip of await tips.all()) {
        await tip.hover()
        await expect.poll(() => tip.evaluate((element) => Number(getComputedStyle(element, '::before').opacity))).toBe(1)
        await noOverflow(page)
      }
      await page.mouse.move(0, 0)
      await page.screenshot({ path: testInfo.outputPath(`header-${width}-${theme}.png`) })
    }
  }
  expect(state.unexpected).toEqual([])
})

test('neutral report, internship and company-evaluation badges remain readable in both themes', async ({ context, page }, testInfo) => {
  const state = fixtures('student')
  state.evaluations = [{ _id: '000000000000000000000050', internship: state.internships[1]._id,
    student: state.users[1]._id, evaluator: state.users[3]._id, type: 'company', score: 88,
    comments: 'Completed the placement and final assessment.', createdAt: new Date().toISOString() }]
  await installMockApi(context, state)
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/daily-reports', '/weekly-reports', '/internships', '/evaluations']) {
      await page.goto(path)
      await ready(page)
      for (const theme of ['light', 'dark']) {
        const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
        if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
        const badges = page.locator('main .badge-soft.badge-neutral')
        expect(await badges.count()).toBeGreaterThan(0)
        const contentColor = await page.locator('main').evaluate((element) => getComputedStyle(element).color)
        for (const badge of await badges.all()) await expect(badge).toHaveCSS('color', contentColor)
        await noOverflow(page)
        if (path === '/evaluations') {
          await page.mouse.move(0, 0)
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: testInfo.outputPath(`neutral-${width}-${theme}.png`), fullPage: true })
        }
      }
    }
  }
  expect(state.unexpected).toEqual([])
})

test('student profile edits persist and forbidden URLs cannot load admin data', async ({ context, page }) => {
  const state = fixtures()
  await installMockApi(context, state)
  await page.goto('/profile')
  await ready(page)
  await page.getByLabel('Student number', { exact: true }).fill('cs-202')
  await page.getByLabel('Semester', { exact: true }).fill('6')
  await page.getByLabel('Phone number', { exact: true }).fill('+93700987654')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'saved' })).toBeVisible()
  await page.reload()
  await ready(page)
  await expect(page.getByLabel('Student number', { exact: true })).toHaveValue('CS-202')
  await expect(page.getByLabel('Semester', { exact: true })).toHaveValue('6')
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/dashboard$/)
  await ready(page)
  expect(state.calls.some((call) => call.path === '/users')).toBe(false)
  expect(state.unexpected).toEqual([])
})

test('read failure offers retry without losing session; HTTP 401 signs out', async ({ context, page }) => {
  const state = fixtures()
  await installMockApi(context, state)
  await page.goto('/opportunities')
  await ready(page)
  state.failures.push({ path: '/opportunities', status: 500 })
  await page.getByRole('button', { name: 'Refresh opportunities', exact: true }).click()
  await expect(page.locator('main [role="alert"]')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBe('browser-test-token')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await ready(page)
  await expect(page.locator('main [role="alert"]')).toHaveCount(0)
  state.failures.push({ path: '/opportunities', status: 401 })
  await page.getByRole('button', { name: 'Refresh opportunities', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
  expect(state.unexpected).toEqual([])
})

test('admin creates a department, user and company, confirms access and assigns a representative', async ({ context, page }) => {
  const state = fixtures('admin')
  await installMockApi(context, state)
  await page.goto('/departments')
  await ready(page)
  await page.getByLabel('Department name', { exact: true }).fill('Engineering')
  await page.getByLabel('Code', { exact: true }).fill('eng')
  await page.getByRole('button', { name: 'Add department', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'created successfully' })).toBeVisible()
  expect(state.departments[0].code).toBe('ENG')

  await page.goto('/admin/users')
  await ready(page)
  await page.getByLabel('Full name', { exact: true }).fill('Browser New Teacher')
  await page.getByLabel('Email address', { exact: true }).fill('new-teacher@example.test')
  await page.getByLabel('Role', { exact: true }).selectOption('academic_supervisor')
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123')
  await page.getByLabel('Confirm password', { exact: true }).fill('Test-password-123')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Account created for' })).toBeVisible()
  await ready(page)
  const access = page.getByRole('form', { name: 'Account access for Browser New Teacher', exact: true })
  await access.getByRole('switch').uncheck()
  expect(state.users[0].isActive).toBe(true)
  await access.getByRole('button', { name: 'Deactivate', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'deactivated' })).toBeVisible()
  expect(state.users[0].isActive).toBe(false)

  await page.goto('/admin/companies')
  await ready(page)
  await page.getByLabel('Company name', { exact: true }).fill('Browser New Company')
  await page.getByLabel('Contact email', { exact: true }).fill('new-company@example.test')
  await page.getByLabel('Address', { exact: true }).fill('Herat, Afghanistan')
  await page.getByRole('button', { name: 'Create company', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'created successfully' })).toBeVisible()
  await ready(page)
  const representative = page.getByRole('form', { name: 'Representative for Browser New Company', exact: true })
  await representative.getByLabel('Representative', { exact: true }).selectOption(state.users.find((item) => item.role === 'company_representative')._id)
  await representative.getByRole('button', { name: 'Assign representative', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'assigned to Browser New Company' })).toBeVisible()
  expect(state.companies[0].representative).toBe(state.users.find((item) => item.role === 'company_representative')._id)
  await page.goto('/admin/students')
  await ready(page)
  await expect(page.getByText('CS-101', { exact: true })).toBeVisible()
  expect(state.unexpected).toEqual([])
})

test('representative validates and publishes once while pending, then sees the refreshed record', async ({ context, page }) => {
  const state = fixtures('company_representative')
  await installMockApi(context, state)
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/opportunities')
  await ready(page)
  await page.getByRole('button', { name: 'Publish opportunity', exact: true }).click()
  await expect(page.getByLabel('Company ID', { exact: true })).toBeFocused()
  expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0)
  await page.getByLabel('Company ID', { exact: true }).fill(state.companies[0]._id)
  await page.getByLabel('Title', { exact: true }).fill('Browser Published Internship')
  await page.getByLabel('Description', { exact: true }).fill('Work with the engineering team and write tested code.')
  await page.getByLabel('Deadline (Kabul, UTC+04:30)', { exact: true }).fill('2099-12-20T15:30')
  await page.getByLabel('Capacity', { exact: true }).fill('5')
  let release
  state.holdWrites = new Promise((resolve) => { release = resolve })
  try {
    await page.getByRole('button', { name: 'Publish opportunity', exact: true }).click()
    await expect.poll(() => state.calls.filter((call) => call.method === 'POST' && call.path === '/opportunities').length).toBe(1)
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Refresh opportunities', exact: true })).toBeDisabled()
    await page.getByRole('region', { name: 'New opportunity', exact: true }).locator('form')
      .evaluate((form) => { form.requestSubmit(); form.requestSubmit() })
    expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(1)
  } finally { release(); state.holdWrites = null }
  await expect(page.getByRole('status').filter({ hasText: 'published' })).toBeVisible()
  await ready(page)
  expect(state.opportunities[0].deadline).toBe('2099-12-20T11:00:00.000Z')
  await expect(page.locator('summary').filter({ hasText: 'Browser Published Internship' })).toBeVisible()
  await noOverflow(page)
  expect(state.calls.some((call) => call.path === '/companies')).toBe(false)
  expect(state.unexpected).toEqual([])
})

test('student applies once and handles an existing application', async ({ context, page }) => {
  const state = fixtures()
  state.applications = state.applications.slice(0, 1)
  await installMockApi(context, state)
  await page.goto('/opportunities')
  await ready(page)
  const first = page.locator('details').filter({ hasText: state.opportunities[0].title })
  await first.locator('summary').click()
  await first.getByRole('button', { name: `Apply for ${state.opportunities[0].title}`, exact: true }).click()
  await expect(first.getByRole('status')).toContainText('already applied')
  await expect(first.getByRole('button', { name: `Applied for ${state.opportunities[0].title}`, exact: true })).toBeDisabled()
  const second = page.locator('details').filter({ hasText: state.opportunities[1].title })
  await second.locator('summary').click()
  await second.getByRole('button', { name: `Apply for ${state.opportunities[1].title}`, exact: true }).click()
  await expect(second.getByRole('status')).toContainText('Application submitted successfully')
  await expect(second.getByRole('button', { name: `Applied for ${state.opportunities[1].title}`, exact: true })).toBeDisabled()
  await page.goto('/applications')
  await ready(page)
  await expect(page.getByRole('heading', { name: state.opportunities[1].title, exact: true })).toBeVisible()
  expect(state.applications).toHaveLength(2)
  expect(state.unexpected).toEqual([])
})

test('admin reviews an application, assigns its internship and records a lifecycle change', async ({ context, page }) => {
  const state = fixtures('admin')
  await installMockApi(context, state)
  await page.goto('/admin/applications')
  await ready(page)
  await page.locator('summary').filter({ hasText: 'Review application' }).first().click()
  const decision = page.getByRole('form', { name: 'Application decision', exact: true }).first()
  await decision.getByLabel('Decision', { exact: true }).selectOption('approved')
  await decision.getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect.poll(() => state.applications[0].status).toBe('approved')
  await ready(page)
  await page.goto('/internships')
  await ready(page)
  const form = page.getByRole('form', { name: 'Assign internship', exact: true })
  await expect(form.getByLabel('Approved application', { exact: true })).toBeEnabled()
  await form.getByLabel('Approved application', { exact: true }).selectOption(state.applications[0]._id)
  await form.getByLabel('Academic supervisor', { exact: true }).selectOption(state.users.find((item) => item.role === 'academic_supervisor')._id)
  await form.getByLabel('Start date', { exact: true }).fill(state.today)
  await form.getByLabel('End date', { exact: true }).fill(new Date(Date.parse(state.today) + 30 * 86400000).toISOString().slice(0, 10))
  await form.getByRole('button', { name: 'Assign internship', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Internship assigned successfully' })).toBeVisible()
  await ready(page)
  await page.locator('summary').filter({ hasText: 'Update status' }).first().click()
  const change = page.getByRole('form', { name: 'Internship status change', exact: true }).first()
  await change.getByLabel('New status', { exact: true }).selectOption('active')
  await change.getByRole('button', { name: 'Save status', exact: true }).click()
  await expect.poll(() => state.internships[0].status).toBe('active')
  await ready(page)
  await page.locator('summary').filter({ hasText: 'Status history' }).first().click()
  await expect(page.getByText('Assigned to Active', { exact: true })).toBeVisible()
  expect(state.unexpected).toEqual([])
})

for (const kind of ['daily', 'weekly']) {
  test(`student creates, edits and submits a ${kind} report`, async ({ context, page }) => {
    const state = fixtures()
    const key = kind === 'daily' ? 'dailyReports' : 'weeklyReports'
    state[key] = []
    await installMockApi(context, state)
    await page.goto(`/${kind}-reports`)
    await ready(page)
    const form = page.getByRole('form', { name: `New ${kind} report`, exact: true })
    await expect(form.getByLabel('Internship', { exact: true })).toBeEnabled()
    await form.getByLabel('Internship', { exact: true }).selectOption(state.internships[0]._id)
    if (kind === 'daily') {
      await form.getByLabel('Report date', { exact: true }).fill(state.today)
      await form.getByLabel('Hours worked', { exact: true }).fill('6')
      await form.getByLabel('Tasks completed', { exact: true }).fill('Create the student report workflow')
    } else {
      await form.getByLabel('Week number', { exact: true }).fill('1')
      await form.getByLabel('Weekly summary', { exact: true }).fill('Complete the first week of work')
    }
    await form.getByLabel('What I learned', { exact: true }).fill('Write clear reports and test forms')
    await form.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'report saved' })).toBeVisible()
    await ready(page)
    await page.getByRole('button', { name: 'Edit report', exact: true }).click()
    const editor = page.getByRole('form', { name: `Edit ${kind} report`, exact: true })
    await editor.getByLabel('What I learned', { exact: true }).fill('Updated learning after reviewing my draft')
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('form', { name: `New ${kind} report`, exact: true })).toBeVisible()
    await ready(page)
    await page.getByRole('button', { name: 'Submit report', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'report submitted' })).toBeVisible()
    await ready(page)
    expect(state[key][0].learning).toBe('Updated learning after reviewing my draft')
    expect(state[key][0].status).toBe('submitted')
    await expect(page.getByRole('button', { name: 'Edit report', exact: true })).toHaveCount(0)
    expect(state.unexpected).toEqual([])
  })
}

test('assigned supervisor requests changes and later approves a resubmitted daily report', async ({ context, page }) => {
  const state = fixtures('academic_supervisor')
  Object.assign(state.dailyReports[0], { status: 'submitted', submittedAt: new Date().toISOString() })
  await installMockApi(context, state)
  await page.goto('/daily-reports')
  await ready(page)
  await page.locator('main summary').click()
  let form = page.getByRole('form', { name: 'Daily report review', exact: true })
  await form.getByLabel('Decision', { exact: true }).selectOption('changes_requested')
  await form.getByLabel('Feedback', { exact: true }).fill('Please add the result of each task.')
  await form.getByRole('button', { name: 'Save review', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'returned for changes' })).toBeVisible()
  await ready(page)
  expect(state.dailyReports[0].status).toBe('changes_requested')
  Object.assign(state.dailyReports[0], { status: 'submitted', submittedAt: new Date().toISOString(), tasks: 'Updated tasks and results' })
  await page.getByRole('button', { name: 'Refresh daily reports', exact: true }).click()
  await ready(page)
  await page.locator('main summary').click()
  form = page.getByRole('form', { name: 'Daily report review', exact: true })
  await form.getByLabel('Decision', { exact: true }).selectOption('approved')
  await form.getByRole('button', { name: 'Save review', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Daily report approved' })).toBeVisible()
  expect(state.dailyReports[0].status).toBe('approved')
  expect(state.unexpected).toEqual([])
})

for (const role of ['academic_supervisor', 'company_representative']) {
  test(`${role}: evaluation review sends nothing; explicit confirmation records a zero score`, async ({ context, page }) => {
    const state = fixtures(role)
    await installMockApi(context, state)
    await page.goto('/evaluations')
    await ready(page)
    if (role === 'academic_supervisor') {
      await expect(page.getByLabel('Completed internship', { exact: true })).toBeEnabled()
      await page.getByLabel('Completed internship', { exact: true }).selectOption(state.internships[1]._id)
    } else await page.getByLabel('Internship ID', { exact: true }).fill(state.internships[1]._id)
    await page.getByLabel('Score / 100', { exact: true }).fill('0')
    await page.getByLabel('Comments', { exact: true }).fill('Recorded as zero after completing the assessment.')
    await page.getByRole('button', { name: 'Review evaluation', exact: true }).click()
    await expect(page.getByRole('form', { name: 'Confirm final evaluation', exact: true })).toBeVisible()
    expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0)
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByLabel('Score / 100', { exact: true })).toHaveValue('0')
    await page.getByRole('button', { name: 'Review evaluation', exact: true }).click()
    await page.getByRole('button', { name: 'Record evaluation', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'recorded' })).toBeVisible()
    await ready(page)
    expect(state.evaluations[0].score).toBe(0)
    expect(state.evaluations[0].type).toBe(role === 'academic_supervisor' ? 'academic' : 'company')
    expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(1)
    if (role === 'company_representative') expect(state.calls.some((call) => ['/companies', '/internships'].includes(call.path))).toBe(false)
    expect(state.unexpected).toEqual([])
  })
}
