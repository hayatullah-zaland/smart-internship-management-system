import { expect, test } from '@playwright/test'
import { fixtures, installMockApi, roles } from './mockApi.js'

const newUser = (number = 200, isActive = true) => ({ _id: number.toString(16).padStart(24, '0'), name: 'Unused User ' + number,
  email: 'unused' + number + '@example.test', role: 'student', isActive, createdAt: new Date().toISOString() })
const writes = (state, method, path) => state.calls.filter((call) => call.method === method && (!path || call.path === path))
const rowFor = (page, name) => page.locator('main li').filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) })

async function openUsers(context, page, state = fixtures('admin'), path = '/admin/users') {
  await installMockApi(context, state)
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
  await expect(page.getByText('Loading users...', { exact: true })).toHaveCount(0)
  return state
}

async function fillNewUser(page, name, email, role = 'student') {
  const form = page.locator('section[aria-labelledby="new-user-heading"]')
  await form.getByLabel('Full name', { exact: true }).fill(name)
  await form.getByLabel('Email address', { exact: true }).fill(email)
  await form.getByLabel('Role', { exact: true }).selectOption(role)
  await form.getByLabel('Password', { exact: true }).fill('Test-password-123')
  await form.getByLabel('Confirm password', { exact: true }).fill('Test-password-123')
}

test('creating all four roles works even if the directory fails, without replacing the admin session', async ({ context, page }) => {
  const state = fixtures('admin')
  const adminId = state.signedInUserId
  state.failures.push({ path: '/users', method: 'GET', status: 503, persistent: true })
  await openUsers(context, page, state)
  await expect(page.getByRole('button', { name: 'Create user', exact: true })).toBeEnabled()
  for (const role of roles) {
    await fillNewUser(page, 'New ' + role, 'new.' + role + '@example.test', role)
    await page.getByRole('button', { name: 'Create user', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Account created for New ' + role })).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
    expect(state.signedInUserId).toBe(adminId)
  }
  expect(writes(state, 'POST', '/auth/create-user')).toHaveLength(4)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBe('browser-test-token')
  state.failures = []
  await page.getByRole('button', { name: 'Refresh users', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'New admin', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('header')).toContainText('Browser admin')
  expect(state.unexpected).toEqual([])
})

test('a duplicate email can be corrected and creation retried without a mandatory list refresh', async ({ context, page }) => {
  const state = await openUsers(context, page)
  await fillNewUser(page, 'Duplicate Test', 'student@example.test')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('An account with this email already exists.')
  await expect(page.getByRole('button', { name: 'Create user', exact: true })).toBeEnabled()
  await page.getByLabel('Email address', { exact: true }).fill('corrected@example.test')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Duplicate Test', exact: true })).toBeVisible()
  expect(state.users.filter((user) => user.email === 'corrected@example.test')).toHaveLength(1)
})

test('edit is explicit, cancellable, locked while saving and persists only identity changes', async ({ context, page }) => {
  const state = await openUsers(context, page)
  const teacher = state.users.find((user) => user.role === 'academic_supervisor')
  const oldName = teacher.name
  const originalRole = teacher.role
  await page.getByRole('button', { name: 'Edit user ' + oldName, exact: true }).click()
  let form = page.getByRole('form', { name: 'Edit user ' + oldName, exact: true })
  await expect(form.getByLabel('Full name', { exact: true })).toBeFocused()
  await form.getByLabel('Full name', { exact: true }).fill('Unsaved Name')
  await form.getByRole('button', { name: 'Cancel user edit', exact: true }).click()
  expect(writes(state, 'PATCH')).toHaveLength(0)
  await page.getByRole('button', { name: 'Edit user ' + oldName, exact: true }).click()
  form = page.getByRole('form', { name: 'Edit user ' + oldName, exact: true })
  await form.getByLabel('Full name', { exact: true }).fill('Updated Teacher')
  await form.getByLabel('Email address', { exact: true }).fill('updated.teacher@example.test')
  let release
  state.holdWrites = new Promise((resolve) => { release = resolve })
  try {
    await form.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Create user', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Refresh users', exact: true })).toBeDisabled()
    for (const category of await page.getByRole('navigation', { name: 'Account categories', exact: true }).getByRole('link').all()) {
      await expect(category).toHaveAttribute('aria-disabled', 'true')
    }
    await expect(form.getByLabel('Full name', { exact: true })).toBeDisabled()
    expect(writes(state, 'PATCH', '/users/' + teacher._id)).toHaveLength(1)
  } finally { release(); state.holdWrites = null }
  await expect(page.getByRole('status').filter({ hasText: 'Account updated' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Updated Teacher', exact: true })).toBeVisible()
  expect(teacher.role).toBe(originalRole)
  expect(teacher.isActive).toBe(true)
  await page.reload()
  await expect(rowFor(page, 'Updated Teacher')).toContainText('updated.teacher@example.test')
})

test('active users must be deactivated before confirmed deletion of an unused account', async ({ context, page }) => {
  const state = fixtures('admin')
  const unused = newUser()
  state.users.push(unused)
  await openUsers(context, page, state)
  await page.getByRole('button', { name: 'Delete user ' + unused.name, exact: true }).click()
  let confirmation = page.getByRole('group', { name: 'Confirm deletion of ' + unused.name, exact: true })
  await expect(confirmation).toContainText('Deactivate this account before deleting it.')
  await expect(confirmation.getByRole('button', { name: 'Delete user', exact: true })).toBeDisabled()
  await confirmation.getByRole('button', { name: 'Cancel user deletion', exact: true }).click()
  const access = page.getByRole('form', { name: 'Account access for ' + unused.name, exact: true })
  await access.getByRole('switch').uncheck()
  await access.getByRole('button', { name: 'Deactivate', exact: true }).click()
  await expect(rowFor(page, unused.name)).toContainText('Saved status: Inactive')
  await page.getByRole('button', { name: 'Delete user ' + unused.name, exact: true }).click()
  confirmation = page.getByRole('group', { name: 'Confirm deletion of ' + unused.name, exact: true })
  expect(writes(state, 'DELETE')).toHaveLength(0)
  await confirmation.getByRole('button', { name: 'Cancel user deletion', exact: true }).click()
  expect(writes(state, 'DELETE')).toHaveLength(0)
  await page.getByRole('button', { name: 'Delete user ' + unused.name, exact: true }).click()
  confirmation = page.getByRole('group', { name: 'Confirm deletion of ' + unused.name, exact: true })
  await confirmation.getByRole('button', { name: 'Delete user', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Account deleted' })).toBeVisible()
  await expect(rowFor(page, unused.name)).toHaveCount(0)
  expect(writes(state, 'DELETE')).toHaveLength(1)
  expect(state.users.some((user) => user._id === unused._id)).toBe(false)
  expect(state.internships).toHaveLength(2)
})

test('linked users and administrator accounts stay protected', async ({ context, page }) => {
  const state = fixtures('admin')
  const teacher = state.users.find((user) => user.role === 'academic_supervisor')
  teacher.isActive = false
  await openUsers(context, page, state)
  const adminRow = rowFor(page, 'Browser admin')
  await expect(adminRow).toContainText('Administrator access protected')
  await expect(adminRow.getByRole('button')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete user ' + teacher.name, exact: true }).click()
  await page.getByRole('group', { name: 'Confirm deletion of ' + teacher.name, exact: true }).getByRole('button', { name: 'Delete user', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('has project records and cannot be deleted')
  expect(state.users.some((user) => user._id === teacher._id)).toBe(true)
  expect(state.internships).toHaveLength(2)
  await expect(page.getByRole('button', { name: 'Create user', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Refresh users', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Create user', exact: true })).toBeEnabled()
})

test('duplicate edit errors preserve the draft and allow correcting the email', async ({ context, page }) => {
  const state = await openUsers(context, page)
  const teacher = state.users.find((user) => user.role === 'academic_supervisor')
  await page.getByRole('button', { name: 'Edit user ' + teacher.name, exact: true }).click()
  const form = page.getByRole('form', { name: 'Edit user ' + teacher.name, exact: true })
  await form.getByLabel('Full name', { exact: true }).fill('Updated Teacher')
  await form.getByLabel('Email address', { exact: true }).fill('student@example.test')
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('An account with this email already exists.')
  await expect(form.getByLabel('Full name', { exact: true })).toHaveValue('Updated Teacher')
  await form.getByLabel('Email address', { exact: true }).fill('corrected.teacher@example.test')
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(rowFor(page, 'Updated Teacher')).toContainText('corrected.teacher@example.test')
})

test('deleting the only user on a later page returns to the previous page', async ({ context, page }) => {
  const state = fixtures('admin')
  for (let index = 200; index < 207; index++) state.users.push(newUser(index, false))
  const last = state.users.at(-1)
  await openUsers(context, page, state, '/admin/users?page=2')
  await page.getByRole('button', { name: 'Delete user ' + last.name, exact: true }).click()
  await page.getByRole('group', { name: 'Confirm deletion of ' + last.name, exact: true }).getByRole('button', { name: 'Delete user', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: 'Browser admin', exact: true })).toBeVisible()
})

test('creating from a later page opens page one so the new account is visible', async ({ context, page }) => {
  const state = fixtures('admin')
  for (let index = 200; index < 207; index++) state.users.push(newUser(index))
  await openUsers(context, page, state, '/admin/users?page=2')
  await fillNewUser(page, 'Newest User', 'newest@example.test')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: 'Newest User', exact: true })).toBeVisible()
})

test('an expired session on an edit signs out instead of confirming a change', async ({ context, page }) => {
  const state = await openUsers(context, page)
  const teacher = state.users.find((user) => user.role === 'academic_supervisor')
  await page.getByRole('button', { name: 'Edit user ' + teacher.name, exact: true }).click()
  const form = page.getByRole('form', { name: 'Edit user ' + teacher.name, exact: true })
  await form.getByLabel('Full name', { exact: true }).fill('Changed Name')
  state.failures.push({ path: '/users/' + teacher._id, method: 'PATCH', status: 401 })
  await form.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sims-access-token'))).toBeNull()
})

test('edit and delete controls fit phones, tablets and desktops in both themes', async ({ context, page }, testInfo) => {
  await openUsers(context, page)
  const name = 'Browser academic supervisor'
  for (const mode of ['edit', 'delete']) {
    await page.getByRole('button', { name: (mode === 'edit' ? 'Edit user ' : 'Delete user ') + name, exact: true }).click()
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
        if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
        await rowFor(page, name).screenshot({ path: testInfo.outputPath('user-' + mode + '-' + width + '-' + theme + '.png'), animations: 'disabled' })
      }
    }
    await page.getByRole('button', { name: mode === 'edit' ? 'Cancel user edit' : 'Cancel user deletion', exact: true }).click()
  }
})

const categoryLabels = { student: 'Students', academic_supervisor: 'Teachers', admin: 'Admins', company_representative: 'Company accounts' }

test('account categories show separate server-filtered roles, survive refresh and support an empty category', async ({ context, page }) => {
  const state = await openUsers(context, page)
  const categories = page.getByRole('navigation', { name: 'Account categories', exact: true })
  const rows = page.locator('section[aria-labelledby="users-heading"] > ul > li')
  await expect(rows).toHaveCount(4)
  for (const [role, label] of Object.entries(categoryLabels)) {
    await categories.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp('role=' + role + '$'))
    await expect(categories.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(rows).toHaveCount(1)
    const user = state.users.find((user) => user.role === role)
    await expect(rows).toContainText(user.email)
    for (const other of state.users.filter((user) => user.role !== role)) await expect(rows).not.toContainText(other.email)
    await page.reload()
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText(user.email)
  }
  state.users = state.users.filter((user) => user.role !== 'company_representative')
  await page.getByRole('button', { name: 'Refresh users', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No accounts in this category yet.' })).toBeVisible()
  await expect(rows).toHaveCount(0)
  await categories.getByRole('link', { name: 'All accounts', exact: true }).click()
  await expect(rows).toHaveCount(3)
  expect(state.unexpected).toEqual([])
  expect(state.calls.every((call) => call.method === 'GET')).toBe(true)
})

test('category pagination, browser history and last-row deletion retain the selected role', async ({ context, page }) => {
  const state = fixtures('admin')
  for (let index = 200; index < 210; index++) state.users.push(newUser(index, false))
  const last = state.users.at(-1)
  await openUsers(context, page, state, '/admin/users?role=student')
  const rows = page.locator('section[aria-labelledby="users-heading"] > ul > li')
  await expect(rows).toHaveCount(10)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page).toHaveURL(/role=student&page=2$/)
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText(last.email)
  await page.getByRole('navigation', { name: 'Account categories', exact: true }).getByRole('link', { name: 'Teachers', exact: true }).click()
  await expect(page).toHaveURL(/role=academic_supervisor$/)
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('academic_supervisor@example.test')
  await page.goBack()
  await expect(page).toHaveURL(/role=student&page=2$/)
  await expect(rows).toHaveCount(1)
  await page.getByRole('button', { name: 'Delete user ' + last.name, exact: true }).click()
  await page.getByRole('group', { name: 'Confirm deletion of ' + last.name, exact: true }).getByRole('button', { name: 'Delete user', exact: true }).click()
  await expect(page).toHaveURL(/role=student$/)
  await expect(rows).toHaveCount(10)
  await expect(page.getByRole('navigation', { name: 'Account categories', exact: true }).getByRole('link', { name: 'Students', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(state.users.some((user) => user._id === last._id)).toBe(false)
})

test('creating a different role opens its category and the new-user command focuses the form', async ({ context, page }) => {
  const state = await openUsers(context, page, fixtures('admin'), '/admin/users?role=academic_supervisor')
  await page.getByRole('button', { name: 'New user', exact: true }).click()
  await expect(page.getByLabel('Full name', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('')
  await fillNewUser(page, 'New Company Representative', 'category.company@example.test', 'company_representative')
  await page.getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(page).toHaveURL(/role=company_representative$/)
  await expect(page.getByRole('heading', { name: 'New Company Representative', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Account categories', exact: true }).getByRole('link', { name: 'Company accounts', exact: true })).toHaveAttribute('aria-current', 'page')
  expect(state.signedInUserId).toBe(state.users.find((user) => user.email === 'admin@example.test')._id)
  expect(writes(state, 'POST', '/auth/create-user')).toHaveLength(1)
})

test('category failures hide old rows, allow retry and invalid category URLs use all accounts', async ({ context, page }) => {
  const state = await openUsers(context, page, fixtures('admin'), '/admin/users?role=student')
  state.failures.push({ path: '/users', method: 'GET', status: 503, persistent: true })
  const categories = page.getByRole('navigation', { name: 'Account categories', exact: true })
  await categories.getByRole('link', { name: 'Teachers', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load users')
  await expect(page.getByRole('heading', { name: 'Browser student', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create user', exact: true })).toBeEnabled()
  state.failures = []
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Browser academic supervisor', exact: true })).toBeVisible()
  await page.goto('/admin/users?role=not-a-real-role')
  await expect(categories.getByRole('link', { name: 'All accounts', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('section[aria-labelledby="users-heading"] > ul > li')).toHaveCount(4)
  expect(state.unexpected).toEqual([])
})

test('account category navigation fits mobile, tablet and desktop in both themes', async ({ context, page }, testInfo) => {
  await openUsers(context, page, fixtures('admin'), '/admin/users?role=company_representative')
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true })
      if (await toggle.getAttribute('aria-pressed') !== String(theme === 'dark')) await toggle.click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      const navigation = page.getByRole('navigation', { name: 'Account categories', exact: true })
      const form = await page.locator('section[aria-labelledby="new-user-heading"]').boundingBox()
      const categories = await navigation.boundingBox()
      const list = await page.locator('section[aria-labelledby="users-heading"]').boundingBox()
      expect(form.y + form.height).toBeLessThanOrEqual(categories.y)
      expect(categories.y + categories.height).toBeLessThanOrEqual(list.y)
      for (const link of await navigation.getByRole('link').all()) {
        const box = await link.boundingBox()
        expect(box.width).toBeGreaterThan(0)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.mouse.move(0, 0)
      await page.screenshot({ path: testInfo.outputPath('categories-' + width + '-' + theme + '.png'), fullPage: true, animations: 'disabled' })
    }
  }
})
